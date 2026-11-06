/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Cryptographic Ticket Verification View (/verify/:token)
 * AES-256-GCM Authenticated Decryption & Zero-Trust Tamper Detection
 */

import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertOctagon, CheckCircle2, ArrowLeft, KeyRound, Lock, Search } from 'lucide-react';
import { api } from '../services/api.ts';
import type { CryptographicTokenVerification } from '../types/index.ts';

interface TicketVerificationViewProps {
  initialToken?: string;
  onBack: () => void;
}

export const TicketVerificationView: React.FC<TicketVerificationViewProps> = ({
  initialToken = '',
  onBack
}) => {
  const [tokenInput, setTokenInput] = useState(initialToken);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<CryptographicTokenVerification | null>(null);

  const runVerification = async (tokenToVerify: string) => {
    if (!tokenToVerify.trim()) return;
    setIsVerifying(true);
    try {
      const verification = await api.verifyToken(tokenToVerify.trim());
      setResult(verification);
    } catch {
      setResult({
        isValid: false,
        tamperDetected: true,
        error: 'Échec de décodage cryptographique. Le jeton est altéré ou corrompu.',
        verificationTimestamp: new Date().toISOString()
      });
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    if (initialToken) {
      runVerification(initialToken);
    }
  }, [initialToken]);

  // Tamper testing utility to demonstrate zero-trust security
  const simulateTamper = () => {
    if (!tokenInput) return;
    const parts = tokenInput.split('.');
    if (parts.length === 3) {
      // Flip one character in the ciphertext
      const alteredCipher = parts[1].slice(0, -2) + (parts[1].slice(-2) === 'ff' ? '00' : 'ff');
      const forgedToken = `${parts[0]}.${alteredCipher}.${parts[2]}`;
      setTokenInput(forgedToken);
      runVerification(forgedToken);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0C0E] text-slate-100 py-12 px-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Navigation */}
        <button
          onClick={onBack}
          className="text-xs font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à l'accueil de l'Arsenal Agentique</span>
        </button>

        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#E05E2B] tracking-wider uppercase">
            <Lock className="w-3.5 h-3.5" />
            <span>Contrôle d'Accès Zéro-Trust</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Vérification Cryptographique du Pass (AES-256-GCM)
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Chaque billet émis pour le Masterclass du <strong>13 Novembre 2026</strong> intègre une balise d'authentification 128-bit (GCM). 
            Toute modification d'un seul octet invalide instantanément la signature.
          </p>
        </div>

        {/* Input Form */}
        <div className="p-6 rounded-xl bg-[#121418] border border-[#1E222A] space-y-4 shadow-xl">
          <label className="block text-xs font-semibold text-slate-300">
            Jeton Cryptographique (Format : IV.Ciphertext.AuthTag)
          </label>

          <div className="relative">
            <textarea
              rows={3}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Collez ici le jeton AES-256-GCM extrait du QR Code ou de votre reçu..."
              className="w-full px-4 py-3 bg-[#0B0C0E] border border-[#1E222A] focus:border-[#E05E2B] rounded-md text-xs text-white font-mono placeholder-slate-600 outline-none leading-relaxed resize-none"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <button
              onClick={() => runVerification(tokenInput)}
              disabled={isVerifying || !tokenInput.trim()}
              className={`w-full sm:w-auto px-6 py-2.5 text-xs font-bold rounded-md transition-colors flex items-center justify-center gap-2 ${
                isVerifying || !tokenInput.trim()
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-[#10B981] hover:bg-[#059669] text-white cursor-pointer shadow-lg shadow-[#10B981]/15'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>{isVerifying ? 'Déchiffrement & Contrôle...' : 'Authentifier le Pass'}</span>
            </button>

            {tokenInput && (
              <button
                onClick={simulateTamper}
                className="w-full sm:w-auto px-4 py-2 text-xs font-mono text-amber-400 hover:text-amber-300 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 rounded-md transition-colors flex items-center justify-center gap-1.5"
                title="Altère un octet pour prouver le rejet automatique par le tag GCM"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Simuler une Fraude / Altération</span>
              </button>
            )}
          </div>
        </div>

        {/* Verification Result Card */}
        {result && (
          <div className="animate-fade-in space-y-6">
            {result.isValid && result.payload ? (
              <div className="rounded-xl bg-[#121418] border border-[#10B981]/50 p-6 sm:p-8 relative overflow-hidden shadow-2xl">
                {/* Decorative glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#10B981]/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#1E222A]">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 flex items-center justify-center">
                      <CheckCircle2 className="w-7 h-7 text-[#10B981]" />
                    </div>
                    <div>
                      <div className="text-xs font-mono text-[#10B981] font-bold uppercase tracking-wider">
                        PASS VALIDÉ · SIGNATURE INTÈGRE (GCM)
                      </div>
                      <h2 className="text-xl font-bold text-white mt-0.5">
                        Accréditation Officielle Certifiée
                      </h2>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-mono text-xs text-slate-400">Date de session :</span>
                    <div className="font-bold text-[#E05E2B] text-sm">Vendredi 13 Novembre 2026</div>
                  </div>
                </div>

                {/* Accredited Member Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-[#1E222A] text-xs">
                  <div>
                    <span className="text-slate-400 block mb-1">Titulaire de l'Accréditation :</span>
                    <div className="text-base font-bold text-white uppercase tracking-wide">
                      {result.payload.n}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-1">Code de Série Sécurisé :</span>
                    <div className="font-mono text-base font-bold text-[#E05E2B]">
                      {result.payload.t}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-1">Statut d'Enregistrement :</span>
                    <span className="font-semibold text-[#10B981] bg-[#10B981]/15 px-2 py-0.5 rounded text-[11px] inline-flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {result.payload.s}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-1">Horodatage de Contrôle :</span>
                    <span className="font-mono text-slate-300">
                      {new Date(result.verificationTimestamp).toLocaleString('fr-FR', { timeZone: 'UTC' })} UTC
                    </span>
                  </div>
                </div>

                {/* Cryptographic Proof Explainer */}
                <div className="pt-4 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-[#E05E2B]" />
                    <span>Algorithme : AES-256-GCM · Balise Auth : 128-bit MAC</span>
                  </div>
                  <span className="text-slate-500 font-mono">Conforme OWASP Top 10</span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-[#181113] border border-red-800/60 p-6 sm:p-8 space-y-4 shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-red-500/15 border border-red-500/40 flex items-center justify-center">
                    <AlertOctagon className="w-7 h-7 text-red-500" />
                  </div>
                  <div>
                    <div className="text-xs font-mono text-red-400 font-bold uppercase tracking-wider">
                      ÉCHEC DE VÉRIFICATION · ACCÈS REFUSÉ
                    </div>
                    <h2 className="text-xl font-bold text-white mt-0.5">
                      Billet Non Conforme ou Signature Altérée
                    </h2>
                  </div>
                </div>

                <div className="p-4 rounded-md bg-black/40 border border-red-900/40 text-xs text-red-300 font-mono leading-relaxed">
                  {result.error || 'La balise d\'authentification GCM ne correspond pas au contenu. Tentative d\'altération probable.'}
                </div>

                <p className="text-xs text-slate-400 leading-normal">
                  Ce pass a été rejeté par la politique Zéro-Trust. Si vous êtes titulaire d'un billet valide, veuillez contacter l'administration de l'Arsenal Agentique avec votre identifiant de transaction MoMo officiel.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
