/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Cryptographic Security Engine for Arsenal Agentique
 * - AES-256-GCM Token Encryption & Decryption with Authentication Tag (tamper-proof)
 * - HMAC-SHA256 Signed URLs for private screenshot storage (5-minute expiration)
 * - Zero-Trust Sensitive Data Masking (PII Protection at Rest)
 */

import type { TicketPayload, CryptographicTokenVerification } from '../types/index.ts';

// Master Secret Key (in production, loaded from strictly guarded KMS / Server Secrets)
const DEFAULT_SECRET_PASSPHRASE = 'ARSENAL_AGENTIQUE_2026_MASTER_SECRET_KEY_GCM_SECURE_AUTH';

/**
 * Derives a consistent 32-byte (256-bit) cryptographic key using Web Crypto or Node crypto
 */
async function getCryptoKey(passphrase = DEFAULT_SECRET_PASSPHRASE): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('ARSENAL_SALT_2026'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Converts ArrayBuffer to Hex String
 */
function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Converts Hex String to Uint8Array
 */
function hexToUint8Array(hex: string): Uint8Array {
  const match = hex.match(/.{1,2}/g);
  if (!match) return new Uint8Array(0);
  return new Uint8Array(match.map(byte => parseInt(byte, 16)));
}

/**
 * Encrypts a minimal JSON ticket payload using AES-256-GCM
 * Payload: { t: ticketCode, n: nomParticipant, d: "2026-11-13", s: "CONFIRMED" }
 * Result format: `${iv_hex}.${ciphertext_hex}.${tag_hex}`
 */
export async function encryptTicketPayload(payload: TicketPayload): Promise<string> {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV recommended for GCM
  const encodedPayload = new TextEncoder().encode(JSON.stringify(payload));

  // In Web Crypto AES-GCM, the 16-byte auth tag is appended to the ciphertext automatically
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128 // 128-bit authentication tag
    },
    key,
    encodedPayload
  );

  const encryptedArray = new Uint8Array(encryptedBuffer);
  // Split ciphertext and 16-byte tag
  const tagLengthBytes = 16;
  const ciphertextBytes = encryptedArray.slice(0, encryptedArray.length - tagLengthBytes);
  const tagBytes = encryptedArray.slice(encryptedArray.length - tagLengthBytes);

  const ivHex = bufferToHex(iv);
  const cipherHex = bufferToHex(ciphertextBytes);
  const tagHex = bufferToHex(tagBytes);

  return `${ivHex}.${cipherHex}.${tagHex}`;
}

/**
 * Decrypts and cryptographically verifies an AES-256-GCM ticket token
 * Zero-Trust: If any byte of the ciphertext or tag was altered, GCM verification fails.
 */
export async function decryptAndVerifyTicketToken(token: string): Promise<CryptographicTokenVerification> {
  const timestamp = new Date().toISOString();

  if (!token || typeof token !== 'string') {
    return {
      isValid: false,
      tamperDetected: false,
      error: 'Token manquant ou format invalide.',
      verificationTimestamp: timestamp
    };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return {
      isValid: false,
      tamperDetected: true,
      error: 'Structure de token cryptographique invalide (3 segments requis: IV.Ciphertext.Tag).',
      verificationTimestamp: timestamp
    };
  }

  const [ivHex, cipherHex, tagHex] = parts;

  try {
    const key = await getCryptoKey();
    const iv = hexToUint8Array(ivHex);
    const ciphertext = hexToUint8Array(cipherHex);
    const tag = hexToUint8Array(tagHex);

    // Reconstruct combined array [ciphertext + tag] for Web Crypto AES-GCM deciphering
    const combined = new Uint8Array(ciphertext.length + tag.length);
    combined.set(ciphertext, 0);
    combined.set(tag, ciphertext.length);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource,
        tagLength: 128
      },
      key,
      combined as unknown as BufferSource
    );

    const jsonText = new TextDecoder().decode(decryptedBuffer);
    const payload = JSON.parse(jsonText) as TicketPayload;

    // Strict validation of payload schema
    if (!payload.t || !payload.n || payload.d !== '2026-11-13' || payload.s !== 'CONFIRMED') {
      return {
        isValid: false,
        tamperDetected: true,
        error: 'Charge utile du billet corrompue ou attributs statut/date incohérents.',
        verificationTimestamp: timestamp
      };
    }

    return {
      isValid: true,
      tamperDetected: false,
      payload,
      verificationTimestamp: timestamp
    };
  } catch (err: unknown) {
    console.error('[SECURITY AUDIT] Cryptographic verification failed (possible tamper attempt):', err);
    return {
      isValid: false,
      tamperDetected: true,
      error: 'Échec de vérification cryptographique : signature AES-256-GCM altérée ou fausse clé.',
      verificationTimestamp: timestamp
    };
  }
}

/**
 * Creates a cryptographically signed URL valid for exactly 5 minutes (300 seconds)
 */
export async function createSignedStorageUrl(storagePath: string, expiresInSeconds = 300): Promise<{ signedUrl: string; expiresAt: number }> {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  const dataToSign = `${storagePath}:${expiresAt}`;
  
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(DEFAULT_SECRET_PASSPHRASE),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(dataToSign));
  const sigHex = bufferToHex(signature);

  const signedUrl = `/api/storage/proof?path=${encodeURIComponent(storagePath)}&expires=${expiresAt}&sig=${sigHex}`;
  return { signedUrl, expiresAt };
}

/**
 * Verifies a 5-minute signed storage URL
 */
export async function verifySignedStorageUrl(storagePath: string, expires: number, sigHex: string): Promise<boolean> {
  if (Date.now() > expires) {
    return false; // Expired
  }

  const dataToSign = `${storagePath}:${expires}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(DEFAULT_SECRET_PASSPHRASE),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const sigBytes = hexToUint8Array(sigHex);
  return crypto.subtle.verify('HMAC', key, sigBytes as unknown as BufferSource, enc.encode(dataToSign));
}

/**
 * Masking utilities to safeguard PII at rest / during client rendering
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***';
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user[0]}***@${domain}`;
  return `${user.slice(0, 2)}***${user.slice(-1)}@${domain}`;
}

export function maskPhone(international: string): string {
  if (!international || international.length < 12) return '+243 *** ***';
  // format: 243 81X XXX X78
  return `+${international.slice(0, 3)} ${international.slice(3, 5)}* *** *${international.slice(-2)}`;
}
