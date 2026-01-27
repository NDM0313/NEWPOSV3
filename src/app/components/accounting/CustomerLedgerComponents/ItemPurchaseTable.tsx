'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AccountLedgerEntry } from '@/app/services/accountingService';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';

interface ItemPurchaseTableProps {
  entries: AccountLedgerEntry[];
  companyId: string;
  customerId: string;
}

interface SaleItem {
  id: string;
  product_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
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

      // Fetch sale items for all sales
      const { data: saleItems } = await supabase
        .from('sale_items')
        .select('id, sale_id, product_name, quantity, unit, unit_price, discount_amount, tax_amount, total')
        .in('sale_id', saleIds)
        .order('id');

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
                    Rs {sale.invoiceTotal.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full">
              <thead className="bg-gray-900 border-b border-gray-800">
                <tr className="text-xs font-semibold text-gray-400 uppercase">
                  <th className="px-4 py-3 text-left">Item Name</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Rate</th>
                  <th className="px-4 py-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-center text-gray-400 text-sm">
                      No items found
                    </td>
                  </tr>
                ) : (
                  sale.items.map((item, idx) => (
                    <tr key={item.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-sm text-white">{item.product_name}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-300">
                        {item.quantity.toFixed(2)} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-300">
                        Rs {item.unit_price.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-green-400 font-semibold">
                        Rs {item.total.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
};
