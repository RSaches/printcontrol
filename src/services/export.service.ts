// src/services/export.service.ts
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate, formatBytes, formatPages } from '../utils/format';
import type { PrintJob } from '../types';

const HEADERS = ['Documento', 'Usuário', 'Impressora', 'Status', 'Páginas', 'Tamanho', 'Data'];

function toRow(j: PrintJob): string[] {
  return [
    j.document_name,
    j.user_name,
    j.printer_name,
    j.status,
    formatPages(j.pages),
    formatBytes(j.size_bytes),
    formatDate(j.created_at),
  ];
}

function buildFilename(base: string, ext: string): string {
  const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `${base}_${stamp}.${ext}`;
}

// ─── Excel ───────────────────────────────────────────────────────────────────

export function exportToExcel(jobs: PrintJob[], filenameBase = 'printcontrol_jobs'): void {
  const rows = jobs.map(toRow);

  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);

  // Larguras de coluna
  ws['!cols'] = [
    { wch: 40 }, // Documento
    { wch: 20 }, // Usuário
    { wch: 30 }, // Impressora
    { wch: 12 }, // Status
    { wch: 12 }, // Páginas
    { wch: 12 }, // Tamanho
    { wch: 20 }, // Data
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Jobs');
  XLSX.writeFile(wb, buildFilename(filenameBase, 'xlsx'));
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

export function exportToPdf(jobs: PrintJob[], filenameBase = 'printcontrol_jobs'): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const now = new Date().toLocaleString('pt-BR');

  // Cabeçalho do relatório
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('PrintControl — Relatório de Impressão', 14, 16);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text(`Gerado em: ${now}   •   Total: ${jobs.length} job(s)`, 14, 22);
  doc.setTextColor(0);

  autoTable(doc, {
    head: [HEADERS],
    body: jobs.map(toRow),
    startY: 27,
    styles: {
      fontSize: 8,
      cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
      overflow: 'ellipsize',
    },
    headStyles: {
      fillColor: [79, 70, 229],   // indigo-600
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250],
    },
    columnStyles: {
      0: { cellWidth: 55 }, // Documento
      1: { cellWidth: 30 }, // Usuário
      2: { cellWidth: 40 }, // Impressora
      3: { cellWidth: 22 }, // Status
      4: { cellWidth: 20 }, // Páginas
      5: { cellWidth: 20 }, // Tamanho
      6: { cellWidth: 32 }, // Data
    },
  });

  doc.save(buildFilename(filenameBase, 'pdf'));
}
