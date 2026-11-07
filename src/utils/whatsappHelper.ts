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
/**
 * CANAL WHATSAPP OFFICIEL — Direction PIGA STUDIO.
 * Toute manipulation WhatsApp (conciergerie, contact, régularisation de
 * paiement) renvoie exclusivement vers le numéro Direction 0997406281.
 * Le numéro Orange Money (0803240289) reste STRICTEMENT réservé à l'encaissement.
 */
export const PIGA_DIRECTION_WHATSAPP_NUMBER = '+243997406281';
export const PIGA_DIRECTION_WHATSAPP_URL = 'https://wa.me/243997406281';
export const PIGA_ORANGE_MONEY_NUMBER = '+243803240289';
export const PIGA_ORANGE_MONEY_DISPLAY = '+243 803 240 289';
/** Version du template message WhatsApp (badge de contrôle console admin) */
export const WHATSAPP_TEMPLATE_VERSION = 'V3-QR-PDF';
/**
 * Titulaire RÉEL du compte Orange Money récepteur : personne physique
 * (Chargé d'Administration de PIGA STUDIO). L'entité PIGA STUDIO reste
 * l'opérateur de la plateforme — le compte encaisseur, lui, est au nom de
 * la personne physique ci-dessous.
 */
export const PIGA_ORANGE_MONEY_HOLDER = 'Beniel Musuela';
export const PIGA_ORANGE_MONEY_HOLDER_ROLE = "Personne physique · Chargé d'Administration PIGA STUDIO";

/** Construit une URL wa.me à partir du téléphone Direction (local 09... ou +243 9...) */
export function directionWhatsAppLink(directionPhoneOrNumber?: string): string {
  const digits = (directionPhoneOrNumber || '').replace(/[^\d]/g, '');
  if (!digits || digits.length < 8) return '';
  // 0XX -> +243XX (format national congolais) ; sinon on garde tel quel
  const intl = digits.startsWith('0') ? `243${digits.slice(1)}` : digits;
  return `https://wa.me/${intl}`;
}

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
    orangeMoneyHolder: info?.orangeMoneyHolder?.trim() || PIGA_ORANGE_MONEY_HOLDER,
    directionEmail: info?.directionEmail?.trim() || PIGA_DIRECTION_EMAIL,
    directionPhone: info?.directionPhone?.trim() || PIGA_DIRECTION_PHONE_LOCAL,
    directionWhatsAppUrl: directionWhatsAppLink(info?.directionPhone) || PIGA_DIRECTION_WHATSAPP_URL,
    vipWhatsAppUrl: info?.vipWhatsAppUrl?.trim() || DEFAULT_VIP_TRAINING_COMMUNITY_URL
  };
}

export function generateWhatsAppConfirmationUrl(
  participant: Pick<Participant, 'id' | 'fullName' | 'phoneInternational' | 'ticketCode' | 'cryptoToken' | 'paymentProvider' | 'transactionReference' | 'priceUsd'>,
  info?: FormationMessageInfo,
  siteUrl: string = typeof window !== 'undefined' ? window.location.origin : 'https://arsenal-agentique.tech'
): { url: string; rawMessage: string } {
  const msg = resolveMessageInfo(info);
  const cleanPhone = participant.phoneInternational.replace(/[^\d]/g, '');
  // Lien de vérification cryptographique : logé dans le QR Code du PDF
  // (pdfGenerator.ts). Le message WhatsApp ne contient QUE le lien du PDF
  // (court, robuste sur tous les terminaux) — la page #verify s'ouvre quand
  // le participant scanne son QR.
  // Facture PDF générée par le serveur : ne répond que si le dossier est CONFIRMED
  const invoiceUrl = `${siteUrl}/api/ticket/${participant.id}/pdf`;

  const rawMessage = [
    `🔴 *PIGA STUDIO — ${msg.decorativeName.toUpperCase()} : ACCÈS CONFIRMÉ*`,
    `_The AI Venture Studio & Tech Media_`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Félicitations *${participant.fullName.trim()}*, votre inscription est officiellement validée.`,
    ``,
    `🎓 *Formation :* ${msg.decorativeName}`,
    `📅 *Quand :* ${msg.dateDisplay} · ${msg.timeDisplay}`,
    `🎫 *Code Billet :* \`${participant.ticketCode || 'PIGA-AA-2026'}\``,
    `💳 *Montant :* ${(participant.priceUsd ?? 20).toFixed(2)} USD (Orange Money \`${participant.transactionReference}\`)`,
    ``,
    `🎫 *VOTRE BILLET PDF — QR CODE D'ACCÈS :*`,
    `${invoiceUrl}`,
    `_👉 Ce lien OUVRIRA votre Facture / Billet PDF officiel._`,
    `_Le QR Code d'accès est DANS le PDF : téléchargez-le ou imprimez-le, il sera scanné à l'accueil._`,
    ``,
    `🚀 *Communauté VIP :*`,
    `${msg.vipWhatsAppUrl}`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `💬 WhatsApp Direction : ${msg.directionWhatsAppUrl}`,
    `📧 ${msg.directionEmail}`,
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
    `Pour régulariser votre réservation ou soumettre une capture lisible du transfert Orange Money vers le numéro officiel *${msg.orangeMoneyNumber}* (compte : *${msg.orangeMoneyHolder}*), veuillez répondre directement à ce message ou contacter la direction :`,
    ``,
    `📧 Email Direction : ${msg.directionEmail}`,
    `📞 Téléphone Direction : ${msg.directionPhone}`,
    `💬 *WhatsApp Direction (canal officiel) :* ${msg.directionWhatsAppUrl}`,
    `_Toute manipulation WhatsApp renvoie exclusivement au numéro Direction. Le numéro Orange Money sert uniquement à l'encaissement._`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `_PIGA STUDIO — Service de Contrôle & Billetterie_`
  ].join('\n');

  const encodedMessage = encodeURIComponent(rawMessage);
  const url = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

  return { url, rawMessage };
}
