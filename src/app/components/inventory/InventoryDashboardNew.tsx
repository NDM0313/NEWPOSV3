import React, { useState } from 'react';
import { 
  Package, TrendingDown, Clock, DollarSign, AlertTriangle, 
  BarChart3, Search, Filter, Download, Archive, Warehouse 
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";

type InventoryTab = 'overview' | 'analytics';

// Mock product data for inventory
const inventoryProducts = [
  { 
    id: '1', 
    sku: 'BRD-001', 
    name: 'Red Velvet Bridal Lehenga', 
    category: 'Bridal',
    stock: 5,
    reorderLevel: 3,
    purchasePrice: 45000,
    sellingPrice: 125000,
    lastPurchase: '2024-01-15',
    lastSale: '2024-01-20',
    daysInStock: 25,
    movement: 'Fast'
  },
  { 
    id: '2', 
    sku: 'LWN-101', 
    name: 'Embroidered Lawn Suit Vol 1', 
    category: 'Lawn',
    stock: 12,
    reorderLevel: 5,
    purchasePrice: 2500,
    sellingPrice: 5500,
    lastPurchase: '2024-01-10',
    lastSale: '2024-01-22',
    daysInStock: 18,
    movement: 'Fast'
  },
  { 
    id: '3', 
    sku: 'ACC-045', 
    name: 'Gold Clutch Premium', 
    category: 'Accessories',
    stock: 3,
    reorderLevel: 5,
    purchasePrice: 1200,
    sellingPrice: 2800,
    lastPurchase: '2023-12-20',
    lastSale: '2024-01-05',
    daysInStock: 38,
    movement: 'Slow'
  },
  { 
    id: '4', 
    sku: 'SHR-012', 
    name: 'Black Mens Sherwani', 
    category: 'Groom',
    stock: 2,
    reorderLevel: 3,
    purchasePrice: 12000,
    sellingPrice: 28000,
    lastPurchase: '2023-11-15',
    lastSale: '2023-12-28',
    daysInStock: 72,
    movement: 'Dead'
  },
  { 
    id: '5', 
    sku: 'JWL-089', 
    name: 'Pearl Necklace Set', 
    category: 'Jewelry',
    stock: 1,
    reorderLevel: 2,
    purchasePrice: 8500,
    sellingPrice: 18000,
    lastPurchase: '2023-12-01',
    lastSale: '2024-01-18',
    daysInStock: 55,
    movement: 'Slow'
  },
  { 
    id: '6', 
    sku: 'BRD-012', 
    name: 'Pink Bridal Lehenga Deluxe', 
    category: 'Bridal',
    stock: 8,
    reorderLevel: 4,
    purchasePrice: 52000,
    sellingPrice: 145000,
    lastPurchase: '2024-01-08',
    lastSale: '2024-01-21',
    daysInStock: 15,
    movement: 'Fast'
  },
  { 
    id: '7', 
    sku: 'FTW-023', 
    name: 'Bridal Heels Gold', 
    category: 'Footwear',
    stock: 4,
    reorderLevel: 3,
    purchasePrice: 3500,
    sellingPrice: 7500,
    lastPurchase: '2023-12-15',
    lastSale: '2024-01-12',
    daysInStock: 42,
    movement: 'Medium'
  },
];

export const InventoryDashboardNew = () => {
  const [activeTab, setActiveTab] = useState<InventoryTab>('overview');
  const [searchTerm, setSearchTerm] = useState('');

  const lowStockItems = inventoryProducts.filter(p => p.stock <= p.reorderLevel);
  const slowMovingItems = inventoryProducts.filter(p => p.movement === 'Slow' || p.movement === 'Dead');
  const agingItems = inventoryProducts.filter(p => p.daysInStock > 60);

  const totalStockValue = inventoryProducts.reduce((sum, p) => sum + (p.stock * p.purchasePrice), 0);
  const potentialProfit = inventoryProducts.reduce((sum, p) => sum + (p.stock * (p.sellingPrice - p.purchasePrice)), 0);

  const filteredProducts = inventoryProducts.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
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
                {filteredProducts.map((product) => (
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
                ))}
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
