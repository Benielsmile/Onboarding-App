/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PIGA STUDIO — Official Client Footer
 * Complete brand attribution, dual theme support, direction contacts, and legal notices.
 */

import React from 'react';
import { PigaLogo } from '../components/PigaLogo.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';
import { Lock, Mail, Phone, ShieldCheck } from 'lucide-react';
import { 
  PIGA_DIRECTION_EMAIL, 
  PIGA_DIRECTION_PHONE_LOCAL, 
  PIGA_DIRECTION_PHONE,
  PIGA_ORANGE_MONEY_DISPLAY 
} from '../utils/whatsappHelper.ts';

interface ClientFooterProps {
  onOpenAdmin: () => void;
  onOpenRegister: () => void;
}

export const ClientFooter: React.FC<ClientFooterProps> = ({
  onOpenAdmin,
  onOpenRegister
}) => {
  return (
    <footer className="bg-[#F8F9FA] dark:bg-[#000000] border-t border-slate-200 dark:border-[#1E1E1E] py-16 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-slate-200 dark:border-[#1E1E1E]">
          {/* Column 1: Brand & Strategic Positioning */}
          <div className="md:col-span-5 space-y-4">
            <PigaLogo variant="compact" size="md" />

            <div className="text-xs font-poppins text-[#E50914] font-semibold">
              L’intelligence logicielle. L’impact cinématographique.
            </div>

            <p className="text-xs font-inter text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm">
              The AI Venture Studio &amp; Tech Media | Empowering the next generation of creators. 
              Plateforme d’ingénierie et d’accréditation pour le Masterclass Arsenal Agentique (13 Novembre 2026).
            </p>

            <div className="text-[11px] font-mono text-slate-500">
              Kinshasa, République Démocratique du Congo · Global South Ecosystem
            </div>
          </div>

          {/* Column 2: Navigation Links */}
          <div className="md:col-span-3 space-y-3">
            <div className="text-xs font-bold font-montserrat text-slate-900 dark:text-white uppercase tracking-wider">
              Navigation
            </div>
            <ul className="space-y-2 text-xs font-inter text-slate-600 dark:text-slate-400">
              <li>
                <a href="#programme" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  Programme d'Ingénierie
                </a>
              </li>
              <li>
                <a href="#modalites" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  Modalités &amp; Orange Money ($20 USD)
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
                  className="hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer text-left"
                >
                  <Lock className="w-3.5 h-3.5 text-[#E50914]" />
                  <span>Console Admin (/admin)</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Direction & Contacts Officiels */}
          <div className="md:col-span-4 space-y-3">
            <div className="text-xs font-bold font-montserrat text-slate-900 dark:text-white uppercase tracking-wider">
              Direction PIGA STUDIO
            </div>
            
            <p className="text-xs font-inter text-slate-600 dark:text-slate-400 leading-relaxed">
              Pour toute assistance relative aux paiements Orange Money ou aux partenariats institutionnels :
            </p>

            <div className="space-y-2 text-xs font-inter text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[#E50914]" />
                <a href={`mailto:${PIGA_DIRECTION_EMAIL}`} className="hover:underline">
                  {PIGA_DIRECTION_EMAIL}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#E50914]" />
                <span>Direction : {PIGA_DIRECTION_PHONE_LOCAL} ({PIGA_DIRECTION_PHONE})</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] text-[#E50914]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#E50914]" />
                <span>Orange Money Récepteur : {PIGA_ORANGE_MONEY_DISPLAY}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-inter text-slate-500">
          <div>
            &copy; 2026 PIGA STUDIO. Tous droits réservés. L'infrastructure appartient à Piga.
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <span>Paiement Exclusif Orange Money</span>
              <span aria-hidden="true">·</span>
              <span>Sécurité Zéro-Trust</span>
            </div>
            {/* Footer Theme Toggle */}
            <ThemeToggle size="sm" />
          </div>
        </div>
      </div>
    </footer>
  );
};
