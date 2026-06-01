import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { Product } from './SalesModule';
import * as productsApi from '../../api/products';
import type { BespokeFabricMaterial } from '../../types/bespoke';
import { isBespokeGenericSku } from '../../lib/bespokeCartInjection';
import { applyFabricsToParent, lineCartId } from '../../lib/bespokeCartMobile';
import { resolveFabricMaterialRetailPrice } from '../../lib/bespokeCartInjection';
import { hydrateFabricDraftsFromChildren } from '../../lib/bespokeCartInjection';
import { FabricProductGrid } from './FabricProductGrid';
import { mapApiProductToFabricPicker, type FabricPickerProduct } from './fabricPickerTypes';
import { useSettings } from '../../context/SettingsContext';

interface SaleCustomizeModalProps {
  companyId: string;
  branchId: string | null;
  parentLine: Product;
  cartProducts: Product[];
  relaxStock?: boolean;
  onClose: () => void;
  onApply: (products: Product[]) => void;
}

export function SaleCustomizeModal({
  companyId,
  branchId,
  parentLine,
  cartProducts,
  relaxStock = true,
  onClose,
  onApply,
}: SaleCustomizeModalProps) {
  const parentIdx = cartProducts.findIndex((p) => p === parentLine);
  const parentCartId = lineCartId(parentLine, parentIdx >= 0 ? parentIdx : 0);
  const { negativeStockAllowed, loaded: settingsLoaded } = useSettings();

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
  const [activeFabricIndex, setActiveFabricIndex] = useState(0);
  const [fabricSearch, setFabricSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [colorName, setColorName] = useState('');
  const [stockProducts, setStockProducts] = useState<FabricPickerProduct[]>([]);

  useEffect(() => {
    void productsApi.getProducts(companyId, { branchId: branchId ?? undefined }).then(({ data }) => {
      setStockProducts(
        (data ?? [])
          .filter((p) => !isBespokeGenericSku(p.sku))
          .map(mapApiProductToFabricPicker),
      );
    });
  }, [companyId, branchId]);

  const filteredStock = useMemo(() => {
    const q = fabricSearch.trim().toLowerCase();
    if (!q) return stockProducts;
    return stockProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q),
    );
  }, [stockProducts, fabricSearch]);

  const activeFabric = fabrics[activeFabricIndex];

  const pickProductForActiveLine = (opt: FabricPickerProduct) => {
    const next = [...fabrics];
    next[activeFabricIndex] = {
      product_id: opt.id,
      product_name: opt.name,
      sku: opt.sku,
      unit_code: opt.unit ?? 'm',
      quantity: next[activeFabricIndex]?.quantity > 0 ? next[activeFabricIndex].quantity : 1,
    };
    setFabrics(next);
  };

  const apply = () => {
    const meta = {
      notes: notes.trim() || undefined,
      color_name: colorName.trim() || undefined,
      fabric_materials: fabrics.filter((f) => f.product_id && f.quantity > 0),
    };
    const next = applyFabricsToParent(
      cartProducts,
      parentLine,
      fabrics.filter((f) => f.product_id && f.quantity > 0),
      resolveFabricMaterialRetailPrice,
      meta as Record<string, unknown>,
    );
    onApply(next);
    onClose();
  };

  const gateAllowNegative = !settingsLoaded || negativeStockAllowed;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#1F2937] w-full sm:max-w-lg max-h-[92vh] rounded-t-2xl sm:rounded-2xl border border-[#374151] flex flex-col">
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
            <div className="flex flex-wrap gap-2 mb-2">
              {fabrics.map((f, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveFabricIndex(idx)}
                  className={`px-2 py-1 text-xs rounded-lg border ${
                    activeFabricIndex === idx
                      ? 'border-[#10B981] bg-[#10B981]/15 text-[#6EE7B7]'
                      : 'border-[#374151] text-[#9CA3AF]'
                  }`}
                >
                  {f.product_name?.trim() || `Fabric ${idx + 1}`}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setFabrics([...fabrics, { product_id: '', product_name: '', unit_code: 'm', quantity: 1 }]);
                  setActiveFabricIndex(fabrics.length);
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs text-[#3B82F6]"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>

            {activeFabric && (
              <div className="p-3 bg-[#111827] rounded-lg border border-[#374151] space-y-3">
                <p className="text-xs text-[#6EE7B7]">
                  Line {activeFabricIndex + 1}: {activeFabric.product_name || 'Select product below'}
                </p>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={activeFabric.quantity}
                    onChange={(e) => {
                      const next = [...fabrics];
                      next[activeFabricIndex] = {
                        ...next[activeFabricIndex],
                        quantity: Number(e.target.value) || 0,
                      };
                      setFabrics(next);
                    }}
                    className="w-24 h-9 bg-[#1F2937] border border-[#374151] rounded px-2 text-sm text-white"
                  />
                  <span className="text-xs text-[#9CA3AF]">{activeFabric.unit_code || 'm'}</span>
                  {fabrics.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = fabrics.filter((_, i) => i !== activeFabricIndex);
                        setFabrics(next.length ? next : [{ product_id: '', product_name: '', unit_code: 'm', quantity: 1 }]);
                        setActiveFabricIndex(0);
                      }}
                      className="ml-auto p-1 text-[#EF4444]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

            <label className="text-xs text-[#9CA3AF] block mb-1 mt-3">Search stock products</label>
            <input
              value={fabricSearch}
              onChange={(e) => setFabricSearch(e.target.value)}
              placeholder="Search fabric / material…"
              className="w-full h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-sm text-white mb-2"
            />
            <FabricProductGrid
              items={filteredStock}
              onSelect={pickProductForActiveLine}
              allowNegativeStock={gateAllowNegative}
              settingsLoaded={settingsLoaded}
              relaxStock={relaxStock}
              selectedId={activeFabric?.product_id || null}
            />
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
