import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Package, Plus, Search, Loader2, Edit2, Image as ImageIcon, Boxes, AlertTriangle, TrendingUp } from 'lucide-react';
import type { User } from '../../types';
import * as productsApi from '../../api/products';
import type { ProductVariationRow } from '../../api/products';
import { AddProductFlow, type AddProductFlowSavePayload } from './AddProductFlow';
import { TransactionSuccessModal, type TransactionSuccessData } from '../shared/TransactionSuccessModal';
import { formatQty } from '../../utils/quantity';

/** Total stock: sum of variation stocks when hasVariations, else product stock */
function getDisplayStock(p: productsApi.Product): number {
  if (p.hasVariations && p.variations?.length) {
    return p.variations.reduce((s, v) => s + (v.stock ?? 0), 0);
  }
  return p.stock ?? 0;
}

/** Variation summary: "Size: S, M, L · Color: Red, Blue" or "3 variations" */
function getVariationSummary(variations: ProductVariationRow[]): string {
  if (!variations?.length) return '';
  const attrMap: Record<string, Set<string>> = {};
  for (const v of variations) {
    for (const [key, val] of Object.entries(v.attributes || {})) {
      if (!key || val == null) continue;
      if (!attrMap[key]) attrMap[key] = new Set();
      attrMap[key].add(String(val));
    }
  }
  const parts = Object.entries(attrMap).map(([k, set]) => `${k}: ${[...set].sort().join(', ')}`);
  return parts.length > 0 ? parts.join(' · ') : `${variations.length} variations`;
}

interface ProductsModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branchId?: string | null;
}

export type Product = productsApi.Product;

export function ProductsModule({ onBack, user: _user, companyId, branchId }: ProductsModuleProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [view, setView] = useState<'list' | 'add'>('list');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmationData, setConfirmationData] = useState<TransactionSuccessData | null>(null);

  useEffect(() => {
    if (!companyId) {
      setProducts([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    productsApi.getProducts(companyId).then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      setProducts(error ? [] : data);
    });
    return () => { cancelled = true; };
  }, [companyId]);

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || p.category === filterCat;
    return matchSearch && matchCat;
  });

  const categories = ['all', ...Array.from(new Set(products.map((p) => p.category)))];

  const handleAddEditSave = async (payload: AddProductFlowSavePayload) => {
    if (!companyId) return;
    setSaveError('');
    setSaving(true);
    if (payload.id) {
      const { data, error } = await productsApi.updateProduct(companyId, payload.id, {
        name: payload.name,
        sku: payload.sku,
        category: payload.category,
        categoryId: payload.categoryId,
        brandId: payload.brandId,
        unitId: payload.unitId,
        description: payload.description,
        barcode: payload.barcode,
        costPrice: payload.costPrice,
        retailPrice: payload.retailPrice,
        wholesalePrice: payload.wholesalePrice,
        stock: payload.stock,
        minStock: payload.minStock,
        unit: payload.unit,
        status: payload.status,
        imageFiles: payload.imageFiles,
        existingImageUrls: payload.existingImageUrls,
        isCombo: payload.isCombo,
        comboItems: payload.comboItems,
      });
      setSaving(false);
      if (error) {
        setSaveError(error);
        return;
      }
      if (data) {
        setProducts(products.map((p) => (p.id === payload.id ? data : p)));
      }
    } else {
      const { data, error } = await productsApi.createProduct(companyId, {
        name: payload.name,
        sku: payload.sku,
        category: payload.category,
        categoryId: payload.categoryId,
        brandId: payload.brandId,
        unitId: payload.unitId,
        description: payload.description,
        barcode: payload.barcode,
        costPrice: payload.costPrice,
        retailPrice: payload.retailPrice,
        wholesalePrice: payload.wholesalePrice,
        stock: payload.stock,
        minStock: payload.minStock,
        unit: payload.unit,
        status: payload.status,
        hasVariations: payload.hasVariations,
        variations: payload.variations,
        imageFiles: payload.imageFiles,
        isCombo: payload.isCombo,
        comboItems: payload.comboItems,
      });
      setSaving(false);
      if (error) {
        setSaveError(error);
        return;
      }
      if (data) {
        setProducts([data, ...products]);
        setConfirmationData({
          type: 'product',
          title: 'Product Added Successfully',
          transactionNo: null,
          amount: null,
          partyName: null,
          date: new Date().toISOString(),
          branch: undefined,
          entityId: data.id,
        });
        return;
      }
    }
    setView('list');
    setEditingProduct(null);
  };

  if (view === 'add') {
    return (
      <>
        <AddProductFlow
          companyId={companyId}
          branchId={branchId ?? null}
          onClose={() => setView('list')}
          onSave={handleAddEditSave}
          product={editingProduct}
          saving={saving}
          error={saveError}
        />
        {confirmationData && (
          <TransactionSuccessModal
            isOpen={!!confirmationData}
            data={confirmationData}
            onClose={() => {
              setConfirmationData(null);
              setView('list');
              setEditingProduct(null);
            }}
            onOk={() => {
              setConfirmationData(null);
              setView('list');
              setEditingProduct(null);
            }}
          />
        )}
      </>
    );
  }

  const stats = useMemo(() => {
    const totalProducts = products.length;
    let totalStock = 0;
    let lowStock = 0;
    let stockValue = 0;
    for (const p of products) {
      const s = getDisplayStock(p);
      totalStock += s;
      stockValue += s * (p.costPrice || 0);
      if (p.minStock != null && s <= (p.minStock ?? 0)) lowStock += 1;
    }
    return { totalProducts, totalStock, lowStock, stockValue };
  }, [products]);

  return (
    <div className="min-h-screen bg-[#0B1120] pb-24">
      {/* Gradient header */}
      <div className="bg-gradient-to-br from-[#1E3A8A] via-[#1E40AF] to-[#3B82F6] sticky top-0 z-40 shadow-lg">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
              <Package size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-semibold text-base leading-tight">Products</h1>
              <p className="text-[11px] text-white/70 leading-tight">{stats.totalProducts} items</p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingProduct(null);
              setView('add');
            }}
            className="flex items-center gap-1.5 px-3 h-9 bg-white text-[#1E40AF] rounded-lg font-semibold shadow-md hover:bg-white/95"
          >
            <Plus size={16} />
            <span className="text-sm">New</span>
          </button>
        </div>

        {/* KPI row inside gradient */}
        <div className="px-4 pb-4 pt-1 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white/10 backdrop-blur border border-white/15 p-2.5">
            <div className="flex items-center gap-1.5 text-white/80 text-[10px] uppercase tracking-wider">
              <Boxes size={11} /> Stock
            </div>
            <p className="text-white text-base font-bold leading-tight mt-1">{formatQty(stats.totalStock)}</p>
          </div>
          <div className="rounded-xl bg-white/10 backdrop-blur border border-white/15 p-2.5">
            <div className="flex items-center gap-1.5 text-white/80 text-[10px] uppercase tracking-wider">
              <TrendingUp size={11} /> Value
            </div>
            <p className="text-white text-base font-bold leading-tight mt-1">
              Rs. {stats.stockValue >= 1000 ? `${(stats.stockValue / 1000).toFixed(1)}k` : stats.stockValue.toFixed(0)}
            </p>
          </div>
          <div className="rounded-xl bg-white/10 backdrop-blur border border-white/15 p-2.5">
            <div className="flex items-center gap-1.5 text-white/80 text-[10px] uppercase tracking-wider">
              <AlertTriangle size={11} /> Low
            </div>
            <p className="text-white text-base font-bold leading-tight mt-1">{stats.lowStock}</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
          </div>
        ) : (
          <>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or SKU..."
                className="w-full h-11 bg-[#1F2937] border border-[#374151] rounded-lg pl-10 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4 scrollbar-hide">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCat(cat)}
                  className={`flex-shrink-0 px-4 h-9 rounded-full text-xs font-medium capitalize transition-colors ${
                    filterCat === cat
                      ? 'bg-[#3B82F6] text-white shadow'
                      : 'bg-[#1F2937] text-[#9CA3AF] border border-[#374151] hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="space-y-2.5">
              {filtered.map((p) => {
                const displayStock = getDisplayStock(p);
                const variationSummary = p.hasVariations && p.variations?.length ? getVariationSummary(p.variations) : '';
                const prices = p.variations?.map((v) => v.price).filter((n) => typeof n === 'number') ?? [];
                const priceMin = prices.length ? Math.min(...prices) : p.retailPrice;
                const priceMax = prices.length ? Math.max(...prices) : p.retailPrice;
                const priceLabel =
                  priceMin !== priceMax
                    ? `Rs. ${priceMin.toLocaleString()} – ${priceMax.toLocaleString()}`
                    : `Rs. ${p.retailPrice.toLocaleString()}`;
                const thumb = (p.imageUrls && p.imageUrls[0]) || null;
                const isLow = p.minStock != null && displayStock <= (p.minStock ?? 0);

                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setEditingProduct(p);
                      setView('add');
                    }}
                    className="w-full text-left bg-[#1F2937] border border-[#374151] rounded-xl p-3 hover:border-[#3B82F6]/50 active:scale-[0.99] transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-14 h-14 rounded-lg bg-[#111827] border border-[#374151] overflow-hidden flex items-center justify-center flex-shrink-0">
                        {thumb ? (
                          <img src={thumb} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon size={20} className="text-[#4B5563]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-medium text-white text-sm leading-tight truncate">{p.name}</h3>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
                              p.status === 'active' ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#6B7280]/20 text-[#9CA3AF]'
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6B7280] mt-0.5 truncate">
                          {p.sku} · {p.category}
                        </p>
                        {variationSummary ? (
                          <p className="text-[11px] text-[#9CA3AF] mt-0.5 truncate" title={variationSummary}>
                            {variationSummary}
                          </p>
                        ) : null}
                        <div className="flex items-center justify-between mt-1.5">
                          <p className="text-sm text-[#10B981] font-semibold">
                            {priceLabel}
                            <span className="text-[#6B7280] font-normal text-xs"> / {p.unit}</span>
                          </p>
                          <p
                            className={`text-xs font-medium px-2 py-0.5 rounded ${
                              isLow ? 'bg-[#EF4444]/20 text-[#F87171]' : 'bg-[#111827] text-white/80'
                            }`}
                          >
                            {formatQty(displayStock)} in stock
                          </p>
                        </div>
                      </div>
                      <Edit2 size={14} className="text-[#6B7280] mt-1 flex-shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <Package size={40} className="mx-auto text-[#4B5563] mb-2" />
                <p className="text-[#6B7280]">No products found</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
