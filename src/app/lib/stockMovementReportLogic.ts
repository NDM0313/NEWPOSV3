/**
 * Pure logic for Stock Ledger by Product report.
 * Data source: stock_movements only (read-only transforms).
 */

import { getMovementTypeLabel, type StockStatusBadge } from './stockMovementDisplay';

export type MovementTypeFilter =
  | 'all'
  | 'purchase'
  | 'sale'
  | 'return'
  | 'adjustment'
  | 'transfer'
  | 'opening_stock'
  | 'production'
  | 'rental'
  | 'cancelled';

export type StockStatusFilter = 'all' | 'in_stock' | 'zero_stock' | 'negative_stock' | 'no_movement';

export type ReportMode = 'single' | 'all';

export interface StockMovementReportFilters {
  mode: ReportMode;
  dateFrom: string;
  dateTo: string;
  branchId: string | null;
  productId: string | null;
  variationId: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  brandId: string | null;
  supplierId: string | null;
  movementType: MovementTypeFilter;
  stockStatus: StockStatusFilter;
  includeZeroStock: boolean;
  includeNoTransaction: boolean;
  includeInactive: boolean;
}

export interface RawStockMovement {
  id: string;
  created_at: string;
  movement_type?: string | null;
  type?: string | null;
  quantity: number;
  unit_cost?: number | null;
  total_cost?: number | null;
  reference_type?: string | null;
  reference_id?: string | null;
  notes?: string | null;
  branch_id?: string | null;
  variation_id?: string | null;
  created_by?: string | null;
}

export interface StockMovementReportRow {
  id: string;
  date: string;
  branchName: string | null;
  movementType: string;
  movementTypeLabel: string;
  reference: string | null;
  party: string | null;
  qtyIn: number;
  qtyOut: number;
  adjQty: number;
  quantity: number;
  runningBalance: number;
  unitCost: number | null;
  stockValue: number | null;
  createdBy: string | null;
  notes: string | null;
  variationLabel?: string | null;
}

export interface ProductStockSummary {
  productId: string;
  productName: string;
  sku: string;
  category: string | null;
  brand: string | null;
  unit: string | null;
  openingStock: number;
  totalIn: number;
  totalOut: number;
  netAdjustment: number;
  periodClosing: number;
  currentStock: number;
  lastMovementDate: string | null;
  movementCountInPeriod: number;
  status: StockStatusBadge;
  hasMovements: boolean;
  hasInventoryBalanceRow: boolean;
  missingBalanceRow: boolean;
}

export interface StockIntegrityFlags {
  negativeStockCount: number;
  zeroStockCount: number;
  noMovementCount: number;
  missingBalanceCount: number;
  balanceWithoutMovementCount: number;
}

export interface ExportRow {
  rowType: 'SUMMARY' | 'DETAIL' | 'SEPARATOR';
  productId?: string;
  productName?: string;
  sku?: string;
  [key: string]: string | number | undefined;
}

const OPENING_REFS = new Set(['opening_balance', 'opening_stock']);

export function normalizeMovementType(
  rawType: string | null | undefined,
  referenceType?: string | null,
): string {
  const ref = String(referenceType || '').toLowerCase();
  if (OPENING_REFS.has(ref)) return 'opening_stock';
  return String(rawType || '').toLowerCase();
}

export function isOpeningMovement(rawType: string | null | undefined, referenceType?: string | null): boolean {
  const norm = normalizeMovementType(rawType, referenceType);
  return norm === 'opening_stock' || norm === 'opening_balance';
}

function rawMovementType(m: RawStockMovement): string {
  return String(m.movement_type || m.type || '').toLowerCase();
}

export function matchesMovementTypeFilter(
  rawType: string | null | undefined,
  referenceType: string | null | undefined,
  filter: MovementTypeFilter,
): boolean {
  if (filter === 'all') return true;
  const type = normalizeMovementType(rawType, referenceType);
  const ref = String(referenceType || '').toLowerCase();

  switch (filter) {
    case 'opening_stock':
      return type === 'opening_stock' || type === 'opening_balance' || OPENING_REFS.has(ref);
    case 'return':
      return ['return', 'sell_return', 'sale_return', 'purchase_return', 'rental_return', 'rental_in'].includes(type);
    case 'transfer':
      return ['transfer', 'transfer_in', 'transfer_out'].includes(type);
    case 'production':
      return ['production', 'production_in'].includes(type);
    case 'rental':
      return ['rental_out', 'rental_in', 'rental_return'].includes(type);
    case 'cancelled':
      return ['sale_cancelled', 'purchase_cancelled'].includes(type);
    default:
      return type === filter;
  }
}

export function startOfDayIso(dateStr: string): string {
  return `${dateStr}T00:00:00.000Z`;
}

export function endOfDayIso(dateStr: string): string {
  return `${dateStr}T23:59:59.999Z`;
}

export function validateFilters(dateFrom: string, dateTo: string): string | null {
  if (!dateFrom || !dateTo) return 'Date range is required.';
  if (dateFrom > dateTo) return 'From date cannot be after To date.';
  return null;
}

export function computeOpeningStock(movements: RawStockMovement[], dateFrom: string): number {
  const cutoff = startOfDayIso(dateFrom);
  return movements
    .filter((m) => m.created_at < cutoff)
    .reduce((sum, m) => sum + Number(m.quantity || 0), 0);
}

export interface PeriodTotals {
  totalIn: number;
  totalOut: number;
  netAdjustment: number;
}

export function computePeriodTotals(
  movements: RawStockMovement[],
  dateFrom: string,
  dateTo: string,
): PeriodTotals {
  const from = startOfDayIso(dateFrom);
  const to = endOfDayIso(dateTo);
  let totalIn = 0;
  let totalOut = 0;
  let netAdjustment = 0;

  movements
    .filter((m) => m.created_at >= from && m.created_at <= to)
    .forEach((m) => {
      const qty = Number(m.quantity || 0);
      const type = rawMovementType(m);
      const isOpening = isOpeningMovement(type, m.reference_type);

      if (type === 'adjustment' || isOpening) {
        netAdjustment += qty;
        if (qty > 0) totalIn += qty;
        else if (qty < 0) totalOut += Math.abs(qty);
      } else if (qty > 0) {
        totalIn += qty;
      } else if (qty < 0) {
        totalOut += Math.abs(qty);
      }
    });

  return { totalIn, totalOut, netAdjustment };
}

export function filterMovementsInPeriod(
  movements: RawStockMovement[],
  dateFrom: string,
  dateTo: string,
): RawStockMovement[] {
  const from = startOfDayIso(dateFrom);
  const to = endOfDayIso(dateTo);
  return movements
    .filter((m) => m.created_at >= from && m.created_at <= to)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function computeRunningBalances(
  openingQty: number,
  periodMovements: RawStockMovement[],
): Map<string, number> {
  const balances = new Map<string, number>();
  let running = openingQty;
  periodMovements.forEach((m) => {
    running += Number(m.quantity || 0);
    balances.set(m.id, running);
  });
  return balances;
}

export function deriveStockStatus(currentStock: number, hasMovements: boolean): StockStatusBadge {
  if (!hasMovements) return 'no_movement';
  if (currentStock < 0) return 'negative_stock';
  if (currentStock === 0) return 'zero_stock';
  return 'in_stock';
}

export function matchesStockStatusFilter(status: StockStatusBadge, filter: StockStatusFilter): boolean {
  if (filter === 'all') return true;
  return status === filter;
}

export interface EnrichmentContext {
  branchNames?: Record<string, string>;
  referenceLabels?: Record<string, string>;
  partyNames?: Record<string, string>;
  createdByNames?: Record<string, string>;
  variationLabels?: Record<string, string>;
}

export function buildMovementReportRows(
  periodMovements: RawStockMovement[],
  openingQty: number,
  ctx: EnrichmentContext = {},
): StockMovementReportRow[] {
  const balances = computeRunningBalances(openingQty, periodMovements);

  return periodMovements.map((m) => {
    const qty = Number(m.quantity || 0);
    const type = rawMovementType(m);
    const isOpening = isOpeningMovement(type, m.reference_type);
    const isAdj = type === 'adjustment' || isOpening;

    let qtyIn = 0;
    let qtyOut = 0;
    let adjQty = 0;
    if (isAdj) {
      adjQty = qty;
      if (qty > 0) qtyIn = qty;
      else if (qty < 0) qtyOut = Math.abs(qty);
    } else if (qty > 0) {
      qtyIn = qty;
    } else if (qty < 0) {
      qtyOut = Math.abs(qty);
    }

    const unitCost = m.unit_cost != null ? Number(m.unit_cost) : null;
    const runningBalance = balances.get(m.id) ?? openingQty;
    const refKey = m.reference_id ? `${m.reference_type}:${m.reference_id}` : '';

    return {
      id: m.id,
      date: m.created_at,
      branchName: m.branch_id ? ctx.branchNames?.[m.branch_id] ?? null : null,
      movementType: type,
      movementTypeLabel: getMovementTypeLabel(type, m.reference_type),
      reference: refKey ? ctx.referenceLabels?.[refKey] ?? m.reference_id ?? null : null,
      party: refKey ? ctx.partyNames?.[refKey] ?? null : null,
      qtyIn,
      qtyOut,
      adjQty,
      quantity: qty,
      runningBalance,
      unitCost,
      stockValue: unitCost != null ? unitCost * runningBalance : null,
      createdBy: m.created_by ? ctx.createdByNames?.[m.created_by] ?? null : null,
      notes: m.notes ?? null,
      variationLabel: m.variation_id
        ? ctx.variationLabels?.[String(m.variation_id)] ?? null
        : null,
    };
  });
}

export function buildProductSummary(
  meta: {
    productId: string;
    productName: string;
    sku: string;
    category?: string | null;
    brand?: string | null;
    unit?: string | null;
  },
  allMovements: RawStockMovement[],
  periodMovements: RawStockMovement[],
  dateFrom: string,
  dateTo: string,
  currentStock: number,
  hasInventoryBalanceRow: boolean,
): ProductStockSummary {
  const openingStock = computeOpeningStock(allMovements, dateFrom);
  const totals = computePeriodTotals(allMovements, dateFrom, dateTo);
  const periodClosing = openingStock + periodMovements.reduce((s, m) => s + Number(m.quantity || 0), 0);
  const hasMovements = allMovements.length > 0;
  const lastMovementDate =
    allMovements.length > 0
      ? [...allMovements].sort((a, b) => b.created_at.localeCompare(a.created_at))[0].created_at
      : null;

  const missingBalanceRow = hasMovements && !hasInventoryBalanceRow;

  return {
    ...meta,
    category: meta.category ?? null,
    brand: meta.brand ?? null,
    unit: meta.unit ?? null,
    openingStock,
    totalIn: totals.totalIn,
    totalOut: totals.totalOut,
    netAdjustment: totals.netAdjustment,
    periodClosing,
    currentStock,
    lastMovementDate,
    movementCountInPeriod: periodMovements.length,
    status: deriveStockStatus(currentStock, hasMovements),
    hasMovements,
    hasInventoryBalanceRow,
    missingBalanceRow,
  };
}

export function buildIntegritySummary(summaries: ProductStockSummary[]): StockIntegrityFlags {
  return summaries.reduce(
    (acc, s) => {
      if (s.status === 'negative_stock') acc.negativeStockCount += 1;
      if (s.status === 'zero_stock') acc.zeroStockCount += 1;
      if (s.status === 'no_movement') acc.noMovementCount += 1;
      if (s.missingBalanceRow) acc.missingBalanceCount += 1;
      if (!s.hasMovements && s.hasInventoryBalanceRow && s.currentStock !== 0) {
        acc.balanceWithoutMovementCount += 1;
      }
      return acc;
    },
    {
      negativeStockCount: 0,
      zeroStockCount: 0,
      noMovementCount: 0,
      missingBalanceCount: 0,
      balanceWithoutMovementCount: 0,
    },
  );
}

export function defaultDateRange(): { dateFrom: string; dateTo: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
  };
}

export function defaultFilters(): StockMovementReportFilters {
  const { dateFrom, dateTo } = defaultDateRange();
  return {
    mode: 'single',
    dateFrom,
    dateTo,
    branchId: null,
    productId: null,
    variationId: null,
    categoryId: null,
    subcategoryId: null,
    brandId: null,
    supplierId: null,
    movementType: 'all',
    stockStatus: 'all',
    includeZeroStock: true,
    includeNoTransaction: false,
    includeInactive: false,
  };
}

export interface ProductReportSection {
  summary: ProductStockSummary;
  rows: StockMovementReportRow[];
  isEmpty: boolean;
  /** When true, detail tables include a Variation column (combined all-variations view). */
  showVariationColumn?: boolean;
}

export function buildExportRows(sections: ProductReportSection[]): ExportRow[] {
  const out: ExportRow[] = [];
  sections.forEach((section, idx) => {
    const s = section.summary;
    out.push({
      rowType: 'SUMMARY',
      productId: s.productId,
      productName: s.productName,
      sku: s.sku,
      category: s.category ?? '',
      brand: s.brand ?? '',
      openingStock: s.openingStock,
      totalIn: s.totalIn,
      totalOut: s.totalOut,
      netAdjustment: s.netAdjustment,
      periodClosing: s.periodClosing,
      currentStock: s.currentStock,
      status: s.status,
    });

    if (section.isEmpty) {
      out.push({
        rowType: 'DETAIL',
        productId: s.productId,
        date: '',
        movementType: '',
        reference: '',
        party: '',
        qtyIn: 0,
        qtyOut: 0,
        runningBalance: s.currentStock,
        notes: 'No stock movement found for this product.',
      });
    } else {
      section.rows.forEach((r) => {
        out.push({
          rowType: 'DETAIL',
          productId: s.productId,
          date: r.date,
          branch: r.branchName ?? '',
          movementType: r.movementTypeLabel,
          reference: r.reference ?? '',
          party: r.party ?? '',
          qtyIn: r.qtyIn,
          qtyOut: r.qtyOut,
          adjQty: r.adjQty,
          runningBalance: r.runningBalance,
          unitCost: r.unitCost ?? '',
          notes: r.notes ?? '',
        });
      });
    }

    if (idx < sections.length - 1) {
      out.push({ rowType: 'SEPARATOR' });
    }
  });
  return out;
}

export function buildPrintSnapshotFromSections(sections: ProductReportSection[]): {
  columns: { key: string; label: string }[];
  rows: Record<string, string | number>[];
} {
  const columns = [
    { key: 'date', label: 'Date' },
    { key: 'branch', label: 'Branch' },
    { key: 'type', label: 'Type' },
    { key: 'reference', label: 'Reference' },
    { key: 'party', label: 'Party' },
    { key: 'qtyIn', label: 'Qty In' },
    { key: 'qtyOut', label: 'Qty Out' },
    { key: 'balance', label: 'Balance' },
    { key: 'notes', label: 'Notes' },
  ];

  const rows: Record<string, string | number>[] = [];
  sections.forEach((section) => {
    const s = section.summary;
    rows.push({
      date: `[${s.productName} — ${s.sku}]`,
      branch: `Opening: ${s.openingStock} | In: ${s.totalIn} | Out: ${s.totalOut} | Current: ${s.currentStock}`,
      type: '',
      reference: '',
      party: '',
      qtyIn: '',
      qtyOut: '',
      balance: '',
      notes: s.status,
    });

    if (section.isEmpty) {
      rows.push({
        date: '',
        branch: '',
        type: '',
        reference: '',
        party: '',
        qtyIn: '',
        qtyOut: '',
        balance: s.currentStock,
        notes: 'No stock movement found for this product.',
      });
    } else {
      section.rows.forEach((r) => {
        rows.push({
          date: r.date.slice(0, 10),
          branch: r.branchName ?? '',
          type: r.movementTypeLabel,
          reference: r.reference ?? '',
          party: r.party ?? '',
          qtyIn: r.qtyIn || '',
          qtyOut: r.qtyOut || '',
          balance: r.runningBalance,
          notes: r.notes ?? '',
        });
      });
    }
  });

  return { columns, rows };
}
