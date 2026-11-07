/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Official PIGA STUDIO Logo Component
 * Incorporates the two official brand assets provided by PIGA STUDIO:
 * - Logo 1: /assets/aistudio/PIGA_LOGO_OFFICIEL_1_8d9f27ba.png (Full brand mark with geometric parallelogram, red capsule, & triangle)
 * - Logo 2: /assets/aistudio/PIGA_LOGO_OFFICIEL_2_24ff6bb2.png (Streamlined red wordmark with angled STUDIO)
 * Fully supports Dark Mode (#000000) and Light Mode (#FFFFFF) environments.
 */

import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext.tsx';

export const PIGA_LOGO_1_SRC = '/assets/aistudio/PIGA_LOGO_OFFICIEL_1_8d9f27ba.png';
export const PIGA_LOGO_2_SRC = '/assets/aistudio/PIGA_LOGO_OFFICIEL_2_24ff6bb2.png';

export interface PigaLogoProps {
  variant?: 'full' | 'compact' | 'symbol-only' | 'logo1' | 'logo2';
  theme?: 'dark' | 'light';
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  forceLogo?: 'logo1' | 'logo2';
}

export const PigaLogo: React.FC<PigaLogoProps> = ({
  variant = 'compact',
  theme: explicitTheme,
  className = '',
  size = 'md',
  forceLogo
}) => {
  const { isDark, logoVariant: contextLogoVariant } = useTheme();
  const [imageError, setImageError] = useState(false);

  // Determine active theme
  const currentTheme = explicitTheme || (isDark ? 'dark' : 'light');
  const isLight = currentTheme === 'light';

  // Determine which official logo file to display
  const activeLogoChoice = forceLogo || (
    variant === 'logo1' 
      ? 'logo1' 
      : variant === 'logo2' 
      ? 'logo2' 
      : contextLogoVariant
  );

  const logoSrc = activeLogoChoice === 'logo2' ? PIGA_LOGO_2_SRC : PIGA_LOGO_1_SRC;

  // Responsive dimensions
  const heightClasses = {
    sm: 'h-7 sm:h-8',
    md: 'h-9 sm:h-10 md:h-11',
    lg: 'h-12 sm:h-14',
    xl: 'h-16 sm:h-20'
  }[size];

  // SYMBOL-ONLY : glyphe géométrique officiel (parallélogramme + capsule + triangle),
  // sans wordmark — destiné aux très petits écrans où "PIGA STUDIO" ne tient pas.
  if (variant === 'symbol-only') {
    return (
      <div className={`inline-flex items-center select-none ${className}`} title="PIGA STUDIO">
        <svg
          viewBox="0 0 160 160"
          className={`${heightClasses} w-auto`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="PIGA STUDIO"
        >
          {/* Parallélogramme cadre */}
          <path
            d="M 62 22 L 112 22 L 42 140 L -8 140 Z"
            stroke={isLight ? '#000000' : '#FFFFFF'}
            strokeWidth="12"
            strokeLinejoin="round"
          />
          {/* Capsule rouge (angle -45°, sans texte — trop petit pour lire) */}
          <g transform="translate(60, 88) rotate(-45)">
            <rect x="0" y="0" width="84" height="30" rx="6" fill="#E50914" />
          </g>
          {/* Triangle rouge */}
          <polygon points="128,66 156,118 100,118" fill="#E50914" />
        </svg>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Left Framed Tagline in 'full' variant */}
      {variant === 'full' && (
        <div className={`hidden lg:flex items-center px-1.5 py-1.5 rounded border transition-colors ${
          isLight 
            ? 'border-slate-300 bg-slate-50 text-slate-600' 
            : 'border-white/20 bg-black/40 text-slate-400'
        }`}>
          <span 
            className="text-[8px] font-mono tracking-widest uppercase leading-none [writing-mode:vertical-lr] rotate-180"
          >
            The AI Venture Studio &amp; Tech Media
          </span>
        </div>
      )}

      {/* Official PNG Logo Image */}
      {!imageError ? (
        <div className="flex items-center">
          <img
            src={logoSrc}
            alt="PIGA STUDIO Logo Officiel"
            className={`${heightClasses} w-auto object-contain transition-all duration-300 drop-shadow-xs`}
            onError={() => setImageError(true)}
          />
        </div>
      ) : (
        // High-fidelity Vector Fallback if image asset is unavailable
        <div className="flex items-center gap-1.5">
          <span className="font-montserrat font-black text-3xl sm:text-4xl text-[#E50914] leading-none">
            PIG
          </span>
          <div className="relative w-10 h-10 flex items-center justify-center">
            <svg
              viewBox="0 0 160 160"
              className="w-10 h-10"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M 68 18 L 118 18 L 38 142 L -12 142 Z"
                stroke={isLight ? '#000000' : '#FFFFFF'}
                strokeWidth="7"
                strokeLinejoin="round"
              />
              <g transform="translate(66, 92) rotate(-45)">
                <rect x="0" y="0" width="80" height="28" rx="4" fill="#E50914" />
                <text
                  x="40"
                  y="18"
                  fontFamily="'Inter', sans-serif"
                  fontWeight="900"
                  fontSize="11"
                  fill="#FFFFFF"
                  textAnchor="middle"
                  letterSpacing="1.5"
                >
                  STUDIO
                </text>
              </g>
              <polygon points="122,72 146,114 98,114" fill="#E50914" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};
