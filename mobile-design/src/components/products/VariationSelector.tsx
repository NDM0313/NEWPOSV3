import { useState } from 'react';
import { X, Package, Check } from 'lucide-react';
import { ProductWithVariations, ProductVariation, formatVariationLabel } from './ProductWithVariations';

interface VariationSelectorProps {
  product: ProductWithVariations;
  onSelect: (variation: ProductVariation) => void;
  onClose: () => void;
}

export function VariationSelector({ product, onSelect, onClose }: VariationSelectorProps) {
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);

  const handleSelect = () => {
    if (selectedVariation) {
      onSelect(selectedVariation);
      onClose();
    }
  };

  // Group variations by attribute
  const groupedByColor = product.variations.reduce((acc, variation) => {
    const color = variation.color || 'Default';
    if (!acc[color]) acc[color] = [];
    acc[color].push(variation);
    return acc;
  }, {} as Record<string, ProductVariation[]>);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end">
      <div className="bg-[#1F2937] w-full rounded-t-3xl max-h-[85vh] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center pt-2 pb-4">
          <div className="w-12 h-1.5 bg-[#374151] rounded-full" />
        </div>

        {/* Header */}
        <div className="px-6 pb-4 border-b border-[#374151]">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h2 className="text-white text-lg font-semibold mb-1">{product.name}</h2>
              <p className="text-sm text-[#9CA3AF]">Select variation</p>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 text-[#9CA3AF] hover:text-white hover:bg-[#374151] rounded-lg"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Variations */}
        <div className="px-6 py-4">
          <div className="space-y-4">
            {Object.entries(groupedByColor).map(([color, variations]) => (
              <div key={color}>
                {product.variations.some(v => v.color) && (
                  <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">{color}</h3>
                )}
                <div className="grid grid-cols-1 gap-2">
                  {variations.map((variation) => {
                    const isSelected = selectedVariation?.id === variation.id;
                    const isOutOfStock = variation.stock === 0;
                    
                    return (
                      <button
                        key={variation.id}
                        onClick={() => !isOutOfStock && setSelectedVariation(variation)}
                        disabled={isOutOfStock}
                        className={`p-4 rounded-xl border transition-all text-left ${
                          isSelected
                            ? 'bg-[#3B82F6]/10 border-[#3B82F6]'
                            : isOutOfStock
                            ? 'bg-[#111827] border-[#374151] opacity-50'
                            : 'bg-[#111827] border-[#374151] hover:border-[#3B82F6]'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-white">
                                {formatVariationLabel(variation)}
                              </h4>
                              {isSelected && (
                                <Check size={16} className="text-[#3B82F6]" />
                              )}
                            </div>
                            <p className="text-xs text-[#6B7280] mb-2">SKU: {variation.sku}</p>
                            
                            <div className="grid grid-cols-3 gap-3 text-sm">
                              <div>
                                <p className="text-xs text-[#6B7280]">Retail</p>
                                <p className="font-semibold text-white">
                                  Rs. {variation.retailPrice.toLocaleString()}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-[#6B7280]">Stock</p>
                                <p className={`font-semibold ${
                                  variation.stock === 0 
                                    ? 'text-[#EF4444]' 
                                    : variation.stock <= 2 
                                    ? 'text-[#F59E0B]' 
                                    : 'text-[#10B981]'
                                }`}>
                                  {variation.stock} {product.unit}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-[#6B7280]">Cost</p>
                                <p className="font-semibold text-white">
                                  Rs. {variation.costPrice.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {isOutOfStock && (
                          <div className="mt-2 text-xs text-[#EF4444] font-medium">
                            Out of Stock
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#374151] sticky bottom-0 bg-[#1F2937]">
          {selectedVariation ? (
            <div className="space-y-3">
              <div className="bg-[#111827] rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#9CA3AF]">Selected:</span>
                  <span className="font-semibold text-white">
                    {formatVariationLabel(selectedVariation)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-[#9CA3AF]">Price:</span>
                  <span className="font-bold text-[#10B981]">
                    Rs. {selectedVariation.retailPrice.toLocaleString()}
                  </span>
                </div>
              </div>
              <button
                onClick={handleSelect}
                className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg font-semibold"
              >
                Add to Cart
              </button>
            </div>
          ) : (
            <button
              disabled
              className="w-full h-12 bg-[#374151] text-[#6B7280] rounded-lg font-semibold cursor-not-allowed"
            >
              Select a variation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Compact Variation Display (for cart/order items)
interface VariationBadgeProps {
  variation: ProductVariation;
  product?: ProductWithVariations;
}

export function VariationBadge({ variation, product }: VariationBadgeProps) {
  return (
    <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded text-xs text-[#3B82F6]">
      <Package size={12} />
      <span>{formatVariationLabel(variation)}</span>
    </div>
  );
}
