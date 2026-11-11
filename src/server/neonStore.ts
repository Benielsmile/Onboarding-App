/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Arsenal Agentique 2026 - NeonDB Persistence Layer (Postgres serverless)
 * Déploiement 100% stateless : participants, formations, audit logs,
 * fichiers (preuves Orange Money + images) et sessions admin vivent en base.
 * Les migrations SQL versionnées sont appliquées automatiquement au boot.
 */

import { Pool } from 'pg';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  Participant,
  RegistrationRequest,
  AuditLogEntry,
  TicketPayload,
  InventoryStatus,
  ProgramConfig,
  AdminStats,
  FormationSummary,
  FormationSalesSummary,
  Ambassador,
  AmbassadorStatus,
  CommissionStatus,
  AmbassadorSummary,
  AmbassadorPortalView,
  AmbassadorSalesEntry
} from '../types/index.ts';
import {
  DEFAULT_PROGRAM_CONFIG,
  TRAINING_PRESETS,
  BLANK_FORMATION_TEMPLATE
} from '../utils/programPresets.ts';
import { cleanAndValidateDRCPhone } from '../utils/drcPhoneValidator.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const MIGRATIONS_DIR = path.join(ROOT_DIR, 'neon', 'migrations');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const FORMATIONS_JSON = path.join(DATA_DIR, 'formations.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

// ============================================================================
// POOL NEON (stratégie poolée : DATABASE_URL_POOLED en priorité)
// ============================================================================
let pool: Pool | null = null;

export function getNeonPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('NEON_NOT_CONFIGURED: DATABASE_URL ou DATABASE_URL_POOLED manquant dans le fichier .env');
    }
    pool = new Pool({
      connectionString,
      // Vercel serverless: une connexion max par instance lambda (best practice Neon).
      // Process local (dev/prod longue durée): pool partagé de 10 connexions.
      max: process.env.VERCEL ? 1 : 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
      ssl: { rejectUnauthorized: false }
    });
    pool.on('error', (err) => {
      console.error('[NEON POOL ERROR]:', err.message);
    });
  }
  return pool;
}

export async function closeNeon(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// ============================================================================
// HELPERS DE MAPPING (rows Postgres -> types applicatifs)
// ============================================================================
type AnyRow = Record<string, unknown>;

const isoOrNull = (d: unknown): string | undefined =>
  d ? new Date(d as string | number | Date).toISOString() : undefined;

function rowToParticipant(row: AnyRow): Participant {
  return {
    id: String(row.id),
    fullName: String(row.full_name),
    email: String(row.email),
    emailMasked: String(row.email_masked),
    phoneRaw: String(row.phone_raw),
    phoneInternational: String(row.phone_international),
    phoneMasked: String(row.phone_masked),
    networkCarrier: String(row.network_carrier),
    status: String(row.status) as Participant['status'],
    priceUsd: Number(row.price_usd),
    programId: String(row.program_id),
    paymentProvider: String(row.payment_provider) as Participant['paymentProvider'],
    transactionReference: String(row.transaction_reference),
    proofFileName: String(row.proof_file_name),
    proofStoragePath: String(row.proof_storage_path),
    ndaAccepted: Boolean(row.nda_accepted),
    ndaAcceptedAt: isoOrNull(row.nda_accepted_at) ?? new Date().toISOString(),
    createdAt: isoOrNull(row.created_at) ?? new Date().toISOString(),
    ticketCode: (row.ticket_code as string | null) ?? undefined,
    cryptoToken: (row.crypto_token as string | null) ?? undefined,
    confirmedAt: isoOrNull(row.confirmed_at),
    adminNotes: (row.admin_notes as string | null) ?? undefined,
    revokedAt: isoOrNull(row.revoked_at),
    revocationReason: (row.revocation_reason as string | null) ?? undefined,
    ambassadorCode: (row.ambassador_code as string | null) ?? undefined,
    commissionUsd: row.commission_usd !== null && row.commission_usd !== undefined ? Number(row.commission_usd) : undefined,
    commissionStatus: (row.commission_status as Participant['commissionStatus']) ?? undefined
  };
}

function rowToConfig(raw: unknown): ProgramConfig {
  const cfg = raw as Partial<ProgramConfig>;
  return { ...DEFAULT_PROGRAM_CONFIG, ...cfg } as ProgramConfig;
}

function rowToAmbassador(row: AnyRow): Ambassador {
  return {
    id: String(row.id),
    code: String(row.code),
    fullName: String(row.full_name),
    email: String(row.email),
    phoneInternational: String(row.phone_international),
    commissionRate: Number(row.commission_rate),
    payoutProvider: String(row.payout_provider ?? 'ORANGE_MONEY'),
    payoutNumber: (row.payout_number as string | null) ?? undefined,
    status: String(row.status) as AmbassadorStatus,
    createdAt: isoOrNull(row.created_at) ?? new Date().toISOString(),
    commissionTermsAcceptedAt: isoOrNull(row.commission_terms_accepted_at)
  };
}

// ============================================================================
// RUNNER DE MIGRATIONS VERSIONNÉES (neon/migrations/*.sql, une tx par fichier)
// ============================================================================
export async function initNeon(): Promise<void> {
  const p = getNeonPool();

  // Registre des migrations appliquées
  await p.query(
    `CREATE TABLE IF NOT EXISTS public.schema_migrations (
       version TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
     )`
  );

  const appliedRows = await p.query('SELECT version FROM public.schema_migrations');
  const applied = new Set(appliedRows.rows.map((r: AnyRow) => String(r.version)));

  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const client = await p.connect();
    try {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO public.schema_migrations (version) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`[NEON MIGRATION] ${file} appliquée.`);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`[NEON MIGRATION FAILED] ${file}:`, err);
      throw err;
    } finally {
      client.release();
    }
  }

  // Garantit la formation par défaut + exactement une formation active
  await p.query(
    `INSERT INTO public.formations (id, config, is_active)
     VALUES ($1, $2::jsonb, false)
     ON CONFLICT (id) DO NOTHING`,
    [DEFAULT_PROGRAM_CONFIG.id, JSON.stringify(DEFAULT_PROGRAM_CONFIG)]
  );
  await p.query(
    `UPDATE public.formations SET is_active = true
     WHERE id = (SELECT id FROM public.formations ORDER BY is_active DESC, updated_at DESC LIMIT 1)`
  );
  await p.query(
    `UPDATE public.formations SET is_active = true
     WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM public.formations WHERE is_active = true)`,
    [DEFAULT_PROGRAM_CONFIG.id]
  );

  // Migration douce : registre data/formations.json -> table formations (première fois)
  const fCount = await p.query<{ n: number }>('SELECT count(*)::int AS n FROM public.formations');
  if (fCount.rows[0].n <= 1 && fs.existsSync(FORMATIONS_JSON)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(FORMATIONS_JSON, 'utf8')) as {
        activeId: string;
        formations: Record<string, ProgramConfig>;
      };
      const entries = Object.entries(parsed.formations || {});
      for (const [id, cfg] of entries) {
        await p.query(
          `INSERT INTO public.formations (id, config, is_active, updated_at)
           VALUES ($1, $2::jsonb, $3, now())
           ON CONFLICT (id) DO NOTHING`,
          [id, JSON.stringify(cfg), id === parsed.activeId]
        );
      }
      console.log(`[NEON INIT] Registre importé depuis data/formations.json (${entries.length} formation(s)).`);
    } catch (err) {
      console.error('[NEON INIT] Import du registre JSON impossible:', err);
    }
  }

  // Migration de conformité : le compte Orange Money récepteur est au nom d'une
  // personne physique (Beniel Musuela, Chargé d'Administration PIGA STUDIO),
  // pas au nom de l'entité. Corrige l'ancienne valeur 'PIGA STUDIO' ou les
  // valeurs manquantes, une seule fois (idempotent). Une autre valeur choisie
  // volontairement dans la console admin n'est jamais écrasée.
  await p.query(
    `UPDATE public.formations
     SET config = jsonb_set(config, '{orangeMoneyHolder}', to_jsonb('Beniel Musuela'::text))
     WHERE NOT EXISTS (
       SELECT 1
       FROM jsonb_object_keys(config) AS k
       WHERE k = 'orangeMoneyHolder'
     ) OR config->>'orangeMoneyHolder' = 'PIGA STUDIO'`
  ).catch((err) => console.error('[NEON INIT] Migration titulaire Orange Money:', err));

  // Migration douce : images d'historique sur disque -> stored_files (multi-instance)
  await migrateLegacyUploads();

  // Seed de démonstration seulement si la base participants EST vierge
  // ET que le journal d'audit est vide (un nettoyage post-atelier laisse
  // une entrée RESET_WORKSHOP_DATA : jamais de re-seed après un wipe).
  const demoCount = await p.query<{ n: number }>('SELECT count(*)::int AS n FROM public.participants');
  const auditCount = await p.query<{ n: number }>('SELECT count(*)::int AS n FROM public.audit_logs');
  if (demoCount.rows[0].n === 0 && auditCount.rows[0].n === 0) {
    console.log('[NEON INIT] Base participants vierge : seed de démonstration inséré.');
    await seedDemoParticipants();
  }

  console.log('[NEON INIT] Migrations appliquées et état vérifié sur Neon.');
}

/** Importe une dernière fois les images héritées du disque dans stored_files. */
async function migrateLegacyUploads(): Promise<void> {
  if (!fs.existsSync(UPLOADS_DIR)) return;
  const files = fs.readdirSync(UPLOADS_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
  for (const file of files) {
    const dbPath = `uploads/${file}`;
    const exists = await getNeonPool().query('SELECT 1 FROM public.stored_files WHERE path = $1', [dbPath]);
    if (exists.rows.length > 0) continue;
    const buf = fs.readFileSync(path.join(UPLOADS_DIR, file));
    const ext = path.extname(file).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    await getNeonPool().query(
      `INSERT INTO public.stored_files (path, mime_type, size_bytes, data)
       VALUES ($1, $2, $3, $4) ON CONFLICT (path) DO NOTHING`,
      [dbPath, mime, buf.length, buf]
    );
  }
}

async function seedDemoParticipants(): Promise<void> {
  const p = getNeonPool();
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
    priceUsd: 20.0,
    programId: DEFAULT_PROGRAM_CONFIG.id,
    paymentProvider: 'ORANGE_MONEY',
    transactionReference: 'OM-2026-994821',
    proofFileName: 'recu_orange_mwamba.jpg',
    proofStoragePath: 'proofs/seed/dieudonne.jpg',
    ndaAccepted: true,
    ndaAcceptedAt: '2026-11-04T10:15:00Z',
    createdAt: '2026-11-04T10:14:00Z',
    confirmedAt: '2026-11-04T10:30:00Z',
    ticketCode: 'PIGA-AA-2026-E49A21-321'
  };
  demoConfirmed.cryptoToken = encryptAES256GCM({
    t: demoConfirmed.ticketCode!,
    n: demoConfirmed.fullName,
    d: '2026-11-13',
    s: 'CONFIRMED',
    iat: 1793940000
  });

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
    priceUsd: 20.0,
    programId: DEFAULT_PROGRAM_CONFIG.id,
    paymentProvider: 'ORANGE_MONEY',
    transactionReference: 'OM-TX-8830114',
    proofFileName: 'capture_orange_kabedi.png',
    proofStoragePath: 'proofs/seed/christelle.jpg',
    ndaAccepted: true,
    ndaAcceptedAt: '2026-11-05T14:20:00Z',
    createdAt: '2026-11-05T14:20:00Z',
    ticketCode: 'AA-2026-B812FF-910'
  };

  for (const demo of [demoConfirmed, demoPending]) {
    await p.query(
      `INSERT INTO public.participants (
        id, full_name, email, email_masked, phone_raw, phone_international, phone_masked,
        network_carrier, status, price_usd, program_id, payment_provider,
        transaction_reference, proof_file_name, proof_storage_path,
        nda_accepted, nda_accepted_at, created_at, confirmed_at, ticket_code, crypto_token
       ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
       ) ON CONFLICT DO NOTHING`,
      [
        demo.id, demo.fullName, demo.email, demo.emailMasked, demo.phoneRaw,
        demo.phoneInternational, demo.phoneMasked, demo.networkCarrier, demo.status,
        demo.priceUsd, demo.programId, demo.paymentProvider, demo.transactionReference,
        demo.proofFileName, demo.proofStoragePath, demo.ndaAccepted,
        demo.ndaAcceptedAt, demo.createdAt, demo.confirmedAt ?? null,
        demo.ticketCode ?? null, demo.cryptoToken ?? null
      ]
    );
  }

  await p.query(
    `INSERT INTO public.audit_logs (id, admin_id, action_type, timestamp, user_agent, ip_address, metadata)
     VALUES ($1, 'SYSTEM_BOOT', 'ADMIN_LOGIN', now(), $2, '127.0.0.1', $3::jsonb)`,
    [
      crypto.randomUUID(),
      'Arsenal-Kernel/2.0 (Ubuntu; Linux x86_64)',
      JSON.stringify({ message: 'Système démarré sur NeonDB, initialisation du registre cryptographique' })
    ]
  );
}

// ============================================================================
// CHIFFREMENT AES-256-GCM (mutualisé avec src/server/app.ts)
// ARSENAL_SECRET est obligatoire : les billets déjà émis dans Neon utilisent
// la clé de l'environnement ; déclarer LA MÊME valeur sur Vercel pour conserver
// la validité des QR codes existants.
// ============================================================================
export function getMasterSecret(): string {
  const secret = process.env.ARSENAL_SECRET;
  if (!secret) {
    throw new Error(
      'ARSENAL_SECRET manquant : déclarez la variable d\'environnement (.env local / Vercel). ' +
      'Aucun fallback cryptographique toléré en production.'
    );
  }
  return secret;
}

export function encryptAES256GCM(payload: TicketPayload): string {
  const key = crypto.createHash('sha256').update(getMasterSecret()).digest(); // 32 bytes
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let ciphertext = cipher.update(JSON.stringify(payload), 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}.${ciphertext}.${tag}`;
}

export function decryptAES256GCM(token: string): { isValid: boolean; payload?: TicketPayload; error?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { isValid: false, error: 'Structure de token invalide (requis: IV.Ciphertext.Tag).' };
    }
    const [ivHex, cipherHex, tagHex] = parts;
    const key = crypto.createHash('sha256').update(getMasterSecret()).digest();
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

// ============================================================================
// MASKING
// ============================================================================
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***';
  const [u, d] = email.split('@');
  if (u.length <= 2) return `${u[0]}***@${d}`;
  return `${u.slice(0, 2)}***${u.slice(-1)}@${d}`;
}

export function maskPhone(intl: string): string {
  if (!intl || intl.length < 12) return '+243 *** ***';
  return `+${intl.slice(0, 3)} ${intl.slice(3, 5)}* *** *${intl.slice(-2)}`;
}

// ============================================================================
// FICHIERS DURABLES (preuves Orange Money + images de formation)
// ============================================================================
export async function putFile(dbPath: string, base64: string, mimeType: string): Promise<void> {
  const buf = Buffer.from(base64, 'base64');
  await getNeonPool().query(
    `INSERT INTO public.stored_files (path, mime_type, size_bytes, data)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (path) DO UPDATE SET mime_type = $2, size_bytes = $3, data = $4`,
    [dbPath, mimeType, buf.length, buf]
  );
}

export async function getFile(dbPath: string): Promise<{ mimeType: string; data: Buffer } | undefined> {
  const r = await getNeonPool().query('SELECT mime_type, data FROM public.stored_files WHERE path = $1', [dbPath]);
  if (!r.rows[0]) return undefined;
  return { mimeType: String(r.rows[0].mime_type), data: r.rows[0].data as Buffer };
}

// ============================================================================
// SESSIONS ADMINISTRATEUR PERSISTÉES (hash SHA-256, TTL 12h, zero-trust)
// ============================================================================
export async function createAdminSession(adminId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token, 'utf8').digest('hex');
  const p = getNeonPool();
  await p.query(
    `INSERT INTO public.admin_sessions (token_hash, admin_id, expires_at)
     VALUES ($1, $2, now() + interval '12 hours')`,
    [tokenHash, adminId]
  );
  // Purge opportuniste des sessions expirées
  await p.query('DELETE FROM public.admin_sessions WHERE expires_at < now()').catch(() => {});
  return token;
}

export async function validateAdminSession(token: string): Promise<boolean> {
  if (!token) return false;
  const tokenHash = crypto.createHash('sha256').update(token, 'utf8').digest('hex');
  const r = await getNeonPool().query(
    'SELECT 1 FROM public.admin_sessions WHERE token_hash = $1 AND expires_at > now() LIMIT 1',
    [tokenHash]
  );
  return r.rows.length > 0;
}

// ============================================================================
// NEON STORE (métier : participants, formations, audit, statistiques)
// ============================================================================
export class NeonStore {
  private get db(): Pool {
    return getNeonPool();
  }

  // --------------------------------------------------------------------------
  // Formation active & registre
  // --------------------------------------------------------------------------
  async getActiveFormationRow(): Promise<{ id: string; config: ProgramConfig } | undefined> {
    const result = await this.db.query('SELECT id, config FROM public.formations WHERE is_active = true LIMIT 1');
    const row = result.rows[0];
    if (!row) return undefined;
    return { id: String(row.id), config: rowToConfig(row.config) };
  }

  async getProgramConfig(): Promise<ProgramConfig> {
    const active = await this.getActiveFormationRow();
    return active ? active.config : { ...DEFAULT_PROGRAM_CONFIG };
  }

  async getInventory(): Promise<InventoryStatus> {
    const cfg = await this.getProgramConfig();
    const counts = await this.db.query(
      `SELECT
         count(*) FILTER (WHERE status = 'CONFIRMED')::int AS confirmed,
         count(*) FILTER (WHERE status = 'PENDING')::int    AS pending
       FROM public.participants
       WHERE program_id = $1`,
      [cfg.id]
    );
    const confirmed = counts.rows[0].confirmed;
    const pending = counts.rows[0].pending;
    return {
      totalCapacity: cfg.totalCapacity,
      confirmedSeats: confirmed,
      pendingVerifications: pending,
      availableSeats: Math.max(0, cfg.totalCapacity - (confirmed + pending)),
      ticketPriceUsd: cfg.ticketPriceUsd
    };
  }

  // --------------------------------------------------------------------------
  // INSCRIPTION ATOMIQUE (transaction Postgres + verrou FOR UPDATE)
  // --------------------------------------------------------------------------
  async registerParticipantAtomic(req: RegistrationRequest, clientIp: string, userAgent: string): Promise<Participant> {
    // 1. Validations applicatives (identiques à l'ancien store)
    const phoneValidation = cleanAndValidateDRCPhone(req.phone);
    if (!phoneValidation.isValid) {
      throw new Error(`DRC_PHONE_INVALID: ${phoneValidation.errorMessage}`);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!req.email || !emailRegex.test(req.email.trim())) {
      throw new Error('EMAIL_INVALID: Adresse email invalide.');
    }

    if (req.paymentProvider !== 'ORANGE_MONEY') {
      throw new Error('PAYMENT_PROVIDER_INVALID: Cette session est payée exclusivement via Orange Money.');
    }

    if (!req.ndaAccepted) {
      throw new Error('NDA_REJECTED: Le contrat de non-divulgation doit obligatoirement être accepté.');
    }

    const email = req.email.trim().toLowerCase();
    const phoneIntl = phoneValidation.formattedInternational;

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // 2. Verrou exclusif sur la formation active (remplace le mutex applicatif)
      const formation = await client.query(
        'SELECT id, config FROM public.formations WHERE is_active = true FOR UPDATE'
      );
      const fRow = formation.rows[0];
      if (!fRow) {
        throw new Error('FORMATIONS_ABSENT: Aucune formation active dans le registre Neon.');
      }
      const cfg = rowToConfig(fRow.config);

      // 3. Capacité (compteurs dérivés à l'intérieur de la transaction verrouillée)
      const seatCounts = await client.query(
        `SELECT count(*) FILTER (WHERE status IN ('PENDING','CONFIRMED'))::int AS taken
         FROM public.participants WHERE program_id = $1`,
        [cfg.id]
      );
      if (seatCounts.rows[0].taken >= cfg.totalCapacity) {
        throw new Error('CAPACITY_EXCEEDED: La capacité maximale du Masterclass est atteinte.');
      }

      // 4. Contrôle anti-doublon (scope : formation active)
      const duplicate = await client.query(
        `SELECT 1 FROM public.participants
         WHERE program_id = $1
           AND status <> 'REJECTED'
           AND (phone_international = $2 OR lower(email) = $3)
         LIMIT 1`,
        [cfg.id, phoneIntl, email]
      );
      if (duplicate.rows.length > 0) {
        throw new Error('DUPLICATE_REGISTRATION: Une inscription existe déjà pour ce numéro ou cet email.');
      }

      // 5. Génère un code de billet sûr
      const id = crypto.randomUUID();
      const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
      const ticketCode = `AA-2026-${randomSuffix}-${phoneIntl.slice(-3)}`;

      // 5b. Attribution ambassadeur (lien magique ?ref=AMB-XXXX) — si le code est
      // actif, l'inscription est étiquetée et la commission figée (snapshot).
      let ambassadorRow: { id: string; code: string; commission_rate: string } | undefined;
      if (req.ref && typeof req.ref === 'string') {
        const ambResult = await client.query(
          `SELECT id, code, commission_rate FROM public.ambassadors
           WHERE upper(code) = $1 AND status = 'ACTIVE'
           LIMIT 1`,
          [req.ref.trim().toUpperCase()]
        );
        ambassadorRow = ambResult.rows[0] as { id: string; code: string; commission_rate: string } | undefined;
      }
      const commissionUsd = ambassadorRow ? Math.round(cfg.ticketPriceUsd * Number(ambassadorRow.commission_rate) * 100) / 100 : null;

      // 6. Preuve de paiement Orange Money (persistée dans la même transaction).
      // req.proofBase64 peut arriver sous forme de data-URL complète
      // ("data:image/jpeg;base64,....") : décoder le préfixe en base64 brouille
      // l'alignement et corrompt les octets JPEG à l'affichage. On isole donc
      // le payload base64 ET le vrai type MIME avant persistance.
      let proofStoragePath = 'proofs/pending_upload.jpg';
      if (req.proofBase64) {
        const proofMatch = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(req.proofBase64);
        const proofBase64 = proofMatch ? proofMatch[2] : req.proofBase64;
        const proofMime = (proofMatch ? proofMatch[1] : 'image/jpeg').toLowerCase();
        const proofExt = proofMime === 'image/jpeg' || proofMime === 'image/jpg' ? 'jpg' : proofMime.split('/')[1];
        proofStoragePath = `proofs/${cfg.id}/${id}.${proofExt}`;
        const proofBuf = Buffer.from(proofBase64, 'base64');
        await client.query(
          `INSERT INTO public.stored_files (path, mime_type, size_bytes, data)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (path) DO UPDATE SET mime_type = $2, size_bytes = $3, data = $4`,
          [proofStoragePath, proofMime, proofBuf.length, proofBuf]
        );
      }

      // 7. Insertion durable
      const inserted = await client.query(
        `INSERT INTO public.participants (
          full_name, email, email_masked, phone_raw, phone_international, phone_masked,
          network_carrier, status, price_usd, program_id, payment_provider,
          transaction_reference, proof_file_name, proof_storage_path,
          nda_accepted, nda_accepted_at, created_at, ticket_code,
          ambassador_code, ambassador_id, commission_usd, commission_status
         ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,'PENDING',$8,$9,$10,$11,$12,$13,true,now(),now(),$14,$15,$16,$17,$18
         ) RETURNING *`,
        [
          req.fullName.trim(),
          email,
          maskEmail(req.email.trim()),
          req.phone,
          phoneIntl,
          maskPhone(phoneIntl),
          phoneValidation.carrier,
          cfg.ticketPriceUsd,
          cfg.id,
          req.paymentProvider,
          req.transactionReference ? req.transactionReference.trim() : 'N/A',
          req.proofFileName || 'screenshot_orange_money.jpg',
          proofStoragePath,
          ticketCode,
          ambassadorRow?.code ?? null,
          ambassadorRow?.id ?? null,
          commissionUsd,
          ambassadorRow ? 'PENDING' : null
        ]
      );
      const participant = rowToParticipant(inserted.rows[0]);

      // 8. Journal d'audit immuable
      await client.query(
        `INSERT INTO public.audit_logs (id, admin_id, action_type, participant_id, timestamp, user_agent, ip_address, metadata)
         VALUES ($1, 'SYSTEM_GATEWAY', 'VIEW_PROOF', $2, now(), $3, $4, $5::jsonb)`,
        [
          crypto.randomUUID(),
          participant.id,
          userAgent,
          clientIp,
          JSON.stringify({ note: 'Initial participant registration created', status: 'PENDING', ticketCode })
        ]
      );

      await client.query('COMMIT');
      return participant;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Décisions administrateurs (confirmation / rejet / révocation)
  // --------------------------------------------------------------------------
  async confirmPayment(participantId: string, adminId: string, ip: string, ua: string): Promise<Participant> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const locked = await client.query('SELECT * FROM public.participants WHERE id = $1 FOR UPDATE', [participantId]);
      if (!locked.rows[0]) throw new Error('PARTICIPANT_NOT_FOUND');
      const participant = rowToParticipant(locked.rows[0]);

      const payload: TicketPayload = {
        t: participant.ticketCode || `AA-${participant.id.slice(0, 8)}`,
        n: participant.fullName,
        d: '2026-11-13',
        s: 'CONFIRMED',
        iat: Math.floor(Date.now() / 1000)
      };
      const cryptoToken = encryptAES256GCM(payload);

      const updated = await client.query(
        `UPDATE public.participants
         SET status = 'CONFIRMED', confirmed_at = now(), crypto_token = $2
         WHERE id = $1
         RETURNING *`,
        [participantId, cryptoToken]
      );
      const result = rowToParticipant(updated.rows[0]);

      // Vente VALIDÉE : la commission de l'ambassadeur parrain est désormais gagnée
      if (result.ambassadorCode) {
        await client.query(
          `UPDATE public.participants SET commission_status = 'EARNED' WHERE id = $1 AND ambassador_id IS NOT NULL`,
          [participantId]
        );
      }

      await client.query(
        `INSERT INTO public.audit_logs (id, admin_id, action_type, participant_id, timestamp, user_agent, ip_address, metadata)
         VALUES ($1, $2, 'CONFIRM_PAYMENT', $3, now(), $4, $5, $6::jsonb)`,
        [
          crypto.randomUUID(), adminId, participantId, ua, ip,
          JSON.stringify({ ticketCode: result.ticketCode, cryptoTokenPrefix: cryptoToken.slice(0, 16) + '...' })
        ]
      );

      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async rejectPayment(participantId: string, adminId: string, reason: string, ip: string, ua: string): Promise<Participant> {
    const updated = await this.db.query(
      `UPDATE public.participants
       SET status = 'REJECTED', admin_notes = $2
       WHERE id = $1
       RETURNING *`,
      [participantId, reason]
    );
    if (!updated.rows[0]) throw new Error('PARTICIPANT_NOT_FOUND');
    const participant = rowToParticipant(updated.rows[0]);

    // Dossier rejeté : commission annulée (zéro litige)
    await this.db.query(
      `UPDATE public.participants SET commission_status = 'CANCELLED' WHERE id = $1 AND ambassador_id IS NOT NULL AND commission_status IN ('PENDING','EARNED')`,
      [participantId]
    );

    await this.addAuditLog({
      id: crypto.randomUUID(),
      adminId,
      actionType: 'REJECT_PAYMENT',
      participantId,
      timestamp: new Date().toISOString(),
      userAgent: ua,
      ipAddress: ip,
      details: { reason }
    });
    return participant;
  }

  async revokeReservation(participantId: string, adminId: string, reason: string, ip: string, ua: string): Promise<Participant> {
    const updated = await this.db.query(
      `UPDATE public.participants
       SET status = 'REVOKED', revoked_at = now(), revocation_reason = $2
       WHERE id = $1
       RETURNING *`,
      [participantId, reason]
    );
    if (!updated.rows[0]) throw new Error('PARTICIPANT_NOT_FOUND');
    const participant = rowToParticipant(updated.rows[0]);

    // Réservation révoquée : commission annulée (zéro litige)
    await this.db.query(
      `UPDATE public.participants SET commission_status = 'CANCELLED' WHERE id = $1 AND ambassador_id IS NOT NULL AND commission_status IN ('PENDING','EARNED')`,
      [participantId]
    );

    await this.addAuditLog({
      id: crypto.randomUUID(),
      adminId,
      actionType: 'REVOKE_RESERVATION',
      participantId,
      timestamp: new Date().toISOString(),
      userAgent: ua,
      ipAddress: ip,
      details: { reason, note: 'Réservation révoquée pour non-concordance Orange Money' }
    });
    return participant;
  }

  // --------------------------------------------------------------------------
  // Lectures
  // --------------------------------------------------------------------------
  async getParticipants(): Promise<Participant[]> {
    const active = await this.getActiveFormationRow();
    const activeId = active ? active.id : DEFAULT_PROGRAM_CONFIG.id;
    const result = await this.db.query(
      `SELECT * FROM public.participants
       WHERE program_id = $1
       ORDER BY created_at DESC`,
      [activeId]
    );
    return result.rows.map(rowToParticipant);
  }

  async getParticipantById(id: string): Promise<Participant | undefined> {
    const result = await this.db.query('SELECT * FROM public.participants WHERE id = $1', [id]);
    return result.rows[0] ? rowToParticipant(result.rows[0]) : undefined;
  }

  async getAuditLogs(): Promise<AuditLogEntry[]> {
    const result = await this.db.query(
      `SELECT * FROM public.audit_logs ORDER BY timestamp DESC LIMIT 500`
    );
    return result.rows.map((row: AnyRow) => ({
      id: String(row.id),
      adminId: String(row.admin_id),
      actionType: String(row.action_type) as AuditLogEntry['actionType'],
      participantId: (row.participant_id as string | null) ?? undefined,
      timestamp: isoOrNull(row.timestamp) ?? new Date().toISOString(),
      userAgent: String(row.user_agent),
      ipAddress: (row.ip_address as string | null) ?? 'unknown',
      details: (row.metadata as Record<string, unknown> | null) ?? {}
    }));
  }

  async addAuditLog(entry: AuditLogEntry): Promise<void> {
    await this.db.query(
      `INSERT INTO public.audit_logs
         (id, admin_id, action_type, participant_id, timestamp, user_agent, ip_address, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [
        entry.id,
        entry.adminId,
        entry.actionType,
        entry.participantId ?? null,
        new Date(entry.timestamp),
        entry.userAgent,
        entry.ipAddress,
        JSON.stringify(entry.details ?? {})
      ]
    );
  }

  // --------------------------------------------------------------------------
  // Analyses commerciales (dashboard "Historique des ventes")
  // --------------------------------------------------------------------------
  async getFormationStats(): Promise<AdminStats> {
    const cfg = await this.getProgramConfig();

    const rows = await this.db.query(
      `SELECT program_id, status, price_usd, created_at, network_carrier
       FROM public.participants`
    );
    interface LightRow {
      programId: string; status: string; priceUsd: number; createdAt: string; networkCarrier: string;
    }
    const all: LightRow[] = rows.rows.map((r: AnyRow) => ({
      programId: String(r.program_id),
      status: String(r.status),
      priceUsd: Number(r.price_usd),
      createdAt: isoOrNull(r.created_at) ?? '',
      networkCarrier: String(r.network_carrier)
    }));

    const summarize = (filter: (r: LightRow) => boolean) => {
      let confirmed = 0, pending = 0, rejected = 0, revoked = 0;
      let revenueConfirmedUsd = 0;
      let revenuePipelineUsd = 0;
      let lastRegistrationAt: string | null = null;
      for (const p of all) {
        if (!filter(p)) continue;
        if (p.status === 'CONFIRMED') { confirmed++; revenueConfirmedUsd += p.priceUsd; }
        else if (p.status === 'PENDING') { pending++; revenuePipelineUsd += p.priceUsd; }
        else if (p.status === 'REJECTED') { rejected++; }
        else if (p.status === 'REVOKED') { revoked++; }
        if (p.createdAt && (!lastRegistrationAt || p.createdAt > lastRegistrationAt)) {
          lastRegistrationAt = p.createdAt;
        }
      }
      return {
        total: confirmed + pending + rejected + revoked,
        confirmed, pending, rejected, revoked,
        revenueConfirmedUsd, revenuePipelineUsd, lastRegistrationAt
      };
    };

    const activeId = cfg.id;
    const activeBase = summarize(p => p.programId === activeId);

    // Inscriptions par jour (14 derniers jours) + opérateurs pour la formation active
    const daily: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      daily.push({ date: day, count: 0 });
    }
    const dailyIndex = new Map(daily.map(d => [d.date, d]));
    const carriers: Record<string, number> = {};
    for (const p of all) {
      if (p.programId !== activeId) continue;
      const bucket = dailyIndex.get(p.createdAt.slice(0, 10));
      if (bucket) bucket.count++;
      carriers[p.networkCarrier] = (carriers[p.networkCarrier] || 0) + 1;
    }

    const formationsList = await this.db.query(
      'SELECT id, config FROM public.formations ORDER BY updated_at DESC'
    );
    interface FormationSalesRow extends FormationSalesSummary {}
    const byFormation: FormationSalesRow[] = formationsList.rows.map((row: AnyRow) => {
      const c = rowToConfig(row.config);
      return {
        id: c.id,
        title: c.title,
        dateDisplay: c.dateDisplay,
        ticketPriceUsd: c.ticketPriceUsd,
        isActive: c.id === activeId,
        ...summarize(p => p.programId === c.id)
      };
    }).sort((a: FormationSalesRow, b: FormationSalesRow) =>
      (b.lastRegistrationAt || '').localeCompare(a.lastRegistrationAt || '')
    );

    return {
      activeId,
      activeFormation: {
        id: cfg.id,
        title: cfg.title,
        dateDisplay: cfg.dateDisplay,
        ticketPriceUsd: cfg.ticketPriceUsd,
        totalCapacity: cfg.totalCapacity,
        status: cfg.status
      },
      active: { ...activeBase, carriers, daily },
      byFormation
    };
  }

  // --------------------------------------------------------------------------
  // Registre des formations (CRUD durable)
  // --------------------------------------------------------------------------
  async listFormations(): Promise<{ activeId: string; formations: Array<{ id: string; title: string; status: string; dateDisplay: string; updatedAt: string }> }> {
    const result = await this.db.query('SELECT id, config, is_active, updated_at FROM public.formations ORDER BY updated_at DESC');
    let activeId = '';
    const formations = result.rows.map((row: AnyRow) => {
      const c = rowToConfig(row.config);
      if (row.is_active) activeId = c.id;
      return {
        id: c.id,
        title: c.title,
        status: c.status,
        dateDisplay: c.dateDisplay,
        updatedAt: isoOrNull(row.updated_at) ?? c.updatedAt
      };
    });
    if (!activeId && formations.length > 0) activeId = formations[0].id;
    return { activeId, formations };
  }

  private async setActiveFormation(db: Pool, id: string): Promise<void> {
    await db.query('UPDATE public.formations SET is_active = false WHERE is_active = true');
    await db.query(
      `UPDATE public.formations SET is_active = true, updated_at = now() WHERE id = $1`,
      [id]
    );
  }

  async updateProgramConfig(newConfig: Partial<ProgramConfig>, adminId: string, clientIp: string, userAgent: string): Promise<ProgramConfig> {
    const current = await this.getProgramConfig();
    const merged: ProgramConfig = {
      ...current,
      ...newConfig,
      id: current.id,
      updatedAt: new Date().toISOString(),
      updatedBy: adminId
    };
    return this.persistAndAudit(merged, adminId, clientIp, userAgent, 'UPDATE_PROGRAM_CONFIG', {
      title: merged.title,
      ticketPriceUsd: merged.ticketPriceUsd,
      totalCapacity: merged.totalCapacity,
      dateDisplay: merged.dateDisplay
    });
  }

  async replaceProgramConfig(newConfig: ProgramConfig, adminId: string, clientIp: string, userAgent: string): Promise<ProgramConfig> {
    const merged: ProgramConfig = {
      ...DEFAULT_PROGRAM_CONFIG,
      ...newConfig,
      updatedAt: new Date().toISOString(),
      updatedBy: adminId
    };
    // Réactive la formation correspondante (RELEASE / ACTIVATION)
    await this.db.query(
      `INSERT INTO public.formations (id, config, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET config = $2::jsonb, updated_at = now()`,
      [merged.id, JSON.stringify(merged)]
    );
    await this.setActiveFormation(this.db, merged.id);
    return this.persistAndAudit(merged, adminId, clientIp, userAgent, 'UPDATE_PROGRAM_CONFIG', {
      note: 'Activation de formation dans le registre',
      formationId: merged.id,
      title: merged.title
    });
  }

  private async persistAndAudit(
    config: ProgramConfig,
    adminId: string,
    clientIp: string,
    userAgent: string,
    actionType: AuditLogEntry['actionType'],
    details: Record<string, unknown>
  ): Promise<ProgramConfig> {
    await this.db.query(
      `UPDATE public.formations SET config = $2::jsonb, updated_at = now(), updated_by = $3 WHERE id = $1`,
      [config.id, JSON.stringify(config), adminId]
    );
    await this.addAuditLog({
      id: crypto.randomUUID(),
      adminId,
      actionType,
      timestamp: new Date().toISOString(),
      userAgent,
      ipAddress: clientIp,
      details
    });
    return { ...config };
  }

  async loadPreset(presetId: string, adminId: string, clientIp: string, userAgent: string): Promise<ProgramConfig> {
    const preset = TRAINING_PRESETS.find(p => p.id === presetId);
    if (!preset) {
      throw new Error(`Modèle de formation introuvable: ${presetId}`);
    }
    return this.updateProgramConfig(preset.config, adminId, clientIp, userAgent);
  }

  async createFormation(name: string, adminId: string, clientIp: string, userAgent: string): Promise<ProgramConfig> {
    const id = `formation-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const config: ProgramConfig = {
      ...BLANK_FORMATION_TEMPLATE,
      id,
      title: name.trim(),
      updatedAt: new Date().toISOString()
    };
    await this.db.query(
      `INSERT INTO public.formations (id, config, updated_at) VALUES ($1, $2::jsonb, now())`,
      [id, JSON.stringify(config)]
    );
    return this.replaceProgramConfig(config, adminId, clientIp, userAgent);
  }

  async duplicateFormation(name: string, adminId: string): Promise<ProgramConfig> {
    const source = await this.getProgramConfig();
    const id = `formation-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const copy: ProgramConfig = {
      ...source,
      id,
      title: name.trim(),
      status: 'COMING_SOON',
      updatedAt: new Date().toISOString(),
      updatedBy: adminId
    };
    await this.db.query(
      `INSERT INTO public.formations (id, config, updated_by, updated_at) VALUES ($1, $2::jsonb, $3, now())`,
      [id, JSON.stringify(copy), adminId]
    );
    return copy;
  }

  async activateFormation(id: string, adminId: string, clientIp: string, userAgent: string): Promise<ProgramConfig> {
    const result = await this.db.query('SELECT config FROM public.formations WHERE id = $1', [id]);
    if (!result.rows[0]) {
      throw new Error('FORMATION_NOT_FOUND: Formation introuvable dans le registre.');
    }
    const saved = rowToConfig(result.rows[0].config);
    return this.replaceProgramConfig(saved, adminId, clientIp, userAgent);
  }

  async deleteFormation(id: string): Promise<void> {
    const { activeId, formations } = await this.listFormations();
    const target = formations.find(f => f.id === id);
    if (!target) {
      throw new Error('FORMATION_NOT_FOUND: Formation introuvable dans le registre.');
    }
    if (id === activeId) {
      throw new Error('ACTIVE_FORMATION_DELETE_BLOCKED: Impossible de supprimer la formation active. Activez d\'abord une autre formation.');
    }
    if (formations.length <= 1) {
      throw new Error('LAST_FORMATION_DELETE_BLOCKED: Impossible de supprimer la dernière formation du registre.');
    }
    await this.db.query('DELETE FROM public.formations WHERE id = $1', [id]);
  }

  // --------------------------------------------------------------------------
  // Nettoyage post-atelier (wipe) : réinitialise la billetterie pour la
  // prochaine session. Supprime toutes les inscriptions et preuves Orange
  // Money ; le journal d'audit immuable est conservé et documente l'action.
  // --------------------------------------------------------------------------
  async wipeWorkshopData(adminId: string, clientIp: string, userAgent: string): Promise<{ deletedParticipants: number; deletedProofs: number }> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const proofRes = await client.query(`DELETE FROM public.stored_files WHERE path LIKE 'proofs/%'`);
      const partRes = await client.query('DELETE FROM public.participants');
      const deletedParticipants = partRes.rowCount ?? 0;
      const deletedProofs = proofRes.rowCount ?? 0;

      // Journal d'audit immuable — protégé par SAVEPOINT : une enum de type
      // non migrée (BASE_NOT_MIGRATED) ne doit JAMAIS faire échouer le wipe.
      try {
        await client.query('SAVEPOINT wipe_audit');
        await client.query(
          `INSERT INTO public.audit_logs (id, admin_id, action_type, timestamp, user_agent, ip_address, metadata)
           VALUES ($1, $2, 'RESET_WORKSHOP_DATA', now(), $3, $4, $5::jsonb)`,
          [
            crypto.randomUUID(),
            adminId,
            userAgent,
            clientIp,
            JSON.stringify({
              deletedParticipants,
              deletedProofs,
              note: 'Nettoyage post-atelier : billetterie réinitialisée pour la prochaine session'
            })
          ]
        );
        await client.query('RELEASE SAVEPOINT wipe_audit');
      } catch (auditErr) {
        await client.query('ROLLBACK TO SAVEPOINT wipe_audit').catch(() => {});
        console.warn('[WIPE AUDIT FALLBACK] RESET_WORKSHOP_DATA refusé par la base, repli sur ADMIN_LOGIN :', auditErr);
        await client.query(
          `INSERT INTO public.audit_logs (id, admin_id, action_type, timestamp, user_agent, ip_address, metadata)
           VALUES ($1, $2, 'ADMIN_LOGIN', now(), $3, $4, $5::jsonb)`,
          [
            crypto.randomUUID(),
            adminId,
            userAgent,
            clientIp,
            JSON.stringify({
              deletedParticipants,
              deletedProofs,
              fallbackFrom: 'RESET_WORKSHOP_DATA',
              note: 'Nettoyage post-atelier (journal en repli) : billetterie réinitialisée pour la prochaine session'
            })
          ]
        );
      }

      await client.query('COMMIT');
      console.log(`[WIPE] Post-atelier : ${deletedParticipants} inscription(s) et ${deletedProofs} preuve(s) supprimées par ${adminId}.`);
      return { deletedParticipants, deletedProofs };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // AMBASSADEURS PIGA STUDIO (affiliation, tracking, commissions 15%)
  // --------------------------------------------------------------------------
  private static readonly AMBASSADOR_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sans I/L/O/0/1

  private async generateUniqueAmbassadorCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
      let suffix = '';
      const bytes = crypto.randomBytes(4);
      for (let i = 0; i < 4; i++) {
        suffix += NeonStore.AMBASSADOR_ALPHABET[bytes[i] % NeonStore.AMBASSADOR_ALPHABET.length];
      }
      const code = `AMB-${suffix}`;
      const exists = await this.db.query('SELECT 1 FROM public.ambassadors WHERE upper(code) = $1 LIMIT 1', [code]);
      if (exists.rows.length === 0) return code;
    }
    throw new Error('AMBASSADOR_CODE_EXHAUSTED: Impossible de générer un code unique.');
  }

  /** Création par la Direction (console) ou le portail de recrutement */
  async createAmbassador(
    input: { fullName: string; email: string; phone: string; commissionRate?: number; termsAccepted?: boolean },
    createdBy: string,
    clientIp: string,
    userAgent: string,
    options: { skipRateLimit?: boolean } = {}
  ): Promise<{ ambassador: Ambassador; alreadyRegistered: boolean }> {
    // Condition d'acceptation OBLIGATOIRE : la commission n'est versée qu'après
    // confirmation du paiement Orange Money de l'affilié + délai de 48h.
    if (!input.termsAccepted) {
      throw new Error('TERMS_REQUIRED: Vous devez accepter les conditions de commission (versement après confirmation du paiement + délai de traitement de 48 heures).');
    }

    const phoneValidation = cleanAndValidateDRCPhone(input.phone);
    if (!phoneValidation.isValid) {
      throw new Error(`DRC_PHONE_INVALID: ${phoneValidation.errorMessage}`);
    }
    const email = String(input.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('EMAIL_INVALID: Adresse email invalide.');
    }
    const fullName = String(input.fullName || '').trim();
    if (fullName.length < 3) {
      throw new Error('NAME_INVALID: Nom complet requis (3 caractères minimum).');
    }
    const phoneIntl = phoneValidation.formattedInternational;

    // Anti-abus : max 5 créations par IP / 24h (recrutement public)
    if (!options.skipRateLimit) {
      const rate = await this.db.query(
        `SELECT count(*)::int AS n FROM public.ambassadors
         WHERE created_from_ip = $1 AND created_at > now() - interval '24 hours'`,
        [clientIp]
      );
      if (rate.rows[0].n >= 5) {
        throw new Error('AMBASSADOR_RATE_LIMITED: Trop de candidatures depuis cet appareil. Contactez la Direction.');
      }
    }

    // Idempotent : un numéro actif = un ambassadeur (renvoi du même code)
    const existing = await this.db.query(
      `SELECT * FROM public.ambassadors WHERE phone_international = $1 AND status = 'ACTIVE' LIMIT 1`,
      [phoneIntl]
    );
    if (existing.rows[0]) {
      return { ambassador: rowToAmbassador(existing.rows[0]), alreadyRegistered: true };
    }

    const rate = input.commissionRate && input.commissionRate > 0 && input.commissionRate <= 1
      ? input.commissionRate
      : 0.15;

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      // Un numéro ne correspond qu'à UN ambassadeur actif (index unique partiel)
      const clash = await client.query(
        `SELECT 1 FROM public.ambassadors WHERE phone_international = $1 AND status = 'ACTIVE' FOR UPDATE`,
        [phoneIntl]
      );
      if (clash.rows[0]) {
        await client.query('ROLLBACK');
        return { ambassador: rowToAmbassador(clash.rows[0]), alreadyRegistered: true };
      }

      const code = await this.generateUniqueAmbassadorCode();
      const inserted = await client.query(
        `INSERT INTO public.ambassadors (code, full_name, email, phone_international, commission_rate, commission_terms_accepted_at, created_from_ip, created_by)
         VALUES ($1, $2, $3, $4, $5, now(), $6, $7) RETURNING *`,
        [code, fullName, email, phoneIntl, rate, clientIp, createdBy]
      );
      const ambassador = rowToAmbassador(inserted.rows[0]);

      await client.query(
        `INSERT INTO public.audit_logs (id, admin_id, action_type, timestamp, user_agent, ip_address, metadata)
         VALUES ($1, $2, 'AMBASSADOR_CREATE', now(), $3, $4, $5::jsonb)`,
        [
          crypto.randomUUID(), createdBy, userAgent, clientIp,
          JSON.stringify({ code: ambassador.code, fullName: ambassador.fullName, commissionRate: ambassador.commissionRate })
        ]
      );

      await client.query('COMMIT');
      return { ambassador, alreadyRegistered: false };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async getAmbassadorByCode(code: string): Promise<Ambassador | undefined> {
    const result = await this.db.query('SELECT * FROM public.ambassadors WHERE upper(code) = $1 LIMIT 1', [code.trim().toUpperCase()]);
    return result.rows[0] ? rowToAmbassador(result.rows[0]) : undefined;
  }

  /** Ping de clic dédupliqué : 1 clic par ambassadeur + jour + IP */
  async recordAmbassadorClick(code: string, ipHash: string, userAgent: string): Promise<boolean> {
    const ambassador = await this.getAmbassadorByCode(code);
    if (!ambassador || ambassador.status !== 'ACTIVE') return false;
    const inserted = await this.db.query(
      `INSERT INTO public.ambassador_clicks (ambassador_id, ip_hash, user_agent)
       VALUES ($1, $2, $3)
       ON CONFLICT (ambassador_id, click_day, ip_hash) DO NOTHING`,
      [ambassador.id, ipHash, userAgent.slice(0, 250)]
    );
    return (inserted.rowCount ?? 0) > 0;
  }

  /** Statistiques agrégées partagées portail public / console Direction.
   *  Règle de rémunération : la commission n'est PAYABLE qu'après
   *  confirmation du paiement Orange Money + 48h de traitement. */
  private static readonly AMBASSADOR_STATS_SQL = `
    (SELECT count(*)::int FROM public.ambassador_clicks c WHERE c.ambassador_id = a.id) AS clicks,
    count(p.id) FILTER (WHERE p.status = 'CONFIRMED')::int AS validated_sales,
    count(p.id) FILTER (WHERE p.status = 'PENDING')::int AS pending_sales,
    COALESCE(sum(p.commission_usd) FILTER (WHERE p.status = 'CONFIRMED'), 0)::float AS earned_usd,
    COALESCE(sum(p.commission_usd) FILTER (WHERE p.status = 'PENDING'), 0)::float AS pending_usd,
    COALESCE(sum(p.commission_usd) FILTER (WHERE p.status = 'CONFIRMED' AND p.commission_status = 'PAID'), 0)::float AS paid_usd,
    COALESCE(sum(p.commission_usd) FILTER (WHERE p.status = 'CONFIRMED' AND p.commission_status = 'EARNED' AND p.confirmed_at <= now() - interval '48 hours'), 0)::float AS to_pay_usd,
    COALESCE(sum(p.commission_usd) FILTER (WHERE p.status = 'CONFIRMED' AND p.commission_status = 'EARNED' AND p.confirmed_at > now() - interval '48 hours'), 0)::float AS in_hold_usd`;

  private statsRowToSummary(row: AnyRow, ambassador: Ambassador): AmbassadorSummary {
    const clicks = Number(row.clicks ?? 0);
    const validatedSales = Number(row.validated_sales ?? 0);
    return {
      ...ambassador,
      clicks,
      validatedSales,
      pendingSales: Number(row.pending_sales ?? 0),
      earnedUsd: Number(row.earned_usd ?? 0),
      pendingUsd: Number(row.pending_usd ?? 0),
      inHoldUsd: Number(row.in_hold_usd ?? 0),
      paidUsd: Number(row.paid_usd ?? 0),
      toPayUsd: Number(row.to_pay_usd ?? 0),
      conversionRate: clicks > 0 ? Math.round((validatedSales / clicks) * 1000) / 10 : 0
    };
  }

  /** Vue du portail ambassadeur via lien magique (stats + formation active) */
  async getAmbassadorPortalView(code: string): Promise<AmbassadorPortalView | undefined> {
    const ambassador = await this.getAmbassadorByCode(code);
    if (!ambassador) return undefined;

    const statsResult = await this.db.query(
      `SELECT a.id, a.code, a.status, a.commission_rate, ${NeonStore.AMBASSADOR_STATS_SQL}
       FROM public.ambassadors a
       LEFT JOIN public.participants p ON p.ambassador_id = a.id
       WHERE a.id = $1
       GROUP BY a.id, a.code, a.status, a.commission_rate`,
      [ambassador.id]
    );
    const row = statsResult.rows[0] as AnyRow | undefined;
    if (!row) return undefined;

    const cfg = await this.getProgramConfig();
    return {
      ambassador: {
        code: ambassador.code,
        fullName: ambassador.fullName,
        status: ambassador.status,
        commissionRate: Number(row.commission_rate ?? ambassador.commissionRate),
        commissionPerSaleUsd: Math.round(Number(row.commission_rate ?? ambassador.commissionRate) * cfg.ticketPriceUsd * 100) / 100
      },
      stats: {
        clicks: Number(row.clicks ?? 0),
        validatedSales: Number(row.validated_sales ?? 0),
        pendingSales: Number(row.pending_sales ?? 0),
        earnedUsd: Number(row.earned_usd ?? 0),
        pendingUsd: Number(row.pending_usd ?? 0),
        inHoldUsd: Number(row.in_hold_usd ?? 0)
      },
      paidUsd: Number(row.paid_usd ?? 0),
      toPayUsd: Number(row.to_pay_usd ?? 0),
      formation: {
        title: cfg.title,
        dateDisplay: cfg.dateDisplay,
        ticketPriceUsd: cfg.ticketPriceUsd,
        totalCapacity: cfg.totalCapacity,
        heroImageUrl: cfg.heroImageUrl
      }
    };
  }

  /** Classement complet pour la console Direction (top ambassadeur) */
  async listAmbassadorsWithStats(): Promise<AmbassadorSummary[]> {
    const result = await this.db.query(
      `SELECT a.*, ${NeonStore.AMBASSADOR_STATS_SQL}
       FROM public.ambassadors a
       LEFT JOIN public.participants p ON p.ambassador_id = a.id
       GROUP BY a.id
       ORDER BY earned_usd DESC, created_at ASC`
    );
    return result.rows.map((row: AnyRow) => this.statsRowToSummary(row, rowToAmbassador(row)));
  }

  /** Détail des ventes rattachées à un ambassadeur (traçabilité, zéro litige) */
  async listAmbassadorSales(ambassadorId: string): Promise<AmbassadorSalesEntry[]> {
    const result = await this.db.query(
      `SELECT id, full_name, ticket_code, status, price_usd, commission_usd, commission_status, commission_paid_at, created_at
       FROM public.participants
       WHERE ambassador_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [ambassadorId]
    );
    return result.rows.map((row: AnyRow) => ({
      participantId: String(row.id),
      fullName: String(row.full_name),
      ticketCode: (row.ticket_code as string | null) ?? undefined,
      status: String(row.status) as AmbassadorSalesEntry['status'],
      priceUsd: Number(row.price_usd),
      commissionUsd: Number(row.commission_usd ?? 0),
      commissionStatus: (row.commission_status as CommissionStatus) ?? undefined,
      commissionPaidAt: isoOrNull(row.commission_paid_at),
      createdAt: isoOrNull(row.created_at) ?? ''
    }));
  }

  /** Paie des commissions gagnées HORS délai de traitement (48h après le
   *  paiement confirmé de l'affilié). Les commissions encore en délai de
   *  traitement ne sont jamais versées, même si la Direction appuie « Payé ». */
  async markAmbassadorCommissionsPaid(ambassadorId: string, adminId: string, clientIp: string, userAgent: string): Promise<{ marked: number; totalUsd: number; skippedInHold: number }> {
    // Commissions mûres : EARNED + confirmées depuis >= 48h
    const updated = await this.db.query(
      `UPDATE public.participants
       SET commission_status = 'PAID', commission_paid_at = now()
       WHERE ambassador_id = $1 AND commission_status = 'EARNED'
         AND confirmed_at IS NOT NULL
         AND confirmed_at <= now() - interval '48 hours'
       RETURNING commission_usd`,
      [ambassadorId]
    );
    const marked = updated.rows.length;
    const totalUsd = updated.rows.reduce((s: number, r: AnyRow) => s + Number(r.commission_usd ?? 0), 0);

    // Commissions volontairement laissées en délai de traitement
    const holdResult = await this.db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.participants
       WHERE ambassador_id = $1 AND commission_status = 'EARNED'
         AND confirmed_at IS NOT NULL
         AND confirmed_at > now() - interval '48 hours'`,
      [ambassadorId]
    );
    const skippedInHold = holdResult.rows[0]?.n ?? 0;

    const ambassador = await this.db.query('SELECT code, full_name FROM public.ambassadors WHERE id = $1', [ambassadorId]);
    await this.addAuditLog({
      id: crypto.randomUUID(),
      adminId,
      actionType: 'AMBASSADOR_PAYOUT',
      timestamp: new Date().toISOString(),
      userAgent,
      ipAddress: clientIp,
      details: {
        ambassadorCode: ambassador.rows[0]?.code ?? ambassadorId,
        ambassadorName: ambassador.rows[0]?.full_name ?? '',
        markedCommissions: marked,
        totalUsd: Math.round(totalUsd * 100) / 100,
        skippedInHold,
        note: 'Commissions Orange Money versées et marquées payées (hors délai de traitement 48h)'
      }
    });
    return { marked, totalUsd: Math.round(totalUsd * 100) / 100, skippedInHold };
  }

  /** Suspension / réactivation d'un ambassadeur (les liens actifs tombent) */
  async setAmbassadorStatus(ambassadorId: string, status: AmbassadorStatus, adminId: string, clientIp: string, userAgent: string): Promise<Ambassador | undefined> {
    const updated = await this.db.query(
      `UPDATE public.ambassadors SET status = $2 WHERE id = $1 RETURNING *`,
      [ambassadorId, status]
    );
    if (!updated.rows[0]) return undefined;
    const ambassador = rowToAmbassador(updated.rows[0]);

    await this.addAuditLog({
      id: crypto.randomUUID(),
      adminId,
      actionType: 'AMBASSADOR_SUSPEND',
      timestamp: new Date().toISOString(),
      userAgent,
      ipAddress: clientIp,
      details: { code: ambassador.code, fullName: ambassador.fullName, newStatus: status }
    });
    return ambassador;
  }

  // --------------------------------------------------------------------------
  // NOTIFICATIONS PUSH SERVEUR (W3C Web Push / VAPID)
  // --------------------------------------------------------------------------
  /** Enregistre (ou met à jour) un abonnement push navigateur */
  async savePushSubscription(input: {
    audience: 'ADMIN' | 'AMBASSADOR';
    ambassadorId?: string | null;
    adminId?: string | null;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO public.push_subscriptions (audience, ambassador_id, admin_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (endpoint) DO UPDATE SET
         audience = $1, ambassador_id = $2, admin_id = $3,
         p256dh = $5, auth = $6, user_agent = $7`,
      [
        input.audience,
        input.ambassadorId ?? null,
        input.adminId ?? null,
        input.endpoint,
        input.p256dh,
        input.auth,
        (input.userAgent || '').slice(0, 250)
      ]
    );
  }

  /** Supprime un abonnement (désinscription navigateur ou terminal mort) */
  async deletePushSubscription(endpoint: string): Promise<void> {
    await this.db.query('DELETE FROM public.push_subscriptions WHERE endpoint = $1', [endpoint]);
  }

  /** Récupère les abonnements cibles : Direction ou un ambassadeur précis */
  async getPushSubscriptions(audience: 'ADMIN' | 'AMBASSADOR', ambassadorId?: string): Promise<Array<{ endpoint: string; p256dh: string; auth: string }>> {
    const result = ambassadorId
      ? await this.db.query(
          `SELECT endpoint, p256dh, auth FROM public.push_subscriptions WHERE audience = 'AMBASSADOR' AND ambassador_id = $1`,
          [ambassadorId]
        )
      : await this.db.query(
          `SELECT endpoint, p256dh, auth FROM public.push_subscriptions WHERE audience = $1`,
          [audience]
        );
    return result.rows.map((r: AnyRow) => ({
      endpoint: String(r.endpoint),
      p256dh: String(r.p256dh),
      auth: String(r.auth)
    }));
  }
}
