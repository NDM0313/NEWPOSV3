/**
 * Studio list/detail display helpers (web) — parity with erp-mobile-app/src/lib/studioOrderDisplay.ts
 */

export type StudioListProductionStatus =
  | 'Not Started'
  | 'In Progress'
  | 'Completed'
  | 'Cancelled';

export interface StudioListBadgeInput {
  customerInvoiceGenerated?: boolean;
  allStagesCompleted?: boolean;
  productionStatus: StudioListProductionStatus;
  saleStatus?: string | null;
}

export interface StudioListBadge {
  key: string;
  label: string;
  className: string;
}

export function isBillGenerated(input: { customerInvoiceGenerated?: boolean }): boolean {
  return Boolean(input.customerInvoiceGenerated);
}

export function allStagesCompleted(stages: Array<{ status?: string }> | undefined): boolean {
  if (!stages?.length) return false;
  return stages.every((s) => String(s.status ?? '').toLowerCase() === 'completed');
}

export function isStudioPipelineStructurallyLocked(
  invoiceLinked: boolean,
  saleFinalized: boolean,
  saleCancelled: boolean
): boolean {
  return invoiceLinked || saleFinalized || saleCancelled;
}

/** List row badge: Bill Generated > Tasks Complete > production status */
export function getStudioListBadge(input: StudioListBadgeInput): StudioListBadge {
  if (input.saleStatus === 'cancelled' || input.productionStatus === 'Cancelled') {
    return {
      key: 'cancelled',
      label: 'Cancelled',
      className: 'bg-red-500/20 text-red-400 border-red-500/40',
    };
  }
  if (isBillGenerated(input)) {
    return {
      key: 'bill-generated',
      label: 'Bill Generated',
      className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    };
  }
  if (input.allStagesCompleted) {
    return {
      key: 'tasks-complete',
      label: 'Tasks Complete',
      className: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
    };
  }
  const map: Record<StudioListProductionStatus, StudioListBadge> = {
    'Not Started': {
      key: 'not-started',
      label: 'Not Started',
      className: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    },
    'In Progress': {
      key: 'in-progress',
      label: 'In Progress',
      className: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
    },
    Completed: {
      key: 'completed',
      label: 'Completed',
      className: 'bg-green-500/20 text-green-400 border-green-500/40',
    },
    Cancelled: {
      key: 'cancelled',
      label: 'Cancelled',
      className: 'bg-red-500/20 text-red-400 border-red-500/40',
    },
  };
  return map[input.productionStatus] ?? map['Not Started'];
}

/** Calendar YYYY-MM-DD → timestamptz at noon UTC (stable day for PK backdating). */
export function parseStudioWorkflowDate(dateStr?: string | null): string | undefined {
  if (!dateStr?.trim()) return undefined;
  const d = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return `${d}T12:00:00.000Z`;
  return d;
}

export function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}
