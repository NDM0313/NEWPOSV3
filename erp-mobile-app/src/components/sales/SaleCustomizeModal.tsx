import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { Product } from './SalesModule';
import * as productsApi from '../../api/products';
import type { BespokeFabricMaterial } from '../../types/bespoke';
import { syncFabricChildLines, hydrateFabricDraftsFromChildren } from '../../lib/bespokeCartInjection';

interface SaleCustomizeModalProps {
  companyId: string;
  branchId: string | null;
  parentLine: Product;
  cartProducts: Product[];
  onClose: () => void;
  onApply: (products: Product[]) => void;
}

function lineCartId(p: Product, index: number): string {
  return p.cartLineId ?? `${p.id}-${p.variationId ?? 'base'}-${index}`;
}

export function SaleCustomizeModal({
  companyId,
  branchId,
  parentLine,
  cartProducts,
  onClose,
  onApply,
}: SaleCustomizeModalProps) {
  const parentIdx = cartProducts.findIndex((p) => p === parentLine);
  const parentCartId = lineCartId(parentLine, parentIdx >= 0 ? parentIdx : 0);

  const [fabrics, setFabrics] = useState<BespokeFabricMaterial[]>(() => {
    const hydrated = hydrateFabricDraftsFromChildren(
      parentCartId,
      cartProducts.map((p, i) => ({
        id: lineCartId(p, i),
        productId: p.id,
        name: p.name,
        sku: p.sku ?? '',
        price: p.price,
        qty: p.quantity,
        variationId: p.variationId,
        unit: 'm',
        bespokeParentCartId: p.bespokeParentCartId,
        bespokeRole: p.bespokeRole,
        isBespokeInjected: p.isBespokeInjected,
      })),
    );
    return hydrated.length ? hydrated : [{ product_id: '', product_name: '', unit_code: 'm', quantity: 1 }];
  });
  const [notes, setNotes] = useState('');
  const [colorName, setColorName] = useState('');
  const [fabricProducts, setFabricProducts] = useState<productsApi.Product[]>([]);
  const [fabricSearch, setFabricSearch] = useState('');

  useEffect(() => {
    void productsApi.getProducts(companyId, { branchId: branchId ?? undefined }).then(({ data }) => {
      setFabricProducts(data ?? []);
    });
  }, [companyId, branchId]);

  const fabricOptions = useMemo(() => {
    const q = fabricSearch.trim().toLowerCase();
    return fabricProducts
      .filter((p) => !String(p.sku ?? '').toUpperCase().startsWith('CUSTOM-'))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q))
      .slice(0, 40);
  }, [fabricProducts, fabricSearch]);

  const apply = () => {
    const baseLines = cartProducts.map((p, i) => ({
      id: lineCartId(p, i),
      productId: p.id,
      name: p.name,
      sku: p.sku ?? '',
      price: p.price,
      qty: p.quantity,
      variationId: p.variationId,
      unit: 'm',
      customizationDetails: p.customizationDetails ?? null,
      bespokeParentCartId: p.bespokeParentCartId,
      bespokeRole: p.bespokeRole,
      isBespokeInjected: p.isBespokeInjected,
    }));

    const meta = {
      notes: notes.trim() || undefined,
      color_name: colorName.trim() || undefined,
      fabric_materials: fabrics.filter((f) => f.product_id && f.quantity > 0),
    };

    const parentBase = baseLines.find((l) => l.id === parentCartId);
    if (parentBase) {
      parentBase.customizationDetails = meta as Record<string, unknown>;
    }

    const { items: synced } = syncFabricChildLines(
      baseLines,
      parentCartId,
      fabrics,
      (f) => Number(f.retail_price) || 0,
      () => `fab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );

    const next: Product[] = synced.map((line) => {
      const existing = cartProducts.find(
        (p, i) => lineCartId(p, i) === String(line.id),
      );
      const isFabric = line.bespokeRole === 'fabric';
      return {
        id: String(line.productId),
        cartLineId: String(line.id),
        name: line.name,
        sku: line.sku,
        price: isFabric ? line.price : existing?.price ?? line.price,
        quantity: line.qty,
        variationId: line.variationId,
        variation: existing?.variation,
        total: (isFabric ? line.price : existing?.price ?? line.price) * line.qty,
        customizationDetails: line.customizationDetails ?? undefined,
        bespokeParentCartId: line.bespokeParentCartId,
        bespokeRole: line.bespokeRole,
        isBespokeInjected: line.isBespokeInjected,
        packingDetails: existing?.packingDetails,
      };
    });

    onApply(next);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#1F2937] w-full sm:max-w-lg max-h-[90vh] rounded-t-2xl sm:rounded-2xl border border-[#374151] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#374151]">
          <h2 className="text-lg font-semibold text-white">Customize — {parentLine.name}</h2>
          <button type="button" onClick={onClose} className="p-2 text-[#9CA3AF]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-xs text-[#9CA3AF] block mb-1">Color / shade</label>
            <input
              value={colorName}
              onChange={(e) => setColorName(e.target.value)}
              className="w-full h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-sm text-white"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="text-xs text-[#9CA3AF] block mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-[#111827] border border-[#374151] rounded-lg px-3 py-2 text-sm text-white resize-none"
            />
          </div>
          <div>
            <label className="text-xs text-[#9CA3AF] block mb-2">Fabric lines</label>
            {fabrics.map((f, idx) => (
              <div key={idx} className="mb-2 p-3 bg-[#111827] rounded-lg border border-[#374151] space-y-2">
                <input
                  value={fabricSearch}
                  onChange={(e) => setFabricSearch(e.target.value)}
                  placeholder="Search fabric product…"
                  className="w-full h-9 bg-[#1F2937] border border-[#374151] rounded px-2 text-xs text-white"
                />
                {fabricSearch && (
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {fabricOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          const next = [...fabrics];
                          next[idx] = {
                            product_id: opt.id,
                            product_name: opt.name,
                            sku: opt.sku,
                            unit_code: opt.unit ?? 'm',
                            quantity: next[idx]?.quantity ?? 1,
                          };
                          setFabrics(next);
                          setFabricSearch('');
                        }}
                        className="w-full text-left text-xs px-2 py-1 rounded hover:bg-[#374151] text-[#D1D5DB]"
                      >
                        {opt.name} ({opt.sku})
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-[#6EE7B7] truncate">{f.product_name || 'Pick fabric above'}</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={f.quantity}
                    onChange={(e) => {
                      const next = [...fabrics];
                      next[idx] = { ...next[idx], quantity: Number(e.target.value) || 0 };
                      setFabrics(next);
                    }}
                    className="w-20 h-9 bg-[#1F2937] border border-[#374151] rounded px-2 text-sm text-white"
                  />
                  <span className="text-xs text-[#9CA3AF]">{f.unit_code || 'm'}</span>
                  <button
                    type="button"
                    onClick={() => setFabrics(fabrics.filter((_, i) => i !== idx))}
                    className="ml-auto p-1 text-[#EF4444]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setFabrics([...fabrics, { product_id: '', product_name: '', unit_code: 'm', quantity: 1 }])
              }
              className="flex items-center gap-1 text-sm text-[#3B82F6]"
            >
              <Plus className="w-4 h-4" /> Add fabric
            </button>
          </div>
        </div>
        <div className="p-4 border-t border-[#374151] flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl border border-[#374151] text-[#9CA3AF]">
            Cancel
          </button>
          <button type="button" onClick={apply} className="flex-1 h-11 rounded-xl bg-[#10B981] text-white font-medium">
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
