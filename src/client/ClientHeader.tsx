/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PIGA STUDIO — Client Header
 * Features official PIGA STUDIO logo, Dark/Light Mode toggle,
 * unboxed typography, dynamic formation price, and PWA install trigger.
 */

import React from 'react';
import { PigaLogo } from '../components/PigaLogo.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';
import { Lock, Download } from 'lucide-react';
import { usePWAInstall } from '../utils/pwaNotifications.ts';
import type { ProgramConfig } from '../types/index.ts';

interface ClientHeaderProps {
  programConfig?: ProgramConfig;
  onOpenRegister: () => void;
  onOpenAdmin: () => void;
}

export const ClientHeader: React.FC<ClientHeaderProps> = ({
  programConfig,
  onOpenRegister,
  onOpenAdmin
}) => {
  const { isInstallable, install } = usePWAInstall();
  const price = programConfig?.ticketPriceUsd !== undefined ? programConfig.ticketPriceUsd : 20;
  const isSoldOut = programConfig?.status === 'SOLD_OUT';
  const isComingSoon = programConfig?.status === 'COMING_SOON';

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#000000]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#1E1E1E] transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-6">
        {/* Zone 1: PIGA STUDIO Official Logo */}
        <div className="flex items-center gap-4">
          <a href="#" className="hover:opacity-90 transition-opacity flex items-center">
            <PigaLogo variant="full" size="md" />
          </a>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider font-montserrat">
          <a href="#programme" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap">
            Programme
          </a>
          <a href="#modalites" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap">
            Orange Money &amp; Modalités
          </a>
          <a href="#direction" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap">
            Direction PIGA
          </a>
          <button
            onClick={onOpenAdmin}
            className="hover:text-[#E50914] dark:hover:text-[#E50914] transition-colors whitespace-nowrap flex items-center gap-1.5 text-slate-500 dark:text-slate-400 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-[#E50914]" />
            <span>Console Admin</span>
          </button>
        </nav>

        {/* Zone 3: Actions + Theme Switcher & PWA Install */}
        <div className="flex items-center gap-3">
          {/* Light / Dark Mode Toggle with Logo Selector */}
          <ThemeToggle showLogoToggle={true} size="md" />

          {isInstallable && (
            <button
              onClick={install}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-[#121212] dark:hover:bg-[#1A1A1A] border border-slate-300 dark:border-[#222222] rounded-md transition-colors cursor-pointer"
              title="Installer l'application PIGA STUDIO sur votre appareil"
            >
              <Download className="w-3.5 h-3.5 text-[#E50914]" />
              <span>Installer App</span>
            </button>
          )}

          <button
            onClick={onOpenRegister}
            disabled={isSoldOut}
            className={`px-5 py-2.5 text-xs font-bold font-montserrat tracking-wide rounded-md transition-all shadow-md cursor-pointer flex items-center gap-2 ${
              isSoldOut
                ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'text-white bg-[#E50914] hover:bg-[#C80711] shadow-[#E50914]/20'
            }`}
          >
            {isSoldOut ? (
              <span>Session Complète</span>
            ) : isComingSoon ? (
              <span>Pré-inscription · ${price} USD</span>
            ) : (
              <span>Réserver · ${price} USD</span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
