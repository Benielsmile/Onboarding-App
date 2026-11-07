/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PIGA STUDIO — Dedicated High-Availability Admin Portal
 * Independent admin file communicating seamlessly with shared infrastructure.
 * Features:
 * 1. PIGA STUDIO Official Branding & Dual Dark/Light Mode
 * 2. Real-Time Orange Money Supervision & Participant Management
 * 3. "Révoquer la réservation" with Direct Client WhatsApp/Email Outreach
 * 4. Embedded Camera QR Code Scanner & AES-256-GCM Decryption Engine
 * 5. Immutable Audit Logs (IBM Secure-by-Design & OWASP LLM Top 10)
 * 6. PWA Standalone Mode & Native Web Push Notification System
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Check, 
  X, 
  FileDown, 
  MessageSquare, 
  Eye, 
  Clock, 
  Activity, 
  Search, 
  Users, 
  DollarSign, 
  Key, 
  RefreshCw,
  QrCode, 
  Bell, 
  AlertOctagon, 
  LogOut, 
  Smartphone, 
  AlertTriangle,
  Camera,
  Mail,
  SlidersHorizontal,
  TrendingUp,
  Printer,
  Trash2
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { PigaLogo } from '../components/PigaLogo.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';
import { FormationEditor } from './FormationEditor.tsx';
import type { Participant, AuditLogEntry, InventoryStatus, CryptographicTokenVerification, ProgramConfig, AdminStats } from '../types/index.ts';
import { api, sanitizeSafeText } from '../services/api.ts';
import { downloadTicketPDF } from '../utils/pdfGenerator.ts';
import { downloadDashboardReportPDF } from '../utils/dashboardPdfGenerator.ts';
import { DEFAULT_PROGRAM_CONFIG } from '../utils/programPresets.ts';
import { 
  generateWhatsAppConfirmationUrl, 
  generateWhatsAppRevocationUrl,
  resolveMessageInfo,
  PIGA_DIRECTION_EMAIL,
  PIGA_DIRECTION_PHONE_LOCAL,
  PIGA_ORANGE_MONEY_DISPLAY,
  WHATSAPP_TEMPLATE_VERSION,
  type FormationMessageInfo
} from '../utils/whatsappHelper.ts';
import { 
  usePWAInstall, 
  requestNotificationPermission, 
  triggerNativePushNotification 
} from '../utils/pwaNotifications.ts';

interface AdminPortalProps {
  onBackToClient: () => void;
  currentConfig?: ProgramConfig;
  onConfigUpdated?: (config: ProgramConfig) => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ onBackToClient, currentConfig, onConfigUpdated }) => {
  // Authentication & Session — Owner-only identity (PIGA STUDIO Direction)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Active Tab: 'dashboard' | 'participants' | 'scanner' | 'audit'
  const [currentTab, setCurrentTab] = useState<'formation' | 'dashboard' | 'participants' | 'scanner' | 'audit'>('formation');

  // Core Data
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [inventory, setInventory] = useState<InventoryStatus | null>(null);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'REVOKED' | 'REJECTED'>('ALL');

  // Modals & Proof Inspection
  const [viewingProof, setViewingProof] = useState<{ path: string; name: string; signedUrl?: string; expiresAt?: number } | null>(null);
  const [revokingParticipant, setRevokingParticipant] = useState<Participant | null>(null);
  const [revocationReason, setRevocationReason] = useState('Preuve Orange Money non identifiable ou transfert non reçu.');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  // Proof viewer rendering error (blank box guard)
  const [proofImgError, setProofImgError] = useState(false);

  // WhatsApp outgoing message preview (large-print self-check modal)
  const [whatsappPreview, setWhatsappPreview] = useState<{ url: string; rawMessage: string } | null>(null);

  // Post-Workshop: PDF Report Export & Console Wipe (next session preparation)
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState('');
  const [isWiping, setIsWiping] = useState(false);

  // Scanner & GCM Verification State
  const [scannerTokenInput, setScannerTokenInput] = useState('');
  const [verificationResult, setVerificationResult] = useState<CryptographicTokenVerification | null>(null);
  const [isVerifyingToken, setIsVerifyingToken] = useState(false);
  const [isCameraScannerActive, setIsCameraScannerActive] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // PWA & Notification Status
  const { isInstallable, install } = usePWAInstall();
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotificationPermission(perm);
    if (perm === 'granted') {
      triggerNativePushNotification(
        'PIGA STUDIO · Notifications PWA Activées',
        'Vous recevrez désormais les alertes de nouveaux paiements Orange Money directement dans votre barre de notification.'
      );
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [parts, logs, inv] = await Promise.all([
        api.getParticipants(),
        api.getAuditLogs(),
        api.getInventoryStats()
      ]);
      setParticipants(parts);
      setAuditLogs(logs);
      setInventory(inv);
      api.getAdminStats().then(stats => setAdminStats(stats)).catch(() => {});
    } catch (err) {
      console.error('[ADMIN LOAD ERROR]:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  // Formation-scoped info injected into WhatsApp messages & PDF tickets
  const formationInfo: FormationMessageInfo | undefined = currentConfig ? {
    title: currentConfig.title,
    tagline: currentConfig.tagline,
    dateDisplay: currentConfig.dateDisplay,
    timeDisplay: currentConfig.timeDisplay,
    locationDisplay: currentConfig.locationDisplay,
    orangeMoneyNumber: currentConfig.orangeMoneyNumber,
    orangeMoneyHolder: currentConfig.orangeMoneyHolder,
    directionEmail: currentConfig.directionEmail,
    directionPhone: currentConfig.directionPhone,
    vipWhatsAppUrl: currentConfig.vipWhatsAppUrl,
    moduleSummaries: currentConfig.modules.slice(0, 4).map(m => `• ${m.title}${m.highlight ? ` — ${m.highlight}` : ''}`)
  } : undefined;
  const resolvedInfo = resolveMessageInfo(formationInfo);
  const resolvedFormationPrice = currentConfig?.ticketPriceUsd ?? 20;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const res = await api.adminLogin(adminEmail.trim(), adminPassword);
      if (res.success) {
        setIsAuthenticated(true);
        setAdminPassword('');
      } else {
        setAuthError(res.message || 'Adresse e-mail ou mot de passe incorrect.');
      }
    } catch {
      setAuthError('Erreur de communication avec le serveur d\'authentification.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // 1. Confirm Payment & Generate AES-256-GCM Cryptographic Token
  const handleConfirm = async (p: Participant) => {
    setProcessingId(p.id);
    setActionSuccessMessage(null);
    try {
      const updated = await api.confirmPayment(p.id);
      setParticipants(prev => prev.map(item => item.id === updated.id ? updated : item));
      await loadData();
      setActionSuccessMessage(`Paiement de ${sanitizeSafeText(p.fullName)} confirmé. Billet cryptographique (AES-256-GCM) émis. Cliquez ensuite sur « WhatsApp » pour lui envoyer la confirmation officielle — facture PDF + lien VIP inclus dans le message.`);
      setTimeout(() => setActionSuccessMessage(null), 5000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur de confirmation');
    } finally {
      setProcessingId(null);
    }
  };

  // 2. Open Revocation Modal
  const openRevokeModal = (p: Participant) => {
    setRevokingParticipant(p);
    setRevocationReason(`Transfert Orange Money non retrouvé sur le relevé du ${resolvedInfo.orangeMoneyNumber}.`);
  };

  // 3. Confirm Revocation & Generate WhatsApp / Email Outreach
  const handleExecuteRevocation = async () => {
    if (!revokingParticipant) return;
    setProcessingId(revokingParticipant.id);

    try {
      const updated = await api.revokeReservation(revokingParticipant.id, revocationReason);
      setParticipants(prev => prev.map(item => item.id === updated.id ? updated : item));
      await loadData();

      // Generate pre-filled WhatsApp revocation message to reach client immediately
      const { url } = generateWhatsAppRevocationUrl(revokingParticipant, revocationReason, formationInfo);
      
      setActionSuccessMessage(`Réservation révoquée. Vous pouvez maintenant contacter le client par WhatsApp ou Email.`);
      setTimeout(() => setActionSuccessMessage(null), 6000);

      // Offer opening WhatsApp immediately
      if (confirm('Réservation révoquée. Souhaitez-vous ouvrir WhatsApp avec le message explicatif pré-rempli pour contacter le client ?')) {
        window.open(url, '_blank');
      }

      setRevokingParticipant(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la révocation');
    } finally {
      setProcessingId(null);
    }
  };

  // 4. Open 5-minute Signed Proof URL
  const handleInspectProof = async (p: Participant) => {
    try {
      setProofImgError(false);
      const signedUrl = await api.getSignedProofUrl(p.proofStoragePath);
      setViewingProof({
        path: p.proofStoragePath,
        name: p.fullName,
        signedUrl,
        expiresAt: Date.now() + 5 * 60 * 1000
      });
      api.logAdminAction('VIEW_PROOF', p.id, {
        path: p.proofStoragePath,
        note: 'Superviseur PIGA a inspecté la preuve Orange Money'
      });
    } catch {
      alert('Impossible d\'accéder à la preuve privée.');
    }
  };

  // 5. Verify Cryptographic Token (AES-256-GCM)
  const verifyTokenString = async (token: string) => {
    if (!token.trim()) return;
    setIsVerifyingToken(true);
    try {
      const result = await api.verifyToken(token.trim());
      setVerificationResult(result);
    } catch {
      setVerificationResult({
        isValid: false,
        tamperDetected: true,
        error: 'Échec de vérification cryptographique. Jeton invalide ou corrompu.',
        verificationTimestamp: new Date().toISOString()
      });
    } finally {
      setIsVerifyingToken(false);
    }
  };

  // 7. Print Full Dashboard Report (post-workshop PDF archive of every module)
  const handlePrintDashboardPdf = () => {
    try {
      downloadDashboardReportPDF({
        stats: adminStats,
        participants,
        info: formationInfo,
        inventory
      });
      void api.logAdminAction('EXPORT_DASHBOARD_PDF', undefined, {
        note: 'Rapport général PDF édité depuis le dashboard',
        participantCount: participants.length
      });
    } catch (err: unknown) {
      console.error('[DASHBOARD PDF ERROR]:', err);
      alert(err instanceof Error ? err.message : 'Erreur lors de la génération du rapport PDF.');
    }
  };

  // 8. Post-Workshop Console Wipe — reset the billing for the next session
  const openWipeModal = () => {
    setWipeConfirmText('');
    setIsWipeModalOpen(true);
  };

  const handleExecuteWipe = async () => {
    if (wipeConfirmText.trim().toUpperCase() !== 'NETTOYER') return;
    setIsWiping(true);
    try {
      const result = await api.resetWorkshopData();
      setIsWipeModalOpen(false);
      setWipeConfirmText('');
      await loadData();
      setActionSuccessMessage(
        `Console nettoyée : ${result.deletedParticipants} inscription(s) et ${result.deletedProofs} preuve(s) Orange Money supprimée(s). La billetterie est prête pour la prochaine session.`
      );
      setTimeout(() => setActionSuccessMessage(null), 8000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur lors du nettoyage de la console.');
    } finally {
      setIsWiping(false);
    }
  };

  // 6. Camera QR Scanner Setup
  useEffect(() => {
    if (currentTab === 'scanner' && isCameraScannerActive) {
      const timer = setTimeout(() => {
        try {
          const scanner = new Html5QrcodeScanner(
            'qr-reader-container',
            { 
              fps: 10, 
              qrbox: { width: 250, height: 250 },
              rememberLastUsedCamera: true
            },
            /* verbose= */ false
          );

          scanner.render(
            (decodedText) => {
              // Successfully decoded QR code from camera
              setScannerTokenInput(decodedText);
              verifyTokenString(decodedText);
              // Stop camera once detected
              setIsCameraScannerActive(false);
              scanner.clear();
            },
            (error) => {
              // Scan error - standard scanning loop, safe to ignore
            }
          );

          scannerRef.current = scanner;
        } catch (e) {
          console.error('[QR SCANNER INIT ERROR]:', e);
        }
      }, 300);

      return () => {
        clearTimeout(timer);
        if (scannerRef.current) {
          try {
            scannerRef.current.clear();
          } catch (e) {
            // Safe cleanup
          }
        }
      };
    } else {
      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch (e) {
          // Safe cleanup
        }
      }
    }
  }, [currentTab, isCameraScannerActive]);

  // Filtered Participants
  const filteredParticipants = participants.filter(p => {
    const matchesSearch = 
      p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phoneInternational.includes(searchQuery) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.ticketCode && p.ticketCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
      p.transactionReference.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const confirmedCount = participants.filter(p => p.status === 'CONFIRMED').length;
  const pendingCount = participants.filter(p => p.status === 'PENDING').length;
  const revokedCount = participants.filter(p => p.status === 'REVOKED').length;
  const totalRevenue = participants.reduce((sum, p) => p.status === 'CONFIRMED' ? sum + (p.priceUsd ?? 20) : sum, 0);

  // --------------------------------------------------------------------------
  // LOGIN SCREEN
  // --------------------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#000000] flex items-center justify-center p-6 transition-colors duration-200">
        <div className="w-full max-w-md bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#222222] rounded-xl p-8 shadow-2xl space-y-6">
          <div className="flex justify-end">
            <ThemeToggle showLogoToggle={true} size="sm" />
          </div>

          <div className="text-center space-y-3">
            <PigaLogo variant="compact" size="md" className="justify-center" />
            <h1 className="text-xl font-bold font-montserrat text-slate-900 dark:text-white tracking-wide">
              Console de Supervision
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-inter">
              Plateforme d'administration sécurisée PIGA STUDIO · {resolvedInfo.decorativeName} {new Date().getFullYear()}.
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-800/60 text-xs text-red-800 dark:text-red-300 flex items-center gap-2 font-inter">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 font-inter">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 font-montserrat">
                Adresse E-mail Direction
              </label>
              <div className="relative">
                <input
                  type="email"
                  autoComplete="username"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="direction@piga.cd"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#262626] focus:border-[#E50914] rounded-md text-sm text-slate-900 dark:text-white outline-none"
                />
                <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 font-montserrat">
                Mot de Passe Sécurisé
              </label>
              <div className="relative">
                <input
                  type="password"
                  autoComplete="current-password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#262626] focus:border-[#E50914] rounded-md text-sm text-slate-900 dark:text-white font-mono outline-none"
                />
                <Key className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3 top-3" />
              </div>
            </div>

            <div className="p-3 rounded bg-[#E50914]/5 border border-[#E50914]/25 text-[11px] text-slate-600 dark:text-slate-400">
              <span className="text-[#E50914] font-bold">Accès restreint :</span> la console n'accepte que l'identité de la Direction PIGA STUDIO. Toute tentative est journalisée dans l'audit immuable.
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full py-2.5 text-xs font-bold font-montserrat text-white bg-[#E50914] hover:bg-[#C80711] rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#E50914]/20"
            >
              {isAuthenticating ? (
                <span>Vérification cryptographique...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Accéder à la Console PIGA</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onBackToClient}
              className="w-full py-2 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
            >
              Retour au site public
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // AUTHENTICATED ADMIN PORTAL
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-white dark:bg-[#000000] text-slate-900 dark:text-slate-100 flex flex-col font-inter transition-colors duration-200">
      {/* Top Bar */}
      <header className="border-b border-slate-200 dark:border-[#1E1E1E] bg-slate-50 dark:bg-[#0A0A0A] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-30 transition-colors">
        <div className="flex items-center gap-4">
          <PigaLogo variant="compact" size="sm" />
          <div className="border-l border-slate-200 dark:border-[#222222] pl-4">
            <h1 className="text-sm font-bold font-montserrat text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
              <span>{resolvedInfo.decorativeName} · Supervision PIGA</span>
              <span className="text-[10px] font-mono text-[#E50914] bg-[#E50914]/10 dark:bg-[#E50914]/15 px-2 py-0.5 rounded font-bold border border-[#E50914]/30">
                ORANGE MONEY ({resolvedInfo.orangeMoneyNumber})
              </span>
              <span className="text-xs font-mono text-[#10B981] bg-[#10B981]/10 px-2.5 py-1 rounded font-bold border-2 border-[#10B981]/40">
                WhatsApp {WHATSAPP_TEMPLATE_VERSION} — PDF+QR ✅
              </span>
            </h1>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
              <span>Auditeur Chef : ADM-2026-CHIEF</span>
              <span>·</span>
              <span className="text-[#10B981] font-medium">Sécurité Zéro-Trust Active</span>
            </div>
          </div>
        </div>

        {/* Top Bar Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Dual Theme Switcher */}
          <ThemeToggle showLogoToggle={true} size="sm" />

          {/* Web Push Notification Status Button */}
          <button
            onClick={handleEnableNotifications}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border flex items-center gap-1.5 transition-colors cursor-pointer ${
              notificationPermission === 'granted'
                ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#141414] text-slate-700 dark:text-slate-300 dark:hover:text-white border-slate-300 dark:border-[#2A2A2A]'
            }`}
            title="Activer les notifications push système pour les nouvelles inscriptions"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>{notificationPermission === 'granted' ? 'Push Actif' : 'Activer Notifications'}</span>
          </button>

          {/* PWA Install Button */}
          {isInstallable && (
            <button
              onClick={install}
              className="px-3 py-1.5 text-xs font-bold font-montserrat text-white bg-[#E50914] hover:bg-[#C80711] rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Installer la console PIGA STUDIO comme application autonome"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Installer PWA</span>
            </button>
          )}

          <button
            onClick={loadData}
            className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded bg-slate-100 hover:bg-slate-200 dark:bg-[#141414] border border-slate-300 dark:border-[#262626] transition-colors cursor-pointer"
            title="Actualiser les données"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsAuthenticated(false)}
            className="p-2 text-slate-600 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 rounded bg-slate-100 hover:bg-slate-200 dark:bg-[#141414] border border-slate-300 dark:border-[#262626] transition-colors cursor-pointer"
            title="Verrouiller la session"
          >
            <LogOut className="w-4 h-4" />
          </button>

          <button
            onClick={onBackToClient}
            className="px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white bg-slate-200 hover:bg-slate-300 dark:bg-[#1E1E1E] dark:hover:bg-[#282828] border border-slate-300 dark:border-[#333333] rounded-md transition-colors cursor-pointer"
          >
            Page Publique
          </button>
        </div>
      </header>

      {/* Main Layout Grid */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Success Banner */}
        {actionSuccessMessage && (
          <div className="p-3.5 rounded-md bg-[#10B981]/15 border border-[#10B981]/40 text-xs text-[#10B981] flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{actionSuccessMessage}</span>
            </div>
            <button onClick={() => setActionSuccessMessage(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] shadow-xs transition-colors">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between mb-1 font-montserrat">
              <span>Places Confirmées</span>
              <Users className="w-4 h-4 text-[#10B981]" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
              {confirmedCount} <span className="text-xs text-slate-400 font-normal">/ {inventory?.totalCapacity || 80}</span>
            </div>
            <div className="text-[11px] text-[#10B981] mt-1 font-medium">
              Pass cryptographiques actifs
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] shadow-xs transition-colors">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between mb-1 font-montserrat">
              <span>En Attente Orange Money</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 tabular-nums">
              {pendingCount}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Captures à auditer
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] shadow-xs transition-colors">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between mb-1 font-montserrat">
              <span>Réservations Révoquées</span>
              <AlertTriangle className="w-4 h-4 text-[#E50914]" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#E50914] tabular-nums">
              {revokedCount}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Clients à contacter
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] shadow-xs transition-colors">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between mb-1 font-montserrat">
              <span>Recettes Orange Money</span>
              <DollarSign className="w-4 h-4 text-[#10B981]" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
              ${totalRevenue.toFixed(2)} <span className="text-xs text-slate-400 font-normal">USD</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              ${resolvedFormationPrice.toFixed(2)} par participant
            </div>
          </div>
        </div>

        {/* Admin Navigation Bar / Sidebar Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E1E1E] pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCurrentTab('formation')}
              className={`px-4 py-2 text-xs font-bold font-montserrat rounded-md transition-colors cursor-pointer flex items-center gap-2 ${
                currentTab === 'formation'
                  ? 'bg-[#E50914] text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-[#0E0E0E]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Formation &amp; Landing Page</span>
            </button>

            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`px-4 py-2 text-xs font-bold font-montserrat rounded-md transition-colors cursor-pointer flex items-center gap-2 ${
                currentTab === 'dashboard'
                  ? 'bg-[#E50914] text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-[#0E0E0E]'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Historique des Ventes</span>
            </button>

            <button
              onClick={() => setCurrentTab('participants')}
              className={`px-4 py-2 text-xs font-bold font-montserrat rounded-md transition-colors cursor-pointer flex items-center gap-2 ${
                currentTab === 'participants'
                  ? 'bg-[#E50914] text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-[#0E0E0E]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Participants Orange Money ({participants.length})</span>
            </button>

            <button
              onClick={() => setCurrentTab('scanner')}
              className={`px-4 py-2 text-xs font-bold font-montserrat rounded-md transition-colors cursor-pointer flex items-center gap-2 ${
                currentTab === 'scanner'
                  ? 'bg-[#E50914] text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-[#0E0E0E]'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Scanner &amp; Vérificateur GCM</span>
            </button>

            <button
              onClick={() => setCurrentTab('audit')}
              className={`px-4 py-2 text-xs font-bold font-montserrat rounded-md transition-colors cursor-pointer flex items-center gap-2 ${
                currentTab === 'audit'
                  ? 'bg-[#E50914] text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-[#0E0E0E]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Journal d'Audit Immuable ({auditLogs.length})</span>
            </button>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* TAB 0: FORMATION & LANDING PAGE CMS EDITOR */}
        {/* ==================================================================== */}
        {currentTab === 'formation' && (
          <FormationEditor
            config={currentConfig || DEFAULT_PROGRAM_CONFIG}
            onSaved={(cfg) => onConfigUpdated?.(cfg)}
          />
        )}

        {/* ==================================================================== */}
        {/* TAB 2: SALES HISTORY & PER-FORMATION ANALYTICS */}
        {/* ==================================================================== */}
        {currentTab === 'dashboard' && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#F8F9FA] dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] animate-fade-in">
            <div>
              <div className="text-xs font-bold font-montserrat text-slate-900 dark:text-white uppercase tracking-wider">
                Post-Atelier · Export &amp; Nettoyage
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Imprimez l'archive PDF complète de la console, puis réinitialisez la billetterie pour la prochaine formation.
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handlePrintDashboardPdf}
                className="px-4 py-2.5 text-xs font-bold font-montserrat text-white bg-[#E50914] hover:bg-[#C80711] rounded-md transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
                title="Générer le rapport PDF complet : statistiques, historique des ventes et registre des participants"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimer le rapport PDF</span>
              </button>

              <button
                onClick={openWipeModal}
                className="px-4 py-2.5 text-xs font-bold font-montserrat text-red-600 dark:text-red-400 bg-white dark:bg-[#141414] hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-300 dark:border-red-900/60 rounded-md transition-colors flex items-center gap-2 cursor-pointer"
                title="Supprimer définitivement toutes les inscriptions et preuves Orange Money pour préparer la prochaine session"
              >
                <Trash2 className="w-4 h-4" />
                <span>Nettoyer la console</span>
              </button>
            </div>
          </div>
        )}

        {currentTab === 'dashboard' && adminStats && (
          <div className="space-y-5">
            {/* Revenue snapshot */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-5 rounded-xl bg-[#F8F9FA] dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] shadow-xs">
                <div className="text-[10px] font-bold font-montserrat uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">Recettes confirmées</div>
                <div className="text-3xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
                  ${adminStats.active.revenueConfirmedUsd.toFixed(2)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">{adminStats.active.confirmed} billet(s) confirmé(s)</div>
              </div>
              <div className="p-5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 shadow-xs">
                <div className="text-[10px] font-bold font-montserrat uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">Chiffre en instance</div>
                <div className="text-3xl font-black font-mono tabular-nums text-amber-600 dark:text-amber-400">
                  ${adminStats.active.revenuePipelineUsd.toFixed(2)}
                </div>
                <div className="text-[11px] text-amber-700/70 dark:text-amber-500/70 mt-1">{adminStats.active.pending} paiement(s) à vérifier</div>
              </div>
              <div className="p-5 rounded-xl bg-[#F8F9FA] dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] shadow-xs">
                <div className="text-[10px] font-bold font-montserrat uppercase tracking-wider text-slate-500 mb-1">Taux de conversion</div>
                <div className="text-3xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
                  {adminStats.active.total > 0 ? Math.round((adminStats.active.confirmed / adminStats.active.total) * 100) : 0}%
                </div>
                <div className="text-[11px] text-slate-500 mt-1">{adminStats.active.total} inscription(s) au total</div>
              </div>
              <div className="p-5 rounded-xl bg-[#E50914]/5 border border-[#E50914]/30 shadow-xs">
                <div className="text-[10px] font-bold font-montserrat uppercase tracking-wider text-[#E50914] mb-1">Formation active</div>
                <div className="text-sm font-bold font-montserrat text-slate-900 dark:text-white truncate">{adminStats.activeFormation.title}</div>
                <div className="text-[11px] text-slate-500 mt-1">{adminStats.activeFormation.dateDisplay} · ${adminStats.activeFormation.ticketPriceUsd.toFixed(2)}/billet</div>
              </div>
            </div>

            {/* 14-day registrations chart */}
            <div className="p-5 rounded-xl bg-[#F8F9FA] dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-bold font-montserrat text-slate-900 dark:text-white uppercase tracking-wider">Inscriptions · 14 derniers jours</div>
                <div className="text-[11px] text-slate-500 font-inter">Somme : {adminStats.active.daily.reduce((s, d) => s + d.count, 0)}</div>
              </div>
              <div className="flex items-end gap-1.5 h-28">
                {adminStats.active.daily.map(d => {
                  const maxCount = Math.max(...adminStats.active.daily.map(x => x.count), 1);
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={`w-full rounded-t-md transition-all ${d.count > 0 ? 'bg-[#E50914]/80' : 'bg-slate-200 dark:bg-[#1A1A1A]'}`}
                        style={{ height: `${Math.max(d.count > 0 ? (d.count / maxCount) * 100 : 4, 4) * 0.9}%` }}
                        title={`${d.date} : ${d.count}`}
                      />
                      <span className="text-[8px] text-slate-400 font-mono">{d.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Operators breakdown */}
            <div className="p-5 rounded-xl bg-[#F8F9FA] dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] shadow-xs">
              <div className="text-xs font-bold font-montserrat text-slate-900 dark:text-white uppercase tracking-wider mb-4">Répartition Opérateurs Télécoms</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(adminStats.active.carriers).length === 0 && (
                  <span className="text-xs text-slate-400 font-inter">Aucune donnée pour cette formation.</span>
                )}
                {Object.entries(adminStats.active.carriers).map(([carrier, count]) => (
                  <div key={carrier} className="px-3.5 py-2 rounded-lg bg-white dark:bg-[#0E0E0E] border border-slate-200 dark:border-[#1E1E1E] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#E50914]" />
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-inter">{carrier}</span>
                    <span className="font-mono text-xs font-bold text-[#E50914]">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-formation sales history */}
            <div className="rounded-xl bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] overflow-hidden shadow-xs">
              <div className="px-5 py-4 bg-slate-50 dark:bg-[#050505] border-b border-slate-200 dark:border-[#1E1E1E]">
                <div className="text-xs font-bold font-montserrat text-slate-900 dark:text-white uppercase tracking-wider">Historique des Ventes · Toutes Formations</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-[#1E1E1E] text-slate-500 dark:text-slate-400 uppercase font-montserrat text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Formation</th>
                      <th className="px-4 py-3">Tarif</th>
                      <th className="px-4 py-3">Confirmés</th>
                      <th className="px-4 py-3">En attente</th>
                      <th className="px-4 py-3">Rejetés/Révoqués</th>
                      <th className="px-4 py-3">Recettes</th>
                      <th className="px-4 py-3">Dernière inscription</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1A1A1A]">
                    {adminStats.byFormation.map(f => (
                      <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-[#0E0E0E] transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            {f.isActive && <span className="px-1.5 py-0.5 rounded bg-[#E50914] text-white text-[9px] font-bold uppercase">Active</span>}
                            <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[220px]">{f.title}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{f.dateDisplay}</div>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-slate-700 dark:text-slate-300">${f.ticketPriceUsd.toFixed(2)}</td>
                        <td className="px-4 py-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">{f.confirmed}</td>
                        <td className="px-4 py-3.5 font-mono text-amber-600 dark:text-amber-400">{f.pending}</td>
                        <td className="px-4 py-3.5 font-mono text-slate-500">{f.rejected} / {f.revoked}</td>
                        <td className="px-4 py-3.5 font-mono font-bold text-[#E50914]">
                          ${f.revenueConfirmedUsd.toFixed(2)}
                          {f.revenuePipelineUsd > 0 && <span className="text-[10px] text-amber-500 font-normal block">+${f.revenuePipelineUsd.toFixed(2)} en instance</span>}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 font-inter">
                          {f.lastRegistrationAt ? new Date(f.lastRegistrationAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {currentTab === 'dashboard' && !adminStats && (
          <div className="text-xs text-slate-400 py-10 text-center font-inter">
            Analyse commerciale indisponible — reconnectez-vous à la console.
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 3: PARTICIPANTS REGISTER & ORANGE MONEY MANAGEMENT */}
        {/* ==================================================================== */}
        {currentTab === 'participants' && (
          <div className="space-y-4">
            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Recherche par nom, WhatsApp RDC, e-mail, réf Orange Money..."
                  className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-[#0A0A0A] border border-slate-300 dark:border-[#222222] focus:border-[#E50914] rounded-md text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none"
                />
              </div>

              {/* Status Segmented Controls */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0A0A0A] p-1 rounded-md border border-slate-200 dark:border-[#222222] text-xs font-montserrat">
                {(['ALL', 'PENDING', 'CONFIRMED', 'REVOKED', 'REJECTED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1 font-semibold rounded transition-colors cursor-pointer text-[11px] ${
                      statusFilter === st
                        ? 'bg-[#E50914] text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {st === 'ALL' ? 'Tous' : st === 'PENDING' ? 'En Attente' : st === 'CONFIRMED' ? 'Confirmés' : st === 'REVOKED' ? 'Révoqués' : 'Rejetés'}
                  </button>
                ))}
              </div>
            </div>

            {/* Participants Grid / Table */}
            <div className="rounded-xl bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#050505] border-b border-slate-200 dark:border-[#1E1E1E] text-slate-500 dark:text-slate-400 uppercase font-montserrat text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Participant</th>
                      <th className="px-4 py-3">WhatsApp RDC</th>
                      <th className="px-4 py-3">Paiement Orange Money</th>
                      <th className="px-4 py-3">Preuve Image</th>
                      <th className="px-4 py-3">Statut</th>
                      <th className="px-4 py-3 text-right">Actions de Supervision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1A1A1A]">
                    {filteredParticipants.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-slate-400 dark:text-slate-500 font-inter">
                          Aucun participant ne correspond aux filtres.
                        </td>
                      </tr>
                    ) : (
                      filteredParticipants.map((p) => {
                        const isProcessing = processingId === p.id;
                        return (
                          <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-[#0E0E0E] transition-colors">
                            {/* Full Name & Code */}
                            <td className="px-4 py-3.5">
                              <div className="font-bold text-slate-900 dark:text-white text-sm font-montserrat">
                                {sanitizeSafeText(p.fullName)}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-inter">
                                {p.emailMasked || p.email}
                              </div>
                              {p.ticketCode && (
                                <div className="font-mono text-[10px] text-[#E50914] mt-0.5 font-bold">
                                  {p.ticketCode}
                                </div>
                              )}
                            </td>

                            {/* WhatsApp RDC */}
                            <td className="px-4 py-3.5 font-inter">
                              <div className="font-mono text-slate-900 dark:text-white font-medium">
                                +{p.phoneInternational}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                {p.networkCarrier}
                              </div>
                            </td>

                            {/* Orange Money Details */}
                            <td className="px-4 py-3.5">
                              <div className="font-semibold text-slate-900 dark:text-white font-poppins flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-[#E50914]" />
                                <span>Orange Money · ${p.priceUsd.toFixed(2)}</span>
                              </div>
                              <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                Réf: {sanitizeSafeText(p.transactionReference)}
                              </div>
                            </td>

                            {/* Proof Inspection */}
                            <td className="px-4 py-3.5">
                              <button
                                onClick={() => handleInspectProof(p)}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-[#141414] dark:hover:bg-[#1E1E1E] text-slate-700 dark:text-slate-300 rounded flex items-center gap-1.5 border border-slate-300 dark:border-[#222222] transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#E50914]" />
                                <span>Inspecter (5 min)</span>
                              </button>
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3.5">
                              {p.status === 'CONFIRMED' && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                                  <Check className="w-3 h-3" />
                                  <span>CONFIRMÉ</span>
                                </span>
                              )}
                              {p.status === 'PENDING' && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                  <Clock className="w-3 h-3" />
                                  <span>EN ATTENTE</span>
                                </span>
                              )}
                              {p.status === 'REVOKED' && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#E50914]/15 text-[#E50914] border border-[#E50914]/30">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>RÉVOQUÉ</span>
                                </span>
                              )}
                              {p.status === 'REJECTED' && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
                                  <X className="w-3 h-3" />
                                  <span>REJETÉ</span>
                                </span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* If PENDING: Confirm or Revoke */}
                                {p.status === 'PENDING' && (
                                  <>
                                    <button
                                      disabled={isProcessing}
                                      onClick={() => handleConfirm(p)}
                                      className="px-3 py-1.5 text-xs font-bold text-white bg-[#10B981] hover:bg-[#059669] rounded transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                                      title="Confirmer le paiement et émettre le token cryptographique AES-256-GCM"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Confirmer</span>
                                    </button>

                                    <button
                                      disabled={isProcessing}
                                      onClick={() => openRevokeModal(p)}
                                      className="px-2.5 py-1.5 text-xs font-semibold text-[#E50914] hover:text-white hover:bg-[#E50914] border border-[#E50914]/40 rounded transition-colors cursor-pointer flex items-center gap-1"
                                      title="Révoquer la réservation pour contacter le client"
                                    >
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                      <span>Révoquer</span>
                                    </button>
                                  </>
                                )}

                                {/* If CONFIRMED: Download Pass or WhatsApp */}
                                {p.status === 'CONFIRMED' && (
                                  <>
                                    <button
                                      onClick={() => downloadTicketPDF(p, formationInfo)}
                                      className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-[#161616] dark:hover:bg-[#222222] border border-slate-300 dark:border-[#2E2E2E] rounded transition-colors flex items-center gap-1 cursor-pointer"
                                      title="Télécharger le pass officiel PDF PIGA STUDIO"
                                    >
                                      <FileDown className="w-3.5 h-3.5 text-[#E50914]" />
                                      <span>Pass PDF</span>
                                    </button>

                                    <button
                                      onClick={() => {
                                        const preview = generateWhatsAppConfirmationUrl(p, formationInfo);
                                        setWhatsappPreview(preview);
                                      }}
                                      className="px-2.5 py-1.5 text-xs font-semibold text-[#10B981] bg-[#10B981]/10 hover:bg-[#10B981]/20 border border-[#10B981]/30 rounded transition-colors flex items-center gap-1 cursor-pointer"
                                      title="Aperçu du message de confirmation (PDF + QR) puis envoi WhatsApp"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5" />
                                      <span>WhatsApp</span>
                                    </button>
                                  </>
                                )}

                                {/* If REVOKED: Contact Client Action */}
                                {p.status === 'REVOKED' && (
                                  <a
                                    href={generateWhatsAppRevocationUrl(p, p.revocationReason || 'Difficulté de confirmation Orange Money', formationInfo).url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2.5 py-1.5 text-xs font-bold text-white bg-[#E50914] hover:bg-[#C80711] rounded transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                                    title="Contacter le client sur WhatsApp pour régulariser le paiement Orange Money"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    <span>Contacter Client</span>
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 2: EMBEDDED CAMERA QR SCANNER & GCM VERIFIER */}
        {/* ==================================================================== */}
        {currentTab === 'scanner' && (
          <div className="space-y-6 animate-fade-in">
            <div className="p-6 rounded-xl bg-slate-50 dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold font-montserrat text-slate-900 dark:text-white flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-[#E50914]" />
                    <span>Contrôle d'Accès Cryptographique (AES-256-GCM)</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Scannez directement le QR Code du participant avec votre caméra ou saisissez son jeton chiffré.
                  </p>
                </div>

                <button
                  onClick={() => setIsCameraScannerActive(!isCameraScannerActive)}
                  className={`px-4 py-2 text-xs font-bold font-montserrat rounded-md transition-colors flex items-center gap-2 cursor-pointer ${
                    isCameraScannerActive
                      ? 'bg-red-800 text-white'
                      : 'bg-[#E50914] text-white hover:bg-[#C80711]'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span>{isCameraScannerActive ? 'Fermer Caméra' : 'Activer Caméra Scanner'}</span>
                </button>
              </div>

              {/* Camera Scanner Container */}
              {isCameraScannerActive && (
                <div className="p-4 rounded-lg bg-black border border-slate-300 dark:border-[#2A2A2A] max-w-md mx-auto text-center">
                  <div id="qr-reader-container" className="w-full overflow-hidden rounded" />
                  <div className="text-xs text-slate-300 mt-2">
                    Pointez l'objectif vers le QR Code officiel PIGA STUDIO
                  </div>
                </div>
              )}

              {/* Manual Token Verification Box */}
              <div className="pt-2 space-y-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 font-montserrat">
                  Ou collez le Jeton Cryptographique / URL du billet :
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={scannerTokenInput}
                    onChange={(e) => setScannerTokenInput(e.target.value)}
                    placeholder="Ex: 41539cb1bd80354253754d99.1d92bd038a... ou lien QR code"
                    className="flex-1 px-3.5 py-2.5 bg-white dark:bg-[#111111] border border-slate-300 dark:border-[#222222] focus:border-[#E50914] rounded-md text-xs text-slate-900 dark:text-white font-mono outline-none"
                  />
                  <button
                    onClick={() => verifyTokenString(scannerTokenInput)}
                    disabled={isVerifyingToken || !scannerTokenInput.trim()}
                    className="px-5 py-2.5 text-xs font-bold font-montserrat text-white bg-[#E50914] hover:bg-[#C80711] disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 rounded-md transition-colors cursor-pointer"
                  >
                    {isVerifyingToken ? 'Contrôle...' : 'Authentifier'}
                  </button>
                </div>
              </div>
            </div>

            {/* Verification Result Display */}
            {verificationResult && (
              <div className="animate-fade-in">
                {verificationResult.isValid && verificationResult.payload ? (
                  <div className="rounded-xl bg-white dark:bg-[#0A0A0A] border-2 border-[#10B981] p-6 sm:p-8 space-y-4 shadow-xl relative overflow-hidden">
                    <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-[#222222]">
                      <div className="w-12 h-12 rounded-lg bg-[#10B981]/20 border border-[#10B981] flex items-center justify-center">
                        <Check className="w-7 h-7 text-[#10B981]" />
                      </div>
                      <div>
                        <div className="text-xs font-mono text-[#10B981] font-bold uppercase tracking-wider">
                          PASSEPORT PIGA STUDIO VALIDÉ · SIGNATURE INTÈGRE
                        </div>
                        <h3 className="text-xl font-bold font-montserrat text-slate-900 dark:text-white mt-0.5">
                          Accréditation Confirmée &amp; Inviolable
                        </h3>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-inter py-2">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block mb-1">Titulaire :</span>
                        <span className="text-base font-bold font-montserrat text-slate-900 dark:text-white uppercase">
                          {verificationResult.payload.n}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block mb-1">Code Billet :</span>
                        <span className="font-mono text-base font-bold text-[#E50914]">
                          {verificationResult.payload.t}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block mb-1">Session :</span>
                        <span className="text-slate-900 dark:text-white font-medium">{resolvedInfo.dateDisplay}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block mb-1">Statut :</span>
                        <span className="text-[#10B981] font-bold">CONFIRMÉ (Paiement Orange Money vérifié)</span>
                      </div>
                    </div>

                    <div className="text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-200 dark:border-[#1A1A1A]">
                      Horodatage de validation : {new Date(verificationResult.verificationTimestamp).toLocaleString('fr-FR')} · Algorithme AES-256-GCM
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-red-50 dark:bg-[#120708] border-2 border-red-500 dark:border-red-800 p-6 sm:p-8 space-y-4 shadow-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-red-500/20 border border-red-500 flex items-center justify-center">
                        <AlertOctagon className="w-7 h-7 text-red-500" />
                      </div>
                      <div>
                        <div className="text-xs font-mono text-red-600 dark:text-red-400 font-bold uppercase tracking-wider">
                          ACCÈS REFUSÉ · SIGNATURE INVALIDE
                        </div>
                        <h3 className="text-xl font-bold font-montserrat text-slate-900 dark:text-white mt-0.5">
                          Jeton Altéré ou Billet Forgé
                        </h3>
                      </div>
                    </div>

                    <div className="p-3.5 rounded bg-white dark:bg-black/60 border border-red-200 dark:border-red-900/60 text-xs font-mono text-red-700 dark:text-red-300">
                      {verificationResult.error || 'La balise d\'authentification GCM ne correspond pas au contenu.'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 3: IMMUTABLE AUDIT LOGS */}
        {/* ==================================================================== */}
        {currentTab === 'audit' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-inter">
              <p>Traçabilité complète des opérations (Confirmations, Révocations, Téléchargements, Accès aux Preuves).</p>
              <span className="font-mono text-slate-500">Conformité IBM Secure-by-Design</span>
            </div>

            <div className="rounded-xl bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-50 dark:bg-[#050505] border-b border-slate-200 dark:border-[#1E1E1E] text-slate-500 dark:text-slate-400 uppercase text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Timestamp (UTC)</th>
                      <th className="px-4 py-3">Admin</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Participant</th>
                      <th className="px-4 py-3">IP</th>
                      <th className="px-4 py-3">Détails</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1A1A1A] text-[11px]">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-[#0E0E0E] transition-colors">
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {new Date(log.timestamp).toLocaleString('fr-FR', { timeZone: 'UTC' })}
                        </td>
                        <td className="px-4 py-3 text-[#E50914] font-bold">
                          {log.adminId}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            log.actionType === 'CONFIRM_PAYMENT'
                              ? 'bg-[#10B981]/20 text-[#10B981]'
                              : log.actionType === 'REVOKE_RESERVATION'
                              ? 'bg-[#E50914]/20 text-[#E50914]'
                              : 'bg-slate-100 dark:bg-[#181818] text-slate-700 dark:text-slate-300'
                          }`}>
                            {log.actionType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          {log.participantId ? log.participantId.slice(0, 12) + '...' : 'SYSTEM'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          {log.ipAddress}
                        </td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate text-[10px]" title={JSON.stringify(log.details)}>
                          {log.details ? JSON.stringify(log.details) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* MODAL 1: REVOKE RESERVATION & CONTACT CLIENT */}
      {/* ==================================================================== */}
      {revokingParticipant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-[#0A0A0A] border-2 border-[#E50914] rounded-xl overflow-hidden shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-[#222222] bg-red-50 dark:bg-[#100707] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#E50914]" />
                <h3 className="text-sm font-bold font-montserrat text-slate-900 dark:text-white">
                  Révoquer la Réservation · {revokingParticipant.fullName}
                </h3>
              </div>
              <button 
                onClick={() => setRevokingParticipant(null)}
                className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-inter text-slate-700 dark:text-slate-300">
              <p className="leading-relaxed">
                Vous vous apprêtez à révoquer cette réservation en cas d'impossibilité de confirmer le paiement Orange Money. 
                Le client sera immédiatement contacté pour régulariser son transfert vers le numéro officiel <strong>{resolvedInfo.orangeMoneyNumber}</strong>.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-300 mb-1 font-montserrat">
                  Motif de la révocation / Difficulté rencontrée :
                </label>
                <textarea
                  rows={3}
                  value={revocationReason}
                  onChange={(e) => setRevocationReason(e.target.value)}
                  placeholder="Ex: Capture illisible, ID de transaction non trouvé sur le relevé Orange Money..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#121212] border border-slate-300 dark:border-[#2A2A2A] focus:border-[#E50914] rounded-md text-xs text-slate-900 dark:text-white outline-none resize-none font-inter"
                />
              </div>

              <div className="p-3 rounded bg-slate-100 dark:bg-[#121212] border border-slate-200 dark:border-[#222222] text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                <div>Client : <strong>{revokingParticipant.fullName}</strong></div>
                <div>Numéro WhatsApp : <strong className="font-mono">+{revokingParticipant.phoneInternational}</strong></div>
                <div>Réf. saisie : <strong className="font-mono">{revokingParticipant.transactionReference}</strong></div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRevokingParticipant(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Annuler
                </button>

                <button
                  type="button"
                  onClick={handleExecuteRevocation}
                  className="px-5 py-2.5 text-xs font-bold font-montserrat text-white bg-[#E50914] hover:bg-[#C80711] rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-lg shadow-[#E50914]/20"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Confirmer la Révocation</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: POST-WORKSHOP CONSOLE WIPE CONFIRMATION */}
      {/* ==================================================================== */}
      {isWipeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#0A0A0A] border-2 border-red-500 dark:border-red-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-[#222222] bg-red-50 dark:bg-[#100707] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#E50914]" />
                <h3 className="text-sm font-bold font-montserrat text-slate-900 dark:text-white">
                  Nettoyer la console pour la prochaine session ?
                </h3>
              </div>
              <button
                onClick={() => setIsWipeModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-inter text-slate-700 dark:text-slate-300">
              <p className="leading-relaxed">
                Cette action est <strong className="text-[#E50914]">irréversible</strong>. Elle supprime définitivement
                toutes les données de billetterie pour préparer la prochaine formation :
              </p>

              <ul className="p-3 rounded bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-[11px] space-y-1.5">
                <li>· <strong>{participants.length}</strong> inscription(s) de participant(s)</li>
                <li>· Toutes les preuves de paiement Orange Money stockées</li>
                <li>· Codes de billets &amp; jetons cryptographiques émis</li>
              </ul>

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Le journal d'audit immuable est conservé (conformité traçabilité) et documentera ce nettoyage.
                Pensez à imprimer le rapport PDF <strong>avant</strong> de valider.
              </p>

              <div>
                <label className="block text-[11px] font-semibold text-slate-800 dark:text-slate-300 mb-1.5 font-montserrat">
                  Tapez «&nbsp;NETTOYER&nbsp;» pour confirmer :
                </label>
                <input
                  type="text"
                  value={wipeConfirmText}
                  onChange={(e) => setWipeConfirmText(e.target.value)}
                  placeholder="NETTOYER"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#121212] border border-slate-300 dark:border-[#2A2A2A] focus:border-[#E50914] rounded-md text-xs text-slate-900 dark:text-white font-mono outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsWipeModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Annuler
                </button>

                <button
                  type="button"
                  onClick={handleExecuteWipe}
                  disabled={isWiping || wipeConfirmText.trim().toUpperCase() !== 'NETTOYER'}
                  className="px-5 py-2.5 text-xs font-bold font-montserrat text-white bg-red-600 hover:bg-red-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-lg shadow-red-600/20 disabled:cursor-not-allowed"
                >
                  {isWiping ? (
                    <span>Nettoyage en cours...</span>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Confirmer le Nettoyage</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1b: WHATSAPP CONFIRMATION PREVIEW — GROS CARACTÈRES             */}
      {/* ==================================================================== */}
      {whatsappPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-2xl bg-white dark:bg-[#0A0A0A] border-2 border-[#10B981]/50 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-[#0F0F0F] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold font-montserrat text-slate-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[#10B981]" />
                  <span>Aperçu WhatsApp — Confirmation au client</span>
                </h3>
                <div className="text-sm text-[#10B981] font-bold font-mono mt-1">
                  Modèle {WHATSAPP_TEMPLATE_VERSION} ✅ — le lien PDF (QR Code inclus) est ci-dessous
                </div>
              </div>
              <button
                onClick={() => setWhatsappPreview(null)}
                className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* Le lien PDF affiché en très gros — vérification visuelle immédiate */}
              <div className="rounded-lg border-2 border-[#10B981]/40 bg-[#10B981]/5 px-4 py-4 space-y-2">
                <div className="text-[11px] font-bold font-montserrat uppercase tracking-wider text-[#10B981]">
                  🎫 Lien de la Facture PDF (contient le QR Code d'accès)
                </div>
                <div className="text-lg font-mono font-bold text-slate-900 dark:text-white break-all leading-snug">
                  {whatsappPreview.rawMessage.match(/https?:\/\/\S+api\/ticket\/\S+/i)?.[0] || '⚠️ Lien PDF ABSENT — modèle obsolète !'}
                </div>
              </div>

              {/* Message tel qu'il sera envoyé */}
              <div>
                <div className="text-[11px] font-bold font-montserrat uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Message complet (tel qu'écrit dans WhatsApp)
                </div>
                <pre className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200 font-inter bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-[#1E1E1E] rounded-lg p-4 leading-relaxed">
                  {whatsappPreview.rawMessage}
                </pre>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-[#0F0F0F] flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={() => setWhatsappPreview(null)}
                className="px-5 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
              >
                Retour
              </button>
              <button
                onClick={() => window.open(whatsappPreview.url, '_blank', 'noopener,noreferrer')}
                className="px-6 py-3 text-base font-bold font-montserrat text-white bg-[#10B981] hover:bg-[#059669] rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/25 w-full sm:w-auto justify-center"
              >
                <MessageSquare className="w-5 h-5" />
                <span>OUVRIR WHATSAPP &amp; ENVOYER AU CLIENT</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: 5-MINUTE SIGNED URL PROOF VIEWER */}
      {/* ==================================================================== */}
      {viewingProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-2xl bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#222222] rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-[#0F0F0F] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold font-montserrat text-slate-900 dark:text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#E50914]" />
                  <span>Justificatif Orange Money · {viewingProof.name}</span>
                </h3>
                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                  Lien cryptographiquement signé (HMAC-SHA256) · Auto-expiration : 5 minutes
                </div>
              </div>
              <button 
                onClick={() => setViewingProof(null)}
                className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex items-center justify-center bg-slate-100 dark:bg-[#000000] min-h-[320px]">
              {proofImgError ? (
                <div className="text-center space-y-3 p-6 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-900/60 max-w-md">
                  <AlertOctagon className="w-8 h-8 text-red-500 mx-auto" />
                  <div className="text-xs font-bold text-red-700 dark:text-red-300 font-montserrat uppercase tracking-wider">
                    Rendu de la preuve impossible
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-inter leading-relaxed">
                    Le fichier stocké n'est pas lisible comme image (dossier enregistré avant la correction du
                    pipeline de capture, ou capture jamais transmise). Demandez au client une capture lisible
                    via « Contacter Client » si le dossier est révocable.
                  </p>
                  <div className="text-[10px] font-mono text-slate-500 break-all">
                    {viewingProof.path}
                  </div>
                </div>
              ) : viewingProof.signedUrl ? (
                <img
                  src={viewingProof.signedUrl}
                  alt="Preuve Orange Money"
                  onError={() => setProofImgError(true)}
                  className="max-h-[60vh] max-w-full rounded border border-slate-300 dark:border-[#222222] object-contain shadow-md"
                />
              ) : (
                <div className="text-xs text-slate-400">Chargement de la capture...</div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-[#1E1E1E] bg-slate-50 dark:bg-[#0A0A0A] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono text-[10px]">
                Stockage Isolé : {viewingProof.path}
              </span>
              <button
                onClick={() => setViewingProof(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-200 hover:bg-slate-300 dark:bg-[#1A1A1A] dark:hover:bg-[#252525] text-slate-800 dark:text-white rounded transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
