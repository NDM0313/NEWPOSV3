/**
 * Pure helpers for Balance Basis Guide report — operational clamp vs signed party GL.
 */

export type BalanceBasisGuideRow = {
  contactId: string;
  contactName: string;
  contactCode: string | null;
  contactType: string;
  subledgerAccountHint: string | null;
  glArSigned: number;
  glApSigned: number;
  glWorkerSigned: number;
  operationalReceivable: number;
  operationalPayable: number;
  hiddenCreditAr: number;
  hiddenCreditAp: number;
  documentDueReceivable: number;
  documentDuePayable: number;
};

export type BalanceBasisGuideTotals = {
  receivablesOperational: number;
  receivablesPartySigned: number;
  receivablesControl: number | null;
  receivablesPartyVsControl: number | null;
  receivablesOperationalVsSigned: number;
  payablesOperational: number;
  payablesPartySigned: number;
  payablesControl: number | null;
  payablesPartyVsControl: number | null;
  payablesOperationalVsSigned: number;
  workerPayablesControl: number | null;
};

export type BalanceBasisGuideTypeFilter = 'all' | 'customers' | 'suppliers' | 'workers';

export type BalanceBasisGuideSortKey =
  | 'contactName'
  | 'glArSigned'
  | 'glApSigned'
  | 'operationalReceivable'
  | 'operationalPayable'
  | 'hiddenCreditAr'
  | 'hiddenCreditAp';

export type SortDirection = 'asc' | 'desc';

const EPS = 0.009;

export function computeOperationalClamped(signed: number): number {
  return Math.max(0, signed);
}

export function computeHiddenCredit(signed: number, operational: number): number {
  return signed - operational;
}

export function buildBalanceBasisGuideRow(args: {
  contactId: string;
  contactName: string;
  contactCode: string | null;
  contactType: string;
  subledgerAccountHint?: string | null;
  glArSigned: number;
  glApSigned: number;
  glWorkerSigned: number;
  documentDueReceivable?: number;
  documentDuePayable?: number;
}): BalanceBasisGuideRow {
  const operationalReceivable = computeOperationalClamped(args.glArSigned);
  const paySignedTotal = args.glApSigned + args.glWorkerSigned;
  const operationalPayable = computeOperationalClamped(paySignedTotal);
  return {
    contactId: args.contactId,
    contactName: args.contactName,
    contactCode: args.contactCode,
    contactType: args.contactType,
    subledgerAccountHint: args.subledgerAccountHint ?? null,
    glArSigned: args.glArSigned,
    glApSigned: args.glApSigned,
    glWorkerSigned: args.glWorkerSigned,
    operationalReceivable,
    operationalPayable,
    hiddenCreditAr: computeHiddenCredit(args.glArSigned, operationalReceivable),
    hiddenCreditAp: computeHiddenCredit(paySignedTotal, operationalPayable),
    documentDueReceivable: args.documentDueReceivable ?? 0,
    documentDuePayable: args.documentDuePayable ?? 0,
  };
}

export function rowHasGap(row: BalanceBasisGuideRow): boolean {
  const arGap = Math.abs(row.hiddenCreditAr) > EPS;
  const apGap = Math.abs(row.hiddenCreditAp) > EPS;
  return arGap || apGap;
}

export function sumBalanceBasisGuideTotals(rows: BalanceBasisGuideRow[]): Pick<
  BalanceBasisGuideTotals,
  | 'receivablesOperational'
  | 'receivablesPartySigned'
  | 'receivablesOperationalVsSigned'
  | 'payablesOperational'
  | 'payablesPartySigned'
  | 'payablesOperationalVsSigned'
> {
  let receivablesOperational = 0;
  let receivablesPartySigned = 0;
  let payablesOperational = 0;
  let payablesPartySigned = 0;
  for (const r of rows) {
    receivablesOperational += r.operationalReceivable;
    receivablesPartySigned += r.glArSigned;
    payablesOperational += r.operationalPayable;
    payablesPartySigned += r.glApSigned + r.glWorkerSigned;
  }
  return {
    receivablesOperational,
    receivablesPartySigned,
    receivablesOperationalVsSigned: receivablesOperational - receivablesPartySigned,
    payablesOperational,
    payablesPartySigned,
    payablesOperationalVsSigned: payablesOperational - payablesPartySigned,
  };
}

export function mergeControlTotals(
  rowSums: ReturnType<typeof sumBalanceBasisGuideTotals>,
  control: {
    receivablesControl: number | null;
    payablesControl: number | null;
    workerPayablesControl: number | null;
  }
): BalanceBasisGuideTotals {
  const receivablesPartyVsControl =
    control.receivablesControl != null
      ? rowSums.receivablesPartySigned - control.receivablesControl
      : null;
  const payablesPartyVsControl =
    control.payablesControl != null ? rowSums.payablesPartySigned - control.payablesControl : null;
  return {
    ...rowSums,
    receivablesControl: control.receivablesControl,
    payablesControl: control.payablesControl,
    workerPayablesControl: control.workerPayablesControl,
    receivablesPartyVsControl,
    payablesPartyVsControl,
  };
}

export function filterBalanceBasisGuideRows(
  rows: BalanceBasisGuideRow[],
  filters: {
    search?: string;
    typeFilter?: BalanceBasisGuideTypeFilter;
    hideZeroOperational?: boolean;
    showOnlyWithGap?: boolean;
  }
): BalanceBasisGuideRow[] {
  const search = (filters.search || '').trim().toLowerCase();
  const typeFilter = filters.typeFilter || 'all';
  let out = rows;

  if (typeFilter === 'customers') {
    out = out.filter((r) => r.contactType === 'customer' || r.contactType === 'both');
  } else if (typeFilter === 'suppliers') {
    out = out.filter((r) => r.contactType === 'supplier' || r.contactType === 'both');
  } else if (typeFilter === 'workers') {
    out = out.filter((r) => r.contactType === 'worker');
  }

  if (filters.hideZeroOperational) {
    out = out.filter((r) => r.operationalReceivable > EPS || r.operationalPayable > EPS);
  }

  if (filters.showOnlyWithGap) {
    out = out.filter(rowHasGap);
  }

  if (search) {
    out = out.filter(
      (r) =>
        r.contactName.toLowerCase().includes(search) ||
        (r.contactCode || '').toLowerCase().includes(search) ||
        (r.subledgerAccountHint || '').toLowerCase().includes(search)
    );
  }

  return out;
}

export function sortBalanceBasisGuideRows(
  rows: BalanceBasisGuideRow[],
  sortKey: BalanceBasisGuideSortKey,
  direction: SortDirection
): BalanceBasisGuideRow[] {
  const mul = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    let av: number | string = a.contactName;
    let bv: number | string = b.contactName;
    switch (sortKey) {
      case 'glArSigned':
        av = a.glArSigned;
        bv = b.glArSigned;
        break;
      case 'glApSigned':
        av = a.glApSigned + a.glWorkerSigned;
        bv = b.glApSigned + b.glWorkerSigned;
        break;
      case 'operationalReceivable':
        av = a.operationalReceivable;
        bv = b.operationalReceivable;
        break;
      case 'operationalPayable':
        av = a.operationalPayable;
        bv = b.operationalPayable;
        break;
      case 'hiddenCreditAr':
        av = a.hiddenCreditAr;
        bv = b.hiddenCreditAr;
        break;
      case 'hiddenCreditAp':
        av = a.hiddenCreditAp;
        bv = b.hiddenCreditAp;
        break;
      default:
        break;
    }
    if (typeof av === 'string' && typeof bv === 'string') {
      return av.localeCompare(bv) * mul;
    }
    return ((Number(av) || 0) - (Number(bv) || 0)) * mul;
  });
}

export function formatRowGapExplanation(row: BalanceBasisGuideRow): string {
  const parts: string[] = [];
  if (Math.abs(row.hiddenCreditAr) > EPS) {
    parts.push(
      `AR signed ${row.glArSigned.toFixed(2)} → operational ${row.operationalReceivable.toFixed(2)} (hidden ${row.hiddenCreditAr.toFixed(2)})`
    );
  }
  const paySigned = row.glApSigned + row.glWorkerSigned;
  if (Math.abs(row.hiddenCreditAp) > EPS) {
    parts.push(
      `AP signed ${paySigned.toFixed(2)} → operational ${row.operationalPayable.toFixed(2)} (hidden ${row.hiddenCreditAp.toFixed(2)})`
    );
  }
  return parts.join('; ') || 'No gap — signed equals operational';
}
