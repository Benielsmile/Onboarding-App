/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PIGA STUDIO — Dynamic Client Hero (Premium Edition)
 * Editorial centered hero inspired by subscrr.app: oversized display
 * headline, asterisk footnote tagline, pill CTAs, floating glass stat
 * chips and a large rounded showcase frame. Palette & branding unchanged:
 * Rouge PIGA #E50914, Noir Absolu, Blanc Pur.
 */

import React from 'react';
import { ArrowRight, Lock, MapPin } from 'lucide-react';
import type { InventoryStatus, ProgramConfig } from '../types/index.ts';
import { resolveFormationImageUrl, HERO_IMAGE_FALLBACK } from '../utils/programAssets.ts';

interface ClientHeroProps {
  programConfig: ProgramConfig;
  inventory: InventoryStatus;
  onOpenRegister: () => void;
  onOpenAdmin: () => void;
}

export const ClientHero: React.FC<ClientHeroProps> = ({
  programConfig,
  inventory,
  onOpenRegister,
  onOpenAdmin
}) => {
  const isSoldOut = programConfig.status === 'SOLD_OUT';
  const isComingSoon = programConfig.status === 'COMING_SOON';
  const statistics = [
    { label: 'Places disponibles', value: `${inventory.availableSeats} / ${programConfig.totalCapacity}` },
    { label: 'Tarif du billet', value: `$${programConfig.ticketPriceUsd.toFixed(2)}` },
    { label: 'Orange Money', value: programConfig.orangeMoneyNumber }
  ];

  return (
    <section className="relative overflow-hidden pt-36 pb-24 sm:pb-28 border-b border-slate-100 dark:border-[#111111] bg-white dark:bg-[#000000] transition-colors duration-200">
      {/* Cinematic Red Ambient Ray */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[420px] bg-gradient-to-b from-[#E50914]/10 dark:from-[#E50914]/16 via-[#E50914]/4 to-transparent blur-3xl pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-6xl mx-auto px-6">
        {/* ============ Editorial Copy Block (centered) ============ */}
        <div className="max-w-4xl mx-auto text-center space-y-7">
          {/* Eyebrow pill : pulsing brand dot + meta */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2.5 bg-slate-50 dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1E1E1E] rounded-full pl-3 pr-4 py-1.5 shadow-xs">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isSoldOut ? 'bg-slate-400' : 'bg-[#E50914]'} opacity-60`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isSoldOut ? 'bg-slate-400' : 'bg-[#E50914]'}`} />
              </span>
              <span className="text-[11px] font-bold font-montserrat uppercase tracking-wider text-slate-900 dark:text-white">
                {programConfig.kicker || 'PIGA STUDIO TECH MEDIA'}
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-[#333333]" aria-hidden="true" />
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tracking-wide">
                {programConfig.dateDisplay}{programConfig.timeDisplay ? ` · ${programConfig.timeDisplay}` : ''}
              </span>
            </div>
          </div>

          {/* Oversized display headline */}
          <h1 className="text-[clamp(38px,7vw,86px)] font-black font-montserrat tracking-[-0.035em] leading-[0.98] text-balance text-slate-900 dark:text-white">
            {programConfig.title}
          </h1>

          {/* Asterisk footnote tagline — subscrr style */}
          {programConfig.tagline && (
            <p className="text-sm font-semibold font-poppins text-slate-400 dark:text-slate-500 tracking-wide text-center">
              *{programConfig.tagline}
            </p>
          )}

          {/* Description lead */}
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-inter max-w-2xl mx-auto">
            {programConfig.description}
          </p>

          {/* Pill CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
            <button
              onClick={onOpenRegister}
              disabled={isSoldOut}
              className={`group px-8 py-4 text-xs font-bold font-montserrat tracking-wide rounded-full transition-all flex items-center justify-center gap-2.5 ${
                isSoldOut
                  ? 'bg-slate-200 dark:bg-[#121212] text-slate-500 cursor-not-allowed'
                  : 'text-white bg-[#E50914] hover:bg-[#C80711] shadow-lg shadow-[#E50914]/25 hover:shadow-xl hover:shadow-[#E50914]/30 hover:-translate-y-0.5 cursor-pointer'
              }`}
            >
              <span>
                {isSoldOut
                  ? 'Inscriptions Fermées (Complet)'
                  : `${isComingSoon ? 'Se Pré-inscrire' : "S'inscrire"} par Orange Money · $${programConfig.ticketPriceUsd.toFixed(2)}`}
              </span>
              {!isSoldOut && (
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              )}
            </button>

            <a
              href="#programme"
              className="px-8 py-4 text-xs font-bold font-montserrat tracking-wide text-slate-800 dark:text-white bg-white dark:bg-[#0E0E0E] border border-slate-300 dark:border-[#262626] hover:border-[#E50914]/60 rounded-full transition-all hover:-translate-y-0.5 inline-flex items-center justify-center"
            >
              Voir le programme
            </a>

            <button
              onClick={onOpenAdmin}
              className="px-6 py-4 text-xs font-semibold font-inter text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 rounded-full transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Console Supervision Admin"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Console Supervision</span>
            </button>
          </div>

          {/* Floating glass stat chips */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-3">
            {statistics.map(stat => (
              <div
                key={stat.label}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/75 dark:bg-[#0A0A0A]/75 backdrop-blur-md border border-slate-200 dark:border-[#1E1E1E] shadow-xs"
              >
                <span className="text-[10px] uppercase tracking-wider font-bold font-montserrat text-slate-400 dark:text-slate-500">{stat.label}</span>
                <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ============ Showcase Frame ============ */}
        <div className="relative mt-16 sm:mt-20 max-w-4xl mx-auto">
          <div className="relative rounded-[28px] overflow-hidden border border-slate-200 dark:border-[#1E1E1E] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.25)] dark:shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]">
            <img
              src={resolveFormationImageUrl(programConfig.heroImageUrl, HERO_IMAGE_FALLBACK)}
              alt={programConfig.title}
              className="w-full h-auto object-cover aspect-[16/9]"
              referrerPolicy="no-referrer"
            />

            {/* Bottom glass overlay */}
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] font-bold font-montserrat text-white/60 mb-1.5">
                    Session Présentielle & Diffusion Chiffrée
                  </div>
                  <div className="text-lg sm:text-xl font-black font-montserrat text-white tracking-tight flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#E50914] shrink-0" />
                    <span>{programConfig.locationDisplay || 'PIGA STUDIO TECH HUB'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="px-4 py-2 rounded-full bg-white/10 dark:bg-white/10 backdrop-blur-md border border-white/20">
                    <span className="font-mono text-xs font-bold text-white">{programConfig.dateDisplay}</span>
                  </div>
                  <div className="px-4 py-2 rounded-full bg-[#E50914] backdrop-blur-md shadow-lg shadow-[#E50914]/40">
                    <span className="font-mono text-xs font-bold text-white">${programConfig.ticketPriceUsd.toFixed(2)} USD</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Shadow accent */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-[#E50914]/10 blur-3xl rounded-full pointer-events-none" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
};
