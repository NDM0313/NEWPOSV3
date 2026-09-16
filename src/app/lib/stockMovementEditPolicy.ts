/**
 * Which stock_movements rows may be edited from Full Stock Ledger (manual corrections only).
 */

const BLOCKED_REFERENCE_TYPES = new Set([
  'opening_balance',
  'sale',
  'purchase',
  'purchase_return',
  'sale_return',
  'transfer',
  'transfer_in',
  'transfer_out',
  'bespoke_work_order',
  'rental',
  'rental_out',
  'rental_in',
  'shipment',
  'studio',
  'job',
  'pos',
]);

export type StockMovementEditShape = {
  movement_type?: string | null;
  type?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
};

export function isEditableManualStockAdjustment(m: StockMovementEditShape): boolean {
  const mt = String(m.movement_type || m.type || '')
    .toLowerCase()
    .trim();
  if (mt !== 'adjustment') return false;

  const rt = String(m.reference_type || '')
    .toLowerCase()
    .trim();
  if (rt === 'opening_balance') return false;
  if (BLOCKED_REFERENCE_TYPES.has(rt)) return false;

  const rid = m.reference_id != null ? String(m.reference_id).trim() : '';
  if (rid && rt !== 'adjustment' && rt !== '') return false;

  return rt === 'adjustment' || rt === '' || rt === 'manual';
}

/** After-edit stock = balance shown after row minus old qty plus new signed qty. */
export function projectedStockBalanceAfterEdit(
  balanceAfterMovement: number,
  oldSignedQuantity: number,
  newSignedQuantity: number
): number {
  return balanceAfterMovement - oldSignedQuantity + newSignedQuantity;
}

export function parseAdjustmentNotes(notes: string | null | undefined): {
  reason: string;
  detail: string;
} {
  const raw = String(notes || '').trim();
  if (!raw) return { reason: 'correction', detail: '' };
  const colon = raw.indexOf(':');
  if (colon <= 0) return { reason: 'correction', detail: raw };
  const reason = raw.slice(0, colon).trim().toLowerCase().replace(/\s+/g, '_');
  const detail = raw.slice(colon + 1).trim();
  const known = new Set(['damaged', 'audit', 'return', 'theft', 'correction', 'other']);
  if (known.has(reason)) return { reason, detail };
  return { reason: 'correction', detail: raw };
}

export function formatAdjustmentNotes(reason: string, detail: string): string {
  const r = reason.trim() || 'correction';
  const d = detail.trim();
  return d ? `${r}: ${d}` : r;
}
