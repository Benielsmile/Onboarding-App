/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PIGA STUDIO — Client Header (Premium Edition)
 * Pill-shaped navigation bar in the subscrr.app shape language: floating
 * glass bar, gentle scroll shrink, rounded CTA. Palette & branding unchanged.
 */

import React, { useEffect, useState } from 'react';
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

const NAV_LINKS = [
  { href: '#programme', label: 'Programme' },
  { href: '#modalites', label: 'Orange Money & Modalités' },
  { href: '#direction', label: 'Direction PIGA' }
];

export const ClientHeader: React.FC<ClientHeaderProps> = ({
  programConfig,
  onOpenRegister,
  onOpenAdmin
}) => {
  const { isInstallable, install } = usePWAInstall();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const price = programConfig?.ticketPriceUsd !== undefined ? programConfig.ticketPriceUsd : 20;
  const isSoldOut = programConfig?.status === 'SOLD_OUT';
  const isComingSoon = programConfig?.status === 'COMING_SOON';

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 12);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className="fixed top-0 inset-x-0 z-40 transition-all duration-300">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div
          className={`mt-3 flex items-center justify-between gap-4 rounded-[22px] border transition-all duration-300 ${
            isScrolled
              ? 'bg-white/90 dark:bg-[#0A0A0A]/90 backdrop-blur-xl border-slate-200/80 dark:border-[#1E1E1E] shadow-[0_10px_40px_-16px_rgba(0,0,0,0.18)] dark:shadow-[0_10px_40px_-16px_rgba(0,0,0,0.8)] px-4 h-[58px]'
              : 'bg-white/70 dark:bg-[#0A0A0A]/70 backdrop-blur-md border-transparent px-4 h-[70px]'
          }`}
        >
          {/* Zone 1: PIGA STUDIO Official Logo */}
          <div className="flex items-center gap-4 shrink-0">
            <a href="#top" className="hover:opacity-85 transition-opacity flex items-center">
              <PigaLogo variant="full" size="md" />
            </a>
          </div>

          {/* Zone 2: Pill Navigation Links (desktop) */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-100/80 dark:bg-[#111111] rounded-full px-1.5 py-1.5">
            {NAV_LINKS.map(link => (
              <a
                key={link.href}
                href={link.href}
                className="px-4 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 rounded-full hover:bg-white dark:hover:bg-[#1A1A1A] hover:text-slate-900 dark:hover:text-white transition-all whitespace-nowrap tracking-wide"
              >
                {link.label}
              </a>
            ))}
            <button
              onClick={onOpenAdmin}
              className="pl-4 pr-4 py-1.5 text-[11px] font-semibold text-[#E50914] rounded-full hover:bg-white dark:hover:bg-[#1A1A1A] transition-colors whitespace-nowrap tracking-wide flex items-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-3 h-3" />
              <span>Console Admin</span>
            </button>
          </nav>

          {/* Zone 3: Actions + Theme Switcher & PWA Install */}
          <div className="flex items-center gap-2.5 shrink-0">
            <ThemeToggle showLogoToggle={true} size="md" />

            {isInstallable && (
              <button
                onClick={install}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 dark:bg-[#121212] border border-slate-200 dark:border-[#222222] rounded-full transition-all hover:border-[#E50914]/50 cursor-pointer"
                title="Installer l'application PIGA STUDIO sur votre appareil"
              >
                <Download className="w-3.5 h-3.5 text-[#E50914]" />
                <span className="hidden md:inline">Installer App</span>
              </button>
            )}

            <button
              onClick={onOpenRegister}
              disabled={isSoldOut}
              className={`px-5 py-2.5 text-[11px] font-bold tracking-wide rounded-full transition-all shadow-md cursor-pointer flex items-center gap-2 ${
                isSoldOut
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'text-white bg-[#E50914] hover:bg-[#C80711] hover:shadow-lg hover:shadow-[#E50914]/25 hover:-translate-y-0.5 shadow-[#E50914]/20'
              }`}
            >
              {isSoldOut ? (
                <span>Session Complète</span>
              ) : isComingSoon ? (
                <span>Pré-inscription · ${price}</span>
              ) : (
                <span>Réserver · ${price} USD</span>
              )}
            </button>

            {/* Mobile burger */}
            <button
              onClick={() => setIsMobileOpen(v => !v)}
              className="lg:hidden p-2.5 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#151515] transition-colors cursor-pointer"
              aria-label="Menu"
            >
              <div className="space-y-1.5">
                <span className={`block w-4 h-0.5 bg-current transition-transform ${isMobileOpen ? 'rotate-45 translate-y-[4px]' : ''}`} />
                <span className={`block w-4 h-0.5 bg-current transition-transform ${isMobileOpen ? '-rotate-45 -translate-y-[4px]' : ''}`} />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileOpen && (
          <div className="lg:hidden mt-2 rounded-[22px] bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-xl border border-slate-200 dark:border-[#1E1E1E] shadow-xl p-3 flex flex-col gap-1">
            {NAV_LINKS.map(link => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileOpen(false)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-[#151515] transition-colors"
              >
                {link.label}
              </a>
            ))}
            <button
              onClick={() => { setIsMobileOpen(false); onOpenAdmin(); }}
              className="px-4 py-2.5 text-xs font-semibold text-[#E50914] rounded-xl hover:bg-[#E50914]/10 transition-colors text-left flex items-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Console Admin</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
