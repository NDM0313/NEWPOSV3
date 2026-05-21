/**
 * Barcode product labels: thermal ESC/POS or A4 print grid.
 */

import type { BarcodeLabelLayout, MobileBarcodeLabelSettings } from '../api/settings';
import type { MobilePrinterPaperSize } from '../api/settings';
import { printHtmlDocument, printReceiptLines } from './printService';

export interface LabelPrintJob {
  productName: string;
  sku: string;
  barcode: string;
  price?: number;
  businessName?: string;
  quantity: number;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Simple Code128-style bars from digit patterns (visual barcode for print HTML). */
function barcodeSvg(code: string): string {
  const bars: string[] = [];
  for (let i = 0; i < code.length; i++) {
    const w = (code.charCodeAt(i) % 3) + 1;
    bars.push(`<rect x="${i * 4}" y="0" width="${w}" height="40" fill="#000"/>`);
  }
  const width = code.length * 4 + 4;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="40" viewBox="0 0 ${width} 40">${bars.join('')}</svg>`;
}

function buildLabelHtml(job: LabelPrintJob, settings: MobileBarcodeLabelSettings): string {
  const parts: string[] = [];
  if (settings.showBusinessName && job.businessName) {
    parts.push(`<div class="biz">${escapeHtml(job.businessName)}</div>`);
  }
  if (settings.showName) {
    parts.push(`<div class="name">${escapeHtml(job.productName)}</div>`);
  }
  parts.push(`<div class="bc">${barcodeSvg(job.barcode)}</div>`);
  parts.push(`<div class="sku">${escapeHtml(job.barcode)}</div>`);
  if (settings.showPrice && job.price != null) {
    parts.push(`<div class="price">Rs. ${Number(job.price).toLocaleString('en-PK')}</div>`);
  }
  return `<div class="label">${parts.join('')}</div>`;
}

function buildA4SheetHtml(jobs: LabelPrintJob[], settings: MobileBarcodeLabelSettings): string {
  const cells = jobs
    .map((j) => buildLabelHtml(j, settings))
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    @page { size: A4; margin: 10mm; }
    body { font-family: Arial, sans-serif; margin: 0; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .label { border: 1px dashed #ccc; padding: 8px; text-align: center; break-inside: avoid; page-break-inside: avoid; }
    .biz { font-size: 8px; font-weight: bold; text-transform: uppercase; color: #555; }
    .name { font-size: 11px; font-weight: bold; line-height: 1.2; margin: 4px 0; }
    .sku { font-size: 10px; font-family: monospace; letter-spacing: 0.1em; margin-top: 4px; }
    .price { font-size: 12px; font-weight: bold; margin-top: 4px; }
    .bc { display: flex; justify-content: center; margin: 4px 0; }
  </style></head><body><div class="grid">${cells}</div></body></html>`;
}

function buildThermalLabelLines(job: LabelPrintJob, settings: MobileBarcodeLabelSettings): string[] {
  const lines: string[] = [];
  if (settings.showBusinessName && job.businessName) lines.push(job.businessName.slice(0, 24));
  if (settings.showName) lines.push(job.productName.slice(0, 28));
  lines.push(job.barcode);
  if (settings.showPrice && job.price != null) {
    lines.push(`Rs. ${Number(job.price).toLocaleString('en-PK')}`);
  }
  lines.push('');
  return lines;
}

export async function printProductLabels(
  job: LabelPrintJob,
  settings: MobileBarcodeLabelSettings,
  printer: {
    mode: 'thermal' | 'a4';
    paperSize: MobilePrinterPaperSize;
    bluetoothDeviceAddress?: string | null;
  }
): Promise<{ ok: boolean; hint?: string }> {
  const layout: BarcodeLabelLayout =
    settings.labelLayout === 'a4' ? 'a4' : printer.mode === 'a4' ? 'a4' : 'thermal';
  const qty = Math.max(1, Math.min(500, job.quantity));

  if (layout === 'a4') {
    const jobs: LabelPrintJob[] = [];
    for (let i = 0; i < qty; i++) jobs.push(job);
    const html = buildA4SheetHtml(jobs, settings);
    const res = await printHtmlDocument(html, `Labels-${job.sku}`);
    return { ok: res.ok, hint: res.hint };
  }

  const allLines: string[] = [];
  for (let i = 0; i < qty; i++) {
    allLines.push(...buildThermalLabelLines(job, settings));
    if (i < qty - 1) allLines.push('---');
  }
  const res = await printReceiptLines(allLines, {
    mode: 'thermal',
    paperSize: printer.paperSize,
    bluetoothDeviceAddress: printer.bluetoothDeviceAddress,
  });
  return { ok: res.ok, hint: res.hint };
}
