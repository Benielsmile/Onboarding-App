/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Arsenal Agentique - Type Definitions
 * Strict TypeSafe integration across all frontend and backend communication layers.
 */

export type ParticipantStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'REVOKED';

export type PaymentProvider = 'ORANGE_MONEY';

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
  priceUsd: number; // Enforced server-side from the active formation config
  programId?: string; // Formation this registration belongs to
  paymentProvider: PaymentProvider;
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
  paymentProvider: PaymentProvider;
  transactionReference: string;
  proofBase64?: string;
  proofFileName?: string;
  ndaAccepted: boolean;
  // Client cannot dictate price nor provider (Orange Money only, strictly verified server-side)
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
  // --- Landing page extensibility (all optional for backward compatibility) ---
  curriculumTitle?: string;       // Section "Programme" main heading
  curriculumIntro?: string;       // Section "Programme" introductory paragraph
  footerAbout?: string;           // Footer brand/formation description
  vipWhatsAppUrl?: string;        // VIP WhatsApp community link
  updatedAt: string;
  updatedBy?: string;
}

export interface AuditLogEntry {
  id: string;
  adminId: string;
  actionType: 'CONFIRM_PAYMENT' | 'REJECT_PAYMENT' | 'REVOKE_RESERVATION' | 'DOWNLOAD_TICKET' | 'VIEW_PROOF' | 'RESEND_WHATSAPP' | 'ADMIN_LOGIN' | 'UPDATE_PROGRAM_CONFIG' | 'EXPORT_DASHBOARD_PDF' | 'RESET_WORKSHOP_DATA';
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

/** Lightweight descriptor for the Formation registry (admin library) */
export interface FormationSummary {
  id: string;
  title: string;
  status: ProgramConfig['status'];
  dateDisplay: string;
  updatedAt: string;
}

export interface FormationRegistryState {
  activeId: string;
  formations: FormationSummary[];
}

/** Sales analytics for one formation (dashboard "Historique des ventes") */
export interface FormationSalesSummary {
  id: string;
  title: string;
  dateDisplay: string;
  ticketPriceUsd: number;
  isActive: boolean;
  total: number;
  confirmed: number;
  pending: number;
  rejected: number;
  revoked: number;
  revenueConfirmedUsd: number;
  revenuePipelineUsd: number;
  lastRegistrationAt: string | null;
}

export interface AdminStats {
  activeId: string;
  activeFormation: {
    id: string;
    title: string;
    dateDisplay: string;
    ticketPriceUsd: number;
    totalCapacity: number;
    status: ProgramConfig['status'];
  };
  active: {
    total: number;
    confirmed: number;
    pending: number;
    rejected: number;
    revoked: number;
    revenueConfirmedUsd: number;
    revenuePipelineUsd: number;
    lastRegistrationAt: string | null;
    carriers: Record<string, number>;
    daily: { date: string; count: number }[];
  };
  byFormation: FormationSalesSummary[];
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
