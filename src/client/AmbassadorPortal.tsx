/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PIGA STUDIO — Espace Ambassadeur (Armée de Distribution)
 * Page publique 100% décorrélée de la console Direction :
 * - Recrutement : mini-formulaire → code d'affiliation + lien magique instantané
 * - Tableau de bord (via lien magique /#ambassadeur?ref=AMB-XXXX) :
 *     statistiques en direct (clics, ventes validées, gains), gamification,
 *     Kit de Survie Marketing prêt-à-copier avec le lien déjà injecté.
 */

import React, { useState, useEffect } from 'react';
import {
  Megaphone,
  ArrowLeft,
  Check,
  Copy,
  TrendingUp,
  Users,
  DollarSign,
  MousePointerClick,
  Award,
  Download,
  Share2,
  MessageSquare,
  Crown,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Bell
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PigaLogo } from '../components/PigaLogo.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';
import { api } from '../services/api.ts';
import { subscribeWebPush } from '../utils/pwaNotifications.ts';
import type { Ambassador, AmbassadorPortalView } from '../types/index.ts';
import {
  buildAmbassadorKitScripts,
  buildAmbassadorMagicUrl,
  buildWhatsAppShareUrl,
  generateAmbassadorOnboardingMessage
} from '../utils/ambassadorKit.ts';

interface AmbassadorPortalProps {
  onBackToClient: () => void;
  /** Code pré-rempli si le lien magique est déjà connu (?ref=) */
  initialRef?: string | null;
}

export const AmbassadorPortal: React.FC<AmbassadorPortalProps> = ({ onBackToClient, initialRef }) => {
  const [mode, setMode] = useState<'recruit' | 'dashboard'>(initialRef ? 'dashboard' : 'recruit');
  const [portalView, setPortalView] = useState<AmbassadorPortalView | null>(null);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Recrutement
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recruitError, setRecruitError] = useState<string | null>(null);
  const [newAmbassador, setNewAmbassador] = useState<Ambassador | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  // Notifications push temps réel (ventes validées)
  const [pushState, setPushState] = useState<'unknown' | 'off' | 'on' | 'unsupported'>('unknown');
  const [isEnablingPush, setIsEnablingPush] = useState(false);

  // Copie
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [linkCodeInput, setLinkCodeInput] = useState('');

  const magicUrl = portalView || newAmbassador
    ? buildAmbassadorMagicUrl((portalView?.ambassador.code) || newAmbassador?.code || '')
    : '';
  const formation = portalView?.formation;
  const scripts = formation && portalView
    ? buildAmbassadorKitScripts(magicUrl, formation)
    : null;

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      setCopiedKey(null);
    }
  };

  // Chargement du tableau de bord via le code
  const loadPortal = async (code: string) => {
    setIsLoading(true);
    setPortalError(null);
    try {
      const view = await api.getAmbassadorPortalView(code.trim().toUpperCase());
      if (!view) {
        setPortalError('Code ambassadeur introuvable. Vérifiez votre lien magique ou contactez la Direction.');
        setPortalView(null);
        setMode('recruit');
        return;
      }
      setPortalView(view);
      setMode('dashboard');

      // Notifications push : statut du terminal courant
      try {
        const keyRes = await fetch('/api/push/public-key');
        const keyData = await keyRes.json();
        if (!keyData.enabled || !('PushManager' in window)) {
          setPushState('unsupported');
        } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          setPushState(sub ? 'on' : 'off');
        } else {
          setPushState('off');
        }
      } catch {
        setPushState('off');
      }

      // Gamification : confettis si de nouvelles ventes validées depuis la dernière visite
      const seenKey = `piga_amb_seen_${view.ambassador.code}`;
      const lastSeen = Number(sessionStorage.getItem(seenKey) ?? '0');
      if (view.stats.validatedSales > lastSeen && lastSeen > 0) {
        confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 }, colors: ['#E50914', '#10B981', '#FFFFFF'] });
      }
      sessionStorage.setItem(seenKey, String(view.stats.validatedSales));
    } catch {
      setPortalError('Erreur de communication avec le serveur PIGA STUDIO.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialRef && !portalView) {
      void loadPortal(initialRef);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Activation des push temps réel pour ce code ambassadeur
  const handleEnablePush = async () => {
    if (!portalView) return;
    setIsEnablingPush(true);
    try {
      const result = await subscribeWebPush('AMBASSADOR', portalView.ambassador.code);
      setPushState(result.ok ? 'on' : 'off');
      setCopiedKey(null);
      if (result.ok) {
        setPortalError(null);
        setActionNotice(result.message);
        setTimeout(() => setActionNotice(null), 6000);
      } else {
        setPortalError(result.message);
      }
    } finally {
      setIsEnablingPush(false);
    }
  };

  // Recrutement public : création instantanée du code + lien magique
  const handleRecruitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      setRecruitError('Vous devez accepter les conditions de commission pour vous enrôler.');
      return;
    }
    setIsSubmitting(true);
    setRecruitError(null);
    try {
      const result = await api.registerAmbassador(fullName.trim(), email.trim(), phone.trim(), true);
      if (!result.success || !result.ambassador) {
        setRecruitError(result.message || 'Échec de la candidature.');
        return;
      }
      setNewAmbassador(result.ambassador);
      setAlreadyRegistered(Boolean(result.alreadyRegistered));
      confetti({ particleCount: 110, spread: 80, origin: { y: 0.6 }, colors: ['#E50914', '#10B981', '#FFFFFF'] });
      await loadPortal(result.ambassador.code);
    } catch (err: unknown) {
      setRecruitError(err instanceof Error ? err.message : 'Échec de la candidature.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-slate-100 font-inter transition-colors duration-200">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-[#1E1E1E] bg-white dark:bg-[#0A0A0A] px-6 py-4 flex items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <PigaLogo variant="compact" size="sm" />
          <div className="border-l border-slate-200 dark:border-[#222222] pl-3">
            <h1 className="text-sm font-bold font-montserrat text-slate-900 dark:text-white">
              Espace Ambassadeur
            </h1>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Armée de Distribution PIGA STUDIO · 15% par vente validée
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle size="sm" />
          <button
            onClick={onBackToClient}
            className="px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white bg-slate-200 hover:bg-slate-300 dark:bg-[#1E1E1E] dark:hover:bg-[#282828] border border-slate-300 dark:border-[#333333] rounded-md transition-colors cursor-pointer"
          >
            Accueil
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {portalError && (
          <div className="p-3.5 rounded-md bg-red-100 dark:bg-red-950/30 border border-red-300 dark:border-red-900/60 text-xs text-red-800 dark:text-red-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{portalError}</span>
          </div>
        )}

        {/* ================================================================ */}
        {/* MODE RECRUTEMENT (public) */}
        {/* ================================================================ */}
        {mode === 'recruit' && !newAmbassador && (
          <div className="space-y-6 animate-fade-in">
            <div className="p-6 rounded-xl bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] space-y-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-[#E50914]/10 border border-[#E50914]/30 flex items-center justify-center">
                  <Megaphone className="w-5 h-5 text-[#E50914]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-montserrat text-slate-900 dark:text-white">
                    Devenir Ambassadeur Officiel PIGA STUDIO
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Rejoins l'Armée de Distribution : 15% de commission ($3) par ticket de $20 validé, statut officiel, accès prioritaire aux futures activités.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-[#FAFAF9] dark:bg-[#0E0E0E] border border-slate-200 dark:border-[#1E1E1E]">
                  <div className="text-[#10B981] font-bold font-mono text-sm">$3 / vente</div>
                  <div className="text-slate-500 mt-0.5">Commission automatique, zéro litige</div>
                </div>
                <div className="p-3 rounded-lg bg-[#FAFAF9] dark:bg-[#0E0E0E] border border-slate-200 dark:border-[#1E1E1E]">
                  <div className="text-[#E50914] font-bold font-mono text-sm">Suivi en direct</div>
                  <div className="text-slate-500 mt-0.5">Clics, ventes, gains sur ton tableau de bord</div>
                </div>
                <div className="p-3 rounded-lg bg-[#FAFAF9] dark:bg-[#0E0E0E] border border-slate-200 dark:border-[#1E1E1E]">
                  <div className="text-slate-900 dark:text-white font-bold font-mono text-sm">Kit Officiel</div>
                  <div className="text-slate-500 mt-0.5">Scripts + visuel prêts à partager</div>
                </div>
              </div>

              <form onSubmit={handleRecruitSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 font-montserrat">
                    Nom Complet <span className="text-[#E50914]">*</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: Christelle Kabedi"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#262626] focus:border-[#E50914] rounded-md text-sm text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 font-montserrat">
                      Numéro WhatsApp RDC <span className="text-[#E50914]">*</span>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ex: 0803240289 ou +243..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#262626] focus:border-[#E50914] rounded-md text-sm text-slate-900 dark:text-white outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 font-montserrat">
                      Adresse E-mail <span className="text-[#E50914]">*</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Ex: ambassadeur@exemple.cd"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#262626] focus:border-[#E50914] rounded-md text-sm text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                </div>

                {/* Condition d'acceptation obligatoire — cycle de vie de la commission */}
                <label className={`flex items-start gap-3 p-3.5 rounded-md border transition-colors cursor-pointer ${
                  termsAccepted
                    ? 'bg-[#10B981]/10 border-[#10B981]/40'
                    : 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60'
                }`}>
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 cursor-pointer accent-[#E50914]"
                  />
                  <span className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                    <strong>Conditions de commission (obligatoire)</strong> — Je reconnais que ma commission (15 %) sera
                    versée <strong>uniquement</strong> : (1) après la <strong>confirmation du paiement Orange Money</strong> de
                    mon affilié par la Direction PIGA STUDIO, et (2) après un <strong>délai de traitement de 48 heures</strong>
                    {' '}suivant ce paiement, laissé au système pour le contrôle des preuves et d'éventuelles réclamations.
                    Toute inscription annulée (rejet/révocation) entraîne l'annulation de la commission correspondante.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting || !termsAccepted || fullName.trim().length < 3 || !email.includes('@') || phone.trim().length < 8}
                  className="w-full py-3 text-xs font-bold font-montserrat text-white bg-[#E50914] hover:bg-[#C80711] disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#E50914]/20 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Enrôlement en cours…' : (
                    <>
                      <Award className="w-4 h-4" />
                      <span>Devenir Ambassadeur Officiel</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Déjà enrôlé ? Accès au tableau de bord par code */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] space-y-2.5 shadow-xs">
              <div className="text-xs font-bold font-montserrat text-slate-900 dark:text-white uppercase tracking-wider">
                Déjà ambassadeur ? Accède à ton tableau de bord
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={linkCodeInput}
                  onChange={(e) => setLinkCodeInput(e.target.value)}
                  placeholder="Ton code (ex: AMB-K3X9)"
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#262626] focus:border-[#E50914] rounded-md text-xs text-slate-900 dark:text-white font-mono outline-none uppercase"
                />
                <button
                  onClick={() => linkCodeInput.trim() && loadPortal(linkCodeInput.trim())}
                  disabled={isLoading || !linkCodeInput.trim()}
                  className="px-5 py-2.5 text-xs font-bold font-montserrat text-white bg-slate-900 dark:bg-white dark:text-black hover:opacity-90 disabled:opacity-50 rounded-md transition-colors cursor-pointer"
                >
                  {isLoading ? 'Chargement…' : 'Ouvrir'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* MODE DASHBOARD (lien magique) */}
        {/* ================================================================ */}
        {mode === 'dashboard' && portalView && (
          <div className="space-y-6 animate-fade-in">
            {/* Bandeau statut */}
            <div className="p-5 rounded-xl bg-gradient-to-r from-[#0A0A0A] to-[#1A1A1A] border border-[#E50914]/40 text-white space-y-2 shadow-lg">
              <div className="flex items-center gap-2 text-[#E50914] text-[10px] font-bold font-montserrat uppercase tracking-wider">
                <Crown className="w-3.5 h-3.5" />
                <span>Membre Officiel de l'Armée de Distribution PIGA STUDIO</span>
              </div>
              <div className="text-lg font-black font-montserrat">{portalView.ambassador.fullName}</div>
              <div className="text-xs text-slate-300">
                Commission : <strong className="text-[#E50914]">{Math.round(portalView.ambassador.commissionRate * 100)}%</strong>
                {' '}({portalView.ambassador.commissionPerSaleUsd.toFixed(2)} $ par ticket de {portalView.formation.ticketPriceUsd.toFixed(2)} $ validé)
                · Code : <span className="font-mono text-white">{portalView.ambassador.code}</span>
              </div>
            </div>

            {/* Notifications push temps réel (ventes validées) */}
            {pushState !== 'unsupported' && (
              <div className="p-4 rounded-xl bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${
                    pushState === 'on' ? 'bg-[#10B981]/10 border-[#10B981]/30' : 'bg-[#E50914]/10 border-[#E50914]/30'
                  }`}>
                    <Bell className={`w-5 h-5 ${pushState === 'on' ? 'text-[#10B981]' : 'text-[#E50914]'}`} />
                  </div>
                  <div>
                    <div className="text-xs font-bold font-montserrat text-slate-900 dark:text-white">
                      Alertes ventes temps réel {pushState === 'on' && <span className="text-[#10B981]">· ACTIVES</span>}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Reçois une notification dès qu'une vente est validée avec ton code (commission enregistrée).
                    </div>
                  </div>
                </div>
                {pushState !== 'on' && (
                  <button
                    onClick={handleEnablePush}
                    disabled={isEnablingPush}
                    className="px-4 py-2.5 text-xs font-bold font-montserrat text-white bg-[#E50914] hover:bg-[#C80711] disabled:opacity-50 rounded-md transition-colors flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    <Bell className="w-4 h-4" />
                    <span>{isEnablingPush ? 'Activation…' : 'Activer les alertes'}</span>
                  </button>
                )}
              </div>
            )}

            {/* Performances en direct */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] shadow-xs">
                <div className="text-[10px] font-bold font-montserrat uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <MousePointerClick className="w-3.5 h-3.5 text-[#E50914]" />
                  <span>Clics sur ton lien</span>
                </div>
                <div className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                  {portalView.stats.clicks}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 shadow-xs">
                <div className="text-[10px] font-bold font-montserrat uppercase tracking-wider text-[#10B981] flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>Ventes validées</span>
                </div>
                <div className="text-2xl font-black font-mono tabular-nums text-[#10B981] mt-1">
                  {portalView.stats.validatedSales}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] shadow-xs">
                <div className="text-[10px] font-bold font-montserrat uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>En instance</span>
                </div>
                <div className="text-2xl font-black font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
                  {portalView.stats.pendingSales}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#E50914]/10 border border-[#E50914]/30 shadow-xs">
                <div className="text-[10px] font-bold font-montserrat uppercase tracking-wider text-[#E50914] flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Gains accumulés</span>
                </div>
                <div className="text-2xl font-black font-mono tabular-nums text-[#E50914] mt-1">
                  ${portalView.stats.earnedUsd.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-mono">
                  Payables : ${portalView.toPayUsd.toFixed(2)} · Délai 48h : ${portalView.stats.inHoldUsd.toFixed(2)} · Versés : ${portalView.paidUsd.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Lien magique */}
            <div className="p-5 rounded-xl bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] space-y-3 shadow-xs">
              <div className="text-xs font-bold font-montserrat text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-[#E50914]" />
                <span>Ton lien magique de suivi</span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch gap-2">
                <code className="flex-1 px-3 py-2.5 rounded bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#262626] text-xs font-mono text-[#E50914] break-all">
                  {magicUrl}
                </code>
                <button
                  onClick={() => copyText('link', magicUrl)}
                  className="px-4 py-2.5 text-xs font-bold font-montserrat text-white bg-[#E50914] hover:bg-[#C80711] rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Copy className="w-4 h-4" />
                  <span>{copiedKey === 'link' ? 'Copié !' : 'Copier le lien'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Chaque inscription passée par ce lien est automatiquement rattachée à toi — commission enregistrée dès validation Orange Money par la Direction.
              </p>
            </div>

            {/* Kit de Survie Marketing */}
            {scripts && (
              <div className="rounded-xl bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] overflow-hidden shadow-xs">
                <div className="px-5 py-4 bg-slate-50 dark:bg-[#050505] border-b border-slate-200 dark:border-[#1E1E1E] flex items-center justify-between">
                  <div className="text-xs font-bold font-montserrat text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#E50914]" />
                    <span>Kit de Survie Marketing (Prêt-à-partager)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {formation?.heroImageUrl && (
                      <a
                        href={formation.heroImageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#161616] border border-slate-300 dark:border-[#2A2A2A] rounded flex items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-[#222222] transition-colors cursor-pointer"
                        title="Visuel officiel du Workshop"
                      >
                        <Download className="w-3.5 h-3.5 text-[#E50914]" />
                        <span>Visuel officiel</span>
                      </a>
                    )}
                    {scripts.status && (
                      <a
                        href={buildWhatsAppShareUrl(scripts.status.text)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-[11px] font-semibold text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/30 rounded flex items-center gap-1.5 hover:bg-[#10B981]/20 transition-colors cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Partager</span>
                      </a>
                    )}
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  {Object.values(scripts).map((script) => (
                    <div key={script.label} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] font-bold font-montserrat text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          {script.label}
                        </div>
                        <button
                          onClick={() => copyText(script.label, script.text)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-[#E50914] bg-[#E50914]/10 border border-[#E50914]/30 rounded flex items-center gap-1.5 hover:bg-[#E50914]/20 transition-colors cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedKey === script.label ? 'Copié !' : 'Copier le script'}</span>
                        </button>
                      </div>
                      <pre className="whitespace-pre-wrap text-[11px] font-inter text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#1E1E1E] rounded-md p-3 leading-relaxed">
                        {script.text}
                      </pre>
                    </div>
                  ))}
                  <div className="p-3 rounded bg-[#E50914]/5 border border-[#E50914]/25 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#E50914] shrink-0 mt-0.5" />
                    <span>
                      Ton lien d'affiliation est déjà injecté dans chaque script. Partage tel quel — la Direction reçoit la confirmation de chaque vente rattachée à ton code.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* CTA retour inscription (inviter son réseau) */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={onBackToClient}
                className="px-5 py-2.5 text-xs font-bold font-montserrat text-slate-800 dark:text-white bg-slate-200 hover:bg-slate-300 dark:bg-[#1E1E1E] dark:hover:bg-[#282828] border border-slate-300 dark:border-[#333333] rounded-md transition-colors flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voir le Workshop</span>
              </button>
              <button
                onClick={() => { setPortalView(null); setNewAmbassador(null); setMode('recruit'); }}
                className="px-5 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Candidater pour un proche</span>
              </button>
            </div>
          </div>
        )}

        {/* Renvoi du kit après enrôlement instantané (avant chargement portal) */}
        {newAmbassador && !portalView && (
          <div className="p-4 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 text-xs space-y-2">
            <div className="font-bold text-[#10B981] flex items-center gap-2">
              <Check className="w-4 h-4" />
              {alreadyRegistered ? 'Tu es déjà ambassadeur officiel !' : 'Bienvenue dans l\'Armée de Distribution PIGA STUDIO !'}
            </div>
            <div className="font-mono text-sm text-slate-900 dark:text-white">Code : {newAmbassador.code}</div>
            <button
              onClick={() => copyText('onboarding', generateAmbassadorOnboardingMessage(newAmbassador))}
              className="text-[#E50914] font-semibold hover:underline cursor-pointer"
            >
              {copiedKey === 'onboarding' ? 'Message d\'onboarding copié !' : 'Copier mon message d\'onboarding WhatsApp'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
