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
import jsQR from 'jsqr';
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
  Trash2,
  Copy,
  ChevronDown,
  Menu,
  Megaphone,
  Wallet,
  Ban,
  RotateCcw
} from 'lucide-react';
// — Aucun import html5-qrcode : moteur natif BarcodeDetector + flux caméra pilotés ici —
import { PigaLogo } from '../components/PigaLogo.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';
import { FormationEditor } from './FormationEditor.tsx';
import type { Participant, AuditLogEntry, InventoryStatus, CryptographicTokenVerification, ProgramConfig, AdminStats, AmbassadorSummary, AmbassadorSalesEntry } from '../types/index.ts';
import { api, sanitizeSafeText } from '../services/api.ts';
import { downloadTicketPDF } from '../utils/pdfGenerator.ts';
import { downloadDashboardReportPDF } from '../utils/dashboardPdfGenerator.ts';
import { generateAmbassadorOnboardingMessage } from '../utils/ambassadorKit.ts';
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
  subscribeWebPush,
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
  const [currentTab, setCurrentTab] = useState<'formation' | 'dashboard' | 'participants' | 'ambassadeurs' | 'scanner' | 'audit'>('formation');
  // Mobile navbar: collapsible / expandable (dernière pièce UX mobile)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  // Mobile header: panneau déplié du hamburger (écrans très petits)
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);

  // Core Data
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [inventory, setInventory] = useState<InventoryStatus | null>(null);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Registre Ambassadeurs (affiliation 15%)
  const [ambassadors, setAmbassadors] = useState<AmbassadorSummary[]>([]);
  const [ambassadorSales, setAmbassadorSales] = useState<Record<string, AmbassadorSalesEntry[]>>({});
  const [ambassadorFormOpen, setAmbassadorFormOpen] = useState(false);
  const [ambassadorFullName, setAmbassadorFullName] = useState('');
  const [ambassadorEmail, setAmbassadorEmail] = useState('');
  const [ambassadorPhone, setAmbassadorPhone] = useState('');
  const [ambassadorTermsAccepted, setAmbassadorTermsAccepted] = useState(false);
  const [isCreatingAmbassador, setIsCreatingAmbassador] = useState(false);
  const [payingAmbassadorId, setPayingAmbassadorId] = useState<string | null>(null);

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
  // Crypto token inspector (large-print + one-click copy)
  const [viewingToken, setViewingToken] = useState<Participant | null>(null);

  // Post-Workshop: PDF Report Export & Console Wipe (next session preparation)
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState('');
  const [isWiping, setIsWiping] = useState(false);

  // Scanner & GCM Verification State
  const [scannerTokenInput, setScannerTokenInput] = useState('');
  const [verificationResult, setVerificationResult] = useState<CryptographicTokenVerification | null>(null);
  const [isVerifyingToken, setIsVerifyingToken] = useState(false);
  const [isCameraScannerActive, setIsCameraScannerActive] = useState(false);
  // Scanner pipeline (100% maison) : MediaStream direct + BarcodeDetector natif.
  // Plus de Html5QrcodeScanner : la caméra, le relâchement et la boucle de
  // décodage sont entièrement sous notre contrôle — comportement déterministe.
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const scanBusyRef = useRef(false);
  // Live scanner diagnostics (the user has weak eyesight — large readable feedback)
  const [scannerFrameCount, setScannerFrameCount] = useState(0);
  const [scannerLastError, setScannerLastError] = useState<string | null>(null);
  const [hasNativeQrEngine, setHasNativeQrEngine] = useState<boolean | null>(null);
  const [firstFrameSeen, setFirstFrameSeen] = useState(false);
  const [backupEngineActive, setBackupEngineActive] = useState(false);

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
      // Abonnement au push serveur (W3C Web Push / VAPID) : la Direction reçoit
      // les alertes de NOUVEAUX PAIEMENTS Orange Money sur tous ses terminaux.
      const pushResult = await subscribeWebPush('ADMIN');
      triggerNativePushNotification(
        'PIGA STUDIO · Notifications PWA Activées',
        pushResult.ok
          ? 'Terminal inscrit : alertes temps réel de nouveaux paiements Orange Money depuis n\'importe quel appareil.'
          : 'Alertes locales actives. Push serveur : ' + pushResult.message
      );
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [parts, logs, inv, ambs] = await Promise.all([
        api.getParticipants(),
        api.getAuditLogs(),
        api.getInventoryStats(),
        api.listAmbassadors()
      ]);
      setParticipants(parts);
      setAuditLogs(logs);
      setInventory(inv);
      setAmbassadors(ambs);
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
  const verifyTokenString = async (raw: string) => {
    const input = raw.trim();
    if (!input) return;
    setIsVerifyingToken(true);
    try {
      // 1. URL complète collée (PDF QR, lien de vérification) → extraire le jeton
      const urlToken = input.match(/[#?&]token=([^&\s]+)/i);
      let candidate = urlToken ? decodeURIComponent(urlToken[1]) : input;
      // Variante QR sans jeton: "...?ticket=CODE" → transformer en code billet
      if (!urlToken) {
        const urlTicket = input.match(/[?&]ticket=([^&\s]+)/i);
        if (urlTicket) candidate = decodeURIComponent(urlTicket[1]);
      }

      const isHexToken = /^[0-9a-f]+\.[0-9a-f]+\.[0-9a-f]+$/i.test(candidate) && candidate.length > 100;
      if (!isHexToken) {
        // 2. CODE du billet (ex: AA-2026-5BA247-281) → résolution via le registre
        //    puis vérification cryptographique RÉELLE du jeton émis pour ce dossier
        //    (aucun contournement de la porte AES: la décision reste cryptographique)
        const candidates = [
          candidate.replace(/\s+/g, '').toUpperCase(),
          candidate.replace(/[^A-Za-z0-9-]/g, '').toUpperCase()
        ].filter(Boolean);
        const match = participants.find(p => {
          const code = (p.ticketCode || '').replace(/\s+/g, '').toUpperCase();
          return code && candidates.includes(code);
        });

        if (match) {
          if (match.status !== 'CONFIRMED') {
            setVerificationResult({
              isValid: false,
              tamperDetected: false,
              error: `Dossier trouvé (${match.fullName}) mais statut = ${match.status}. Le billet n'est pas délivré tant que la Direction n'a pas confirmé le paiement.`,
              verificationTimestamp: new Date().toISOString()
            });
            return;
          }
          if (!match.cryptoToken) {
            setVerificationResult({
              isValid: false,
              tamperDetected: false,
              error: `Dossier confirmé (${match.fullName}) mais jeton cryptographique absent. Re-confirmez le dossier pour réémettre un jeton.`,
              verificationTimestamp: new Date().toISOString()
            });
            return;
          }
          // JETON du dossier → déchiffrement AES-256-GCM (authentique contrôle d'accès)
          const result = await api.verifyToken(match.cryptoToken.trim());
          setVerificationResult({
            ...result,
            payload: {
              t: String(match.ticketCode || ''),
              n: match.fullName,
              d: result.payload?.d || '2026-11-13',
              s: 'CONFIRMED',
              iat: result.payload?.iat
            },
            verificationTimestamp: result.verificationTimestamp || new Date().toISOString()
          });
          return;
        }

        setVerificationResult({
          isValid: false,
          tamperDetected: false,
          error: 'Code billet introuvable dans le registre de la session active. Formats acceptés : CODE du billet (AA-2026-…), lien du PDF, ou jeton cryptographique complet.',
          verificationTimestamp: new Date().toISOString()
        });
        return;
      }

      // 3. Jeton brut (IV.cipher.tag) → vérification cryptographique directe
      const result = await api.verifyToken(candidate.trim());
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

  // 9. Ambassadeurs — création, versement de commissions, suspension
  const handleCreateAmbassador = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingAmbassador(true);
    try {
      const result = await api.createAmbassador(ambassadorFullName.trim(), ambassadorEmail.trim(), ambassadorPhone.trim(), ambassadorTermsAccepted);
      const ambassador = result.ambassador;
      setAmbassadorFullName(''); setAmbassadorEmail(''); setAmbassadorPhone('');
      setAmbassadorTermsAccepted(false);
      setAmbassadorFormOpen(false);
      await loadData();
      if (ambassador) {
        const link = `${window.location.origin}/?ref=${ambassador.code}`;
        const onboarding = generateAmbassadorOnboardingMessage(ambassador);
        try { await navigator.clipboard.writeText(`${onboarding}\n\n🔗 ${link}`); } catch { /* clipboard indisponible */ }
        setActionSuccessMessage(
          `Ambassadeur ${ambassador.code} enrôlé. Message d'onboarding WhatsApp copié — collez-le dans la discussion du client. Lien magique : ${link}`
        );
        setTimeout(() => setActionSuccessMessage(null), 9000);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la création de l\'ambassadeur.');
    } finally {
      setIsCreatingAmbassador(false);
    }
  };

  const handlePayAmbassador = async (ambassadorId: string, ambassadorCode: string, toPayUsd: number) => {
    if (!confirm(`Marquer les commissions de ${ambassadorCode} comme VERSÉES ? Total payable : $${toPayUsd.toFixed(2)} (via Orange Money). Les commissions encore en délai de traitement (48h) seront ignorées.`)) return;
    setPayingAmbassadorId(ambassadorId);
    try {
      const result = await api.payAmbassadorCommissions(ambassadorId);
      await loadData();
      const holdNote = result.skippedInHold > 0 ? ` ${result.skippedInHold} commission(s) restent en délai de traitement 48h.` : '';
      setActionSuccessMessage(`${result.marked} commission(s) marquée(s) payée(s) pour ${ambassadorCode} — $${result.totalUsd.toFixed(2)} versé(s).${holdNote} Traçabilité inscrite dans l'audit immuable.`);
      setTimeout(() => setActionSuccessMessage(null), 8000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur lors du versement.');
    } finally {
      setPayingAmbassadorId(null);
    }
  };

  const handleToggleAmbassadorStatus = async (ambassadorId: string, ambassadorCode: string, active: boolean) => {
    if (!confirm(active ? `Réactiver ${ambassadorCode} ?` : `Suspendre ${ambassadorCode} ? Son lien magique cessera d'attribuer les ventes.`)) return;
    try {
      await api.setAmbassadorStatus(ambassadorId, active);
      await loadData();
      setActionSuccessMessage(active ? `Ambassadeur ${ambassadorCode} réactivé.` : `Ambassadeur ${ambassadorCode} suspendu.`);
      setTimeout(() => setActionSuccessMessage(null), 5000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la mise à jour du statut.');
    }
  };

  const handleViewAmbassadorSales = async (ambassadorId: string) => {
    if (ambassadorSales[ambassadorId]) {
      setAmbassadorSales(prev => {
        const next = { ...prev };
        delete next[ambassadorId];
        return next;
      });
      return;
    }
    try {
      const sales = await api.listAmbassadorSales(ambassadorId);
      setAmbassadorSales(prev => ({ ...prev, [ambassadorId]: sales }));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur lors du chargement des ventes.');
    }
  };

  // 6. Camera QR Scanner — PIPELINE 100% MAISON (zéro lib fragile) :
  //    1) MediaStream direct (getUserMedia) -> <video> plein cadre
  //    2) décodage par le moteur NATIF du navigateur (BarcodeDetector, Chrome)
  //    3) boucle manuelle chaque 130ms, compte à rebours visible + erreurs en clair
  //    La caméra est TOUJOURS relâchée proprement (plus de streams zombies).
  type NativeBarcodeDetector = {
    detect: (source: HTMLVideoElement | HTMLCanvasElement) => Promise<Array<{ rawValue: string }>>;
  };
  type BarcodeDetectorCtor = new (opts: { formats: string[] }) => NativeBarcodeDetector;

  const stopCameraScanner = (): void => {
    if (scanTimerRef.current !== null) { clearInterval(scanTimerRef.current); scanTimerRef.current = null; }
    scanBusyRef.current = false;
    const stream = cameraStreamRef.current;
    cameraStreamRef.current = null;
    if (stream) {
      stream.getTracks().forEach(t => { try { t.stop(); } catch { /* déjà stop */ } });
    }
    const video = cameraVideoRef.current;
    if (video) { try { video.srcObject = null; } catch { /* noop */ } }
  };

  useEffect(() => {
    const scannerTabActive = currentTab === 'scanner' && isCameraScannerActive;
    if (!scannerTabActive) {
      stopCameraScanner();
      return;
    }

    setScannerFrameCount(0);
    setScannerLastError(null);
    setHasNativeQrEngine(null);
    setFirstFrameSeen(false);
    setBackupEngineActive(false);

    const timer = setTimeout(() => {
      void (async () => {
        stopCameraScanner();
        const videoEl = document.getElementById('piga-camera-video') as HTMLVideoElement | null;
        if (!videoEl) {
          setScannerLastError('Élément vidéo introuvable — revenez sur l\'onglet Scanner.');
          return;
        }

        // --- Détection du moteur QR natif (Chrome Android/Desktop le possèdent) ---
        const bdCtor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
        if (!bdCtor) {
          setHasNativeQrEngine(false);
          setScannerLastError('Ce navigateur n\'a pas le moteur QR natif. Utilisez Chrome (« Activer Caméra Scanner ») ou la Méthode 2 clics : bouton Jeton → COPIER → coller ici → Authentifier.');
          return;
        }
        let detector: NativeBarcodeDetector;
        try {
          detector = new bdCtor({ formats: ['qr_code'] });
        } catch (e) {
          setHasNativeQrEngine(false);
          setScannerLastError(`Moteur QR indisponible : ${e instanceof Error ? e.message : String(e)}`);
          return;
        }
        setHasNativeQrEngine(true);

        // --- Ouverture caméra DIRECTE (contraintes souples, jamais "Overconstrained") ---
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
            audio: false
          });
        } catch (e) {
          setScannerLastError(`Accès caméra refusé : ${e instanceof Error ? e.message : String(e)} — accordez l'autorisation dans l'icône cadenas de la barre d'adresse, puis réactivez.`);
          setIsCameraScannerActive(false);
          return;
        }
        cameraStreamRef.current = stream;
        videoEl.srcObject = stream;
        try { await videoEl.play(); } catch { /* autoplay bloqué — le flux reste attaché, un léger tap sur la vignette relance l'image */ }

        // confirmation live du rendu de la caméra (détecte les frames figées)
        const markPlaying = (): void => setFirstFrameSeen(true);
        videoEl.addEventListener('playing', markPlaying, { once: true });

        // --- Boucle de décodage manuelle (130ms) : robuste et inspectable ---
        let frameCount = 0;
        // Canvas industriel : CHAQUE frame est dessinée à pleine résolution puis
        // analysée — plus aucun échec silencieux de la lecture <video>.
        const workCanvas = document.createElement('canvas');
        const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });

        scanTimerRef.current = window.setInterval(() => {
          if (scanBusyRef.current) return;
          if (!videoEl.videoWidth || videoEl.readyState < 2) {
            setScannerLastError('Image caméra pas encore prête — taper la vignette / autorisez la caméra.');
            return;
          }
          scanBusyRef.current = true;
          // Redimensionne le pas trop grand pour garder la vitesse : longueur ≤ 640
          const scale = Math.min(1, 640 / Math.max(videoEl.videoWidth, videoEl.videoHeight));
          const cw = Math.max(1, Math.round(videoEl.videoWidth * scale));
          const ch = Math.max(1, Math.round(videoEl.videoHeight * scale));
          if (workCanvas.width !== cw || workCanvas.height !== ch) { workCanvas.width = cw; workCanvas.height = ch; }
          try { workCtx?.drawImage(videoEl, 0, 0, cw, ch); } catch { /* frame en cours */ }

          detector.detect(workCanvas)
            .then(codes => {
              frameCount += 1;
              if (frameCount % 10 === 1) setScannerFrameCount(frameCount);
              const hit = codes.find(c => (c.rawValue || '').trim().length > 0);
              if (hit) {
                const value = hit.rawValue.trim();
                clearInterval(scanTimerRef.current ?? 0);
                scanTimerRef.current = null;
                setScannerTokenInput(value);
                verifyTokenString(value);
                stopCameraScanner();
                setIsCameraScannerActive(false);
              } else if (frameCount === 38) {
                // ~5 s sans lecture native → moteur JS de secours intégré à la même boucle
                setBackupEngineActive(true);
              }
            })
            .catch((e: unknown) => {
              frameCount += 1;
              if (frameCount % 10 === 1) setScannerFrameCount(frameCount);
              const msg = e instanceof Error ? e.message : String(e);
              if (msg && !msg.toLowerCase().includes('notfound')) {
                setScannerLastError(msg);
              }
            })
            .finally(() => { scanBusyRef.current = false; });

          // === MOTEUR DE SECOURS jsQR (remotely, same canvas) — actif après 5s natifs vides
          if (frameCount >= 38 && workCtx) {
            try {
              const img = workCtx.getImageData(0, 0, cw, ch);
              const qr = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
              if (qr && qr.data && qr.data.trim()) {
                const value = qr.data.trim();
                clearInterval(scanTimerRef.current ?? 0);
                scanTimerRef.current = null;
                setScannerTokenInput(value);
                verifyTokenString(value);
                stopCameraScanner();
                setIsCameraScannerActive(false);
              }
            } catch { /* moteur de secours — erreurs tolérées */ }
          }
        }, 130);
      })();
    }, 250);

    return () => {
      clearTimeout(timer);
      stopCameraScanner();
    };
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

  // Sources de la nav mobile et desktop (icônes + libellés centralisés)
  const adminNavItems: Array<{ id: 'formation' | 'dashboard' | 'participants' | 'scanner' | 'audit'; label: string; icon: React.ReactNode }> = [
    { id: 'formation', label: 'Formation & Landing Page', icon: <SlidersHorizontal className="w-4 h-4" /> },
    { id: 'dashboard', label: 'Historique des Ventes', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'participants', label: `Participants Orange Money (${participants.length})`, icon: <Users className="w-4 h-4" /> },
    { id: 'scanner', label: 'Scanner & Vérificateur GCM', icon: <QrCode className="w-4 h-4" /> },
    { id: 'audit', label: `Journal d'Audit Immuable (${auditLogs.length})`, icon: <Activity className="w-4 h-4" /> }
  ];

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
    <div className="min-h-screen bg-white dark:bg-[#000000] text-slate-900 dark:text-slate-100 flex flex-col font-inter transition-colors duration-200 overflow-x-hidden">
      {/* Top Bar — compact + hamburger (mobile), complet (desktop) */}
      <header className="border-b border-slate-200 dark:border-[#1E1E1E] bg-slate-50 dark:bg-[#0A0A0A] px-3 sm:px-6 py-2.5 sm:py-4 sticky top-0 z-30 transition-colors">
        {/* ROW 1 — état compact permanent (tous écrans) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Hamburger mobile — déplie le panneau */}
            <button
              onClick={() => setIsHeaderMenuOpen(v => !v)}
              aria-expanded={isHeaderMenuOpen}
              aria-controls="admin-header-panel"
              className="md:hidden p-2 rounded-md bg-[#E50914] text-white flex items-center cursor-pointer shrink-0"
              title="Menu console"
            >
              {isHeaderMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <PigaLogo variant="compact" size="sm" />
            <div className="hidden sm:block border-l border-slate-200 dark:border-[#222222] pl-4 min-w-0">
              <h1 className="text-sm font-bold font-montserrat text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span className="truncate">{resolvedInfo.decorativeName} · Supervision PIGA</span>
                <span className="text-[10px] font-mono text-[#E50914] bg-[#E50914]/10 dark:bg-[#E50914]/15 px-2 py-0.5 rounded font-bold border border-[#E50914]/30 shrink-0">
                  ORANGE MONEY ({resolvedInfo.orangeMoneyNumber})
                </span>
                <span className="text-xs font-mono text-[#10B981] bg-[#10B981]/10 px-2.5 py-1 rounded font-bold border-2 border-[#10B981]/40 shrink-0">
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

          {/* Actions compacts permanentes : thème · refresh · verrou */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <ThemeToggle showLogoToggle={true} size="sm" />
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
            {/* Actions étendues — uniquement desktop (mobile dans le panneau ☰) */}
            <div className="hidden md:flex items-center gap-2.5">
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
                onClick={onBackToClient}
                className="px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white bg-slate-200 hover:bg-slate-300 dark:bg-[#1E1E1E] dark:hover:bg-[#282828] border border-slate-300 dark:border-[#333333] rounded-md transition-colors cursor-pointer"
              >
                Page Publique
              </button>
            </div>
          </div>
        </div>

        {/* ROW 2 — panneau déplié du hamburger (mobile uniquement) */}
        {isHeaderMenuOpen && (
          <div id="admin-header-panel" className="md:hidden mt-2.5 rounded-lg bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] p-4 space-y-3 shadow-md animate-fade-in">
            <div className="text-sm font-bold font-montserrat text-slate-900 dark:text-white break-words">
              {resolvedInfo.decorativeName} · Supervision PIGA
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] font-mono text-[#E50914] bg-[#E50914]/10 dark:bg-[#E50914]/15 px-2 py-1 rounded font-bold border border-[#E50914]/30 break-all">
                ORANGE MONEY ({resolvedInfo.orangeMoneyNumber})
              </span>
              <span className="text-[10px] font-mono text-[#10B981] bg-[#10B981]/10 px-2 py-1 rounded font-bold border-2 border-[#10B981]/40 break-all">
                WhatsApp {WHATSAPP_TEMPLATE_VERSION} — PDF+QR ✅
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Auditeur Chef : ADM-2026-CHIEF · <span className="text-[#10B981] font-medium">Sécurité Zéro-Trust Active</span>
            </div>
            <div className="grid grid-cols-1 gap-2 pt-1">
              <button
                onClick={handleEnableNotifications}
                className={`w-full justify-center px-3 py-3 text-sm font-medium rounded-md border flex items-center gap-2 transition-colors cursor-pointer ${
                  notificationPermission === 'granted'
                    ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
                    : 'bg-slate-100 dark:bg-[#141414] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-[#2A2A2A]'
                }`}
              >
                <Bell className="w-4 h-4" />
                <span>{notificationPermission === 'granted' ? 'Push Actif' : 'Activer Notifications'}</span>
              </button>
              {isInstallable && (
                <button
                  onClick={install}
                  className="w-full justify-center px-3 py-3 text-sm font-bold font-montserrat text-white bg-[#E50914] hover:bg-[#C80711] rounded-md transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Installer PWA</span>
                </button>
              )}
              <button
                onClick={onBackToClient}
                className="w-full justify-center px-3 py-3 text-sm font-bold text-slate-800 dark:text-white bg-slate-200 dark:bg-[#1E1E1E] border border-slate-300 dark:border-[#333333] rounded-md transition-colors cursor-pointer"
              >
                Page Publique
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Layout Grid */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-6">
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

        {/* Admin Navigation Bar / Sidebar Tabs
            — MOBILE : bandeau repliable (collapsible / expandable)
            — DESKTOP : onglets horizontaux (inchangés) */}
        <div className="border-b border-slate-200 dark:border-[#1E1E1E] pb-3">
          {/* MOBILE — déclencheur + menu déroulant */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileNavOpen(v => !v)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-lg bg-slate-100 dark:bg-[#0E0E0E] border-2 border-slate-200 dark:border-[#1E1E1E] cursor-pointer transition-colors hover:border-[#E50914]/50"
              aria-expanded={isMobileNavOpen}
              aria-controls="admin-mobile-nav"
            >
              <span className="flex items-center gap-2.5 text-sm font-bold font-montserrat text-slate-900 dark:text-white truncate">
                {adminNavItems.find(n => n.id === currentTab)?.icon}
                <span className="truncate">{adminNavItems.find(n => n.id === currentTab)?.label}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-mono text-[#E50914] font-bold">{adminNavItems.findIndex(n => n.id === currentTab) + 1}/{adminNavItems.length}</span>
                <ChevronDown className={`w-5 h-5 text-[#E50914] transition-transform duration-200 ${isMobileNavOpen ? 'rotate-180' : ''}`} />
              </span>
            </button>

            {isMobileNavOpen && (
              <div id="admin-mobile-nav" className="mt-2 rounded-lg bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] overflow-hidden shadow-md animate-fade-in">
                {adminNavItems.map(item => {
                  const active = item.id === currentTab;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setCurrentTab(item.id); setIsMobileNavOpen(false); }}
                      className={`w-full flex items-center justify-between px-4 py-4 border-b last:border-0 border-slate-100 dark:border-[#141414] text-[15px] font-semibold font-montserrat cursor-pointer transition-colors ${
                        active
                          ? 'bg-[#E50914]/10 text-[#E50914] dark:text-[#E50914]'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#111111]'
                      }`}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        {item.icon}
                        <span className="truncate">{item.label}</span>
                      </span>
                      {active ? <Check className="w-5 h-5 text-[#10B981] shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-300 shrink-0 -rotate-90" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* DESKTOP — onglets horizontaux */}
          <div className="hidden md:flex items-center justify-between">
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
              onClick={() => setCurrentTab('ambassadeurs')}
              className={`px-4 py-2 text-xs font-bold font-montserrat rounded-md transition-colors cursor-pointer flex items-center gap-2 ${
                currentTab === 'ambassadeurs'
                  ? 'bg-[#E50914] text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-[#0E0E0E]'
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>Ambassadeurs ({ambassadors.length})</span>
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
        {/* TAB: AMBASSADEURS PIGA STUDIO (armée de distribution — 15% / vente) */}
        {/* ==================================================================== */}
        {currentTab === 'ambassadeurs' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold font-montserrat text-slate-900 dark:text-white uppercase tracking-wider">
                  Armée de Distribution · Suivi &amp; Commissions
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Lien magique <span className="font-mono">?ref=AMB-XXXX</span> · Commission enregistrée uniquement sur les ventes VALIDÉES Orange Money · Paie traçable dans l'audit immuable.
                </div>
              </div>
              <button
                onClick={() => setAmbassadorFormOpen(o => !o)}
                className="px-4 py-2.5 text-xs font-bold font-montserrat text-white bg-[#E50914] hover:bg-[#C80711] rounded-md transition-colors flex items-center gap-2 cursor-pointer shadow-xs shrink-0"
              >
                <Megaphone className="w-4 h-4" />
                <span>{ambassadorFormOpen ? 'Fermer le formulaire' : 'Enrôler un Ambassadeur'}</span>
              </button>
            </div>

            {/* Formulaire d'enrôlement manuel */}
            {ambassadorFormOpen && (
              <form onSubmit={handleCreateAmbassador} className="p-5 rounded-xl bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] space-y-4 shadow-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 font-montserrat">Nom Complet *</label>
                    <input
                      type="text"
                      value={ambassadorFullName}
                      onChange={(e) => setAmbassadorFullName(e.target.value)}
                      placeholder="Ex: Christelle Kabedi"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#262626] focus:border-[#E50914] rounded-md text-xs text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 font-montserrat">Numéro WhatsApp RDC *</label>
                    <input
                      type="tel"
                      value={ambassadorPhone}
                      onChange={(e) => setAmbassadorPhone(e.target.value)}
                      placeholder="0803240289 ou +243..."
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#262626] focus:border-[#E50914] rounded-md text-xs text-slate-900 dark:text-white font-mono outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 font-montserrat">E-mail *</label>
                    <input
                      type="email"
                      value={ambassadorEmail}
                      onChange={(e) => setAmbassadorEmail(e.target.value)}
                      placeholder="ambassadeur@exemple.cd"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#262626] focus:border-[#E50914] rounded-md text-xs text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-400 max-w-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ambassadorTermsAccepted}
                      onChange={(e) => setAmbassadorTermsAccepted(e.target.checked)}
                      className="mt-0.5 w-4 h-4 cursor-pointer accent-[#E50914]"
                    />
                    <span>
                      L'ambassadeur accepte les <strong>conditions de commission</strong> : versement uniquement après
                      confirmation du paiement Orange Money de son affilié + délai de traitement de <strong>48 heures</strong>.
                    </span>
                  </label>
                  <button
                    type="submit"
                    disabled={isCreatingAmbassador || !ambassadorTermsAccepted || ambassadorFullName.trim().length < 3 || !ambassadorEmail.includes('@') || ambassadorPhone.trim().length < 8}
                    className="px-5 py-2.5 text-xs font-bold font-montserrat text-white bg-[#10B981] hover:bg-[#059669] disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 rounded-md transition-colors cursor-pointer shrink-0"
                  >
                    {isCreatingAmbassador ? 'Enrôlement…' : 'Créer & Copier le Kit'}
                  </button>
                </div>
              </form>
            )}

            {/* Classement des ambassadeurs */}
            <div className="rounded-xl bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] overflow-hidden shadow-xs">
              <div className="px-5 py-4 bg-slate-50 dark:bg-[#050505] border-b border-slate-200 dark:border-[#1E1E1E]">
                <div className="text-xs font-bold font-montserrat text-slate-900 dark:text-white uppercase tracking-wider">
                  Classement des Ambassadeurs · Top Vendeur
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-[#1E1E1E] text-slate-500 dark:text-slate-400 uppercase font-montserrat text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Ambassadeur</th>
                      <th className="px-4 py-3">Clics</th>
                      <th className="px-4 py-3">Ventes validées</th>
                      <th className="px-4 py-3">En instance</th>
                      <th className="px-4 py-3">Gains totaux</th>
                      <th className="px-4 py-3" title="Commissions confirmées depuis plus de 48h — versables">Payable</th>
                      <th className="px-4 py-3" title="Commissions confirmées il y a moins de 48h — délai de traitement">Délai 48h</th>
                      <th className="px-4 py-3">Déjà payé</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1A1A1A]">
                    {ambassadors.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-10 text-slate-400 dark:text-slate-500 font-inter">
                          Aucun ambassadeur enrôlé. Utilisez « Enrôler un Ambassadeur » ou le portail public (#ambassadeur).
                        </td>
                      </tr>
                    ) : (
                      ambassadors.map((a, index) => (
                        <React.Fragment key={a.id}>
                          <tr className="hover:bg-slate-50 dark:hover:bg-[#0E0E0E] transition-colors">
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                {index === 0 && a.validatedSales > 0 && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-400 text-black text-[9px] font-bold uppercase" title="Top Ambassadeur">👑 Top</span>
                                )}
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-white font-montserrat">{a.fullName}</div>
                                  <div className="font-mono text-[10px] text-[#E50914]">{a.code} · {Math.round(a.commissionRate * 100)}%</div>
                                </div>
                              </div>
                              <div className="text-[10px] text-slate-500 mt-1 font-mono">+{a.phoneInternational}</div>
                            </td>
                            <td className="px-4 py-3.5 font-mono text-slate-700 dark:text-slate-300">{a.clicks}</td>
                            <td className="px-4 py-3.5 font-mono font-bold text-[#10B981]">{a.validatedSales}</td>
                            <td className="px-4 py-3.5 font-mono text-amber-600 dark:text-amber-400">{a.pendingSales}</td>
                            <td className="px-4 py-3.5 font-mono font-bold text-slate-900 dark:text-white">${a.earnedUsd.toFixed(2)}</td>
                            <td className="px-4 py-3.5 font-mono font-bold text-[#E50914]">{a.toPayUsd > 0 ? `$${a.toPayUsd.toFixed(2)}` : '—'}</td>
                            <td className="px-4 py-3.5 font-mono text-amber-600 dark:text-amber-400">{a.inHoldUsd > 0 ? `$${a.inHoldUsd.toFixed(2)}` : '—'}</td>
                            <td className="px-4 py-3.5 font-mono text-slate-500">{a.paidUsd > 0 ? `$${a.paidUsd.toFixed(2)}` : '—'}</td>
                            <td className="px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    const link = `${window.location.origin}/?ref=${a.code}`;
                                    void navigator.clipboard.writeText(`${generateAmbassadorOnboardingMessage({
                                      id: a.id, code: a.code, fullName: a.fullName, email: a.email,
                                      phoneInternational: a.phoneInternational, commissionRate: a.commissionRate,
                                      payoutProvider: a.payoutProvider, payoutNumber: a.payoutNumber,
                                      status: a.status, createdAt: a.createdAt
                                    })}\n\n🔗 ${link}`).then(() => alert('Kit d\'onboarding + lien copié — collez-le dans WhatsApp.'));
                                  }}
                                  className="px-2.5 py-1.5 text-[11px] font-semibold text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/30 rounded flex items-center gap-1 hover:bg-[#10B981]/20 transition-colors cursor-pointer"
                                  title="Copier le message d'onboarding WhatsApp avec le lien magique"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Kit</span>
                                </button>

                                {a.toPayUsd > 0 && (
                                  <button
                                    disabled={payingAmbassadorId === a.id}
                                    onClick={() => handlePayAmbassador(a.id, a.code, a.toPayUsd)}
                                    className="px-2.5 py-1.5 text-[11px] font-bold text-white bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 rounded flex items-center gap-1 transition-colors cursor-pointer"
                                    title={`Verser $${a.toPayUsd.toFixed(2)} de commissions (marquer payé)`}
                                  >
                                    <Wallet className="w-3.5 h-3.5" />
                                    <span>{payingAmbassadorId === a.id ? 'Paie…' : `Payer $${a.toPayUsd.toFixed(2)}`}</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => handleToggleAmbassadorStatus(a.id, a.code, a.status === 'SUSPENDED')}
                                  className={`px-2 py-1.5 text-[11px] rounded border flex items-center gap-1 transition-colors cursor-pointer ${
                                    a.status === 'ACTIVE'
                                      ? 'text-slate-600 dark:text-slate-300 border-slate-300 dark:border-[#2E2E2E] hover:bg-slate-100 dark:hover:bg-[#1E1E1E]'
                                      : 'text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-900/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                                  }`}
                                  title={a.status === 'ACTIVE' ? 'Suspendre le lien magique' : 'Réactiver'}
                                >
                                  {a.status === 'ACTIVE' ? <Ban className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                                  <span>{a.status === 'ACTIVE' ? 'Suspendre' : 'Réactiver'}</span>
                                </button>

                                <button
                                  onClick={() => handleViewAmbassadorSales(a.id)}
                                  className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded cursor-pointer"
                                  title="Détail des ventes rattachées"
                                >
                                  <ChevronDown className={`w-4 h-4 transition-transform ${ambassadorSales[a.id] ? 'rotate-180' : ''}`} />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Détail des ventes rattachées */}
                          {ambassadorSales[a.id] && (
                            <tr className="bg-slate-50 dark:bg-[#050505]">
                              <td colSpan={9} className="px-4 py-3">
                                <div className="text-[10px] font-bold font-montserrat uppercase tracking-wider text-slate-500 mb-2">
                                  Ventes rattachées à {a.code} (traçabilité zéro litige)
                                </div>
                                {ambassadorSales[a.id].length === 0 ? (
                                  <div className="text-[11px] text-slate-400">Aucune vente rattachée pour le moment.</div>
                                ) : (
                                  <div className="space-y-1.5">
                                    {ambassadorSales[a.id].map(s => (
                                      <div key={s.participantId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] text-[11px]">
                                        <span className="font-semibold text-slate-900 dark:text-white">{s.fullName}</span>
                                        <span className="font-mono text-slate-500">{s.ticketCode || '—'}</span>
                                        <span className="font-mono">${s.priceUsd.toFixed(2)} → commission ${s.commissionUsd.toFixed(2)}</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                          s.status === 'CONFIRMED'
                                            ? 'bg-[#10B981]/15 text-[#10B981]'
                                            : s.status === 'PENDING'
                                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                            : 'bg-red-500/15 text-red-600 dark:text-red-400'
                                        }`}>
                                          {s.status === 'CONFIRMED' ? `Validée · ${s.commissionStatus === 'PAID' ? 'Payée' : 'À verser'}` : s.status === 'PENDING' ? 'En attente' : 'Annulée'}
                                        </span>
                                        <span className="text-slate-400 font-mono">{s.createdAt ? new Date(s.createdAt).toLocaleDateString('fr-FR') : '—'}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Lien du portail de recrutement public */}
            <div className="p-4 rounded-xl bg-[#E50914]/5 border border-[#E50914]/25 text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[#E50914] shrink-0" />
              <span>
                Vos prospects ambassadeurs peuvent aussi s'enrôler eux-mêmes via le portail public :{' '}
                <button
                  onClick={() => { window.history.pushState(null, '', '#ambassadeur'); window.location.reload(); }}
                  className="text-[#E50914] font-bold hover:underline cursor-pointer"
                >
                  {`${window.location.origin}/#ambassadeur`}
                </button>
                {' '}— statut officiel, lien magique et Kit de Survie générés instantanément.
              </span>
            </div>
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
                                      onClick={() => setViewingToken(p)}
                                      className="px-2.5 py-1.5 text-xs font-bold text-[#E50914] hover:text-white hover:bg-[#E50914] bg-[#E50914]/5 border-2 border-[#E50914]/40 rounded transition-colors flex items-center gap-1 cursor-pointer"
                                      title="Afficher le jeton cryptographique du billet (QR + copie)"
                                    >
                                      <QrCode className="w-3.5 h-3.5" />
                                      <span>Jeton</span>
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
                  {/* Formats acceptés — GROS CARACTÈRES (lisibilité contrôle d'accès) */}
                  <div className="rounded-lg border-2 border-[#10B981]/40 bg-[#10B981]/5 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 space-y-1 mt-2">
                    <div className="font-bold text-[#10B981]">Formats acceptés pour la vérification :</div>
                    <div>1️⃣ <strong>Le CODE du billet</strong> — ex : <code className="font-mono font-bold">AA-2026-5BA247-281</code></div>
                    <div>2️⃣ <strong>Le lien complet du PDF / du QR</strong> (message WhatsApp ou page #verify)</div>
                    <div>3️⃣ <strong>Le jeton chiffré complet</strong> (IV.cle.tag, copié depuis la console)</div>
                    <div className="pt-2 mt-2 border-t-2 border-slate-200 dark:border-[#1E1E1E] text-[#B45309] dark:text-amber-400 font-semibold">
                      ⚠️ Important : la caméra ne peut JAMAIS lire un QR affiché sur le même téléphone. Sur mobile, utilisez la méthode 2 clics ci-dessous — ou scannez le billet affiché sur un AUTRE appareil (PC, impression, téléphone du client).
                    </div>
                    <div className="pt-1 text-[11px] text-slate-600 dark:text-slate-400">
                      💡 <strong>Méthode 2 clics sur mobile :</strong> onglet Participants → ligne CONFIRMÉ → bouton « Jeton » → COPIER → revenez ici → collez dans ce champ → Authentifier. Le déchiffrement AES s'exécute instantanément.
                    </div>
                  </div>
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

              {/* Camera Scanner Container — <video> natif piloté maison */}
              {isCameraScannerActive && (
                <div className="p-4 rounded-lg bg-black border border-slate-300 dark:border-[#2A2A2A] max-w-md mx-auto text-center">
                  <video
                    id="piga-camera-video"
                    ref={cameraVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full min-h-[280px] aspect-video overflow-hidden rounded bg-black object-cover"
                  />
                  {/* Diagnostics live — la boucle tourne-t-elle ? */}
                  <div className="mt-2 rounded-md border-2 border-[#10B981]/50 bg-[#10B981]/10 px-3 py-2 space-y-1">
                    <div className="text-sm font-bold font-mono text-[#10B981]">
                      🔍 Recherche active… {scannerFrameCount} image(s) analysée(s)
                      {hasNativeQrEngine === true && <span className="ml-1 text-[10px] text-[#059669]">moteur QR natif ✅</span>}
                      {hasNativeQrEngine === false && <span className="ml-1 text-[10px] text-slate-400">natif absent</span>}
                      {backupEngineActive && <span className="ml-1 text-[10px] text-amber-400">moteur de secours jsQR actif</span>}
                    </div>
                    <div className={`text-[11px] font-semibold ${firstFrameSeen ? 'text-[#10B981]' : 'text-amber-300'}`}>
                      {firstFrameSeen ? '🎥 Vue caméra en direct ✅' : '⏸ Image caméra pas encore démarrée — tapez légèrement la vignette si elle reste noire'}
                    </div>
                    {scannerLastError && (
                      <div className="text-[11px] font-semibold text-amber-300 break-all">{scannerLastError}</div>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-slate-200 mt-2">
                    Pointez l'objectif vers le QR Code officiel PIGA STUDIO
                    <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                      15 à 30 cm de distance · bien éclairé · impossible de scanner le QR affiché sur ce même téléphone (ouvrez le billet sur un autre appareil ou imprimez-le)
                    </span>
                  </div>
                </div>
              )}

              {/* Manual Token Verification Box */}
              <div className="pt-2 space-y-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 font-montserrat">
                  Ou collez l'un des 3 formats acceptés (écrits en gros) :
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
      {/* MODAL 1c: CRYPTO TOKEN INSPECTOR — GROS CARACTÈRES + COPIE            */}
      {/* ==================================================================== */}
      {viewingToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-2xl bg-white dark:bg-[#0A0A0A] border-2 border-[#E50914]/50 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-[#0F0F0F] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold font-montserrat text-slate-900 dark:text-white flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-[#E50914]" />
                  <span>Jeton Cryptographique — {viewingToken.fullName}</span>
                </h3>
                <div className="text-sm text-slate-600 dark:text-slate-400 font-semibold mt-0.5">
                  Code billet : <span className="font-mono text-[#E50914] font-bold">{viewingToken.ticketCode}</span> · Émis AES-256-GCM
                </div>
              </div>
              <button
                onClick={() => setViewingToken(null)}
                className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {viewingToken.cryptoToken ? (
                <>
                  {/* Le lien de vérification encodé dans le QR — où le trouver */}
                  <div className="rounded-lg border-2 border-[#10B981]/40 bg-[#10B981]/5 px-4 py-3 space-y-2">
                    <div className="text-[11px] font-bold font-montserrat uppercase tracking-wider text-[#10B981]">
                      🔍 Lien de vérification (ce que contient le QR Code du PDF)
                    </div>
                    <div className="text-sm font-mono font-semibold text-slate-900 dark:text-white break-all">
                      {`${typeof window !== 'undefined' ? window.location.origin : ''}/#verify?token=${viewingToken.cryptoToken}`}
                    </div>
                  </div>

                  {/* Jeton brut — sélectionnable + copie 1 clic */}
                  <div>
                    <div className="text-[11px] font-bold font-montserrat uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      Jeton complet (collez-le dans « Vérification » ou scannez le QR du billet)
                    </div>
                    <textarea
                      readOnly
                      value={viewingToken.cryptoToken}
                      rows={6}
                      onFocus={(e) => e.currentTarget.select()}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-[#121212] border-2 border-slate-300 dark:border-[#2A2A2A] focus:border-[#E50914] rounded-lg text-base font-mono font-semibold text-slate-900 dark:text-white break-all outline-none resize-none"
                    />
                    <button
                      onClick={() => {
                        void navigator.clipboard?.writeText(viewingToken.cryptoToken || '').catch(() => {});
                        setActionSuccessMessage('Jeton cryptographique copié dans le presse-papiers ✅');
                      }}
                      className="mt-3 px-6 py-3 text-base font-bold font-montserrat text-white bg-[#E50914] hover:bg-[#C80711] rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-lg w-full sm:w-auto justify-center"
                    >
                      <Copy className="w-5 h-5" />
                      <span>COPIER LE JETON COMPLET</span>
                    </button>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Astuce contrôle d'accès : scannez simplement le QR du billet du participant dans l'onglet Scanner — le jeton se colle et se vérifie automatiquement.
                  </div>
                </>
              ) : (
                <div className="text-sm text-amber-600 dark:text-amber-400 font-semibold">
                  Aucun jeton cryptographique sur ce dossier. Re-confirmez le paiement pour en émettre un.
                </div>
              )}
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
                  Lien cryptographiquement signé (HMAC-SHA256) · Auto-expiration : 60 secondes
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
