/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Arsenal Agentique - Root Application Component
 * Masterclass Onboarding & Cryptographic Ticketing System (November 13, 2026)
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { HeroSection } from './components/HeroSection.tsx';
import { CurriculumOverview } from './components/CurriculumOverview.tsx';
import { OnboardingFlow } from './components/OnboardingFlow.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { TicketVerificationView } from './components/TicketVerificationView.tsx';
import { Footer } from './components/Footer.tsx';
import { api } from './services/api.ts';
import type { InventoryStatus } from './types/index.ts';

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'admin' | 'verify'>('home');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [urlToken, setUrlToken] = useState<string>('');
  
  const [inventory, setInventory] = useState<InventoryStatus>({
    totalCapacity: 80,
    confirmedSeats: 1,
    pendingVerifications: 1,
    availableSeats: 78,
    ticketPriceUsd: 20.00
  });

  // URL Routing Sync
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      const params = new URLSearchParams(window.location.search);

      if (path.startsWith('/admin') || hash === '#admin') {
        setCurrentView('admin');
      } else if (path.startsWith('/verify') || hash.startsWith('#verify') || params.has('verify') || params.has('token')) {
        const token = path.replace('/verify/', '').replace('/verify', '') || 
                      params.get('verify') || 
                      params.get('token') || 
                      hash.replace('#verify/', '').replace('#verify', '');
        setUrlToken(token);
        setCurrentView('verify');
      } else {
        setCurrentView('home');
      }
    };

    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Fetch real-time seat inventory
  const refreshInventory = async () => {
    try {
      const stats = await api.getInventoryStats();
      setInventory(stats);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    refreshInventory();
  }, []);

  const handleNavigate = (view: 'home' | 'admin' | 'verify') => {
    setCurrentView(view);
    if (view === 'admin') {
      window.history.pushState(null, '', '#admin');
    } else if (view === 'verify') {
      window.history.pushState(null, '', '#verify');
    } else {
      window.history.pushState(null, '', '/');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#0B0C0E] text-slate-100 flex flex-col font-sans selection:bg-[#E05E2B]/20 selection:text-white">
      {/* Dynamic Header */}
      {currentView !== 'admin' && (
        <Header
          currentView={currentView}
          onNavigate={handleNavigate}
          onOpenRegister={() => setIsOnboardingOpen(true)}
          availableSeats={inventory.availableSeats}
        />
      )}

      {/* Main View Router */}
      <main className="flex-1">
        {currentView === 'home' && (
          <>
            <HeroSection
              inventory={inventory}
              onOpenRegister={() => setIsOnboardingOpen(true)}
              onNavigateVerify={() => handleNavigate('verify')}
            />
            <CurriculumOverview
              onOpenRegister={() => setIsOnboardingOpen(true)}
            />
          </>
        )}

        {currentView === 'admin' && (
          <AdminDashboard
            onBackToSite={() => handleNavigate('home')}
          />
        )}

        {currentView === 'verify' && (
          <TicketVerificationView
            initialToken={urlToken}
            onBack={() => handleNavigate('home')}
          />
        )}
      </main>

      {/* 3-Step Onboarding Modal */}
      <OnboardingFlow
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onSuccess={() => {
          refreshInventory();
        }}
      />

      {/* Footer */}
      {currentView !== 'admin' && (
        <Footer
          onNavigate={handleNavigate}
          onOpenRegister={() => setIsOnboardingOpen(true)}
        />
      )}
    </div>
  );
}
