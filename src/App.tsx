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
import { AmbassadorPortal } from './client/AmbassadorPortal.tsx';
import { AdminPortal } from './admin/AdminPortal.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { api } from './services/api.ts';
import { BrandLoader } from './components/BrandLoader.tsx';
import { registerPwaServiceWorker } from './utils/pwaNotifications.ts';
import { DEFAULT_PROGRAM_CONFIG } from './utils/programPresets.ts';
import type { InventoryStatus, ProgramConfig } from './types/index.ts';

/** Parse les paramètres d'un hash de type `#ambassadeur?ref=AMB-XXXX` */
function parseHashQuery(hash: string): URLSearchParams {
  const qIndex = hash.indexOf('?');
  return new URLSearchParams(qIndex >= 0 ? hash.slice(qIndex + 1) : '');
}

function AppContent() {
  const [isAdminView, setIsAdminView] = useState(false);
  const [isAmbassadorView, setIsAmbassadorView] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isBooting, setIsBooting] = useState(true);

  // Code d'affiliation capturé depuis ?ref=AMB-XXXX (persiste la session du modal)
  const [ambassadorRef, setAmbassadorRef] = useState<string | null>(() => sessionStorage.getItem('piga_ref'));

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

  // Sync route and hash for Admin / Ambassador / Client + capture ?ref=
  useEffect(() => {
    const handleLocationChange = () => {
      const hash = window.location.hash;
      const path = window.location.pathname;

      if (hash.startsWith('#admin') || path.startsWith('/admin')) {
        setIsAdminView(true);
        setIsAmbassadorView(false);
        return;
      }
      setIsAdminView(false);

      if (hash.startsWith('#ambassadeur')) {
        setIsAmbassadorView(true);
        return;
      }
      setIsAmbassadorView(false);

      // Capture du lien magique ambassadeur : ?ref=AMB-XXXX (search ou hash-query)
      const ref =
        new URLSearchParams(window.location.search).get('ref') ||
        parseHashQuery(hash).get('ref');
      if (ref && /^[A-Za-z0-9_-]{3,32}$/.test(ref)) {
        sessionStorage.setItem('piga_ref', ref);
        setAmbassadorRef(ref);
        const trackKey = `piga_ref_tracked_${ref}`;
        if (!sessionStorage.getItem(trackKey)) {
          sessionStorage.setItem(trackKey, '1');
          void api.trackAmbassadorClick(ref);
        }
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

    // Pont vers le splash statique index.html (pré-paint logo favicon)
    const splashHost = window as unknown as { __pigaSplash?: { hide?: () => void } };
    const syncSplashStatus = (status: string) => {
      const el = document.getElementById('piga-splash-status');
      if (el) el.textContent = status;
    };

    const startedAt = Date.now();
    const boot = async () => {
      syncSplashStatus('Synchronisation de la formation…');
      try {
        await refreshAllData();
      } catch {
        // Safe fallback: DEFAULT_PROGRAM_CONFIG already rendered
      }
      // Enforce a minimum splash so the brand reveal feels intentional
      const remaining = Math.max(0, 900 - (Date.now() - startedAt));
      await new Promise(resolve => setTimeout(resolve, remaining));
      if (alive) {
        setIsBooting(false);
        // La BrandLoader React prend le relais : dissolution du splash statique
        splashHost.__pigaSplash?.hide?.();
      }
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

  const openAmbassador = () => {
    setIsAmbassadorView(true);
    window.history.pushState(null, '', '#ambassadeur');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeAmbassador = () => {
    setIsAmbassadorView(false);
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
      ) : isAmbassadorView ? (
        // Espace Ambassadeur PIGA STUDIO (recrutement public + tableau de bord)
        <AmbassadorPortal
          onBackToClient={closeAmbassador}
          initialRef={ambassadorRef}
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
            refCode={ambassadorRef ?? undefined}
            onClose={() => setIsOnboardingOpen(false)}
            onSuccess={() => {
              refreshAllData();
            }}
          />

          <ClientFooter
            programConfig={programConfig}
            onOpenAdmin={openAdmin}
            onOpenRegister={() => setIsOnboardingOpen(true)}
            onOpenAmbassador={openAmbassador}
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
