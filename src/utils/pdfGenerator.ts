/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PIGA STUDIO — Official Luxury Cryptographic Ticket & Invoice PDF Generator
 * Renders an elite document strictly following the PIGA STUDIO Brand Guidelines:
 * - Brand Colors: Rouge PIGA (#E50914), Noir Absolu (#000000), Blanc Pur (#FFFFFF)
 * - Official Wordmark & Geometric A/STUDIO Emblem
 * - Tagline: "The AI Venture Studio & Tech Media | Empowering the next generation of creators"
 * - Direction Contact: Benielsmile89@gmail.com · 0997406281
 * - Exclusively Orange Money ($20.00 USD)
 * - Dynamic QR Code for AES-256-GCM cryptographic verification
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { Participant } from '../types/index.ts';
import { 
  generateWhatsAppConfirmationUrl,
  resolveMessageInfo,
  type FormationMessageInfo
} from './whatsappHelper.ts';

export async function generateTicketPDF(
  participant: Participant,
  info?: FormationMessageInfo,
  siteUrl: string = typeof window !== 'undefined' ? window.location.origin : 'https://arsenal-agentique.tech'
): Promise<jsPDF> {
  const msg = resolveMessageInfo(info);
  const verificationUrl = participant.cryptoToken
    ? `${siteUrl}/#verify?token=${encodeURIComponent(participant.cryptoToken)}`
    : `${siteUrl}?ticket=${participant.ticketCode}`;

  const { url: whatsAppUrl } = generateWhatsAppConfirmationUrl(participant, info, siteUrl);

  // Generate high-contrast QR code
  const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 320,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });

  // Create document in Landscape A5 format (210mm x 148mm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a5'
  });

  const pageWidth = 210;
  const pageHeight = 148;

  // Background: Noir Absolu #000000
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Left Band: Rouge PIGA #E50914
  doc.setFillColor(229, 9, 20);
  doc.rect(0, 0, 7, pageHeight, 'F');

  // Top Accent Hairline
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.5);
  doc.line(16, 26, pageWidth - 16, 26);

  // Brand Header: PIGA STUDIO
  doc.setTextColor(229, 9, 20); // Rouge PIGA
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('PIGA STUDIO', 16, 17);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`${msg.decorativeName.toUpperCase()} · ACCRÉDITATION OFFICIELLE`.slice(0, 60), 68, 17);

  doc.setTextColor(160, 160, 160);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('The AI Venture Studio & Tech Media | Empowering the next generation of creators', 16, 22.5);

  // Date & Modality block (top right)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`SESSION : ${msg.dateDisplay.toUpperCase()}`.slice(0, 60), pageWidth - 16, 17, { align: 'right' });

  doc.setTextColor(229, 9, 20);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`${msg.locationDisplay.toUpperCase()} · NDA SIGNÉ`.slice(0, 60), pageWidth - 16, 22.5, { align: 'right' });

  // Participant Profile Card
  doc.setTextColor(140, 140, 140);
  doc.setFontSize(7);
  doc.text('TITULAIRE ACCRÉDITÉ PAR PIGA STUDIO', 16, 36);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(participant.fullName.toUpperCase(), 16, 43);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(210, 210, 210);
  doc.text(`Email : ${participant.email}`, 16, 50);
  doc.text(`WhatsApp RDC : +${participant.phoneInternational}`, 16, 55);

  // Technical Curriculum Summary (PIGA STUDIO Engineering)
  doc.setFillColor(12, 12, 12);
  doc.roundedRect(16, 61, 116, 35, 2, 2, 'F');
  doc.setDrawColor(32, 32, 32);
  doc.roundedRect(16, 61, 116, 35, 2, 2, 'S');

  doc.setTextColor(229, 9, 20);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('AU PROGRAMME DE LA FORMATION', 20, 67);

  doc.setTextColor(180, 180, 180);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  const moduleSummaries = (info?.moduleSummaries?.length ? info.moduleSummaries : [
    '• Architectures multi-agents autonomes, LangGraph & mémoires cycliques',
    '• Sandboxing de Tool-Calling sécurisé & défenses OWASP Top 10 LLMs',
    '• Haute concurrence Edge, PostgreSQL RLS & Verrouillage de lignes',
    '• Billetterie cryptographique AES-256-GCM & vérification temps réel'
  ]).slice(0, 4);
  moduleSummaries.forEach((line, i) => {
    doc.text(line.slice(0, 85), 20, 73 + i * 5);
  });

  // Official Financial Receipt Box (Lower Left)
  doc.setFillColor(15, 15, 15);
  doc.roundedRect(16, 101, 116, 32, 2, 2, 'F');
  doc.setDrawColor(40, 40, 40);
  doc.roundedRect(16, 101, 116, 32, 2, 2, 'S');

  doc.setTextColor(16, 185, 129); // Emerald confirmed
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('REÇU ORANGE MONEY OFFICIEL · CONFIRMÉ PAR PIGA STUDIO', 20, 107);

  doc.setTextColor(160, 160, 160);
  doc.setFontSize(7.2);
  doc.setFont('helvetica', 'normal');
  doc.text(`Opérateur : Orange Money RDC (Paiement vérifié)`, 20, 113);
  doc.text(`Réf. Transaction : ${participant.transactionReference}`, 20, 118);
  doc.text(`Code de Billet : ${participant.ticketCode || 'PIGA-AA-2026-PASS'}`, 20, 123);
  doc.text(`Montant réglé :`, 20, 128);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`$${(participant.priceUsd ?? 20).toFixed(2)} USD (Payé)`, 42, 128);

  // Right Column: Cryptographic QR Code Container
  const qrX = 144;
  const qrY = 32;
  const qrSize = 50;

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(qrX, qrY, qrSize, qrSize, 3, 3, 'F');
  doc.addImage(qrCodeDataUrl, 'PNG', qrX + 2, qrY + 2, qrSize - 4, qrSize - 4);

  // QR Code Subtitle
  doc.setTextColor(229, 9, 20);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('SCAN CONTRÔLE D\'ACCÈS PIGA', qrX + qrSize / 2, qrY + qrSize + 5, { align: 'center' });

  doc.setTextColor(140, 140, 140);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Signature inviolable AES-256-GCM', qrX + qrSize / 2, qrY + qrSize + 9, { align: 'center' });

  // WhatsApp VIP Button
  const btnX = qrX - 2;
  const btnY = qrY + qrSize + 13;
  const btnW = qrSize + 4;
  const btnH = 9;

  doc.setFillColor(229, 9, 20); // Rouge PIGA
  doc.roundedRect(btnX, btnY, btnW, btnH, 2, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.2);
  doc.setFont('helvetica', 'bold');
  doc.text('CONFIRMATION & GROUPE VIP', btnX + btnW / 2, btnY + 5.8, { align: 'center' });
  doc.link(btnX, btnY, btnW, btnH, { url: whatsAppUrl });

  // Direct Web Verification Button
  const verifyBtnY = btnY + 11;
  doc.setFillColor(24, 24, 24);
  doc.roundedRect(btnX, verifyBtnY, btnW, 7, 2, 2, 'F');
  doc.setTextColor(200, 200, 200);
  doc.setFontSize(6.5);
  doc.text('VÉRIFIER LE PASSEPORT EN LIGNE', btnX + btnW / 2, verifyBtnY + 4.8, { align: 'center' });
  doc.link(btnX, verifyBtnY, btnW, 7, { url: verificationUrl });

  // Official Footer
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(6);
  doc.text(
    `Propriété technologique de PIGA STUDIO · Direction : ${msg.directionEmail} · Tél : ${msg.directionPhone} · Sceau GCM : ${participant.cryptoToken?.slice(0, 30) || 'PIGA-SECURE'}...`,
    16,
    142
  );
  doc.setTextColor(100, 100, 100);
  doc.text(
    `💬 Canal WhatsApp officiel : ${msg.directionWhatsAppUrl} (exclusivement — l'Orange Money ${msg.orangeMoneyNumber} sert uniquement à l'encaissement)`,
    16,
    145.5
  );

  return doc;
}

export async function downloadTicketPDF(participant: Participant, info?: FormationMessageInfo, siteUrl?: string): Promise<void> {
  const doc = await generateTicketPDF(participant, info, siteUrl);
  const sanitizedName = participant.fullName.replace(/[^a-zA-Z0-9]/g, '_');
  const sanitizedFormation = (info?.title || 'Formation_PIGA_STUDIO').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
  doc.save(`Ticket_PIGA_STUDIO_${sanitizedFormation}_${sanitizedName}.pdf`);
}
