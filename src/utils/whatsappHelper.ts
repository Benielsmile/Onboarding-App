/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PIGA STUDIO — Dynamic WhatsApp Click-to-Chat URL Generator
 * Generates an official confirmation or revocation message with PIGA STUDIO branding,
 * Orange Money receipt details, and VIP training community access.
 * Fully formation-driven: every item is resolved from the active ProgramConfig
 * managed by the Admin Dashboard (with safe PIGA STUDIO fallbacks).
 */

import type { Participant } from '../types/index.ts';

export const PIGA_DIRECTION_EMAIL = 'Benielsmile89@gmail.com';
export const PIGA_DIRECTION_PHONE = '+243997406281';
export const PIGA_DIRECTION_PHONE_LOCAL = '0997406281';
export const PIGA_ORANGE_MONEY_NUMBER = '+243803240289';
export const PIGA_ORANGE_MONEY_DISPLAY = '+243 803 240 289';

const DEFAULT_VIP_TRAINING_COMMUNITY_URL = 'https://chat.whatsapp.com/PigaArsenalAgentique2026';

/** Formation-scoped information injected into WhatsApp / PDF communications */
export interface FormationMessageInfo {
  title?: string;               // Formation full title
  tagline?: string;             // Brand tagline (footer of messages)
  dateDisplay?: string;
  timeDisplay?: string;
  locationDisplay?: string;
  orangeMoneyNumber?: string;
  orangeMoneyHolder?: string;
  directionEmail?: string;
  directionPhone?: string;
  decorativeName?: string;      // Short marketing name used in headers
  vipWhatsAppUrl?: string;
  moduleSummaries?: string[];   // Bullet points for the PDF curriculum box
}

/** Resolves message details, preferring the active formation configuration */
export function resolveMessageInfo(info?: FormationMessageInfo) {
  const fullTitle = info?.title?.trim() || 'Arsenal Agentique';
  const decorativeName = info?.decorativeName?.trim() || fullTitle.split(' : ')[0] || fullTitle;
  return {
    decorativeName,
    tagline: info?.tagline?.trim() || 'L’intelligence logicielle. L’impact cinématographique.',
    dateDisplay: info?.dateDisplay?.trim() || 'Vendredi 13 Novembre 2026',
    timeDisplay: info?.timeDisplay?.trim() || '09h00 - 18h00 (Heure de Kinshasa)',
    locationDisplay: info?.locationDisplay?.trim() || 'Kinshasa',
    orangeMoneyNumber: info?.orangeMoneyNumber?.trim() || PIGA_ORANGE_MONEY_DISPLAY,
    orangeMoneyHolder: info?.orangeMoneyHolder?.trim() || 'PIGA STUDIO',
    directionEmail: info?.directionEmail?.trim() || PIGA_DIRECTION_EMAIL,
    directionPhone: info?.directionPhone?.trim() || PIGA_DIRECTION_PHONE_LOCAL,
    vipWhatsAppUrl: info?.vipWhatsAppUrl?.trim() || DEFAULT_VIP_TRAINING_COMMUNITY_URL
  };
}

export function generateWhatsAppConfirmationUrl(
  participant: Pick<Participant, 'fullName' | 'phoneInternational' | 'ticketCode' | 'cryptoToken' | 'paymentProvider' | 'transactionReference' | 'priceUsd'>,
  info?: FormationMessageInfo,
  siteUrl: string = typeof window !== 'undefined' ? window.location.origin : 'https://arsenal-agentique.tech'
): { url: string; rawMessage: string } {
  const msg = resolveMessageInfo(info);
  const cleanPhone = participant.phoneInternational.replace(/[^\d]/g, '');
  const verificationLink = participant.cryptoToken 
    ? `${siteUrl}/#verify?token=${encodeURIComponent(participant.cryptoToken)}`
    : `${siteUrl}?ticket=${participant.ticketCode}`;

  const rawMessage = [
    `🔴 *PIGA STUDIO — ${msg.decorativeName.toUpperCase()} : ACCÈS CONFIRMÉ*`,
    `_The AI Venture Studio & Tech Media | Empowering the next generation of creators_`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Félicitations *${participant.fullName.trim()}*, votre inscription au Masterclass Exécutif est officiellement validée.`,
    ``,
    `🎓 *Formation :* ${msg.decorativeName}`,
    `📅 *Date de session :* ${msg.dateDisplay}`,
    `⏰ *Horaires :* ${msg.timeDisplay}`,
    `🎫 *Code Billet :* \`${participant.ticketCode || 'PIGA-AA-2026'}\``,
    `💳 *Montant réglé :* ${(participant.priceUsd ?? 20).toFixed(2)} USD (Vérifié via Orange Money)`,
    `🔖 *Réf. Orange Money :* \`${participant.transactionReference}\``,
    ``,
    `🔐 *Vérification Cryptographique (AES-256-GCM) :*`,
    `${verificationLink}`,
    ``,
    `🚀 *Rejoindre la Communauté VIP PIGA STUDIO :*`,
    `${msg.vipWhatsAppUrl}`,
    ``,
    `📌 *Consignes d'accès :*`,
    `• Munissez-vous de votre QR Code officiel à l'accueil`,
    `• Laptop configuré avec Python 3.11+ et Node.js 20+`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Direction PIGA STUDIO : ${msg.directionEmail} · Tél : ${msg.directionPhone}`,
    `_PIGA STUDIO — ${msg.tagline}_`
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
  info?: FormationMessageInfo,
  siteUrl: string = typeof window !== 'undefined' ? window.location.origin : 'https://arsenal-agentique.tech'
): { url: string; rawMessage: string } {
  const msg = resolveMessageInfo(info);
  const cleanPhone = participant.phoneInternational.replace(/[^\d]/g, '');

  const rawMessage = [
    `⚠️ *PIGA STUDIO — AVIS DE RÉVOCATION / VALIDATION EN ATTENTE*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Bonjour *${participant.fullName.trim()}*,`,
    ``,
    `Nous avons rencontré une difficulté lors de la vérification de votre paiement Orange Money pour la formation *${msg.decorativeName}* (${msg.dateDisplay}).`,
    ``,
    `📋 *Dossier Réf :* \`${participant.ticketCode || 'N/A'}\``,
    `🔖 *Réf. Transaction saisie :* \`${participant.transactionReference}\``,
    `❌ *Motif relevé :* ${reason}`,
    ``,
    `Pour régulariser votre réservation ou soumettre une capture lisible du transfert Orange Money vers le numéro officiel *${msg.orangeMoneyNumber}*, veuillez répondre directement à ce message ou contacter la direction :`,
    ``,
    `📧 Email Direction : ${msg.directionEmail}`,
    `📞 Téléphone Direction : ${msg.directionPhone}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `_PIGA STUDIO — Service de Contrôle & Billetterie_`
  ].join('\n');

  const encodedMessage = encodeURIComponent(rawMessage);
  const url = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

  return { url, rawMessage };
}
