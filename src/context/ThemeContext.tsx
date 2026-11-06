/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PIGA STUDIO — Theme Context & Manager
 * Provides instant Dark/Light mode switching with persistent localStorage
 * and automatic synchronization with Tailwind's .dark class on <html>.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  logoVariant: 'logo1' | 'logo2';
  toggleLogoVariant: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  isDark: true,
  toggleTheme: () => {},
  setTheme: () => {},
  logoVariant: 'logo1',
  toggleLogoVariant: () => {}
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('piga_theme');
      if (saved === 'light' || saved === 'dark') return saved;
      // Default to dark mode for PIGA STUDIO high-end cinematic aesthetic
      return 'dark';
    }
    return 'dark';
  });

  const [logoVariant, setLogoVariant] = useState<'logo1' | 'logo2'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('piga_logo_variant');
      if (saved === 'logo1' || saved === 'logo2') return saved;
      return 'logo1';
    }
    return 'logo1';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    localStorage.setItem('piga_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
  };

  const toggleLogoVariant = () => {
    setLogoVariant(prev => {
      const next = prev === 'logo1' ? 'logo2' : 'logo1';
      localStorage.setItem('piga_logo_variant', next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === 'dark',
        toggleTheme,
        setTheme,
        logoVariant,
        toggleLogoVariant
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
