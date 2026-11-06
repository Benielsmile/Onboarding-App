/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Quiet Footer: Clean unboxed metadata, zero-slop legal notices
 */

import React from 'react';
import { ShieldCheck, Lock } from 'lucide-react';

interface FooterProps {
  onNavigate: (view: 'home' | 'admin' | 'verify') => void;
  onOpenRegister: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenRegister }) => {
  return (
    <footer className="bg-[#0B0C0E] border-t border-[#1E222A] py-14">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-[#1E222A]">
          {/* Brand & Mission */}
          <div className="md:col-span-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[#E05E2B] rounded-xs inline-block" />
              <span className="text-base font-bold tracking-tight text-white">ARSENAL AGENTIQUE</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Programme d'ingénierie et de sécurité offensive dédié aux architectures d'agents d'intelligence artificielle autonomes. 
              Session programmée pour le vendredi 13 novembre 2026.
            </p>
            <div className="text-[11px] text-slate-500 font-mono pt-1">
              Architecture : IBM Secure-by-Design · OWASP Top 10 for LLMs · AES-256-GCM
            </div>
          </div>

          {/* Navigation Mirrors */}
          <div className="md:col-span-3 space-y-3">
            <div className="text-xs font-semibold text-white uppercase tracking-wider">
              Navigation
            </div>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <button 
                  onClick={() => onNavigate('home')} 
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Programme &amp; Architecture
                </button>
              </li>
              <li>
                <a 
                  href="#modalites" 
                  className="hover:text-white transition-colors"
                >
                  Modalités &amp; Tarifs ($20 USD)
                </a>
              </li>
              <li>
                <button 
                  onClick={() => onNavigate('verify')} 
                  className="hover:text-[#E05E2B] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Vérification Cryptographique</span>
                </button>
              </li>
              <li>
                <button 
                  onClick={() => onNavigate('admin')} 
                  className="hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Console d'Administration (/admin)</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Direct Mobile Money & Contacts */}
          <div className="md:col-span-4 space-y-3">
            <div className="text-xs font-semibold text-white uppercase tracking-wider">
              Assistance &amp; Trésorerie RDC
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Pour toute assistance relative aux transferts Mobile Money (Vodacom M-Pesa, Orange Money, Airtel Money) :
            </p>
            <div className="space-y-1 font-mono text-xs text-slate-300">
              <div>Vodacom M-Pesa : +243 810 000 000</div>
              <div>Orange Money : +243 890 000 000</div>
              <div>Support Chiffré : contact@arsenal-agentique.tech</div>
            </div>
          </div>
        </div>

        {/* Bottom Unboxed Meta */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            &copy; 2026 Arsenal Agentique. Tous droits réservés.
          </div>
          <div className="flex items-center gap-3">
            <span>Politique Zéro-Trust</span>
            <span aria-hidden="true">·</span>
            <span>Accréditation Certifiée</span>
            <span aria-hidden="true">·</span>
            <span>RDC Telecom Compliant</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
