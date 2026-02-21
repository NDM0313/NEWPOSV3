import { useState, useEffect } from 'react';
import { TextInput } from '../common';
import { ArrowLeft, Package, AlertTriangle, Loader2, Search } from 'lucide-react';
import type { User, Branch } from '../../types';
import * as inventoryApi from '../../api/inventory';

interface InventoryModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branch: Branch | null;
}

export function InventoryModule({ onBack, user: _user, companyId, branch: _branch }: InventoryModuleProps) {
  const [list, setList] = useState<inventoryApi.InventoryItem[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let c = false;
    setLoading(true);
    inventoryApi.getInventory(companyId).then(({ data, error }) => {
      if (c) return;
      setLoading(false);
      if (!error && data) setList(data);
    });
    return () => { c = true; };
  }, [companyId]);

  const lowStockCount = list.filter((i) => i.isLowStock).length;
  const filtered = list.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-[#10B981]/20 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-[#10B981]" />
            </div>
            <h1 className="text-white font-semibold text-base">Inventory</h1>
          </div>
        </div>
        <div className="px-4 pb-3">
          <TextInput
            value={search}
            onChange={setSearch}
            placeholder="Search products..."
            prefix={<Search className="w-5 h-5" />}
          />
        </div>
      </div>

      <div className="p-4">
        {lowStockCount > 0 && (
          <div className="mb-4 flex items-center gap-3 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4">
            <AlertTriangle className="w-6 h-6 text-[#F59E0B] flex-shrink-0" />
            <div>
              <p className="font-medium text-[#F59E0B]">{lowStockCount} low stock item{lowStockCount > 1 ? 's' : ''}</p>
              <p className="text-sm text-[#9CA3AF]">Stock at or below minimum level</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#10B981] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-[#9CA3AF] text-center py-8">No products in inventory.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <div
                key={item.id}
                className={`bg-[#1F2937] border rounded-xl p-4 ${item.isLowStock ? 'border-[#F59E0B]/50' : 'border-[#374151]'}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white truncate">{item.name}</p>
                      {item.isLowStock && <AlertTriangle className="w-4 h-4 text-[#F59E0B] flex-shrink-0" />}
                    </div>
                    <p className="text-sm text-[#9CA3AF]">{item.sku}</p>
                    {item.minStock > 0 && (
                      <p className="text-xs text-[#6B7280] mt-1">Min: {item.minStock}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className={`font-semibold ${item.isLowStock ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
                      {item.stock}
                    </p>
                    <p className="text-xs text-[#9CA3AF]">in stock</p>
                    <p className="text-xs text-[#6B7280] mt-1">Rs. {item.retailPrice.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
