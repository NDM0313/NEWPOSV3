import {
  expenseCategoriesCanonicallyEqual,
  normalizeCategoryForComparison,
  normalizeNullableText,
} from '@/app/lib/expenseEditCanonical';

/**
 * Domain-based edit classification for ERP documents.
 *
 * Each edit is bucketed into HEADER / ACCOUNTING / INVENTORY (and payment-linkage),
 * with an explicit actionPlan. Execution layers should branch on actionPlan — not on a
 * single global “full reverse + full repost” outcome.
 */

export type EditAccountingKind =
  | 'NO_POSTING_CHANGE'
  | 'HEADER_ONLY_CHANGE'
  /** Accounting and/or inventory deltas without unrelated subsystem reversal. */
  | 'DELTA_ADJUSTMENT'
  /** Legacy / escape hatch when no safe delta path is modeled yet. */
  | 'FULL_REVERSE_REPOST'
  | 'BLOCKED_CLOSED_PERIOD';

/** User-facing domain tags for traces and the test bench. */
export type EditImpactDomain = 'HEADER_ONLY' | 'ACCOUNTING_IMPACT' | 'INVENTORY_IMPACT';

export interface EditActionPlan {
  updateHeader: boolean;
  adjustAccounting: boolean;
  adjustInventory: boolean;
  touchPayments: boolean;
}

export interface DomainFlags {
  header: boolean;
  accounting: boolean;
  inventory: boolean;
  payments: boolean;
}

export interface GenericEditClassification {
  kind: EditAccountingKind;
  reasons: string[];
  changedFields: string[];
  postingChangedFields: string[];
  headerOnlyChangedFields: string[];
  nonPostingChangedFields: string[];
  /** Domain model (mandatory on all classifiers). */
  affectedDomains: EditImpactDomain[];
  domains: DomainFlags;
  headerChangedFields: string[];
  accountingChangedFields: string[];
  inventoryChangedFields: string[];
  actionPlan: EditActionPlan;
}

export interface PaidExpenseSnapshot {
  status: string;
  amount: number;
  paymentMethod: string;
  date: string;
  location: string;
  paymentAccountId?: string;
  category: string;
  description: string;
  notes?: string | null;
  payeeName?: string | null;
}

export interface ExpenseEditUpdates {
  amount?: number;
  paymentMethod?: string;
  date?: string;
  location?: string;
  paymentAccountId?: string;
  category?: string;
  description?: string;
  notes?: string;
  payeeName?: string;
  status?: string;
  approvedBy?: string;
  approvedDate?: string;
}

export interface ExpenseEditClassification extends GenericEditClassification {
  /** JE / payment presentation patch (HEADER_ONLY / date / description). */
  presentation?: { entryDate?: string; journalDescription?: string };
  rollbackReversalOnRepostFailure: boolean;
}

export function normalizeLiquidityLabel(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[_-]+/g, ' ');
  return norm(a) === norm(b);
}

function normalizeMethod(value: string, paymentAccountId?: string): string {
  const base = String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  if (!base) return '';
  if (base === 'other' && paymentAccountId) return `account:${paymentAccountId}`;
  return base;
}

export interface ExpenseEditDiff {
  changedFields: string[];
  postingChangedFields: string[];
  headerOnlyChangedFields: string[];
  nonPostingChangedFields: string[];
}

/** Raw vs canonical snapshots for debug / transaction inspector. */
export interface ExpenseEditCanonicalRow {
  field: string;
  rawOld?: string;
  rawNew?: string;
  canonicalOld?: string;
  canonicalNew?: string;
  equivalent: boolean;
}

export function buildExpenseEditDiff(
  existing: PaidExpenseSnapshot,
  updates: ExpenseEditUpdates
): ExpenseEditDiff {
  const changedFields: string[] = [];
  const postingChangedFields: string[] = [];
  const headerOnlyChangedFields: string[] = [];
  const nonPostingChangedFields: string[] = [];

  const add = (field: string, group: 'posting' | 'header' | 'non', changed: boolean) => {
    if (!changed) return;
    changedFields.push(field);
    if (group === 'posting') postingChangedFields.push(field);
    if (group === 'header') headerOnlyChangedFields.push(field);
    if (group === 'non') nonPostingChangedFields.push(field);
  };

  add('amount', 'posting', updates.amount !== undefined && Number(updates.amount) !== Number(existing.amount));
  add(
    'category',
    'posting',
    updates.category !== undefined && !expenseCategoriesCanonicallyEqual(updates.category, existing.category)
  );
  add(
    'payment_account_id',
    'posting',
    updates.paymentAccountId !== undefined && (updates.paymentAccountId || '') !== (existing.paymentAccountId || '')
  );
  const stablePaymentAccount =
    updates.paymentAccountId !== undefined
      ? (updates.paymentAccountId || '') === (existing.paymentAccountId || '') && !!(updates.paymentAccountId || '')
      : !!(existing.paymentAccountId || '');
  add(
    'payment_method',
    'posting',
    updates.paymentMethod !== undefined &&
      !stablePaymentAccount &&
      normalizeMethod(updates.paymentMethod, updates.paymentAccountId ?? existing.paymentAccountId) !==
        normalizeMethod(existing.paymentMethod, existing.paymentAccountId)
  );
  add('branch_id', 'posting', updates.location !== undefined && updates.location !== existing.location);
  add('company_id', 'posting', false);

  add('entry_date', 'header', updates.date !== undefined && updates.date !== existing.date);
  add('month_bucket', 'header', updates.date !== undefined && !sameCalendarMonth(updates.date, existing.date));
  add(
    'description',
    'header',
    updates.description !== undefined &&
      String(updates.description ?? '').trim() !== String(existing.description ?? '').trim()
  );

  add(
    'notes',
    'non',
    updates.notes !== undefined &&
      normalizeNullableText(updates.notes) !== normalizeNullableText(existing.notes)
  );
  add(
    'payee',
    'non',
    updates.payeeName !== undefined &&
      normalizeNullableText(updates.payeeName) !== normalizeNullableText(existing.payeeName)
  );
  add('tax', 'non', false);
  add('freight', 'non', false);

  return { changedFields, postingChangedFields, headerOnlyChangedFields, nonPostingChangedFields };
}

/** Build canonical comparison rows for UI / inspector (includes fields sent but canonically equal). */
export function buildExpenseCanonicalComparisonRows(
  existing: PaidExpenseSnapshot,
  updates: ExpenseEditUpdates
): ExpenseEditCanonicalRow[] {
  const rows: ExpenseEditCanonicalRow[] = [];

  const pushCat = () => {
    if (updates.category === undefined) return;
    const co = normalizeCategoryForComparison(existing.category);
    const cn = normalizeCategoryForComparison(updates.category);
    rows.push({
      field: 'category',
      rawOld: String(existing.category ?? ''),
      rawNew: String(updates.category ?? ''),
      canonicalOld: co,
      canonicalNew: cn,
      equivalent: co === cn,
    });
  };
  const pushNotes = () => {
    if (updates.notes === undefined) return;
    const a = normalizeNullableText(existing.notes);
    const b = normalizeNullableText(updates.notes);
    rows.push({
      field: 'notes',
      rawOld: String(existing.notes ?? ''),
      rawNew: String(updates.notes ?? ''),
      canonicalOld: a,
      canonicalNew: b,
      equivalent: a === b,
    });
  };
  const pushPayee = () => {
    if (updates.payeeName === undefined) return;
    const a = normalizeNullableText(existing.payeeName);
    const b = normalizeNullableText(updates.payeeName);
    rows.push({
      field: 'payeeName',
      rawOld: String(existing.payeeName ?? ''),
      rawNew: String(updates.payeeName ?? ''),
      canonicalOld: a,
      canonicalNew: b,
      equivalent: a === b,
    });
  };
  pushCat();
  pushNotes();
  pushPayee();
  if (updates.date !== undefined) {
    rows.push({
      field: 'entry_date',
      rawOld: String(existing.date ?? ''),
      rawNew: String(updates.date ?? ''),
      equivalent: updates.date === existing.date,
    });
  }
  return rows;
}

/** Human-readable hints for the transaction inspector when outcome looks wrong. */
export function explainExpenseEditOutcome(
  existing: PaidExpenseSnapshot,
  updates: ExpenseEditUpdates,
  classification: ExpenseEditClassification
): string[] {
  const lines: string[] = [];
  const canon = buildExpenseCanonicalComparisonRows(existing, updates);
  const cat = canon.find((r) => r.field === 'category');
  if (cat && !cat.equivalent && classification.kind === 'DELTA_ADJUSTMENT') {
    lines.push(
      `Accounting adjustment is expected: category changed from "${cat.rawOld}" to "${rawPreview(cat.rawNew)}" (canonical ${cat.canonicalOld} → ${cat.canonicalNew}).`
    );
  }
  if (
    cat &&
    cat.equivalent &&
    updates.category !== undefined &&
    rawPreview(cat.rawOld) !== rawPreview(cat.rawNew) &&
    classification.kind === 'DELTA_ADJUSTMENT'
  ) {
    lines.push(
      `BUG: category raw values differ ("${rawPreview(cat.rawOld)}" vs "${rawPreview(cat.rawNew)}") but canonical comparison says equivalent — DELTA_ADJUSTMENT should not be caused by category alone.`
    );
  }
  if (
    classification.kind === 'DELTA_ADJUSTMENT' &&
    !classification.postingChangedFields.includes('category') &&
    classification.postingChangedFields.length > 0
  ) {
    lines.push(
      `DELTA_ADJUSTMENT driven by: ${classification.postingChangedFields.join(', ')} (not category presentation).`
    );
  }
  if (
    (classification.kind === 'HEADER_ONLY_CHANGE' || classification.kind === 'NO_POSTING_CHANGE') &&
    classification.actionPlan.adjustAccounting
  ) {
    lines.push('BUG: header-only kind but actionPlan.adjustAccounting is true.');
  }
  if (lines.length === 0) lines.push('No anomaly detected in canonical checks for this payload.');
  return lines;
}

function rawPreview(s: string | undefined): string {
  const t = String(s ?? '');
  return t.length > 60 ? `${t.slice(0, 57)}…` : t;
}

export function sameCalendarMonth(isoA: string, isoB: string): boolean {
  const da = (isoA || '').slice(0, 10);
  const db = (isoB || '').slice(0, 10);
  if (da.length < 7 || db.length < 7) return false;
  return da.slice(0, 7) === db.slice(0, 7);
}

/** Stub: wire to company fiscal calendar / locked periods when available. */
export function isExpenseDateInLockedPeriod(_companyId: string, _isoDate: string): boolean {
  return false;
}

function buildDomainFlags(args: {
  headerChangedFields: string[];
  accountingChangedFields: string[];
  inventoryChangedFields: string[];
  paymentsTouch: boolean;
}): DomainFlags {
  return {
    header: args.headerChangedFields.length > 0,
    accounting: args.accountingChangedFields.length > 0,
    inventory: args.inventoryChangedFields.length > 0,
    payments: args.paymentsTouch,
  };
}

function affectedDomainsFromFlags(d: DomainFlags): EditImpactDomain[] {
  const out: EditImpactDomain[] = [];
  if (d.header) out.push('HEADER_ONLY');
  if (d.accounting) out.push('ACCOUNTING_IMPACT');
  if (d.inventory) out.push('INVENTORY_IMPACT');
  return out;
}

export function actionPlanFromDomains(d: DomainFlags): EditActionPlan {
  return {
    updateHeader: d.header,
    adjustAccounting: d.accounting,
    adjustInventory: d.inventory,
    touchPayments: d.payments,
  };
}

/**
 * Derive execution kind from domain flags. Avoid FULL_REVERSE_REPOST unless nothing else fits.
 */
function kindFromDomains(d: DomainFlags, opts?: { blocked?: boolean }): EditAccountingKind {
  if (opts?.blocked) return 'BLOCKED_CLOSED_PERIOD';
  if (!d.header && !d.accounting && !d.inventory && !d.payments) return 'NO_POSTING_CHANGE';
  if (d.header && !d.accounting && !d.inventory && !d.payments) return 'HEADER_ONLY_CHANGE';
  return 'DELTA_ADJUSTMENT';
}

function mergeGenericBase(args: {
  changedFields: string[];
  postingChangedFields: string[];
  headerOnlyChangedFields: string[];
  nonPostingChangedFields: string[];
  headerChangedFields: string[];
  accountingChangedFields: string[];
  inventoryChangedFields: string[];
  paymentsTouch: boolean;
  reasons: string[];
  kind: EditAccountingKind;
}): GenericEditClassification {
  const domains = buildDomainFlags({
    headerChangedFields: args.headerChangedFields,
    accountingChangedFields: args.accountingChangedFields,
    inventoryChangedFields: args.inventoryChangedFields,
    paymentsTouch: args.paymentsTouch,
  });
  return {
    kind: args.kind,
    reasons: args.reasons,
    changedFields: args.changedFields,
    postingChangedFields: args.postingChangedFields,
    headerOnlyChangedFields: args.headerOnlyChangedFields,
    nonPostingChangedFields: args.nonPostingChangedFields,
    affectedDomains: affectedDomainsFromFlags(domains),
    domains,
    headerChangedFields: args.headerChangedFields,
    accountingChangedFields: args.accountingChangedFields,
    inventoryChangedFields: args.inventoryChangedFields,
    actionPlan: actionPlanFromDomains(domains),
  };
}

/**
 * Hard safety: fail loudly in test / bench when classification implies forbidden cross-subsystem work.
 */
export function evaluateEditSafetyViolations(c: GenericEditClassification): string[] {
  const v: string[] = [];
  const { domains, actionPlan, kind, headerChangedFields, accountingChangedFields, inventoryChangedFields } = c;

  const headerOnlyScenario =
    domains.header &&
    !domains.accounting &&
    !domains.inventory &&
    !domains.payments &&
    accountingChangedFields.length === 0 &&
    inventoryChangedFields.length === 0;

  if (headerOnlyScenario && kind === 'FULL_REVERSE_REPOST') {
    v.push('SAFETY: header-only edit must not use FULL_REVERSE_REPOST (date/notes/reference).');
  }

  const onlyNotesRefDate =
    kind !== 'BLOCKED_CLOSED_PERIOD' &&
    headerChangedFields.length > 0 &&
    !domains.inventory &&
    !domains.payments &&
    accountingChangedFields.length === 0 &&
    inventoryChangedFields.length === 0 &&
    headerChangedFields.every((f) => ['notes', 'reference_no', 'entry_date', 'supplier_ref'].includes(f));

  if (onlyNotesRefDate && kind === 'FULL_REVERSE_REPOST') {
    v.push('SAFETY: notes/reference/date-only edit must not use FULL_REVERSE_REPOST.');
  }

  if (!domains.inventory && actionPlan.adjustInventory) {
    v.push('SAFETY: inventory adjustment flagged but no inventory domain — do not reverse unrelated stock.');
  }
  if (!domains.accounting && !domains.inventory && kind === 'DELTA_ADJUSTMENT') {
    v.push('SAFETY: DELTA_ADJUSTMENT requires at least accounting or inventory domain.');
  }
  if (!domains.payments && actionPlan.touchPayments) {
    v.push('SAFETY: touchPayments set without payments domain.');
  }
  if (domains.accounting && !domains.inventory && actionPlan.adjustInventory) {
    v.push('SAFETY: accounting-only edit must not adjust inventory.');
  }
  if (domains.inventory && !domains.accounting && !domains.payments && actionPlan.touchPayments) {
    v.push('SAFETY: quantity/inventory-only edit must not touch linked payments.');
  }

  return v;
}

const TEST_MODE_KEY = 'accounting_edit_safety_test_mode';

export function isAccountingEditSafetyTestMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(TEST_MODE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setAccountingEditSafetyTestMode(on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (on) window.localStorage.setItem(TEST_MODE_KEY, '1');
    else window.localStorage.removeItem(TEST_MODE_KEY);
  } catch {
    /* noop */
  }
}

export function assertDomainEditSafetyTestMode(c: GenericEditClassification, context?: string): void {
  if (!isAccountingEditSafetyTestMode()) return;
  const violations = evaluateEditSafetyViolations(c);
  if (violations.length === 0) return;
  const msg = `[ACCOUNTING_EDIT_SAFETY] ${context || 'classification'} failed:\n` + violations.join('\n');
  console.error(msg);
  throw new Error(msg);
}

export function classifyPaidExpenseEdit(
  existing: PaidExpenseSnapshot,
  updates: ExpenseEditUpdates,
  companyId: string
): ExpenseEditClassification {
  const diff = buildExpenseEditDiff(existing, updates);
  const st = String(existing.status || '').toLowerCase();
  if (st !== 'paid') {
    const base = mergeGenericBase({
      changedFields: diff.changedFields,
      postingChangedFields: diff.postingChangedFields,
      headerOnlyChangedFields: diff.headerOnlyChangedFields,
      nonPostingChangedFields: diff.nonPostingChangedFields,
      headerChangedFields: [...diff.headerOnlyChangedFields, ...diff.nonPostingChangedFields],
      accountingChangedFields: [],
      inventoryChangedFields: [],
      paymentsTouch: false,
      reasons: ['expense not paid — no GL maintenance path in this classifier'],
      kind: 'NO_POSTING_CHANGE',
    });
    return { ...base, rollbackReversalOnRepostFailure: false };
  }

  const amountChanged =
    updates.amount !== undefined && Number(updates.amount) !== Number(existing.amount);
  const payAccChanged =
    updates.paymentAccountId !== undefined &&
    (updates.paymentAccountId || '') !== (existing.paymentAccountId || '');
  const stablePaymentAccountId =
    updates.paymentAccountId !== undefined
      ? (updates.paymentAccountId || '') === (existing.paymentAccountId || '') && !!(updates.paymentAccountId || '')
      : !!(existing.paymentAccountId || '');
  const methodChanged =
    updates.paymentMethod !== undefined &&
    !stablePaymentAccountId &&
    !normalizeLiquidityLabel(updates.paymentMethod, existing.paymentMethod);
  const categoryChanged =
    updates.category !== undefined && !expenseCategoriesCanonicallyEqual(updates.category, existing.category);
  const branchChanged =
    updates.location !== undefined && updates.location !== existing.location;
  const dateChanged = updates.date !== undefined && updates.date !== existing.date;

  if (updates.date !== undefined && isExpenseDateInLockedPeriod(companyId, updates.date)) {
    const base = mergeGenericBase({
      changedFields: diff.changedFields,
      postingChangedFields: diff.postingChangedFields,
      headerOnlyChangedFields: diff.headerOnlyChangedFields,
      nonPostingChangedFields: diff.nonPostingChangedFields,
      headerChangedFields: diff.headerOnlyChangedFields,
      accountingChangedFields: diff.postingChangedFields,
      inventoryChangedFields: [],
      paymentsTouch: false,
      reasons: ['target date in locked fiscal period'],
      kind: 'BLOCKED_CLOSED_PERIOD',
    });
    return { ...base, rollbackReversalOnRepostFailure: false };
  }

  const structural = amountChanged || payAccChanged || methodChanged || categoryChanged || branchChanged;

  const accountingChangedFields = [...diff.postingChangedFields];

  if (structural) {
    const base = mergeGenericBase({
      changedFields: diff.changedFields,
      postingChangedFields: diff.postingChangedFields,
      headerOnlyChangedFields: diff.headerOnlyChangedFields,
      nonPostingChangedFields: diff.nonPostingChangedFields,
      headerChangedFields: [...diff.headerOnlyChangedFields, ...diff.nonPostingChangedFields],
      accountingChangedFields,
      inventoryChangedFields: [],
      paymentsTouch: false,
      reasons: [
        amountChanged && 'amount',
        payAccChanged && 'payment_account_id',
        methodChanged && 'payment_method',
        categoryChanged && 'category',
        branchChanged && 'branch_id',
        dateChanged && !structural && 'date',
      ].filter(Boolean) as string[],
      kind: 'DELTA_ADJUSTMENT',
    });
    return {
      ...base,
      rollbackReversalOnRepostFailure: true,
    };
  }

  const descriptionChanged =
    updates.description !== undefined && updates.description !== existing.description;

  const presentation: { entryDate?: string; journalDescription?: string } = {};
  const headerReasons: string[] = [];
  if (dateChanged) {
    presentation.entryDate = updates.date;
    headerReasons.push(sameCalendarMonth(updates.date!, existing.date) ? 'entry_date_same_month' : 'entry_date_cross_month_header_patch');
  }
  if (descriptionChanged) {
    const cat = String(updates.category ?? existing.category);
    const desc = String(updates.description);
    presentation.journalDescription = `${cat} - ${desc}`.trim();
    headerReasons.push('description');
  }
  if (dateChanged || descriptionChanged || diff.nonPostingChangedFields.length > 0) {
    const hdr = [...diff.headerOnlyChangedFields, ...diff.nonPostingChangedFields];
    const base = mergeGenericBase({
      changedFields: diff.changedFields,
      postingChangedFields: [],
      headerOnlyChangedFields: diff.headerOnlyChangedFields,
      nonPostingChangedFields: diff.nonPostingChangedFields,
      headerChangedFields: hdr.length ? hdr : diff.changedFields.filter((x) => !accountingChangedFields.includes(x)),
      accountingChangedFields: [],
      inventoryChangedFields: [],
      paymentsTouch: false,
      reasons: headerReasons.length ? headerReasons : diff.nonPostingChangedFields,
      kind: 'HEADER_ONLY_CHANGE',
    });
    return {
      ...base,
      presentation,
      rollbackReversalOnRepostFailure: false,
    };
  }

  const base = mergeGenericBase({
    changedFields: diff.changedFields,
    postingChangedFields: [],
    headerOnlyChangedFields: diff.headerOnlyChangedFields,
    nonPostingChangedFields: diff.nonPostingChangedFields,
    headerChangedFields: diff.nonPostingChangedFields,
    accountingChangedFields: [],
    inventoryChangedFields: [],
    paymentsTouch: false,
    reasons: ['no GL drivers (notes, payee, attachments, approvals, etc.)'],
    kind: 'NO_POSTING_CHANGE',
  });
  return { ...base, rollbackReversalOnRepostFailure: false };
}

function isChanged(a: unknown, b: unknown): boolean {
  return String(a ?? '').trim() !== String(b ?? '').trim();
}

function normalizeNum(v: unknown): number {
  return Number(v || 0);
}

function classifyDocumentDomains(args: {
  changedFields: string[];
  /** Document metadata — never triggers inventory or payment linkage by itself. */
  headerFields: string[];
  /** GL / AR / AP / revenue / expense drivers. */
  accountingFields: string[];
  /** Stock movement / valuation on hand. */
  inventoryFields: string[];
  /** Linked sale/purchase payment records need re-allocation. */
  paymentTouchFields: string[];
  /** Non-posting text fields (still HEADER_ONLY domain for audit). */
  nonPostingFields: string[];
}): GenericEditClassification {
  const { changedFields, headerFields, accountingFields, inventoryFields, paymentTouchFields, nonPostingFields } =
    args;

  const headerChangedFields = changedFields.filter(
    (f) => headerFields.includes(f) || nonPostingFields.includes(f)
  );
  const accountingChangedFields = changedFields.filter((f) => accountingFields.includes(f));
  const inventoryChangedFields = changedFields.filter((f) => inventoryFields.includes(f));
  const paymentsTouch = changedFields.some((f) => paymentTouchFields.includes(f));

  const postingChangedFields = [...new Set([...accountingChangedFields, ...inventoryChangedFields])];
  const headerOnlyChangedFields = changedFields.filter((f) => headerFields.includes(f));
  const nonPostingChangedFields = changedFields.filter((f) => nonPostingFields.includes(f));

  const domains = buildDomainFlags({
    headerChangedFields,
    accountingChangedFields,
    inventoryChangedFields,
    paymentsTouch,
  });

  let kind: EditAccountingKind = kindFromDomains(domains, {});
  if (!domains.accounting && !domains.inventory && !domains.payments && domains.header) {
    kind = headerChangedFields.some((f) => nonPostingFields.includes(f)) && headerChangedFields.every((f) => nonPostingFields.includes(f))
      ? 'NO_POSTING_CHANGE'
      : 'HEADER_ONLY_CHANGE';
  }

  const reasons =
    changedFields.length > 0 ? changedFields : (['no_posting_fields_changed'] as string[]);

  return mergeGenericBase({
    changedFields,
    postingChangedFields,
    headerOnlyChangedFields,
    nonPostingChangedFields,
    headerChangedFields,
    accountingChangedFields,
    inventoryChangedFields,
    paymentsTouch,
    reasons,
    kind,
  });
}

export function classifySalesEdit(params: {
  oldSnap: Record<string, unknown>;
  newSnap: Record<string, unknown>;
}): GenericEditClassification {
  const o = params.oldSnap;
  const n = params.newSnap;
  const changedFields = [
    isChanged(o.notes, n.notes) && 'notes',
    isChanged(o.referenceNo, n.referenceNo) && 'reference_no',
    isChanged(o.date, n.date) && 'entry_date',
    isChanged(o.customerId, n.customerId) && 'customer_id',
    normalizeNum(o.itemQtyTotal) !== normalizeNum(n.itemQtyTotal) && 'item_qty',
    normalizeNum(o.itemRateTotal) !== normalizeNum(n.itemRateTotal) && 'item_rate',
    normalizeNum(o.discount) !== normalizeNum(n.discount) && 'discount',
    normalizeNum(o.shipping) !== normalizeNum(n.shipping) && 'shipping',
    isChanged(o.paymentAccountId, n.paymentAccountId) && 'payment_account_id',
    isChanged(o.branchId, n.branchId) && 'branch_id',
    isChanged(o.paymentStatus, n.paymentStatus) && 'payment_status',
    isChanged(o.saleType, n.saleType) && 'sale_type',
  ].filter(Boolean) as string[];
  return classifyDocumentDomains({
    changedFields,
    headerFields: ['entry_date', 'reference_no'],
    accountingFields: [
      'customer_id',
      'item_qty',
      'item_rate',
      'discount',
      'shipping',
      'payment_account_id',
      'branch_id',
      'payment_status',
      'sale_type',
    ],
    inventoryFields: ['item_qty'],
    paymentTouchFields: ['payment_status', 'sale_type'],
    nonPostingFields: ['notes'],
  });
}

export function classifyPurchaseEdit(params: {
  oldSnap: Record<string, unknown>;
  newSnap: Record<string, unknown>;
}): GenericEditClassification {
  const o = params.oldSnap;
  const n = params.newSnap;
  const changedFields = [
    isChanged(o.notes, n.notes) && 'notes',
    isChanged(o.supplierRef, n.supplierRef) && 'supplier_ref',
    isChanged(o.date, n.date) && 'entry_date',
    isChanged(o.supplierId, n.supplierId) && 'supplier_id',
    normalizeNum(o.itemQtyTotal) !== normalizeNum(n.itemQtyTotal) && 'item_qty',
    normalizeNum(o.itemCostTotal) !== normalizeNum(n.itemCostTotal) && 'item_cost',
    normalizeNum(o.discount) !== normalizeNum(n.discount) && 'discount',
    normalizeNum(o.freight) !== normalizeNum(n.freight) && 'freight',
    normalizeNum(o.tax) !== normalizeNum(n.tax) && 'tax',
    isChanged(o.payableAccountId, n.payableAccountId) && 'payable_account_id',
    isChanged(o.branchId, n.branchId) && 'branch_id',
    normalizeNum(o.stockImpactQty) !== normalizeNum(n.stockImpactQty) && 'stock_qty',
  ].filter(Boolean) as string[];
  return classifyDocumentDomains({
    changedFields,
    headerFields: ['entry_date', 'supplier_ref'],
    accountingFields: [
      'supplier_id',
      'discount',
      'freight',
      'tax',
      'payable_account_id',
      'branch_id',
      'item_cost',
      'item_qty',
      'stock_qty',
    ],
    inventoryFields: ['item_qty', 'item_cost', 'stock_qty'],
    paymentTouchFields: [],
    nonPostingFields: ['notes'],
  });
}

export function classifyPaymentEdit(params: {
  oldSnap: Record<string, unknown>;
  newSnap: Record<string, unknown>;
  side: 'customer' | 'supplier';
}): GenericEditClassification {
  const o = params.oldSnap;
  const n = params.newSnap;
  const contactField = params.side === 'customer' ? 'customer_id' : 'supplier_id';
  const changedFields = [
    isChanged(o.notes, n.notes) && 'notes',
    isChanged(o.date, n.date) && 'entry_date',
    isChanged(o.contactId, n.contactId) && contactField,
    normalizeNum(o.amount) !== normalizeNum(n.amount) && 'amount',
    isChanged(o.accountId, n.accountId) && 'payment_account_id',
    isChanged(o.allocationRef, n.allocationRef) && 'allocation_ref',
    isChanged(o.branchId, n.branchId) && 'branch_id',
  ].filter(Boolean) as string[];
  return classifyDocumentDomains({
    changedFields,
    headerFields: ['entry_date'],
    accountingFields: ['amount', 'payment_account_id', 'customer_id', 'supplier_id', 'allocation_ref', 'branch_id'],
    inventoryFields: [],
    paymentTouchFields: ['allocation_ref', 'customer_id', 'supplier_id'],
    nonPostingFields: ['notes'],
  });
}

export function classifyInventoryEdit(params: {
  oldSnap: Record<string, unknown>;
  newSnap: Record<string, unknown>;
}): GenericEditClassification {
  const o = params.oldSnap;
  const n = params.newSnap;
  const changedFields = [
    isChanged(o.notes, n.notes) && 'notes',
    isChanged(o.date, n.date) && 'entry_date',
    normalizeNum(o.qty) !== normalizeNum(n.qty) && 'stock_qty',
    normalizeNum(o.valuation) !== normalizeNum(n.valuation) && 'stock_valuation',
    isChanged(o.accountId, n.accountId) && 'inventory_account_id',
    isChanged(o.branchId, n.branchId) && 'branch_id',
  ].filter(Boolean) as string[];
  return classifyDocumentDomains({
    changedFields,
    headerFields: ['entry_date'],
    accountingFields: ['stock_valuation', 'inventory_account_id', 'branch_id'],
    inventoryFields: ['stock_qty'],
    paymentTouchFields: [],
    nonPostingFields: ['notes'],
  });
}
