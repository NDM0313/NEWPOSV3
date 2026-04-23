import { useEffect, useMemo, useState } from 'react';
import { Package, ArrowDownLeft, ArrowUpRight, Search, X } from 'lucide-react';
import type { User } from '../../../types';
import { getStockMovements, type StockMovementRow } from '../../../api/reports';
import { getProducts, type Product } from '../../../api/products';
import { ReportHeader } from './_shared/ReportHeader';
import { DateRangeBar, makeInitialRange, type DateRangeValue } from './_shared/DateRangeBar';
import { ReportShell, ReportCard, ReportSectionTitle } from './_shared/ReportShell';
import { formatAmount, formatDate, dateRangeLabel } from './_shared/format';
import { PdfPreviewModal } from '../../shared/PdfPreviewModal';
import { LedgerPreviewPdf } from '../../shared/LedgerPreviewPdf';
import { usePdfPreview } from '../../shared/usePdfPreview';
import { TransactionDetailSheet } from './_shared/TransactionDetailSheet';

interface InventoryReportProps {
  onBack: () => void;
  companyId: string | null;
  user: User;
}

function variationLabel(v: { attributes: Record<string, string>; sku: string }): string {
  const parts = Object.values(v.attributes || {}).filter(Boolean);
  return parts.length ? parts.join(' · ') : v.sku;
}

export function InventoryReport({ onBack, companyId, user }: InventoryReportProps) {
  const [range, setRange] = useState<DateRangeValue>(() => makeInitialRange('month'));
  const [rows, setRows] = useState<StockMovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedMovement, setSelectedMovement] = useState<StockMovementRow | null>(null);
  const preview = usePdfPreview(companyId);

  useEffect(() => {
    if (!companyId) return;
    getProducts(companyId).then(({ data }) => setProducts(data));
  }, [companyId]);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getStockMovements(
      companyId,
      range.from || undefined,
      range.to || undefined,
      selectedProduct?.id ?? null,
      selectedVariationId ?? null,
    ).then(({ data, error }) => {
      if (cancelled) return;
      setRows(data);
      setError(error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, range.from, range.to, selectedProduct?.id, selectedVariationId]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === 'in') return r.quantity > 0;
      if (filter === 'out') return r.quantity < 0;
      return true;
    });
  }, [rows, filter]);

  /** Sort ascending + compute running balance when a single product/variation is selected. */
  const groupedByDay = useMemo(() => {
    if (!selectedProduct) return null;
    const asc = [...filtered].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    let running = 0;
    const byDay = new Map<string, { date: string; running: number; movements: Array<StockMovementRow & { runningBalance: number }> }>();
    for (const m of asc) {
      running += m.quantity;
      const key = m.date || 'unknown';
      if (!byDay.has(key)) byDay.set(key, { date: key, running: 0, movements: [] });
      const g = byDay.get(key)!;
      g.movements.push({ ...m, runningBalance: running });
      g.running = running;
    }
    return Array.from(byDay.values()).reverse();
  }, [filtered, selectedProduct]);

  const stats = useMemo(() => {
    const inQty = rows.filter((r) => r.quantity > 0).reduce((s, r) => s + r.quantity, 0);
    const outQty = Math.abs(rows.filter((r) => r.quantity < 0).reduce((s, r) => s + r.quantity, 0));
    const valueIn = rows.filter((r) => r.quantity > 0).reduce((s, r) => s + Math.abs(r.totalCost), 0);
    const valueOut = rows.filter((r) => r.quantity < 0).reduce((s, r) => s + Math.abs(r.totalCost), 0);
    return [
      { label: 'In units', value: formatAmount(inQty, 0), color: 'text-[#BBF7D0]' },
      { label: 'Out units', value: formatAmount(outQty, 0), color: 'text-[#FCA5A5]' },
      { label: 'In value', value: `Rs. ${formatAmount(valueIn, 0)}` },
      { label: 'Out value', value: `Rs. ${formatAmount(valueOut, 0)}` },
    ];
  }, [rows]);

  const filteredProducts = useMemo(() => {
    const s = search.toLowerCase();
    if (!s) return products.slice(0, 50);
    return products
      .filter((p) => p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s))
      .slice(0, 50);
  }, [products, search]);

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <ReportHeader
        onBack={onBack}
        title="Inventory Report"
        subtitle={selectedProduct ? `${selectedProduct.name} · movements & running stock` : 'Stock movements (in / out)'}
        stats={stats}
        onShare={preview.openPreview}
        sharing={preview.loading}
        gradient="slate"
      >
        <DateRangeBar value={range} onChange={setRange} />
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {(['all', 'in', 'out'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f ? 'bg-white text-[#1E293B]' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {f === 'all' ? 'All' : f === 'in' ? 'Stock in' : 'Stock out'}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPicker(true)}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 text-white hover:bg-white/20 flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" />
            {selectedProduct ? selectedProduct.name : 'Pick product'}
          </button>
          {selectedProduct && (
            <button
              type="button"
              onClick={() => {
                setSelectedProduct(null);
                setSelectedVariationId(null);
              }}
              className="px-2 py-1.5 rounded-full text-xs font-medium bg-white/10 text-white hover:bg-white/20"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {selectedProduct && selectedProduct.variations && selectedProduct.variations.length > 0 && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedVariationId(null)}
              className={`px-3 py-1 rounded-full text-[11px] ${
                selectedVariationId === null ? 'bg-white text-[#1E293B]' : 'bg-white/10 text-white'
              }`}
            >
              All variations
            </button>
            {selectedProduct.variations.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedVariationId(v.id)}
                className={`px-3 py-1 rounded-full text-[11px] ${
                  selectedVariationId === v.id ? 'bg-white text-[#1E293B]' : 'bg-white/10 text-white'
                }`}
              >
                {variationLabel(v)}
              </button>
            ))}
          </div>
        )}
      </ReportHeader>

      <ReportShell
        loading={loading}
        error={error}
        empty={!loading && !error && filtered.length === 0}
        emptyLabel="No stock movements in this range."
      >
        {groupedByDay ? (
          <div className="space-y-3">
            {groupedByDay.map((g) => (
              <ReportCard key={g.date}>
                <div className="px-4 py-2 bg-[#111827] border-b border-[#374151] flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">{formatDate(g.date)}</p>
                  <p className="text-xs text-white">Closing stock: {formatAmount(g.running, 0)}</p>
                </div>
                <ul className="divide-y divide-[#374151]">
                  {g.movements.map((r) => {
                    const isIn = r.quantity > 0;
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedMovement(r)}
                          className="w-full text-left px-4 py-3 hover:bg-[#111827]/60 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                isIn ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#EF4444]/10 text-[#EF4444]'
                              }`}
                            >
                              {isIn ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white truncate">
                                {r.movementType.replace('_', ' ')} · {r.referenceType}
                              </p>
                              {r.variationLabel && (
                                <p className="text-[11px] text-[#9CA3AF] truncate">{r.variationLabel}</p>
                              )}
                              {r.notes && <p className="text-[11px] text-[#6B7280] truncate">{r.notes}</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-sm font-bold ${isIn ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                                {isIn ? '+' : '−'}
                                {formatAmount(Math.abs(r.quantity), 0)}
                              </p>
                              <p className="text-[11px] text-[#9CA3AF]">Bal {formatAmount(r.runningBalance, 0)}</p>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </ReportCard>
            ))}
          </div>
        ) : (
          <ReportCard>
            <ReportSectionTitle title="Movements" right={`${filtered.length}`} />
            <ul className="divide-y divide-[#374151]">
              {filtered.map((r) => {
                const isIn = r.quantity > 0;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedMovement(r)}
                      className="w-full text-left px-4 py-3 hover:bg-[#111827]/60 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                            isIn ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#EF4444]/10 text-[#EF4444]'
                          }`}
                        >
                          {isIn ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{r.productName}</p>
                          <p className="text-[11px] text-[#9CA3AF] truncate">
                            {formatDate(r.date)} · {r.movementType} · {r.referenceType}
                          </p>
                          {r.variationLabel && (
                            <p className="text-[11px] text-[#6B7280] truncate">{r.variationLabel}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p
                            className={`text-sm font-bold ${isIn ? 'text-[#10B981]' : 'text-[#EF4444]'} flex items-center gap-1 justify-end`}
                          >
                            <Package className="w-3.5 h-3.5" />
                            {isIn ? '+' : '−'}
                            {formatAmount(Math.abs(r.quantity), 0)}
                          </p>
                          <p className="text-[11px] text-[#9CA3AF]">Rs. {formatAmount(Math.abs(r.totalCost), 0)}</p>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </ReportCard>
        )}
      </ReportShell>

      {picker && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-[#1F2937] border border-[#374151] rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-[#374151]">
              <p className="text-sm font-semibold text-white">Pick product</p>
              <button type="button" onClick={() => setPicker(false)} className="text-[#9CA3AF] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 border-b border-[#374151]">
              <div className="flex items-center gap-2 bg-[#111827] border border-[#374151] rounded-lg px-3 py-2">
                <Search className="w-4 h-4 text-[#6B7280]" />
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or SKU"
                  className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#6B7280]"
                />
              </div>
            </div>
            <ul className="overflow-y-auto divide-y divide-[#374151]">
              {filteredProducts.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProduct(p);
                      setSelectedVariationId(null);
                      setPicker(false);
                      setSearch('');
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-[#111827]/60 transition-colors"
                  >
                    <p className="text-sm text-white truncate">{p.name}</p>
                    <p className="text-[11px] text-[#9CA3AF]">{p.sku} · Stock {formatAmount(p.stock, 0)}</p>
                  </button>
                </li>
              ))}
              {filteredProducts.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-[#9CA3AF]">No products found</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {preview.brand && (
        <PdfPreviewModal
          open={preview.open}
          title="Inventory Report"
          filename={`Inventory_Report_${range.from || 'all'}_${range.to || 'now'}.pdf`}
          onClose={preview.close}
          whatsAppFallbackText={`Inventory Report · ${dateRangeLabel(range.from, range.to)}`}
        >
          <LedgerPreviewPdf
            brand={preview.brand}
            title="Inventory Report"
            subtitle={dateRangeLabel(range.from, range.to)}
            partyName={selectedProduct?.name ?? `${filtered.length} movements`}
            openingBalance={0}
            closingBalance={0}
            totals={{ debit: 0, credit: 0 }}
            rows={filtered.map((r) => ({
              date: r.date,
              reference: r.movementType,
              description: `${r.productName}${r.variationLabel ? ` (${r.variationLabel})` : ''} · ${r.referenceType}`,
              debit: r.quantity > 0 ? r.quantity : 0,
              credit: r.quantity < 0 ? Math.abs(r.quantity) : 0,
              balance: r.totalCost,
            }))}
            generatedBy={user.name || user.email || 'User'}
            generatedAt={new Date().toLocaleString('en-PK')}
          />
        </PdfPreviewModal>
      )}

      {selectedMovement && (
        <TransactionDetailSheet
          open
          onClose={() => setSelectedMovement(null)}
          companyId={companyId}
          referenceType="stock_movement"
          referenceId={selectedMovement.id}
          fallbackTitle={`${selectedMovement.productName} · ${selectedMovement.movementType}`}
        />
      )}
    </div>
  );
}
