/** A4 / Letter sheet layout presets (maps to a4Columns + maxLabelsPerSheet). */

export type BarcodeLabelPresetId =
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
};

export const BARCODE_LABEL_PRESETS: BarcodeLabelPreset[] = [
  {
    id: 'a4_3x11',
    label: 'A4 — 3 × 11 (33 labels)',
    description: '3 columns × 11 rows per A4 sheet (matches common 3-across sticker sheets)',
    a4Columns: 3,
    maxLabelsPerSheet: 33,
  },
  {
    id: 'letter_3x10',
    label: 'Letter — 3 × 10 (30 labels)',
    description: 'US Letter 8.5″ × 11″, 3 columns × 10 rows',
    a4Columns: 3,
    maxLabelsPerSheet: 30,
  },
  {
    id: 'a4_2x15',
    label: 'A4 — 2 × 15 (30 labels)',
    description: '2 wider columns × 15 rows',
    a4Columns: 2,
    maxLabelsPerSheet: 30,
  },
  {
    id: 'a4_4x8',
    label: 'A4 — 4 × 8 (32 labels)',
    description: '4 narrow columns × 8 rows',
    a4Columns: 4,
    maxLabelsPerSheet: 32,
  },
  {
    id: 'custom',
    label: 'Custom layout',
    description: 'Set columns and labels per page manually',
    a4Columns: 3,
    maxLabelsPerSheet: 30,
  },
];

export function presetIdFromLayout(a4Columns: number, maxLabelsPerSheet: number): BarcodeLabelPresetId {
  const hit = BARCODE_LABEL_PRESETS.find(
    (p) =>
      p.id !== 'custom' &&
      p.a4Columns === a4Columns &&
      p.maxLabelsPerSheet === maxLabelsPerSheet
  );
  return hit?.id ?? 'custom';
}

export function gridSummary(columns: number, maxPerSheet: number): string {
  const cols = Math.max(2, Math.min(4, columns));
  const rows = Math.ceil(Math.max(1, maxPerSheet) / cols);
  return `${cols} columns × ${rows} rows ≈ ${maxPerSheet} labels/page`;
}
