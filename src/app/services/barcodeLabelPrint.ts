/**
 * Barcode product labels: A4 browser print (web) + optional thermal text block.
 */
import type { BarcodeLabelSettings } from '@/app/services/barcodeLabelSettingsService';

export interface LabelPrintJob {
  productName: string;
  sku: string;
  barcode: string;
  price?: number;
  businessName?: string;
  companyName?: string;
  branchName?: string;
  variationName?: string;
  packingSummary?: string;
  quantity: number;
}

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

function barcodeSvg(code: string): string {
  const bars: string[] = [];
  for (let i = 0; i < code.length; i++) {
    const w = (code.charCodeAt(i) % 3) + 1;
    bars.push(`<rect x="${i * 4}" y="0" width="${w}" height="40" fill="#000"/>`);
  }
  const width = code.length * 4 + 4;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="40" viewBox="0 0 ${width} 40">${bars.join('')}</svg>`;
}

function buildLabelHtml(job: LabelPrintJob, settings: BarcodeLabelSettings): string {
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

export function buildA4SheetHtml(jobs: LabelPrintJob[], settings: BarcodeLabelSettings): string {
  const cols = Math.max(2, Math.min(4, settings.a4Columns || 3));
  const maxPerSheet = Math.max(6, settings.maxLabelsPerSheet || 30);
  const capped = jobs.slice(0, maxPerSheet);
  const cells = capped.map((j) => buildLabelHtml(j, settings)).join('');

  const useFixed =
    settings.useFixedLabelSize === true &&
    settings.labelWidthMm != null &&
    settings.labelHeightMm != null &&
    Number.isFinite(settings.labelWidthMm) &&
    Number.isFinite(settings.labelHeightMm);

  const wMm = useFixed ? Math.round(settings.labelWidthMm!) : 0;
  const hMm = useFixed ? Math.round(settings.labelHeightMm!) : 0;
  const shortSticker = useFixed && hMm <= 30;

  const gridCss = useFixed
    ? `.grid { display: grid; grid-template-columns: repeat(${cols}, ${wMm}mm); gap: 2mm; justify-content: start; align-content: start; }
    .label { width: ${wMm}mm; height: ${hMm}mm; box-sizing: border-box; overflow: hidden; border: 1px dashed #ccc; padding: 1.5mm; text-align: center; break-inside: avoid; page-break-inside: avoid; display: flex; flex-direction: column; justify-content: center; }`
    : `.grid { display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 8px; }
    .label { border: 1px dashed #ccc; padding: 8px; text-align: center; break-inside: avoid; page-break-inside: avoid; }`;

  const typeCss = shortSticker
    ? `.biz { font-size: 6px; font-weight: bold; text-transform: uppercase; color: #555; }
    .branch { font-size: 6px; color: #666; margin-top: 1px; }
    .name { font-size: 8px; font-weight: bold; line-height: 1.1; margin: 1px 0; }
    .var { font-size: 7px; color: #444; margin: 1px 0; }
    .pack { font-size: 6px; color: #555; margin-top: 1px; }
    .sku { font-size: 7px; font-family: monospace; letter-spacing: 0.05em; margin-top: 1px; }
    .price { font-size: 8px; font-weight: bold; margin-top: 1px; }
    .bc { display: flex; justify-content: center; margin: 1px 0; }
    .bc svg { height: 18px; width: auto; }`
    : `.biz { font-size: 8px; font-weight: bold; text-transform: uppercase; color: #555; }
    .branch { font-size: 8px; color: #666; margin-top: 2px; }
    .name { font-size: 11px; font-weight: bold; line-height: 1.2; margin: 4px 0; }
    .var { font-size: 9px; color: #444; margin: 2px 0; }
    .pack { font-size: 8px; color: #555; margin-top: 2px; }
    .sku { font-size: 10px; font-family: monospace; letter-spacing: 0.1em; margin-top: 4px; }
    .price { font-size: 12px; font-weight: bold; margin-top: 4px; }
    .bc { display: flex; justify-content: center; margin: 4px 0; }`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Barcode labels</title><style>
    @page { size: A4; margin: 10mm; }
    body { font-family: Arial, sans-serif; margin: 0; }
    ${gridCss}
    ${typeCss}
  </style></head><body><div class="grid">${cells}</div></body></html>`;
}

export function flattenLinesToJobs(lines: LabelPrintLine[], ctx?: LabelPrintContext): LabelPrintJob[] {
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

function openLabelHtmlInBrowser(html: string, autoPrint: boolean): void {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    throw new Error('Pop-up blocked. Allow pop-ups to print labels.');
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  if (autoPrint) {
    setTimeout(() => {
      win.print();
    }, 400);
  }
}

/** Open A4 label grid in a new window (no print dialog). */
export function previewLabelsInBrowser(html: string): void {
  openLabelHtmlInBrowser(html, false);
}

/** Open A4 label grid in a new window and trigger print. */
export function printLabelsInBrowser(html: string): void {
  openLabelHtmlInBrowser(html, true);
}

export function printProductLabelsBatch(
  lines: LabelPrintLine[],
  settings: BarcodeLabelSettings,
  ctx?: LabelPrintContext,
): { ok: boolean; hint?: string; printedCount: number } {
  const jobs = flattenLinesToJobs(lines, ctx);
  if (jobs.length === 0) {
    return { ok: false, hint: 'No printable labels (check barcode/SKU and selection).', printedCount: 0 };
  }
  try {
    const html = buildA4SheetHtml(jobs, settings);
    printLabelsInBrowser(html);
    return { ok: true, printedCount: jobs.length };
  } catch (e) {
    return {
      ok: false,
      hint: e instanceof Error ? e.message : 'Print failed',
      printedCount: 0,
    };
  }
}
