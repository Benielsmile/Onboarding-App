/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PIGA STUDIO — Kit de Survie de l'Ambassadeur
 * Scripts "Prêt-à-partager" (Statut WhatsApp / Groupes Business / LinkedIn)
 * avec le lien d'affiliation magique pré-injecté, génération du message
 * d'onboarding ambassadeur et du message de félicitations commission.
 * Tout est formation-driven (date, prix, capacité via ProgramConfig).
 */

import type { Ambassador } from '../types/index.ts';

/** Construit le lien magique officiel d'un ambassadeur */
export function buildAmbassadorMagicUrl(code: string, origin: string = typeof window !== 'undefined' ? window.location.origin : ''): string {
  const base = origin || 'https://arsenal-agentique.tech';
  return `${base}/?ref=${encodeURIComponent(code)}`;
}

/** Lien de partage WhatsApp "clic-to-share" avec le texte pré-rempli */
export function buildWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export interface AmbassadorKitScripts {
  status: { label: string; text: string };
  groups: { label: string; text: string };
  linkedin: { label: string; text: string };
}

/**
 * Les trois scripts d'accroche officiels, avec le lien d'affiliation injecté.
 * Formation-driven : date, tarif et places proviennent de la formation active.
 */
export function buildAmbassadorKitScripts(
  link: string,
  formation: { title: string; dateDisplay: string; ticketPriceUsd: number; totalCapacity: number }
): AmbassadorKitScripts {
  const price = formation.ticketPriceUsd.toFixed(0);
  const seats = formation.totalCapacity || 30;
  const shortName = formation.title.split(' : ')[0] || formation.title;

  return {
    status: {
      label: 'Statut WhatsApp (Court & Curiosité)',
      text: [
        `Mon réseau ! Notre startup PIGA STUDIO lance son Workshop Tech d'élite à Kinshasa : ${formation.dateDisplay}.`,
        `🧠 Au programme : automatisation par l'IA, workflows pros et ingénierie de prompts pour économiser jusqu'à 1 000 $/mois dans vos business.`,
        `⏳ Seulement ${seats} places disponibles. L'onboarding et le paiement se font directement sur notre application interne. Réservez avant le Sold Out :`,
        link
      ].join('\n')
    },
    groups: {
      label: 'Groupes WhatsApp Business / Pros',
      text: [
        `Bonjour à tous, je partage avec vous une initiative tech majeure à Kinshasa. Je représente officiellement PIGA STUDIO, un AI Venture Studio qui fusionne le code et l'art visuel.`,
        `${formation.dateDisplay}, nous organisons un Workshop pratique et ultra-disruptif : « ${shortName} » — l'IA n'est pas un couteau suisse, construisez votre machine de guerre.`,
        `Pas de théorie inutile. Vous repartirez avec des compétences en automatisation applicables le jour-même, votre certificat et votre accès à notre plateforme.`,
        `💳 Inscription et validation QR Code sécurisée via notre app : ${link} (Ticket : ${price}$)`
      ].join('\n')
    },
    linkedin: {
      label: 'LinkedIn / Réseaux professionnels',
      text: [
        `Kinshasa — ${formation.dateDisplay} 🇨🇩`,
        `PIGA STUDIO organise un Workshop intensif : « ${shortName} ». Objectif : sortir du prompting passif et orchestrer de vrais agents IA qui automatisent le marketing, les documents et le code.`,
        `${seats} professionnels maximum. Ticket : ${price}$ via Mobile Money. Onboarding et billetterie cryptographique directement sur notre application.`,
        `Intéressés : écrivez-moi en privé ou réservez ici → ${link}`,
        `#PIGAStudio #IA #Automatisation #Kinshasa #RDC`
      ].join('\n')
    }
  };
}

/** Message WhatsApp d'onboarding que la Direction envoie à l'ambassadeur */
export function generateAmbassadorOnboardingMessage(ambassador: Ambassador): string {
  const link = buildAmbassadorMagicUrl(ambassador.code);
  return [
    `🎖️ *PIGA STUDIO — AMBASSADEUR OFFICIEL ENRÔLÉ*`,
    `_The AI Venture Studio & Tech Media | Empowering the next generation of creators_`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Bienvenue dans l'Armée de Distribution PIGA STUDIO, *${ambassador.fullName.trim()}* !`,
    ``,
    `🎖️ *Votre Statut :* Ambassadeur Officiel`,
    `💰 *Votre Commission :* 15 % (3 $ USD) par ticket de 20 $ VALIDÉ`,
    `🔖 *Votre Code :* \`${ambassador.code}\``,
    ``,
    `🔗 *Votre Lien Magique de Suivi :*`,
    `${link}`,
    ``,
    `📌 *Mode d'emploi :*`,
    `• Partagez votre lien : chaque personne qui s'inscrit via ce lien est automatiquement rattachée à vous`,
    `• Une vente VALIDÉE par la Direction = votre commission enregistrée, zéro litige`,
    `• Suivez vos clics, ventes et gains en direct sur votre tableau de bord :`,
    `${link.replace('/?ref=', '/#ambassadeur?ref=')}`,
    ``,
    `🚀 Kit de Survie Marketing (scripts + visuel) : disponible sur votre tableau de bord.`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `_Direction PIGA STUDIO — Arsenal Agentique_`
  ].join('\n');
}

/** Notification de commission (gamification) envoyée à l'ambassadeur */
export function generateAmbassadorCommissionAlert(
  ambassador: Ambassador,
  clientName: string,
  commissionUsd: number
): string {
  const link = buildAmbassadorMagicUrl(ambassador.code);
  return [
    `🎉 *PIGA STUDIO — COMMISSION ENREGISTRÉE !*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Félicitations *${ambassador.fullName.trim()}* !`,
    ``,
    `Une vente VALIDÉE avec votre code \`${ambassador.code}\` (client : ${clientName}).`,
    `💰 *Votre gain :* +${commissionUsd.toFixed(2)} $ USD enregistré sur votre compte ambassadeur.`,
    ``,
    `Suivez vos gains en direct :`,
    `${link.replace('/?ref=', '/#ambassadeur?ref=')}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `_Continue comme ça — l'Armée de Distribution PIGA STUDIO_ 🚀`
  ].join('\n');
}
