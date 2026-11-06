/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Dynamic WhatsApp Click-to-Chat URL Generator
 * Generates an official, pre-filled WhatsApp notification targeting the participant's
 * validated DRC phone number with confirmation receipt and private training access link.
 */

import type { Participant } from '../types/index.ts';

const VIP_TRAINING_COMMUNITY_URL = 'https://chat.whatsapp.com/ArsenalAgentique2026VIP';

export function generateWhatsAppConfirmationUrl(
  participant: Pick<Participant, 'fullName' | 'phoneInternational' | 'ticketCode' | 'cryptoToken' | 'paymentProvider' | 'transactionReference'>,
  siteUrl: string = typeof window !== 'undefined' ? window.location.origin : 'https://arsenal-agentique.tech'
): { url: string; rawMessage: string } {
  const cleanPhone = participant.phoneInternational.replace(/[^\d]/g, '');
  const verificationLink = participant.cryptoToken 
    ? `${siteUrl}/verify/${participant.cryptoToken}`
    : `${siteUrl}?code=${participant.ticketCode}`;

  const rawMessage = [
    `⚜️ *ARSENAL AGENTIQUE — ACCÈS CONFIRMÉ*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Félicitations *${participant.fullName.trim()}*, votre inscription au Masterclass Exécutif est officiellement validée.`,
    ``,
    `📅 *Date de session :* Vendredi 13 Novembre 2026`,
    `⏰ *Horaires :* 09h00 - 18h00 (Heure de Kinshasa)`,
    `🎫 *Code Billet :* \`${participant.ticketCode || 'AA-2026-CONFIRMED'}\``,
    `💳 *Montant réglé :* 20.00 USD (Vérifié via ${participant.paymentProvider})`,
    `🔖 *Réf. Transaction :* \`${participant.transactionReference}\``,
    ``,
    `🔐 *Vérification Cryptographique (AES-256-GCM) :*`,
    `${verificationLink}`,
    ``,
    `🚀 *Rejoindre le Cercle Privé des Participants :*`,
    `${VIP_TRAINING_COMMUNITY_URL}`,
    ``,
    `📌 *Pré-requis indispensables :*`,
    `• Laptop configuré avec Python 3.11+ & Node.js 20+`,
    `• Présentation du QR Code officiel à l'accueil sécurisé`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `_Arsenal Agentique 2026 • Systèmes d'Agents Autonomes & Sécurité Offensive_`
  ].join('\n');

  const encodedMessage = encodeURIComponent(rawMessage);
  const url = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

  return { url, rawMessage };
}
