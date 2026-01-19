import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Package, TrendingDown, Clock, DollarSign, AlertTriangle, 
  BarChart3, Search, Filter, Download, Archive, Warehouse, Loader2 
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";
import { useSupabase } from '../../context/SupabaseContext';
import { productService } from '../../services/productService';
import { saleService } from '../../services/saleService';
import { purchaseService } from '../../services/purchaseService';
import { toast } from 'sonner';

type InventoryTab = 'overview' | 'analytics';

interface InventoryProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  stock: number;
  reorderLevel: number;
  purchasePrice: number;
  sellingPrice: number;
  lastPurchase?: string;
  lastSale?: string;
  daysInStock: number;
  movement: 'Fast' | 'Medium' | 'Slow' | 'Dead';
}

export const InventoryDashboardNew = () => {
  const { companyId, branchId } = useSupabase();
  const [activeTab, setActiveTab] = useState<InventoryTab>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [inventoryProducts, setInventoryProducts] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Load products from Supabase
  const loadProducts = useCallback(async () => {
    if (!companyId) return;
    
    try {
      setLoading(true);
      
      // Load products
      const productsData = await productService.getAllProducts(companyId);
      
      // Load sales and purchases to calculate movement
      const [salesData, purchasesData] = await Promise.all([
        saleService.getAllSales(companyId, branchId || undefined).catch(() => []),
        purchaseService.getAllPurchases(companyId, branchId || undefined).catch(() => []),
      ]);
      
      // Convert to inventory format
      const convertedProducts: InventoryProduct[] = productsData.map((p: any) => {
        // Find last purchase date
        const lastPurchase = purchasesData
          .filter((pur: any) => pur.items?.some((item: any) => item.product_id === p.id))
          .sort((a: any, b: any) => new Date(b.purchase_date || b.created_at).getTime() - new Date(a.purchase_date || a.created_at).getTime())[0];
        
        // Find last sale date
        const lastSale = salesData
          .filter((s: any) => s.items?.some((item: any) => item.product_id === p.id))
          .sort((a: any, b: any) => new Date(b.invoice_date || b.created_at).getTime() - new Date(a.invoice_date || a.created_at).getTime())[0];
        
        // Calculate days in stock (from last purchase or creation)
        const lastPurchaseDate = lastPurchase 
          ? new Date(lastPurchase.purchase_date || lastPurchase.created_at)
          : new Date(p.created_at);
        const daysInStock = Math.floor((Date.now() - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Determine movement based on days in stock and stock level
        let movement: 'Fast' | 'Medium' | 'Slow' | 'Dead' = 'Medium';
        if (daysInStock < 30 && p.current_stock < p.min_stock * 2) {
          movement = 'Fast';
        } else if (daysInStock > 60 && p.current_stock > p.min_stock * 3) {
          movement = 'Slow';
        } else if (daysInStock > 90) {
          movement = 'Dead';
        }
        
        return {
          id: p.id,
          sku: p.sku || '',
          name: p.name || '',
          category: p.category?.name || 'Uncategorized',
          stock: p.current_stock || 0,
          reorderLevel: p.min_stock || 0,
          purchasePrice: p.cost_price || 0,
          sellingPrice: p.retail_price || 0,
          lastPurchase: lastPurchase ? (lastPurchase.purchase_date || lastPurchase.created_at) : undefined,
          lastSale: lastSale ? (lastSale.invoice_date || lastSale.created_at) : undefined,
          daysInStock,
          movement,
        };
      });
      
      setInventoryProducts(convertedProducts);
    } catch (error: any) {
      console.error('[INVENTORY DASHBOARD] Error loading products:', error);
      toast.error('Failed to load inventory: ' + (error.message || 'Unknown error'));
      setInventoryProducts([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId]);

  // Load products on mount
  useEffect(() => {
    if (companyId) {
      loadProducts();
    } else {
      setLoading(false);
    }
  }, [companyId, loadProducts]);

  const lowStockItems = useMemo(() => 
    inventoryProducts.filter(p => p.stock <= p.reorderLevel),
    [inventoryProducts]
  );
  
  const slowMovingItems = useMemo(() => 
    inventoryProducts.filter(p => p.movement === 'Slow' || p.movement === 'Dead'),
    [inventoryProducts]
  );
  
  const agingItems = useMemo(() => 
    inventoryProducts.filter(p => p.daysInStock > 60),
    [inventoryProducts]
  );

  const totalStockValue = useMemo(() => 
    inventoryProducts.reduce((sum, p) => sum + (p.stock * p.purchasePrice), 0),
    [inventoryProducts]
  );
  
  const potentialProfit = useMemo(() => 
    inventoryProducts.reduce((sum, p) => sum + (p.stock * (p.sellingPrice - p.purchasePrice)), 0),
    [inventoryProducts]
  );

  const filteredProducts = useMemo(() => 
    inventoryProducts.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [inventoryProducts, searchTerm]
  );

  const getMovementBadge = (movement: string) => {
    switch(movement) {
      case 'Fast': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Slow': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'Dead': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Warehouse size={32} className="text-blue-500" />
            Inventory Management
          </h2>
          <p className="text-gray-400 mt-1">Stock levels, movement analysis, and reorder alerts</p>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2 border-gray-700 text-gray-300">
            <Filter size={16} /> Filters
          </Button>
          <Button variant="outline" className="gap-2 border-gray-700 text-gray-300">
            <Download size={16} /> Export
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              "pb-3 text-sm font-medium transition-all relative",
              activeTab === 'overview'
                ? "text-blue-400 border-b-2 border-blue-500"
                : "text-gray-400 hover:text-white"
            )}
          >
            <Package size={16} className="inline mr-2" />
            Stock Overview
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={cn(
              "pb-3 text-sm font-medium transition-all relative",
              activeTab === 'analytics'
                ? "text-blue-400 border-b-2 border-blue-500"
                : "text-gray-400 hover:text-white"
            )}
          >
            <BarChart3 size={16} className="inline mr-2" />
            Stock Analytics
          </button>
        </div>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Key Metrics */}
          <div className="grid grid-cols-4 gap-6">
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Stock Value</p>
                  <h3 className="text-2xl font-bold text-white mt-1">
                    Rs {totalStockValue.toLocaleString()}
                  </h3>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <DollarSign className="text-blue-400" size={24} />
                </div>
              </div>
            </div>

            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Potential Profit</p>
                  <h3 className="text-2xl font-bold text-white mt-1">
                    Rs {potentialProfit.toLocaleString()}
                  </h3>
                </div>
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <TrendingDown className="text-green-400" size={24} />
                </div>
              </div>
            </div>

            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Low Stock Items</p>
                  <h3 className="text-2xl font-bold text-white mt-1">{lowStockItems.length}</h3>
                </div>
                <div className="p-3 bg-red-500/10 rounded-lg">
                  <AlertTriangle className="text-red-400" size={24} />
                </div>
              </div>
            </div>

            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total SKUs</p>
                  <h3 className="text-2xl font-bold text-white mt-1">{inventoryProducts.length}</h3>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <Package className="text-purple-400" size={24} />
                </div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
            <Input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by product name, SKU, or category..."
              className="pl-10 bg-gray-900 border-gray-700 text-white"
            />
          </div>

          {/* Stock Table */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-950/50 border-b border-gray-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Product</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">SKU</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Category</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">Stock</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">Purchase Price</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">Selling Price</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">Movement</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <Loader2 size={48} className="mx-auto text-blue-500 mb-3 animate-spin" />
                      <p className="text-gray-400 text-sm">Loading inventory...</p>
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <Package size={48} className="mx-auto text-gray-600 mb-3" />
                      <p className="text-gray-400 text-sm">No products found</p>
                      <p className="text-gray-600 text-xs mt-1">Try adjusting your search</p>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{product.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-400 font-mono text-sm">{product.sku}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-400">{product.category}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "font-bold font-mono",
                        product.stock <= product.reorderLevel ? "text-red-400" : "text-white"
                      )}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-400">
                      Rs {product.purchasePrice.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right text-white font-medium">
                      Rs {product.sellingPrice.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge className={cn("border", getMovementBadge(product.movement))}>
                        {product.movement}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {product.stock <= product.reorderLevel ? (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 border">
                          <AlertTriangle size={12} className="mr-1" />
                          Low Stock
                        </Badge>
                      ) : (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border">
                          In Stock
                        </Badge>
                      )}
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ANALYTICS TAB */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Analytics Cards */}
          <div className="grid grid-cols-3 gap-6">
            {/* Slow Moving Items */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <TrendingDown className="text-orange-400" size={20} />
                </div>
                <div>
                  <h3 className="text-white font-bold">Slow Moving Stock</h3>
                  <p className="text-sm text-gray-400">Items with low turnover</p>
                </div>
              </div>
              <div className="space-y-3">
                {slowMovingItems.slice(0, 3).map((item) => (
                  <div key={item.id} className="p-3 bg-gray-950/50 rounded-lg border border-gray-800">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-white">{item.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{item.category}</p>
                      </div>
                      <Badge className={cn("border text-xs", getMovementBadge(item.movement))}>
                        {item.daysInStock}d
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Aging Stock */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <Clock className="text-red-400" size={20} />
                </div>
                <div>
                  <h3 className="text-white font-bold">Aging Stock</h3>
                  <p className="text-sm text-gray-400">Over 60 days old</p>
                </div>
              </div>
              <div className="space-y-3">
                {agingItems.map((item) => (
                  <div key={item.id} className="p-3 bg-gray-950/50 rounded-lg border border-gray-800">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-white">{item.name}</p>
                        <p className="text-xs text-gray-500 mt-1">Last sale: {item.lastSale}</p>
                      </div>
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 border text-xs">
                        {item.daysInStock}d
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Profit Analysis */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <DollarSign className="text-green-400" size={20} />
                </div>
                <div>
                  <h3 className="text-white font-bold">Profit Analysis</h3>
                  <p className="text-sm text-gray-400">Top profit items</p>
                </div>
              </div>
              <div className="space-y-3">
                {inventoryProducts
                  .sort((a, b) => (b.sellingPrice - b.purchasePrice) * b.stock - (a.sellingPrice - a.purchasePrice) * a.stock)
                  .slice(0, 3)
                  .map((item) => {
                    const profit = (item.sellingPrice - item.purchasePrice) * item.stock;
                    return (
                      <div key={item.id} className="p-3 bg-gray-950/50 rounded-lg border border-gray-800">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-medium text-white">{item.name}</p>
                            <p className="text-xs text-gray-500 mt-1">Stock: {item.stock}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-green-400">Rs {profit.toLocaleString()}</p>
                            <p className="text-xs text-gray-500">potential</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Detailed Analytics Table */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
            <div className="p-6 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white">Detailed Stock Analytics</h3>
              <p className="text-sm text-gray-400 mt-1">Movement patterns and profitability metrics</p>
            </div>
            <table className="w-full">
              <thead className="bg-gray-950/50 border-b border-gray-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Product</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">Days in Stock</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">Movement</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">Stock Value</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">Potential Profit</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {inventoryProducts.map((product) => {
                  const stockValue = product.stock * product.purchasePrice;
                  const potentialProfit = product.stock * (product.sellingPrice - product.purchasePrice);
                  const margin = ((product.sellingPrice - product.purchasePrice) / product.sellingPrice * 100);
                  
                  return (
                    <tr key={product.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-white">{product.name}</p>
                          <p className="text-sm text-gray-500">{product.sku}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn(
                          "font-mono font-medium",
                          product.daysInStock > 60 ? "text-red-400" :
                          product.daysInStock > 30 ? "text-yellow-400" :
                          "text-green-400"
                        )}>
                          {product.daysInStock} days
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge className={cn("border", getMovementBadge(product.movement))}>
                          {product.movement}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right text-gray-400">
                        Rs {stockValue.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right text-green-400 font-medium">
                        Rs {potentialProfit.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={cn(
                          "font-bold",
                          margin > 50 ? "text-green-400" :
                          margin > 30 ? "text-yellow-400" :
                          "text-orange-400"
                        )}>
                          {margin.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
