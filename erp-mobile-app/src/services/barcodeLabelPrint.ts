/**
 * Barcode product labels: thermal ESC/POS or A4 print grid (single + batch).
 */

import type { BarcodeLabelLayout, MobileBarcodeLabelSettings } from '../api/settings';
import type { MobilePrinterPaperSize } from '../api/settings';
import { printHtmlDocument, printReceiptLines } from './printService';

export interface LabelPrintJob {
  productName: string;
  sku: string;
  barcode: string;
  price?: number;
  /** @deprecated Use companyName */
  businessName?: string;
  companyName?: string;
  branchName?: string;
  variationName?: string;
  packingSummary?: string;
  quantity: number;
}

/** One row in the batch print sheet UI. */
export interface LabelPrintLine {
  lineKey: string;
  productId?: string;
  variationId?: string | null;
  productName: string;
  sku: string;
  barcode: string;
  price?: number;
  variationName?: string;
  packingSummary?: string;
  labelCount: number;
  selected: boolean;
  /** Purchase PO rows merged into this line. */
  mergedLineCount?: number;
}

export interface LabelPrintContext {
  companyName?: string;
  branchName?: string;
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
  const company = job.companyName ?? job.businessName;
  if (settings.showCompanyName && company) {
    parts.push(`<div class="biz">${escapeHtml(company)}</div>`);
  }
  if (settings.showBranchName && job.branchName) {
    parts.push(`<div class="branch">${escapeHtml(job.branchName)}</div>`);
  }
  if (settings.showName) {
    parts.push(`<div class="name">${escapeHtml(job.productName)}</div>`);
  }
  if (settings.showVariation && job.variationName) {
    parts.push(`<div class="var">${escapeHtml(job.variationName)}</div>`);
  }
  parts.push(`<div class="bc">${barcodeSvg(job.barcode)}</div>`);
  parts.push(`<div class="sku">${escapeHtml(job.barcode)}</div>`);
  if (settings.showPacking && job.packingSummary) {
    parts.push(`<div class="pack">${escapeHtml(job.packingSummary)}</div>`);
  }
  if (settings.showPrice && job.price != null) {
    parts.push(`<div class="price">Rs. ${Number(job.price).toLocaleString('en-PK')}</div>`);
  }
  return `<div class="label">${parts.join('')}</div>`;
}

function buildA4SheetHtml(jobs: LabelPrintJob[], settings: MobileBarcodeLabelSettings): string {
  const cols = Math.max(2, Math.min(4, settings.a4Columns || 3));
  const maxPerSheet = Math.max(6, settings.maxLabelsPerSheet || 30);
  const capped = jobs.slice(0, maxPerSheet);
  const cells = capped.map((j) => buildLabelHtml(j, settings)).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    @page { size: A4; margin: 10mm; }
    body { font-family: Arial, sans-serif; margin: 0; }
    .grid { display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 8px; }
    .label { border: 1px dashed #ccc; padding: 8px; text-align: center; break-inside: avoid; page-break-inside: avoid; }
    .biz { font-size: 8px; font-weight: bold; text-transform: uppercase; color: #555; }
    .branch { font-size: 8px; color: #666; margin-top: 2px; }
    .name { font-size: 11px; font-weight: bold; line-height: 1.2; margin: 4px 0; }
    .var { font-size: 9px; color: #444; margin: 2px 0; }
    .pack { font-size: 8px; color: #555; margin-top: 2px; }
    .sku { font-size: 10px; font-family: monospace; letter-spacing: 0.1em; margin-top: 4px; }
    .price { font-size: 12px; font-weight: bold; margin-top: 4px; }
    .bc { display: flex; justify-content: center; margin: 4px 0; }
  </style></head><body><div class="grid">${cells}</div></body></html>`;
}

function buildThermalLabelLines(job: LabelPrintJob, settings: MobileBarcodeLabelSettings): string[] {
  const lines: string[] = [];
  const company = job.companyName ?? job.businessName;
  if (settings.showCompanyName && company) lines.push(company.slice(0, 24));
  if (settings.showBranchName && job.branchName) lines.push(job.branchName.slice(0, 24));
  if (settings.showName) lines.push(job.productName.slice(0, 28));
  if (settings.showVariation && job.variationName) lines.push(job.variationName.slice(0, 24));
  lines.push(job.barcode);
  if (settings.showPacking && job.packingSummary) lines.push(job.packingSummary.slice(0, 28));
  if (settings.showPrice && job.price != null) {
    lines.push(`Rs. ${Number(job.price).toLocaleString('en-PK')}`);
  }
  lines.push('');
  return lines;
}

export function flattenLinesToJobs(
  lines: LabelPrintLine[],
  ctx?: LabelPrintContext,
): LabelPrintJob[] {
  const jobs: LabelPrintJob[] = [];
  for (const line of lines) {
    if (!line.selected) continue;
    const code = (line.barcode || line.sku || '').trim();
    if (!code) continue;
    const qty = Math.max(1, Math.min(500, line.labelCount));
    const base: LabelPrintJob = {
      productName: line.productName,
      sku: line.sku || code,
      barcode: code,
      price: line.price,
      companyName: ctx?.companyName,
      branchName: ctx?.branchName,
      businessName: ctx?.companyName,
      variationName: line.variationName,
      packingSummary: line.packingSummary,
      quantity: 1,
    };
    for (let i = 0; i < qty; i++) jobs.push({ ...base });
  }
  return jobs;
}

export async function printProductLabelsBatch(
  lines: LabelPrintLine[],
  settings: MobileBarcodeLabelSettings,
  printer: {
    mode: 'thermal' | 'a4';
    paperSize: MobilePrinterPaperSize;
    bluetoothDeviceAddress?: string | null;
  },
  ctx?: LabelPrintContext | string,
): Promise<{ ok: boolean; hint?: string; printedCount: number }> {
  const context: LabelPrintContext | undefined =
    typeof ctx === 'string' ? { companyName: ctx } : ctx;
  const jobs = flattenLinesToJobs(lines, context);
  if (jobs.length === 0) {
    return { ok: false, hint: 'No printable labels (check barcode/SKU and selection).', printedCount: 0 };
  }

  const layout: BarcodeLabelLayout =
    settings.labelLayout === 'a4' ? 'a4' : printer.mode === 'a4' ? 'a4' : 'thermal';

  if (layout === 'a4') {
    const html = buildA4SheetHtml(jobs, settings);
    const res = await printHtmlDocument(html, `Labels-batch-${jobs.length}`);
    return { ok: res.ok, hint: res.hint, printedCount: jobs.length };
  }

  const allLines: string[] = [];
  for (let i = 0; i < jobs.length; i++) {
    allLines.push(...buildThermalLabelLines(jobs[i], settings));
    if (i < jobs.length - 1) allLines.push('---');
  }
  const res = await printReceiptLines(allLines, {
    mode: 'thermal',
    paperSize: printer.paperSize,
    bluetoothDeviceAddress: printer.bluetoothDeviceAddress,
  });
  return { ok: res.ok, hint: res.hint, printedCount: jobs.length };
}

export async function printProductLabels(
  job: LabelPrintJob,
  settings: MobileBarcodeLabelSettings,
  printer: {
    mode: 'thermal' | 'a4';
    paperSize: MobilePrinterPaperSize;
    bluetoothDeviceAddress?: string | null;
  },
): Promise<{ ok: boolean; hint?: string }> {
  const line: LabelPrintLine = {
    lineKey: 'single',
    productName: job.productName,
    sku: job.sku,
    barcode: job.barcode,
    price: job.price,
    variationName: job.variationName,
    packingSummary: job.packingSummary,
    labelCount: job.quantity,
    selected: true,
  };
  const res = await printProductLabelsBatch([line], settings, printer, {
    companyName: job.companyName ?? job.businessName,
    branchName: job.branchName,
  });
  return { ok: res.ok, hint: res.hint };
}
