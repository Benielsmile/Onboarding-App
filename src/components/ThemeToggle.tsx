/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PIGA STUDIO — Theme Toggle Component
 * Allows seamless switching between Dark Mode (#000000) and Light Mode (#FFFFFF)
 * with animated transitions and accessible ARIA attributes.
 */

import React from 'react';
import { Sun, Moon, Layers } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.tsx';

interface ThemeToggleProps {
  showLogoToggle?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  showLogoToggle = false,
  className = '',
  size = 'md'
}) => {
  const { theme, isDark, toggleTheme, logoVariant, toggleLogoVariant } = useTheme();

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {/* Theme Switcher Button */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'Passer en mode clair (Blanc Pur)' : 'Passer en mode sombre (Noir Absolu)'}
        title={isDark ? 'Passer en mode clair (#FFFFFF)' : 'Passer en mode sombre (#000000)'}
        className={`relative inline-flex items-center justify-center rounded-lg transition-all cursor-pointer border ${
          size === 'sm' ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-sm'
        } ${
          isDark
            ? 'bg-[#121212] hover:bg-[#1C1C1C] text-amber-400 border-[#2A2A2A] shadow-inner'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 shadow-xs'
        }`}
      >
        {isDark ? (
          <Sun className="w-4 h-4 transition-transform hover:rotate-45 text-amber-400" />
        ) : (
          <Moon className="w-4 h-4 transition-transform hover:-rotate-12 text-[#E50914]" />
        )}
      </button>

      {/* Optional Logo Variant Switcher (Logo 1 vs Logo 2) */}
      {showLogoToggle && (
        <button
          type="button"
          onClick={toggleLogoVariant}
          aria-label="Basculer le logo officiel PIGA (Logo 1 / Logo 2)"
          title={`Logo Actif : ${logoVariant === 'logo1' ? 'Logo 1 (PIGA Monogramme)' : 'Logo 2 (PIG Typographique)'} - Cliquer pour changer`}
          className={`relative inline-flex items-center gap-1 px-2 rounded-lg transition-all cursor-pointer border text-[11px] font-semibold font-mono ${
            size === 'sm' ? 'h-8' : 'h-9'
          } ${
            isDark
              ? 'bg-[#121212] hover:bg-[#1C1C1C] text-slate-300 border-[#2A2A2A]'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-[#E50914]" />
          <span>{logoVariant === 'logo1' ? 'L1' : 'L2'}</span>
        </button>
      )}
    </div>
  );
};
