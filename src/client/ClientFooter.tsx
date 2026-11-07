/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PIGA STUDIO — Official Client Footer (Premium Edition)
 * Minimal subscrr.app-style footer: oversized brand block, quiet column
 * navigation, pill contact chips. Fully formation-driven from ProgramConfig.
 */

import React from 'react';
import { PigaLogo } from '../components/PigaLogo.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';
import { Lock, Mail, Phone, ShieldCheck } from 'lucide-react';
import type { ProgramConfig } from '../types/index.ts';
import { directionWhatsAppLink } from '../utils/whatsappHelper.ts';

interface ClientFooterProps {
  programConfig?: ProgramConfig;
  onOpenAdmin: () => void;
  onOpenRegister: () => void;
}

export const ClientFooter: React.FC<ClientFooterProps> = ({
  programConfig,
  onOpenAdmin,
  onOpenRegister
}) => {
  const price = programConfig?.ticketPriceUsd ?? 20;
  const tagline = programConfig?.tagline || 'L’intelligence logicielle. L’impact cinématographique.';
  const footerAbout = programConfig?.footerAbout ||
    `The AI Venture Studio & Tech Media | Empowering the next generation of creators. Plateforme d’ingénierie et d’accréditation — ${programConfig?.title || 'formations PIGA STUDIO'} (${programConfig?.dateDisplay || 'session à venir'}).`;
  const directionEmail = programConfig?.directionEmail || 'Benielsmile89@gmail.com';
  const directionPhoneLocal = programConfig?.directionPhone || '0997406281';
  // Canal WhatsApp officiel : toujours le numéro Direction (0997406281).
  const directionWhatsAppUrl = directionWhatsAppLink(programConfig?.directionPhone) || 'https://wa.me/243997406281';
  const orangeMoneyDisplay = programConfig?.orangeMoneyNumber || '+243 803 240 289';

  return (
    <footer className="bg-white dark:bg-[#000000] border-t border-slate-100 dark:border-[#111111] pt-16 pb-10 transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-6">
        {/* Oversized brand statement */}
        <div className="pb-12 mb-12 border-b border-slate-100 dark:border-[#111111]">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <PigaLogo variant="compact" size="md" />
              <p className="mt-4 text-sm font-poppins text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
                {footerAbout}
              </p>
            </div>
            <div className="text-xs font-poppins text-[#E50914] font-semibold whitespace-nowrap">
              {tagline}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12">
          {/* Column 1: Navigation */}
          <div className="md:col-span-5 space-y-3.5">
            <div className="text-[10px] font-bold font-montserrat text-slate-400 uppercase tracking-[0.18em] mb-1">
              Navigation
            </div>
            <ul className="space-y-2.5 text-xs font-inter text-slate-600 dark:text-slate-400">
              <li>
                <a href="#programme" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  Programme de la Formation
                </a>
              </li>
              <li>
                <a href="#modalites" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  Modalités &amp; Orange Money (${price} USD)
                </a>
              </li>
              <li>
                <button
                  onClick={onOpenRegister}
                  className="hover:text-[#E50914] transition-colors cursor-pointer text-left"
                >
                  Inscription &amp; Contrat DNA / IP
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenAdmin}
                  className="hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 cursor-pointer text-left"
                >
                  <Lock className="w-3 h-3 text-[#E50914]" />
                  <span>Console Admin (/admin)</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Column 2: Contacts as pill chips */}
          <div className="md:col-span-7 space-y-3.5">
            <div className="text-[10px] font-bold font-montserrat text-slate-400 uppercase tracking-[0.18em] mb-1">
              Direction PIGA STUDIO
            </div>
            <p className="text-xs font-inter text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
              Pour toute assistance relative aux paiements Orange Money ou aux partenariats institutionnels :
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={`mailto:${directionEmail}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FAFAF9] dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1A1A1A] text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:border-[#E50914]/50 hover:text-[#E50914] transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-[#E50914]" />
                <span>{directionEmail}</span>
              </a>
              <a
                href={directionWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FAFAF9] dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1A1A1A] text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:border-[#E50914]/50 hover:text-[#E50914] transition-colors cursor-pointer"
              >
                <Phone className="w-3.5 h-3.5 text-[#E50914]" />
                <span>WhatsApp Direction : {directionPhoneLocal}</span>
              </a>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#E50914]/5 border border-[#E50914]/25 text-[11px] font-medium font-mono text-[#E50914]">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Orange Money Récepteur : {orangeMoneyDisplay}</span>
              </div>
            </div>
            <div className="text-[10px] font-mono text-slate-400 pt-1">
              Kinshasa, République Démocratique du Congo · Global South Ecosystem
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-100 dark:border-[#111111] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-inter text-slate-400">
          <div>
            &copy; 2026 PIGA STUDIO. Tous droits réservés. L'infrastructure appartient à Piga.
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <span>Paiement Exclusif Orange Money</span>
              <span aria-hidden="true">·</span>
              <span>Sécurité Zéro-Trust</span>
            </div>
            <ThemeToggle size="sm" />
          </div>
        </div>
      </div>
    </footer>
  );
};
