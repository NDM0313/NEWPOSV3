/**
 * Read-only stock movement history for one count line (or all-branches product group).
 * Same movement loader + summarizer as Full Stock Ledger.
 * Clickable sale / purchase / rental document refs via existing drawers.
 */
import { useEffect, useState } from 'react';
import { History, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  stockCountService,
  type StockCountHistoryResult,
  type StockCountLine,
} from '../../services/stockCountService';
import {
  emptyHistoryTotals,
  historyCategoryLabel,
  itemKindLabel,
  type StockHistoryCategory,
} from '@/app/lib/stockCountDisplay';
import type { StockLedgerSummary } from '@/app/lib/stockLedgerSummary';
import type { DriftMovementLike } from '@/app/lib/stockCountDrift';
import {
  isPurchaseReferenceType,
  isSaleReferenceType,
} from '@/app/lib/stockMovementReferenceEnrichment';
import { mapRentalRowToUI } from '@/app/lib/rentalUiMapper';
import { rentalService } from '@/app/services/rentalService';
import type { RentalUI } from '@/app/context/RentalContext';
import { formatQty } from '@/app/utils/quantity';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ViewSaleDetailsDrawer } from '../sales/ViewSaleDetailsDrawer';
import { ViewPurchaseDetailsDrawer } from '../purchases/ViewPurchaseDetailsDrawer';
import { ViewRentalDetailsDrawer } from '../rentals/ViewRentalDetailsDrawer';

type HistoryPayload = StockCountHistoryResult & {
  ledgerSummary?: StockLedgerSummary;
  outstandingRentSummary?: StockLedgerSummary;
  countBaseline?: number | null;
  movementsSinceBaseline?: DriftMovementLike[];
  byBranch?: Array<{
    branch_id: string;
    system_qty: number;
    movements: StockCountHistoryResult['movements'];
    totals: StockCountHistoryResult['totals'];
  }>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  companyId: string;
  branchId?: string | null;
  branchIds?: string[];
  branchName?: string;
  branchNames?: Record<string, string>;
  allBranchesScope?: boolean;
  line: StockCountLine | null;
  /** Preview mode: use fixture movements instead of network */
  previewMovements?: HistoryPayload | null;
};

const SUMMARY_KEYS: StockHistoryCategory[] = [
  'opening',
  'purchase',
  'purchase_return',
  'sale',
  'sale_return',
  'rental_out',
  'rental_in',
  'transfer_in',
  'transfer_out',
  'production_in',
  'production_out',
  'adjustment',
  'other',
];

function resolveDocTarget(movement: {
  reference_type?: string | null;
  reference_id?: string | null;
  movement_type?: string | null;
}): { kind: 'sale' | 'purchase' | 'rental' | null; id: string | null } {
  const rid = movement.reference_id ? String(movement.reference_id) : '';
  if (!rid) return { kind: null, id: null };
  const rt = String(movement.reference_type || '').toLowerCase();
  const mt = String(movement.movement_type || '').toLowerCase();
  if (isSaleReferenceType(rt)) return { kind: 'sale', id: rid };
  if (isPurchaseReferenceType(rt)) return { kind: 'purchase', id: rid };
  if (rt === 'rental' || mt === 'rental_out' || mt === 'rental_in' || mt === 'rental_return') {
    return { kind: 'rental', id: rid };
  }
  return { kind: null, id: null };
}

export function StockCountHistoryDrawer({
  open,
  onClose,
  companyId,
  branchId,
  branchIds,
  branchName,
  branchNames,
  allBranchesScope,
  line,
  previewMovements,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [allHistory, setAllHistory] = useState(true);
  const [data, setData] = useState<HistoryPayload | null>(null);
  const [detailBranchId, setDetailBranchId] = useState<string | null>(null);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [viewSaleOpen, setViewSaleOpen] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [viewPurchaseOpen, setViewPurchaseOpen] = useState(false);
  const [selectedRental, setSelectedRental] = useState<RentalUI | null>(null);
  const [viewRentalOpen, setViewRentalOpen] = useState(false);

  useEffect(() => {
    if (!open || !line || !companyId) return;

    if (previewMovements) {
      setData(previewMovements);
      setLoading(false);
      return;
    }

    const scopeIds =
      branchIds && branchIds.length
        ? branchIds
        : branchId && branchId !== 'all' && branchId !== '__all_branches__'
          ? [branchId]
          : [];
    if (!scopeIds.length) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setData(null);
      setDetailBranchId(null);
      try {
        const result = await stockCountService.getLineHistory({
          companyId,
          branchId: scopeIds.length === 1 ? scopeIds[0] : null,
          branchIds: scopeIds.length > 1 ? scopeIds : undefined,
          productId: line.product_id,
          variationId: line.variation_id,
          dateFrom: allHistory ? null : dateFrom || null,
          dateTo: allHistory ? null : dateTo || null,
          baselineAt: line.baseline_at,
          countBaseline: line.system_qty_baseline,
        });
        if (!cancelled) setData(result);
      } catch (e: any) {
        if (!cancelled) {
          toast.error(e?.message || 'Failed to load history');
          setData({
            movements: [],
            totals: emptyHistoryTotals(),
            system_qty: line.current_system_qty ?? line.system_qty_baseline,
            countBaseline: line.system_qty_baseline,
            movementsSinceBaseline: [],
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    open,
    line?.id,
    line?.product_id,
    line?.variation_id,
    line?.baseline_at,
    companyId,
    branchId,
    branchIds?.join(','),
    allHistory,
    dateFrom,
    dateTo,
    previewMovements,
  ]);

  if (!open || !line) return null;

  const branchDetail =
    detailBranchId && data?.byBranch
      ? data.byBranch.find((b) => b.branch_id === detailBranchId)
      : null;
  const totals = branchDetail?.totals || data?.totals || emptyHistoryTotals();
  const periodLedger = data?.ledgerSummary;
  const outstanding = data?.outstandingRentSummary;
  const multi = !!(allBranchesScope || (data?.byBranch && data.byBranch.length > 1));
  const nameOf = (id: string) => branchNames?.[id] || id;
  const visibleMovements = branchDetail?.movements || data?.movements || [];
  const currentStock = data?.system_qty ?? line.current_system_qty ?? null;
  const baseline = line.system_qty_baseline;
  const drifted =
    currentStock != null && Math.abs(Number(currentStock) - Number(baseline)) > 0.0000001;
  const sinceBaseline = data?.movementsSinceBaseline || [];

  const openReference = async (movement: {
    reference_type?: string | null;
    reference_id?: string | null;
    movement_type?: string | null;
    notes?: string | null;
  }) => {
    if (previewMovements) {
      toast.message('Preview mode — document drawers are disabled (no live IDs)');
      return;
    }
    const target = resolveDocTarget(movement);
    if (!target.kind || !target.id) {
      const rt = movement.reference_type || movement.movement_type || 'n/a';
      toast.info(
        movement.notes
          ? `${rt}: ${movement.notes}`
          : `No linked document for this movement (${rt})`
      );
      return;
    }
    try {
      if (target.kind === 'sale') {
        setSelectedSaleId(target.id);
        setViewSaleOpen(true);
        return;
      }
      if (target.kind === 'purchase') {
        setSelectedPurchaseId(target.id);
        setViewPurchaseOpen(true);
        return;
      }
      if (target.kind === 'rental') {
        const row = await rentalService.getRental(target.id);
        setSelectedRental(mapRentalRowToUI(row as Record<string, unknown>));
        setViewRentalOpen(true);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to open document');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden />
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-background border-l border-border shadow-xl flex flex-col max-h-[100dvh]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        role="dialog"
        aria-label="Stock movement history"
      >
        <div className="flex items-start justify-between gap-3 p-4 border-b border-border">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <History className="h-4 w-4 shrink-0" />
              History
              <span className="text-[10px] font-normal text-muted-foreground">
                (Full Stock Ledger engine)
              </span>
            </div>
            <div className="mt-1 font-medium truncate">{line.product_name}</div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>
                <span className="inline-flex items-center rounded px-1.5 py-0.5 bg-muted text-[10px] uppercase mr-1">
                  {itemKindLabel(
                    line.item_kind || (line.variation_id ? 'variation' : 'product')
                  )}
                </span>
                Product SKU: {line.product_sku || '—'}
                {line.variation_sku ? ` · Var SKU: ${line.variation_sku}` : ''}
              </div>
              {line.variation_label ? (
                <div className="text-foreground/90">{line.variation_label}</div>
              ) : line.attributes_incomplete ? (
                <div className="text-amber-400">Variation attributes incomplete in catalog</div>
              ) : null}
              <div>
                Scope:{' '}
                {multi
                  ? `All Branches${
                      detailBranchId ? ` · ${nameOf(detailBranchId)}` : ''
                    }`
                  : branchName || branchId}
              </div>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 border-b border-border space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={allHistory ? 'default' : 'outline'}
              onClick={() => setAllHistory(true)}
            >
              All history
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!allHistory ? 'default' : 'outline'}
              onClick={() => setAllHistory(false)}
            >
              Date range
            </Button>
          </div>
          {!allHistory && (
            <div className="flex gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                aria-label="From date"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                aria-label="To date"
              />
            </div>
          )}
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm space-y-1">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Current System Stock</span>
              <span className="font-semibold tabular-nums">
                {currentStock == null ? '—' : formatQty(currentStock)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Count Baseline</span>
              <span className="font-semibold tabular-nums">{formatQty(baseline)}</span>
            </div>
            {drifted ? (
              <div className="text-xs text-amber-300 pt-1 border-t border-border/50">
                Stock moved after baseline
                {line.baseline_at
                  ? ` (${new Date(line.baseline_at).toLocaleString()})`
                  : ''}
                . Posting still uses Physical − Baseline (not current stock).
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {drifted && sinceBaseline.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase text-amber-300 mb-2">
                    Movement since baseline
                  </h3>
                  <div className="space-y-1 text-sm">
                    {sinceBaseline.map((m, i) => (
                      <div
                        key={(m as any).id || i}
                        className="flex justify-between gap-2 rounded border border-amber-500/30 px-2 py-1.5"
                      >
                        <span className="text-muted-foreground truncate">
                          {m.movement_type || 'movement'}
                          {m.created_at
                            ? ` · ${new Date(m.created_at).toLocaleString()}`
                            : ''}
                        </span>
                        <span className="tabular-nums font-medium">
                          {formatQty(m.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(periodLedger || outstanding) && (
                <div>
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                    Rentals (activity vs outstanding)
                  </h3>
                  <div className="rounded border border-pink-800/50 px-3 py-2 space-y-1 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">
                        Rent out
                        <span className="block text-[10px]">
                          {allHistory ? 'all-time gross' : 'period gross'}
                        </span>
                      </span>
                      <span className="tabular-nums font-medium">
                        {formatQty(periodLedger?.rentOutGross ?? 0)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">
                        Rental returns
                        <span className="block text-[10px]">
                          {allHistory ? 'all-time gross' : 'period gross'}
                        </span>
                      </span>
                      <span className="tabular-nums font-medium">
                        {formatQty(periodLedger?.rentalReturnsGross ?? 0)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 border-t border-border/50 pt-1 mt-1">
                      <span className="text-muted-foreground">
                        Currently out on rent
                        <span className="block text-[10px]">from full history</span>
                      </span>
                      <span className="tabular-nums font-semibold text-pink-300">
                        {formatQty(outstanding?.currentlyOutOnRent ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {multi && data?.byBranch && data.byBranch.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                    Branch breakdown
                  </h3>
                  <div className="space-y-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={!detailBranchId ? 'secondary' : 'outline'}
                      className="w-full justify-between"
                      onClick={() => setDetailBranchId(null)}
                    >
                      <span>All branches (consolidated)</span>
                      <span className="tabular-nums">{formatQty(data.system_qty)}</span>
                    </Button>
                    {data.byBranch.map((b) => (
                      <Button
                        key={b.branch_id}
                        type="button"
                        size="sm"
                        variant={detailBranchId === b.branch_id ? 'secondary' : 'outline'}
                        className="w-full justify-between"
                        onClick={() => setDetailBranchId(b.branch_id)}
                      >
                        <span className="truncate">{nameOf(b.branch_id)}</span>
                        <span className="tabular-nums">{formatQty(b.system_qty)}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  Category totals (activity — not current stock)
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {SUMMARY_KEYS.filter(
                    (k) => Math.abs(totals[k]) > 0.0000001 || k === 'opening'
                  ).map((k) => (
                    <div
                      key={k}
                      className="flex justify-between gap-2 rounded border border-border/60 px-2 py-1.5"
                    >
                      <span className="text-muted-foreground truncate">
                        {historyCategoryLabel(k)}
                      </span>
                      <span className="tabular-nums font-medium">{formatQty(totals[k])}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  Movements
                </h3>
                {!visibleMovements.length ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No stock movements for this item in this scope.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {visibleMovements.map((m) => {
                      const doc = resolveDocTarget(m);
                      const clickable = !!doc.kind && !!doc.id && !previewMovements;
                      return (
                        <div
                          key={`${m.id}:${(m as any).branch_id || ''}`}
                          className="rounded-md border border-border px-3 py-2 text-sm space-y-1"
                        >
                          <div className="flex justify-between gap-2">
                            <span className="font-medium">
                              {historyCategoryLabel(m.category as StockHistoryCategory)}
                            </span>
                            <span
                              className={`tabular-nums font-semibold ${
                                Number(m.quantity) < 0 ? 'text-rose-400' : 'text-emerald-400'
                              }`}
                            >
                              {formatQty(m.quantity)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                            <span>
                              {m.created_at ? new Date(m.created_at).toLocaleString() : '—'}
                            </span>
                            <span>
                              {m.movement_type}
                              {m.reference_type ? ` / ${m.reference_type}` : ''}
                            </span>
                            {(m as any).branch_id && multi ? (
                              <span>{nameOf((m as any).branch_id)}</span>
                            ) : null}
                            {m.reference_id ? (
                              clickable ? (
                                <button
                                  type="button"
                                  className="text-sky-400 underline underline-offset-2 hover:text-sky-300"
                                  onClick={() => openReference(m)}
                                >
                                  Open {doc.kind} {String(m.reference_id).slice(0, 8)}…
                                </button>
                              ) : (
                                <span title={String(m.reference_id)}>
                                  Ref {String(m.reference_id).slice(0, 8)}… (no detail view)
                                </span>
                              )
                            ) : (
                              <span>No document link</span>
                            )}
                            <span>Bal {formatQty(m.running_balance)}</span>
                          </div>
                          {m.notes ? (
                            <div className="text-xs text-muted-foreground truncate">{m.notes}</div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </aside>

      {selectedSaleId && (
        <ViewSaleDetailsDrawer
          isOpen={viewSaleOpen}
          onClose={() => {
            setViewSaleOpen(false);
            setSelectedSaleId(null);
          }}
          saleId={selectedSaleId}
          onEdit={() => toast.info('Edit sale from Sales module')}
          onDelete={() => toast.info('Delete sale from Sales module')}
          onAddPayment={() => toast.info('Add payment from Sales module')}
        />
      )}
      {selectedPurchaseId && (
        <ViewPurchaseDetailsDrawer
          isOpen={viewPurchaseOpen}
          onClose={() => {
            setViewPurchaseOpen(false);
            setSelectedPurchaseId(null);
          }}
          purchaseId={selectedPurchaseId}
        />
      )}
      {selectedRental && (
        <ViewRentalDetailsDrawer
          isOpen={viewRentalOpen}
          onClose={() => {
            setViewRentalOpen(false);
            setSelectedRental(null);
          }}
          rental={selectedRental}
        />
      )}
    </>
  );
}
