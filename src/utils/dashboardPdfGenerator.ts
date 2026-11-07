/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PIGA STUDIO — Post-Workshop Dashboard Report (PDF)
 * Prints the complete state of the billing console into a branded archive PDF:
 * - Sales snapshot (confirmed / pipeline revenue, conversion rate)
 * - Active formation identity
 * - 14-day registration trend table
 * - Telecom operator breakdown
 * - Per-formation sales history
 * - Full participants register (name, WhatsApp, e-mail, Orange Money ref, amount)
 * Brand: Rouge PIGA (#E50914), Noir Absolu (#000000), Blanc Pur (#FFFFFF)
 */

import { jsPDF } from 'jspdf';
import type { Participant, AdminStats, InventoryStatus } from '../types/index.ts';
import { resolveMessageInfo, type FormationMessageInfo } from './whatsappHelper.ts';

export interface DashboardReportInput {
  stats: AdminStats | null;
  participants: Participant[];
  info?: FormationMessageInfo;
  inventory?: InventoryStatus | null;
}

const RED: [number, number, number] = [229, 9, 20];

const STATUS_FR: Record<Participant['status'], string> = {
  CONFIRMED: 'Confirmé',
  PENDING: 'En attente',
  REJECTED: 'Rejeté',
  REVOKED: 'Révoqué'
};

function statusRgb(status: Participant['status']): [number, number, number] {
  switch (status) {
    case 'CONFIRMED': return [16, 185, 129];
    case 'PENDING': return [217, 119, 6];
    case 'REJECTED': return [100, 116, 139];
    case 'REVOKED': return [220, 38, 38];
  }
}

const frDate = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { dateStyle: 'short' }) : '—';

const frShortDate = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export function generateDashboardReportPDF(input: DashboardReportInput): jsPDF {
  const msg = resolveMessageInfo(input.info);
  const parts = Array.isArray(input.participants) ? input.participants : [];

  // ---------------------------------------------------------------------------
  // Sales snapshot: server stats first, local derivation as safe fallback
  // ---------------------------------------------------------------------------
  const confirmed = parts.filter(p => p.status === 'CONFIRMED');
  const pending = parts.filter(p => p.status === 'PENDING');
  const rejected = parts.filter(p => p.status === 'REJECTED');
  const revoked = parts.filter(p => p.status === 'REVOKED');

  const active = input.stats
    ? input.stats.active
    : {
        total: parts.length,
        confirmed: confirmed.length,
        pending: pending.length,
        rejected: rejected.length,
        revoked: revoked.length,
        revenueConfirmedUsd: confirmed.reduce((s, p) => s + (p.priceUsd || 20), 0),
        revenuePipelineUsd: pending.reduce((s, p) => s + (p.priceUsd || 20), 0),
        lastRegistrationAt: parts.length
          ? parts.reduce((max, p) => (p.createdAt > max ? p.createdAt : max), parts[0].createdAt)
          : null,
        carriers: parts.reduce<Record<string, number>>((acc, p) => {
          acc[p.networkCarrier] = (acc[p.networkCarrier] || 0) + 1;
          return acc;
        }, {}),
        daily: [] as { date: string; count: number }[]
      };

  const formationTitle = input.stats?.activeFormation.title || msg.decorativeName;
  const formationDate = input.stats?.activeFormation.dateDisplay || msg.dateDisplay;
  const ticketPrice = input.stats?.activeFormation.ticketPriceUsd ?? input.inventory?.ticketPriceUsd ?? 20;
  const totalCapacity = input.stats?.activeFormation.totalCapacity ?? input.inventory?.totalCapacity ?? null;

  // ---------------------------------------------------------------------------
  // Document scaffolding
  // ---------------------------------------------------------------------------
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = 210;
  const PH = 297;
  const M = 14;
  const CW = PW - M * 2; // usable content width: 182mm
  const generatedAt = new Date().toLocaleString('fr-FR');

  let y = 0;

  const drawPageHeader = (first: boolean) => {
    doc.setFillColor(RED[0], RED[1], RED[2]);
    doc.rect(0, 0, 5, PH, 'F');

    if (first) {
      // Noir Absolu banner
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, PW, 34, 'F');

      doc.setTextColor(RED[0], RED[1], RED[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('PIGA STUDIO', M, 14);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10.5);
      doc.text('RAPPORT GÉNÉRAL DE SESSION · ADMINISTRATEUR', M, 22);

      doc.setTextColor(160, 160, 160);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('The AI Venture Studio & Tech Media | Empowering the next generation of creators', M, 28);

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(`Édité le ${generatedAt}`, PW - M, 14, { align: 'right' });
      doc.setTextColor(229, 9, 20);
      doc.setFont('helvetica', 'normal');
      doc.text(formationDate.toUpperCase().slice(0, 44), PW - M, 20, { align: 'right' });
      y = 44;
    } else {
      // Slim continuation header
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, PW, 14, 'F');
      doc.setTextColor(RED[0], RED[1], RED[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('PIGA STUDIO · RAPPORT DE SESSION', M, 9);
      doc.setTextColor(150, 150, 150);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(formationTitle.toUpperCase().slice(0, 44), PW - M, 9, { align: 'right' });
      y = 24;
    }
  };

  const ensure = (needed: number) => {
    if (y + needed > PH - 22) {
      drawPageHeader(false);
      return true;
    }
    return false;
  };

  const sectionTitle = (title: string) => {
    ensure(14);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(title, M, y + 2);
    doc.setDrawColor(RED[0], RED[1], RED[2]);
    doc.setLineWidth(0.6);
    doc.line(M, y + 4.5, PW - M, y + 4.5);
    y += 10;
  };

  const fit = (text: string, widthMm: number, size: number, font: 'helvetica' | 'courier' = 'helvetica'): string => {
    if (!text) return '—';
    doc.setFont(font, 'normal');
    doc.setFontSize(size);
    if (doc.getTextWidth(text) <= widthMm) return text;
    let out = text.slice(0, Math.max(1, text.length - 1));
    while (out.length > 1 && doc.getTextWidth(`${out}…`) > widthMm) {
      out = out.slice(0, -1);
    }
    return `${out}…`;
  };

  const tableHeader = (columns: Array<{ label: string; x: number; align?: 'left' | 'right' }>) => {
    doc.setFillColor(0, 0, 0);
    doc.rect(M, y - 4, CW, 6.4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    for (const col of columns) {
      doc.text(col.label.toUpperCase(), col.x + (col.align === 'right' ? colWidth(col, columns) : 0), y, col.align === 'right' ? { align: 'right' } : undefined);
    }
    y += 2.4;
  };

  // Width of one column = distance to the next header's x (or content edge)
  const colWidth = (col: { x: number }, columns: Array<{ x: number }>): number => {
    const idx = columns.findIndex(c => c.x === col.x);
    const next = columns[idx + 1];
    return (next ? next.x : PW - M) - col.x - 1.5;
  };

  // ---------------------------------------------------------------------------
  // PAGE 1 — Header
  // ---------------------------------------------------------------------------
  drawPageHeader(true);

  // Register of key session metrics
  sectionTitle('RELEVÉ DE SESSION');
  const convRate = active.total > 0 ? Math.round((active.confirmed / active.total) * 100) : 0;
  const cards: Array<{ label: string; value: string; sub: string; rgb: [number, number, number] }> = [
    { label: 'RECETTES CONFIRMÉES', value: `$${active.revenueConfirmedUsd.toFixed(2)}`, sub: `${active.confirmed} billet(s) confirmé(s)`, rgb: [16, 185, 129] },
    { label: 'CHIFFRE EN INSTANCE', value: `$${active.revenuePipelineUsd.toFixed(2)}`, sub: `${active.pending} paiement(s) à vérifier`, rgb: [217, 119, 6] },
    { label: 'TAUX DE CONVERSION', value: `${convRate}%`, sub: `${active.total} inscription(s) au total`, rgb: [0, 0, 0] },
    { label: 'REJETS / RÉVOCATIONS', value: `${active.rejected} / ${active.revoked}`, sub: 'recette nulle sur ces dossiers', rgb: RED }
  ];
  const cardW = (CW - 12) / 4;
  cards.forEach((c, i) => {
    const x = M + i * (cardW + 4);
    ensure(26);
    doc.setFillColor(248, 249, 250);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, cardW, 22, 2, 2, 'FD');
    doc.setTextColor(c.rgb[0], c.rgb[1], c.rgb[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text(c.label, x + 3, y + 5);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(c.value, x + 3, y + 13);
    doc.setTextColor(110, 118, 132);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text(fit(c.sub, cardW - 6, 6), x + 3, y + 18.5);
  });
  y += 26;

  // Active formation identity band
  ensure(24);
  doc.setFillColor(12, 12, 12);
  doc.roundedRect(M, y, CW, 16, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`FORMATION : ${fit(formationTitle, CW - 8, 8.5)}`, M + 4, y + 6);
  doc.setTextColor(160, 160, 160);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    fit(
      `Session : ${formationDate}   ·   Tarif : $${ticketPrice.toFixed(2)} USD / billet` +
      (totalCapacity ? `   ·   Capacité : ${active.confirmed + active.pending}/${totalCapacity} place(s) occupée(s)` : ''),
      CW - 8, 7.5
    ),
    M + 4, y + 12
  );
  y += 22;

  // ---------------------------------------------------------------------------
  // 14-day registration trend (two-column table to stay compact)
  // ---------------------------------------------------------------------------
  if (active.daily.length > 0) {
    sectionTitle('INSCRIPTIONS · 14 DERNIERS JOURS');
    ensure(10 + 7 * 5);
    const halfColX = M + CW / 2 + 6;
    const dayCol: Array<{ label: string; x: number; align?: 'left' | 'right' }> = [
      { label: 'Date', x: M + 2 }, { label: 'Insc.', x: M + 44, align: 'right' },
      { label: 'Date', x: halfColX }, { label: 'Insc.', x: halfColX + 42, align: 'right' }
    ];
    tableHeader(dayCol);
    doc.setTextColor(60, 64, 70);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    for (let i = 0; i < 7; i++) {
      ensure(5);
      const a = active.daily[i];
      const b = active.daily[i + 7];
      doc.setTextColor(60, 64, 70);
      doc.text(frDate(a.date), M + 2, y);
      doc.setTextColor(a.count > 0 ? RED[0] : 150, a.count > 0 ? RED[1] : 150, a.count > 0 ? RED[2] : 150);
      doc.setFont('helvetica', 'bold');
      doc.text(String(a.count), M + 44, y, { align: 'right' });
      if (b) {
        doc.setTextColor(60, 64, 70);
        doc.setFont('helvetica', 'normal');
        doc.text(frDate(b.date), halfColX, y);
        doc.setTextColor(b.count > 0 ? RED[0] : 150, b.count > 0 ? RED[1] : 150, b.count > 0 ? RED[2] : 150);
        doc.setFont('helvetica', 'bold');
        doc.text(String(b.count), halfColX + 42, y, { align: 'right' });
      }
      doc.setDrawColor(228, 232, 238);
      doc.setLineWidth(0.2);
      doc.line(M, y + 1.4, PW - M, y + 1.4);
      y += 5;
    }
    y += 4;
  }

  // ---------------------------------------------------------------------------
  // Telecom operators breakdown
  // ---------------------------------------------------------------------------
  const carrierEntries = Object.entries(active.carriers).sort((a, b) => b[1] - a[1]);
  if (carrierEntries.length > 0) {
    sectionTitle('RÉPARTITION OPÉRATEURS TÉLÉCOMS');
    ensure(carrierEntries.length * 5 + 4);
    carrierEntries.forEach(([carrier, count]) => {
      ensure(5);
      doc.setTextColor(RED[0], RED[1], RED[2]);
      doc.text('●', M + 2, y);
      doc.setTextColor(50, 54, 60);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(fit(`${carrier}`, 90, 7.5), M + 6, y);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(`${count}`, M + 96, y);
      doc.text(count > 1 ? 'inscriptions' : 'inscription', M + 102, y);
      y += 5;
    });
    y += 4;
  }

  // ---------------------------------------------------------------------------
  // Per-formation sales history
  // ---------------------------------------------------------------------------
  if (input.stats && input.stats.byFormation.length > 0) {
    sectionTitle('HISTORIQUE DES VENTES · TOUTES FORMATIONS');
    const fCols = [
      { x: M }, { x: M + 62 }, { x: M + 80 }, { x: M + 98 }, { x: M + 116 }, { x: M + 142, align: 'right' as const }, { x: M + 166 }
    ];
    ensure(12);
    tableHeader([
      { label: 'Formation', x: fCols[0].x },
      { label: 'Tarif', x: fCols[1].x, align: 'right' },
      { label: 'Conf.', x: fCols[2].x, align: 'right' },
      { label: 'Attente', x: fCols[3].x, align: 'right' },
      { label: 'Rej/Rév', x: fCols[4].x, align: 'right' },
      { label: 'Recettes', x: fCols[5].x, align: 'right' },
      { label: 'Dern. inscr.', x: fCols[6].x }
    ]);
    y += 2.4;
    for (const f of input.stats.byFormation) {
      ensure(6);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', f.isActive ? 'bold' : 'normal');
      doc.setFontSize(7);
      doc.text(fit(`${f.isActive ? '★ ' : ''}${f.title}`, 60, 7), fCols[0].x, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`$${f.ticketPriceUsd.toFixed(2)}`, fCols[1].x + 16, y, { align: 'right' });
      doc.setTextColor(16, 185, 129);
      doc.setFont('helvetica', 'bold');
      doc.text(String(f.confirmed), fCols[2].x + 16, y, { align: 'right' });
      doc.setTextColor(217, 119, 6);
      doc.text(String(f.pending), fCols[3].x + 16, y, { align: 'right' });
      doc.setTextColor(100, 116, 139);
      doc.text(`${f.rejected}/${f.revoked}`, fCols[4].x + 24, y, { align: 'right' });
      doc.setTextColor(RED[0], RED[1], RED[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(`$${f.revenueConfirmedUsd.toFixed(2)}`, fCols[5].x + 20, y, { align: 'right' });
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text(frDate(f.lastRegistrationAt), fCols[6].x, y);
      doc.setDrawColor(228, 232, 238);
      doc.setLineWidth(0.2);
      doc.line(M, y + 1.4, PW - M, y + 1.4);
      y += 5.5;
    }
    y += 4;
  }

  // ---------------------------------------------------------------------------
  // Full participants register (multi-page with auto pagination)
  // ---------------------------------------------------------------------------
  sectionTitle(`REGISTRE DES PARTICIPANTS · ${parts.length} INSCRIPTION(S)`);
  const pCols = [
    { x: M }, { x: M + 7 }, { x: M + 45 }, { x: M + 71 }, { x: M + 115 }, { x: M + 131 }, { x: M + 155, align: 'right' as const }, { x: M + 170 }
  ];
  const drawParticipantHeader = () => {
    ensure(8);
    tableHeader([
      { label: 'N°', x: pCols[0].x },
      { label: 'Nom', x: pCols[1].x },
      { label: 'WhatsApp RDC', x: pCols[2].x },
      { label: 'E-mail', x: pCols[3].x },
      { label: 'Statut', x: pCols[4].x },
      { label: 'Réf. Orange Money', x: pCols[5].x },
      { label: 'Montant', x: pCols[6].x, align: 'right' },
      { label: 'Date', x: pCols[7].x }
    ]);
    y += 2.4;
  };
  drawParticipantHeader();

  parts.forEach((p, index) => {
    ensure(6);

    // zebra row background
    if (index % 2 === 1) {
      doc.setFillColor(246, 247, 249);
      doc.rect(M, y - 3.4, CW, 4.8, 'F');
    }

    doc.setFontSize(6.5);
    doc.setTextColor(150, 156, 165);
    doc.setFont('helvetica', 'normal');
    doc.text(String(index + 1).padStart(2, '0'), pCols[0].x, y);

    doc.setTextColor(20, 24, 30);
    doc.setFont('helvetica', 'bold');
    doc.text(fit(p.fullName, 36, 6.5), pCols[1].x, y);

    doc.setFont('helvetica', 'normal');
    doc.text(fit(`+${p.phoneInternational}`, 24, 6.5), pCols[2].x, y);
    doc.text(fit(p.email, 42, 6.5), pCols[3].x, y);

    const rgb = statusRgb(p.status);
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(STATUS_FR[p.status], pCols[4].x, y);

    doc.setTextColor(60, 64, 70);
    doc.setFont('courier', 'normal');
    doc.text(fit(p.transactionReference || 'N/A', 24, 6, 'courier'), pCols[5].x, y);

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(`$${(p.priceUsd ?? 20).toFixed(2)}`, pCols[6].x + 12, y, { align: 'right' });

    doc.setTextColor(120, 126, 135);
    doc.setFont('helvetica', 'normal');
    doc.text(frDate(p.createdAt), pCols[7].x, y);

    y += 5.2;
  });
  if (parts.length === 0) {
    doc.setTextColor(150, 156, 165);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.text('Aucune inscription enregistrée pour cette console.', M, y);
    y += 6;
  }

  // Closing totals band
  ensure(16);
  y += 2;
  doc.setFillColor(12, 12, 12);
  doc.roundedRect(M, y, CW, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`TOTAL GÉNÉRAL : ${parts.length} INSCRIPTION(S)`, M + 4, y + 5);
  doc.setTextColor(16, 185, 129);
  doc.text(`CONFIRMÉ $${active.revenueConfirmedUsd.toFixed(2)}`, M + 78, y + 5);
  doc.setTextColor(217, 119, 6);
  doc.text(`EN INSTANCE $${active.revenuePipelineUsd.toFixed(2)}`, M + 120, y + 5);
  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(
    `Dernière inscription : ${frShortDate(active.lastRegistrationAt)} · Paiement : Orange Money RDC`,
    M + 4, y + 9.5
  );

  // ---------------------------------------------------------------------------
  // Footers on every page
  // ---------------------------------------------------------------------------
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(210, 214, 220);
    doc.setLineWidth(0.3);
    doc.line(M, PH - 14, PW - M, PH - 14);
    doc.setTextColor(125, 131, 140);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`PIGA STUDIO · Rapport d'atelier généré le ${generatedAt}`, M, PH - 9);
    doc.text(`Page ${i} / ${pageCount}`, PW - M, PH - 9, { align: 'right' });
  }

  return doc;
}

export function downloadDashboardReportPDF(input: DashboardReportInput): void {
  const doc = generateDashboardReportPDF(input);
  const sanitizedFormation = (
    input.stats?.activeFormation.title || 'Formation_PIGA_STUDIO'
  ).replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`Rapport_PIGA_STUDIO_${sanitizedFormation}_${stamp}.pdf`);
}
