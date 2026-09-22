/**
 * Phase 3D — Balance Sheet preview compare source when main loader swaps.
 */

export type BalanceSheetPreviewCompareSource = 'unified_compare' | 'legacy_shadow';

export function resolveBalanceSheetPreviewCompareSource(
  mainLoader: 'legacy' | 'unified',
): BalanceSheetPreviewCompareSource {
  return mainLoader === 'unified' ? 'legacy_shadow' : 'unified_compare';
}
