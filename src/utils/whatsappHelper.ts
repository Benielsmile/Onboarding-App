/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PIGA STUDIO — Dynamic WhatsApp Click-to-Chat URL Generator
 * Generates an official confirmation or revocation message with PIGA STUDIO branding,
 * Orange Money receipt details, and VIP training community access.
 */

import type { Participant } from '../types/index.ts';

export const PIGA_DIRECTION_EMAIL = 'Benielsmile89@gmail.com';
export const PIGA_DIRECTION_PHONE = '+243997406281';
export const PIGA_DIRECTION_PHONE_LOCAL = '0997406281';
export const PIGA_ORANGE_MONEY_NUMBER = '+243803240289';
export const PIGA_ORANGE_MONEY_DISPLAY = '+243 803 240 289';

const VIP_TRAINING_COMMUNITY_URL = 'https://chat.whatsapp.com/PigaArsenalAgentique2026';

export function generateWhatsAppConfirmationUrl(
  participant: Pick<Participant, 'fullName' | 'phoneInternational' | 'ticketCode' | 'cryptoToken' | 'paymentProvider' | 'transactionReference'>,
  siteUrl: string = typeof window !== 'undefined' ? window.location.origin : 'https://arsenal-agentique.tech'
): { url: string; rawMessage: string } {
  const cleanPhone = participant.phoneInternational.replace(/[^\d]/g, '');
  const verificationLink = participant.cryptoToken 
    ? `${siteUrl}/#verify?token=${encodeURIComponent(participant.cryptoToken)}`
    : `${siteUrl}?ticket=${participant.ticketCode}`;

  const rawMessage = [
    `🔴 *PIGA STUDIO — ARSENAL AGENTIQUE : ACCÈS CONFIRMÉ*`,
    `_The AI Venture Studio & Tech Media | Empowering the next generation of creators_`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Félicitations *${participant.fullName.trim()}*, votre inscription au Masterclass Exécutif est officiellement validée.`,
    ``,
    `📅 *Date de session :* Vendredi 13 Novembre 2026`,
    `⏰ *Horaires :* 09h00 - 18h00 (Heure de Kinshasa)`,
    `🎫 *Code Billet :* \`${participant.ticketCode || 'PIGA-AA-2026'}\``,
    `💳 *Montant réglé :* 20.00 USD (Vérifié via Orange Money)`,
    `🔖 *Réf. Orange Money :* \`${participant.transactionReference}\``,
    ``,
    `🔐 *Vérification Cryptographique (AES-256-GCM) :*`,
    `${verificationLink}`,
    ``,
    `🚀 *Rejoindre la Communauté VIP PIGA STUDIO :*`,
    `${VIP_TRAINING_COMMUNITY_URL}`,
    ``,
    `📌 *Consignes d'accès :*`,
    `• Munissez-vous de votre QR Code officiel à l'accueil`,
    `• Laptop configuré avec Python 3.11+ et Node.js 20+`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Direction PIGA STUDIO : ${PIGA_DIRECTION_EMAIL} · Tél : ${PIGA_DIRECTION_PHONE_LOCAL}`,
    `_PIGA STUDIO — L’intelligence logicielle. L’impact cinématographique._`
  ].join('\n');

  const encodedMessage = encodeURIComponent(rawMessage);
  const url = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

  return { url, rawMessage };
}

/**
 * Generates an official WhatsApp revocation message to contact the participant
 * when their Orange Money reservation cannot be confirmed.
 */
export function generateWhatsAppRevocationUrl(
  participant: Pick<Participant, 'fullName' | 'phoneInternational' | 'ticketCode' | 'transactionReference'>,
  reason: string,
  siteUrl: string = typeof window !== 'undefined' ? window.location.origin : 'https://arsenal-agentique.tech'
): { url: string; rawMessage: string } {
  const cleanPhone = participant.phoneInternational.replace(/[^\d]/g, '');

  const rawMessage = [
    `⚠️ *PIGA STUDIO — AVIS DE RÉVOCATION / VALIDATION EN ATTENTE*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Bonjour *${participant.fullName.trim()}*,`,
    ``,
    `Nous avons rencontré une difficulté lors de la vérification de votre paiement Orange Money pour l'Arsenal Agentique (13 Novembre 2026).`,
    ``,
    `📋 *Dossier Réf :* \`${participant.ticketCode || 'N/A'}\``,
    `🔖 *Réf. Transaction saisie :* \`${participant.transactionReference}\``,
    `❌ *Motif relevé :* ${reason}`,
    ``,
    `Pour régulariser votre réservation ou soumettre une capture lisible du transfert Orange Money vers le numéro officiel *${PIGA_ORANGE_MONEY_DISPLAY}*, veuillez répondre directement à ce message ou contacter la direction :`,
    ``,
    `📧 Email Direction : ${PIGA_DIRECTION_EMAIL}`,
    `📞 Téléphone Direction : ${PIGA_DIRECTION_PHONE_LOCAL} / ${PIGA_DIRECTION_PHONE}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `_PIGA STUDIO — Service de Contrôle & Billetterie_`
  ].join('\n');

  const encodedMessage = encodeURIComponent(rawMessage);
  const url = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

  return { url, rawMessage };
}
