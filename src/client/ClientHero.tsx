/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PIGA STUDIO — Dynamic Client Hero Section
 * Fully customizable via Admin Dashboard: Title, Tagline, Date, Pricing, and Media.
 * Dual theme support (Pure White #FFFFFF & Absolute Black #000000).
 */

import React from 'react';
import { ArrowRight, Lock, Calendar, Clock, MapPin } from 'lucide-react';
import type { InventoryStatus, ProgramConfig } from '../types/index.ts';

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

  return (
    <section className="relative overflow-hidden pt-12 pb-20 border-b border-slate-200 dark:border-[#1E1E1E] bg-white dark:bg-[#000000] transition-colors duration-200">
      {/* Cinematic Red Ambient Ray */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[380px] bg-gradient-to-b from-[#E50914]/10 dark:from-[#E50914]/15 via-[#E50914]/5 to-transparent blur-3xl pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-6">
        {/* Brand Kicker & Session Date */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold tracking-wider text-[#E50914] uppercase font-montserrat mb-4">
          <span className="bg-[#E50914]/10 dark:bg-[#E50914]/15 border border-[#E50914]/30 px-2 py-0.5 rounded text-[11px] font-bold">
            {programConfig.kicker || 'PIGA STUDIO TECH MEDIA'}
          </span>
          <span className="text-slate-400 dark:text-slate-600" aria-hidden="true">·</span>
          <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#E50914]" />
            <span>{programConfig.dateDisplay}</span>
          </span>
          {programConfig.timeDisplay && (
            <>
              <span className="text-slate-400 dark:text-slate-600" aria-hidden="true">·</span>
              <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{programConfig.timeDisplay}</span>
              </span>
            </>
          )}
        </div>

        {/* 2-Column Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Column 1: Editorial Pitch */}
          <div className="lg:col-span-7 space-y-6">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black font-montserrat tracking-tight text-slate-900 dark:text-white leading-[1.08] text-balance">
              {programConfig.title}
            </h1>

            {programConfig.tagline && (
              <div className="text-sm font-semibold font-poppins text-[#E50914] tracking-wide">
                {programConfig.tagline}
              </div>
            )}

            <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed font-inter max-w-2xl">
              {programConfig.description}
            </p>

            {/* Exclusive Orange Money Box */}
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#222222] space-y-2.5 transition-colors">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-300 font-poppins flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#E50914]" />
                  Paiement Exclusif Orange Money :
                </span>
                <span className="font-mono text-[#E50914] font-bold text-sm">
                  ${programConfig.ticketPriceUsd.toFixed(2)} USD
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">Numéro Officiel de Versement :</span>
                <span className="font-mono text-slate-900 dark:text-white font-bold bg-white dark:bg-[#151515] px-2.5 py-1 rounded border border-slate-300 dark:border-[#2A2A2A] shadow-xs">
                  {programConfig.orangeMoneyNumber}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 pt-0.5">
                Titulaire : {programConfig.orangeMoneyHolder || 'PIGA STUDIO'} · Direction : {programConfig.directionEmail} ({programConfig.directionPhone})
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
              <button
                onClick={onOpenRegister}
                disabled={isSoldOut}
                className={`px-7 py-3.5 text-xs font-bold font-montserrat tracking-wide rounded-md transition-all shadow-lg flex items-center justify-center gap-2.5 cursor-pointer ${
                  isSoldOut
                    ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'text-white bg-[#E50914] hover:bg-[#C80711] shadow-[#E50914]/20'
                }`}
              >
                {isSoldOut ? (
                  <span>Inscriptions Fermées (Complet)</span>
                ) : isComingSoon ? (
                  <>
                    <span>Se Pré-inscrire par Orange Money · ${programConfig.ticketPriceUsd.toFixed(2)} USD</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>S'inscrire par Orange Money · ${programConfig.ticketPriceUsd.toFixed(2)} USD</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                onClick={onOpenAdmin}
                className="px-5 py-3.5 text-xs font-semibold font-inter text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-[#111111] dark:hover:bg-[#1A1A1A] border border-slate-300 dark:border-[#222222] rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="w-4 h-4 text-[#E50914]" />
                <span>Console Supervision Admin</span>
              </button>
            </div>

            {/* Inventory Real-Time */}
            <div className="pt-2 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-3 font-inter">
              <span className="font-medium text-slate-900 dark:text-white">Places Disponibles :</span>
              <span className="font-mono tabular-nums text-[#E50914] font-bold">
                {inventory.availableSeats} restantes
              </span>
              <span className="text-slate-400 dark:text-slate-700" aria-hidden="true">/</span>
              <span className="font-mono tabular-nums text-slate-500">
                {programConfig.totalCapacity} places au total
              </span>
            </div>
          </div>

          {/* Column 2: Architectural Asset */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-[#222222] bg-slate-100 dark:bg-[#0A0A0A] shadow-xl">
              <img
                src={programConfig.heroImageUrl || "/src/assets/images/hero_arsenal_agentique_1793949804735.jpg"}
                alt={programConfig.title}
                className="w-full h-auto object-cover aspect-[16/10] hover:scale-102 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              
              {/* Overlay Ribbon */}
              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/70 to-transparent flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white font-montserrat tracking-wide flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#E50914]" />
                    <span>{programConfig.locationDisplay || 'PIGA STUDIO TECH HUB'}</span>
                  </div>
                  <div className="text-[11px] text-slate-300 font-inter">Billetterie cryptographique AES-256-GCM</div>
                </div>
                <div className="font-mono text-[#E50914] font-bold text-xs">
                  {programConfig.dateDisplay}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
