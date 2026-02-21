import { useState, useEffect } from 'react';
import { ArrowLeft, Package, Search, Loader2, AlertTriangle } from 'lucide-react';
import type { User } from '../../types';
import * as inventoryApi from '../../api/inventory';

interface InventoryReportsProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
}

export function InventoryReports({ onBack, user: _user, companyId }: InventoryReportsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<inventoryApi.InventoryItem[]>([]);
  const [loading, setLoading] = useState(!!companyId);

  useEffect(() => {
    if (!companyId) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    inventoryApi.getInventory(companyId).then(({ data, error }) => {
      if (cancelled) return;
      setLoading(false);
      setItems(error ? [] : data);
    });
    return () => { cancelled = true; };
  }, [companyId]);

  const filtered = items.filter(
    (i) =>
      i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const lowStock = filtered.filter((i) => i.isLowStock);
  const totalValue = filtered.reduce((sum, i) => sum + i.stock * i.retailPrice, 0);

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-base text-white">Inventory Reports</h1>
            <p className="text-xs text-[#9CA3AF]">Stock levels & low stock</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or SKU..."
            className="w-full h-11 bg-[#1F2937] border border-[#374151] rounded-lg pl-10 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#F59E0B]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-5 h-5 text-[#F59E0B]" />
              <span className="text-sm text-[#9CA3AF]">Total Products</span>
            </div>
            <p className="text-xl font-bold text-white">{filtered.length}</p>
          </div>
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
              <span className="text-sm text-[#9CA3AF]">Low Stock</span>
            </div>
            <p className="text-xl font-bold text-[#EF4444]">{lowStock.length}</p>
          </div>
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <span className="text-sm text-[#9CA3AF]">Est. Stock Value</span>
          <p className="text-xl font-bold text-[#F59E0B]">Rs. {totalValue.toLocaleString()}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#F59E0B] animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((i) => (
              <div key={i.id} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-white">{i.name}</p>
                    <p className="text-sm text-[#9CA3AF]">{i.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${i.isLowStock ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                      {i.stock} {i.minStock > 0 ? `(min: ${i.minStock})` : ''}
                    </p>
                    <p className="text-xs text-[#6B7280]">Rs. {i.retailPrice.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto mb-4 text-[#374151]" />
            <p className="text-[#9CA3AF]">No inventory items</p>
          </div>
        )}
      </div>
    </div>
  );
}
