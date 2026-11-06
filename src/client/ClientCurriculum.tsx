/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PIGA STUDIO — Dynamic Curriculum & Modalities
 * Dynamically rendered from the formation configured by the Administrator.
 * Supports arbitrary number of modules, custom icons, and dynamic Orange Money details.
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
  Calendar,
  DollarSign,
  PhoneCall
} from 'lucide-react';
import type { ProgramConfig, ProgramModuleIcon } from '../types/index.ts';

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
    <section id="programme" className="py-20 bg-white dark:bg-[#000000] border-b border-slate-200 dark:border-[#1E1E1E] transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="max-w-3xl mb-14">
          <div className="text-xs font-bold font-montserrat tracking-wider text-[#E50914] uppercase mb-3">
            Programme d'Ingénierie · {programConfig.title}
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold font-montserrat text-slate-900 dark:text-white tracking-tight leading-tight">
            Piliers Stratégiques &amp; Modules Pratiques
          </h2>
          <p className="mt-4 text-slate-600 dark:text-slate-400 text-base font-inter leading-relaxed">
            Alliez l'ingénierie logicielle lourde à l'impact technologique. Une journée intensive d'ateliers pratiques, 
            de revues d'architecture critiques et de déploiement en direct.
          </p>
        </div>

        {/* Dynamic Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {modules.map((m, idx) => {
            const IconComponent = (m.iconName && ICON_MAP[m.iconName]) || Network;
            const indexDisplay = m.index || String(idx + 1).padStart(2, '0');

            return (
              <div 
                key={m.id || idx}
                className="p-8 rounded-xl bg-[#F8F9FA] dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#222222] hover:border-[#E50914]/50 dark:hover:border-[#E50914]/50 transition-colors flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="font-mono text-2xl font-bold text-[#E50914]">
                      {indexDisplay}.
                    </span>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#2A2A2A]">
                      <IconComponent className="w-5 h-5 text-slate-700 dark:text-slate-200" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold font-poppins text-slate-900 dark:text-white mb-2">
                    {m.title}
                  </h3>

                  {m.highlight && (
                    <div className="text-xs font-semibold font-poppins text-[#E50914] mb-3">
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

        {/* Modalities & Orange Money Box */}
        <div id="modalites" className="rounded-xl bg-[#F8F9FA] dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#222222] overflow-hidden shadow-sm transition-colors">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left Column: Media Visual */}
            <div className="lg:col-span-5 relative min-h-[300px]">
              <img
                src={programConfig.auditoriumImageUrl || "/src/assets/images/event_keynote_hall_1793949804529.jpg"}
                alt="Auditorium PIGA STUDIO"
                className="absolute inset-0 w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-100 dark:from-[#0A0A0A] via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-slate-100 lg:dark:to-[#0A0A0A]" />
            </div>

            {/* Right Column: Information & Orange Money */}
            <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-between space-y-6">
              <div>
                <div className="text-xs font-bold font-montserrat text-[#E50914] tracking-wider uppercase mb-2">
                  Modalités &amp; Règlement Exclusif
                </div>
                <h3 className="text-2xl font-bold font-montserrat text-slate-900 dark:text-white mb-4">
                  {programConfig.locationDisplay || 'Session Kinshasa & Transmission Chiffrée'}
                </h3>

                <ul className="space-y-3.5 text-sm font-inter text-slate-700 dark:text-slate-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#E50914] shrink-0 mt-0.5" />
                    <span><strong>Date &amp; Horaires :</strong> {programConfig.dateDisplay} ({programConfig.timeDisplay || 'Kinshasa'}).</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#E50914] shrink-0 mt-0.5" />
                    <span><strong>Tarif de Participation :</strong> ${programConfig.ticketPriceUsd.toFixed(2)} USD (Verrouillé et certifié côté serveur).</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#E50914] shrink-0 mt-0.5" />
                    <span><strong>Paiement Unique Orange Money :</strong> Compte officiel <strong className="text-[#E50914]">{programConfig.orangeMoneyNumber}</strong> (Titulaire : {programConfig.orangeMoneyHolder}).</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#E50914] shrink-0 mt-0.5" />
                    <span><strong>Livrables VIP :</strong> Laissez-passer PDF officiel avec QR Code cryptographique, dépôts de code privés et groupe WhatsApp VIP.</span>
                  </li>
                </ul>
              </div>

              <div id="direction" className="pt-4 border-t border-slate-200 dark:border-[#1E1E1E] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-600 dark:text-slate-400 font-inter">
                  Direction PIGA STUDIO : <a href={`mailto:${programConfig.directionEmail}`} className="text-[#E50914] underline font-medium">{programConfig.directionEmail}</a> · Tél : {programConfig.directionPhone}
                </div>
                <button
                  onClick={onOpenRegister}
                  className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold font-montserrat text-white bg-[#E50914] hover:bg-[#C80711] rounded-md transition-colors cursor-pointer shadow-md shadow-[#E50914]/20"
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
