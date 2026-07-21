import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Upload, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import type { Product } from './SalesModule';
import * as productsApi from '../../api/products';
import {
  buildBespokeMetadataForPersist,
  hasBespokeMetadataContent,
  parseCustomizationDetails,
  type BespokeFabricMaterial,
  type BespokeMetadata,
} from '../../types/bespoke';
import { isBespokeGenericSku } from '../../lib/bespokeCartInjection';
import { applyFabricsToParent, lineCartId } from '../../lib/bespokeCartMobile';
import { resolveFabricMaterialRetailPrice } from '../../lib/bespokeCartInjection';
import { hydrateFabricDraftsFromChildren } from '../../lib/bespokeCartInjection';
import { FabricProductGrid } from './FabricProductGrid';
import { mapApiProductToFabricPicker, type FabricPickerProduct } from './fabricPickerTypes';
import { useSettings } from '../../context/SettingsContext';
import { useBespokeEnabled, type BespokeFormConfig } from '../../hooks/useBespokeEnabled';
import { DateInputField } from '../shared/DateTimePicker';
import {
  getBespokeImageDisplayUrl,
  uploadBespokeReferenceImage,
} from '../../utils/bespokeImageUpload';

const LOOSE_FABRIC_UNIT_TOKENS = new Set([
  'm', 'meter', 'meters', 'metre', 'metres',
  'yd', 'yard', 'yards',
  'gaz', 'gazz', 'guz',
  'mtr', 'mtrs',
]);

function isLooseFabricUnit(unitName: string | undefined): boolean {
  const t = String(unitName ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  return LOOSE_FABRIC_UNIT_TOKENS.has(t);
}

interface SaleCustomizeModalProps {
  companyId: string;
  branchId: string | null;
  parentLine: Product;
  cartProducts: Product[];
  relaxStock?: boolean;
  formConfig?: BespokeFormConfig;
  onClose: () => void;
  onApply: (products: Product[]) => void;
}

export function SaleCustomizeModal({
  companyId,
  branchId,
  parentLine,
  cartProducts,
  relaxStock = true,
  formConfig: formConfigProp,
  onClose,
  onApply,
}: SaleCustomizeModalProps) {
  const parentIdx = cartProducts.findIndex((p) => p === parentLine);
  const parentCartId = lineCartId(parentLine, parentIdx >= 0 ? parentIdx : 0);
  const { negativeStockAllowed, loaded: settingsLoaded } = useSettings();
  const { formConfig: hookedConfig } = useBespokeEnabled(companyId);
  const config = formConfigProp ?? hookedConfig;

  const initialDetails = parseCustomizationDetails(parentLine.customizationDetails);

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
  const [notes, setNotes] = useState(() => initialDetails?.notes ?? '');
  const [colorName, setColorName] = useState(() => initialDetails?.color_name ?? '');
  const [shadeCode, setShadeCode] = useState(() => initialDetails?.shade_card_code ?? '');
  const [measurements, setMeasurements] = useState(() => {
    const m = initialDetails?.measurements;
    if (typeof m === 'string') return m;
    if (m && typeof m === 'object') return JSON.stringify(m, null, 2);
    return '';
  });
  const [deliveryDate, setDeliveryDate] = useState(
    () => (initialDetails?.expected_delivery_date || '').slice(0, 10),
  );
  const [imageUrl, setImageUrl] = useState(() => initialDetails?.image_url ?? '');
  const [imagePath, setImagePath] = useState(() => initialDetails?.image_storage_path ?? '');
  const [previewSrc, setPreviewSrc] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [stockProducts, setStockProducts] = useState<FabricPickerProduct[]>([]);
  const [fabricFilterNote, setFabricFilterNote] = useState<string | null>(null);
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [showNotes, setShowNotes] = useState(Boolean(initialDetails?.notes));

  useEffect(() => {
    void productsApi.getProducts(companyId, { branchId: branchId ?? undefined }).then(({ data }) => {
      const all = (data ?? []).filter((p) => !isBespokeGenericSku(p.sku));
      const dyeable = all.filter((p) => p.isDyeable);
      let source = all;
      if (dyeable.length > 0) {
        source = dyeable;
        setFabricFilterNote('Showing dyeable / white fabrics only');
      } else {
        const byUnit = all.filter((p) => isLooseFabricUnit(p.unit) || p.unitAllowDecimal);
        if (byUnit.length > 0) {
          source = byUnit;
          setFabricFilterNote('Showing meter/yard fabrics (mark products as Dyeable for a tighter list)');
        } else {
          setFabricFilterNote(null);
        }
      }
      setStockProducts(source.map(mapApiProductToFabricPicker));
    });
  }, [companyId, branchId]);

  useEffect(() => {
    const external = imageUrl.trim();
    if (external) {
      setPreviewSrc(external);
      return;
    }
    const path = imagePath.trim();
    if (!path) {
      setPreviewSrc('');
      return;
    }
    let cancelled = false;
    void getBespokeImageDisplayUrl(path).then((url) => {
      if (!cancelled) setPreviewSrc(url || '');
    });
    return () => {
      cancelled = true;
    };
  }, [imageUrl, imagePath]);

  const filteredStock = useMemo(() => {
    const q = fabricSearch.trim().toLowerCase();
    if (!q) return stockProducts;
    return stockProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q),
    );
  }, [stockProducts, fabricSearch]);

  const activeFabric = fabrics[activeFabricIndex];
  const dressTotal = Number(parentLine.price || 0) * Number(parentLine.quantity || 1);

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

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    setUploading(true);
    setUploadError(null);
    try {
      const path = await uploadBespokeReferenceImage(companyId, file);
      setImagePath(path);
      setImageUrl('');
      const signed = await getBespokeImageDisplayUrl(path);
      setPreviewSrc(signed || '');
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const apply = () => {
    const metaRaw: BespokeMetadata = {
      ...(config.show_color_code && colorName.trim() ? { color_name: colorName.trim() } : {}),
      ...(config.show_color_code && shadeCode.trim() ? { shade_card_code: shadeCode.trim() } : {}),
      ...(config.show_measurements && measurements.trim() ? { measurements: measurements.trim() } : {}),
      ...(config.show_delivery_date && deliveryDate.trim()
        ? { expected_delivery_date: deliveryDate.trim().slice(0, 10) }
        : {}),
      ...(config.show_image_upload && imageUrl.trim() ? { image_url: imageUrl.trim() } : {}),
      ...(config.show_image_upload && imagePath.trim() ? { image_storage_path: imagePath.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    const metadata = buildBespokeMetadataForPersist(metaRaw) ?? {};
    const validFabrics = config.show_fabric
      ? fabrics.filter((f) => f.product_id && f.quantity > 0)
      : [];
    const next = applyFabricsToParent(
      cartProducts,
      parentLine,
      validFabrics,
      resolveFabricMaterialRetailPrice,
      metadata as Record<string, unknown>,
    );
    onApply(next);
    onClose();
  };

  const gateAllowNegative = !settingsLoaded || negativeStockAllowed;
  const hasExisting = hasBespokeMetadataContent(initialDetails);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#1F2937] w-full sm:max-w-lg max-h-[92vh] rounded-t-2xl sm:rounded-2xl border border-[#374151] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#374151]">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {hasExisting ? 'Edit customization' : 'Customize dress'}
            </h2>
            <p className="text-xs text-[#9CA3AF] mt-0.5 truncate max-w-[280px]">{parentLine.name}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-[#9CA3AF]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-3">
            <p className="text-[10px] uppercase tracking-wide text-violet-300/80">Dress (customer price)</p>
            <p className="text-sm font-semibold text-white truncate">{parentLine.name}</p>
            <p className="text-lg font-bold text-[#A78BFA] mt-0.5">
              Rs. {dressTotal.toLocaleString()}
              {parentLine.quantity > 1 ? (
                <span className="text-xs font-normal text-[#9CA3AF] ml-2">
                  ({parentLine.quantity} × {Number(parentLine.price || 0).toLocaleString()})
                </span>
              ) : null}
            </p>
            <p className="text-[11px] text-[#9CA3AF] mt-1">
              Making, fabric, dyeing &amp; stitching are included in this dress rate. Extra shop expenses use Extra Expenses on the sale.
            </p>
          </div>

          {config.show_fabric && (
            <div>
              <label className="text-sm font-medium text-white block mb-1">1. Choose fabric</label>
              {fabricFilterNote ? (
                <p className="text-[11px] text-[#9CA3AF] mb-2">{fabricFilterNote}</p>
              ) : null}
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
                  <Plus className="w-3 h-3" /> Add (e.g. dupatta)
                </button>
              </div>

              {activeFabric && (
                <div className="p-3 bg-[#111827] rounded-lg border border-[#374151] space-y-3 mb-2">
                  <p className="text-xs text-[#6EE7B7]">
                    Line {activeFabricIndex + 1}: {activeFabric.product_name || 'Tap a fabric below'}
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

              <input
                value={fabricSearch}
                onChange={(e) => setFabricSearch(e.target.value)}
                placeholder="Search fabric…"
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
          )}

          {config.show_color_code && (
            <div>
              <label className="text-sm font-medium text-white block mb-2">2. Color / shade</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#9CA3AF] block mb-1">Color name</label>
                  <input
                    value={colorName}
                    onChange={(e) => setColorName(e.target.value)}
                    className="w-full h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-sm text-white"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#9CA3AF] block mb-1">Shade card code</label>
                  <input
                    value={shadeCode}
                    onChange={(e) => setShadeCode(e.target.value)}
                    className="w-full h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-sm text-white"
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>
          )}

          {config.show_delivery_date && (
            <DateInputField
              label="Expected delivery (this line)"
              value={deliveryDate}
              onChange={setDeliveryDate}
            />
          )}

          {config.show_measurements && (
            <div className="border border-[#374151] rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowMeasurements((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-[#D1D5DB]"
              >
                <span>Measurements (optional)</span>
                {showMeasurements ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {showMeasurements && (
                <div className="px-3 pb-3">
                  <textarea
                    value={measurements}
                    onChange={(e) => setMeasurements(e.target.value)}
                    rows={3}
                    placeholder="Chest, length, sleeve…"
                    className="w-full bg-[#111827] border border-[#374151] rounded-lg px-3 py-2 text-sm text-white resize-none"
                  />
                </div>
              )}
            </div>
          )}

          {config.show_image_upload && (
            <div className="border border-[#374151] rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowImage((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-[#D1D5DB]"
              >
                <span>Reference image (optional)</span>
                {showImage ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {showImage && (
                <div className="px-3 pb-3 space-y-2">
                  <input
                    value={imageUrl}
                    onChange={(e) => {
                      setImageUrl(e.target.value);
                      if (e.target.value.trim()) setImagePath('');
                    }}
                    placeholder="External image URL (optional)"
                    className="w-full h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-sm text-white"
                  />
                  <label className="inline-flex items-center gap-2 text-sm text-[#C4B5FD] cursor-pointer">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Upload file
                    <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
                  </label>
                  {uploadError && <p className="text-xs text-[#EF4444]">{uploadError}</p>}
                  {previewSrc ? (
                    <img src={previewSrc} alt="Reference" className="max-h-32 rounded-lg border border-[#374151] object-contain" />
                  ) : null}
                </div>
              )}
            </div>
          )}

          <div className="border border-[#374151] rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowNotes((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-[#D1D5DB]"
            >
              <span>Notes (optional)</span>
              {showNotes ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {showNotes && (
              <div className="px-3 pb-3">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-[#111827] border border-[#374151] rounded-lg px-3 py-2 text-sm text-white resize-none"
                />
              </div>
            )}
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
