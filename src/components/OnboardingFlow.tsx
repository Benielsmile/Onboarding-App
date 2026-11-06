/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * The Critical 3-Step User Onboarding Flow
 * - Step 1: Profiling & Strict DRC Phone Sanitization (blocking on failure)
 * - Step 2: Professional Scrollable NDA & IP Protection Contract with Mandatory Checkbox
 * - Step 3: Manual Mobile Money (M-Pesa, Orange, Airtel) & Drag-and-Drop Async Screenshot Upload
 * - Submission: Raw layout preserved, Zero-Trust server evaluation, PENDING state, Confetti
 */

import React, { useState } from 'react';
import { X, Check, AlertCircle, Upload, ShieldCheck, ArrowRight, ArrowLeft, FileText, CheckCircle2, Copy } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cleanAndValidateDRCPhone } from '../utils/drcPhoneValidator.ts';
import { api } from '../services/api.ts';
import type { MobileMoneyProvider, RegistrationResponse } from '../types/index.ts';

interface OnboardingFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ isOpen, onClose, onSuccess }) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneValidation, setPhoneValidation] = useState(cleanAndValidateDRCPhone(''));
  const [phoneTouched, setPhoneTouched] = useState(false);

  // Step 2 State
  const [ndaAccepted, setNdaAccepted] = useState(false);

  // Step 3 State
  const [provider, setProvider] = useState<MobileMoneyProvider>('M-PESA');
  const [transactionRef, setTransactionRef] = useState('');
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  // Submission & Feedback State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submittedData, setSubmittedData] = useState<RegistrationResponse | null>(null);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle phone input changes with real-time DRC validator
  const handlePhoneChange = (val: string) => {
    setPhoneInput(val);
    const result = cleanAndValidateDRCPhone(val);
    setPhoneValidation(result);
  };

  // Step 1 Validation Gatekeeper
  const isStep1Valid = fullName.trim().length >= 3 && 
                       email.includes('@') && email.includes('.') && 
                       phoneValidation.isValid;

  // File drag-and-drop handler
  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setSubmissionError('Seules les images (JPEG, PNG, WebP) sont acceptées pour la preuve de paiement.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSubmissionError('Le fichier est trop volumineux (limite: 10 Mo).');
      return;
    }

    setScreenshotName(file.name);
    setSubmissionError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      setScreenshotBase64(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNumber(label);
    setTimeout(() => setCopiedNumber(null), 2500);
  };

  // Final Submission
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const response = await api.registerParticipant({
        fullName,
        email,
        phone: phoneValidation.formattedInternational, // Strict 243XXXXXXXXX format
        paymentProvider: provider,
        transactionReference: transactionRef,
        proofBase64: screenshotBase64 || undefined,
        proofFileName: screenshotName || undefined,
        ndaAccepted: true
      });

      setSubmittedData(response);
      setCurrentStep(4);
      onSuccess();

      // Trigger triumph celebration confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#E05E2B', '#10B981', '#FFFFFF']
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue lors de l\'enregistrement.';
      setSubmissionError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-2xl bg-[#0B0C0E] border border-[#1E222A] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-[#1E222A] flex items-center justify-between bg-[#121418]">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-xs bg-[#E05E2B]" />
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Arsenal Agentique · Onboarding Sécurisé
              </h2>
              <div className="text-xs text-slate-400">
                Session du Vendredi 13 Novembre 2026 · Frais : $20.00 USD
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-[#1E222A] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Indicators (Zero-pill clean layout) */}
        {currentStep < 4 && (
          <div className="px-6 py-3 border-b border-[#1E222A] bg-[#0E1014] flex items-center justify-between text-xs font-semibold">
            <div className={`flex items-center gap-2 ${currentStep === 1 ? 'text-[#E05E2B]' : currentStep > 1 ? 'text-[#10B981]' : 'text-slate-500'}`}>
              <span className="font-mono">01.</span>
              <span>Profil &amp; Télécom RDC</span>
            </div>
            <span className="text-slate-700">/</span>
            <div className={`flex items-center gap-2 ${currentStep === 2 ? 'text-[#E05E2B]' : currentStep > 2 ? 'text-[#10B981]' : 'text-slate-500'}`}>
              <span className="font-mono">02.</span>
              <span>Contrat NDA &amp; IP</span>
            </div>
            <span className="text-slate-700">/</span>
            <div className={`flex items-center gap-2 ${currentStep === 3 ? 'text-[#E05E2B]' : 'text-slate-500'}`}>
              <span className="font-mono">03.</span>
              <span>Paiement MoMo &amp; Preuve</span>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {submissionError && (
            <div className="p-3.5 rounded-md bg-red-950/40 border border-red-800/60 text-red-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{submissionError}</span>
            </div>
          )}

          {/* STEP 1: PROFILING & DRC PHONE VALIDATOR */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">Étape 1 : Identification du Participant</h3>
                <p className="text-xs text-slate-400">
                  Renseignez vos coordonnées exactes. Votre numéro servira à l'accréditation WhatsApp et à l'émission du billet cryptographique.
                </p>
              </div>

              <div className="space-y-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Nom Complet &amp; Post-nom <span className="text-[#E05E2B]">*</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: Dieudonné Mwamba Ilunga"
                    className="w-full px-3.5 py-2.5 bg-[#121418] border border-[#1E222A] focus:border-[#E05E2B] rounded-md text-sm text-white placeholder-slate-500 outline-none transition-colors"
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Adresse E-mail Professionnelle <span className="text-[#E05E2B]">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ex: d.mwamba@entreprise.cd"
                    className="w-full px-3.5 py-2.5 bg-[#121418] border border-[#1E222A] focus:border-[#E05E2B] rounded-md text-sm text-white placeholder-slate-500 outline-none transition-colors"
                  />
                </div>

                {/* DRC Phone Number with Strict Cleaner/Validator */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-300">
                      Numéro WhatsApp RDC (M-Pesa / Orange / Airtel / Africell) <span className="text-[#E05E2B]">*</span>
                    </label>
                    {phoneValidation.isValid && (
                      <span className="text-[11px] text-[#10B981] font-semibold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        {phoneValidation.carrier}
                      </span>
                    )}
                  </div>

                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    onBlur={() => setPhoneTouched(true)}
                    placeholder="Ex: 0812345678 ou +243 89 000 0000"
                    className={`w-full px-3.5 py-2.5 bg-[#121418] border rounded-md text-sm text-white placeholder-slate-500 outline-none transition-colors ${
                      phoneTouched && !phoneValidation.isValid
                        ? 'border-red-500/80 focus:border-red-500'
                        : phoneValidation.isValid
                        ? 'border-[#10B981]/70 focus:border-[#10B981]'
                        : 'border-[#1E222A] focus:border-[#E05E2B]'
                    }`}
                  />

                  {/* Real-time Validation Feedback */}
                  {phoneInput && (
                    <div className="mt-2 text-xs">
                      {phoneValidation.isValid ? (
                        <div className="p-2.5 rounded bg-[#10B981]/10 border border-[#10B981]/30 text-slate-200 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Format International Enregistré :</span>
                            <span className="font-mono text-[#10B981] font-bold">
                              +{phoneValidation.formattedInternational}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Réseau Télécom Détecté :</span>
                            <span className="font-semibold text-white">{phoneValidation.carrier}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-red-400 text-xs flex items-center gap-1.5 mt-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{phoneValidation.errorMessage}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="mt-1.5 text-[11px] text-slate-500 leading-normal">
                    Le filtre convertit automatiquement les formats locaux (081..., 082..., 089..., 099...) vers la norme obligatoire RDC <code>243XXXXXXXXX</code> (12 chiffres).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: ENGAGEMENT CONTRAT (NDA & IP PROTECTION) */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">Étape 2 : Contrat de Confidentialité &amp; Propriété Intellectuelle</h3>
                <p className="text-xs text-slate-400">
                  L'accès à l'Arsenal Agentique requiert l'acceptation formelle des clauses de sécurité, de secret professionnel et de protection des architectures présentées.
                </p>
              </div>

              {/* Scrollable Terms Container */}
              <div className="h-64 overflow-y-auto p-4 rounded-md bg-[#121418] border border-[#1E222A] text-xs text-slate-300 space-y-3.5 leading-relaxed font-sans">
                <div className="font-bold text-white uppercase tracking-wider text-[11px] pb-1 border-b border-[#1E222A]">
                  ACCORD DE NON-DIVULGATION (NDA) ET DE PROTECTION DU SAVOIR-FAIRE
                </div>

                <p>
                  <strong>Article 1 — Objet de l'Engagement :</strong> Le participant bénéficie d'un accès privilégié à des architectures de pointe, codes sources d'agents autonomes, configurations de sandboxing et tactiques d'évaluation de sécurité IA (« Informations Confidentielles »).
                </p>

                <p>
                  <strong>Article 2 — Non-Divulgation &amp; Non-Diffusion :</strong> Le participant s'engage formellement à ne pas diffuser, publier, revendre ni reproduire publiquement les supports pédagogiques, scripts propriétaires, prompts systèmes et jeux de données fournis au cours du Masterclass sans autorisation écrite préalable.
                </p>

                <p>
                  <strong>Article 3 — Éthique &amp; Red-Teaming Défensif :</strong> Les techniques d'attaque (prompt injection, jailbreak et contournement de garde-fous) sont enseignées exclusivement à des fins de défense et de sécurisation des infrastructures. Toute utilisation malveillante est strictement prohibée.
                </p>

                <p>
                  <strong>Article 4 — Propriété Intellectuelle :</strong> Tous les brevets, schémas conceptuels et marques associés à l'« Arsenal Agentique » demeurent la propriété exclusive de leurs concepteurs.
                </p>

                <p>
                  <strong>Article 5 — Révocation d'Accès :</strong> Tout manquement aux présentes clauses entraîne la révocation immédiate du billet cryptographique sans préavis ni remboursement, ainsi que des poursuites judiciaires conformément aux lois en vigueur.
                </p>
              </div>

              {/* Mandatory Checkbox */}
              <label className="flex items-start gap-3 p-3.5 rounded-md bg-[#14171E] border border-[#232731] cursor-pointer hover:border-[#E05E2B]/50 transition-colors">
                <input
                  type="checkbox"
                  checked={ndaAccepted}
                  onChange={(e) => setNdaAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#E05E2B] focus:ring-0 bg-[#0B0C0E] border-[#2B313D] cursor-pointer accent-[#E05E2B]"
                />
                <span className="text-xs text-slate-200 font-medium leading-relaxed">
                  Je confirme avoir lu et j'accepte sans réserve les termes du Contrat d'Engagement, de Non-Divulgation (NDA) et de Protection de la Propriété Intellectuelle pour la session du 13 Novembre 2026.
                </span>
              </label>
            </div>
          )}

          {/* STEP 3: MANUAL MOMO PAYMENT & ASYNC UPLOAD */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-fade-in">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">Étape 3 : Règlement Mobile Money ($20 USD)</h3>
                <p className="text-xs text-slate-400">
                  Effectuez le transfert manuel du montant exact ($20.00 USD ou équivalent en CDF) sur l'un des comptes officiels ci-dessous, puis téléversez votre capture d'écran.
                </p>
              </div>

              {/* Official Mobile Money Accounts Block */}
              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-slate-300">
                  Sélectionnez le réseau et effectuez le transfert :
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* M-Pesa */}
                  <div 
                    onClick={() => setProvider('M-PESA')}
                    className={`p-3 rounded-md border cursor-pointer transition-all ${
                      provider === 'M-PESA'
                        ? 'bg-[#181B21] border-[#E05E2B]'
                        : 'bg-[#121418] border-[#1E222A] hover:border-[#2B313D]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-white">M-Pesa (Vodacom)</span>
                      {provider === 'M-PESA' && <Check className="w-3.5 h-3.5 text-[#E05E2B]" />}
                    </div>
                    <div className="font-mono text-xs text-slate-300">+243 810 000 000</div>
                    <div className="text-[10px] text-slate-500 mt-1">Arsenal Agentique / Trésorerie</div>
                  </div>

                  {/* Orange Money */}
                  <div 
                    onClick={() => setProvider('ORANGE_MONEY')}
                    className={`p-3 rounded-md border cursor-pointer transition-all ${
                      provider === 'ORANGE_MONEY'
                        ? 'bg-[#181B21] border-[#E05E2B]'
                        : 'bg-[#121418] border-[#1E222A] hover:border-[#2B313D]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-white">Orange Money</span>
                      {provider === 'ORANGE_MONEY' && <Check className="w-3.5 h-3.5 text-[#E05E2B]" />}
                    </div>
                    <div className="font-mono text-xs text-slate-300">+243 890 000 000</div>
                    <div className="text-[10px] text-slate-500 mt-1">Arsenal Agentique SARL</div>
                  </div>

                  {/* Airtel Money */}
                  <div 
                    onClick={() => setProvider('AIRTEL_MONEY')}
                    className={`p-3 rounded-md border cursor-pointer transition-all ${
                      provider === 'AIRTEL_MONEY'
                        ? 'bg-[#181B21] border-[#E05E2B]'
                        : 'bg-[#121418] border-[#1E222A] hover:border-[#2B313D]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-white">Airtel Money</span>
                      {provider === 'AIRTEL_MONEY' && <Check className="w-3.5 h-3.5 text-[#E05E2B]" />}
                    </div>
                    <div className="font-mono text-xs text-slate-300">+243 990 000 000</div>
                    <div className="text-[10px] text-slate-500 mt-1">Arsenal Agentique</div>
                  </div>
                </div>

                {/* Quick Copy Helper */}
                <div className="p-3 rounded-md bg-[#121418] border border-[#1E222A] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400">Numéro pour {provider} : </span>
                    <span className="font-mono font-bold text-white">
                      {provider === 'M-PESA' ? '+243810000000' : provider === 'ORANGE_MONEY' ? '+243890000000' : '+243990000000'}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(
                      provider === 'M-PESA' ? '+243810000000' : provider === 'ORANGE_MONEY' ? '+243890000000' : '+243990000000',
                      provider
                    )}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-[#1E222A] hover:bg-[#282E39] text-slate-300 rounded transition-colors flex items-center gap-1.5"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedNumber === provider ? 'Copié !' : 'Copier'}</span>
                  </button>
                </div>
              </div>

              {/* Transaction Reference Input */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Référence / Identifiant du Transfert (ID Transaction Opérateur) <span className="text-[#E05E2B]">*</span>
                </label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="Ex: MP-9847291 ou ID Orange Money reçu par SMS"
                  className="w-full px-3.5 py-2.5 bg-[#121418] border border-[#1E222A] focus:border-[#E05E2B] rounded-md text-sm text-white placeholder-slate-500 outline-none transition-colors font-mono"
                />
              </div>

              {/* Drag and Drop Screenshot Upload */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Capture d'écran du Paiement (Preuve MoMo) <span className="text-[#E05E2B]">*</span>
                </label>

                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? 'border-[#E05E2B] bg-[#E05E2B]/5'
                      : screenshotBase64
                      ? 'border-[#10B981] bg-[#10B981]/5'
                      : 'border-[#1E222A] hover:border-[#2B313D] bg-[#121418]'
                  }`}
                  onClick={() => document.getElementById('screenshot-file-input')?.click()}
                >
                  <input
                    id="screenshot-file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileInput}
                    className="hidden"
                  />

                  {screenshotBase64 ? (
                    <div className="flex items-center justify-center gap-3 text-xs text-[#10B981]">
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <div className="text-left">
                        <div className="font-bold text-white">{screenshotName || 'Preuve de paiement chargée'}</div>
                        <div className="text-[11px] text-slate-400">Cliquez pour modifier le fichier</div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                      <div className="text-xs font-medium text-slate-200">
                        Glissez-déposez la capture ou <span className="text-[#E05E2B] underline">parcourez vos fichiers</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Formats acceptés : JPG, PNG, WebP (Max 10 Mo) · Stockage chiffré privé
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS TRIUMPH CONFIRMATION */}
          {currentStep === 4 && submittedData && (
            <div className="py-6 text-center space-y-5 animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-[#10B981]/15 border border-[#10B981]/40 mx-auto flex items-center justify-center">
                <Check className="w-7 h-7 text-[#10B981]" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-extrabold text-white">
                  Dossier d'Inscription Enregistré
                </h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                  Votre paiement de <strong>$20.00 USD</strong> et votre preuve MoMo ont été transmis avec succès. 
                  Notre équipe de supervision procède à la vérification sous 30 minutes.
                </p>
              </div>

              {/* Accreditation Summary Box */}
              <div className="p-4 rounded-lg bg-[#121418] border border-[#1E222A] text-left max-w-md mx-auto text-xs space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-[#1E222A]">
                  <span className="text-slate-400">Numéro de Billet Sécurisé :</span>
                  <span className="font-mono font-bold text-[#E05E2B] text-sm">
                    {submittedData.ticketCode || 'AA-2026-PENDING'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Statut du Dossier :</span>
                  <span className="font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded text-[11px]">
                    EN ATTENTE DE VÉRIFICATION
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Session Réservée :</span>
                  <span className="text-white font-medium">Vendredi 13 Novembre 2026</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Canal de Notification :</span>
                  <span className="font-mono text-white">+{submittedData.phoneFormatted || phoneValidation.formattedInternational}</span>
                </div>
              </div>

              <div className="pt-2 text-xs text-slate-400 max-w-md mx-auto">
                Dès confirmation par l'administrateur, votre billet cryptographique (AES-256-GCM) et votre QR Code d'accès seront générés et envoyés directement sur votre WhatsApp.
              </div>

              <button
                onClick={onClose}
                className="px-6 py-2.5 text-xs font-bold text-white bg-[#1E222A] hover:bg-[#282E39] border border-[#2B313D] rounded-md transition-colors"
              >
                Fermer et Consulter le Programme
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        {currentStep < 4 && (
          <div className="px-6 py-4 border-t border-[#1E222A] bg-[#121418] flex items-center justify-between">
            {currentStep > 1 ? (
              <button
                onClick={() => setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-[#181B21] hover:bg-[#1E222A] rounded-md transition-colors flex items-center gap-1.5"
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
                className={`px-5 py-2.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
                  isStep1Valid
                    ? 'bg-[#10B981] hover:bg-[#059669] text-white cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <span>Suivant · Contrat NDA</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {currentStep === 2 && (
              <button
                disabled={!ndaAccepted}
                onClick={() => setCurrentStep(3)}
                className={`px-5 py-2.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
                  ndaAccepted
                    ? 'bg-[#10B981] hover:bg-[#059669] text-white cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
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
                className={`px-6 py-2.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
                  isSubmitting || !transactionRef.trim() || !screenshotBase64
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-[#10B981] hover:bg-[#059669] text-white cursor-pointer shadow-lg shadow-[#10B981]/20'
                }`}
              >
                {isSubmitting ? (
                  <span>Validation Sécurisée en cours...</span>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Soumettre mon Inscription ($20)</span>
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
