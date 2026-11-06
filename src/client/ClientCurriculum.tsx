/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PIGA STUDIO — Dynamic Curriculum & Modalities (Premium Edition)
 * subscrr.app shape language: eyebrow labels, oversized headings, numbered
 * oversized module indexes, soft large-radius cards with hover lift, and a
 * rounded showcase modalities panel. Palette & branding unchanged.
 */

import React from 'react';
import { 
  Network, 
  ShieldAlert, 
  Server, 
  QrCode, 
  CheckCircle2, 
  Cpu, 
  Brain, 
  Workflow, 
  Code, 
  Terminal, 
  Database,
  DollarSign,
  PhoneCall
} from 'lucide-react';
import type { ProgramConfig, ProgramModuleIcon } from '../types/index.ts';
import { resolveFormationImageUrl, AUDITORIUM_IMAGE_FALLBACK } from '../utils/programAssets.ts';

interface ClientCurriculumProps {
  programConfig: ProgramConfig;
  onOpenRegister: () => void;
}

const ICON_MAP: Record<ProgramModuleIcon, React.ComponentType<{ className?: string }>> = {
  Network,
  ShieldAlert,
  Server,
  QrCode,
  Cpu,
  Brain,
  Workflow,
  Code,
  Terminal,
  Database
};

export const ClientCurriculum: React.FC<ClientCurriculumProps> = ({ 
  programConfig,
  onOpenRegister 
}) => {
  const modules = programConfig.modules && programConfig.modules.length > 0 
    ? programConfig.modules 
    : [];

  return (
    <section id="programme" className="py-24 sm:py-28 bg-[#FAFAF9] dark:bg-[#000000] border-b border-slate-100 dark:border-[#111111] transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-6">
        {/* Section Header : eyebrow + oversized display */}
        <div className="max-w-3xl mb-16">
          <span className="text-[11px] font-bold font-montserrat tracking-[0.18em] text-[#E50914] uppercase mb-4 inline-block">
            Programme d'Ingénierie · {programConfig.title.split(' : ')[0]}
          </span>
          <h2 className="text-[clamp(30px,4.6vw,54px)] font-black font-montserrat tracking-[-0.03em] leading-[1.05] text-slate-900 dark:text-white">
            {programConfig.curriculumTitle || 'Piliers Stratégiques & Modules Pratiques'}
          </h2>
          <p className="mt-5 text-slate-600 dark:text-slate-400 text-base font-inter leading-relaxed">
            {programConfig.curriculumIntro || "Alliez l'ingénierie logicielle lourde à l'impact technologique. Une journée intensive d'ateliers pratiques, de revues d'architecture critiques et de déploiement en direct."}
          </p>
        </div>

        {/* Pillars Grid — soft large cards, oversized numerals, hover lift */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-20">
          {modules.map((m, idx) => {
            const IconComponent = (m.iconName && ICON_MAP[m.iconName]) || Network;
            const indexDisplay = m.index || String(idx + 1).padStart(2, '0');

            return (
              <div 
                key={m.id || idx}
                className="group relative p-8 rounded-[24px] bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1A1A1A] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_50px_-24px_rgba(0,0,0,0.18)] dark:hover:shadow-[0_24px_50px_-24px_rgba(0,0,0,0.8)] hover:border-[#E50914]/40 dark:hover:border-[#E50914]/40 flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between mb-7">
                    {/* Oversized numeral marker */}
                    <span className="font-mono text-[40px] leading-none font-black text-slate-100 dark:text-[#161616] group-hover:text-[#E50914]/25 transition-colors select-none">
                      {indexDisplay}.
                    </span>
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#222222] transition-colors group-hover:border-[#E50914]/30">
                      <IconComponent className="w-5 h-5 text-slate-700 dark:text-slate-200" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold font-poppins text-slate-900 dark:text-white mb-2 tracking-tight">
                    {m.title}
                  </h3>

                  {m.highlight && (
                    <div className="text-[11px] font-bold font-poppins text-[#E50914] uppercase tracking-wide mb-3">
                      {m.highlight}
                    </div>
                  )}

                  <p className="text-sm text-slate-600 dark:text-slate-400 font-inter leading-relaxed">
                    {m.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ============ Modalities Panel — rounded showcase ============ */}
        <div id="modalites" className="rounded-[28px] bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1A1A1A] overflow-hidden shadow-[0_24px_60px_-30px_rgba(0,0,0,0.18)] dark:shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)] transition-colors">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left: Media Visual */}
            <div className="lg:col-span-5 relative min-h-[320px]">
              <img
                src={resolveFormationImageUrl(programConfig.auditoriumImageUrl, AUDITORIUM_IMAGE_FALLBACK)}
                alt="Auditorium PIGA STUDIO"
                className="absolute inset-0 w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#0A0A0A] via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-white lg:dark:to-[#0A0A0A]" />
              {/* Floating glass price chip */}
              <div className="absolute top-6 left-6 px-4 py-2.5 rounded-full bg-white/80 dark:bg-black/60 backdrop-blur-md border border-white/30 dark:border-white/10 shadow-lg">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5 text-[#E50914]" />
                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                    ${programConfig.ticketPriceUsd.toFixed(2)} USD · billet unique
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Informations */}
            <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-between space-y-8">
              <div>
                <span className="text-[11px] font-bold font-montserrat text-[#E50914] tracking-[0.18em] uppercase mb-3 inline-block">
                  Modalités &amp; Règlement Exclusif
                </span>
                <h3 className="text-2xl sm:text-3xl font-black font-montserrat tracking-tight text-slate-900 dark:text-white mb-7">
                  {programConfig.locationDisplay || 'Session Kinshasa & Transmission Chiffrée'}
                </h3>

                <ul className="space-y-4 text-sm font-inter text-slate-700 dark:text-slate-300">
                  <li className="flex items-start gap-3.5">
                    <CheckCircle2 className="w-4.5 h-4.5 text-[#E50914] shrink-0 mt-0.5" />
                    <span><strong className="text-slate-900 dark:text-white">Date &amp; Horaires :</strong> {programConfig.dateDisplay} ({programConfig.timeDisplay || 'Kinshasa'}).</span>
                  </li>
                  <li className="flex items-start gap-3.5">
                    <CheckCircle2 className="w-4.5 h-4.5 text-[#E50914] shrink-0 mt-0.5" />
                    <span><strong className="text-slate-900 dark:text-white">Tarif de Participation :</strong> ${programConfig.ticketPriceUsd.toFixed(2)} USD (Verrouillé et certifié côté serveur).</span>
                  </li>
                  <li className="flex items-start gap-3.5">
                    <CheckCircle2 className="w-4.5 h-4.5 text-[#E50914] shrink-0 mt-0.5" />
                    <span><strong className="text-slate-900 dark:text-white">Paiement Unique Orange Money :</strong> Compte officiel <strong className="text-[#E50914] font-mono">{programConfig.orangeMoneyNumber}</strong> (Titulaire : {programConfig.orangeMoneyHolder}).</span>
                  </li>
                  <li className="flex items-start gap-3.5">
                    <CheckCircle2 className="w-4.5 h-4.5 text-[#E50914] shrink-0 mt-0.5" />
                    <span><strong className="text-slate-900 dark:text-white">Livrables VIP :</strong> Laissez-passer PDF officiel avec QR Code cryptographique, dépôts de code privés et groupe WhatsApp VIP.</span>
                  </li>
                </ul>
              </div>

              <div id="direction" className="pt-7 border-t border-slate-100 dark:border-[#1A1A1A] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-600 dark:text-slate-400 font-inter flex items-center gap-2">
                  <PhoneCall className="w-3.5 h-3.5 text-[#E50914]" />
                  <span>
                    Direction PIGA STUDIO : <a href={`mailto:${programConfig.directionEmail}`} className="text-[#E50914] underline font-medium">{programConfig.directionEmail}</a> · Tél : {programConfig.directionPhone}
                  </span>
                </div>
                <button
                  onClick={onOpenRegister}
                  className="w-full sm:w-auto px-7 py-3.5 text-xs font-bold font-montserrat text-white bg-[#E50914] hover:bg-[#C80711] rounded-full transition-all cursor-pointer shadow-md shadow-[#E50914]/20 hover:shadow-lg hover:shadow-[#E50914]/30 hover:-translate-y-0.5"
                >
                  S'inscrire via Orange Money (${programConfig.ticketPriceUsd.toFixed(2)})
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
