import { useMemo, useState, useEffect, useCallback } from 'react';
import { TextInput } from '../common';
import {
  ArrowLeft,
  Package,
  AlertTriangle,
  Loader2,
  Search,
  LayoutGrid,
  TrendingDown,
  XCircle,
  Warehouse,
  ScanLine,
} from 'lucide-react';
import type { User, Branch } from '../../types';
import * as inventoryApi from '../../api/inventory';
import { getProductByBarcodeOrSku, type Product } from '../../api/products';
import { ProductHistoryModal } from './ProductHistoryModal';
import { StockAdjustmentSheet } from './StockAdjustmentSheet';
import { useBarcodeScanner } from '../../features/barcode/useBarcodeScanner';

interface InventoryModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branch: Branch | null;
}

type StockFilter = 'all' | 'low' | 'out' | 'healthy';

const fmtMoney = (n: number): string =>
  n.toLocaleString('en-PK', { maximumFractionDigits: 0 });

function productToInventoryItem(p: Product): inventoryApi.InventoryItem {
  const min = p.minStock ?? 0;
  const stock = p.stock;
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    stock,
    minStock: min,
    isLowStock: min > 0 && stock <= min,
    retailPrice: p.retailPrice,
    costPrice: p.costPrice,
    category: p.category,
    imageUrl: p.imageUrls?.[0] ?? null,
  };
}

export function InventoryModule({ onBack, user, companyId, branch }: InventoryModuleProps) {
  const [list, setList] = useState<inventoryApi.InventoryItem[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [category, setCategory] = useState<string>('all');
  const [selected, setSelected] = useState<inventoryApi.InventoryItem | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<inventoryApi.InventoryItem | null>(null);
  const barcode = useBarcodeScanner();

  const reloadList = useCallback(() => {
    if (!companyId) return;
    inventoryApi.getInventory(companyId, branch?.id ?? null).then(({ data, error }) => {
      if (!error && data) setList(data);
    });
  }, [companyId, branch?.id]);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let c = false;
    setLoading(true);
    inventoryApi.getInventory(companyId, branch?.id ?? null).then(({ data, error }) => {
      if (c) return;
      setLoading(false);
      if (!error && data) setList(data);
    });
    return () => {
      c = true;
    };
  }, [companyId, branch?.id]);

  useEffect(() => {
    void barcode.checkStatus();
  }, []);

  const handleScanAdjust = async () => {
    if (!companyId) return;
    if (barcode.permissionGranted === false) {
      await barcode.requestPermission();
    }
    await barcode.startScan(async (code) => {
      const { data: p, error } = await getProductByBarcodeOrSku(companyId, code, {
        branchId: branch?.id ?? null,
      });
      if (error || !p) {
        window.alert(error || 'No product found for this code.');
        return;
      }
      setAdjustTarget(productToInventoryItem(p));
    });
  };

  const summary = useMemo(() => {
    let value = 0;
    let low = 0;
    let out = 0;
    for (const it of list) {
      value += it.stock * it.costPrice;
      if (it.stock <= 0) out += 1;
      else if (it.isLowStock) low += 1;
    }
    return { total: list.length, value, low, out };
  }, [list]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    list.forEach((it) => {
      if (it.category) set.add(it.category);
    });
    return Array.from(set).sort();
  }, [list]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((it) => {
      if (q && !it.name.toLowerCase().includes(q) && !it.sku.toLowerCase().includes(q)) return false;
      if (category !== 'all' && it.category !== category) return false;
      if (stockFilter === 'out' && it.stock > 0) return false;
      if (stockFilter === 'low' && !(it.isLowStock && it.stock > 0)) return false;
      if (stockFilter === 'healthy' && (it.isLowStock || it.stock <= 0)) return false;
      return true;
    });
  }, [list, search, category, stockFilter]);

  const filterChips: { id: StockFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: list.length },
    { id: 'healthy', label: 'In Stock', count: list.length - summary.low - summary.out },
    { id: 'low', label: 'Low', count: summary.low },
    { id: 'out', label: 'Out', count: summary.out },
  ];

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-[#10B981]/20 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-[#10B981]" />
            </div>
            <div>
              <h1 className="text-white font-semibold text-base leading-tight">Inventory</h1>
              {branch?.name && (
                <p className="text-[10px] text-[#9CA3AF] leading-tight">{branch.name}</p>
              )}
            </div>
          </div>
          {companyId && (
            <button
              type="button"
              onClick={handleScanAdjust}
              disabled={barcode.loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#374151] hover:bg-[#4B5563] text-white text-xs font-medium disabled:opacity-50"
            >
              {barcode.loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ScanLine className="w-4 h-4" />
              )}
              Scan
            </button>
          )}
        </div>
        <div className="px-4 pb-3">
          <TextInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name or SKU..."
            prefix={<Search className="w-5 h-5" />}
          />
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <SummaryTile
            icon={<LayoutGrid className="w-4 h-4" />}
            color="#3B82F6"
            label="Products"
            value={summary.total.toString()}
          />
          <SummaryTile
            icon={<Warehouse className="w-4 h-4" />}
            color="#10B981"
            label="Stock Value"
            value={`Rs. ${fmtMoney(summary.value)}`}
          />
          <SummaryTile
            icon={<TrendingDown className="w-4 h-4" />}
            color="#F59E0B"
            label="Low Stock"
            value={summary.low.toString()}
          />
          <SummaryTile
            icon={<XCircle className="w-4 h-4" />}
            color="#EF4444"
            label="Out of Stock"
            value={summary.out.toString()}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {filterChips.map((chip) => (
            <button
              key={chip.id}
              onClick={() => setStockFilter(chip.id)}
              className={`flex-shrink-0 px-3 h-8 rounded-full text-xs font-medium border transition ${
                stockFilter === chip.id
                  ? 'bg-[#3B82F6] text-white border-[#3B82F6]'
                  : 'bg-[#1F2937] text-[#9CA3AF] border-[#374151]'
              }`}
            >
              {chip.label} · {chip.count}
            </button>
          ))}
        </div>

        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              onClick={() => setCategory('all')}
              className={`flex-shrink-0 px-3 h-8 rounded-full text-xs border transition ${
                category === 'all'
                  ? 'bg-[#10B981] text-white border-[#10B981]'
                  : 'bg-[#1F2937] text-[#9CA3AF] border-[#374151]'
              }`}
            >
              All categories
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`flex-shrink-0 px-3 h-8 rounded-full text-xs border transition ${
                  category === c
                    ? 'bg-[#10B981] text-white border-[#10B981]'
                    : 'bg-[#1F2937] text-[#9CA3AF] border-[#374151]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#10B981] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-[#9CA3AF]">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>No products match the current filters.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => {
              const statusColor =
                item.stock <= 0 ? '#EF4444' : item.isLowStock ? '#F59E0B' : '#10B981';
              const statusText =
                item.stock <= 0 ? 'Out of Stock' : item.isLowStock ? 'Low Stock' : 'In Stock';
              const stockValue = item.stock * item.costPrice;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className="w-full text-left bg-[#1F2937] border border-[#374151] rounded-xl p-3 flex gap-3 hover:border-[#3B82F6] transition"
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0 bg-[#111827]"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-[#111827] flex items-center justify-center flex-shrink-0">
                      <Package className="w-6 h-6 text-[#6B7280]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-medium truncate">{item.name}</p>
                        <p className="text-xs text-[#9CA3AF] font-mono">{item.sku}</p>
                        {item.category && (
                          <p className="text-[10px] text-[#6B7280] mt-0.5">{item.category}</p>
                        )}
                      </div>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0"
                        style={{
                          background: `${statusColor}20`,
                          color: statusColor,
                        }}
                      >
                        {statusText}
                      </span>
                    </div>
                    <div className="flex items-end justify-between mt-2">
                      <div>
                        <p className="text-lg font-bold text-white leading-none">{item.stock}</p>
                        <p className="text-[10px] text-[#9CA3AF]">
                          {item.minStock > 0 ? `Min ${item.minStock}` : 'In stock'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#9CA3AF]">Retail Rs. {fmtMoney(item.retailPrice)}</p>
                        <p className="text-[10px] text-[#6B7280]">
                          Value Rs. {fmtMoney(stockValue)}
                        </p>
                      </div>
                    </div>
                    {item.isLowStock && item.stock > 0 && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-[#F59E0B]">
                        <AlertTriangle className="w-3 h-3" />
                        At or below minimum level
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected && companyId && (
        <ProductHistoryModal
          companyId={companyId}
          product={selected}
          branchId={branch?.id ?? null}
          userName={user.name || user.email || 'User'}
          onClose={() => setSelected(null)}
          onAdjustStock={() => {
            const p = selected;
            setSelected(null);
            setAdjustTarget(p);
          }}
        />
      )}

      {adjustTarget && companyId && (
        <StockAdjustmentSheet
          open
          onClose={() => setAdjustTarget(null)}
          companyId={companyId}
          branchId={branch?.id ?? null}
          product={adjustTarget}
          user={user}
          onSaved={reloadList}
        />
      )}
    </div>
  );
}

interface SummaryTileProps {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: string;
}

function SummaryTile({ icon, color, label, value }: SummaryTileProps) {
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
