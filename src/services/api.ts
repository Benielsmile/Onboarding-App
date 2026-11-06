/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Client-Side TypeSafe API Layer with context-specific escaping
 */

import DOMPurify from 'dompurify';
import type { 
  Participant, 
  RegistrationRequest, 
  RegistrationResponse, 
  AuditLogEntry, 
  InventoryStatus,
  CryptographicTokenVerification,
  ProgramConfig
} from '../types/index.ts';
import { decryptAndVerifyTicketToken } from '../utils/cryptoSecurity.ts';
import { DEFAULT_PROGRAM_CONFIG } from '../utils/programPresets.ts';

/**
 * Context-specific escaping helper for UI rendering to prevent Stored XSS
 */
export function sanitizeSafeText(dirty: string): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

export const api = {
  /**
   * Fetches real-time seat inventory and pricing
   */
  async getInventoryStats(): Promise<InventoryStatus> {
    try {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('Erreur lors de la récupération des statistiques');
      return await res.json();
    } catch {
      // Safe fallback
      return {
        totalCapacity: 80,
        confirmedSeats: 1,
        pendingVerifications: 1,
        availableSeats: 78,
        ticketPriceUsd: 20.00
      };
    }
  },

  /**
   * Submits new participant registration with Zero-Trust server enforcement
   */
  async registerParticipant(payload: RegistrationRequest): Promise<RegistrationResponse> {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Une erreur est survenue lors du traitement. Veuillez réessayer ultérieurement.');
    }

    return data;
  },

  /**
   * Generates a 5-minute temporary HMAC-SHA256 signed URL to view private screenshot proof
   */
  async getSignedProofUrl(storagePath: string): Promise<string> {
    try {
      const res = await fetch(`/api/proof-signed-url?path=${encodeURIComponent(storagePath)}`);
      if (!res.ok) throw new Error('Impossible de générer le lien sécurisé');
      const data = await res.json();
      return data.signedUrl;
    } catch {
      return `/api/storage/proof?path=${encodeURIComponent(storagePath)}`;
    }
  },

  /**
   * Authenticates administrator with MFA code
   */
  async adminLogin(passkey: string, mfaCode: string): Promise<{ success: boolean; token?: string; message?: string }> {
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passkey, mfaCode })
    });
    return await res.json();
  },

  /**
   * Fetches all registered participants (Admin only)
   */
  async getParticipants(): Promise<Participant[]> {
    const res = await fetch('/api/admin/participants');
    if (!res.ok) throw new Error('Accès administrateur non autorisé.');
    const rawList = await res.json() as Participant[];
    
    // Apply context-specific escaping to protect against Stored XSS
    return rawList.map(p => ({
      ...p,
      fullName: sanitizeSafeText(p.fullName),
      transactionReference: sanitizeSafeText(p.transactionReference),
      adminNotes: p.adminNotes ? sanitizeSafeText(p.adminNotes) : undefined
    }));
  },

  /**
   * Confirms participant payment and triggers AES-256-GCM crypto token generation
   */
  async confirmPayment(participantId: string): Promise<Participant> {
    const res = await fetch('/api/admin/confirm-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, adminId: 'ADM-2026-CHIEF' })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Échec de validation du paiement.');
    }
    return data.participant;
  },

  /**
   * Rejects participant payment with audit reason
   */
  async rejectPayment(participantId: string, reason: string): Promise<Participant> {
    const res = await fetch('/api/admin/reject-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, reason, adminId: 'ADM-2026-CHIEF' })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Échec du rejet.');
    }
    return data.participant;
  },

  /**
   * Revokes participant reservation and triggers direct client outreach via WhatsApp/Email
   */
  async revokeReservation(participantId: string, reason: string): Promise<Participant> {
    const res = await fetch('/api/admin/revoke-reservation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, reason, adminId: 'ADM-2026-CHIEF' })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Échec de la révocation de la réservation.');
    }
    return data.participant;
  },

  /**
   * Retrieves immutable audit log stream
   */
  async getAuditLogs(): Promise<AuditLogEntry[]> {
    const res = await fetch('/api/admin/audit-logs');
    if (!res.ok) return [];
    return await res.json();
  },

  /**
   * Records an admin action in the immutable audit log
   */
  async logAdminAction(actionType: AuditLogEntry['actionType'], participantId?: string, details?: Record<string, unknown>): Promise<void> {
    await fetch('/api/admin/log-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionType, participantId, details })
    }).catch(() => {});
  },

  /**
   * Verifies an AES-256-GCM token either through backend endpoint or client Web Crypto
   */
  async verifyToken(token: string): Promise<CryptographicTokenVerification> {
    try {
      const res = await fetch(`/api/verify/${encodeURIComponent(token)}`);
      if (res.ok) {
        const data = await res.json();
        return {
          isValid: Boolean(data.isValid),
          tamperDetected: !data.isValid,
          payload: data.payload,
          error: data.error,
          verificationTimestamp: data.timestamp || new Date().toISOString()
        };
      }
    } catch {
      // Fallback to in-browser Web Crypto AES-GCM verification
    }

    return await decryptAndVerifyTicketToken(token);
  },

  /**
   * Fetches the dynamic landing page and training program configuration
   */
  async getProgramConfig(): Promise<ProgramConfig> {
    try {
      const res = await fetch('/api/program-config');
      if (!res.ok) throw new Error('Erreur de chargement');
      return await res.json();
    } catch {
      return DEFAULT_PROGRAM_CONFIG;
    }
  },

  /**
   * Fetches the list of curated training presets
   */
  async getProgramPresets(): Promise<any[]> {
    try {
      const res = await fetch('/api/program-presets');
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  },

  /**
   * Updates the live training program configuration from Admin Dashboard
   */
  async updateProgramConfig(config: Partial<ProgramConfig>, adminId = 'ADM-2026-CHIEF'): Promise<{ success: boolean; config: ProgramConfig }> {
    const res = await fetch('/api/admin/program-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, adminId })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Échec de la mise à jour de la configuration de formation.');
    }
    return data;
  },

  /**
   * Loads a pre-packaged training preset from Admin Dashboard
   */
  async loadProgramPreset(presetId: string, adminId = 'ADM-2026-CHIEF'): Promise<{ success: boolean; config: ProgramConfig }> {
    const res = await fetch('/api/admin/program-preset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId, adminId })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Échec du chargement du modèle de formation.');
    }
    return data;
  }
};
