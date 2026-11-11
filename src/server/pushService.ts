/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PIGA STUDIO — Service de notifications push serveur (W3C Web Push / VAPID)
 * Alerte en temps réel :
 *  - AMBASSADOR : « vente validée avec ton code, +commission » (dès le clic
 *    Confirmer de la Direction, mais la commission reste en délai de 48h)
 *  - ADMIN : « nouveau paiement Orange Money à vérifier » (dès la soumission
 *    du formulaire d'inscription)
 *
 * Désactivation douce : si VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY ne sont pas
 * déclarées, tout le service est un no-op silencieux (aucune erreur bloquante).
 * Les terminaux morts (404/410) sont automatiquement purgés de la base.
 */

import * as webpush from 'web-push';
import type { NeonStore } from './neonStore.ts';
import type { Participant } from '../types/index.ts';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:direction@piga.cd';

let configured = false;
try {
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configured = true;
    console.log('[PUSH] Web Push VAPID configuré — notifications temps réel actives.');
  } else {
    console.log('[PUSH] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY absentes — push serveur désactivé (no-op).');
  }
} catch (err) {
  console.error('[PUSH] Configuration VAPID invalide :', err);
}

export function isPushEnabled(): boolean {
  return configured;
}

export function getVapidPublicKey(): string | null {
  return configured ? VAPID_PUBLIC_KEY : null;
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

async function sendToSubscriptions(
  store: NeonStore,
  audience: 'ADMIN' | 'AMBASSADOR',
  ambassadorId: string | undefined,
  payload: PushPayload
): Promise<number> {
  if (!configured) return 0;
  const subs = await store.getPushSubscriptions(audience, ambassadorId);
  let sent = 0;

  await Promise.allSettled(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        // Terminal mort / désabonné : purge automatique
        await store.deletePushSubscription(sub.endpoint).catch(() => {});
      }
    }
  }));

  return sent;
}

/** ADMIN : nouvelle inscription / paiement Orange Money à vérifier */
export async function notifyAdminNewPayment(store: NeonStore, participant: Participant): Promise<void> {
  if (!configured) return;
  try {
    await sendToSubscriptions(store, 'ADMIN', undefined, {
      title: 'PIGA STUDIO · Nouveau Paiement Orange Money',
      body: `${participant.fullName} a soumis une preuve ($${(participant.priceUsd ?? 20).toFixed(2)}) — réf : ${participant.transactionReference}. À vérifier dans la console.`,
      url: '/#admin',
      tag: `piga-admin-payment-${participant.id}`
    });
  } catch (err) {
    console.error('[PUSH ADMIN ERROR]:', err);
  }
}

/** AMBASSADEUR : vente validée avec son code (commission gagnée, délai 48h) */
export async function notifyAmbassadorSale(
  store: NeonStore,
  participant: Participant
): Promise<void> {
  if (!configured || !participant.ambassadorCode) return;
  try {
    const ambassador = await store.getAmbassadorByCode(participant.ambassadorCode);
    if (!ambassador) return;

    const commission = participant.commissionUsd
      ?? Math.round((participant.priceUsd ?? 20) * ambassador.commissionRate * 100) / 100;

    const sent = await sendToSubscriptions(store, 'AMBASSADOR', ambassador.id, {
      title: '🎉 PIGA STUDIO — Vente validée !',
      body: `Une vente avec ton code ${ambassador.code} est confirmée. +$${commission.toFixed(2)} enregistré (payable après 48h de traitement).`,
      url: `/#ambassadeur?ref=${encodeURIComponent(ambassador.code)}`,
      tag: `piga-amb-sale-${participant.id}`
    });
    console.log(`[PUSH] Alerte vente ambassadeur ${ambassador.code} : ${sent} terminal(aux) notifié(s).`);
  } catch (err) {
    console.error('[PUSH AMBASSADOR ERROR]:', err);
  }
}
