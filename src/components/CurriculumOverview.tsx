/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Curriculum & Architecture Overview
 * Clean editorial numbering, asymmetric Bento-grid, concrete enterprise outcomes
 */

import React from 'react';
import { Network, ShieldAlert, Server, QrCode, CheckCircle2 } from 'lucide-react';

interface CurriculumOverviewProps {
  onOpenRegister: () => void;
}

export const CurriculumOverview: React.FC<CurriculumOverviewProps> = ({ onOpenRegister }) => {
  const modules = [
    {
      index: '01',
      title: 'Architectures Multi-Agents & Graphes d\'États',
      icon: Network,
      highlight: 'LangGraph & Supervisor Patterns',
      description: 'Conception de flux cognitifs cycliques, mécanismes de mémoire épisodique, routage dynamique des sous-agents et synchronisation autoritaire des états distribués.'
    },
    {
      index: '02',
      title: 'Tool-Calling Sécurisé & Isolation Zéro-Trust',
      icon: ShieldAlert,
      highlight: 'OWASP LLM Top 10 Defenses',
      description: 'Mise en œuvre de barrières de validation cryptographiques, sandboxing strict de code exécutable, remparts contre les prompt injections indirectes et validation des permissions par token éphémère.'
    },
    {
      index: '03',
      title: 'Infrastructure Haute Concurrence & Déploiement Edge',
      icon: Server,
      highlight: 'Cloudflare WAF & PostgreSQL RLS',
      description: 'Déploiement distribué à latence minimale, transactions atomiques avec verrouillage de lignes (SELECT FOR UPDATE) et sécurisation du stockage privé par URLs signées HMAC.'
    },
    {
      index: '04',
      title: 'Billetterie Cryptographique & Validation Anti-Fraude',
      icon: QrCode,
      highlight: 'AES-256-GCM Tokenization',
      description: 'Émission de laissez-passer infalsifiables avec signature d\'authentification 128-bit, QR codes de contrôle d\'accès instantané et intégration dynamique WhatsApp conciergerie.'
    }
  ];

  return (
    <section id="programme" className="py-20 bg-[#0B0C0E] border-b border-[#1E222A]">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="max-w-3xl mb-14">
          <div className="text-xs font-semibold tracking-wider text-[#E05E2B] uppercase mb-3">
            Programme d'Ingénierie &amp; Sécurité Avancée
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Quatre Piliers Stratégiques pour Déployer des Agents de Classe Industrielle
          </h2>
          <p className="mt-4 text-slate-400 text-base leading-relaxed">
            Une journée d'immersion intensive guidée par des cas réels de production, des revues de code critiques 
            et des exercices de red-teaming pour architectes de solutions et ingénieurs seniors.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <div 
                key={m.index}
                className="p-8 rounded-lg bg-[#121418] border border-[#1E222A] hover:border-[#2B313D] transition-colors relative flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="font-mono text-2xl font-bold text-[#E05E2B]">
                      {m.index}.
                    </span>
                    <div className="p-2.5 rounded bg-[#181B21] border border-[#232731]">
                      <Icon className="w-5 h-5 text-slate-300" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2">
                    {m.title}
                  </h3>

                  <div className="text-xs font-semibold text-[#E05E2B] mb-3">
                    {m.highlight}
                  </div>

                  <p className="text-sm text-slate-400 leading-relaxed">
                    {m.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Venue & Modalities Split */}
        <div id="modalites" className="rounded-lg bg-[#121418] border border-[#1E222A] overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Visual Side */}
            <div className="lg:col-span-5 relative min-h-[300px]">
              <img
                src="/src/assets/images/event_keynote_hall_1793949804529.jpg"
                alt="Auditorium de la Masterclass Arsenal Agentique"
                className="absolute inset-0 w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#121418] via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-[#121418]" />
            </div>

            {/* Content Side */}
            <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-between space-y-6">
              <div>
                <div className="text-xs font-bold text-[#10B981] tracking-wider uppercase mb-2">
                  Modalités &amp; Logistique
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  Session Présentielle &amp; Retransmission Chiffrée Edge
                </h3>

                <ul className="space-y-3.5 text-sm text-slate-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                    <span><strong>Date &amp; Heure :</strong> Vendredi 13 Novembre 2026, de 09h00 à 18h00 GMT+1 (Kinshasa).</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                    <span><strong>Tarif Unique Certifié :</strong> $20.00 USD (Vérifié et verrouillé côté serveur).</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                    <span><strong>Paiement Mobile Money Direct :</strong> M-Pesa (Vodacom), Orange Money, Airtel Money en RDC.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                    <span><strong>Livrables VIP :</strong> Billet PDF avec QR code cryptographique, accès au repo privé d'architectures agentiques et communauté WhatsApp VIP.</span>
                  </li>
                </ul>
              </div>

              <div className="pt-4 border-t border-[#1E222A] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-400">
                  Accès restreint sous contrat de non-divulgation (NDA) obligatoire.
                </div>
                <button
                  onClick={onOpenRegister}
                  className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold text-white bg-[#10B981] hover:bg-[#059669] rounded-md transition-colors cursor-pointer"
                >
                  S'inscrire Maintenant ($20)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
