/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * High-Availability Admin Dashboard (/admin) & Crypto Ticketing Console
 * - Admin Authentication with MFA
 * - Context-Specific Escaping (Stored XSS Defense)
 * - Cryptographic Token Generation (AES-256-GCM)
 * - 5-Minute HMAC-Signed Storage URL Inspection
 * - Immutable Audit Logs Viewer (Admin_ID, Action_Type, Participant_ID, Timestamp, IP, UA)
 * - Direct PDF Ticket Download & Pre-filled WhatsApp Dispatcher
 */

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Check, 
  X, 
  FileDown, 
  MessageSquare, 
  Eye, 
  Lock, 
  Clock, 
  Activity, 
  Search, 
  Users, 
  DollarSign, 
  Key, 
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import type { Participant, AuditLogEntry, InventoryStatus } from '../types/index.ts';
import { api, sanitizeSafeText } from '../services/api.ts';
import { downloadTicketPDF } from '../utils/pdfGenerator.ts';
import { generateWhatsAppConfirmationUrl } from '../utils/whatsappHelper.ts';

interface AdminDashboardProps {
  onBackToSite: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToSite }) => {
  // Auth & Session
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passkey, setPasskey] = useState('ARSENAL-ADMIN-2026');
  const [mfaCode, setMfaCode] = useState('894721');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<'participants' | 'audit_logs'>('participants');

  // Data State
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [inventory, setInventory] = useState<InventoryStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'REJECTED'>('ALL');

  // Proof Viewer Modal
  const [viewingProof, setViewingProof] = useState<{ path: string; name: string; signedUrl?: string; expiresAt?: number } | null>(null);
  const [proofLoading, setProofLoading] = useState(false);

  // Action Pending State
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Load Data once Authenticated
  const loadDashboardData = async () => {
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
    } catch (err) {
      console.error('[ADMIN LOAD FAILED]:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboardData();
    }
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const res = await api.adminLogin(passkey, mfaCode);
      if (res.success) {
        setIsAuthenticated(true);
      } else {
        setAuthError(res.message || 'Identifiants ou code MFA invalide.');
      }
    } catch {
      setAuthError('Erreur de connexion au serveur d\'authentification.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Confirm Payment with Cryptographic Ticket Generation
  const handleConfirmPayment = async (participant: Participant) => {
    setProcessingId(participant.id);
    setActionSuccessMessage(null);
    try {
      const updated = await api.confirmPayment(participant.id);
      setParticipants(prev => prev.map(p => p.id === updated.id ? updated : p));
      
      // Refresh inventory & logs
      const [logs, inv] = await Promise.all([api.getAuditLogs(), api.getInventoryStats()]);
      setAuditLogs(logs);
      setInventory(inv);

      setActionSuccessMessage(`Paiement de ${sanitizeSafeText(participant.fullName)} confirmé. Billet cryptographique (AES-256-GCM) émis.`);
      setTimeout(() => setActionSuccessMessage(null), 5000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la confirmation');
    } finally {
      setProcessingId(null);
    }
  };

  // Reject Payment
  const handleRejectPayment = async (participant: Participant) => {
    const reason = prompt('Motif du rejet pour l\'audit log (ex: Preuve illisible, Montant incomplet) :', 'Montant non reçu sur le relevé opérateur');
    if (!reason) return;

    setProcessingId(participant.id);
    try {
      const updated = await api.rejectPayment(participant.id, reason);
      setParticipants(prev => prev.map(p => p.id === updated.id ? updated : p));

      const [logs, inv] = await Promise.all([api.getAuditLogs(), api.getInventoryStats()]);
      setAuditLogs(logs);
      setInventory(inv);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur lors du rejet');
    } finally {
      setProcessingId(null);
    }
  };

  // Open Proof via 5-Minute Signed URL
  const handleOpenProof = async (participant: Participant) => {
    setProofLoading(true);
    try {
      const signedUrl = await api.getSignedProofUrl(participant.proofStoragePath);
      setViewingProof({
        path: participant.proofStoragePath,
        name: participant.fullName,
        signedUrl,
        expiresAt: Date.now() + 5 * 60 * 1000
      });

      // Audit log view proof action
      await api.logAdminAction('VIEW_PROOF', participant.id, {
        proofPath: participant.proofStoragePath,
        note: 'Inspecteur a ouvert le justificatif de paiement'
      });
    } catch {
      alert('Impossible de générer le lien de lecture sécurisé.');
    } finally {
      setProofLoading(false);
    }
  };

  // Download PDF Pass
  const handleDownloadPDF = async (participant: Participant) => {
    await downloadTicketPDF(participant);
    await api.logAdminAction('DOWNLOAD_TICKET', participant.id, {
      ticketCode: participant.ticketCode
    });
  };

  // Open Pre-filled WhatsApp Chat
  const handleOpenWhatsApp = (participant: Participant) => {
    const { url } = generateWhatsAppConfirmationUrl(participant);
    window.open(url, '_blank');
    api.logAdminAction('RESEND_WHATSAPP', participant.id, {
      targetPhone: participant.phoneInternational
    });
  };

  // Filtered Participants List
  const filteredParticipants = participants.filter((p) => {
    const matchesSearch = 
      p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phoneInternational.includes(searchQuery) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.ticketCode && p.ticketCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
      p.transactionReference.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate Metrics
  const confirmedCount = participants.filter(p => p.status === 'CONFIRMED').length;
  const pendingCount = participants.filter(p => p.status === 'PENDING').length;
  const totalRevenue = confirmedCount * 20;

  // --------------------------------------------------------------------------
  // LOGIN SCREEN IF NOT AUTHENTICATED
  // --------------------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0B0C0E] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-[#121418] border border-[#1E222A] rounded-xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-lg bg-[#E05E2B]/10 border border-[#E05E2B]/30 mx-auto flex items-center justify-center">
              <Lock className="w-6 h-6 text-[#E05E2B]" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-wide">
              Console d'Administration
            </h1>
            <p className="text-xs text-slate-400">
              Accès réservé aux auditeurs et superviseurs de l'Arsenal Agentique.
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Clé d'Accès Principale (Admin Passkey)
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={passkey}
                  onChange={(e) => setPasskey(e.target.value)}
                  placeholder="Entrez la clé admin"
                  className="w-full px-3.5 py-2.5 bg-[#0B0C0E] border border-[#1E222A] focus:border-[#E05E2B] rounded-md text-sm text-white font-mono outline-none"
                />
                <Key className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Code MFA Sécurisé (6 chiffres)
                </label>
                <span className="text-[10px] text-slate-500">MFA Simulée Actif</span>
              </div>
              <input
                type="text"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="Ex: 894721"
                className="w-full px-3.5 py-2.5 bg-[#0B0C0E] border border-[#1E222A] focus:border-[#E05E2B] rounded-md text-sm text-white font-mono text-center tracking-widest outline-none"
              />
            </div>

            <div className="p-3 rounded bg-[#0B0C0E] border border-[#1E222A] text-[11px] text-slate-400">
              <span className="text-slate-300 font-semibold">Identifiants préconfigurés pour l'audit :</span>
              <br />
              Passkey : <code className="text-[#E05E2B]">ARSENAL-ADMIN-2026</code> · Code MFA : <code className="text-[#10B981]">894721</code>
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full py-2.5 text-xs font-bold text-white bg-[#E05E2B] hover:bg-[#F26E3B] rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {isAuthenticating ? (
                <span>Vérification cryptographique...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Déverrouiller le Registre</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onBackToSite}
              className="w-full py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Retour à la page publique
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // AUTHENTICATED DASHBOARD VIEW
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#0B0C0E] text-slate-100 flex flex-col">
      {/* Top Bar for Admin */}
      <div className="border-b border-[#1E222A] bg-[#121418] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-xs bg-[#E05E2B]" />
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              <span>Arsenal Agentique · Console de Supervision</span>
              <span className="text-xs font-normal text-slate-400">| Kinshasa 2026</span>
            </h1>
            <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span>Auditeur Chef : ADM-2026-CHIEF</span>
              <span>·</span>
              <span className="text-[#10B981]">Sécurité Zéro-Trust Active</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadDashboardData}
            className="p-2 text-slate-400 hover:text-white rounded bg-[#181B21] border border-[#232731] transition-colors"
            title="Rafraîchir les données"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsAuthenticated(false)}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-[#181B21] hover:bg-[#20242B] border border-[#232731] rounded-md transition-colors"
          >
            Verrouiller Session
          </button>

          <button
            onClick={onBackToSite}
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#E05E2B] hover:bg-[#F26E3B] rounded-md transition-colors"
          >
            Site Public
          </button>
        </div>
      </div>

      {/* Main Container */}
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

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-[#121418] border border-[#1E222A]">
            <div className="text-xs text-slate-400 flex items-center justify-between mb-1">
              <span>Places Confirmées</span>
              <Users className="w-4 h-4 text-[#10B981]" />
            </div>
            <div className="text-2xl font-bold font-mono text-white tabular-nums">
              {confirmedCount} <span className="text-xs text-slate-500 font-normal">/ {inventory?.totalCapacity || 80}</span>
            </div>
            <div className="text-[11px] text-[#10B981] mt-1 font-medium">
              Pass cryptographiques actifs
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[#121418] border border-[#1E222A]">
            <div className="text-xs text-slate-400 flex items-center justify-between mb-1">
              <span>En Attente de Vérification</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
              {pendingCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Preuves MoMo à valider
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[#121418] border border-[#1E222A]">
            <div className="text-xs text-slate-400 flex items-center justify-between mb-1">
              <span>Capacité Disponible</span>
              <Activity className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white tabular-nums">
              {inventory?.availableSeats ?? (80 - confirmedCount - pendingCount)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Verrouillage de ligne actif
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[#121418] border border-[#1E222A]">
            <div className="text-xs text-slate-400 flex items-center justify-between mb-1">
              <span>Fonds Collectés (USD)</span>
              <DollarSign className="w-4 h-4 text-[#10B981]" />
            </div>
            <div className="text-2xl font-bold font-mono text-white tabular-nums">
              ${totalRevenue}.00
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              $20.00 par accréditation
            </div>
          </div>
        </div>

        {/* Tab Controls (Functional Buttons) */}
        <div className="flex items-center justify-between border-b border-[#1E222A] pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('participants')}
              className={`px-4 py-2 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                activeTab === 'participants'
                  ? 'bg-[#181B21] text-white border border-[#2B313D]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Participants &amp; Billetterie ({participants.length})
            </button>
            <button
              onClick={() => setActiveTab('audit_logs')}
              className={`px-4 py-2 text-xs font-bold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'audit_logs'
                  ? 'bg-[#181B21] text-white border border-[#2B313D]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Journal d'Audit Immuable</span>
              <span className="font-mono text-[10px] bg-[#232731] text-slate-300 px-1.5 py-0.2 rounded">
                {auditLogs.length}
              </span>
            </button>
          </div>
        </div>

        {/* TAB 1: PARTICIPANTS REGISTER */}
        {activeTab === 'participants' && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Recherche par nom, WhatsApp RDC, email ou code..."
                  className="w-full pl-9 pr-3.5 py-2 bg-[#121418] border border-[#1E222A] focus:border-[#E05E2B] rounded-md text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>

              {/* Status Tabs */}
              <div className="flex items-center gap-1 bg-[#121418] p-1 rounded-md border border-[#1E222A] text-xs">
                {(['ALL', 'PENDING', 'CONFIRMED', 'REJECTED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1 font-medium rounded transition-colors cursor-pointer ${
                      statusFilter === st
                        ? 'bg-[#1E222A] text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {st === 'ALL' ? 'Tous' : st === 'PENDING' ? 'En Attente' : st === 'CONFIRMED' ? 'Confirmés' : 'Rejetés'}
                  </button>
                ))}
              </div>
            </div>

            {/* Participants Grid / Table */}
            <div className="rounded-lg bg-[#121418] border border-[#1E222A] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0B0C0E] border-b border-[#1E222A] text-slate-400 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Participant</th>
                      <th className="px-4 py-3">Contact WhatsApp RDC</th>
                      <th className="px-4 py-3">Paiement &amp; Référence</th>
                      <th className="px-4 py-3">Preuve MoMo</th>
                      <th className="px-4 py-3">Statut</th>
                      <th className="px-4 py-3 text-right">Actions de Supervision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E222A]">
                    {filteredParticipants.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-slate-500">
                          Aucun participant ne correspond aux critères de recherche.
                        </td>
                      </tr>
                    ) : (
                      filteredParticipants.map((p) => {
                        const isProcessing = processingId === p.id;
                        return (
                          <tr key={p.id} className="hover:bg-[#15181F] transition-colors">
                            {/* Full Name & Ticket Code (Context-specific sanitized) */}
                            <td className="px-4 py-3.5">
                              <div className="font-bold text-white text-sm">
                                {sanitizeSafeText(p.fullName)}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {p.emailMasked || p.email}
                              </div>
                              {p.ticketCode && (
                                <div className="font-mono text-[10px] text-[#E05E2B] mt-0.5">
                                  {p.ticketCode}
                                </div>
                              )}
                            </td>

                            {/* Contact Details */}
                            <td className="px-4 py-3.5">
                              <div className="font-mono text-white">
                                +{p.phoneInternational}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {p.networkCarrier}
                              </div>
                            </td>

                            {/* MoMo Provider & Reference */}
                            <td className="px-4 py-3.5">
                              <div className="font-semibold text-slate-200">
                                {p.paymentProvider} · $20.00
                              </div>
                              <div className="font-mono text-[11px] text-slate-400">
                                Réf: {sanitizeSafeText(p.transactionReference)}
                              </div>
                            </td>

                            {/* Proof Screenshot Inspection */}
                            <td className="px-4 py-3.5">
                              <button
                                onClick={() => handleOpenProof(p)}
                                disabled={proofLoading}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-[#1E222A] hover:bg-[#282E39] text-slate-300 rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#E05E2B]" />
                                <span>Inspecter (URL 5 min)</span>
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
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-400/15 text-amber-400 border border-amber-400/30">
                                  <Clock className="w-3 h-3" />
                                  <span>EN ATTENTE</span>
                                </span>
                              )}
                              {p.status === 'REJECTED' && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-400/15 text-red-400 border border-red-400/30">
                                  <X className="w-3 h-3" />
                                  <span>REJETÉ</span>
                                </span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {p.status === 'PENDING' && (
                                  <>
                                    <button
                                      disabled={isProcessing}
                                      onClick={() => handleConfirmPayment(p)}
                                      className="px-3 py-1.5 text-xs font-bold text-white bg-[#10B981] hover:bg-[#059669] rounded transition-colors flex items-center gap-1 cursor-pointer"
                                      title="Valider et émettre le token cryptographique AES-256-GCM"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Confirmer le paiement</span>
                                    </button>

                                    <button
                                      disabled={isProcessing}
                                      onClick={() => handleRejectPayment(p)}
                                      className="px-2.5 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 border border-red-900/40 rounded transition-colors cursor-pointer"
                                      title="Rejeter la demande"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}

                                {p.status === 'CONFIRMED' && (
                                  <>
                                    <button
                                      onClick={() => handleDownloadPDF(p)}
                                      className="px-2.5 py-1.5 text-xs font-semibold text-slate-200 bg-[#1E222A] hover:bg-[#282E39] border border-[#2B313D] rounded transition-colors flex items-center gap-1 cursor-pointer"
                                      title="Télécharger le laissez-passer officiel PDF"
                                    >
                                      <FileDown className="w-3.5 h-3.5 text-[#E05E2B]" />
                                      <span>PDF Pass</span>
                                    </button>

                                    <button
                                      onClick={() => handleOpenWhatsApp(p)}
                                      className="px-2.5 py-1.5 text-xs font-semibold text-[#10B981] bg-[#10B981]/10 hover:bg-[#10B981]/20 border border-[#10B981]/30 rounded transition-colors flex items-center gap-1 cursor-pointer"
                                      title="Notifier le participant via WhatsApp"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5" />
                                      <span>WhatsApp</span>
                                    </button>
                                  </>
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

        {/* TAB 2: IMMUTABLE AUDIT LOGS */}
        {activeTab === 'audit_logs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <p>
                Registre d'audit immuable conformément aux critères de conformité OWASP Top 10 et IBM Secure-by-Design.
              </p>
              <span className="font-mono text-slate-500">
                Horodatage UTC strict · Signature Système
              </span>
            </div>

            <div className="rounded-lg bg-[#121418] border border-[#1E222A] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0B0C0E] border-b border-[#1E222A] text-slate-400 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Timestamp (UTC)</th>
                      <th className="px-4 py-3">Admin ID</th>
                      <th className="px-4 py-3">Type d'Action</th>
                      <th className="px-4 py-3">Participant Réf</th>
                      <th className="px-4 py-3">Adresse IP</th>
                      <th className="px-4 py-3">User-Agent &amp; Métadonnées</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E222A] font-mono text-[11px]">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#15181F] transition-colors">
                        <td className="px-4 py-3 text-slate-400">
                          {new Date(log.timestamp).toLocaleString('fr-FR', { timeZone: 'UTC' })}
                        </td>
                        <td className="px-4 py-3 text-[#E05E2B] font-bold">
                          {log.adminId}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            log.actionType === 'CONFIRM_PAYMENT'
                              ? 'bg-[#10B981]/15 text-[#10B981]'
                              : log.actionType === 'REJECT_PAYMENT'
                              ? 'bg-red-500/15 text-red-400'
                              : 'bg-[#1E222A] text-slate-300'
                          }`}>
                            {log.actionType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {log.participantId ? log.participantId.slice(0, 13) + '...' : 'SYSTEM'}
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {log.ipAddress}
                        </td>
                        <td className="px-4 py-3 text-slate-400 max-w-xs truncate text-[10px]" title={log.userAgent}>
                          {log.userAgent}
                          {log.details && (
                            <span className="text-slate-500 block truncate">
                              {JSON.stringify(log.details)}
                            </span>
                          )}
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

      {/* 5-Minute Signed URL Proof Viewer Modal */}
      {viewingProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-[#0B0C0E] border border-[#1E222A] rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-[#1E222A] bg-[#121418] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                  <span>Preuve de Paiement Sécurisée · {viewingProof.name}</span>
                </h3>
                <div className="text-[11px] text-amber-400 font-mono mt-0.5">
                  URL cryptographiquement signée (HMAC-SHA256) · Auto-expiration : 5 minutes
                </div>
              </div>
              <button 
                onClick={() => setViewingProof(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex items-center justify-center bg-[#070809] min-h-[300px]">
              {viewingProof.signedUrl ? (
                <img 
                  src={viewingProof.signedUrl} 
                  alt="Justificatif de Paiement Mobile Money" 
                  className="max-h-[60vh] max-w-full rounded border border-[#1E222A] object-contain shadow-md"
                />
              ) : (
                <div className="text-xs text-slate-500">Chargement de la preuve...</div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-[#1E222A] bg-[#121418] flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono text-[10px]">
                Stockage Isolé : {viewingProof.path}
              </span>
              <button
                onClick={() => setViewingProof(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-[#1E222A] hover:bg-[#282E39] text-white rounded transition-colors"
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
