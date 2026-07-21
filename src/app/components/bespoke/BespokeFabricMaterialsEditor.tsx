import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '../ui/utils';
import { formatQty } from '@/app/utils/quantity';
import type { BespokeFabricMaterial } from '@/app/types/bespoke';
import {
  bespokeFabricProductService,
  type FabricFilterMode,
  type LooseFabricProductOption,
} from '@/app/services/bespokeFabricProductService';
import { toast } from 'sonner';

const STANDARD_FABRIC_QTY = 2.5;

type FabricPreset = 'shirt' | 'dupatta' | 'trouser' | 'custom';

const FABRIC_PRESETS: Array<{ id: FabricPreset; label: string; qty: number | null }> = [
  { id: 'shirt', label: 'Shirt', qty: STANDARD_FABRIC_QTY },
  { id: 'dupatta', label: 'Dupatta', qty: STANDARD_FABRIC_QTY },
  { id: 'trouser', label: 'Trouser', qty: STANDARD_FABRIC_QTY },
  { id: 'custom', label: 'Custom', qty: null },
];

function emptyRow(): BespokeFabricMaterial {
  return {
    product_id: '',
    product_name: '',
    sku: '',
    unit_code: 'm',
    quantity: STANDARD_FABRIC_QTY,
  };
}

export interface BespokeFabricMaterialsEditorProps {
  companyId: string;
  branchId?: string | null;
  value: BespokeFabricMaterial[];
  onChange: (rows: BespokeFabricMaterial[]) => void;
}

export function BespokeFabricMaterialsEditor({
  companyId,
  branchId,
  value,
  onChange,
}: BespokeFabricMaterialsEditorProps) {
  const rows = value.length ? value : [emptyRow()];
  const [openRowIndex, setOpenRowIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [options, setOptions] = useState<LooseFabricProductOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasEligibleUnits, setHasEligibleUnits] = useState(true);
  const [usedFallback, setUsedFallback] = useState(false);
  const [filterMode, setFilterMode] = useState<FabricFilterMode>('dyeable');
  const [counts, setCounts] = useState({ dyeable: 0, meter: 0, all: 0 });

  const loadOptions = useCallback(
    async (term: string, mode: FabricFilterMode) => {
      if (!companyId) return;
      setLoading(true);
      try {
        const result = await bespokeFabricProductService.getLooseFabricProducts(
          companyId,
          term,
          branchId,
          mode,
        );
        setOptions(result.options);
        setHasEligibleUnits(result.hasEligibleUnits);
        setUsedFallback(result.usedFallback);
        setCounts(result.counts);
        if (mode === 'dyeable' && result.counts.dyeable === 0 && result.counts.meter > 0) {
          // Keep selection but note fallback via usedFallback
        }
      } catch (err) {
        setOptions([]);
        setHasEligibleUnits(true);
        setUsedFallback(false);
        toast.error(
          err instanceof Error ? err.message : 'Failed to load fabric products',
        );
      } finally {
        setLoading(false);
      }
    },
    [companyId, branchId],
  );

  useEffect(() => {
    void loadOptions('', filterMode);
  }, [loadOptions, filterMode]);

  useEffect(() => {
    if (openRowIndex == null) return;
    const t = setTimeout(() => loadOptions(searchTerm, filterMode), 200);
    return () => clearTimeout(t);
  }, [openRowIndex, searchTerm, filterMode, loadOptions]);

  const emptyMessage = (() => {
    if (filterMode === 'dyeable' && counts.dyeable === 0) {
      return 'No dyeable fabrics marked yet. Switch to Meter Fabrics or mark products as Dyeable in Products.';
    }
    if (filterMode === 'meter' && !hasEligibleUnits) {
      return 'No Meter/Yard unit in Settings → Inventory. Add a Meter unit and assign it to fabric products.';
    }
    if (searchTerm.trim().length >= 2 && usedFallback) {
      return 'No fabric-unit products matched. Showing name/SKU search results — verify unit on product.';
    }
    if (searchTerm.trim()) {
      return 'No products match your search. Try another name or SKU.';
    }
    return 'No products found for this filter.';
  })();

  const updateRow = (index: number, patch: Partial<BespokeFabricMaterial>) => {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    onChange(next);
  };

  const addRow = () => {
    onChange([...rows, emptyRow()]);
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    onChange(next.length ? next : [emptyRow()]);
  };

  const applyPreset = (index: number, preset: FabricPreset) => {
    const def = FABRIC_PRESETS.find((p) => p.id === preset);
    updateRow(index, {
      ...(def?.qty != null
        ? { quantity: def.qty, unit_code: rows[index]?.unit_code || 'm' }
        : {}),
      usage: preset === 'custom' ? undefined : preset,
    });
  };

  const selectProduct = (index: number, product: LooseFabricProductOption) => {
    const current = rows[index];
    const currentQty = current?.quantity;
    updateRow(index, {
      product_id: product.product_id,
      variation_id: product.variation_id,
      product_name: product.name,
      sku: product.sku,
      unit_code: product.unit_code,
      quantity: currentQty > 0 ? currentQty : STANDARD_FABRIC_QTY,
      // Display/reference only — cart injection still keeps fabric stock-only (Rs 0 billed).
      retail_price: product.retail_price,
      ...(current?.usage ? { usage: current.usage } : {}),
    });
    setOpenRowIndex(null);
    setSearchTerm('');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label className="text-muted-foreground">Fabric / materials</Label>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addRow}>
          <Plus size={12} className="mr-1" />
          Add fabric
        </Button>
      </div>

      <div className="flex gap-1 flex-wrap">
        {(
          [
            { id: 'dyeable' as const, label: 'Dyeable', count: counts.dyeable },
            { id: 'meter' as const, label: 'Meter Fabrics', count: counts.meter },
            { id: 'all' as const, label: 'All Products', count: counts.all },
          ]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterMode(tab.id)}
            className={cn(
              'px-2.5 py-1 rounded-md text-[11px] font-semibold border',
              filterMode === tab.id
                ? 'bg-violet-600 text-white border-violet-500'
                : 'bg-muted/40 text-muted-foreground border-border',
            )}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {rows.map((row, index) => {
        const preset: FabricPreset = row.usage ?? 'custom';
        return (
          <div
            key={`fabric-row-${index}`}
            className="space-y-2 border border-border rounded-lg p-2 bg-muted/40"
          >
            <div className="flex flex-wrap gap-1.5">
              {FABRIC_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(index, p.id)}
                  className={cn(
                    'px-2 py-1 rounded-md text-[11px] font-medium border',
                    preset === p.id
                      ? 'border-violet-500 bg-violet-500/20 text-violet-200'
                      : 'border-border text-muted-foreground',
                  )}
                >
                  {p.label}
                  {p.qty != null ? ` ${p.qty}m` : ''}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-[1fr_100px_32px] gap-2 items-end">
              <div>
                <Label className="text-[10px] text-muted-foreground mb-1 block">Product</Label>
                <Popover
                  open={openRowIndex === index}
                  onOpenChange={(open) => {
                    setOpenRowIndex(open ? index : null);
                    if (open) setSearchTerm('');
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'w-full justify-between h-8 text-xs font-normal bg-input-background border-border',
                        !row.product_id && 'text-muted-foreground',
                      )}
                    >
                      <span className="truncate text-left">
                        {row.product_id
                          ? `${row.product_name}${row.sku ? ` (${row.sku})` : ''}`
                          : 'Search fabric…'}
                      </span>
                      <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[340px] p-0 bg-input-background border-border" align="start">
                    <Command shouldFilter={false} className="bg-input-background text-white">
                      <CommandInput
                        placeholder="Search by name or SKU…"
                        value={searchTerm}
                        onValueChange={setSearchTerm}
                        className="h-9"
                      />
                      <CommandList>
                        {loading ? (
                          <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Loading…
                          </div>
                        ) : (
                          <>
                            {options.length === 0 ? (
                              <div className="py-6 px-3 text-center text-sm text-muted-foreground">
                                {emptyMessage}
                              </div>
                            ) : (
                              <CommandGroup>
                                {options.map((p) => (
                                  <CommandItem
                                    key={p.id}
                                    value={p.id}
                                    onSelect={() => selectProduct(index, p)}
                                    className="cursor-pointer"
                                  >
                                    <div className="flex flex-col">
                                      <span className="text-sm">{p.name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {p.sku} · {p.unit_code}
                                        {p.stock != null ? ` · Stock ${formatQty(p.stock)}` : ''}
                                        {` · Rs. ${Number(p.retail_price || 0).toLocaleString()}`}
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground mb-1 block">
                  Qty ({row.unit_code || 'm'})
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={row.quantity > 0 ? row.quantity : ''}
                  onChange={(e) => {
                    const v = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                    updateRow(index, { quantity: v, usage: undefined });
                  }}
                  className="h-8 bg-input-background border-border text-white text-xs"
                  placeholder="2.5"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-400 hover:text-red-300"
                onClick={() => removeRow(index)}
                disabled={rows.length <= 1 && !row.product_id}
              >
                <Trash2 size={14} />
              </Button>
            </div>

            {row.product_id ? (
              <p className="text-[11px] text-violet-300/90">
                Retail ref: Rs. {Number(row.retail_price || 0).toLocaleString()}
                <span className="text-muted-foreground"> (included in dress price — not billed again)</span>
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
