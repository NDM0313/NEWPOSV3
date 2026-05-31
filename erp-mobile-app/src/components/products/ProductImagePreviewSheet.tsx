import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Loader2 } from 'lucide-react';
import { ProductImage } from './ProductImage';
import type { Product } from '../../api/products';
import { uploadProductImages } from '../../utils/productImageUpload';
import * as productsApi from '../../api/products';
import { MediaSourcePicker } from '../shared/MediaSourcePicker';

interface ProductImagePreviewSheetProps {
  open: boolean;
  product: Product | null;
  companyId: string | null;
  onClose: () => void;
  onUpdated: (product: Product) => void;
}

export function ProductImagePreviewSheet({
  open,
  product,
  companyId,
  onClose,
  onUpdated,
}: ProductImagePreviewSheetProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !product) return null;

  const thumb = (product.imageUrls && product.imageUrls[0]) || null;
  const hasImage = !!thumb;

  const handlePick = async (file: File | undefined) => {
    if (!file || !companyId) return;
    setBusy(true);
    setError(null);
    try {
      const urls = await uploadProductImages(companyId, product.id, [file]);
      const nextUrls = [...(product.imageUrls || []), ...urls];
      const { data, error: updErr } = await productsApi.updateProduct(companyId, product.id, {
        existingImageUrls: nextUrls,
      });
      if (updErr || !data) {
        setError(updErr || 'Could not save image');
        return;
      }
      await productsApi.invalidateProductsListCache(companyId);
      onUpdated(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const sheet = (
    <div className="fixed inset-0 z-[115] flex flex-col bg-black/90">
      <div className="flex items-center justify-between p-4 border-b border-[#374151]">
        <p className="text-white font-medium truncate flex-1 pr-2">{product.name}</p>
        <button type="button" onClick={onClose} className="p-2 text-[#9CA3AF] hover:text-white" aria-label="Close">
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center p-6 min-h-0">
        {hasImage ? (
          <ProductImage src={thumb} alt={product.name} className="max-w-full max-h-full object-contain rounded-lg" />
        ) : (
          <p className="text-[#9CA3AF] text-center text-sm">No picture for this product.</p>
        )}
      </div>
      {error ? <p className="text-sm text-red-400 text-center px-4 pb-2">{error}</p> : null}
      <div className="p-4 border-t border-[#374151] flex gap-3 bg-[#111827]">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 rounded-lg border border-[#374151] text-[#9CA3AF] font-medium"
        >
          Close
        </button>
        <MediaSourcePicker
          accept="image/*"
          disabled={busy || !companyId}
          sheetTitle="Add product picture"
          onFiles={(picked) => void handlePick(picked[0])}
          onError={(msg) => setError(msg)}
        >
          {(open) => (
        <button
          type="button"
          disabled={busy || !companyId}
          onClick={open}
          className="flex-1 py-3 rounded-lg bg-[#3B82F6] text-white font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
          {hasImage ? 'Update image' : 'Add image'}
        </button>
          )}
        </MediaSourcePicker>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return sheet;
  return createPortal(sheet, document.body);
}
