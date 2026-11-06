/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PIGA STUDIO — Re-engineered 3-Step Client Onboarding Modal
 * Full Light (#FFFFFF) & Dark (#000000) Mode Support
 * - Step 1: Profiling & DRC Phone Sanitization (blocks on invalid format)
 * - Step 2: Contrat DNA & IP (PIGA STUDIO Intellectual Property & Non-Disclosure)
 * - Step 3: Paiement Exclusif Orange Money (+243 803 240 289) & Capture d'écran Orange Money
 * - On Submit: Triggers Web Push Notification to Admin PWA and generates official PDF Pass
 */

import React, { useState } from 'react';
import { X, Check, AlertCircle, Upload, ShieldCheck, ArrowRight, ArrowLeft, FileDown, MessageSquare, Copy, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cleanAndValidateDRCPhone } from '../utils/drcPhoneValidator.ts';
import { api } from '../services/api.ts';
import { triggerNativePushNotification } from '../utils/pwaNotifications.ts';
import { 
  PIGA_ORANGE_MONEY_DISPLAY, 
  PIGA_ORANGE_MONEY_NUMBER,
  PIGA_DIRECTION_EMAIL, 
  PIGA_DIRECTION_PHONE_LOCAL,
  generateWhatsAppConfirmationUrl
} from '../utils/whatsappHelper.ts';
import { downloadTicketPDF } from '../utils/pdfGenerator.ts';
import type { RegistrationResponse, Participant, ProgramConfig } from '../types/index.ts';

interface ClientOnboardingModalProps {
  programConfig?: ProgramConfig;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Canvas compression pipeline for Orange Money proof screenshots.
 * Vercel serverless functions cap the request body at ~4.5 MB: raw phone
 * screenshots (up to 10 MB) would silently fail on production. This keeps
 * the evidence readable (recto of the transfer receipt) at a deploy-safe size.
 */
async function compressImageFile(file: File, maxEdge = 1400, quality = 0.72): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read_failed'));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode_failed'));
    img.src = rawDataUrl;
  });

  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);

  const compressed = canvas.toDataURL('image/jpeg', quality);
  return compressed.length < rawDataUrl.length ? compressed : rawDataUrl;
}

export const ClientOnboardingModal: React.FC<ClientOnboardingModalProps> = ({
  programConfig,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Dynamic values from program configuration
  const ticketPrice = programConfig?.ticketPriceUsd !== undefined ? programConfig.ticketPriceUsd : 20.00;
  const orangeNumber = programConfig?.orangeMoneyNumber || PIGA_ORANGE_MONEY_DISPLAY;
  const orangeHolder = programConfig?.orangeMoneyHolder || 'PIGA STUDIO';
  const directionEmail = programConfig?.directionEmail || PIGA_DIRECTION_EMAIL;
  const directionPhone = programConfig?.directionPhone || PIGA_DIRECTION_PHONE_LOCAL;
  const programTitle = programConfig?.title || 'Arsenal Agentique';
  const dateDisplay = programConfig?.dateDisplay || '13 Novembre 2026';
  const ndaTitle = programConfig?.ndaTitle || 'ACCORD DE CONFIDENTIALITÉ & PROTECTION DES ACTIFS INTELLECTUELS (DNA & IP)';
  const ndaClauses = programConfig?.ndaClauses && programConfig.ndaClauses.length > 0
    ? programConfig.ndaClauses
    : [
        '1. Droits Exclusifs PIGA STUDIO : L’ensemble des architectures, scripts et supports dispensés constituent la propriété intellectuelle exclusive de PIGA STUDIO.',
        '2. Engagement de Non-Divulgation (DNA / NDA) : Le participant s’engage formellement à garder confidentielles les clés d’architectures et stratégies présentées.',
        '3. Éthique et Sécurité Offensive : Les connaissances transmises doivent être mobilisées exclusivement dans le cadre de la protection défensive.',
        '4. Révocation de Billet : Tout manquement à ces règles entraînera l’annulation immédiate du billet cryptographique AES-256-GCM sans remboursement.'
      ];

  // Step 1: Profiling
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneValidation, setPhoneValidation] = useState(cleanAndValidateDRCPhone(''));
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [showPrefixGuide, setShowPrefixGuide] = useState(false);

  // Step 2: Contrat DNA & IP
  const [dnaAccepted, setDnaAccepted] = useState(false);

  // Step 3: Orange Money Payment & Screenshot
  const [transactionRef, setTransactionRef] = useState('');
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submittedData, setSubmittedData] = useState<RegistrationResponse | null>(null);
  const [registeredParticipant, setRegisteredParticipant] = useState<Participant | null>(null);

  if (!isOpen) return null;

  const handlePhoneChange = (val: string) => {
    setPhoneInput(val);
    const res = cleanAndValidateDRCPhone(val);
    setPhoneValidation(res);
  };

  const isStep1Valid = fullName.trim().length >= 3 && 
                       email.includes('@') && email.includes('.') && 
                       phoneValidation.isValid;

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setSubmissionError('Seules les images (JPEG, PNG, WebP) de votre preuve Orange Money sont acceptées.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSubmissionError('Le fichier est trop lourd (limite : 10 Mo).');
      return;
    }

    setScreenshotName(file.name);
    setSubmissionError(null);

    // Vercel serverless cap le body JSON à ~4,5 Mo : on compresse systématiquement
    // la capture d'écran côté client (canvas -> JPEG, max 1400px, qualité 0.72)
    // afin de rester sous la limite même sur les gros screenshots Smartphone.
    try {
      const compressed = await compressImageFile(file);
      setScreenshotBase64(compressed);
    } catch {
      // Canvas indisponible (device exotique) : fallback sur lecture brute
      const reader = new FileReader();
      reader.onload = (e) => setScreenshotBase64(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleCopyNumber = () => {
    navigator.clipboard.writeText(orangeNumber.replace(/[^\d+]/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const response = await api.registerParticipant({
        fullName,
        email,
        phone: phoneValidation.formattedInternational,
        paymentProvider: 'ORANGE_MONEY',
        transactionReference: transactionRef,
        proofBase64: screenshotBase64 || undefined,
        proofFileName: screenshotName || 'capture_orangemoney.jpg',
        ndaAccepted: true
      });

      // Construct provisional participant object for immediate client PDF / WhatsApp
      const provisionalParticipant: Participant = {
        id: response.participantId || crypto.randomUUID(),
        fullName,
        email,
        emailMasked: email.slice(0, 2) + '***@' + email.split('@')[1],
        phoneRaw: phoneInput,
        phoneInternational: phoneValidation.formattedInternational,
        phoneMasked: '+' + phoneValidation.formattedInternational.slice(0, 5) + '***',
        networkCarrier: phoneValidation.carrier,
        status: 'PENDING',
        priceUsd: ticketPrice,
        paymentProvider: 'ORANGE_MONEY',
        transactionReference: transactionRef,
        proofFileName: screenshotName || 'capture_orangemoney.jpg',
        proofStoragePath: `proofs/2026-11-13/${response.participantId}.jpg`,
        ndaAccepted: true,
        ndaAcceptedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        ticketCode: response.ticketCode || 'PIGA-AA-2026-PENDING'
      };

      setSubmittedData(response);
      setRegisteredParticipant(provisionalParticipant);
      setCurrentStep(4);
      onSuccess();

      // Trigger Web Push Notification to Admin device bar!
      triggerNativePushNotification(
        'PIGA STUDIO · Nouveau Paiement Orange Money',
        `${fullName} a soumis une preuve Orange Money ($${ticketPrice.toFixed(2)} USD). Réf: ${transactionRef}`,
        { participantId: response.participantId, url: '/#admin' }
      );

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#E50914', '#FFFFFF', '#000000']
      });
    } catch (err: unknown) {
      setSubmissionError(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div 
        className="w-full max-w-2xl bg-white dark:bg-[#000000] border border-slate-200 dark:border-[#222222] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-colors duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header with PIGA STUDIO Badge */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-[#1E1E1E] flex items-center justify-between bg-slate-50 dark:bg-[#0A0A0A] transition-colors">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 bg-[#E50914] rounded-xs inline-block" />
            <div>
              <h2 className="text-base font-bold font-montserrat text-slate-900 dark:text-white tracking-wide">
                PIGA STUDIO · Inscription {programTitle}
              </h2>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-inter">
                Session : {dateDisplay} · Paiement exclusif Orange Money (${ticketPrice.toFixed(2)} USD)
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-md hover:bg-slate-200 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3-Step Navigation Tabs */}
        {currentStep < 4 && (
          <div className="px-6 py-3 border-b border-slate-200 dark:border-[#1E1E1E] bg-slate-100/70 dark:bg-[#070707] flex items-center justify-between text-xs font-semibold font-montserrat">
            <div className={`flex items-center gap-2 ${currentStep === 1 ? 'text-[#E50914]' : currentStep > 1 ? 'text-[#10B981]' : 'text-slate-400 dark:text-slate-500'}`}>
              <span className="font-mono">01.</span>
              <span>Profil &amp; WhatsApp RDC</span>
            </div>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <div className={`flex items-center gap-2 ${currentStep === 2 ? 'text-[#E50914]' : currentStep > 2 ? 'text-[#10B981]' : 'text-slate-400 dark:text-slate-500'}`}>
              <span className="font-mono">02.</span>
              <span>Contrat DNA &amp; IP</span>
            </div>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <div className={`flex items-center gap-2 ${currentStep === 3 ? 'text-[#E50914]' : 'text-slate-400 dark:text-slate-500'}`}>
              <span className="font-mono">03.</span>
              <span>Paiement Orange Money</span>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 font-inter text-slate-800 dark:text-slate-200">
          {submissionError && (
            <div className="p-3.5 rounded-md bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-800/60 text-red-800 dark:text-red-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <span>{submissionError}</span>
            </div>
          )}

          {/* STEP 1: PROFILING */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="space-y-1">
                <h3 className="text-lg font-bold font-montserrat text-slate-900 dark:text-white">Étape 1 : Coordonnées du Participant</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Votre numéro WhatsApp servira à la délivrance de votre laissez-passer cryptographique PIGA STUDIO.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Nom Complet &amp; Post-nom <span className="text-[#E50914]">*</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: Dieudonné Mwamba Ilunga"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0C0C0C] border border-slate-300 dark:border-[#222222] focus:border-[#E50914] rounded-md text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Adresse E-mail Professionnelle <span className="text-[#E50914]">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ex: d.mwamba@entreprise.cd"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0C0C0C] border border-slate-300 dark:border-[#222222] focus:border-[#E50914] rounded-md text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-colors"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Numéro WhatsApp RDC <span className="text-[#E50914]">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPrefixGuide(!showPrefixGuide)}
                      className="text-[11px] text-[#E50914] hover:underline font-medium cursor-pointer"
                    >
                      {showPrefixGuide ? 'Masquer les préfixes' : 'Voir les préfixes RDC (ARPTC)'}
                    </button>
                  </div>

                  {/* Official ARPTC DRC Operators Guide & Interactive Quick-Pills */}
                  {showPrefixGuide && (
                    <div className="mb-3 p-3 rounded-lg bg-slate-100 dark:bg-[#111111] border border-slate-300 dark:border-[#222222] text-xs space-y-2.5 animate-fade-in font-inter">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] flex items-center justify-between">
                        <span>Plan National Officiel (ARPTC) — Cliquez sur un préfixe :</span>
                        <span className="font-mono text-[10px] text-slate-500">9 ou 10 chiffres</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        {/* Vodacom */}
                        <div className="p-2 rounded bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#262626]">
                          <div className="font-bold text-emerald-600 dark:text-emerald-400 text-[10px] uppercase">
                            🟢 Vodacom
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {['081', '082', '083', '086'].map(pf => (
                              <button
                                key={pf}
                                type="button"
                                onClick={() => handlePhoneChange(pf)}
                                className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100 font-mono text-[10px] cursor-pointer"
                              >
                                {pf}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Orange */}
                        <div className="p-2 rounded bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#262626]">
                          <div className="font-bold text-orange-600 dark:text-orange-400 text-[10px] uppercase">
                            🟠 Orange
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {['080', '084', '085', '089'].map(pf => (
                              <button
                                key={pf}
                                type="button"
                                onClick={() => handlePhoneChange(pf)}
                                className="px-1.5 py-0.5 rounded bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/50 hover:bg-orange-100 font-mono text-[10px] cursor-pointer"
                              >
                                {pf}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Airtel */}
                        <div className="p-2 rounded bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#262626]">
                          <div className="font-bold text-red-600 dark:text-red-400 text-[10px] uppercase">
                            🔴 Airtel
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {['096', '097', '098', '099'].map(pf => (
                              <button
                                key={pf}
                                type="button"
                                onClick={() => handlePhoneChange(pf)}
                                className="px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50 hover:bg-red-100 font-mono text-[10px] cursor-pointer"
                              >
                                {pf}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Africell */}
                        <div className="p-2 rounded bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#262626]">
                          <div className="font-bold text-purple-600 dark:text-purple-400 text-[10px] uppercase">
                            🟣 Africell
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {['090', '091'].map(pf => (
                              <button
                                key={pf}
                                type="button"
                                onClick={() => handlePhoneChange(pf)}
                                className="px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 hover:bg-purple-100 font-mono text-[10px] cursor-pointer"
                              >
                                {pf}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200 dark:border-[#1E1E1E] flex flex-wrap items-center justify-between gap-2">
                        <span>Fixe : 01, 02 (SCPT, CKT)</span>
                        <span>Assistance ARPTC : 1515 · Plaintes : 155</span>
                      </div>
                    </div>
                  )}

                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    onBlur={() => setPhoneTouched(true)}
                    placeholder="Ex: 080 324 0289, 081 234 567 ou +243..."
                    className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0C0C0C] border rounded-md text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-colors ${
                      phoneTouched && !phoneValidation.isValid
                        ? 'border-red-500/80 focus:border-red-500'
                        : phoneValidation.isValid
                        ? 'border-[#10B981]/70 focus:border-[#10B981]'
                        : 'border-slate-300 dark:border-[#222222] focus:border-[#E50914]'
                    }`}
                  />

                  {phoneInput && (
                    <div className="mt-2 text-xs">
                      {phoneValidation.isValid ? (
                        <div className="p-2.5 rounded bg-[#10B981]/10 border border-[#10B981]/30 text-slate-800 dark:text-slate-200 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 dark:text-slate-400">Format International :</span>
                            <span className="font-mono text-[#10B981] font-bold">
                              +{phoneValidation.formattedInternational}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 dark:text-slate-400">Format National :</span>
                            <span className="font-mono font-medium text-slate-900 dark:text-white">
                              {phoneValidation.nationalDisplay}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] pt-0.5 border-t border-[#10B981]/20">
                            <span className="text-slate-500 dark:text-slate-400">Opérateur Identifié :</span>
                            <span 
                              className="font-bold px-1.5 py-0.5 rounded text-[10px] text-white"
                              style={{ backgroundColor: phoneValidation.operatorColor || '#10B981' }}
                            >
                              {phoneValidation.carrier}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-red-500 dark:text-red-400 text-xs flex items-center gap-1.5 mt-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{phoneValidation.errorMessage}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: CONTRAT DNA & IP */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-1">
                <h3 className="text-lg font-bold font-montserrat text-slate-900 dark:text-white">Étape 2 : Contrat DNA &amp; Propriété Intellectuelle (PIGA STUDIO)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  L'infrastructure, les prompts systèmes et les architectures d'agents appartiennent exclusivement à PIGA STUDIO.
                </p>
              </div>

              {/* Scrollable Terms Box */}
              <div className="h-64 overflow-y-auto p-4 rounded-md bg-slate-50 dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#222222] text-xs text-slate-700 dark:text-slate-300 space-y-3.5 leading-relaxed font-sans">
                <div className="font-bold text-[#E50914] uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200 dark:border-[#222222]">
                  {ndaTitle}
                </div>

                {ndaClauses.map((clause, idx) => (
                  <p key={idx} className="leading-relaxed">
                    {clause}
                  </p>
                ))}
              </div>

              {/* Mandatory Affirmation Checkbox */}
              <label className="flex items-start gap-3 p-3.5 rounded-md bg-slate-50 dark:bg-[#0D0D0D] border border-slate-200 dark:border-[#262626] cursor-pointer hover:border-[#E50914]/50 transition-colors">
                <input
                  type="checkbox"
                  checked={dnaAccepted}
                  onChange={(e) => setDnaAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#E50914] focus:ring-0 bg-white dark:bg-[#000000] border-slate-300 dark:border-[#333333] cursor-pointer accent-[#E50914]"
                />
                <span className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                  Je certifie avoir lu et j'accepte sans réserve les termes du <strong>Contrat DNA &amp; Protection de la Propriété Intellectuelle de PIGA STUDIO</strong> pour la session du {dateDisplay}.
                </span>
              </label>
            </div>
          )}

          {/* STEP 3: PAIEMENT ORANGE MONEY EXCLUSIF */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-fade-in">
              <div className="space-y-1">
                <h3 className="text-lg font-bold font-montserrat text-slate-900 dark:text-white">Étape 3 : Paiement Exclusif Orange Money (${ticketPrice.toFixed(2)} USD)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Le règlement de votre accréditation se fait uniquement via <strong>Orange Money</strong> sur le compte officiel de la direction.
                </p>
              </div>

              {/* Dedicated Orange Money Payment Container */}
              <div className="p-4 rounded-lg bg-orange-50/70 dark:bg-[#0C0C0C] border-2 border-[#E50914]/60 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-orange-200 dark:border-[#222222]">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#E50914]" />
                    <span className="font-bold text-slate-900 dark:text-white text-sm font-poppins">Orange Money RDC</span>
                  </div>
                  <span className="font-bold text-[#E50914] font-mono text-sm">${ticketPrice.toFixed(2)} USD</span>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Transférez ${ticketPrice.toFixed(2)} USD vers ce numéro officiel :</div>
                  <div className="flex items-center justify-between p-3 rounded bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#2A2A2A] shadow-xs">
                    <span className="font-mono font-bold text-slate-900 dark:text-white text-base">
                      {orangeNumber}
                    </span>
                    <button
                      onClick={handleCopyNumber}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#E50914] hover:bg-[#C80711] text-white rounded transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copied ? 'Copié !' : 'Copier'}</span>
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-slate-600 dark:text-slate-400 flex flex-col gap-0.5 pt-1">
                  <div>Titulaire : <strong>{orangeHolder}</strong></div>
                  <div>Contact Direction : {directionEmail} · {directionPhone}</div>
                </div>
              </div>

              {/* Transaction Reference Input */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Référence de Transaction Orange Money (Reçue par SMS) <span className="text-[#E50914]">*</span>
                </label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="Ex: OM-2611-9847291 ou ID Orange Money"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0C0C0C] border border-slate-300 dark:border-[#222222] focus:border-[#E50914] rounded-md text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-colors font-mono"
                />
              </div>

              {/* Drag and Drop Screenshot Upload */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Capture d'Écran du Paiement Orange Money (Preuve) <span className="text-[#E50914]">*</span>
                </label>

                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      processFile(e.dataTransfer.files[0]);
                    }
                  }}
                  className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? 'border-[#E50914] bg-[#E50914]/10'
                      : screenshotBase64
                      ? 'border-[#10B981] bg-[#10B981]/10'
                      : 'border-slate-300 dark:border-[#222222] hover:border-slate-400 dark:hover:border-[#333333] bg-slate-50 dark:bg-[#0C0C0C]'
                  }`}
                  onClick={() => document.getElementById('orange-proof-file')?.click()}
                >
                  <input
                    id="orange-proof-file"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        processFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />

                  {screenshotBase64 ? (
                    <div className="flex items-center justify-center gap-3 text-xs text-[#10B981]">
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <div className="text-left">
                        <div className="font-bold text-slate-900 dark:text-white">{screenshotName || 'Preuve Orange Money enregistrée'}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">Cliquez pour remplacer le fichier</div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Upload className="w-6 h-6 text-[#E50914] mx-auto" />
                      <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                        Glissez-déposez la capture de confirmation <span className="text-[#E50914] underline">Orange Money</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Formats acceptés : JPG, PNG, WebP (Max 10 Mo) · Stockage chiffré PIGA STUDIO
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: CONFIRMATION & PDF PASS */}
          {currentStep === 4 && submittedData && (
            <div className="py-6 text-center space-y-5 animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-[#10B981]/15 border border-[#10B981]/40 mx-auto flex items-center justify-center">
                <Check className="w-7 h-7 text-[#10B981]" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black font-montserrat text-slate-900 dark:text-white">
                  Inscription Transmise à PIGA STUDIO
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                  Votre versement Orange Money de <strong>$20.00 USD</strong> et votre capture ont été transmis au superviseur. 
                  Une notification automatique vient d'être envoyée sur le terminal d'administration.
                </p>
              </div>

              {/* Receipt Pass Box */}
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-[#0C0C0C] border border-slate-200 dark:border-[#222222] text-left max-w-md mx-auto text-xs space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#222222]">
                  <span className="text-slate-500 dark:text-slate-400">Code Billet Officiel :</span>
                  <span className="font-mono font-bold text-[#E50914] text-sm">
                    {submittedData.ticketCode || 'PIGA-AA-2026-PENDING'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Statut du Dossier :</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded text-[11px]">
                    EN COURS DE VALIDATION ORANGE MONEY
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Compte Récepteur :</span>
                  <span className="font-mono text-slate-900 dark:text-white font-medium">{PIGA_ORANGE_MONEY_DISPLAY}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Notification WhatsApp :</span>
                  <span className="font-mono text-slate-900 dark:text-white font-medium">+{submittedData.phoneFormatted || phoneValidation.formattedInternational}</span>
                </div>
              </div>

              {/* Action Buttons: PDF Pass & WhatsApp Confirmation */}
              {registeredParticipant && (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto pt-2">
                  <button
                    onClick={() => downloadTicketPDF(registeredParticipant)}
                    className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white bg-slate-100 hover:bg-slate-200 dark:bg-[#1E1E1E] dark:hover:bg-[#2A2A2A] border border-slate-300 dark:border-[#333333] rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <FileDown className="w-4 h-4 text-[#E50914]" />
                    <span>Télécharger Pass PDF</span>
                  </button>

                  <a
                    href={generateWhatsAppConfirmationUrl(registeredParticipant).url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-white bg-[#10B981] hover:bg-[#059669] rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Ouvrir WhatsApp &amp; VIP</span>
                  </a>
                </div>
              )}

              <button
                onClick={onClose}
                className="px-6 py-2 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
              >
                Fermer la fenêtre
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        {currentStep < 4 && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-[#1E1E1E] bg-slate-50 dark:bg-[#0A0A0A] flex items-center justify-between transition-colors">
            {currentStep > 1 ? (
              <button
                onClick={() => setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-200 hover:bg-slate-300 dark:bg-[#141414] dark:hover:bg-[#1E1E1E] rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Précédent</span>
              </button>
            ) : (
              <div />
            )}

            {currentStep === 1 && (
              <button
                disabled={!isStep1Valid}
                onClick={() => setCurrentStep(2)}
                className={`px-5 py-2.5 text-xs font-bold font-montserrat rounded-md transition-all flex items-center gap-2 ${
                  isStep1Valid
                    ? 'bg-[#E50914] hover:bg-[#C80711] text-white cursor-pointer shadow-md shadow-[#E50914]/20'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                }`}
              >
                <span>Suivant · Contrat DNA &amp; IP</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {currentStep === 2 && (
              <button
                disabled={!dnaAccepted}
                onClick={() => setCurrentStep(3)}
                className={`px-5 py-2.5 text-xs font-bold font-montserrat rounded-md transition-all flex items-center gap-2 ${
                  dnaAccepted
                    ? 'bg-[#E50914] hover:bg-[#C80711] text-white cursor-pointer shadow-md shadow-[#E50914]/20'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                }`}
              >
                <span>Accepter &amp; Passer au Paiement</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {currentStep === 3 && (
              <button
                disabled={isSubmitting || !transactionRef.trim() || !screenshotBase64}
                onClick={handleSubmit}
                className={`px-6 py-2.5 text-xs font-bold font-montserrat rounded-md transition-all flex items-center gap-2 ${
                  isSubmitting || !transactionRef.trim() || !screenshotBase64
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                    : 'bg-[#E50914] hover:bg-[#C80711] text-white cursor-pointer shadow-lg shadow-[#E50914]/20'
                }`}
              >
                {isSubmitting ? (
                  <span>Transmission Sécurisée PIGA...</span>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Soumettre Preuve Orange Money ($20)</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
