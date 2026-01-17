import React, { useState, useMemo } from 'react';
import { 
  Package, 
  Plus, 
  Filter, 
  Download, 
  Search,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Settings,
  ArrowUpDown,
  MoveHorizontal,
  Edit,
  Trash2,
  Eye
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { StockAdjustmentDrawer } from './StockAdjustmentDrawer';
import { StockTransferDrawer } from './StockTransferDrawer';

type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock';
type Unit = 'meters' | 'pieces';

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  currentStock: number;
  unit: Unit;
  costPrice: number;
  salePrice: number;
  reorderLevel: number;
  image?: string;
  location?: string;
}

export const InventoryDashboard = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([
    {
      id: '1',
      name: 'Bridal Lehenga - Red Velvet',
      sku: 'BL-RV-001',
      category: 'Bridal',
      currentStock: 15,
      unit: 'pieces',
      costPrice: 25000,
      salePrice: 45000,
      reorderLevel: 5,
      image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=100&h=100&fit=crop',
      location: 'Main Godown'
    },
    {
      id: '2',
      name: 'Silk Fabric - Royal Blue',
      sku: 'SF-RB-002',
      category: 'Fabric',
      currentStock: 45,
      unit: 'meters',
      costPrice: 800,
      salePrice: 1200,
      reorderLevel: 20,
      image: 'https://images.unsplash.com/photo-1590736969955-71cc94901144?w=100&h=100&fit=crop',
      location: 'Shop Display'
    },
    {
      id: '3',
      name: 'Party Wear Saree - Golden',
      sku: 'PS-GD-003',
      category: 'Party Wear',
      currentStock: 3,
      unit: 'pieces',
      costPrice: 15000,
      salePrice: 28000,
      reorderLevel: 5,
      image: 'https://images.unsplash.com/photo-1583391733981-5afd6f2e9b82?w=100&h=100&fit=crop',
      location: 'Main Godown'
    },
    {
      id: '4',
      name: 'Embroidery Thread - Silver',
      sku: 'ET-SV-004',
      category: 'Accessories',
      currentStock: 0,
      unit: 'pieces',
      costPrice: 500,
      salePrice: 900,
      reorderLevel: 10,
      image: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=100&h=100&fit=crop',
      location: 'Shop Display'
    },
    {
      id: '5',
      name: 'Wedding Sherwani - Cream',
      sku: 'WS-CR-005',
      category: 'Bridal',
      currentStock: 8,
      unit: 'pieces',
      costPrice: 30000,
      salePrice: 55000,
      reorderLevel: 3,
      image: 'https://images.unsplash.com/photo-1622122201714-77da0ca8e5d2?w=100&h=100&fit=crop',
      location: 'Main Godown'
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StockStatus | 'all'>('all');
  const [adjustmentDrawerOpen, setAdjustmentDrawerOpen] = useState(false);
  const [transferDrawerOpen, setTransferDrawerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);

  // Get stock status
  const getStockStatus = (item: InventoryItem): StockStatus => {
    if (item.currentStock === 0) return 'out-of-stock';
    if (item.currentStock <= item.reorderLevel) return 'low-stock';
    return 'in-stock';
  };

  // Get status badge config
  const getStatusConfig = (status: StockStatus) => {
    const configs = {
      'in-stock': { 
        label: 'In Stock', 
        style: {
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          color: 'var(--color-success)',
          borderColor: 'rgba(16, 185, 129, 0.2)'
        },
        icon: CheckCircle 
      },
      'low-stock': { 
        label: 'Low Stock', 
        style: {
          backgroundColor: 'rgba(249, 115, 22, 0.1)',
          color: 'var(--color-warning)',
          borderColor: 'rgba(249, 115, 22, 0.2)'
        },
        icon: AlertCircle 
      },
      'out-of-stock': { 
        label: 'Out of Stock', 
        style: {
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          color: 'var(--color-error)',
          borderColor: 'rgba(239, 68, 68, 0.2)'
        },
        icon: AlertCircle 
      }
    };
    return configs[status];
  };

  // Filter inventory
  const filteredInventory = useMemo(() => {
    let filtered = inventory;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => getStockStatus(item) === statusFilter);
    }

    return filtered;
  }, [inventory, searchTerm, categoryFilter, statusFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalValue = inventory.reduce((sum, item) => sum + (item.currentStock * item.costPrice), 0);
    const totalSaleValue = inventory.reduce((sum, item) => sum + (item.currentStock * item.salePrice), 0);
    const lowStockCount = inventory.filter(item => getStockStatus(item) === 'low-stock').length;
    const outOfStockCount = inventory.filter(item => getStockStatus(item) === 'out-of-stock').length;
    const totalItems = inventory.length;
    const inStockCount = inventory.filter(item => getStockStatus(item) === 'in-stock').length;

    return {
      totalValue,
      totalSaleValue,
      lowStockCount,
      outOfStockCount,
      totalItems,
      inStockCount
    };
  }, [inventory]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(inventory.map(item => item.category));
    return Array.from(cats);
  }, [inventory]);

  const handleAdjustStock = (item: InventoryItem) => {
    setSelectedProduct(item);
    setAdjustmentDrawerOpen(true);
  };

  const handleTransferStock = (item: InventoryItem) => {
    setSelectedProduct(item);
    setTransferDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Inventory Management
          </h2>
          <p 
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Track stock levels, adjust inventory, and manage transfers
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="gap-2"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-primary)',
              color: 'var(--color-text-primary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
            }}
          >
            <Filter size={16} />
            Advanced Filter
          </Button>
          <Button 
            variant="outline" 
            className="gap-2"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-primary)',
              color: 'var(--color-text-primary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
            }}
          >
            <Download size={16} />
            Export
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-6 gap-4">
        <div 
          className="border rounded-lg p-4"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border-primary)',
            borderRadius: 'var(--radius-lg)'
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <Package size={20} style={{ color: 'var(--color-primary)' }} />
            <TrendingUp size={16} style={{ color: 'var(--color-success)' }} />
          </div>
          <div 
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {stats.totalItems}
          </div>
          <div 
            className="text-xs mt-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Total Products
          </div>
        </div>

        <div 
          className="border rounded-lg p-4"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border-primary)',
            borderRadius: 'var(--radius-lg)'
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <CheckCircle size={20} style={{ color: 'var(--color-success)' }} />
          </div>
          <div 
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {stats.inStockCount}
          </div>
          <div 
            className="text-xs mt-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            In Stock
          </div>
        </div>

        <div 
          className="border rounded-lg p-4"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border-primary)',
            borderRadius: 'var(--radius-lg)'
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <AlertCircle size={20} style={{ color: 'var(--color-warning)' }} />
          </div>
          <div 
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {stats.lowStockCount}
          </div>
          <div 
            className="text-xs mt-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Low Stock
          </div>
        </div>

        <div 
          className="border rounded-lg p-4"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border-primary)',
            borderRadius: 'var(--radius-lg)'
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <AlertCircle size={20} style={{ color: 'var(--color-error)' }} />
          </div>
          <div 
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {stats.outOfStockCount}
          </div>
          <div 
            className="text-xs mt-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Out of Stock
          </div>
        </div>

        <div 
          className="border rounded-lg p-4"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border-primary)',
            borderRadius: 'var(--radius-lg)'
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <TrendingUp size={20} style={{ color: 'var(--color-wholesale)' }} />
          </div>
          <div 
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            ${(stats.totalValue / 1000).toFixed(0)}K
          </div>
          <div 
            className="text-xs mt-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Stock Value (Cost)
          </div>
        </div>

        <div 
          className="border rounded-lg p-4"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border-primary)',
            borderRadius: 'var(--radius-lg)'
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <TrendingUp size={20} style={{ color: 'var(--color-success)' }} />
          </div>
          <div 
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            ${(stats.totalSaleValue / 1000).toFixed(0)}K
          </div>
          <div 
            className="text-xs mt-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Stock Value (Sale)
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search 
            size={16} 
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-text-tertiary)' }}
          />
          <Input
            type="text"
            placeholder="Search by product name, SKU, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-primary)',
              color: 'var(--color-text-primary)'
            }}
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger 
            className="w-48"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-primary)',
              color: 'var(--color-text-primary)'
            }}
          >
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent 
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-secondary)',
              color: 'var(--color-text-primary)'
            }}
          >
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger 
            className="w-48"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-primary)',
              color: 'var(--color-text-primary)'
            }}
          >
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent 
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border-secondary)',
              color: 'var(--color-text-primary)'
            }}
          >
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="in-stock">In Stock</SelectItem>
            <SelectItem value="low-stock">Low Stock</SelectItem>
            <SelectItem value="out-of-stock">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Inventory Table */}
      <div 
        className="border rounded-xl overflow-hidden shadow-sm"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          borderColor: 'var(--color-border-primary)',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead 
              className="border-b"
              style={{
                backgroundColor: 'rgba(31, 41, 55, 0.5)',
                borderColor: 'var(--color-border-primary)'
              }}
            >
              <tr>
                <th 
                  className="px-6 py-4 font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Product
                </th>
                <th 
                  className="px-6 py-4 font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  SKU
                </th>
                <th 
                  className="px-6 py-4 font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Category
                </th>
                <th 
                  className="px-6 py-4 font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Location
                </th>
                <th 
                  className="px-6 py-4 font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Current Stock
                </th>
                <th 
                  className="px-6 py-4 font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Status
                </th>
                <th 
                  className="px-6 py-4 font-semibold text-right"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Stock Value
                </th>
                <th 
                  className="px-6 py-4 font-semibold text-center"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody 
              className="divide-y"
              style={{ borderColor: 'var(--color-border-primary)' }}
            >
              {filteredInventory.map(item => {
                const status = getStockStatus(item);
                const statusConfig = getStatusConfig(status);
                const StatusIcon = statusConfig.icon;
                const stockValue = item.currentStock * item.costPrice;

                return (
                  <tr 
                    key={item.id} 
                    className="transition-colors"
                    style={{ backgroundColor: 'transparent' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {item.image && (
                          <img 
                            src={item.image} 
                            alt={item.name}
                            className="w-12 h-12 rounded-lg object-cover border"
                            style={{
                              borderColor: 'var(--color-border-secondary)',
                              borderRadius: 'var(--radius-lg)'
                            }}
                          />
                        )}
                        <div>
                          <div 
                            className="font-medium"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {item.name}
                          </div>
                          <div 
                            className="text-xs"
                            style={{ color: 'var(--color-text-tertiary)' }}
                          >
                            Cost: ${item.costPrice.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <code 
                        className="text-xs px-2 py-1 rounded border"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          color: 'var(--color-primary)',
                          borderColor: 'var(--color-border-secondary)',
                          borderRadius: 'var(--radius-sm)'
                        }}
                      >
                        {item.sku}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <Badge 
                        style={{
                          backgroundColor: 'rgba(147, 51, 234, 0.1)',
                          color: 'var(--color-wholesale)',
                          borderColor: 'rgba(147, 51, 234, 0.2)'
                        }}
                      >
                        {item.category}
                      </Badge>
                    </td>
                    <td 
                      className="px-6 py-4"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {item.location}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span 
                          className="text-2xl font-bold"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {item.currentStock}
                        </span>
                        <span 
                          className="text-xs uppercase"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          {item.unit}
                        </span>
                      </div>
                      <div 
                        className="text-xs mt-1"
                        style={{ color: 'var(--color-text-disabled)' }}
                      >
                        Reorder at: {item.reorderLevel} {item.unit}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge 
                        className="flex items-center gap-1.5 w-fit"
                        style={statusConfig.style}
                      >
                        <StatusIcon size={12} />
                        {statusConfig.label}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div 
                        className="font-bold"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        ${stockValue.toLocaleString()}
                      </div>
                      <div 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        Sale: ${(item.currentStock * item.salePrice).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3"
                          style={{
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            borderColor: 'rgba(59, 130, 246, 0.2)',
                            color: 'var(--color-primary)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAdjustStock(item);
                          }}
                        >
                          <Settings size={14} className="mr-1" />
                          Adjust
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3"
                          style={{
                            backgroundColor: 'rgba(147, 51, 234, 0.1)',
                            borderColor: 'rgba(147, 51, 234, 0.2)',
                            color: 'var(--color-wholesale)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(147, 51, 234, 0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(147, 51, 234, 0.1)';
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTransferStock(item);
                          }}
                        >
                          <MoveHorizontal size={14} className="mr-1" />
                          Transfer
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredInventory.length === 0 && (
          <div 
            className="text-center py-12"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <Package 
              size={48} 
              className="mx-auto mb-4"
              style={{ color: 'var(--color-text-disabled)' }}
            />
            <p 
              className="text-lg"
              style={{ color: 'var(--color-text-primary)' }}
            >
              No inventory items found
            </p>
            <p 
              className="text-sm mt-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Try adjusting your filters or search term
            </p>
          </div>
        )}
      </div>

      {/* Drawers */}
      <StockAdjustmentDrawer
        open={adjustmentDrawerOpen}
        onClose={() => {
          setAdjustmentDrawerOpen(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
        onAdjust={(adjustmentData) => {
          // Update inventory
          setInventory(prev => prev.map(item => 
            item.id === selectedProduct?.id
              ? { ...item, currentStock: adjustmentData.newStock }
              : item
          ));
          setAdjustmentDrawerOpen(false);
          setSelectedProduct(null);
        }}
      />

      <StockTransferDrawer
        open={transferDrawerOpen}
        onClose={() => {
          setTransferDrawerOpen(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
        onTransfer={(transferData) => {
          // In a real app, this would update location-based stock
          // For now, we just log the transfer
          console.log('Stock transfer:', transferData);
          setTransferDrawerOpen(false);
          setSelectedProduct(null);
        }}
      />
    </div>
  );
};
