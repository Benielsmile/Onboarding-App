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
  ProgramConfig,
  FormationRegistryState,
  AdminStats
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
   * Secrets vault for the admin bearer session (issued by /api/admin/auth).
   * Every /api/admin request beneath the Zero-Trust gateway MUST carry it.
   */
  adminToken: null as string | null,

  _adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const initHeaders = (init.headers || {}) as Record<string, string>;
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...initHeaders };
    if (this.adminToken) {
      headers['Authorization'] = `Bearer ${this.adminToken}`;
    }
    return fetch(path, { ...init, headers });
  },

  /**
   * Authenticates the PIGA STUDIO Direction (owner-only email + password)
   * and vaults the bearer session
   */
  async adminLogin(email: string, password: string): Promise<{ success: boolean; token?: string; message?: string }> {
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.success && data.token) {
      this.adminToken = data.token;
    }
    return data;
  },

  /**
   * Admin sales analytics scoped to the launched formation
   */
  async getAdminStats(): Promise<AdminStats | null> {
    try {
      const res = await this._adminFetch('/api/admin/stats');
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },
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
   * Fetches all registered participants (Admin only)
   */
  async getParticipants(): Promise<Participant[]> {
    const res = await this._adminFetch('/api/admin/participants');
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
    const res = await this._adminFetch('/api/admin/confirm-payment', {
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
    const res = await this._adminFetch('/api/admin/reject-payment', {
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
    const res = await this._adminFetch('/api/admin/revoke-reservation', {
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
    const res = await this._adminFetch('/api/admin/audit-logs');
    if (!res.ok) return [];
    return await res.json();
  },

  /**
   * Records an admin action in the immutable audit log
   */
  async logAdminAction(actionType: AuditLogEntry['actionType'], participantId?: string, details?: Record<string, unknown>): Promise<void> {
    await this._adminFetch('/api/admin/log-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionType, participantId, details })
    }).catch(() => {});
  },

  /**
   * Post-workshop cleanup: permanently removes every participant registration
   * and Orange Money proof, restoring a clean billing console for the next
   * session. The immutable audit log is preserved (it documents the wipe).
   */
  async resetWorkshopData(adminId = 'ADM-2026-CHIEF'): Promise<{ success: boolean; deletedParticipants: number; deletedProofs: number }> {
    const res = await this._adminFetch('/api/admin/reset-workshop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Échec du nettoyage de la console.');
    }
    return data;
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
    const res = await this._adminFetch('/api/admin/program-config', {
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
    const res = await this._adminFetch('/api/admin/program-preset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId, adminId })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Échec du chargement du modèle de formation.');
    }
    return data;
  },

  /**
   * Lists every saved formation in the durable registry + the active one
   */
  async listFormations(): Promise<FormationRegistryState> {
    try {
      const res = await this._adminFetch('/api/admin/formations');
      if (!res.ok) throw new Error('Erreur de chargement du registre');
      return await res.json();
    } catch {
      return { activeId: DEFAULT_PROGRAM_CONFIG.id, formations: [] };
    }
  },

  /**
   * Launches a brand-new blank formation and activates it immediately
   */
  async createFormation(name: string, adminId = 'ADM-2026-CHIEF'): Promise<{ success: boolean; config: ProgramConfig }> {
    const res = await this._adminFetch('/api/admin/formations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, adminId })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Échec de création de la nouvelle formation.');
    }
    return data;
  },

  /**
   * Duplicates the active formation into the registry (not activated)
   */
  async duplicateFormation(name: string, adminId = 'ADM-2026-CHIEF'): Promise<{ success: boolean; config: ProgramConfig }> {
    const res = await this._adminFetch('/api/admin/formations/duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, adminId })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Échec de la duplication.');
    }
    return data;
  },

  /**
   * Activates a saved formation: it becomes the live landing page
   */
  async activateFormation(id: string, adminId = 'ADM-2026-CHIEF'): Promise<{ success: boolean; config: ProgramConfig }> {
    const res = await fetch(`/api/admin/formations/${encodeURIComponent(id)}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Échec de l\'activation.');
    }
    return data;
  },

  /**
   * Deletes a non-active saved formation
   */
  async deleteFormation(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/admin/formations/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Échec de la suppression.');
    }
    return data;
  },

  /**
   * Uploads a landing page image and returns its public URL
   */
  async uploadImage(file: File): Promise<{ success: boolean; url: string }> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Échec de lecture du fichier.'));
      reader.readAsDataURL(file);
    });

    const res = await this._adminFetch('/api/admin/upload-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl, fileName: file.name })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Échec de l\'enregistrement de l\'image.');
    }
    return data;
  }
};
