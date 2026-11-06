/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Top Bar Contract: Exactly 3 zones separated by gap-8
 * Zone 1: Brand title, one line
 * Zone 2: 4-5 nav links, 1-2 word labels, single-line
 * Zone 3: 1 primary action
 */

import React from 'react';
import { ShieldCheck, Lock, Terminal } from 'lucide-react';

interface HeaderProps {
  currentView: 'home' | 'admin' | 'verify';
  onNavigate: (view: 'home' | 'admin' | 'verify') => void;
  onOpenRegister: () => void;
  availableSeats?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  onOpenRegister,
  availableSeats = 78
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0B0C0E]/90 backdrop-blur-md border-b border-[#1E222A]">
      <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          onClick={() => onNavigate('home')}
          className="text-lg font-bold tracking-tight text-white hover:text-white/90 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 text-left"
        >
          <span className="w-2 h-2 bg-[#E05E2B] rounded-xs inline-block"></span>
          <span>ARSENAL AGENTIQUE</span>
        </button>

        {/* Zone 2: 4 clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
          <button
            onClick={() => onNavigate('home')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              currentView === 'home' ? 'text-white' : ''
            }`}
          >
            Programme &amp; Architecture
          </button>
          <a
            href="#modalites"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Modalités &amp; Tarifs
          </a>
          <button
            onClick={() => onNavigate('verify')}
            className={`hover:text-[#E05E2B] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              currentView === 'verify' ? 'text-[#E05E2B]' : ''
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-[#E05E2B]" />
            <span>Vérification Billet (GCM)</span>
          </button>
          <button
            onClick={() => onNavigate('admin')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              currentView === 'admin' ? 'text-white' : ''
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>Console Admin</span>
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-4 shrink-0">
          {currentView === 'admin' ? (
            <button
              onClick={() => onNavigate('home')}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1E222A] hover:bg-[#282E39] border border-[#2B313D] rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <Terminal className="w-3.5 h-3.5 text-[#E05E2B]" />
              <span>Retour à l'Accueil</span>
            </button>
          ) : (
            <button
              onClick={onOpenRegister}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-[#10B981] hover:bg-[#059669] rounded-md transition-colors shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
            >
              Réserver mon Accréditation · 20 USD
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
