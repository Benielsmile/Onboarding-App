/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PIGA STUDIO — Official Brand Boot Loader
 * Full-screen splash shown while the platform hydrates (formation config,
 * inventory, session). Showcases the official PIGA VENTURE STUDIO emblem with
 * a rise-in animation and a shimmering red rail, then fades out gracefully.
 * Honours the active theme (Pure White / Absolute Black).
 */

import React from 'react';
import { PigaLogo } from './PigaLogo.tsx';
import { useTheme } from '../context/ThemeContext.tsx';

interface BrandLoaderProps {
  visible: boolean;
  /** Optional status line, e.g. "Synchronisation de la formation…" */
  status?: string;
}

export const BrandLoader: React.FC<BrandLoaderProps> = ({ visible, status }) => {
  const { isDark } = useTheme();

  if (!visible) return null;

  return (
    <div
      className={`piga-loader-exit fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 ${
        isDark ? 'bg-[#000000]' : 'bg-[#FFFFFF]'
      }`}
      role="status"
      aria-live="polite"
      aria-label="Chargement de la plateforme PIGA STUDIO"
    >
      {/* Ambient red halo */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[280px] rounded-full blur-3xl pointer-events-none"
        style={{ background: isDark ? 'rgba(229, 9, 20, 0.14)' : 'rgba(229, 9, 20, 0.08)' }}
        aria-hidden="true"
      />

      {/* Official emblem — rise in */}
      <div className="piga-loader-rise relative">
        <PigaLogo variant="compact" size="xl" />
      </div>

      {/* Shimmering red progress rail */}
      <div className="piga-loader-rise relative w-52 h-[3px] rounded-full overflow-hidden bg-slate-200 dark:bg-[#151515]" aria-hidden="true">
        <div className="piga-loader-rail absolute inset-0" />
      </div>

      {/* Boot status */}
      <div className="piga-loader-rise text-center space-y-1.5">
        <p className="text-[10px] font-bold font-montserrat uppercase tracking-[0.35em] text-slate-900 dark:text-white">
          PIGA STUDIO
        </p>
        <p className="text-[11px] font-inter text-slate-500 dark:text-slate-400">
          {status || 'Chargement de la plateforme…'}
        </p>
      </div>
    </div>
  );
};
