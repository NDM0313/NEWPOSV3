import React, { useEffect, useState } from 'react';
import { X, Package, DollarSign, TrendingUp, AlertTriangle, CheckCircle, Tag, Box, Building2, FileText, History } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { productService } from '@/app/services/productService';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { ProductImage } from './ProductImage';
import { formatQty } from '@/app/utils/quantity';

interface Product {
  id: number;
  uuid: string;
  sku: string;
  name: string;
  image?: string;
  image_urls?: string[];
  branch: string;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  type: 'simple' | 'variable';
  category: string;
  brand: string;
  status: 'active' | 'inactive';
  lowStockThreshold: number;
}

interface ViewProductDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  /** When set, show "View Stock History" button that opens stock history (purchase/sale/adjustment/production). */
  onOpenStockHistory?: () => void;
}

export const ViewProductDetailsDrawer: React.FC<ViewProductDetailsDrawerProps> = ({
  isOpen,
  onClose,
  product,
  onOpenStockHistory,
}) => {
  const [productDetails, setProductDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const drawerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && product?.uuid) {
      loadProductDetails();
    }
  }, [isOpen, product?.uuid]);

  // Prevent body scroll and focus trap when drawer is open (must run before any early return)
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => {
        if (drawerRef.current) {
          const firstFocusable = drawerRef.current.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          firstFocusable?.focus();
        }
      }, 100);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const loadProductDetails = async () => {
    if (!product?.uuid) return;

    try {
      setLoading(true);
      const data = await productService.getProduct(product.uuid);
      setProductDetails(data);
    } catch (error: any) {
      console.error('[VIEW PRODUCT] Error loading details:', error);
      toast.error('Failed to load product details: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !product) return null;

  const margin = product.sellingPrice - product.purchasePrice;
  const marginPercent = product.purchasePrice > 0 
    ? ((margin / product.purchasePrice) * 100).toFixed(1) 
    : '0';

  const getStockStatus = () => {
    if (product.stock === 0) return { label: 'Out of Stock', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' };
    if (product.stock <= product.lowStockThreshold) return { label: 'Low Stock', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' };
    return { label: 'In Stock', color: 'text-[var(--erp-money-positive)]', bg: 'bg-green-500/10', border: 'border-green-500/30' };
  };

  const stockStatus = getStockStatus() ?? { label: 'In Stock', color: 'text-muted-foreground', bg: 'bg-gray-500/10', border: 'border-gray-500/30' };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--erp-overlay)] backdrop-blur-sm flex justify-end animate-in fade-in duration-200" onClick={onClose}>
      <div 
        ref={drawerRef}
        className="w-full max-w-2xl bg-background h-screen shadow-2xl flex flex-col border-l border-border animate-in slide-in-from-right duration-300" 
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border bg-background flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Package size={20} className="text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Product Details</h2>
              <p className="text-xs text-muted-foreground">View complete product information</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="text-blue-500 animate-spin" />
              </div>
            ) : (
              <>
                {/* Product Header */}
                <div className="bg-card border border-border rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-20 h-20 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0 overflow-hidden">
                      {(product.image || (product as any).image_urls?.[0] || productDetails?.image_urls?.[0]) ? (
                        <ProductImage
                          src={product.image || (product as any).image_urls?.[0] || productDetails?.image_urls?.[0]}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package size={32} className="text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-foreground mb-1">{product.name}</h3>
                      <p className="text-sm text-muted-foreground mb-3">SKU: {product.sku}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`${stockStatus?.bg ?? 'bg-gray-500/10'} ${stockStatus?.color ?? 'text-muted-foreground'} ${stockStatus?.border ?? 'border-gray-500/30'} text-xs font-medium`}>
                          {stockStatus?.label ?? 'In Stock'}
                        </Badge>
                        <Badge className={product.status === 'active' ? 'bg-green-500/10 text-[var(--erp-money-positive)] border-green-500/30' : 'bg-gray-500/10 text-muted-foreground border-gray-500/30'}>
                          {product.status}
                        </Badge>
                        <Badge className={product.type === 'variable' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : 'bg-gray-500/10 text-muted-foreground border-gray-500/30'}>
                          {product.type}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Basic Information */}
                <div className="bg-card border border-border rounded-xl p-6">
                  <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <FileText size={16} />
                    Basic Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Category</p>
                      <p className="text-sm text-foreground font-medium">{product.category}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Brand</p>
                      <p className="text-sm text-foreground font-medium">{product.brand || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Branch</p>
                      <p className="text-sm text-foreground font-medium">{product.branch}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Unit</p>
                      <p className="text-sm text-foreground font-medium">{product.unit}</p>
                    </div>
                  </div>
                </div>

                {/* Pricing Information */}
                <div className="bg-card border border-border rounded-xl p-6">
                  <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <DollarSign size={16} />
                    Pricing Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Purchase Price</p>
                      <p className="text-lg text-foreground font-semibold">${product.purchasePrice.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Selling Price</p>
                      <p className="text-lg text-[var(--erp-money-positive)] font-semibold">${product.sellingPrice.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Margin</p>
                      <p className="text-lg text-blue-400 font-semibold">+{marginPercent}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Profit Amount</p>
                      <p className="text-lg text-[var(--erp-money-positive)] font-semibold">${margin.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Stock Information */}
                <div className="bg-card border border-border rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Box size={16} />
                      Stock Information
                    </h4>
                    {onOpenStockHistory && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onOpenStockHistory}
                        className="border-gray-600 text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-1.5"
                      >
                        <History size={14} />
                        Stock History
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Current Stock</p>
                      <p className={`text-2xl font-bold tabular-nums ${product.stock === 0 ? 'text-red-400' : product.stock <= product.lowStockThreshold ? 'text-yellow-400' : 'text-[var(--erp-money-positive)]'}`}>
                        {formatQty(product.stock)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Low Stock Threshold</p>
                      <p className="text-lg text-foreground font-semibold tabular-nums">{formatQty(product.lowStockThreshold)}</p>
                    </div>
                  </div>
                </div>

                {/* Additional Details from Database */}
                {productDetails && (
                  <div className="bg-card border border-border rounded-xl p-6">
                    <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                      <FileText size={16} />
                      Additional Details
                    </h4>
                    <div className="space-y-3">
                      {productDetails.description && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Description</p>
                          <p className="text-sm text-muted-foreground">{productDetails.description}</p>
                        </div>
                      )}
                      {productDetails.barcode && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Barcode</p>
                          <p className="text-sm text-foreground font-mono">{productDetails.barcode}</p>
                        </div>
                      )}
                      {productDetails.wholesale_price && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Wholesale Price</p>
                          <p className="text-sm text-foreground font-semibold">${productDetails.wholesale_price.toLocaleString()}</p>
                        </div>
                      )}
                      {productDetails.rental_price_daily && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Daily Rental Price</p>
                          <p className="text-sm text-foreground font-semibold">${productDetails.rental_price_daily.toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-background shrink-0 flex items-center justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-muted border-border text-foreground hover:bg-accent"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
