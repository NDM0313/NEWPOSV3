import { Plus } from 'lucide-react';
import {
  formatStockLabel,
  getTotalProductStock,
  isSaleBlockedByStock,
  stockLabelClassName,
} from '../../utils/productStockGate';
import { ProductImage } from '../products/ProductImage';
import type { FabricPickerProduct } from './fabricPickerTypes';

interface FabricProductGridProps {
  items: FabricPickerProduct[];
  onSelect: (item: FabricPickerProduct) => void;
  allowNegativeStock: boolean;
  settingsLoaded: boolean;
  relaxStock?: boolean;
  selectedId?: string | null;
}

export function FabricProductGrid({
  items,
  onSelect,
  allowNegativeStock,
  settingsLoaded,
  relaxStock = false,
  selectedId = null,
}: FabricProductGridProps) {
  const gateAllowNegative = allowNegativeStock || relaxStock;

  if (items.length === 0) {
    return <p className="text-[#6B7280] text-xs text-center py-4">No products match.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => {
        const totalStock = getTotalProductStock(item);
        const blocked = !relaxStock && settingsLoaded && isSaleBlockedByStock(totalStock, allowNegativeStock);
        const isSelected = selectedId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => !blocked && onSelect(item)}
            disabled={blocked}
            className={`bg-[#1F2937] border rounded-xl p-2 text-left transition-all ${
              isSelected ? 'border-[#10B981] ring-1 ring-[#10B981]' : 'border-[#374151] hover:border-[#3B82F6]'
            } ${blocked ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <div className="w-full h-16 bg-[#111827] rounded-lg mb-1 flex items-center justify-center overflow-hidden">
              <ProductImage src={item.imageUrl} alt={item.name} variant="thumb" deferUntilVisible />
            </div>
            <h3 className="font-medium text-xs text-[#F9FAFB] line-clamp-2 mb-0.5">{item.name}</h3>
            <p className="text-[10px] text-[#9CA3AF] truncate">{item.sku || '—'}</p>
            <p className={`text-[10px] mb-1 ${stockLabelClassName(totalStock, gateAllowNegative)}`}>
              {formatStockLabel(totalStock, gateAllowNegative)}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#3B82F6]">Rs. {item.price.toLocaleString()}</span>
              <Plus className="w-3.5 h-3.5 text-[#10B981]" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
