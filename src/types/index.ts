/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Arsenal Agentique - Type Definitions
 * Strict TypeSafe integration across all frontend and backend communication layers.
 */

export type ParticipantStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

export type MobileMoneyProvider = 'M-PESA' | 'ORANGE_MONEY' | 'AIRTEL_MONEY';

export interface Participant {
  id: string;
  fullName: string;
  email: string;
  emailMasked: string;
  phoneRaw: string;
  phoneInternational: string; // 243XXXXXXXXX
  phoneMasked: string;
  networkCarrier: string;
  status: ParticipantStatus;
  priceUsd: number; // Strictly 20.00 USD
  paymentProvider: MobileMoneyProvider;
  transactionReference: string;
  proofFileName: string;
  proofStoragePath: string;
  ndaAccepted: boolean;
  ndaAcceptedAt: string;
  createdAt: string;
  ticketCode?: string;
  cryptoToken?: string;
  confirmedAt?: string;
  adminNotes?: string;
}

export interface RegistrationRequest {
  fullName: string;
  email: string;
  phone: string;
  paymentProvider: MobileMoneyProvider;
  transactionReference: string;
  proofBase64?: string;
  proofFileName?: string;
  ndaAccepted: boolean;
  // Client cannot dictate price; strictly verified server-side
}

export interface RegistrationResponse {
  success: boolean;
  participantId?: string;
  message: string;
  ticketCode?: string;
  status?: ParticipantStatus;
  phoneFormatted?: string;
}

export interface AuditLogEntry {
  id: string;
  adminId: string;
  actionType: 'CONFIRM_PAYMENT' | 'REJECT_PAYMENT' | 'DOWNLOAD_TICKET' | 'VIEW_PROOF' | 'RESEND_WHATSAPP' | 'ADMIN_LOGIN';
  participantId?: string;
  timestamp: string;
  userAgent: string;
  ipAddress: string;
  details?: Record<string, unknown>;
}

export interface TicketPayload {
  t: string; // ticketCode
  n: string; // nomParticipant
  d: string; // "2026-11-13"
  s: string; // "CONFIRMED"
  iat?: number;
}

export interface CryptographicTokenVerification {
  isValid: boolean;
  tamperDetected: boolean;
  payload?: TicketPayload;
  error?: string;
  verificationTimestamp: string;
}

export interface InventoryStatus {
  totalCapacity: number;
  confirmedSeats: number;
  pendingVerifications: number;
  availableSeats: number;
  ticketPriceUsd: number;
}

export interface SignedUrlResponse {
  signedUrl: string;
  expiresAt: number; // Unix timestamp ms
}
