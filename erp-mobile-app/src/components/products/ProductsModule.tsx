import { useState, useEffect } from 'react';
import { ArrowLeft, Package, Plus, Search, Loader2, Edit2 } from 'lucide-react';
import type { User } from '../../types';
import * as productsApi from '../../api/products';
import type { ProductVariationRow } from '../../api/products';
import { AddProductFlow, type AddProductFlowSavePayload } from './AddProductFlow';

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
      });
      setSaving(false);
      if (error) {
        setSaveError(error);
        return;
      }
      if (data) setProducts([data, ...products]);
    }
    setView('list');
    setEditingProduct(null);
  };

  if (view === 'add') {
    return (
      <AddProductFlow
        companyId={companyId}
        branchId={branchId ?? null}
        onClose={() => setView('list')}
        onSave={handleAddEditSave}
        product={editingProduct}
        saving={saving}
        error={saveError}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-[#3B82F6] rounded-lg flex items-center justify-center">
              <Package size={18} className="text-white" />
            </div>
            <h1 className="text-white font-semibold text-base">Products</h1>
          </div>
          <button
            onClick={() => {
              setEditingProduct(null);
              setView('add');
            }}
            className="p-2 bg-[#10B981] hover:bg-[#059669] rounded-lg text-white"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
          </div>
        ) : (
        <>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or SKU..." className="w-full h-11 bg-[#1F2937] border border-[#374151] rounded-lg pl-10 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {categories.map((cat) => (
            <button key={cat} onClick={() => setFilterCat(cat)} className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium capitalize ${filterCat === cat ? 'bg-[#3B82F6] text-white' : 'bg-[#1F2937] text-[#9CA3AF] border border-[#374151]'}`}>
              {cat}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {filtered.map((p) => {
            const displayStock = getDisplayStock(p);
            const variationSummary = p.hasVariations && p.variations?.length ? getVariationSummary(p.variations) : '';
            const prices = p.variations?.map((v) => v.price).filter((n) => typeof n === 'number') ?? [];
            const priceMin = prices.length ? Math.min(...prices) : p.retailPrice;
            const priceMax = prices.length ? Math.max(...prices) : p.retailPrice;
            const priceLabel = priceMin !== priceMax ? `Rs. ${priceMin.toLocaleString()} - ${priceMax.toLocaleString()}` : `Rs. ${p.retailPrice.toLocaleString()}`;
            return (
              <div key={p.id} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-white">{p.name}</h3>
                    <p className="text-xs text-[#6B7280]">{p.sku} · {p.category}</p>
                    {variationSummary ? (
                      <p className="text-xs text-[#9CA3AF] mt-0.5 truncate" title={variationSummary}>{variationSummary}</p>
                    ) : null}
                    <p className="text-sm text-[#10B981] mt-1">{priceLabel} <span className="text-[#9CA3AF]">/ {p.unit}</span></p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => {
                        setEditingProduct(p);
                        setView('add');
                      }}
                      className="p-2 hover:bg-[#374151] rounded-lg text-[#9CA3AF] hover:text-white"
                      aria-label="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <div className="text-right">
                      <p className="text-sm font-medium text-white">Stock: {displayStock}</p>
                      <span className={`text-xs px-2 py-0.5 rounded ${p.status === 'active' ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#6B7280]/20 text-[#9CA3AF]'}`}>{p.status}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {filtered.length === 0 && <p className="text-center text-[#6B7280] py-8">No products found</p>}
        </>
        )}
      </div>
    </div>
  );
}
