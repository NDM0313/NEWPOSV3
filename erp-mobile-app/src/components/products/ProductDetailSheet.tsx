import { createPortal } from 'react-dom';
import { X, Edit2 } from 'lucide-react';
import { ProductImage } from './ProductImage';
import type { Product } from '../../api/products';
import { primaryImageUrl } from '../../utils/productImageUpload';
import { formatQty } from '../../utils/quantity';

interface ProductDetailSheetProps {
  open: boolean;
  product: Product | null;
  displayStock: number;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onPhoto?: (product: Product) => void;
}

export function ProductDetailSheet({
  open,
  product,
  displayStock,
  onClose,
  onEdit,
  onPhoto,
}: ProductDetailSheetProps) {
  if (!open || !product) return null;

  const thumb = primaryImageUrl(product.imageUrls);
  const description = (product.description || '').trim();

  const sheet = (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/70 p-4">
      <div
        className="w-full max-w-md bg-[#1F2937] border border-[#374151] rounded-2xl shadow-xl max-h-[85vh] overflow-y-auto"
        role="dialog"
        aria-labelledby="product-detail-title"
      >
        <div className="flex items-center justify-between p-4 border-b border-[#374151] sticky top-0 bg-[#1F2937] z-10">
          <h2 id="product-detail-title" className="text-white font-semibold text-base truncate pr-2">
            Product details
          </h2>
          <button type="button" onClick={onClose} className="p-2 text-[#9CA3AF] hover:text-white" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <button
            type="button"
            onClick={() => onPhoto?.(product)}
            className="w-full aspect-square max-h-56 rounded-xl bg-[#111827] border border-[#374151] overflow-hidden flex items-center justify-center"
          >
            {thumb ? (
              <ProductImage
                key={thumb}
                src={thumb}
                alt={product.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-[#6B7280] text-sm">No photo</span>
            )}
          </button>

          <div>
            <p className="text-lg font-medium text-white leading-tight">{product.name}</p>
            <p className="text-xs text-[#6B7280] mt-1">
              {product.sku} · {product.category}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-[#111827] rounded-lg p-3 border border-[#374151]">
              <p className="text-[#6B7280] text-xs">Stock</p>
              <p className="text-white font-semibold mt-0.5">{formatQty(displayStock)}</p>
            </div>
            <div className="bg-[#111827] rounded-lg p-3 border border-[#374151]">
              <p className="text-[#6B7280] text-xs">Status</p>
              <p className="text-white font-medium mt-0.5 capitalize">{product.status}</p>
            </div>
            <div className="bg-[#111827] rounded-lg p-3 border border-[#374151]">
              <p className="text-[#6B7280] text-xs">Retail</p>
              <p className="text-[#10B981] font-semibold mt-0.5">Rs. {product.retailPrice.toLocaleString()}</p>
            </div>
            <div className="bg-[#111827] rounded-lg p-3 border border-[#374151]">
              <p className="text-[#6B7280] text-xs">Unit</p>
              <p className="text-white font-medium mt-0.5">{product.unit}</p>
            </div>
          </div>

          {product.barcode ? (
            <div>
              <p className="text-[#6B7280] text-xs mb-1">Barcode</p>
              <p className="text-white text-sm font-mono">{product.barcode}</p>
            </div>
          ) : null}

          <div>
            <p className="text-[#6B7280] text-xs mb-1">Description</p>
            <p className="text-[#D1D5DB] text-sm whitespace-pre-wrap">
              {description || '—'}
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-[#374151] flex gap-3 sticky bottom-0 bg-[#1F2937]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-lg border border-[#374151] text-[#9CA3AF] font-medium"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onEdit(product)}
            className="flex-1 py-3 rounded-lg bg-[#3B82F6] text-white font-medium inline-flex items-center justify-center gap-2"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return sheet;
  return createPortal(sheet, document.body);
}
