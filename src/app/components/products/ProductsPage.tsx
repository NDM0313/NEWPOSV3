import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Search, Filter, Download, Upload, Package, DollarSign, AlertCircle, 
  MoreVertical, Eye, Edit, Trash2, FileText, X, ShoppingCart, Tag, Building2, Columns3,
  CheckCircle, TrendingDown, AlertTriangle, ImageIcon, Box, Check, Loader2,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/app/components/ui/dropdown-menu";
import { cn, formatDecimal } from "@/app/components/ui/utils";
import { useNavigation } from '@/app/context/NavigationContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useSales } from '@/app/context/SalesContext';
import { usePurchases } from '@/app/context/PurchaseContext';
import { productService } from '@/app/services/productService';
import { inventoryService } from '@/app/services/inventoryService';
import { unitService } from '@/app/services/unitService';
import { Pagination } from '@/app/components/ui/pagination';
import { ImportProductsModal } from './ImportProductsModal';
import { CustomSelect } from '@/app/components/ui/custom-select';
import { ListToolbar } from '@/app/components/ui/list-toolbar';
import { ProductStockHistoryDrawer } from './ProductStockHistoryDrawer';
import { ViewProductDetailsDrawer } from './ViewProductDetailsDrawer';
import { ProductImage } from './ProductImage';
import { AdjustPriceDialog } from './AdjustPriceDialog';
import { AdjustStockDialog } from './AdjustStockDialog';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogTitle } from "@/app/components/ui/dialog";

type ProductType = 'simple' | 'variable' | 'combo';
type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock';

interface Product {
  id: number; // Display ID (index-based for UI compatibility)
  uuid: string; // Actual Supabase UUID for database operations
  sku: string;
  name: string;
  image?: string;
  image_urls?: string[];
  branch: string;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  type: ProductType;
  category: string;
  brand: string;
  status: 'active' | 'inactive';
  lowStockThreshold: number;
}

export const ProductsPage = () => {
  const { openDrawer } = useNavigation();
  const { companyId } = useSupabase();
  const { sales } = useSales();
  const { purchases } = usePurchases();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const loadProducts = useCallback(async () => {
    if (!companyId) return;
    
    try {
      setLoading(true);
      const [data, overviewRows, unitsData] = await Promise.all([
        productService.getAllProducts(companyId),
        inventoryService.getInventoryOverview(companyId, null),
        unitService.getAll(companyId).catch(() => []),
      ]);
      const stockByProductId: Record<string, number> = {};
      overviewRows.forEach((row) => { stockByProductId[row.productId] = row.stock; });
      const unitLabelById: Record<string, string> = {};
      (unitsData || []).forEach((u: { id: string; name?: string; short_code?: string }) => {
        unitLabelById[u.id] = u.name || u.short_code || 'Piece';
      });

      // Convert Supabase format to app format; stock from inventory overview (stock_movements) when available
      const convertedProducts: Product[] = data.map((p: any, index: number) => ({
        id: index + 1, // Use index-based ID for compatibility with existing UI
        uuid: p.id, // Store actual Supabase UUID for database operations
        sku: p.sku || '',
        name: p.name || '',
        image: (Array.isArray(p.image_urls) && p.image_urls[0]) ? p.image_urls[0] : (p.thumbnail || undefined),
        image_urls: Array.isArray(p.image_urls) ? p.image_urls : [],
        branch: p.branch_name || 'Main Branch (HQ)',
        unit: (p.unit_id && unitLabelById[p.unit_id]) ? unitLabelById[p.unit_id] : 'Piece',
        purchasePrice: p.cost_price || 0,
        sellingPrice: p.retail_price || 0,
        stock: stockByProductId[p.id] ?? p.current_stock ?? 0,
        type: p.is_combo_product ? 'combo' : (p.has_variations ? 'variable' : 'simple'),
        category: p.category?.name || 'Uncategorized',
        brand: p.brand || '',
        status: p.is_active ? 'active' : 'inactive',
        lowStockThreshold: p.min_stock || 0,
      }));
      
      setProducts(convertedProducts);
    } catch (error: any) {
      console.error('[PRODUCTS PAGE] Error loading products:', error);
      toast.error('Failed to load products: ' + (error.message || 'Unknown error'));
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Load products from Supabase
  useEffect(() => {
    if (companyId) {
      loadProducts();
    } else {
      setLoading(false);
    }
  }, [companyId, loadProducts]);

  // Refresh list when a product is added/updated from GlobalDrawer (no full page reload)
  useEffect(() => {
    const onProductsUpdated = () => loadProducts();
    window.addEventListener('products-updated', onProductsUpdated);
    return () => window.removeEventListener('products-updated', onProductsUpdated);
  }, [loadProducts]);
  
  // 🎯 NEW: Action States
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [stockHistoryOpen, setStockHistoryOpen] = useState(false);
  const [adjustPriceOpen, setAdjustPriceOpen] = useState(false);
  const [adjustStockOpen, setAdjustStockOpen] = useState(false);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imagePreviewName, setImagePreviewName] = useState<string>('');
  
  // Filter states
  const [branchFilter, setBranchFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ProductType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | StockStatus>('all');
  
  // 🎯 NEW: Action Handlers
  const handleAction = (product: Product, action: string) => {
    setSelectedProduct(product);
    
    switch(action) {
      case 'view':
        setViewDetailsOpen(true);
        break;
      case 'edit':
        openDrawer('edit-product', undefined, { product });
        break;
      case 'stock-history':
        setStockHistoryOpen(true);
        break;
      case 'adjust-price':
        setAdjustPriceOpen(true);
        break;
      case 'adjust-stock':
        setAdjustStockOpen(true);
        break;
      case 'delete':
        setDeleteAlertOpen(true);
        break;
      default:
        console.log('Action:', action, product);
    }
  };
  
  const handleDelete = async () => {
    if (!selectedProduct || !selectedProduct.uuid) {
      toast.error('Product ID not found');
      return;
    }
    
    try {
      await productService.deleteProduct(selectedProduct.uuid);
      toast.success('Product deleted successfully');
      setDeleteAlertOpen(false);
      setSelectedProduct(null);
      // Reload products from database
      await loadProducts();
    } catch (error: any) {
      console.error('[PRODUCTS PAGE] Error deleting product:', error);
      toast.error('Failed to delete product: ' + (error.message || 'Unknown error'));
    }
  };

  // Get stock status
  const getStockStatus = (product: Product): StockStatus => {
    if (product.stock === 0) return 'out-of-stock';
    if (product.stock <= product.lowStockThreshold) return 'low-stock';
    return 'in-stock';
  };

  // Filtered products (TASK 1 FIX - "All" means no filter)
  const filteredProducts = useMemo(() => {
    // TASK 1 FIX - If no products loaded, return empty array
    if (products.length === 0) return [];
    
    return products.filter(product => {
      // Search filter (only apply if search term exists)
      if (searchTerm && searchTerm.trim()) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = 
          product.name.toLowerCase().includes(search) ||
          product.sku.toLowerCase().includes(search) ||
          product.category.toLowerCase().includes(search) ||
          product.brand.toLowerCase().includes(search) ||
          product.branch.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Branch filter (TASK 1 FIX - "all" means no filter)
      if (branchFilter !== 'all' && product.branch !== branchFilter) return false;
      
      // Category filter (TASK 1 FIX - "all" means no filter)
      if (categoryFilter !== 'all' && product.category !== categoryFilter) return false;
      
      // Brand filter (TASK 1 FIX - "all" means no filter)
      if (brandFilter !== 'all' && product.brand !== brandFilter) return false;
      
      // Type filter (TASK 1 FIX - "all" means no filter)
      if (typeFilter !== 'all' && product.type !== typeFilter) return false;
      
      // Status filter (TASK 1 FIX - "all" means no filter)
      if (statusFilter !== 'all' && product.status !== statusFilter) return false;
      
      // Stock status filter (TASK 1 FIX - "all" means no filter)
      if (stockStatusFilter !== 'all' && getStockStatus(product) !== stockStatusFilter) return false;
      
      return true;
    });
  }, [products, searchTerm, branchFilter, categoryFilter, brandFilter, typeFilter, statusFilter, stockStatusFilter]);

  // Calculate summary
  const summary = useMemo(() => {
    return {
      totalProducts: products.length,
      totalValue: products.reduce((sum, p) => sum + (p.stock * p.sellingPrice), 0),
      lowStock: products.filter(p => getStockStatus(p) === 'low-stock').length,
      outOfStock: products.filter(p => getStockStatus(p) === 'out-of-stock').length,
    };
  }, [products]);

  const clearAllFilters = () => {
    setBranchFilter('all');
    setCategoryFilter('all');
    setBrandFilter('all');
    setTypeFilter('all');
    setStatusFilter('all');
    setStockStatusFilter('all');
  };

  const activeFilterCount = [
    branchFilter !== 'all',
    categoryFilter !== 'all',
    brandFilter !== 'all',
    typeFilter !== 'all',
    statusFilter !== 'all',
    stockStatusFilter !== 'all',
  ].filter(Boolean).length;

  const getStockStatusBadge = (product: Product) => {
    const status = getStockStatus(product);
    if (status === 'out-of-stock') {
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs font-medium gap-1 h-5 px-2">
          <AlertTriangle size={12} />
          Out
        </Badge>
      );
    }
    if (status === 'low-stock') {
      return (
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs font-medium gap-1 h-5 px-2">
          <TrendingDown size={12} />
          Low
        </Badge>
      );
    }
    return (
      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs font-medium gap-1 h-5 px-2">
        <CheckCircle size={12} />
        OK
      </Badge>
    );
  };

  // Margin = Selling price − Purchase price (from backend: retail_price − cost_price)
  const getMargin = (product: Product) => {
    const margin = product.sellingPrice - product.purchasePrice;
    const marginPercent = product.purchasePrice > 0
      ? ((margin / product.purchasePrice) * 100).toFixed(1)
      : '0';
    return { margin, marginPercent };
  };

  // Sort state: default SKU descending (latest first)
  type SortKey = keyof Pick<Product, 'sku' | 'name' | 'branch' | 'unit' | 'purchasePrice' | 'sellingPrice' | 'stock' | 'type' | 'category'> | 'margin';
  const [sortKey, setSortKey] = useState<SortKey>('sku');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const getSortValue = (product: Product, key: SortKey): string | number => {
    switch (key) {
      case 'sku': return product.sku ?? '';
      case 'name': return product.name ?? '';
      case 'branch': return product.branch ?? '';
      case 'unit': return product.unit ?? '';
      case 'purchasePrice': return product.purchasePrice;
      case 'sellingPrice': return product.sellingPrice;
      case 'margin': return product.sellingPrice - product.purchasePrice;
      case 'stock': return product.stock;
      case 'type': return product.type ?? '';
      case 'category': return product.category ?? '';
      default: return '';
    }
  };

  const sortedProducts = useMemo(() => {
    const sorted = [...filteredProducts].sort((a, b) => {
      const va = getSortValue(a, sortKey);
      const vb = getSortValue(b, sortKey);
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredProducts, sortKey, sortDir]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Paginated products (from sorted list)
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedProducts.slice(startIndex, endIndex);
  }, [sortedProducts, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedProducts.length / pageSize);

  const columnKeyToSortKey = (key: string): SortKey | null => {
    const map: Record<string, SortKey> = {
      sku: 'sku', name: 'name', branch: 'branch', unit: 'unit',
      purchase: 'purchasePrice', selling: 'sellingPrice', margin: 'margin',
      stock: 'stock', type: 'type', category: 'category',
    };
    return map[key] ?? null;
  };
  const sortKeyToColumnKey = (k: SortKey): string => {
    const map: Record<SortKey, string> = {
      sku: 'sku', name: 'name', branch: 'branch', unit: 'unit',
      purchasePrice: 'purchase', sellingPrice: 'selling', margin: 'margin',
      stock: 'stock', type: 'type', category: 'category',
    };
    return map[k] ?? 'sku';
  };

  const handleSort = (columnKey: string) => {
    const key = columnKeyToSortKey(columnKey);
    if (key == null) return;
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setCurrentPage(1);
  };

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, branchFilter, categoryFilter, brandFilter, typeFilter, statusFilter, stockStatusFilter]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const [importModalOpen, setImportModalOpen] = useState(false);

  // Column Visibility State
  const [columnVisibilityOpen, setColumnVisibilityOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    sku: true,
    image: true,
    name: true,
    branch: true,
    unit: true,
    purchase: true,
    selling: true,
    margin: true,
    stock: true,
    type: true,
    category: true,
  });

  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
  };

  const [columnOrder, setColumnOrder] = useState([
    'sku', 'image', 'name', 'branch', 'unit', 'purchase', 'selling', 'margin', 'stock', 'type', 'category',
  ]);

  const columnLabels: Record<string, string> = {
    sku: 'SKU',
    image: 'Image',
    name: 'Product Name',
    branch: 'Branch',
    unit: 'Unit',
    purchase: 'Purchase Price',
    selling: 'Selling Price',
    margin: 'Margin',
    stock: 'Stock Status',
    type: 'Type',
    category: 'Category',
  };
  const columns = columnOrder.map(key => ({ key, label: columnLabels[key] || key }));

  const moveColumnUp = (key: string) => {
    const index = columnOrder.indexOf(key);
    if (index > 0) {
      const newOrder = [...columnOrder];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      setColumnOrder(newOrder);
    }
  };

  const moveColumnDown = (key: string) => {
    const index = columnOrder.indexOf(key);
    if (index < columnOrder.length - 1) {
      const newOrder = [...columnOrder];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      setColumnOrder(newOrder);
    }
  };

  const getColumnWidth = (key: string): string => {
    const widths: Record<string, string> = {
      sku: '80px', image: '60px', name: '1fr', branch: '140px', unit: '80px',
      purchase: '110px', selling: '110px', margin: '100px', stock: '100px',
      type: '120px', category: '120px',
    };
    return widths[key] || '100px';
  };

  const gridTemplateColumns = useMemo(() => {
    const parts = columnOrder
      .filter(key => visibleColumns[key as keyof typeof visibleColumns])
      .map(key => getColumnWidth(key));
    return `${parts.join(' ')} 60px`.trim();
  }, [columnOrder, visibleColumns]);

  const renderProductCell = (product: Product, key: string): React.ReactNode => {
    switch (key) {
      case 'sku':
        return <div className="text-sm text-blue-400 font-mono">{product.sku}</div>;
      case 'image':
        return (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => {
                if (product.image) {
                  setImagePreviewUrl(product.image);
                  setImagePreviewName(product.name);
                  setImagePreviewOpen(true);
                }
              }}
              className={cn(
                'w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center overflow-hidden shrink-0',
                product.image && 'cursor-pointer hover:ring-2 hover:ring-blue-500/50 transition-shadow'
              )}
            >
              {product.image ? (
                <ProductImage src={product.image} alt="" className="w-full h-full object-cover pointer-events-none" />
              ) : (
                <ImageIcon size={16} className="text-gray-600" />
              )}
            </button>
          </div>
        );
      case 'name':
        return (
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate leading-[1.3]">{product.name}</div>
            <div className="text-xs text-gray-500 leading-[1.3] mt-0.5">{product.brand}</div>
          </div>
        );
      case 'branch':
        return <div className="text-xs text-gray-400 truncate">{product.branch}</div>;
      case 'unit':
        return <div className="text-xs text-gray-400">{product.unit}</div>;
      case 'purchase':
        return (
          <div className="text-right">
            <div className="text-sm font-medium text-gray-300 tabular-nums">${product.purchasePrice.toLocaleString()}</div>
          </div>
        );
      case 'selling':
        return (
          <div className="text-right">
            <div className="text-sm font-semibold text-white tabular-nums">${product.sellingPrice.toLocaleString()}</div>
          </div>
        );
      case 'margin': {
        const { margin, marginPercent } = getMargin(product);
        return (
          <div className="text-right">
            <div className="text-sm font-semibold text-green-400 tabular-nums">+{marginPercent}%</div>
            <div className="text-[10px] text-gray-500 tabular-nums" title="Margin = Selling − Purchase (from product cost & retail price)">Margin ${margin.toLocaleString()}</div>
          </div>
        );
      }
      case 'stock':
        return (
          <div className="flex flex-col items-center gap-1">
            <div className={cn(
              'text-sm font-bold tabular-nums',
              product.stock === 0 && 'text-red-400',
              product.stock > 0 && product.stock <= product.lowStockThreshold && 'text-yellow-400',
              product.stock > product.lowStockThreshold && 'text-white'
            )}>
              {formatDecimal(product.stock)}
            </div>
            {getStockStatusBadge(product)}
          </div>
        );
      case 'type':
        return (
          <Badge className={cn(
            'text-xs font-medium capitalize w-fit px-2 py-0.5 h-5',
            product.type === 'simple' && 'bg-gray-500/20 text-gray-400 border-gray-500/30',
            product.type === 'variable' && 'bg-purple-500/20 text-purple-400 border-purple-500/30',
            product.type === 'combo' && 'bg-amber-500/20 text-amber-400 border-amber-500/30'
          )}>
            {product.type}
          </Badge>
        );
      case 'category':
        return <div className="text-xs text-gray-400 truncate">{product.category}</div>;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#0B0F19]">
      {/* Page Header - Fixed */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Products</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage your inventory across all branches</p>
          </div>
          <Button 
            onClick={() => openDrawer('addProduct')}
            className="bg-blue-600 hover:bg-blue-500 text-white h-10 gap-2"
          >
            <Package size={16} />
            Add Product
          </Button>
        </div>
      </div>

      {/* Summary Cards - Fixed */}
      <div className="shrink-0 px-6 py-4 bg-[#0F1419] border-b border-gray-800">
        <div className="grid grid-cols-4 gap-4">
          {/* Total Products */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Products</p>
                <p className="text-2xl font-bold text-white mt-1">{summary.totalProducts}</p>
                <p className="text-xs text-gray-500 mt-1">Active SKUs</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Package size={24} className="text-blue-500" />
              </div>
            </div>
          </div>

          {/* Total Value */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Value</p>
                <p className="text-2xl font-bold text-green-400 mt-1">${summary.totalValue.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Inventory worth</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <DollarSign size={24} className="text-green-500" />
              </div>
            </div>
          </div>

          {/* Low Stock */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Low Stock</p>
                <p className="text-2xl font-bold text-yellow-400 mt-1">{summary.lowStock}</p>
                <p className="text-xs text-gray-500 mt-1">Need reorder</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <TrendingDown size={24} className="text-yellow-500" />
              </div>
            </div>
          </div>

          {/* Out of Stock */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Out of Stock</p>
                <p className="text-2xl font-bold text-red-400 mt-1">{summary.outOfStock}</p>
                <p className="text-xs text-gray-500 mt-1">Urgent action</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle size={24} className="text-red-500" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Actions Bar - Fixed */}
      <div className="shrink-0 px-6 py-3 bg-[#0B0F19] border-b border-gray-800">
        <ListToolbar
          search={{
            value: searchTerm,
            onChange: setSearchTerm,
            placeholder: "Search by name, SKU, category, brand or branch..."
          }}
          rowsSelector={{
            value: pageSize,
            onChange: handlePageSizeChange,
            totalItems: filteredProducts.length
          }}
          columnsManager={{
            columns,
            visibleColumns,
            onToggle: toggleColumn,
            onShowAll: () => {
              const allVisible = Object.keys(visibleColumns).reduce((acc, key) => {
                acc[key as keyof typeof visibleColumns] = true;
                return acc;
              }, {} as typeof visibleColumns);
              setVisibleColumns(allVisible);
            },
            onMoveUp: moveColumnUp,
            onMoveDown: moveColumnDown,
          }}
          filter={{
            isOpen: filterOpen,
            onToggle: () => setFilterOpen(!filterOpen),
            activeCount: activeFilterCount,
            renderPanel: () => (
              <div className="absolute right-0 top-12 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-4 z-50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">Advanced Filters</h3>
                  <button
                    onClick={clearAllFilters}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Clear All
                  </button>
                </div>

                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                  {/* Branch Filter */}
                  <div>
                    <label className="text-xs text-gray-400 mb-2 block font-medium">Branch</label>
                    <div className="space-y-2">
                      {[
                        { value: 'all', label: 'All Branches' },
                        { value: 'Main Branch (HQ)', label: 'Main Branch (HQ)' },
                        { value: 'Mall Outlet', label: 'Mall Outlet' },
                        { value: 'Warehouse', label: 'Warehouse' },
                      ].map(opt => (
                        <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="branch"
                            checked={branchFilter === opt.value}
                            onChange={() => setBranchFilter(opt.value)}
                            className="w-4 h-4 bg-gray-950 border-gray-700"
                          />
                          <span className="text-sm text-gray-300">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Category Filter */}
                  <div>
                    <label className="text-xs text-gray-400 mb-2 block font-medium">Category</label>
                    <div className="space-y-2">
                      {[
                        { value: 'all', label: 'All Categories' },
                        { value: 'Bridal', label: 'Bridal' },
                        { value: 'Party Wear', label: 'Party Wear' },
                        { value: 'Casual', label: 'Casual' },
                        { value: 'Formal', label: 'Formal' },
                        { value: 'Accessories', label: 'Accessories' },
                        { value: 'Raw Material', label: 'Raw Material' },
                      ].map(opt => (
                        <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="category"
                            checked={categoryFilter === opt.value}
                            onChange={() => setCategoryFilter(opt.value)}
                            className="w-4 h-4 bg-gray-950 border-gray-700"
                          />
                          <span className="text-sm text-gray-300">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Brand Filter */}
                  <div>
                    <label className="text-xs text-gray-400 mb-2 block font-medium">Brand</label>
                    <div className="space-y-2">
                      {[
                        { value: 'all', label: 'All Brands' },
                        { value: 'Din Collection', label: 'Din Collection' },
                        { value: 'Sapphire', label: 'Sapphire' },
                        { value: 'ChenOne', label: 'ChenOne' },
                        { value: 'Khaadi', label: 'Khaadi' },
                        { value: 'Bonanza', label: 'Bonanza' },
                        { value: 'Local', label: 'Local' },
                      ].map(opt => (
                        <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="brand"
                            checked={brandFilter === opt.value}
                            onChange={() => setBrandFilter(opt.value)}
                            className="w-4 h-4 bg-gray-950 border-gray-700"
                          />
                          <span className="text-sm text-gray-300">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Product Type Filter */}
                  <div>
                    <label className="text-xs text-gray-400 mb-2 block font-medium">Product Type</label>
                    <div className="space-y-2">
                      {[
                        { value: 'all', label: 'All Types' },
                        { value: 'simple', label: 'Simple Product' },
                        { value: 'variable', label: 'Variable Product' },
                        { value: 'combo', label: 'Combo Product' },
                      ].map(opt => (
                        <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="type"
                            checked={typeFilter === opt.value}
                            onChange={() => setTypeFilter(opt.value as any)}
                            className="w-4 h-4 bg-gray-950 border-gray-700"
                          />
                          <span className="text-sm text-gray-300">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Stock Status Filter */}
                  <div>
                    <label className="text-xs text-gray-400 mb-2 block font-medium">Stock Status</label>
                    <div className="space-y-2">
                      {[
                        { value: 'all', label: 'All Status' },
                        { value: 'in-stock', label: 'In Stock' },
                        { value: 'low-stock', label: 'Low Stock' },
                        { value: 'out-of-stock', label: 'Out of Stock' },
                      ].map(opt => (
                        <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="stockStatus"
                            checked={stockStatusFilter === opt.value}
                            onChange={() => setStockStatusFilter(opt.value as any)}
                            className="w-4 h-4 bg-gray-950 border-gray-700"
                          />
                          <span className="text-sm text-gray-300">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Status Filter */}
                  <div>
                    <label className="text-xs text-gray-400 mb-2 block font-medium">Status</label>
                    <div className="space-y-2">
                      {[
                        { value: 'all', label: 'All Status' },
                        { value: 'active', label: 'Active' },
                        { value: 'inactive', label: 'Inactive' },
                      ].map(opt => (
                        <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="status"
                            checked={statusFilter === opt.value}
                            onChange={() => setStatusFilter(opt.value as any)}
                            className="w-4 h-4 bg-gray-950 border-gray-700"
                          />
                          <span className="text-sm text-gray-300">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          }}
          importConfig={{
            onImport: () => setImportModalOpen(true)
          }}
          exportConfig={{
            onExportCSV: () => console.log('Export CSV'),
            onExportExcel: () => console.log('Export Excel'),
            onExportPDF: () => console.log('Export PDF')
          }}
        />
      </div>

      {/* Products Table - Scrollable */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          {/* Wrapper for horizontal scroll */}
          <div className="overflow-x-auto">
            <div className="min-w-[1400px]">
              {/* Table Header - full-width; order from Columns dropdown (Move Up/Down) */}
              <div className="sticky top-0 bg-gray-950/95 backdrop-blur-sm z-10 border-b border-gray-800 min-w-[1400px] w-max">
                <div className="grid gap-3 px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  style={{ gridTemplateColumns: gridTemplateColumns }}
                >
                  {columnOrder.map(key => {
                    if (!visibleColumns[key as keyof typeof visibleColumns]) return null;
                    const align = (key === 'image' || key === 'stock') ? 'text-center' : (key === 'purchase' || key === 'selling' || key === 'margin') ? 'text-right' : 'text-left';
                    const isSortable = columnKeyToSortKey(key) != null;
                    const isActive = sortKeyToColumnKey(sortKey) === key;
                    return (
                      <div
                        key={key}
                        className={cn(align, isSortable && 'cursor-pointer select-none hover:text-gray-300 flex items-center gap-0.5')}
                        onClick={() => isSortable && handleSort(key)}
                      >
                        {columnLabels[key]}
                        {isSortable && isActive && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                      </div>
                    );
                  })}
                  <div className="text-center">Actions</div>
                </div>
              </div>

              {/* Table Body - w-max so row lines span full table width */}
              <div className="min-w-[1400px] w-max">
                {loading ? (
                  <div className="py-12 text-center">
                    <Loader2 size={48} className="mx-auto text-blue-500 mb-3 animate-spin" />
                    <p className="text-gray-400 text-sm">Loading products...</p>
                  </div>
                ) : products.length === 0 ? (
                  <div className="py-12 text-center">
                    <Package size={48} className="mx-auto text-gray-600 mb-3" />
                    <p className="text-gray-400 text-sm">No products available</p>
                    <p className="text-gray-600 text-xs mt-1">Add your first product to get started</p>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="py-12 text-center">
                    <Package size={48} className="mx-auto text-gray-600 mb-3" />
                    <p className="text-gray-400 text-sm">No products match your filters</p>
                    <p className="text-gray-600 text-xs mt-1">Try adjusting your search or filters</p>
                    <Button 
                      onClick={clearAllFilters}
                      variant="outline"
                      className="mt-4 text-xs"
                    >
                      Clear All Filters
                    </Button>
                  </div>
                ) : paginatedProducts.length === 0 ? (
                  <div className="py-12 text-center">
                    <Package size={48} className="mx-auto text-gray-600 mb-3" />
                    <p className="text-gray-400 text-sm">No products on this page</p>
                    <p className="text-gray-600 text-xs mt-1">Go to page 1</p>
                  </div>
                ) : (
                  paginatedProducts.map((product) => (
                      <div
                        key={product.id}
                        onMouseEnter={() => setHoveredRow(product.id)}
                        onMouseLeave={() => setHoveredRow(null)}
                        className="grid gap-3 px-4 h-16 min-w-[1400px] w-max hover:bg-gray-800/30 transition-colors items-center border-b border-gray-800 last:border-b-0"
                        style={{ gridTemplateColumns: gridTemplateColumns }}
                      >
                        {columnOrder.map(key => {
                          if (!visibleColumns[key as keyof typeof visibleColumns]) return null;
                          return <div key={key}>{renderProductCell(product, key)}</div>;
                        })}
                        {/* Actions */}
                        <div className="flex justify-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button 
                                className={cn(
                                  "w-8 h-8 rounded-lg bg-gray-800/50 hover:bg-gray-700 transition-all flex items-center justify-center text-gray-400 hover:text-white",
                                  hoveredRow === product.id ? "opacity-100" : "opacity-0"
                                )}
                              >
                                <MoreVertical size={16} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700 text-white w-52">
                              <DropdownMenuItem 
                                onClick={() => handleAction(product, 'view')}
                                className="hover:bg-gray-800 cursor-pointer"
                              >
                                <Eye size={14} className="mr-2 text-blue-400" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleAction(product, 'edit')}
                                className="hover:bg-gray-800 cursor-pointer"
                              >
                                <Edit size={14} className="mr-2 text-green-400" />
                                Edit Product
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleAction(product, 'stock-history')}
                                className="hover:bg-gray-800 cursor-pointer"
                              >
                                <FileText size={14} className="mr-2 text-purple-400" />
                                Stock History
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleAction(product, 'adjust-price')}
                                className="hover:bg-gray-800 cursor-pointer"
                              >
                                <Tag size={14} className="mr-2 text-yellow-400" />
                                Adjust Price
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-gray-700" />
                              <DropdownMenuItem 
                                onClick={() => handleAction(product, 'adjust-stock')}
                                className="hover:bg-gray-800 cursor-pointer"
                              >
                                <Box size={14} className="mr-2 text-orange-400" />
                                Adjust Stock
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleAction(product, 'delete')}
                                className="hover:bg-gray-800 cursor-pointer text-red-400"
                              >
                                <Trash2 size={14} className="mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pagination Footer - Fixed */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filteredProducts.length}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      {/* Import Products Modal */}
      <ImportProductsModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />

      {/* View Product Details Drawer */}
      {selectedProduct && (
        <ViewProductDetailsDrawer
          isOpen={viewDetailsOpen}
          onClose={() => {
            setViewDetailsOpen(false);
            setSelectedProduct(null);
          }}
          product={selectedProduct}
        />
      )}

      {/* Stock History Drawer */}
      {selectedProduct && (() => {
        // Calculate total sold from sales items
        const totalSold = (sales?.sales || []).reduce((total, sale) => {
          const saleItems = sale.items || [];
          return total + saleItems
            .filter(item => item.productId === selectedProduct.uuid)
            .reduce((sum, item) => sum + (item.quantity || 0), 0);
        }, 0);

        // Calculate total purchased from purchase items
        const totalPurchased = (purchases?.purchases || []).reduce((total, purchase) => {
          const purchaseItems = purchase.items || [];
          return total + purchaseItems
            .filter(item => item.productId === selectedProduct.uuid)
            .reduce((sum, item) => sum + (item.quantity || 0), 0);
        }, 0);

        return (
          <ProductStockHistoryDrawer
            isOpen={stockHistoryOpen}
            onClose={() => {
              setStockHistoryOpen(false);
              setSelectedProduct(null);
            }}
            productName={selectedProduct.name}
            productId={selectedProduct.uuid}
            productSku={selectedProduct.sku}
            totalSold={totalSold}
            totalPurchased={totalPurchased}
            currentStock={selectedProduct.stock}
          />
        );
      })()}

      {/* Adjust Price Dialog */}
      {selectedProduct && (
        <AdjustPriceDialog
          isOpen={adjustPriceOpen}
          onClose={() => {
            setAdjustPriceOpen(false);
            setSelectedProduct(null);
          }}
          product={selectedProduct}
          onSuccess={() => {
            loadProducts();
          }}
        />
      )}

      {/* Adjust Stock Dialog */}
      {selectedProduct && (
        <AdjustStockDialog
          isOpen={adjustStockOpen}
          onClose={() => {
            setAdjustStockOpen(false);
            setSelectedProduct(null);
          }}
          product={selectedProduct}
          onSuccess={() => {
            loadProducts();
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {selectedProduct && (
        <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
          <AlertDialogContent className="bg-gray-900 border-gray-700 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Product</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                Are you sure you want to delete <strong>{selectedProduct.name}</strong> (SKU: {selectedProduct.sku})? 
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Product image preview (medium size) */}
      <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl p-4">
          <DialogTitle className="text-white sr-only">{imagePreviewName}</DialogTitle>
          {imagePreviewUrl && (
            <div className="flex flex-col items-center gap-3">
              {imagePreviewName && (
                <p className="text-sm text-gray-400 truncate w-full text-center">{imagePreviewName}</p>
              )}
              <div className="max-w-full max-h-[70vh] w-full flex items-center justify-center rounded-lg overflow-hidden bg-gray-800 border border-gray-700">
                <ProductImage
                  src={imagePreviewUrl}
                  alt={imagePreviewName}
                  className="max-w-full max-h-[70vh] w-auto h-auto object-contain"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};