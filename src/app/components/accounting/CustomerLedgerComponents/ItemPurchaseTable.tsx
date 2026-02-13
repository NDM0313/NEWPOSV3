'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AccountLedgerEntry } from '@/app/services/accountingService';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { formatBoxesPieces } from '@/app/components/ui/utils';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';

interface ItemPurchaseTableProps {
  entries: AccountLedgerEntry[];
  companyId: string;
  customerId: string;
}

interface SaleItem {
  id: string;
  product_name: string;
  variation_id?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  packing_type?: string;
  packing_quantity?: number;
  packing_unit?: string;
  packing_details?: unknown;
  variation?: { id: string; attributes?: Record<string, unknown> };
}

interface SaleWithItems {
  saleId: string;
  invoiceNo: string;
  invoiceDate: string;
  invoiceTotal: number;
  items: SaleItem[];
}

export const ItemPurchaseTable: React.FC<ItemPurchaseTableProps> = ({
  entries,
  companyId,
  customerId,
}) => {
  const { formatCurrency } = useFormatCurrency();
  const [salesWithItems, setSalesWithItems] = useState<SaleWithItems[]>([]);
  const [loading, setLoading] = useState(false);

  // Get unique sale IDs from entries
  const saleIds = useMemo(() => {
    const ids = new Set<string>();
    entries.forEach(entry => {
      if (entry.sale_id) {
        ids.add(entry.sale_id);
      }
    });
    return Array.from(ids);
  }, [entries]);

  useEffect(() => {
    if (saleIds.length > 0 && companyId) {
      loadSaleItems();
    } else {
      setSalesWithItems([]);
    }
  }, [saleIds, companyId]);

  const loadSaleItems = async () => {
    setLoading(true);
    try {
      // Fetch sales
      const { data: sales } = await supabase
        .from('sales')
        .select('id, invoice_no, invoice_date, total')
        .in('id', saleIds)
        .eq('customer_id', customerId)
        .order('invoice_date', { ascending: false });

      if (!sales || sales.length === 0) {
        setSalesWithItems([]);
        return;
      }

      // Fetch sale items - same structure as sale (sales_items / sale_items), no derived values
      const selectCols = 'id, sale_id, product_id, variation_id, product_name, sku, quantity, unit, unit_price, discount_amount, tax_amount, total, packing_type, packing_quantity, packing_unit, packing_details, variation:product_variations(id, attributes)';
      let { data: saleItems, error: itemsError } = await supabase
        .from('sales_items')
        .select(selectCols)
        .in('sale_id', saleIds)
        .order('id');
      if (itemsError && (itemsError.code === '42P01' || String(itemsError.message).includes('sales_items'))) {
        const res = await supabase
          .from('sale_items')
          .select(selectCols)
          .in('sale_id', saleIds)
          .order('id');
        saleItems = res.data;
        itemsError = res.error;
      }
      if (itemsError) {
        const res = await supabase
          .from('sale_items')
          .select('id, sale_id, product_id, variation_id, product_name, sku, quantity, unit, unit_price, discount_amount, tax_amount, total, packing_type, packing_quantity, packing_unit, packing_details')
          .in('sale_id', saleIds)
          .order('id');
        saleItems = res.data;
      }

      // Group items by sale
      const itemsBySale = new Map<string, SaleItem[]>();
      saleItems?.forEach(item => {
        if (!itemsBySale.has(item.sale_id)) {
          itemsBySale.set(item.sale_id, []);
        }
        itemsBySale.get(item.sale_id)!.push(item as SaleItem);
      });

      // Combine sales with items
      const combined: SaleWithItems[] = sales.map(sale => ({
        saleId: sale.id,
        invoiceNo: sale.invoice_no,
        invoiceDate: sale.invoice_date,
        invoiceTotal: sale.total || 0,
        items: itemsBySale.get(sale.id) || [],
      }));

      setSalesWithItems(combined);
    } catch (error) {
      console.error('[ITEM PURCHASE TABLE] Error loading sale items:', error);
      setSalesWithItems([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        Loading purchase history...
      </div>
    );
  }

  if (salesWithItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        No purchase history found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto p-6">
      <div className="space-y-6">
        {salesWithItems.map((sale) => (
          <div key={sale.saleId} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
            {/* Invoice Header */}
            <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">Invoice: {sale.invoiceNo}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Date: {format(new Date(sale.invoiceDate), 'dd MMM yyyy')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">Invoice Total</div>
                  <div className="font-semibold text-white">
                    {formatCurrency(sale.invoiceTotal)}
                  </div>
                </div>
              </div>
            </div>

            {/* Items Table - 1:1 with sale_items: Variation, Packing, Qty, Unit separate */}
            <table className="w-full">
              <thead className="bg-gray-900 border-b border-gray-800">
                <tr className="text-xs font-semibold text-gray-400 uppercase">
                  <th className="px-4 py-3 text-left">Product Name</th>
                  <th className="px-4 py-3 text-left">Variation</th>
                  <th className="px-4 py-3 text-left">Packing</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-left">Unit</th>
                  <th className="px-4 py-3 text-right">Unit Price</th>
                  <th className="px-4 py-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-4 text-center text-gray-400 text-sm">
                      No items found
                    </td>
                  </tr>
                ) : (
                  sale.items.map((item) => {
                    const variationData = item.variation || (item as any).product_variations;
                    const attrs = variationData?.attributes || {};
                    const variationText = (attrs.size || attrs.color) ? [attrs.size, attrs.color].filter(Boolean).join(' / ') : '—';
                    // Packing: structured – Boxes + Pieces (never merge with Qty/Unit)
                    const pd = item.packing_details || {};
                    const totalBoxes = pd.total_boxes ?? 0;
                    const totalPieces = pd.total_pieces ?? 0;
                    const packingParts: string[] = [];
                    if (Number(totalBoxes) > 0) packingParts.push(`${formatBoxesPieces(totalBoxes)} Box${Math.round(Number(totalBoxes)) !== 1 ? 'es' : ''}`);
                    if (Number(totalPieces) > 0) packingParts.push(`${formatBoxesPieces(totalPieces)} Piece${Math.round(Number(totalPieces)) !== 1 ? 's' : ''}`);
                    const packingText = packingParts.length
                      ? packingParts.join(', ')
                      : (item.packing_type || item.packing_quantity != null || item.packing_unit)
                        ? [item.packing_type, item.packing_quantity != null && item.packing_quantity !== '' ? String(item.packing_quantity) : null, item.packing_unit].filter(Boolean).join(' ')
                        : '—';
                    const unit = item.unit ?? 'piece';
                    return (
                      <tr key={item.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                        <td className="px-4 py-3 text-sm text-white">{item.product_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-300">{variationText}</td>
                        <td className="px-4 py-3 text-sm text-gray-300">{packingText}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-300">{Number(item.quantity).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-gray-300">{unit}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-300">
                          {formatCurrency(Number(item.unit_price))}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-green-400 font-semibold">
                          {formatCurrency(Number(item.total))}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
};
