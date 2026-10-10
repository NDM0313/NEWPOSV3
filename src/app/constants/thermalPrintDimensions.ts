/**
 * Shared thermal roll dimensions — layout, browser print, and PDF capture must stay in sync.
 * Sales invoices, POS receipts, and order slips only (not tabular A4 reports).
 */

export type ThermalPaperSize = '58mm' | '80mm';

export interface ThermalDimensions {
  paperSize: ThermalPaperSize;
  widthMm: number;
  screenPx: number;
  printMarginMm: number;
  /** Item / Qty / Amt column widths (percent). */
  columns: { item: number; qty: number; amt: number };
  horizontalPaddingPx: number;
  baseFontPx: number;
  lineHeight: number;
  logoMaxPx: number;
  modalMaxPx: number;
}

const SPECS: Record<ThermalPaperSize, Omit<ThermalDimensions, 'paperSize'>> = {
  '58mm': {
    widthMm: 58,
    screenPx: 210,
    printMarginMm: 1,
    columns: { item: 52, qty: 14, amt: 34 },
    horizontalPaddingPx: 8,
    baseFontPx: 9,
    lineHeight: 1.25,
    logoMaxPx: 36,
    modalMaxPx: 230,
  },
  '80mm': {
    widthMm: 80,
    screenPx: 300,
    printMarginMm: 2,
    columns: { item: 50, qty: 15, amt: 35 },
    horizontalPaddingPx: 12,
    baseFontPx: 10,
    lineHeight: 1.35,
    logoMaxPx: 48,
    modalMaxPx: 320,
  },
};

export function getThermalDimensions(paperSize: ThermalPaperSize): ThermalDimensions {
  return { paperSize, ...SPECS[paperSize] };
}

export function thermalPaperSizeFromAttr(value: string | null | undefined): ThermalPaperSize {
  return value === '58mm' ? '58mm' : '80mm';
}
