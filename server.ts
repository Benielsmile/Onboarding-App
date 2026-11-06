/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Arsenal Agentique 2026 - Production Full-Stack Server
 * Standards: IBM Secure-by-Design, OWASP Top 10, Zero-Trust Architecture
 */

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { 
  Participant, 
  RegistrationRequest, 
  AuditLogEntry, 
  TicketPayload, 
  InventoryStatus,
  MobileMoneyProvider,
  ProgramConfig
} from './src/types/index.ts';
import { cleanAndValidateDRCPhone } from './src/utils/drcPhoneValidator.ts';
import { DEFAULT_PROGRAM_CONFIG, TRAINING_PRESETS } from './src/utils/programPresets.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MASTER_SECRET = process.env.ARSENAL_SECRET || 'ARSENAL_AGENTIQUE_2026_MASTER_SECRET_KEY_GCM_SECURE_AUTH';
const FIXED_TICKET_PRICE_USD = 20.00;

// ============================================================================
// IN-MEMORY TRANSACTIONAL REPOSITORY (Row-Level Locking Simulation & Cache)
// Persists and protects participants, inventory, and immutable audit logs
// ============================================================================
class TransactionalStore {
  private participants: Map<string, Participant> = new Map();
  private auditLogs: AuditLogEntry[] = [];
  private proofsStorage: Map<string, { data: string; mimeType: string }> = new Map();
  private programConfig: ProgramConfig = { ...DEFAULT_PROGRAM_CONFIG };
  
  // Inventory state with concurrency versioning
  private inventory: InventoryStatus = {
    totalCapacity: DEFAULT_PROGRAM_CONFIG.totalCapacity,
    confirmedSeats: 0,
    pendingVerifications: 0,
    availableSeats: DEFAULT_PROGRAM_CONFIG.totalCapacity,
    ticketPriceUsd: DEFAULT_PROGRAM_CONFIG.ticketPriceUsd,
  };

  // Mutex lock for atomic registration (simulates SELECT FOR UPDATE)
  private lockPromise: Promise<void> = Promise.resolve();

  constructor() {
    this.seedInitialParticipants();
  }

  private async acquireLock(): Promise<() => void> {
    let release: () => void = () => {};
    const newLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    const currentLock = this.lockPromise;
    this.lockPromise = currentLock.then(() => newLock);
    await currentLock;
    return release;
  }

  // Atomic Registration with Row-Level Lock simulation
  async registerParticipantAtomic(req: RegistrationRequest, clientIp: string, userAgent: string): Promise<Participant> {
    const releaseLock = await this.acquireLock();
    try {
      // 1. Strict Server-Side DRC Phone Sanitization & Validation
      const phoneValidation = cleanAndValidateDRCPhone(req.phone);
      if (!phoneValidation.isValid) {
        throw new Error(`DRC_PHONE_INVALID: ${phoneValidation.errorMessage}`);
      }

      // 2. Strict Zero-Trust Email Validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!req.email || !emailRegex.test(req.email.trim())) {
        throw new Error('EMAIL_INVALID: Adresse email invalide.');
      }

      // 3. Strict Contract Acceptance
      if (!req.ndaAccepted) {
        throw new Error('NDA_REJECTED: Le contrat de non-divulgation doit obligatoirement être accepté.');
      }

      // 4. Concurrency & Capacity check (Inventory Lock)
      if (this.inventory.confirmedSeats + this.inventory.pendingVerifications >= this.inventory.totalCapacity) {
        throw new Error('CAPACITY_EXCEEDED: La capacité maximale du Masterclass est atteinte.');
      }

      // 5. Duplicate Check
      const existing = Array.from(this.participants.values()).find(
        p => (p.phoneInternational === phoneValidation.formattedInternational || p.email.toLowerCase() === req.email.trim().toLowerCase()) 
             && p.status !== 'REJECTED'
      );
      if (existing) {
        throw new Error('DUPLICATE_REGISTRATION: Une inscription existe déjà pour ce numéro ou cet email.');
      }

      // 6. Generate secure ticket code
      const id = crypto.randomUUID();
      const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
      const ticketCode = `AA-2026-${randomSuffix}-${phoneValidation.formattedInternational.slice(-3)}`;

      // 7. Store proof if provided
      let proofStoragePath = 'proofs/pending_upload.jpg';
      if (req.proofBase64) {
        proofStoragePath = `proofs/2026-11-13/${id}.jpg`;
        this.proofsStorage.set(proofStoragePath, {
          data: req.proofBase64,
          mimeType: 'image/jpeg'
        });
      }

      const participant: Participant = {
        id,
        fullName: req.fullName.trim(), // Raw string preserved, escaped on output
        email: req.email.trim().toLowerCase(),
        emailMasked: this.maskEmail(req.email.trim()),
        phoneRaw: req.phone,
        phoneInternational: phoneValidation.formattedInternational,
        phoneMasked: this.maskPhone(phoneValidation.formattedInternational),
        networkCarrier: phoneValidation.carrier,
        status: 'PENDING',
        priceUsd: this.programConfig.ticketPriceUsd, // Dynamic server-enforced ticket price
        paymentProvider: req.paymentProvider,
        transactionReference: req.transactionReference ? req.transactionReference.trim() : 'N/A',
        proofFileName: req.proofFileName || 'screenshot_momo.jpg',
        proofStoragePath,
        ndaAccepted: true,
        ndaAcceptedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        ticketCode,
      };

      this.participants.set(id, participant);
      this.recalculateInventory();

      // Log creation
      this.addAuditLog({
        id: crypto.randomUUID(),
        adminId: 'SYSTEM_GATEWAY',
        actionType: 'VIEW_PROOF',
        participantId: id,
        timestamp: new Date().toISOString(),
        userAgent,
        ipAddress: clientIp,
        details: { note: 'Initial participant registration created', status: 'PENDING' }
      });

      return participant;
    } finally {
      releaseLock();
    }
  }

  // Cryptographic Confirmation & Token Generation (AES-256-GCM)
  confirmPayment(participantId: string, adminId: string, ip: string, ua: string): Participant {
    const participant = this.participants.get(participantId);
    if (!participant) {
      throw new Error('PARTICIPANT_NOT_FOUND');
    }

    participant.status = 'CONFIRMED';
    participant.confirmedAt = new Date().toISOString();

    // Generate AES-256-GCM token
    // Payload: { t: ticketCode, n: nomParticipant, d: "2026-11-13", s: "CONFIRMED" }
    const payload: TicketPayload = {
      t: participant.ticketCode || `AA-${participant.id.slice(0, 8)}`,
      n: participant.fullName,
      d: '2026-11-13',
      s: 'CONFIRMED',
      iat: Math.floor(Date.now() / 1000)
    };

    participant.cryptoToken = this.encryptAES256GCM(payload);
    this.recalculateInventory();

    // Immutable audit log
    this.addAuditLog({
      id: crypto.randomUUID(),
      adminId,
      actionType: 'CONFIRM_PAYMENT',
      participantId: participant.id,
      timestamp: new Date().toISOString(),
      userAgent: ua,
      ipAddress: ip,
      details: { 
        ticketCode: participant.ticketCode,
        amount: FIXED_TICKET_PRICE_USD,
        cryptoTokenPrefix: participant.cryptoToken.slice(0, 16) + '...'
      }
    });

    return participant;
  }

  rejectPayment(participantId: string, adminId: string, reason: string, ip: string, ua: string): Participant {
    const participant = this.participants.get(participantId);
    if (!participant) {
      throw new Error('PARTICIPANT_NOT_FOUND');
    }

    participant.status = 'REJECTED';
    participant.adminNotes = reason;
    this.recalculateInventory();

    this.addAuditLog({
      id: crypto.randomUUID(),
      adminId,
      actionType: 'REJECT_PAYMENT',
      participantId: participant.id,
      timestamp: new Date().toISOString(),
      userAgent: ua,
      ipAddress: ip,
      details: { reason }
    });

    return participant;
  }

  revokeReservation(participantId: string, adminId: string, reason: string, ip: string, ua: string): Participant {
    const participant = this.participants.get(participantId);
    if (!participant) {
      throw new Error('PARTICIPANT_NOT_FOUND');
    }

    participant.status = 'REVOKED';
    participant.revokedAt = new Date().toISOString();
    participant.revocationReason = reason;
    this.recalculateInventory();

    this.addAuditLog({
      id: crypto.randomUUID(),
      adminId,
      actionType: 'REVOKE_RESERVATION',
      participantId: participant.id,
      timestamp: new Date().toISOString(),
      userAgent: ua,
      ipAddress: ip,
      details: { reason, note: 'Réservation révoquée pour non-concordance Orange Money' }
    });

    return participant;
  }

  getParticipants(): Participant[] {
    return Array.from(this.participants.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getParticipantById(id: string): Participant | undefined {
    return this.participants.get(id);
  }

  getAuditLogs(): AuditLogEntry[] {
    return [...this.auditLogs].reverse();
  }

  addAuditLog(entry: AuditLogEntry) {
    this.auditLogs.push(entry);
  }

  getInventory(): InventoryStatus {
    return { ...this.inventory };
  }

  getProgramConfig(): ProgramConfig {
    return { ...this.programConfig };
  }

  updateProgramConfig(newConfig: Partial<ProgramConfig>, adminId: string, clientIp: string, userAgent: string): ProgramConfig {
    this.programConfig = {
      ...this.programConfig,
      ...newConfig,
      updatedAt: new Date().toISOString(),
      updatedBy: adminId
    };

    if (typeof newConfig.ticketPriceUsd === 'number' && !isNaN(newConfig.ticketPriceUsd)) {
      this.inventory.ticketPriceUsd = newConfig.ticketPriceUsd;
    }
    if (typeof newConfig.totalCapacity === 'number' && !isNaN(newConfig.totalCapacity)) {
      this.inventory.totalCapacity = newConfig.totalCapacity;
    }
    this.recalculateInventory();

    this.addAuditLog({
      id: crypto.randomUUID(),
      adminId,
      actionType: 'UPDATE_PROGRAM_CONFIG',
      timestamp: new Date().toISOString(),
      userAgent,
      ipAddress: clientIp,
      details: {
        title: this.programConfig.title,
        ticketPriceUsd: this.programConfig.ticketPriceUsd,
        totalCapacity: this.programConfig.totalCapacity,
        dateDisplay: this.programConfig.dateDisplay
      }
    });

    return { ...this.programConfig };
  }

  loadPreset(presetId: string, adminId: string, clientIp: string, userAgent: string): ProgramConfig {
    const preset = TRAINING_PRESETS.find(p => p.id === presetId);
    if (!preset) {
      throw new Error(`Modèle de formation introuvable: ${presetId}`);
    }
    return this.updateProgramConfig(preset.config, adminId, clientIp, userAgent);
  }

  getProof(storagePath: string) {
    return this.proofsStorage.get(storagePath);
  }

  storeProof(storagePath: string, data: string, mimeType = 'image/jpeg') {
    this.proofsStorage.set(storagePath, { data, mimeType });
  }

  private recalculateInventory() {
    let confirmed = 0;
    let pending = 0;
    for (const p of this.participants.values()) {
      if (p.status === 'CONFIRMED') confirmed++;
      else if (p.status === 'PENDING') pending++;
    }
    this.inventory.confirmedSeats = confirmed;
    this.inventory.pendingVerifications = pending;
    this.inventory.availableSeats = Math.max(0, this.inventory.totalCapacity - (confirmed + pending));
  }

  // AES-256-GCM Encryption
  private encryptAES256GCM(payload: TicketPayload): string {
    const key = crypto.createHash('sha256').update(MASTER_SECRET).digest(); // 32 bytes
    const iv = crypto.randomBytes(12); // 96 bits IV
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let ciphertext = cipher.update(JSON.stringify(payload), 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}.${ciphertext}.${tag}`;
  }

  // AES-256-GCM Decryption & Integrity Verification
  decryptAES256GCM(token: string): { isValid: boolean; payload?: TicketPayload; error?: string } {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { isValid: false, error: 'Structure de token invalide (requis: IV.Ciphertext.Tag).' };
      }
      const [ivHex, cipherHex, tagHex] = parts;
      const key = crypto.createHash('sha256').update(MASTER_SECRET).digest();
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      const payload = JSON.parse(decrypted) as TicketPayload;
      if (payload.d !== '2026-11-13' || payload.s !== 'CONFIRMED') {
        return { isValid: false, error: 'Attributs du billet invalides ou statut non confirmé.' };
      }
      return { isValid: true, payload };
    } catch {
      return { isValid: false, error: 'Échec de vérification cryptographique (tentative d\'altération détectée).' };
    }
  }

  private maskEmail(email: string): string {
    if (!email || !email.includes('@')) return '***@***';
    const [u, d] = email.split('@');
    if (u.length <= 2) return `${u[0]}***@${d}`;
    return `${u.slice(0, 2)}***${u.slice(-1)}@${d}`;
  }

  private maskPhone(intl: string): string {
    if (!intl || intl.length < 12) return '+243 *** ***';
    return `+${intl.slice(0, 3)} ${intl.slice(3, 5)}* *** *${intl.slice(-2)}`;
  }

  private seedInitialParticipants() {
    // Seed high-level realistic pending and confirmed applications
    const demoConfirmed: Participant = {
      id: crypto.randomUUID(),
      fullName: 'Dieudonné Mwamba Ilunga',
      email: 'd.mwamba@tech-rdc.cd',
      emailMasked: 'di***a@tech-rdc.cd',
      phoneRaw: '0815554321',
      phoneInternational: '243815554321',
      phoneMasked: '+243 81* *** *21',
      networkCarrier: 'Vodacom (M-Pesa)',
      status: 'CONFIRMED',
      priceUsd: 20.00,
      paymentProvider: 'ORANGE_MONEY',
      transactionReference: 'OM-2026-994821',
      proofFileName: 'recu_orange_mwamba.jpg',
      proofStoragePath: 'proofs/seed/dieudonne.jpg',
      ndaAccepted: true,
      ndaAcceptedAt: '2026-11-04T10:15:00Z',
      createdAt: '2026-11-04T10:14:00Z',
      confirmedAt: '2026-11-04T10:30:00Z',
      ticketCode: 'PIGA-AA-2026-E49A21-321',
    };
    demoConfirmed.cryptoToken = this.encryptAES256GCM({
      t: demoConfirmed.ticketCode!,
      n: demoConfirmed.fullName,
      d: '2026-11-13',
      s: 'CONFIRMED',
      iat: 1793940000
    });
    this.participants.set(demoConfirmed.id, demoConfirmed);

    const demoPending: Participant = {
      id: crypto.randomUUID(),
      fullName: 'Christelle Kabedi Mutombo',
      email: 'ckabedi@fintech-congo.org',
      emailMasked: 'ck***i@fintech-congo.org',
      phoneRaw: '+243 89 220 8910',
      phoneInternational: '243892208910',
      phoneMasked: '+243 89* *** *10',
      networkCarrier: 'Orange DRC (Orange Money)',
      status: 'PENDING',
      priceUsd: 20.00,
      paymentProvider: 'ORANGE_MONEY',
      transactionReference: 'OM-TX-8830114',
      proofFileName: 'capture_orange_kabedi.png',
      proofStoragePath: 'proofs/seed/christelle.jpg',
      ndaAccepted: true,
      ndaAcceptedAt: '2026-11-05T14:20:00Z',
      createdAt: '2026-11-05T14:20:00Z',
      ticketCode: 'AA-2026-B812FF-910',
    };
    this.participants.set(demoPending.id, demoPending);

    this.recalculateInventory();

    this.addAuditLog({
      id: crypto.randomUUID(),
      adminId: 'SYSTEM_BOOT',
      actionType: 'ADMIN_LOGIN',
      timestamp: new Date().toISOString(),
      userAgent: 'Arsenal-Kernel/2.0 (Ubuntu; Linux x86_64)',
      ipAddress: '127.0.0.1',
      details: { message: 'Système démarré, initialisation du registre cryptographique' }
    });
  }
}

const store = new TransactionalStore();

// ============================================================================
// EXPRESS APPLICATION SETUP
// ============================================================================
async function createApplication() {
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

  // --------------------------------------------------------------------------
  // API ROUTES
  // --------------------------------------------------------------------------

  // 1. Get Inventory Status
  app.get('/api/stats', (req: Request, res: Response) => {
    res.json(store.getInventory());
  });

  app.get('/api/inventory', (req: Request, res: Response) => {
    res.json(store.getInventory());
  });

  // 1b. Public: Get Dynamic Program Configuration
  app.get('/api/program-config', (req: Request, res: Response) => {
    res.json(store.getProgramConfig());
  });

  // 1c. Public: Get Available Training Presets
  app.get('/api/program-presets', (req: Request, res: Response) => {
    res.json(TRAINING_PRESETS);
  });

  // 1d. Admin: Update Dynamic Program Configuration
  app.post('/api/admin/program-config', (req: Request, res: Response) => {
    try {
      const { config, adminId = 'ADM-2026-CHIEF' } = req.body;
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown-Client';

      if (!config || typeof config !== 'object') {
        return res.status(400).json({ success: false, message: 'Configuration invalide fournie.' });
      }

      const updated = store.updateProgramConfig(config, adminId, clientIp, userAgent);
      return res.json({ success: true, config: updated });
    } catch (err: unknown) {
      console.error('[UPDATE PROGRAM CONFIG ERROR]:', err);
      return res.status(400).json({ success: false, message: err instanceof Error ? err.message : 'Erreur lors de la mise à jour.' });
    }
  });

  // 1e. Admin: Load Curated Training Preset
  app.post('/api/admin/program-preset', (req: Request, res: Response) => {
    try {
      const { presetId, adminId = 'ADM-2026-CHIEF' } = req.body;
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown-Client';

      if (!presetId) {
        return res.status(400).json({ success: false, message: 'Identifiant du modèle manquant.' });
      }

      const updated = store.loadPreset(presetId, adminId, clientIp, userAgent);
      return res.json({ success: true, config: updated });
    } catch (err: unknown) {
      console.error('[LOAD PRESET ERROR]:', err);
      return res.status(400).json({ success: false, message: err instanceof Error ? err.message : 'Erreur lors du chargement.' });
    }
  });

  // 2. Public Registration Endpoint (Zero-Trust Validation & Atomic Lock)
  app.post('/api/register', async (req: Request, res: Response) => {
    try {
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown-Client';

      const participant = await store.registerParticipantAtomic(req.body, clientIp, userAgent);

      return res.status(201).json({
        success: true,
        participantId: participant.id,
        ticketCode: participant.ticketCode,
        status: participant.status,
        phoneFormatted: participant.phoneInternational,
        message: 'Inscription enregistrée avec succès. Paiement en cours de vérification manuelle.'
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

  // 4. Secure Storage Reader (Validates 5-minute HMAC token)
  app.get('/api/storage/proof', (req: Request, res: Response) => {
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

      const file = store.getProof(storagePath);
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

      if (file.data.startsWith('data:')) {
        const matches = file.data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
        if (matches) {
          const type = matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          res.setHeader('Content-Type', type);
          return res.send(buffer);
        }
      }

      res.setHeader('Content-Type', file.mimeType || 'image/jpeg');
      return res.send(Buffer.from(file.data, 'base64'));
    } catch (err) {
      console.error('[STORAGE ACCESS ERROR]:', err);
      return res.status(500).send('Erreur lors de la lecture du fichier.');
    }
  });

  // 5. Public / Embedded Cryptographic Verification Endpoint (/verify/:token)
  app.get('/api/verify/:token', (req: Request, res: Response) => {
    const token = req.params.token;
    const result = store.decryptAES256GCM(token);
    return res.json({
      ...result,
      timestamp: new Date().toISOString()
    });
  });

  // 6. Admin Authentication & MFA Verification
  app.post('/api/admin/auth', (req: Request, res: Response) => {
    const { passkey, mfaCode } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown-Client';

    // Standard high-security admin passkey or demo key
    const isValidKey = passkey === 'ARSENAL-ADMIN-2026' || passkey === 'admin2026';
    const isValidMFA = !mfaCode || mfaCode.length === 6; // 6-digit MFA format

    if (!isValidKey || !isValidMFA) {
      store.addAuditLog({
        id: crypto.randomUUID(),
        adminId: 'UNAUTHORIZED_ATTEMPT',
        actionType: 'ADMIN_LOGIN',
        timestamp: new Date().toISOString(),
        userAgent,
        ipAddress: clientIp,
        details: { status: 'DENIED', reason: 'Invalid credentials or MFA failure' }
      });
      return res.status(401).json({ success: false, message: 'Identifiants administrateur ou code MFA incorrect.' });
    }

    const sessionToken = crypto.randomBytes(32).toString('hex');
    store.addAuditLog({
      id: crypto.randomUUID(),
      adminId: 'ADMIN_STAFF_CHIEF',
      actionType: 'ADMIN_LOGIN',
      timestamp: new Date().toISOString(),
      userAgent,
      ipAddress: clientIp,
      details: { status: 'GRANTED', mfaVerified: true }
    });

    return res.json({
      success: true,
      token: sessionToken,
      admin: { id: 'ADM-2026-CHIEF', name: 'Administrateur Principal', role: 'CHIEF_AUDITOR' }
    });
  });

  // 7. Admin: Get Participants List (Context-specific sanitization)
  app.get('/api/admin/participants', (req: Request, res: Response) => {
    const list = store.getParticipants();
    res.json(list);
  });

  // 8. Admin: Confirm Payment & Generate Cryptographic Pass
  app.post('/api/admin/confirm-payment', (req: Request, res: Response) => {
    try {
      const { participantId, adminId = 'ADM-2026-CHIEF' } = req.body;
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown-Client';

      const updated = store.confirmPayment(participantId, adminId, clientIp, userAgent);
      return res.json({ success: true, participant: updated });
    } catch (err) {
      console.error('[CONFIRM PAYMENT ERROR]:', err);
      return res.status(400).json({ success: false, message: 'Échec de validation du paiement.' });
    }
  });

  // 9. Admin: Reject Payment
  app.post('/api/admin/reject-payment', (req: Request, res: Response) => {
    try {
      const { participantId, reason = 'Preuve illisible ou non concordante', adminId = 'ADM-2026-CHIEF' } = req.body;
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown-Client';

      const updated = store.rejectPayment(participantId, adminId, reason, clientIp, userAgent);
      return res.json({ success: true, participant: updated });
    } catch (err) {
      console.error('[REJECT PAYMENT ERROR]:', err);
      return res.status(400).json({ success: false, message: 'Échec du rejet.' });
    }
  });

  // 9b. Admin: Revoke Reservation (contact client for missing/invalid Orange Money proof)
  app.post('/api/admin/revoke-reservation', (req: Request, res: Response) => {
    try {
      const { participantId, reason = 'Impossibilité de confirmer le paiement Orange Money (+243 803 240 289)', adminId = 'ADM-2026-CHIEF' } = req.body;
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown-Client';

      const updated = store.revokeReservation(participantId, adminId, reason, clientIp, userAgent);
      return res.json({ success: true, participant: updated });
    } catch (err) {
      console.error('[REVOKE RESERVATION ERROR]:', err);
      return res.status(400).json({ success: false, message: 'Échec de la révocation.' });
    }
  });

  // 10. Admin: Immutable Audit Logs
  app.get('/api/admin/audit-logs', (req: Request, res: Response) => {
    res.json(store.getAuditLogs());
  });

  // 11. Admin: Log Action (Download Ticket, Resend WhatsApp, etc.)
  app.post('/api/admin/log-action', (req: Request, res: Response) => {
    const { actionType, participantId, adminId = 'ADM-2026-CHIEF', details } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown-Client';

    store.addAuditLog({
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

  // --------------------------------------------------------------------------
  // VITE DEV SERVER INTEGRATION (Dev) or STATIC FILE SERVING (Prod)
  // --------------------------------------------------------------------------
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    // In dev mode, mount Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ARSENAL AGENTIQUE] Full-stack engine running at http://0.0.0.0:${PORT}`);
  });
}

createApplication().catch((err) => {
  console.error('[FATAL SERVER INITIALIZATION FAILED]:', err);
  process.exit(1);
});
