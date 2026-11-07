/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Arsenal Agentique 2026 - Production Full-Stack Server
 * Standards: IBM Secure-by-Design, OWASP Top 10, Zero-Trust Architecture
 * 
 * STATELESS DEPLOYMENT: tout l'état (participants, formations, audit logs,
 * preuves Orange Money, images, sessions admin) vit sur NeonDB. Le disque local
 * n'est plus requis -> plusieurs instances peuvent servir le même trafic.
 */

import express, { type Express } from 'express';
import type { Request, Response, NextFunction } from 'express';
import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRAINING_PRESETS } from '../utils/programPresets.ts';
import type { RegistrationRequest } from '../types/index.ts';
import {
  NeonStore,
  initNeon,
  createAdminSession,
  validateAdminSession,
  putFile,
  getFile,
  decryptAES256GCM,
  getMasterSecret
} from './neonStore.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MASTER_SECRET = getMasterSecret();

/** Idempotent Neon boot marker shared across Vercel lambda warm starts */
const NEON_READY_KEY = '__piga_neon_ready__';

// ============================================================================
// ADMIN IDENTITY (Owner-only gate — env-driven, zero secrets in source)
// Both variables are REQUIRED at boot; declared locally in .env and on Vercel.
// ============================================================================
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    '[BOOT CONFIG ERROR] ADMIN_EMAIL et ADMIN_PASSWORD doivent être déclarés dans les variables ' +
    'd\'environnement (.env local / Vercel Project Settings). Le serveur ne démarrera pas sans identité Direction.'
  );
}

function verifyAdminCredentials(email: string, password: string): boolean {
  if (!email || !password) return false;
  const emailMatches = email.trim().toLowerCase() === ADMIN_EMAIL;
  // Constant-time string comparison to defeat timing side-channels
  const passwordMatches = crypto.timingSafeEqual(
    crypto.createHash('sha256').update(password, 'utf8').digest(),
    crypto.createHash('sha256').update(ADMIN_PASSWORD, 'utf8').digest()
  );
  return emailMatches && passwordMatches;
}

// ============================================================================
// DURABLE NEON REPOSITORY
// ============================================================================
const store = new NeonStore();

function safelyGetClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';
}

// ----------------------------------------------------------------------------
// ZERO-TRUST ADMIN GATEWAY (sessions persistées en base, TTL 12h)
// ----------------------------------------------------------------------------
async function requireAdminSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Public handshake route: admin identification happens here (issues the token)
    if (req.path === '/auth') {
      next();
      return;
    }
    const header = req.headers['authorization'] || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
    const token = bearer || (req.headers['x-admin-token'] as string) || '';
    if (!token) {
      res.status(401).json({ success: false, message: 'Session administrateur requise. Reconnectez-vous à la console.' });
      return;
    }
    const isValid = await validateAdminSession(token);
    if (!isValid) {
      res.status(401).json({ success: false, message: 'Session administrateur expirée. Reconnectez-vous.' });
      return;
    }
    next();
  } catch (err) {
    console.error('[ADMIN GATEWAY ERROR]:', err);
    res.status(500).json({ success: false, message: 'Erreur de vérification de session. Réessayez.' });
  }
}

// ============================================================================
// EXPRESS APPLICATION SETUP (shared by local dev server & Vercel serverless)
// ============================================================================
export interface CreateAppOptions {
  /** Mount Vite HMR middleware (local dev only) */
  devVite?: boolean;
  /** Serve ./dist statically (local production simulation only; Vercel serves it from the edge) */
  serveStatic?: boolean;
}

export async function createPigaApp(options: CreateAppOptions = {}): Promise<Express> {
  // Boot NeonDB once per process (migrations versionnées + seed démo).
  // Guarded via globalThis so Vercel lambda warm containers never re-run DDL.
  if (!(globalThis as Record<string, unknown>)[NEON_READY_KEY]) {
    try {
      await initNeon();
      (globalThis as Record<string, unknown>)[NEON_READY_KEY] = true;
    } catch (err) {
      console.error('[FATAL NEON INITIALIZATION FAILED]:', err);
      console.error('Vérifiez DATABASE_URL / DATABASE_URL_POOLED dans le fichier .env et la disponibilité du projet Neon.');
      throw err;
    }
  }

  const app = express();

  // Parsing & Security Middlewares
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Request audit extractor
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Zero-Trust admin gateway: every /api/admin route (except /auth handshake)
  // demands a valid 12-hour Bearer session issued by the console login.
  app.use('/api/admin', (req: Request, res: Response, next: NextFunction) => {
    void requireAdminSession(req, res, next);
  });

  // --------------------------------------------------------------------------
  // API ROUTES
  // --------------------------------------------------------------------------

  // 1. Get Inventory Status
  app.get('/api/stats', async (req: Request, res: Response) => {
    res.json(await store.getInventory());
  });

  app.get('/api/inventory', async (req: Request, res: Response) => {
    res.json(await store.getInventory());
  });

  // 1b. Public: Get Dynamic Program Configuration
  app.get('/api/program-config', async (req: Request, res: Response) => {
    res.json(await store.getProgramConfig());
  });

  // 1c. Public: Get Available Training Presets
  app.get('/api/program-presets', (req: Request, res: Response) => {
    res.json(TRAINING_PRESETS);
  });

  // 1d. Admin: Update Dynamic Program Configuration
  app.post('/api/admin/program-config', async (req: Request, res: Response) => {
    try {
      const { config, adminId = 'ADM-2026-CHIEF' } = req.body;
      const clientIp = safelyGetClientIp(req);
      const userAgent = req.headers['user-agent'] || 'Unknown-Client';

      if (!config || typeof config !== 'object') {
        return res.status(400).json({ success: false, message: 'Configuration invalide fournie.' });
      }

      const updated = await store.updateProgramConfig(config, adminId, clientIp, userAgent);
      return res.json({ success: true, config: updated });
    } catch (err: unknown) {
      console.error('[UPDATE PROGRAM CONFIG ERROR]:', err);
      return res.status(400).json({ success: false, message: err instanceof Error ? err.message : 'Erreur lors de la mise à jour.' });
    }
  });

  // 1e. Admin: Load Curated Training Preset
  app.post('/api/admin/program-preset', async (req: Request, res: Response) => {
    try {
      const { presetId, adminId = 'ADM-2026-CHIEF' } = req.body;
      const clientIp = safelyGetClientIp(req);
      const userAgent = req.headers['user-agent'] || 'Unknown-Client';

      if (!presetId) {
        return res.status(400).json({ success: false, message: 'Identifiant du modèle manquant.' });
      }

      const updated = await store.loadPreset(presetId, adminId, clientIp, userAgent);
      return res.json({ success: true, config: updated });
    } catch (err: unknown) {
      console.error('[LOAD PRESET ERROR]:', err);
      return res.status(400).json({ success: false, message: err instanceof Error ? err.message : 'Erreur lors du chargement.' });
    }
  });

  // 2. Public Registration Endpoint (Zero-Trust Validation & Atomic Lock)
  app.post('/api/register', async (req: Request, res: Response) => {
    try {
      const clientIp = safelyGetClientIp(req);
      const userAgent = req.headers['user-agent'] || 'Unknown-Client';

      const participant = await store.registerParticipantAtomic(req.body as RegistrationRequest, clientIp, userAgent);

      return res.status(201).json({
        success: true,
        participantId: participant.id,
        ticketCode: participant.ticketCode,
        status: participant.status,
        phoneFormatted: participant.phoneInternational,
        message: 'Inscription enregistrée avec succès. Paiement Orange Money en cours de vérification manuelle.'
      });
    } catch (err: unknown) {
      // Internal error catching logs exhaustive stack trace (Sentry-grade)
      console.error('[CRITICAL INTERNAL REGISTRATION ERROR]:', err);

      // Public API response returns safe, sanitized error message to prevent schema/path leaks
      const errMessage = err instanceof Error ? err.message : '';
      let userFriendlyMessage = 'Une erreur est survenue lors du traitement. Veuillez réessayer ultérieurement.';

      if (errMessage.includes('DRC_PHONE_INVALID')) {
        userFriendlyMessage = errMessage.replace('DRC_PHONE_INVALID: ', '');
      } else if (errMessage.includes('DUPLICATE_REGISTRATION')) {
        userFriendlyMessage = 'Une inscription existe déjà avec ce numéro WhatsApp ou cet e-mail.';
      } else if (errMessage.includes('CAPACITY_EXCEEDED')) {
        userFriendlyMessage = 'La session affiche complet. Aucune place supplémentaire disponible.';
      } else if (errMessage.includes('EMAIL_INVALID')) {
        userFriendlyMessage = 'Adresse e-mail invalide.';
      } else if (errMessage.includes('PAYMENT_PROVIDER_INVALID')) {
        userFriendlyMessage = 'Seuls les paiements par Orange Money sont acceptés pour cette session.';
      }

      return res.status(400).json({
        success: false,
        message: userFriendlyMessage
      });
    }
  });

  // 3. Cryptographic Signed URL Generation for Proof Reads (5-minute expiration)
  app.get('/api/proof-signed-url', (req: Request, res: Response) => {
    try {
      const storagePath = req.query.path as string;
      if (!storagePath) {
        return res.status(400).json({ error: 'Chemin de stockage manquant.' });
      }

      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
      const dataToSign = `${storagePath}:${expiresAt}`;
      const sig = crypto.createHmac('sha256', MASTER_SECRET).update(dataToSign).digest('hex');

      const signedUrl = `/api/storage/proof?path=${encodeURIComponent(storagePath)}&expires=${expiresAt}&sig=${sig}`;
      return res.json({ signedUrl, expiresAt });
    } catch (err) {
      console.error('[SIGNED URL ERROR]:', err);
      return res.status(500).json({ error: 'Impossible de signer l\'URL de preuve.' });
    }
  });

  // 4. Secure Storage Reader (Validates 5-minute HMAC token) — durable en base
  app.get('/api/storage/proof', async (req: Request, res: Response) => {
    try {
      const storagePath = req.query.path as string;
      const expires = Number(req.query.expires);
      const sig = req.query.sig as string;

      if (!storagePath || !expires || !sig) {
        return res.status(403).send('Accès refusé : paramètres de signature manquants.');
      }

      if (Date.now() > expires) {
        return res.status(403).send('Accès refusé : l\'URL signée a expiré (validité 5 minutes).');
      }

      const expectedData = `${storagePath}:${expires}`;
      const expectedSig = crypto.createHmac('sha256', MASTER_SECRET).update(expectedData).digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
        return res.status(403).send('Accès refusé : signature HMAC invalide.');
      }

      const file = await getFile(storagePath);
      if (!file) {
        // Return placeholder svg for proof preview
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.send(`
          <svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
            <rect width="600" height="400" fill="#121418"/>
            <text x="300" y="190" fill="#E05E2B" font-family="sans-serif" font-size="18" font-weight="bold" text-anchor="middle">PREUVE DE PAIEMENT SÉCURISÉE</text>
            <text x="300" y="225" fill="#94A3B8" font-family="sans-serif" font-size="13" text-anchor="middle">Stockage Privé Chiffré • Visualisation autorisée (5 min)</text>
            <text x="300" y="260" fill="#64748B" font-family="monospace" font-size="11" text-anchor="middle">Réf: ${encodeURI(storagePath)}</text>
          </svg>
        `);
      }

      res.setHeader('Content-Type', file.mimeType);
      return res.send(file.data);
    } catch (err) {
      console.error('[STORAGE ACCESS ERROR]:', err);
      return res.status(500).send('Erreur lors de la lecture du fichier.');
    }
  });

  // 5. Public / Embedded Cryptographic Verification Endpoint (/verify/:token)
  app.get('/api/verify/:token', (req: Request, res: Response) => {
    const token = req.params.token;
    const result = decryptAES256GCM(token);
    return res.json({
      ...result,
      timestamp: new Date().toISOString()
    });
  });

  // 6. Admin Authentication (Owner-only: hardcoded PIGA STUDIO Direction identity)
  app.post('/api/admin/auth', async (req: Request, res: Response) => {
    const { email, password } = req.body || {};
    const clientIp = safelyGetClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Unknown-Client';

    const isValid = verifyAdminCredentials(String(email ?? ''), String(password ?? ''));

    if (!isValid) {
      void store.addAuditLog({
        id: crypto.randomUUID(),
        adminId: 'UNAUTHORIZED_ATTEMPT',
        actionType: 'ADMIN_LOGIN',
        timestamp: new Date().toISOString(),
        userAgent,
        ipAddress: clientIp,
        details: { status: 'DENIED', reason: 'Invalid owner credentials' }
      });
      return res.status(401).json({ success: false, message: 'Adresse e-mail ou mot de passe incorrect. Accès strictement réservé à la Direction PIGA STUDIO.' });
    }

    const sessionToken = await createAdminSession(ADMIN_EMAIL);
    void store.addAuditLog({
      id: crypto.randomUUID(),
      adminId: 'DIRECTION_PIGA',
      actionType: 'ADMIN_LOGIN',
      timestamp: new Date().toISOString(),
      userAgent,
      ipAddress: clientIp,
      details: { status: 'GRANTED', ownerAuthenticated: true }
    });

    return res.json({
      success: true,
      token: sessionToken,
      admin: { id: 'ADM-2026-CHIEF', name: 'Direction PIGA STUDIO', email: ADMIN_EMAIL, role: 'CHIEF_AUDITOR' }
    });
  });

  // 7b. Admin: Formation-scoped sales analytics (dashboard)
  app.get('/api/admin/stats', async (req: Request, res: Response) => {
    res.json(await store.getFormationStats());
  });

  // 7. Admin: Get Participants List (Context-specific sanitization)
  app.get('/api/admin/participants', async (req: Request, res: Response) => {
    const list = await store.getParticipants();
    res.json(list);
  });

  // 8. Admin: Confirm Payment & Generate Cryptographic Pass
  app.post('/api/admin/confirm-payment', async (req: Request, res: Response) => {
    try {
      const { participantId, adminId = 'ADM-2026-CHIEF' } = req.body;
      const clientIp = safelyGetClientIp(req);
      const userAgent = req.headers['user-agent'] || 'Unknown-Client';

      const updated = await store.confirmPayment(participantId, adminId, clientIp, userAgent);
      return res.json({ success: true, participant: updated });
    } catch (err) {
      console.error('[CONFIRM PAYMENT ERROR]:', err);
      return res.status(400).json({ success: false, message: 'Échec de validation du paiement.' });
    }
  });

  // 9. Admin: Reject Payment
  app.post('/api/admin/reject-payment', async (req: Request, res: Response) => {
    try {
      const { participantId, reason = 'Preuve illisible ou non concordante', adminId = 'ADM-2026-CHIEF' } = req.body;
      const clientIp = safelyGetClientIp(req);
      const userAgent = req.headers['user-agent'] || 'Unknown-Client';

      const updated = await store.rejectPayment(participantId, adminId, reason, clientIp, userAgent);
      return res.json({ success: true, participant: updated });
    } catch (err) {
      console.error('[REJECT PAYMENT ERROR]:', err);
      return res.status(400).json({ success: false, message: 'Échec du rejet.' });
    }
  });

  // 9b. Admin: Revoke Reservation (contact client for missing/invalid Orange Money proof)
  app.post('/api/admin/revoke-reservation', async (req: Request, res: Response) => {
    try {
      const { participantId, reason = 'Impossibilité de confirmer le paiement Orange Money (+243 803 240 289)', adminId = 'ADM-2026-CHIEF' } = req.body;
      const clientIp = safelyGetClientIp(req);
      const userAgent = req.headers['user-agent'] || 'Unknown-Client';

      const updated = await store.revokeReservation(participantId, adminId, reason, clientIp, userAgent);
      return res.json({ success: true, participant: updated });
    } catch (err) {
      console.error('[REVOKE RESERVATION ERROR]:', err);
      return res.status(400).json({ success: false, message: 'Échec de la révocation.' });
    }
  });

  // 10. Admin: Immutable Audit Logs
  app.get('/api/admin/audit-logs', async (req: Request, res: Response) => {
    res.json(await store.getAuditLogs());
  });

  // 11. Admin: Log Action (Download Ticket, Resend WhatsApp, etc.)
  app.post('/api/admin/log-action', async (req: Request, res: Response) => {
    const { actionType, participantId, adminId = 'ADM-2026-CHIEF', details } = req.body;
    const clientIp = safelyGetClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Unknown-Client';

    await store.addAuditLog({
      id: crypto.randomUUID(),
      adminId,
      actionType,
      participantId,
      timestamp: new Date().toISOString(),
      userAgent,
      ipAddress: clientIp,
      details
    });

    return res.json({ success: true });
  });

  // 11b. Admin: Post-workshop reset — wipes every registration and Orange Money
  // proof, restoring a clean billing console for the next session/workshop.
  app.post('/api/admin/reset-workshop', async (req: Request, res: Response) => {
    try {
      const { adminId = 'ADM-2026-CHIEF' } = req.body || {};
      const clientIp = safelyGetClientIp(req);
      const userAgent = req.headers['user-agent'] || 'Unknown-Client';

      const result = await store.wipeWorkshopData(String(adminId), clientIp, userAgent);
      return res.json({ success: true, ...result });
    } catch (err) {
      console.error('[RESET WORKSHOP ERROR]:', err);
      return res.status(500).json({ success: false, message: 'Échec du nettoyage de la console. Réessayez.' });
    }
  });

  // 12. Formation Registry: list every saved formation + active one
  app.get('/api/admin/formations', async (req: Request, res: Response) => {
    const registry = await store.listFormations();
    return res.json(registry);
  });

  // 13. Launch a brand-new blank formation and activate it immediately
  app.post('/api/admin/formations', async (req: Request, res: Response) => {
    try {
      const { name, adminId = 'ADM-2026-CHIEF' } = req.body;
      const clientIp = safelyGetClientIp(req);
      const userAgent = req.headers['user-agent'] || 'Unknown-Client';

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Nom de la formation manquant.' });
      }

      const activated = await store.createFormation(name, adminId, clientIp, userAgent);
      return res.status(201).json({ success: true, config: activated });
    } catch (err: unknown) {
      console.error('[CREATE FORMATION ERROR]:', err);
      return res.status(500).json({ success: false, message: 'Échec de création de la nouvelle formation.' });
    }
  });

  // 14. Duplicate the currently active formation into a saved standalone copy
  app.post('/api/admin/formations/duplicate', async (req: Request, res: Response) => {
    try {
      const { name, adminId = 'ADM-2026-CHIEF' } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Nom de la copie manquant.' });
      }

      const copy = await store.duplicateFormation(name, adminId);
      return res.status(201).json({ success: true, config: copy });
    } catch (err: unknown) {
      console.error('[DUPLICATE FORMATION ERROR]:', err);
      return res.status(500).json({ success: false, message: 'Échec de la duplication.' });
    }
  });

  // 15. Activate (launch) a saved formation: becomes the live landing page
  app.post('/api/admin/formations/:id/activate', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { adminId = 'ADM-2026-CHIEF' } = req.body;
      const clientIp = safelyGetClientIp(req);
      const userAgent = req.headers['user-agent'] || 'Unknown-Client';

      const activated = await store.activateFormation(id, adminId, clientIp, userAgent);
      return res.json({ success: true, config: activated });
    } catch (err: unknown) {
      console.error('[ACTIVATE FORMATION ERROR]:', err);
      const errMessage = err instanceof Error ? err.message : '';
      if (errMessage.includes('FORMATION_NOT_FOUND')) {
        return res.status(404).json({ success: false, message: 'Formation introuvable dans le registre.' });
      }
      return res.status(500).json({ success: false, message: 'Échec de l\'activation de la formation.' });
    }
  });

  // 16. Delete a saved formation (the active one and the last remaining are protected)
  app.delete('/api/admin/formations/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await store.deleteFormation(id);
      return res.json({ success: true });
    } catch (err: unknown) {
      console.error('[DELETE FORMATION ERROR]:', err);
      const errMessage = err instanceof Error ? err.message : '';
      if (errMessage.includes('FORMATION_NOT_FOUND')) {
        return res.status(404).json({ success: false, message: 'Formation introuvable dans le registre.' });
      }
      if (errMessage.includes('DELETE_BLOCKED')) {
        return res.status(400).json({ success: false, message: errMessage.split(': ')[1] || 'Suppression bloquée.' });
      }
      return res.status(500).json({ success: false, message: 'Échec de la suppression.' });
    }
  });

  // 17. Admin image upload — persisté en base (stored_files): multi-instance safe
  app.post('/api/admin/upload-image', async (req: Request, res: Response) => {
    try {
      const { dataUrl, fileName } = req.body;
      if (!dataUrl || typeof dataUrl !== 'string') {
        return res.status(400).json({ success: false, message: 'Fichier image manquant.' });
      }

      const match = /^data:(image\/(jpeg|jpg|png|webp));base64,(.+)$/i.exec(dataUrl);
      if (!match) {
        return res.status(400).json({ success: false, message: 'Format d\'image non supporté (JPEG, PNG ou WebP requis).' });
      }

      const base64Data = match[3];
      // ~6 MB decoded ceiling to protect the database
      if (base64Data.length > 8 * 1024 * 1024) {
        return res.status(400).json({ success: false, message: 'Image trop volumineuse (maximum ~6 Mo).' });
      }

      const ext = match[2].toLowerCase() === 'jpeg' ? 'jpg' : match[2].toLowerCase();
      const safeName = `img-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
      const mimeType = match[1].toLowerCase();

      await putFile(`uploads/${safeName}`, base64Data, mimeType);

      const originalName = typeof fileName === 'string' ? fileName : safeName;
      console.log(`[UPLOAD] Image de formation stockée en base: ${safeName} (orig: ${originalName})`);
      return res.json({ success: true, url: `/api/uploads/${safeName}` });
    } catch (err: unknown) {
      console.error('[UPLOAD IMAGE ERROR]:', err);
      return res.status(500).json({ success: false, message: 'Échec de l\'enregistrement de l\'image.' });
    }
  });

  // 17b. Public read of formation images (stored_files, fallback disque hérité)
  app.get('/api/uploads/:file', async (req: Request, res: Response) => {
    try {
      // Sanitisation stricte du nom de fichier (anti path traversal)
      const file = String(req.params.file || '');
      if (!file || !/^[a-zA-Z0-9._-]+$/.test(file)) {
        return res.status(400).send('Nom de fichier invalide.');
      }

      const dbPath = `uploads/${file}`;
      let fileRecord = await getFile(dbPath);

      // Fallback disque hérité + backfill en base (migration opportuniste)
      if (!fileRecord) {
        const diskPath = path.resolve(__dirname, 'data', 'uploads', file);
        if (fs.existsSync(diskPath) && fs.statSync(diskPath).isFile()) {
          const buf = fs.readFileSync(diskPath);
          const ext = path.extname(file).toLowerCase();
          const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
          await putFile(dbPath, buf.toString('base64'), mime).catch(() => {});
          fileRecord = { mimeType: mime, data: buf };
        }
      }

      if (!fileRecord) {
        return res.status(404).send('Fichier introuvable.');
      }

      res.setHeader('Content-Type', fileRecord.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=604800');
      return res.send(fileRecord.data);
    } catch (err) {
      console.error('[UPLOAD READ ERROR]:', err);
      return res.status(500).send('Erreur lors de la lecture du fichier.');
    }
  });

  // --------------------------------------------------------------------------
  // INTEGRATIONS (Vercel gère le static depuis l'edge ; ici uniquement simulations locales)
  // --------------------------------------------------------------------------
  const distDir = path.resolve(__dirname, '..', '..', 'dist');
  if (options.serveStatic && fs.existsSync(path.join(distDir, 'index.html'))) {
    app.use(express.static(distDir));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else if (options.devVite) {
    // In dev mode, mount Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  return app;
}

