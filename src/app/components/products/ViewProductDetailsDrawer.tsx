import React, { useEffect, useState } from 'react';
import { X, Package, DollarSign, TrendingUp, AlertTriangle, CheckCircle, Tag, Box, Building2, FileText } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { productService } from '@/app/services/productService';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Product {
  id: number;
  uuid: string;
  sku: string;
  name: string;
  image?: string;
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
}

export const ViewProductDetailsDrawer: React.FC<ViewProductDetailsDrawerProps> = ({
  isOpen,
  onClose,
  product,
}) => {
  const [productDetails, setProductDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const drawerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && product?.uuid) {
      loadProductDetails();
    }
  }, [isOpen, product?.uuid]);

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
    return { label: 'In Stock', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' };
  };

  const stockStatus = getStockStatus();

  // Prevent body scroll and focus trap when drawer is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Focus trap: focus first focusable element in drawer
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

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end animate-in fade-in duration-200" onClick={onClose}>
      <div 
        ref={drawerRef}
        className="w-full max-w-2xl bg-[#0B0F17] h-screen shadow-2xl flex flex-col border-l border-gray-800 animate-in slide-in-from-right duration-300" 
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-800 bg-[#111827] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Package size={20} className="text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Product Details</h2>
              <p className="text-xs text-gray-400">View complete product information</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-gray-800"
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
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-20 h-20 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center shrink-0">
                      <Package size={32} className="text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-white mb-1">{product.name}</h3>
                      <p className="text-sm text-gray-400 mb-3">SKU: {product.sku}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`${stockStatus.bg} ${stockStatus.color} ${stockStatus.border} text-xs font-medium`}>
                          {stockStatus.label}
                        </Badge>
                        <Badge className={product.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-gray-500/10 text-gray-400 border-gray-500/30'}>
                          {product.status}
                        </Badge>
                        <Badge className={product.type === 'variable' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : 'bg-gray-500/10 text-gray-400 border-gray-500/30'}>
                          {product.type}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Basic Information */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                  <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <FileText size={16} />
                    Basic Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Category</p>
                      <p className="text-sm text-white font-medium">{product.category}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Brand</p>
                      <p className="text-sm text-white font-medium">{product.brand || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Branch</p>
                      <p className="text-sm text-white font-medium">{product.branch}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Unit</p>
                      <p className="text-sm text-white font-medium">{product.unit}</p>
                    </div>
                  </div>
                </div>

                {/* Pricing Information */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                  <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <DollarSign size={16} />
                    Pricing Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Purchase Price</p>
                      <p className="text-lg text-white font-semibold">${product.purchasePrice.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Selling Price</p>
                      <p className="text-lg text-green-400 font-semibold">${product.sellingPrice.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Margin</p>
                      <p className="text-lg text-blue-400 font-semibold">+{marginPercent}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Profit Amount</p>
                      <p className="text-lg text-green-400 font-semibold">${margin.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Stock Information */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                  <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <Box size={16} />
                    Stock Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Current Stock</p>
                      <p className={`text-2xl font-bold ${product.stock === 0 ? 'text-red-400' : product.stock <= product.lowStockThreshold ? 'text-yellow-400' : 'text-green-400'}`}>
                        {product.stock}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Low Stock Threshold</p>
                      <p className="text-lg text-white font-semibold">{product.lowStockThreshold}</p>
                    </div>
                  </div>
                </div>

                {/* Additional Details from Database */}
                {productDetails && (
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                    <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <FileText size={16} />
                      Additional Details
                    </h4>
                    <div className="space-y-3">
                      {productDetails.description && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Description</p>
                          <p className="text-sm text-gray-300">{productDetails.description}</p>
                        </div>
                      )}
                      {productDetails.barcode && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Barcode</p>
                          <p className="text-sm text-white font-mono">{productDetails.barcode}</p>
                        </div>
                      )}
                      {productDetails.wholesale_price && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Wholesale Price</p>
                          <p className="text-sm text-white font-semibold">${productDetails.wholesale_price.toLocaleString()}</p>
                        </div>
                      )}
                      {productDetails.rental_price_daily && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Daily Rental Price</p>
                          <p className="text-sm text-white font-semibold">${productDetails.rental_price_daily.toLocaleString()}</p>
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
        <div className="px-6 py-4 border-t border-gray-800 bg-[#111827] shrink-0 flex items-center justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
