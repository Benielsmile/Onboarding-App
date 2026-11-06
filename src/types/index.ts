/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Arsenal Agentique - Type Definitions
 * Strict TypeSafe integration across all frontend and backend communication layers.
 */

export type ParticipantStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'REVOKED';

export type MobileMoneyProvider = 'ORANGE_MONEY';

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
  revokedAt?: string;
  revocationReason?: string;
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

export type ProgramModuleIcon = 'Network' | 'ShieldAlert' | 'Server' | 'QrCode' | 'Cpu' | 'Brain' | 'Workflow' | 'Code' | 'Terminal' | 'Database';

export interface ProgramModule {
  id: string;
  index: string; // e.g. "01", "02"
  title: string;
  highlight: string;
  description: string;
  iconName?: ProgramModuleIcon;
}

export interface ProgramConfig {
  id: string;
  title: string;
  tagline: string;
  kicker: string;
  dateDisplay: string;
  timeDisplay: string;
  locationDisplay: string;
  description: string;
  ticketPriceUsd: number;
  totalCapacity: number;
  status: 'OPEN' | 'COMING_SOON' | 'SOLD_OUT';
  orangeMoneyNumber: string;
  orangeMoneyHolder: string;
  directionEmail: string;
  directionPhone: string;
  heroImageUrl: string;
  auditoriumImageUrl: string;
  modules: ProgramModule[];
  ndaTitle: string;
  ndaClauses: string[];
  updatedAt: string;
  updatedBy?: string;
}

export interface AuditLogEntry {
  id: string;
  adminId: string;
  actionType: 'CONFIRM_PAYMENT' | 'REJECT_PAYMENT' | 'REVOKE_RESERVATION' | 'DOWNLOAD_TICKET' | 'VIEW_PROOF' | 'RESEND_WHATSAPP' | 'ADMIN_LOGIN' | 'UPDATE_PROGRAM_CONFIG';
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
