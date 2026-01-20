import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Search, Filter, Download, Upload, Package, DollarSign, AlertCircle, 
  MoreVertical, Eye, Edit, Trash2, FileText, X, ShoppingCart, Tag, Building2, Columns3,
  CheckCircle, TrendingDown, AlertTriangle, ImageIcon, Box, Check, Loader2
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
import { cn } from "@/app/components/ui/utils";
import { useNavigation } from '@/app/context/NavigationContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useSales } from '@/app/context/SalesContext';
import { usePurchases } from '@/app/context/PurchaseContext';
import { productService } from '@/app/services/productService';
import { Pagination } from '@/app/components/ui/pagination';
import { ImportProductsModal } from './ImportProductsModal';
import { CustomSelect } from '@/app/components/ui/custom-select';
import { ListToolbar } from '@/app/components/ui/list-toolbar';
import { ProductStockHistoryDrawer } from './ProductStockHistoryDrawer';
import { ViewProductDetailsDrawer } from './ViewProductDetailsDrawer';
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

type ProductType = 'simple' | 'variable';
type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock';

interface Product {
  id: number; // Display ID (index-based for UI compatibility)
  uuid: string; // Actual Supabase UUID for database operations
  sku: string;
  name: string;
  image?: string;
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
      const data = await productService.getAllProducts(companyId);
      
      // Convert Supabase format to app format
      const convertedProducts: Product[] = data.map((p: any, index: number) => ({
        id: index + 1, // Use index-based ID for compatibility with existing UI
        uuid: p.id, // Store actual Supabase UUID for database operations
        sku: p.sku || '',
        name: p.name || '',
        image: p.thumbnail || undefined,
        branch: p.branch_name || 'Main Branch (HQ)',
        unit: p.unit || 'Piece',
        purchasePrice: p.cost_price || 0,
        sellingPrice: p.retail_price || 0,
        stock: p.current_stock || 0,
        type: p.has_variations ? 'variable' : 'simple',
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
  
  // 🎯 NEW: Action States
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [stockHistoryOpen, setStockHistoryOpen] = useState(false);
  const [adjustPriceOpen, setAdjustPriceOpen] = useState(false);
  const [adjustStockOpen, setAdjustStockOpen] = useState(false);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  
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

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = 
          product.name.toLowerCase().includes(search) ||
          product.sku.toLowerCase().includes(search) ||
          product.category.toLowerCase().includes(search) ||
          product.brand.toLowerCase().includes(search) ||
          product.branch.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Branch filter
      if (branchFilter !== 'all' && product.branch !== branchFilter) return false;
      
      // Category filter
      if (categoryFilter !== 'all' && product.category !== categoryFilter) return false;
      
      // Brand filter
      if (brandFilter !== 'all' && product.brand !== brandFilter) return false;
      
      // Type filter
      if (typeFilter !== 'all' && product.type !== typeFilter) return false;
      
      // Status filter
      if (statusFilter !== 'all' && product.status !== statusFilter) return false;
      
      // Stock status filter
      if (stockStatusFilter !== 'all' && getStockStatus(product) !== stockStatusFilter) return false;
      
      return true;
    });
  }, [searchTerm, branchFilter, categoryFilter, brandFilter, typeFilter, statusFilter, stockStatusFilter]);

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

  const getMargin = (product: Product) => {
    const margin = product.sellingPrice - product.purchasePrice;
    const marginPercent = ((margin / product.purchasePrice) * 100).toFixed(1);
    return { margin, marginPercent };
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Paginated products
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredProducts.length / pageSize);

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

  const columns = [
    { key: 'sku', label: 'SKU' },
    { key: 'image', label: 'Image' },
    { key: 'name', label: 'Product Name' },
    { key: 'branch', label: 'Branch' },
    { key: 'unit', label: 'Unit' },
    { key: 'purchase', label: 'Purchase Price' },
    { key: 'selling', label: 'Selling Price' },
    { key: 'margin', label: 'Margin' },
    { key: 'stock', label: 'Stock Status' },
    { key: 'type', label: 'Type' },
    { key: 'category', label: 'Category' },
  ] as const;

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
            }
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
              {/* Table Header - Fixed within scroll container */}
              <div className="sticky top-0 bg-gray-950/95 backdrop-blur-sm z-10 border-b border-gray-800">
                <div className="grid gap-3 px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  style={{
                    gridTemplateColumns: `${visibleColumns.sku ? '80px ' : ''}${visibleColumns.image ? '60px ' : ''}${visibleColumns.name ? '1fr ' : ''}${visibleColumns.branch ? '140px ' : ''}${visibleColumns.unit ? '80px ' : ''}${visibleColumns.purchase ? '110px ' : ''}${visibleColumns.selling ? '110px ' : ''}${visibleColumns.margin ? '100px ' : ''}${visibleColumns.stock ? '100px ' : ''}${visibleColumns.type ? '120px ' : ''}${visibleColumns.category ? '120px ' : ''}60px`.trim()
                  }}
                >
                  {visibleColumns.sku && <div className="text-left">SKU</div>}
                  {visibleColumns.image && <div className="text-center">Image</div>}
                  {visibleColumns.name && <div className="text-left">Product Name</div>}
                  {visibleColumns.branch && <div className="text-left">Branch</div>}
                  {visibleColumns.unit && <div className="text-left">Unit</div>}
                  {visibleColumns.purchase && <div className="text-right">Purchase</div>}
                  {visibleColumns.selling && <div className="text-right">Selling</div>}
                  {visibleColumns.margin && <div className="text-right">Margin</div>}
                  {visibleColumns.stock && <div className="text-right">Stock</div>}
                  {visibleColumns.type && <div className="text-left">Type</div>}
                  {visibleColumns.category && <div className="text-left">Category</div>}
                  <div className="text-center">Actions</div>
                </div>
              </div>

              {/* Table Body */}
              <div>
                {loading ? (
                  <div className="py-12 text-center">
                    <Loader2 size={48} className="mx-auto text-blue-500 mb-3 animate-spin" />
                    <p className="text-gray-400 text-sm">Loading products...</p>
                  </div>
                ) : paginatedProducts.length === 0 ? (
                  <div className="py-12 text-center">
                    <Package size={48} className="mx-auto text-gray-600 mb-3" />
                    <p className="text-gray-400 text-sm">No products found</p>
                    <p className="text-gray-600 text-xs mt-1">Try adjusting your search or filters</p>
                  </div>
                ) : (
                  paginatedProducts.map((product) => {
                    const { margin, marginPercent } = getMargin(product);
                    return (
                      <div
                        key={product.id}
                        onMouseEnter={() => setHoveredRow(product.id)}
                        onMouseLeave={() => setHoveredRow(null)}
                        className="grid gap-3 px-4 h-16 hover:bg-gray-800/30 transition-colors items-center border-b border-gray-800/50 last:border-b-0"
                        style={{
                          gridTemplateColumns: `${visibleColumns.sku ? '80px ' : ''}${visibleColumns.image ? '60px ' : ''}${visibleColumns.name ? '1fr ' : ''}${visibleColumns.branch ? '140px ' : ''}${visibleColumns.unit ? '80px ' : ''}${visibleColumns.purchase ? '110px ' : ''}${visibleColumns.selling ? '110px ' : ''}${visibleColumns.margin ? '100px ' : ''}${visibleColumns.stock ? '100px ' : ''}${visibleColumns.type ? '120px ' : ''}${visibleColumns.category ? '120px ' : ''}60px`.trim()
                        }}
                      >
                        {/* SKU */}
                        {visibleColumns.sku && (
                          <div className="text-sm text-blue-400 font-mono">{product.sku}</div>
                        )}

                        {/* Image */}
                        {visibleColumns.image && (
                          <div className="flex justify-center">
                            <div className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center">
                              <ImageIcon size={16} className="text-gray-600" />
                            </div>
                          </div>
                        )}

                        {/* Product Name */}
                        {visibleColumns.name && (
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-white truncate leading-[1.3]">{product.name}</div>
                            <div className="text-xs text-gray-500 leading-[1.3] mt-0.5">{product.brand}</div>
                          </div>
                        )}

                        {/* Branch */}
                        {visibleColumns.branch && (
                          <div className="text-xs text-gray-400 truncate">{product.branch}</div>
                        )}

                        {/* Unit */}
                        {visibleColumns.unit && (
                          <div className="text-xs text-gray-400">{product.unit}</div>
                        )}

                        {/* Purchase Price */}
                        {visibleColumns.purchase && (
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-300 tabular-nums">
                              ${product.purchasePrice.toLocaleString()}
                            </div>
                          </div>
                        )}

                        {/* Selling Price */}
                        {visibleColumns.selling && (
                          <div className="text-right">
                            <div className="text-sm font-semibold text-white tabular-nums">
                              ${product.sellingPrice.toLocaleString()}
                            </div>
                          </div>
                        )}

                        {/* Margin */}
                        {visibleColumns.margin && (
                          <div className="text-right">
                            <div className="text-sm font-semibold text-green-400 tabular-nums">
                              +{marginPercent}%
                            </div>
                            <div className="text-[10px] text-gray-500 tabular-nums">
                              ${margin.toLocaleString()}
                            </div>
                          </div>
                        )}

                        {/* Stock */}
                        {visibleColumns.stock && (
                          <div className="flex flex-col items-center gap-1">
                            <div className={cn(
                              "text-sm font-bold tabular-nums",
                              product.stock === 0 && "text-red-400",
                              product.stock > 0 && product.stock <= product.lowStockThreshold && "text-yellow-400",
                              product.stock > product.lowStockThreshold && "text-white"
                            )}>
                              {product.stock}
                            </div>
                            {getStockStatusBadge(product)}
                          </div>
                        )}

                        {/* Type */}
                        {visibleColumns.type && (
                          <div>
                            <Badge className={cn(
                              "text-xs font-medium capitalize w-fit px-2 py-0.5 h-5",
                              product.type === 'simple' && "bg-gray-500/20 text-gray-400 border-gray-500/30",
                              product.type === 'variable' && "bg-purple-500/20 text-purple-400 border-purple-500/30"
                            )}>
                              {product.type}
                            </Badge>
                          </div>
                        )}

                        {/* Category */}
                        {visibleColumns.category && (
                          <div className="text-xs text-gray-400 truncate">{product.category}</div>
                        )}

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
                    );
                  })
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
        const totalSold = sales.sales.reduce((total, sale) => {
          const saleItems = sale.items || [];
          return total + saleItems
            .filter(item => item.productId === selectedProduct.uuid)
            .reduce((sum, item) => sum + (item.quantity || 0), 0);
        }, 0);

        // Calculate total purchased from purchase items
        const totalPurchased = purchases.purchases.reduce((total, purchase) => {
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
    </div>
  );
};