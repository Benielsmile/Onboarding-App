/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * High-End Luxury Cryptographic Ticket & Invoice PDF Generator
 * Generates an elite dark/light minimalist PDF document for Arsenal Agentique 2026
 * featuring:
 * 1. High-resolution dynamic QR Code pointing to AES-256-GCM verification endpoint
 * 2. Official financial receipt block ($20.00 USD) with unique serial number
 * 3. Dynamic WhatsApp click-to-chat active link embedded in the document
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { Participant } from '../types/index.ts';
import { generateWhatsAppConfirmationUrl } from './whatsappHelper.ts';

export async function generateTicketPDF(
  participant: Participant,
  siteUrl: string = typeof window !== 'undefined' ? window.location.origin : 'https://arsenal-agentique.tech'
): Promise<jsPDF> {
  // Verification URL pointing to the AES-256-GCM cryptographic validator
  const verificationUrl = participant.cryptoToken
    ? `${siteUrl}/verify/${participant.cryptoToken}`
    : `${siteUrl}?ticket=${participant.ticketCode}`;

  // WhatsApp click-to-chat URL
  const { url: whatsAppUrl } = generateWhatsAppConfirmationUrl(participant, siteUrl);

  // Generate QR Code data URL with high error correction
  const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 320,
    color: {
      dark: '#0B0C0E',
      light: '#FFFFFF'
    }
  });

  // Create document in Landscape A5 format (210mm x 148mm) - Luxury Pass Format
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a5'
  });

  const pageWidth = 210;
  const pageHeight = 148;

  // Background - Deep Matte Obsidian #0B0C0E
  doc.setFillColor(11, 12, 14);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Decorative Accent Band - Anthropic Orange #E05E2B
  doc.setFillColor(224, 94, 43);
  doc.rect(0, 0, 6, pageHeight, 'F');

  // Top Accent Hairline
  doc.setDrawColor(30, 34, 42);
  doc.setLineWidth(0.5);
  doc.line(16, 26, pageWidth - 16, 26);

  // Brand Header
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('ARSENAL AGENTIQUE', 16, 18);

  doc.setTextColor(224, 94, 43);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('OFFICIAL MASTERCLASS ACCREDITATION & CRYPTO-PASS', 16, 23);

  // Date & Venue Block
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.text('SESSION : VENDREDI 13 NOVEMBRE 2026 · KINSHASA & DISTRIBUTED EDGE', pageWidth - 16, 18, { align: 'right' });
  doc.text('CONFIDENTIALITÉ : NDA SIGNÉ & PROTOCOLE ZÉRO-TRUST ACTIF', pageWidth - 16, 23, { align: 'right' });

  // Left Column: Participant & Event Details
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7);
  doc.text('TITULAIRE ACCRÉDITÉ', 16, 36);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(participant.fullName.toUpperCase(), 16, 43);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(`Email : ${participant.email}`, 16, 50);
  doc.text(`WhatsApp RDC : +${participant.phoneInternational}`, 16, 55);

  // Masterclass Modules summary
  doc.setFillColor(18, 20, 24);
  doc.roundedRect(16, 62, 115, 34, 2, 2, 'F');
  doc.setDrawColor(30, 34, 42);
  doc.roundedRect(16, 62, 115, 34, 2, 2, 'S');

  doc.setTextColor(224, 94, 43);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('PROGRAMME D\'INGÉNIERIE AGENTIQUE', 20, 68);

  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('• Architectures multi-agents autonomes & LangGraph en production', 20, 74);
  doc.text('• Pipelines de Tool-Calling sécurisés & Protocoles Zéro-Trust', 20, 79);
  doc.text('• Red-Teaming, Prompt Injection Defenses & Modèles SaaS AI', 20, 84);
  doc.text('• Déploiement distribué Edge, PostgreSQL RLS & Audit continu', 20, 89);

  // Financial Receipt Block (Lower Left)
  doc.setFillColor(15, 17, 21);
  doc.roundedRect(16, 101, 115, 32, 2, 2, 'F');
  doc.setDrawColor(30, 34, 42);
  doc.roundedRect(16, 101, 115, 32, 2, 2, 'S');

  doc.setTextColor(16, 185, 129); // Muted Emerald
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('REÇU DE TRANSACTION OFFICIEL · STATUT : CONFIRMÉ', 20, 107);

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Mode de règlement : ${participant.paymentProvider}`, 20, 113);
  doc.text(`Réf. Opérateur : ${participant.transactionReference}`, 20, 118);
  doc.text(`Numéro de série : ${participant.ticketCode || 'AA-2026-CONFIRMED'}`, 20, 123);
  doc.text(`Frais d\'inscription :`, 20, 128);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('$20.00 USD (Payé)', 54, 128);

  // Right Column: Cryptographic QR Code Container
  const qrX = 142;
  const qrY = 32;
  const qrSize = 52;

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(qrX, qrY, qrSize, qrSize, 3, 3, 'F');
  doc.addImage(qrCodeDataUrl, 'PNG', qrX + 2, qrY + 2, qrSize - 4, qrSize - 4);

  // QR Code Subtitle
  doc.setTextColor(224, 94, 43);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('SCAN DE VALIDATION CRYPTO (GCM)', qrX + qrSize / 2, qrY + qrSize + 5, { align: 'center' });

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Contrôle d\'authenticité inviolable', qrX + qrSize / 2, qrY + qrSize + 9, { align: 'center' });

  // Clickable WhatsApp VIP Button embedded in the PDF
  const btnX = qrX - 2;
  const btnY = qrY + qrSize + 13;
  const btnW = qrSize + 4;
  const btnH = 9;

  doc.setFillColor(16, 185, 129); // Emerald Green
  doc.roundedRect(btnX, btnY, btnW, btnH, 2, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('OUVRIR WHATSAPP & GROUPE VIP', btnX + btnW / 2, btnY + 5.8, { align: 'center' });
  doc.link(btnX, btnY, btnW, btnH, { url: whatsAppUrl });

  // Clickable Web Verification link
  const verifyBtnY = btnY + 11;
  doc.setFillColor(30, 34, 42);
  doc.roundedRect(btnX, verifyBtnY, btnW, 7, 2, 2, 'F');
  doc.setTextColor(203, 213, 225);
  doc.setFontSize(6.5);
  doc.text('VÉRIFIER LE BILLET EN LIGNE', btnX + btnW / 2, verifyBtnY + 4.8, { align: 'center' });
  doc.link(btnX, verifyBtnY, btnW, 7, { url: verificationUrl });

  // Bottom Footnote
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(6);
  doc.text(
    `Billet nominatif sécurisé généré par l'infrastructure Arsenal Agentique • Empreinte AES-256-GCM : ${participant.cryptoToken?.slice(0, 32) || 'AUTONOMOUS-AGENT-KEY'}...`,
    16,
    142
  );

  return doc;
}

export async function downloadTicketPDF(participant: Participant, siteUrl?: string): Promise<void> {
  const doc = await generateTicketPDF(participant, siteUrl);
  const sanitizedName = participant.fullName.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Ticket_Arsenal_Agentique_${sanitizedName}_${participant.ticketCode || 'PASS'}.pdf`);
}
