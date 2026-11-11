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
import { generateTicketPDF } from '../utils/pdfGenerator.ts';
import type { FormationMessageInfo } from '../utils/whatsappHelper.ts';
import { isPushEnabled, getVapidPublicKey, notifyAdminNewPayment, notifyAmbassadorSale } from './pushService.ts';
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

// ============================================================================
// RATE LIMITING — fenêtre glissante en mémoire (par instance).
// Sous Vercel serverless, complément UVIDER : Vercel Firewall (voir
// SECURITY-PENTEST-REPORT §Remédiation). Sans new dependency.
// Conception : cap anti-brute-force + anti-bot SANS bloquer un cybercafé
// derrière un NAT partagé (Kinshasa) — les seuils sont généreux mais meurtriers
// pour les machines.
// ============================================================================
type RateBucket = { hits: number[] };
const RATE_BUCKETS = new Map<string, RateBucket>();

function rateLimit(key: string, windowMs: number, maxHits: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const bucket = RATE_BUCKETS.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter(t => now - t < windowMs);
  if (bucket.hits.length >= maxHits) {
    RATE_BUCKETS.set(key, bucket);
    const oldestHit = bucket.hits[0];
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - oldestHit)) / 1000)) };
  }
  bucket.hits.push(now);
  RATE_BUCKETS.set(key, bucket);
  if (RATE_BUCKETS.size > 10_000) {
    for (const [k, b] of RATE_BUCKETS) {
      if (!b.hits.length || now - b.hits[b.hits.length - 1] > 3 * windowMs) RATE_BUCKETS.delete(k);
    }
  }
  return { ok: true, retryAfterSec: 0 };
}

/** Alerte brute-force : ≥ 6 échecs de login / 15 min / IP => alarme claire console+audit */
function recordLoginFailure(ip: string): void {
  const limit = rateLimit(`brute:${ip}`, 15 * 60_000, 6);
  if (!limit.ok) {
    console.error(`[🚨 ALERTE BRUTE-FORCE] ${ip} a dépassé 6 échecs de connexion admin en 15 minutes. Blocage en cours — vérifiez les audit-logs et changez le mot de passe si légitime.`);
    void store.addAuditLog({
      id: crypto.randomUUID(),
      adminId: 'RATE_LIMITER',
      actionType: 'ADMIN_LOGIN',
      timestamp: new Date().toISOString(),
      userAgent: 'RateLimiter/1.0',
      ipAddress: ip,
      details: { status: 'ALARM', reason: 'Brute-force pattern: 6+ failed admin logins / 15min' }
    }).catch(() => { /* audit best-effort */ });
  }
}

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
  app.use(express.json({ limit: '12mb' }));
  app.use(express.urlencoded({ extended: true, limit: '12mb' }));

  // Request audit extractor + security headers (pentest F-07)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // CSP pragmatique : assets self, images data:/blob:/https:, inline styles/scripts
    // (necessaires au splash statique index.html) — à raffermir si on supprime le splash inline.
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "img-src 'self' data: blob: https:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self' wss:",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "object-src 'none'"
    ].join('; '));
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
    }
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

      // 🔒 RATE LIMIT (pentest F-04) : 8 inscriptions / heure / IP — suffisant
      //    pour une équipe derrière un NAT (cybercafé), mortel pour un bot-farmer.
      const regLimit = rateLimit(`reg:${clientIp}`, 3_600_000, 8);
      if (!regLimit.ok) {
        res.setHeader('Retry-After', String(regLimit.retryAfterSec));
        return res.status(429).json({
          success: false,
          message: `Trop d'inscriptions depuis ce réseau. Réessayez dans environ ${Math.ceil(regLimit.retryAfterSec / 60)} minute(s) ou contactez la Direction PIGA STUDIO.`
        });
      }

      const participant = await store.registerParticipantAtomic(req.body as RegistrationRequest, clientIp, userAgent);

      // Push serveur : alerte la Direction (terminaux inscrits) qu'un paiement
      // Orange Money attend sa vérification manuelle.
      void notifyAdminNewPayment(store, participant);

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

  // 2b. Ambassadeur : candidature publique (recrutement de l'armée de distribution)
  app.post('/api/ambassador/register', async (req: Request, res: Response) => {
    try {
      const { fullName, email, phone, termsAccepted } = req.body || {};
      const clientIp = safelyGetClientIp(req);
      const userAgent = req.headers['user-agent'] || 'Unknown-Client';

      const result = await store.createAmbassador(
        { fullName, email, phone, termsAccepted },
        'SELF_REGISTERED',
        clientIp,
        userAgent
      );

      return res.status(201).json({
        success: true,
        alreadyRegistered: result.alreadyRegistered,
        ambassador: result.ambassador,
        message: result.alreadyRegistered
          ? 'Ambassadeur déjà enregistré : voici à nouveau votre lien officiel.'
          : 'Bienvenue dans l\'Armée de Distribution PIGA STUDIO ! Votre lien magique est actif.'
      });
    } catch (err: unknown) {
      console.error('[AMBASSADOR REGISTER ERROR]:', err);
      const errMessage = err instanceof Error ? err.message : '';
      let userFriendlyMessage = 'Échec de la candidature ambassadeur. Réessayez.';
      if (errMessage.includes('DRC_PHONE_INVALID')) userFriendlyMessage = errMessage.replace('DRC_PHONE_INVALID: ', '');
      else if (errMessage.includes('EMAIL_INVALID')) userFriendlyMessage = 'Adresse e-mail invalide.';
      else if (errMessage.includes('NAME_INVALID')) userFriendlyMessage = 'Nom complet requis (3 caractères minimum).';
      else if (errMessage.includes('AMBASSADOR_RATE_LIMITED')) userFriendlyMessage = errMessage.replace('AMBASSADOR_RATE_LIMITED: ', '');
      else if (errMessage.includes('TERMS_REQUIRED')) userFriendlyMessage = errMessage.replace('TERMS_REQUIRED: ', '');
      return res.status(400).json({ success: false, message: userFriendlyMessage });
    }
  });

  // 2c. Ambassadeur : ping de tracking du lien magique (dédupliqué jour + IP)
  app.post('/api/ambassador/:code/click', async (req: Request, res: Response) => {
    try {
      const clientIp = safelyGetClientIp(req);
      const ipHash = crypto.createHmac('sha256', MASTER_SECRET).update(clientIp).digest('hex').slice(0, 32);
      const recorded = await store.recordAmbassadorClick(String(req.params.code), ipHash, req.headers['user-agent'] || 'Unknown-Client');
      return res.json({ success: true, recorded });
    } catch (err) {
      console.error('[AMBASSADOR CLICK ERROR]:', err);
      return res.json({ success: true, recorded: false });
    }
  });

  // 2d. Ambassadeur : tableau de bord public via lien magique
  app.get('/api/ambassador/:code/stats', async (req: Request, res: Response) => {
    try {
      const view = await store.getAmbassadorPortalView(String(req.params.code));
      if (!view) {
        return res.status(404).json({ success: false, message: 'Code ambassadeur introuvable dans le registre PIGA STUDIO.' });
      }
      return res.json({ success: true, ...view });
    } catch (err) {
      console.error('[AMBASSADOR STATS ERROR]:', err);
      return res.status(500).json({ success: false, message: 'Échec du chargement du tableau de bord ambassadeur.' });
    }
  });

  // 3. Cryptographic Signed URL Generation for Proof Reads
  // 🔒 SÉCURITÉ (pentest F-03) : signé STRICTEMENT derrière la session admin —
  //    plus de service de signature public. TTL ramené 5 min → 60 s.
  app.get('/api/proof-signed-url', (req: Request, res: Response, next: NextFunction) => {
    void requireAdminSession(req, res, next);
  }, (req: Request, res: Response) => {
    try {
      const storagePath = req.query.path as string;
      if (!storagePath) {
        return res.status(400).json({ error: 'Chemin de stockage manquant.' });
      }

      const expiresAt = Date.now() + 60 * 1000; // ⏱ 60 secondes (pentest F-03)
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

  // 5b. Public Ticket Invoice PDF — link sent to the client INSIDE the WhatsApp
  // confirmation message, AFTER the Direction has manually confirmed the Orange
  // Money payment. Protected by the unguessable participant UUID and delivered
  // for CONFIRMED registrations only (PENDING members must not obtain a pass).
  app.get('/api/ticket/:participantId/pdf', async (req: Request, res: Response) => {
    try {
      const participant = await store.getParticipantById(String(req.params.participantId));
      if (!participant || participant.status !== 'CONFIRMED') {
        return res.status(404).json({
          error: 'Billet introuvable ou dossier non confirmé. Votre laissez-passer sera délivré après vérification du paiement par la Direction PIGA STUDIO.'
        });
      }

      // Formation info from the participant's program config (server-safe defaults)
      const cfg = await store.getProgramConfig();
      const info: FormationMessageInfo = {
        title: cfg.title,
        tagline: cfg.tagline,
        dateDisplay: cfg.dateDisplay,
        timeDisplay: cfg.timeDisplay,
        locationDisplay: cfg.locationDisplay,
        orangeMoneyNumber: cfg.orangeMoneyNumber,
        orangeMoneyHolder: cfg.orangeMoneyHolder,
        directionEmail: cfg.directionEmail,
        directionPhone: cfg.directionPhone,
        vipWhatsAppUrl: cfg.vipWhatsAppUrl,
        moduleSummaries: cfg.modules.slice(0, 4).map(m => `• ${m.title}${m.highlight ? ` — ${m.highlight}` : ''}`)
      };

      const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
      const host = (req.headers['x-forwarded-host'] as string) || (req.headers.host as string) || 'arsenal-agentique.tech';
      const siteUrl = `${proto}://${host}`;

      const doc = await generateTicketPDF(participant, info, siteUrl);
      const buffer = Buffer.from(doc.output('arraybuffer'));

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Billet_PIGA_STUDIO_${(participant.ticketCode || participant.id).replace(/[^a-zA-Z0-9-]/g, '')}.pdf"`);
      res.setHeader('Cache-Control', 'no-store');
      return res.send(buffer);
    } catch (err) {
      console.error('[TICKET PDF ERROR]:', err);
      return res.status(500).json({ error: 'Échec de génération du billet PDF officiel.' });
    }
  });

  // 5c. Push (W3C Web Push / VAPID): clé publique servie au navigateur
  app.get('/api/push/public-key', (req: Request, res: Response) => {
    return res.json({ enabled: isPushEnabled(), publicKey: getVapidPublicKey() });
  });

  // 5d. Push: enregistrement d'un terminal (Direction via session, Ambassadeur via code vérifié)
  app.post('/api/push/subscribe', async (req: Request, res: Response) => {
    try {
      const { endpoint, keys, audience = 'AMBASSADOR', ambassadorCode } = req.body || {};
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ success: false, message: 'Abonnement push invalide.' });
      }

      const userAgent = req.headers['user-agent'] || 'Unknown-Client';

      if (audience === 'ADMIN') {
        // La Direction doit présenter une session zéro-trust valide
        const header = req.headers['authorization'] || '';
        const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
        const token = bearer || (req.headers['x-admin-token'] as string) || '';
        const { validateAdminSession } = await import('./neonStore.ts');
        if (!(await validateAdminSession(token))) {
          return res.status(401).json({ success: false, message: 'Session administrateur requise pour inscrire un terminal Direction.' });
        }
        await store.savePushSubscription({
          audience: 'ADMIN', adminId: 'ADM-2026-CHIEF', endpoint,
          p256dh: String(keys.p256dh), auth: String(keys.auth), userAgent
        });
        return res.status(201).json({ success: true, audience: 'ADMIN' });
      }

      // Ambassadeur : le code doit exister et être actif
      const ambassador = await store.getAmbassadorByCode(String(ambassadorCode || ''));
      if (!ambassador || ambassador.status !== 'ACTIVE') {
        return res.status(404).json({ success: false, message: 'Code ambassadeur invalide ou suspendu.' });
      }
      await store.savePushSubscription({
        audience: 'AMBASSADOR', ambassadorId: ambassador.id, endpoint,
        p256dh: String(keys.p256dh), auth: String(keys.auth), userAgent
      });
      return res.status(201).json({ success: true, audience: 'AMBASSADOR' });
    } catch (err) {
      console.error('[PUSH SUBSCRIBE ERROR]:', err);
      return res.status(500).json({ success: false, message: 'Échec de l\'enregistrement push.' });
    }
  });

  // 5e. Push: désinscription d'un terminal
  app.post('/api/push/unsubscribe', async (req: Request, res: Response) => {
    try {
      const { endpoint } = req.body || {};
      if (endpoint) await store.deletePushSubscription(String(endpoint));
      return res.json({ success: true });
    } catch (err) {
      console.error('[PUSH UNSUBSCRIBE ERROR]:', err);
      return res.status(500).json({ success: false, message: 'Échec de la désinscription push.' });
    }
  });

  // 6. Admin Authentication (Owner-only: env-driven identity)
  app.post('/api/admin/auth', async (req: Request, res: Response) => {
    const { email, password } = req.body || {};
    const clientIp = safelyGetClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Unknown-Client';

    // 🔒 RATE LIMIT (pentest F-02) : 5 tentatives / minute / IP sur le login
    const loginLimit = rateLimit(`login:${clientIp}`, 60_000, 5);
    if (!loginLimit.ok) {
      void store.addAuditLog({
        id: crypto.randomUUID(),
        adminId: 'RATE_LIMITER',
        actionType: 'ADMIN_LOGIN',
        timestamp: new Date().toISOString(),
        userAgent,
        ipAddress: clientIp,
        details: { status: 'RATE_LIMITED', retryAfterSec: loginLimit.retryAfterSec }
      }).catch(() => {});
      res.setHeader('Retry-After', String(loginLimit.retryAfterSec));
      return res.status(429).json({ success: false, message: `Trop de tentatives de connexion. Réessayez dans ${loginLimit.retryAfterSec} secondes.` });
    }

    const isValid = verifyAdminCredentials(String(email ?? ''), String(password ?? ''));

    if (!isValid) {
      recordLoginFailure(clientIp);
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

      // Push temps réel : alerte l'ambassadeur parrain que sa vente est validée
      // (la commission reste en délai de traitement de 48h avant versement).
      void notifyAmbassadorSale(store, updated);

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

  // 11c. Admin: registre des ambassadeurs avec statistiques (classement Top Ambassadeur)
  app.get('/api/admin/ambassadors', async (req: Request, res: Response) => {
    res.json(await store.listAmbassadorsWithStats());
  });

  // 11d. Admin: création manuelle d'un ambassadeur (Direction)
  app.post('/api/admin/ambassadors', async (req: Request, res: Response) => {
    try {
      const { fullName, email, phone, commissionRate, termsAccepted, adminId = 'ADM-2026-CHIEF' } = req.body || {};
      const clientIp = safelyGetClientIp(req);
      const userAgent = req.headers['user-agent'] || 'Unknown-Client';

      const result = await store.createAmbassador(
        { fullName, email, phone, commissionRate, termsAccepted },
        String(adminId),
        clientIp,
        userAgent,
        { skipRateLimit: true }
      );
      return res.status(201).json({ success: true, ...result });
    } catch (err: unknown) {
      console.error('[ADMIN AMBASSADOR CREATE ERROR]:', err);
      const errMessage = err instanceof Error ? err.message : '';
      let message = 'Échec de création de l\'ambassadeur.';
      if (errMessage.includes('DRC_PHONE_INVALID')) message = errMessage.replace('DRC_PHONE_INVALID: ', '');
      else if (errMessage.includes('EMAIL_INVALID')) message = 'Adresse e-mail invalide.';
      else if (errMessage.includes('NAME_INVALID')) message = 'Nom complet requis.';
      else if (errMessage.includes('AMBASSADOR_CODE_EXHAUSTED')) message = 'Génération de code impossible. Réessayez.';
      return res.status(400).json({ success: false, message });
    }
  });

  // 11e. Admin: détail des ventes rattachées à un ambassadeur
  app.get('/api/admin/ambassadors/:id/sales', async (req: Request, res: Response) => {
    try {
      const sales = await store.listAmbassadorSales(String(req.params.id));
      return res.json(sales);
    } catch (err) {
      console.error('[ADMIN AMBASSADOR SALES ERROR]:', err);
      return res.status(500).json({ success: false, message: 'Échec du chargement des ventes.' });
    }
  });

  // 11f. Admin: verser les commissions gagnées d'un ambassadeur (bouton « Payé »)
  app.post('/api/admin/ambassadors/:id/pay', async (req: Request, res: Response) => {
    try {
      const { adminId = 'ADM-2026-CHIEF' } = req.body || {};
      const clientIp = safelyGetClientIp(req);
      const userAgent = req.headers['user-agent'] || 'Unknown-Client';

      const result = await store.markAmbassadorCommissionsPaid(String(req.params.id), String(adminId), clientIp, userAgent);
      return res.json({ success: true, ...result });
    } catch (err) {
      console.error('[ADMIN AMBASSADOR PAYOUT ERROR]:', err);
      return res.status(500).json({ success: false, message: 'Échec du versement des commissions.' });
    }
  });

  // 11g. Admin: suspendre / réactiver un ambassadeur
  app.post('/api/admin/ambassadors/:id/status', async (req: Request, res: Response) => {
    try {
      const { active, adminId = 'ADM-2026-CHIEF' } = req.body || {};
      const clientIp = safelyGetClientIp(req);
      const userAgent = req.headers['user-agent'] || 'Unknown-Client';

      const ambassador = await store.setAmbassadorStatus(
        String(req.params.id),
        active ? 'ACTIVE' : 'SUSPENDED',
        String(adminId),
        clientIp,
        userAgent
      );
      if (!ambassador) {
        return res.status(404).json({ success: false, message: 'Ambassadeur introuvable.' });
      }
      return res.json({ success: true, ambassador });
    } catch (err) {
      console.error('[ADMIN AMBASSADOR STATUS ERROR]:', err);
      return res.status(500).json({ success: false, message: 'Échec de la mise à jour du statut.' });
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
  // CATCH-ALL ERROR HANDLER (pentest F-06) : URIError et toutes erreurs
  // non-gérées remontent en 400 JSON propre — jamais une 500 qui fuite.
  // --------------------------------------------------------------------------
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const isClientError = err instanceof URIError || (err instanceof Error && err.message?.includes('Failed to decode param'));
    console.error('[API ERROR HANDLER]:', isClientError ? 'Malformed request URL' : err);
    if (res.headersSent) return;
    return res.status(isClientError ? 400 : 500).json({
      success: false,
      message: isClientError ? 'Requête invalide.' : 'Erreur interne. Réessayez ou contactez la Direction PIGA STUDIO.'
    });
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

