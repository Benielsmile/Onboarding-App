/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PIGA STUDIO — Web Push & Native PWA Notification Engine
 * Allows the admin dashboard to run standalone as an installed app (desktop & mobile)
 * and dispatches system notification bar alerts upon participant registration.
 */

import { useState, useEffect } from 'react';

export async function registerPwaServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return reg;
  } catch (err) {
    console.warn('[PIGA PWA] Service Worker registration skipped:', err);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch {
    return Notification.permission;
  }
}

// ============================================================================
// PUSH SERVEUR (W3C Web Push / VAPID) — abonnement d'un terminal
// ============================================================================
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Demande la permission puis enregistre le terminal sur le serveur push.
 * audience 'ADMIN' = Direction (session zéro-trust exigée côté serveur),
 * audience 'AMBASSADEUR' = alertes ventes temps réel du lien magique.
 */
export async function subscribeWebPush(
  audience: 'ADMIN' | 'AMBASSADOR',
  ambassadorCode?: string
): Promise<{ ok: boolean; message: string }> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, message: 'Notifications push non supportées sur cet appareil.' };
  }

  try {
    const keyRes = await fetch('/api/push/public-key');
    const keyData = await keyRes.json();
    if (!keyData.enabled || !keyData.publicKey) {
      return { ok: false, message: 'Notifications push non configurées (clés VAPID manquantes côté serveur).' };
    }

    const perm = await requestNotificationPermission();
    if (perm !== 'granted') {
      return { ok: false, message: 'Permission de notification refusée par l\'appareil.' };
    }

    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const subscription = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.publicKey) as BufferSource
    });

    const json = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, message: 'Abonnement push incomplet.' };
    }

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        audience,
        ambassadorCode
      })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { ok: false, message: data.message || 'Échec de l\'enregistrement push sur le serveur.' };
    }
    return { ok: true, message: audience === 'ADMIN' ? 'Terminal Direction inscrit — alertes paiements actives.' : 'Alertes ventes temps réel activées !' };
  } catch (err) {
    console.error('[PIGA PUSH SUBSCRIBE ERROR]:', err);
    return { ok: false, message: 'Erreur lors de l\'activation des notifications push.' };
  }
}

/** Désinscrit le terminal du service push serveur */
export async function unsubscribeWebPush(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      }).catch(() => {});
      await subscription.unsubscribe().catch(() => {});
    }
  } catch {
    // Silencieux
  }
}

export async function triggerNativePushNotification(title: string, body: string, data?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;

  // 1. Try Service Worker Notification (Native System Bar on Mobile/Desktop)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.active) {
        reg.active.postMessage({
          type: 'SHOW_NOTIFICATION',
          title,
          body,
          tag: 'piga-registration-' + Date.now(),
          data
        });
        return;
      }
    } catch (err) {
      console.warn('[PIGA NOTIFICATION] SW postMessage failed, falling back:', err);
    }
  }

  // 2. Standard Web Notification API Fallback
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'piga-registration',
        vibrate: [200, 100, 200]
      } as NotificationOptions);
    } catch {
      // Notification constructor on mobile Safari or restricted environments
    }
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install
  };
}
