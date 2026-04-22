import { useEffect, useMemo, useState } from 'react';
import {
  X,
  Loader2,
  Package,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Share2,
} from 'lucide-react';
import * as inventoryApi from '../../api/inventory';
import { PdfPreviewModal } from '../shared/PdfPreviewModal';
import { ReportBrandHeader } from '../shared/ReportBrandHeader';
import { usePdfPreview } from '../shared/usePdfPreview';
import type { StockMovementEntry, StockMovementType } from '../../api/inventory';

interface ProductHistoryModalProps {
  companyId: string;
  product: inventoryApi.InventoryItem;
  branchId?: string | null;
  userName: string;
  onClose: () => void;
}

type TypeFilter = 'all' | 'in' | 'out' | 'adjustment';

const fmtNum = (n: number): string =>
  n.toLocaleString('en-PK', { maximumFractionDigits: 2, minimumFractionDigits: 0 });

const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const typeLabel = (t: StockMovementType): string => {
  switch (t) {
    case 'purchase':
      return 'Purchase';
    case 'sale':
      return 'Sale';
    case 'return':
    case 'sale_return':
      return 'Sale Return';
    case 'purchase_return':
      return 'Purchase Return';
    case 'adjustment':
      return 'Adjustment';
    case 'transfer_in':
      return 'Transfer In';
    case 'transfer_out':
      return 'Transfer Out';
    case 'opening':
      return 'Opening';
    default:
      return String(t);
  }
};

const typeColor = (qty: number): string => (qty > 0 ? '#10B981' : qty < 0 ? '#EF4444' : '#9CA3AF');

export function ProductHistoryModal({
  companyId,
  product,
  branchId,
  userName,
  onClose,
}: ProductHistoryModalProps) {
  const [entries, setEntries] = useState<StockMovementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const preview = usePdfPreview(companyId);

  useEffect(() => {
    let c = false;
    setLoading(true);
    inventoryApi
      .getProductStockMovements(companyId, product.id, { branchId: branchId ?? undefined })
      .then(({ data }) => {
        if (c) return;
        setEntries(data);
        setLoading(false);
      });
    return () => {
      c = true;
    };
  }, [companyId, product.id, branchId]);

  const summary = useMemo(() => {
    let purchased = 0;
    let sold = 0;
    let adjusted = 0;
    for (const e of entries) {
      const q = e.quantity;
      if (e.movementType === 'purchase' || e.movementType === 'sale_return' || e.movementType === 'return' || e.movementType === 'transfer_in') {
        purchased += Math.abs(q);
      } else if (e.movementType === 'sale' || e.movementType === 'purchase_return' || e.movementType === 'transfer_out') {
        sold += Math.abs(q);
      } else if (e.movementType === 'adjustment' || e.movementType === 'opening') {
        adjusted += q;
      }
    }
    return { purchased, sold, adjusted, current: product.stock };
  }, [entries, product.stock]);

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return entries;
    return entries.filter((e) => {
      if (typeFilter === 'in') return e.quantity > 0 && e.movementType !== 'adjustment' && e.movementType !== 'opening';
      if (typeFilter === 'out') return e.quantity < 0 && e.movementType !== 'adjustment';
      if (typeFilter === 'adjustment') return e.movementType === 'adjustment' || e.movementType === 'opening';
      return true;
    });
  }, [entries, typeFilter]);

  const chips: { id: TypeFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'in', label: 'Inward' },
    { id: 'out', label: 'Outward' },
    { id: 'adjustment', label: 'Adj.' },
  ];

  const sortedDesc = useMemo(
    () => [...filtered].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [filtered]
  );

  return (
    <div className="fixed inset-0 bg-black/70 z-[80] flex flex-col">
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 h-14 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="p-2 hover:bg-[#374151] rounded-lg text-white">
            <X className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">{product.name}</p>
            <p className="text-[11px] text-[#9CA3AF] font-mono truncate">{product.sku}</p>
          </div>
        </div>
        <button
          onClick={preview.openPreview}
          disabled={preview.loading}
          className="p-2 hover:bg-[#374151] rounded-lg text-white disabled:opacity-50"
          aria-label="Share PDF"
        >
          {preview.loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Share2 className="w-5 h-5" />
          )}
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-[#111827] pb-6">
        <div className="p-4 grid grid-cols-2 gap-3">
          <StatTile
            icon={<TrendingUp className="w-4 h-4" />}
            color="#10B981"
            label="Purchased"
            value={fmtNum(summary.purchased)}
          />
          <StatTile
            icon={<TrendingDown className="w-4 h-4" />}
            color="#EF4444"
            label="Sold"
            value={fmtNum(summary.sold)}
          />
          <StatTile
            icon={<ArrowLeftRight className="w-4 h-4" />}
            color="#F59E0B"
            label="Adjusted"
            value={fmtNum(summary.adjusted)}
          />
          <StatTile
            icon={<Package className="w-4 h-4" />}
            color="#3B82F6"
            label="Current Stock"
            value={fmtNum(summary.current)}
          />
        </div>

        <div className="px-4 pb-3 flex gap-2 overflow-x-auto">
          {chips.map((c) => (
            <button
              key={c.id}
              onClick={() => setTypeFilter(c.id)}
              className={`flex-shrink-0 px-3 h-8 rounded-full text-xs font-medium border ${
                typeFilter === c.id
                  ? 'bg-[#3B82F6] text-white border-[#3B82F6]'
                  : 'bg-[#1F2937] text-[#9CA3AF] border-[#374151]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="px-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
            </div>
          ) : sortedDesc.length === 0 ? (
            <div className="text-center py-10 text-[#9CA3AF] text-sm">
              No stock movements yet.
            </div>
          ) : (
            sortedDesc.map((e) => {
              const sign = e.quantity > 0 ? '+' : e.quantity < 0 ? '−' : '';
              return (
                <div
                  key={e.id}
                  className="bg-[#1F2937] border border-[#374151] rounded-xl p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide"
                          style={{
                            background: `${typeColor(e.quantity)}20`,
                            color: typeColor(e.quantity),
                          }}
                        >
                          {typeLabel(e.movementType)}
                        </span>
                        <span className="text-[11px] text-[#9CA3AF]">
                          {fmtDate(e.createdAt)} · {fmtTime(e.createdAt)}
                        </span>
                      </div>
                      {(e.referenceNumber || e.partyName) && (
                        <p className="text-xs text-white truncate">
                          {e.referenceNumber && (
                            <span className="font-mono text-[#3B82F6]">{e.referenceNumber}</span>
                          )}
                          {e.referenceNumber && e.partyName && (
                            <span className="text-[#6B7280]"> · </span>
                          )}
                          {e.partyName && <span>{e.partyName}</span>}
                        </p>
                      )}
                      {e.branchName && (
                        <p className="text-[10px] text-[#6B7280] mt-0.5">{e.branchName}</p>
                      )}
                      {e.notes && (
                        <p className="text-[10px] text-[#9CA3AF] mt-1 italic">{e.notes}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p
                        className="text-base font-bold leading-none"
                        style={{ color: typeColor(e.quantity) }}
                      >
                        {sign}
                        {fmtNum(Math.abs(e.quantity))}
                      </p>
                      <p className="text-[10px] text-[#9CA3AF] mt-1">
                        Bal {fmtNum(e.runningBalance)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {preview.open && preview.brand && (
        <PdfPreviewModal
          open={preview.open}
          onClose={preview.close}
          title={`Stock Ledger — ${product.name}`}
          filename={`stock-ledger-${product.sku}`}
        >
          <ProductHistoryPdf
            brand={preview.brand}
            product={product}
            summary={summary}
            entries={sortedDesc}
            generatedBy={userName}
          />
        </PdfPreviewModal>
      )}
    </div>
  );
}

function StatTile({
  icon,
  color,
  label,
  value,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: `${color}20`, color }}
        >
          {icon}
        </div>
        <p className="text-[11px] text-[#9CA3AF] uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-white font-semibold text-base leading-tight">{value}</p>
    </div>
  );
}

function ProductHistoryPdf({
  brand,
  product,
  summary,
  entries,
  generatedBy,
}: {
  brand: Parameters<typeof ReportBrandHeader>[0]['brand'];
  product: inventoryApi.InventoryItem;
  summary: { purchased: number; sold: number; adjusted: number; current: number };
  entries: StockMovementEntry[];
  generatedBy: string;
}) {
  return (
    <div>
      <ReportBrandHeader
        brand={brand}
        title="Product Stock Ledger"
        subtitle={`${product.name} (${product.sku})`}
        metaRows={[
          { label: 'Generated', value: new Date().toLocaleString('en-PK') },
          { label: 'By', value: generatedBy },
        ]}
      />

      <table style={{ marginBottom: 14 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'right' }}>Purchased</th>
            <th style={{ textAlign: 'right' }}>Sold</th>
            <th style={{ textAlign: 'right' }}>Adjusted</th>
            <th style={{ textAlign: 'right' }}>Current</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ textAlign: 'right' }}>{fmtNum(summary.purchased)}</td>
            <td style={{ textAlign: 'right' }}>{fmtNum(summary.sold)}</td>
            <td style={{ textAlign: 'right' }}>{fmtNum(summary.adjusted)}</td>
            <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtNum(summary.current)}</td>
          </tr>
        </tbody>
      </table>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Reference</th>
            <th>Party</th>
            <th style={{ textAlign: 'right' }}>Qty</th>
            <th style={{ textAlign: 'right' }}>Balance</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', color: '#666', padding: 12 }}>
                No movements in this period.
              </td>
            </tr>
          ) : (
            entries.map((e) => (
              <tr key={e.id}>
                <td>
                  {fmtDate(e.createdAt)}
                  <div style={{ fontSize: 9, color: '#666' }}>{fmtTime(e.createdAt)}</div>
                </td>
                <td>{typeLabel(e.movementType)}</td>
                <td style={{ fontFamily: 'monospace' }}>{e.referenceNumber || '—'}</td>
                <td>{e.partyName || '—'}</td>
                <td
                  style={{
                    textAlign: 'right',
                    fontWeight: 700,
                    color: e.quantity > 0 ? '#14532d' : e.quantity < 0 ? '#991b1b' : '#111',
                  }}
                >
                  {e.quantity > 0 ? '+' : e.quantity < 0 ? '−' : ''}
                  {fmtNum(Math.abs(e.quantity))}
                </td>
                <td style={{ textAlign: 'right' }}>{fmtNum(e.runningBalance)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div
        style={{
          marginTop: 20,
          fontSize: 9,
          color: '#555',
          textAlign: 'center',
          borderTop: '1px solid #e5e7eb',
          paddingTop: 8,
        }}
      >
        Computer-generated report.
      </div>
    </div>
  );
}
