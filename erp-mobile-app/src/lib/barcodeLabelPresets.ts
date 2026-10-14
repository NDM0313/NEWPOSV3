/** A4 / Letter sheet layout presets (maps to a4Columns + maxLabelsPerSheet). */

export type BarcodeLabelPresetId =
  | 'sticker_65x25'
  | 'a4_3x11'
  | 'letter_3x10'
  | 'a4_2x15'
  | 'a4_4x8'
  | 'custom';

export type BarcodeLabelPreset = {
  id: BarcodeLabelPresetId;
  label: string;
  description: string;
  a4Columns: number;
  maxLabelsPerSheet: number;
  labelWidthMm?: number;
  labelHeightMm?: number;
  useFixedLabelSize?: boolean;
};

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

export type FitLabelsOnA4Result = {
  a4Columns: number;
  maxLabelsPerSheet: number;
  rows: number;
};

export function clampLabelWidthMm(n: number): number {
  return Math.max(20, Math.min(120, Math.round(n)));
}

export function clampLabelHeightMm(n: number): number {
  return Math.max(10, Math.min(80, Math.round(n)));
}

/**
 * Fit as many fixed-size stickers as possible on an A4 page.
 * Columns clamped to 2–4 for UI consistency; labels/page clamped 6–60.
 */
export function fitLabelsOnA4Page(opts: {
  widthMm: number;
  heightMm: number;
  marginMm?: number;
  gapMm?: number;
}): FitLabelsOnA4Result {
  const marginMm = opts.marginMm ?? 10;
  const gapMm = opts.gapMm ?? 2;
  const w = Math.max(1, opts.widthMm);
  const h = Math.max(1, opts.heightMm);
  const usableW = A4_WIDTH_MM - 2 * marginMm;
  const usableH = A4_HEIGHT_MM - 2 * marginMm;

  let cols = Math.floor((usableW + gapMm) / (w + gapMm));
  let rows = Math.floor((usableH + gapMm) / (h + gapMm));
  cols = Math.max(1, cols);
  rows = Math.max(1, rows);

  const a4Columns = Math.max(2, Math.min(4, cols === 1 ? 2 : cols));
  const maxLabelsPerSheet = Math.max(6, Math.min(60, a4Columns * rows));
  const fittedRows = Math.ceil(maxLabelsPerSheet / a4Columns);

  return {
    a4Columns,
    maxLabelsPerSheet,
    rows: fittedRows,
  };
}

const sticker65Fit = fitLabelsOnA4Page({ widthMm: 65, heightMm: 25 });

export const BARCODE_LABEL_PRESETS: BarcodeLabelPreset[] = [
  {
    id: 'sticker_65x25',
    label: 'Sticker 6.5 × 2.5 cm',
    description: `Fixed 65×25 mm stickers on A4 (${sticker65Fit.a4Columns} cols × ${sticker65Fit.rows} rows ≈ ${sticker65Fit.maxLabelsPerSheet}/page)`,
    a4Columns: sticker65Fit.a4Columns,
    maxLabelsPerSheet: sticker65Fit.maxLabelsPerSheet,
    labelWidthMm: 65,
    labelHeightMm: 25,
    useFixedLabelSize: true,
  },
  {
    id: 'a4_3x11',
    label: 'A4 — 3 × 11 (33 labels)',
    description: '3 columns × 11 rows per A4 sheet',
    a4Columns: 3,
    maxLabelsPerSheet: 33,
    useFixedLabelSize: false,
  },
  {
    id: 'letter_3x10',
    label: 'Letter — 3 × 10 (30 labels)',
    description: 'US Letter, 3 columns × 10 rows',
    a4Columns: 3,
    maxLabelsPerSheet: 30,
    useFixedLabelSize: false,
  },
  {
    id: 'a4_2x15',
    label: 'A4 — 2 × 15 (30 labels)',
    description: '2 wider columns × 15 rows',
    a4Columns: 2,
    maxLabelsPerSheet: 30,
    useFixedLabelSize: false,
  },
  {
    id: 'a4_4x8',
    label: 'A4 — 4 × 8 (32 labels)',
    description: '4 narrow columns × 8 rows',
    a4Columns: 4,
    maxLabelsPerSheet: 32,
    useFixedLabelSize: false,
  },
  {
    id: 'custom',
    label: 'Custom layout',
    description: 'Set sticker size (cm), columns, and labels per page manually',
    a4Columns: 3,
    maxLabelsPerSheet: 30,
  },
];

export function presetIdFromLayout(
  a4Columns: number,
  maxLabelsPerSheet: number,
  opts?: { labelWidthMm?: number; labelHeightMm?: number; useFixedLabelSize?: boolean },
): BarcodeLabelPresetId {
  if (
    opts?.useFixedLabelSize &&
    opts.labelWidthMm === 65 &&
    opts.labelHeightMm === 25 &&
    a4Columns === sticker65Fit.a4Columns &&
    maxLabelsPerSheet === sticker65Fit.maxLabelsPerSheet
  ) {
    return 'sticker_65x25';
  }
  const hit = BARCODE_LABEL_PRESETS.find(
    (p) =>
      p.id !== 'custom' &&
      p.id !== 'sticker_65x25' &&
      !p.useFixedLabelSize &&
      p.a4Columns === a4Columns &&
      p.maxLabelsPerSheet === maxLabelsPerSheet,
  );
  return hit?.id ?? 'custom';
}

export function gridSummary(columns: number, maxPerSheet: number): string {
  const cols = Math.max(2, Math.min(4, columns));
  const rows = Math.ceil(Math.max(1, maxPerSheet) / cols);
  return `${cols} columns × ${rows} rows ≈ ${maxPerSheet} labels/page`;
}

export function stickerSizeSummary(
  widthMm: number,
  heightMm: number,
  columns: number,
  maxPerSheet: number,
): string {
  const rows = Math.ceil(Math.max(1, maxPerSheet) / Math.max(1, columns));
  return `${widthMm}×${heightMm} mm → ${columns} cols × ${rows} rows (${maxPerSheet}/page)`;
}

export function cmToMm(cm: number): number {
  return Math.round(cm * 10);
}

export function mmToCm(mm: number): number {
  return Math.round(mm) / 10;
}
