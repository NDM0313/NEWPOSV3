import { useState } from 'react';
import { ArrowLeft, Package, Search, AlertTriangle } from 'lucide-react';
import { User } from '../../App';

interface InventoryReportsProps {
  onBack: () => void;
  user: User;
}

interface StockItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  minStock: number;
  unit: string;
  value: number;
}

export function InventoryReports({ onBack, user }: InventoryReportsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);

  const inventory: StockItem[] = [
    { id: 'i1', name: 'Cotton Fabric', category: 'Raw Material', currentStock: 500, minStock: 100, unit: 'Meter', value: 250000 },
    { id: 'i2', name: 'Lawn Material', category: 'Raw Material', currentStock: 80, minStock: 150, unit: 'Meter', value: 120000 },
    { id: 'i3', name: 'Silk Dupatta', category: 'Finished Goods', currentStock: 30, minStock: 50, unit: 'Piece', value: 90000 },
    { id: 'i4', name: 'Buttons', category: 'Accessories', currentStock: 5000, minStock: 1000, unit: 'Piece', value: 15000 },
    { id: 'i5', name: 'Thread Spools', category: 'Accessories', currentStock: 45, minStock: 100, unit: 'Piece', value: 9000 },
  ];

  const filtered = inventory.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayed = showLowStock ? filtered.filter(item => item.currentStock < item.minStock) : filtered;

  const totals = {
    totalValue: displayed.reduce((sum, item) => sum + item.value, 0),
    lowStockItems: inventory.filter(item => item.currentStock < item.minStock).length,
  };

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-[#F59E0B]" />
            <h1 className="text-lg font-semibold">Inventory Reports</h1>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
          <input type="text" placeholder="Search items..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-12 pl-10 pr-4 bg-[#1F2937] border border-[#374151] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-3">
            <p className="text-xs text-[#F59E0B] mb-1">Stock Value</p>
            <p className="text-sm font-bold text-[#F59E0B]">Rs. {totals.totalValue.toLocaleString()}</p>
          </div>
          <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-3">
            <p className="text-xs text-[#EF4444] mb-1">Low Stock</p>
            <p className="text-sm font-bold text-[#EF4444]">{totals.lowStockItems} Items</p>
          </div>
        </div>

        <button onClick={() => setShowLowStock(!showLowStock)} className={`w-full h-12 ${showLowStock ? 'bg-[#EF4444]/20 border-[#EF4444]' : 'bg-[#1F2937] border-[#374151]'} border rounded-lg font-medium transition-colors flex items-center justify-center gap-2`}>
          <AlertTriangle className="w-5 h-5" />
          {showLowStock ? 'Show All Items' : 'Show Low Stock Only'}
        </button>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-[#9CA3AF]">STOCK ITEMS ({displayed.length})</h3>
          {displayed.map((item) => {
            const isLowStock = item.currentStock < item.minStock;
            return (
              <div key={item.id} className={`bg-[#1F2937] border ${isLowStock ? 'border-[#EF4444]/30' : 'border-[#374151]'} rounded-xl p-4`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-white">{item.name}</p>
                    <p className="text-xs text-[#9CA3AF]">{item.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#F59E0B]">Rs. {item.value.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 ${isLowStock ? 'bg-[#EF4444]/10 text-[#EF4444]' : 'bg-[#10B981]/10 text-[#10B981]'} text-xs rounded-md font-medium`}>
                    {item.currentStock} {item.unit}
                  </span>
                  <span className="px-2 py-1 bg-[#6B7280]/10 text-[#9CA3AF] text-xs rounded-md font-medium">
                    Min: {item.minStock}
                  </span>
                  {isLowStock && <AlertTriangle className="w-4 h-4 text-[#EF4444]" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
