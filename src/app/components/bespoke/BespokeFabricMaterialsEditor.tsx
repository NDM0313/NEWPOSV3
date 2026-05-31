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
import { cn, formatDecimal } from '../ui/utils';
import type { BespokeFabricMaterial } from '@/app/types/bespoke';
import {
  bespokeFabricProductService,
  type LooseFabricProductOption,
} from '@/app/services/bespokeFabricProductService';
import { toast } from 'sonner';

function emptyRow(): BespokeFabricMaterial {
  return {
    product_id: '',
    product_name: '',
    sku: '',
    unit_code: 'm',
    quantity: 0,
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

  const loadOptions = useCallback(
    async (term: string) => {
      if (!companyId) return;
      setLoading(true);
      try {
        const result = await bespokeFabricProductService.getLooseFabricProducts(
          companyId,
          term,
          branchId,
        );
        setOptions(result.options);
        setHasEligibleUnits(result.hasEligibleUnits);
        setUsedFallback(result.usedFallback);
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
    if (openRowIndex == null) return;
    const t = setTimeout(() => loadOptions(searchTerm), 200);
    return () => clearTimeout(t);
  }, [openRowIndex, searchTerm, loadOptions]);

  const emptyMessage = (() => {
    if (!hasEligibleUnits) {
      return 'No Meter/Yard unit in Settings → Inventory. Add a Meter unit and assign it to fabric products.';
    }
    if (searchTerm.trim().length >= 2 && usedFallback) {
      return 'No fabric-unit products matched. Showing name/SKU search results — verify unit on product.';
    }
    if (searchTerm.trim()) {
      return 'No products match your search. Try another name or SKU.';
    }
    return 'No fabric products found. Assign Meter/Yard unit to products in Products.';
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

  const selectProduct = (index: number, product: LooseFabricProductOption) => {
    updateRow(index, {
      product_id: product.product_id,
      variation_id: product.variation_id,
      product_name: product.name,
      sku: product.sku,
      unit_code: product.unit_code,
      retail_price: product.retail_price,
    });
    setOpenRowIndex(null);
    setSearchTerm('');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-gray-300">Fabric / materials (Meter / Yard stock)</Label>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addRow}>
          <Plus size={12} className="mr-1" />
          Add fabric
        </Button>
      </div>

      {rows.map((row, index) => (
        <div
          key={`fabric-row-${index}`}
          className="grid grid-cols-[1fr_100px_32px] gap-2 items-end border border-gray-800 rounded-lg p-2 bg-gray-950/50"
        >
          <div>
            <Label className="text-[10px] text-gray-500 mb-1 block">Product</Label>
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
                    'w-full justify-between h-8 text-xs font-normal bg-gray-950 border-gray-700',
                    !row.product_id && 'text-gray-500',
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
              <PopoverContent className="w-[320px] p-0 bg-gray-950 border-gray-700" align="start">
                <Command shouldFilter={false} className="bg-gray-950 text-white">
                  <CommandInput
                    placeholder="Search by name or SKU…"
                    value={searchTerm}
                    onValueChange={setSearchTerm}
                    className="h-9"
                  />
                  <CommandList>
                    {loading ? (
                      <div className="flex items-center justify-center py-4 text-gray-400 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Loading…
                      </div>
                    ) : (
                      <>
                        {options.length === 0 ? (
                          <div className="py-6 px-3 text-center text-sm text-gray-400">
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
                                  <span className="text-xs text-gray-400">
                                    {p.sku} · {p.unit_code}
                                    {p.stock != null ? ` · Stock ${formatDecimal(p.stock)}` : ''}
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
            <Label className="text-[10px] text-gray-500 mb-1 block">
              Qty ({row.unit_code || 'm'})
            </Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={row.quantity > 0 ? row.quantity : ''}
              onChange={(e) => {
                const v = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                updateRow(index, { quantity: v });
              }}
              className="h-8 bg-gray-950 border-gray-700 text-white text-xs"
              placeholder="4.5"
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
      ))}
    </div>
  );
}
