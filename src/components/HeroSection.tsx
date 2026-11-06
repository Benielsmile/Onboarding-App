/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Hero Section: Focal anchor, high-impact imagery, zero-pill metadata
 */

import React from 'react';
import { ArrowRight, ShieldCheck, Cpu, KeyRound } from 'lucide-react';
import type { InventoryStatus } from '../types/index.ts';

interface HeroSectionProps {
  inventory: InventoryStatus;
  onOpenRegister: () => void;
  onNavigateVerify: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  inventory,
  onOpenRegister,
  onNavigateVerify
}) => {
  return (
    <section className="relative overflow-hidden pt-12 pb-20 border-b border-[#1E222A]">
      {/* Subtle Ambient Radial Glow */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-[#E05E2B]/10 to-transparent blur-3xl pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-6">
        {/* Unboxed Metadata Kicker (Anti-slop: No rounded pills) */}
        <div className="flex items-center gap-3 text-xs font-semibold tracking-wider text-[#E05E2B] uppercase mb-4">
          <span>Masterclass Haute Technologie</span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span>Vendredi 13 Novembre 2026</span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span>Kinshasa &amp; Distributed Edge</span>
        </div>

        {/* 2-Column Desktop Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Column 1: Editorial Value Proposition */}
          <div className="lg:col-span-7 space-y-6">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.08] text-balance">
              Arsenal Agentique : Systèmes d'Agents Autonomes &amp; Sécurité Zéro-Trust
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
              Concevez, orchestrez et blindez des architectures multi-agents prêtes pour la production. 
              De LangGraph aux firewalls d'injection d'invites, maîtrisez les standards de l'IA agentique d'élite. 
              Accréditation nominative garantie par billetterie cryptographique AES-256-GCM.
            </p>

            {/* Unboxed Proof Points Strip */}
            <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-slate-400 pt-1">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#E05E2B]" />
                <span>LangGraph &amp; Tool-Calling</span>
              </div>
              <span className="text-slate-700 hidden sm:inline" aria-hidden="true">·</span>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                <span>OWASP Top 10 for LLMs</span>
              </div>
              <span className="text-slate-700 hidden sm:inline" aria-hidden="true">·</span>
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#E05E2B]" />
                <span>Billet Chiffré Inviolable</span>
              </div>
            </div>

            {/* Conversion CTA Group */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4">
              <button
                onClick={onOpenRegister}
                className="px-6 py-3.5 text-sm font-bold text-white bg-[#10B981] hover:bg-[#059669] rounded-md transition-all duration-200 flex items-center justify-center gap-2.5 shadow-lg shadow-[#10B981]/10 cursor-pointer"
              >
                <span>Démarrer l'Inscription · $20 USD</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={onNavigateVerify}
                className="px-5 py-3.5 text-xs font-semibold text-slate-300 hover:text-white bg-[#121418] hover:bg-[#1A1D23] border border-[#1E222A] rounded-md transition-colors flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-[#E05E2B]" />
                <span>Vérifier l'Authenticité d'un Pass</span>
              </button>
            </div>

            {/* Capacity Counter */}
            <div className="pt-2 text-xs text-slate-400 flex items-center gap-3">
              <span className="font-semibold text-white">Inventaire Temps-Réel :</span>
              <span className="font-mono tabular-nums text-[#10B981] font-bold">
                {inventory.availableSeats} places restantes
              </span>
              <span className="text-slate-600" aria-hidden="true">/</span>
              <span className="font-mono tabular-nums text-slate-400">
                {inventory.totalCapacity} places au total
              </span>
            </div>
          </div>

          {/* Column 2: Marquee Architectural Visual */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-lg overflow-hidden border border-[#1E222A] bg-[#121418] shadow-2xl">
              <img
                src="/src/assets/images/hero_arsenal_agentique_1793949804735.jpg"
                alt="Command Center des Agents Autonomes - Arsenal Agentique"
                className="w-full h-auto object-cover aspect-[16/10] hover:scale-102 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              
              {/* Bottom Scrim with Verified Badge */}
              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-[#0B0C0E] via-[#0B0C0E]/80 to-transparent flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white tracking-wide">SESSION EXECUTIVE CONFIDENTIELLE</div>
                  <div className="text-[11px] text-slate-400">Accréditation avec signature numérique inviolable</div>
                </div>
                <div className="font-mono text-[#E05E2B] text-xs font-semibold">
                  13.11.2026
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
