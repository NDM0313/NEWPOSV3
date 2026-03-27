import { activityLogService } from '@/app/services/activityLogService';

export interface FieldChangeRow {
  field: string;
  label?: string;
  oldValue: unknown;
  newValue: unknown;
}

/** Human-readable lines for history / descriptions. */
export function formatFieldChangeLines(rows: FieldChangeRow[]): string[] {
  return rows.map((r) => {
    const label = r.label || r.field;
    const ov = r.oldValue;
    const nv = r.newValue;
    if (ov === nv || String(ov) === String(nv)) return '';
    return `${label} changed from ${formatVal(ov)} to ${formatVal(nv)}`;
  }).filter(Boolean);
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return Number(v).toLocaleString();
  return String(v);
}

/**
 * Persist one activity row per edit batch (caller supplies pre-formatted description lines).
 */
export async function logDocumentEditActivity(params: {
  companyId: string;
  module: 'sale' | 'purchase' | 'expense' | 'payment' | 'inventory';
  entityId: string;
  entityReference?: string;
  action: string;
  lines: string[];
  performedBy?: string | null;
}): Promise<void> {
  const description = params.lines.filter(Boolean).join('; ') || 'Document updated';
  await activityLogService
    .logActivity({
      companyId: params.companyId,
      module: params.module,
      entityId: params.entityId,
      entityReference: params.entityReference,
      action: params.action,
      performedBy: params.performedBy ?? undefined,
      description,
    })
    .catch(() => {});
}
