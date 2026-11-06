/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PIGA STUDIO — Dynamic Training Platform & Billetterie Orange Money
 * Root Application Router with ThemeProvider & Dynamic Formation Engine
 */

import React, { useState, useEffect } from 'react';
import { ClientHeader } from './client/ClientHeader.tsx';
import { ClientHero } from './client/ClientHero.tsx';
import { ClientCurriculum } from './client/ClientCurriculum.tsx';
import { ClientOnboardingModal } from './client/ClientOnboardingModal.tsx';
import { ClientFooter } from './client/ClientFooter.tsx';
import { AdminPortal } from './admin/AdminPortal.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { api } from './services/api.ts';
import { BrandLoader } from './components/BrandLoader.tsx';
import { registerPwaServiceWorker } from './utils/pwaNotifications.ts';
import { DEFAULT_PROGRAM_CONFIG } from './utils/programPresets.ts';
import type { InventoryStatus, ProgramConfig } from './types/index.ts';

function AppContent() {
  const [isAdminView, setIsAdminView] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isBooting, setIsBooting] = useState(true);

  // Dynamic Formation Configuration managed by Admin Dashboard
  const [programConfig, setProgramConfig] = useState<ProgramConfig>(DEFAULT_PROGRAM_CONFIG);

  const [inventory, setInventory] = useState<InventoryStatus>({
    totalCapacity: DEFAULT_PROGRAM_CONFIG.totalCapacity,
    confirmedSeats: 1,
    pendingVerifications: 1,
    availableSeats: DEFAULT_PROGRAM_CONFIG.totalCapacity - 2,
    ticketPriceUsd: DEFAULT_PROGRAM_CONFIG.ticketPriceUsd
  });

  // Register PWA Service Worker on load
  useEffect(() => {
    registerPwaServiceWorker();
  }, []);

  // Sync route and hash for Admin vs Client
  useEffect(() => {
    const handleLocationChange = () => {
      const hash = window.location.hash;
      const path = window.location.pathname;

      if (hash.startsWith('#admin') || path.startsWith('/admin')) {
        setIsAdminView(true);
      } else {
        setIsAdminView(false);
      }
    };

    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Sync real-time inventory and dynamic program configuration
  const refreshAllData = async () => {
    try {
      const [stats, config] = await Promise.all([
        api.getInventoryStats(),
        api.getProgramConfig()
      ]);
      setInventory(stats);
      setProgramConfig(config);
    } catch {
      // Safe fallback
    }
  };

  // Brand boot: hydrate config + inventory behind the PIGA splash loader
  useEffect(() => {
    let alive = true;
    const startedAt = Date.now();
    const boot = async () => {
      try {
        await refreshAllData();
      } catch {
        // Safe fallback: DEFAULT_PROGRAM_CONFIG already rendered
      }
      // Enforce a minimum splash so the brand reveal feels intentional
      const remaining = Math.max(0, 900 - (Date.now() - startedAt));
      await new Promise(resolve => setTimeout(resolve, remaining));
      if (alive) setIsBooting(false);
    };
    boot();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdmin = () => {
    setIsAdminView(true);
    window.history.pushState(null, '', '#admin');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeAdmin = () => {
    setIsAdminView(false);
    window.history.pushState(null, '', '/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Called when Admin edits the formation or loads a preset
  const handleProgramConfigUpdated = (newConfig: ProgramConfig) => {
    setProgramConfig(newConfig);
    refreshAllData();
  };

  return (
    <div id="top" className="min-h-screen bg-white dark:bg-[#000000] text-slate-900 dark:text-slate-100 flex flex-col font-inter selection:bg-[#E50914]/30 selection:text-white transition-colors duration-200">
      <BrandLoader visible={isBooting} status="Synchronisation de la formation…" />
      {isAdminView ? (
        // Dedicated Isolated Admin Portal (with CMS Formation Editor tab)
        <AdminPortal 
          onBackToClient={closeAdmin} 
          currentConfig={programConfig}
          onConfigUpdated={handleProgramConfigUpdated}
        />
      ) : (
        // Public Dynamic Client Application
        <>
          <ClientHeader
            programConfig={programConfig}
            onOpenRegister={() => setIsOnboardingOpen(true)}
            onOpenAdmin={openAdmin}
          />

          <main className="flex-1">
            <ClientHero
              programConfig={programConfig}
              inventory={inventory}
              onOpenRegister={() => setIsOnboardingOpen(true)}
              onOpenAdmin={openAdmin}
            />

            <ClientCurriculum
              programConfig={programConfig}
              onOpenRegister={() => setIsOnboardingOpen(true)}
            />
          </main>

          <ClientOnboardingModal
            programConfig={programConfig}
            isOpen={isOnboardingOpen}
            onClose={() => setIsOnboardingOpen(false)}
            onSuccess={() => {
              refreshAllData();
            }}
          />

          <ClientFooter
            programConfig={programConfig}
            onOpenAdmin={openAdmin}
            onOpenRegister={() => setIsOnboardingOpen(true)}
          />
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
