import { useState } from 'react';
import { ArrowLeft, Package, Plus, Search, Filter, Edit2, Trash2, Eye, TrendingUp, AlertCircle } from 'lucide-react';
import { User } from '../../App';
import { AddProductFlow } from './AddProductFlow';
import { toast } from 'sonner';

interface ProductsModuleProps {
  onBack: () => void;
  user: User;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  description?: string;
  images?: string[];
  costPrice: number;
  retailPrice: number;
  wholesalePrice: number;
  stock: number;
  minStock: number;
  unit: string;
  barcode?: string;
  status: 'active' | 'inactive';
  hasVariations?: boolean;
  variations?: {
    sizes: string[];
    colors: string[];
    fabrics: string[];
  };
  createdAt: Date;
}

export function ProductsModule({ onBack, user }: ProductsModuleProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | string>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showAddEdit, setShowAddEdit] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Mock data
  const [products, setProducts] = useState<Product[]>([
    {
      id: '1',
      sku: 'BRD-001',
      name: 'Bridal Lehenga - Red & Gold',
      category: 'Bridal',
      description: 'A beautiful bridal lehenga with red and gold embroidery.',
      images: ['https://example.com/lehenga1.jpg', 'https://example.com/lehenga2.jpg'],
      costPrice: 12000,
      retailPrice: 15000,
      wholesalePrice: 13500,
      stock: 5,
      minStock: 2,
      unit: 'Piece',
      barcode: '8901234567890',
      status: 'active',
      hasVariations: true,
      variations: {
        sizes: ['S', 'M', 'L', 'XL'],
        colors: ['Red', 'Maroon', 'Pink'],
        fabrics: ['Silk', 'Velvet'],
      },
      createdAt: new Date('2026-01-10'),
    },
    {
      id: '2',
      sku: 'DUP-002',
      name: 'Dupatta - Gold Embroidered',
      category: 'Accessories',
      costPrice: 4000,
      retailPrice: 5000,
      wholesalePrice: 4500,
      stock: 12,
      minStock: 5,
      unit: 'Piece',
      status: 'active',
      createdAt: new Date('2026-01-12'),
    },
    {
      id: '3',
      sku: 'FAB-003',
      name: 'Silk Fabric - Royal Blue',
      category: 'Fabric',
      costPrice: 1000,
      retailPrice: 1200,
      wholesalePrice: 1100,
      stock: 25,
      minStock: 10,
      unit: 'Meter',
      status: 'active',
      createdAt: new Date('2026-01-08'),
    },
    {
      id: '4',
      sku: 'JWL-004',
      name: 'Jewelry Set - Pearl',
      category: 'Jewelry',
      costPrice: 8000,
      retailPrice: 12000,
      wholesalePrice: 10000,
      stock: 3,
      minStock: 2,
      unit: 'Set',
      status: 'active',
      createdAt: new Date('2026-01-05'),
    },
    {
      id: '5',
      sku: 'SHO-005',
      name: 'Bridal Shoes - Golden',
      category: 'Footwear',
      costPrice: 3000,
      retailPrice: 4500,
      wholesalePrice: 3800,
      stock: 1,
      minStock: 2,
      unit: 'Pair',
      status: 'active',
      createdAt: new Date('2026-01-15'),
    },
  ]);

  const categories = ['all', 'Bridal', 'Accessories', 'Fabric', 'Jewelry', 'Footwear'];

  // Calculate stats
  const stats = {
    total: products.length,
    active: products.filter(p => p.status === 'active').length,
    lowStock: products.filter(p => p.stock <= p.minStock).length,
    totalValue: products.reduce((sum, p) => sum + (p.stock * p.costPrice), 0),
  };

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || product.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const handleViewDetails = (product: Product) => {
    setSelectedProduct(product);
    setShowDetails(true);
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setShowAddEdit(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setShowAddEdit(true);
  };

  const handleDeleteProduct = (product: Product) => {
    const newProducts = products.filter(p => p.id !== product.id);
    setProducts(newProducts);
    toast.success('Product deleted successfully!');
  };

  const handleAddEditClose = () => {
    setShowAddEdit(false);
  };

  const handleAddEditSave = (newProduct: Product) => {
    if (editingProduct) {
      const newProducts = products.map(p => (p.id === editingProduct.id ? newProduct : p));
      setProducts(newProducts);
      toast.success('Product updated successfully!');
    } else {
      setProducts([...products, newProduct]);
      toast.success('Product added successfully!');
    }
    setShowAddEdit(false);
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-[#3B82F6] rounded-lg flex items-center justify-center">
              <Package size={18} className="text-white" />
            </div>
            <h1 className="text-white font-semibold text-base">Products</h1>
          </div>
          <button className="p-2 text-[#9CA3AF] hover:text-white rounded-lg transition-colors">
            <TrendingUp size={20} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="overflow-x-auto px-4 py-4 scrollbar-hide">
        <div className="flex gap-3" style={{ minWidth: 'min-content' }}>
          <StatsCard icon="📦" value={stats.total} label="Total" />
          <StatsCard icon="✓" value={stats.active} label="Active" color="green" />
          <StatsCard icon="⚠️" value={stats.lowStock} label="Low Stock" color="orange" />
          <StatsCard icon="💰" value={`Rs. ${(stats.totalValue / 1000).toFixed(0)}k`} label="Value" color="blue" />
        </div>
      </div>

      {/* Search & Filter */}
      <div className="px-4 pb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg pl-10 pr-4 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
          />
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setFilterCategory(category)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filterCategory === category
                  ? 'bg-[#3B82F6] text-white'
                  : 'bg-[#1F2937] text-[#9CA3AF] border border-[#374151]'
              }`}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Products List */}
      <div className="px-4 space-y-3">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-white font-semibold text-base mb-1">{product.name}</h3>
                <p className="text-[#6B7280] text-sm">SKU: {product.sku}</p>
              </div>
              <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                product.stock <= product.minStock
                  ? 'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/30'
                  : 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30'
              }`}>
                {product.stock <= product.minStock ? 'Low Stock' : 'In Stock'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-[#111827] rounded-lg p-2">
                <p className="text-xs text-[#6B7280] mb-1">Retail Price</p>
                <p className="text-white font-semibold">Rs. {product.retailPrice.toLocaleString()}</p>
              </div>
              <div className="bg-[#111827] rounded-lg p-2">
                <p className="text-xs text-[#6B7280] mb-1">Stock</p>
                <p className="text-white font-semibold">{product.stock} {product.unit}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleViewDetails(product)}
                className="flex-1 bg-[#3B82F6] hover:bg-[#2563EB] text-white h-10 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Eye size={16} />
                View
              </button>
              <button
                onClick={() => handleEditProduct(product)}
                className="bg-[#1F2937] border border-[#374151] hover:bg-[#374151] text-white h-10 px-3 rounded-lg transition-colors"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={() => handleDeleteProduct(product)}
                className="bg-[#1F2937] border border-[#374151] hover:bg-[#374151] text-[#EF4444] h-10 px-3 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto mb-4 text-[#374151]" />
            <p className="text-[#9CA3AF]">No products found</p>
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={handleAddProduct}
        className="fixed bottom-24 right-4 w-14 h-14 bg-[#3B82F6] rounded-full flex items-center justify-center text-white shadow-lg shadow-[#3B82F6]/50 active:scale-95 transition-transform z-30 hover:bg-[#2563EB]"
      >
        <Plus size={24} />
      </button>

      {/* Details Modal */}
      {showDetails && selectedProduct && (
        <ProductDetailsModal product={selectedProduct} onClose={() => setShowDetails(false)} />
      )}

      {/* Add/Edit Product Flow */}
      {showAddEdit && (
        <AddProductFlow
          product={editingProduct}
          onClose={handleAddEditClose}
          onSave={handleAddEditSave}
        />
      )}
    </div>
  );
}

// Stats Card Component
interface StatsCardProps {
  icon: string;
  value: number | string;
  label: string;
  color?: string;
}

function StatsCard({ icon, value, label, color = 'gray' }: StatsCardProps) {
  const colorClasses: Record<string, string> = {
    gray: 'bg-[#1F2937] border-[#374151]',
    green: 'bg-[#10B981]/10 border-[#10B981]/30',
    orange: 'bg-[#F59E0B]/10 border-[#F59E0B]/30',
    blue: 'bg-[#3B82F6]/10 border-[#3B82F6]/30',
  };

  return (
    <div className={`${colorClasses[color]} border rounded-xl p-4 min-w-[120px]`}>
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="text-xs text-[#9CA3AF]">{label}</div>
    </div>
  );
}

// Product Details Modal
interface ProductDetailsModalProps {
  product: Product;
  onClose: () => void;
}

function ProductDetailsModal({ product, onClose }: ProductDetailsModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end">
      <div className="bg-[#1F2937] w-full rounded-t-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-center pt-2 pb-4">
          <div className="w-12 h-1.5 bg-[#374151] rounded-full" />
        </div>

        <div className="px-6 pb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-white text-lg font-semibold mb-1">{product.name}</h2>
              <p className="text-[#9CA3AF] text-sm">SKU: {product.sku}</p>
            </div>
            <button onClick={onClose} className="p-2 text-[#9CA3AF] hover:text-white hover:bg-[#374151] rounded-lg">
              ×
            </button>
          </div>

          <div className="space-y-4">
            {/* Images */}
            {product.images && product.images.length > 0 && (
              <div className="bg-[#111827] rounded-xl p-4">
                <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">Images</h3>
                <div className="grid grid-cols-3 gap-2">
                  {product.images.map((img, index) => (
                    <div key={index} className="aspect-square bg-[#1F2937] rounded-lg overflow-hidden border border-[#374151]">
                      <img 
                        src={img} 
                        alt={`Product ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23374151" width="100" height="100"/%3E%3Ctext fill="%239CA3AF" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle"%3ENo Image%3C/text%3E%3C/svg%3E';
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {product.description && (
              <div className="bg-[#111827] rounded-xl p-4">
                <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">Description</h3>
                <p className="text-white text-sm leading-relaxed">{product.description}</p>
              </div>
            )}

            <div className="bg-[#111827] rounded-xl p-4">
              <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">Pricing</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-[#6B7280] mb-1">Cost</p>
                  <p className="text-white font-semibold">Rs. {product.costPrice.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6B7280] mb-1">Retail</p>
                  <p className="text-white font-semibold">Rs. {product.retailPrice.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6B7280] mb-1">Wholesale</p>
                  <p className="text-white font-semibold">Rs. {product.wholesalePrice.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-[#111827] rounded-xl p-4">
              <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">Inventory</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-[#6B7280] mb-1">Current Stock</p>
                  <p className="text-white font-semibold">{product.stock} {product.unit}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6B7280] mb-1">Min Stock</p>
                  <p className="text-white font-semibold">{product.minStock} {product.unit}</p>
                </div>
              </div>
            </div>

            {/* Variations */}
            {product.hasVariations && product.variations && (
              <div className="bg-[#111827] rounded-xl p-4">
                <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">Variations</h3>
                <div className="space-y-3">
                  {product.variations.sizes.length > 0 && (
                    <div>
                      <p className="text-xs text-[#6B7280] mb-1.5">Sizes</p>
                      <div className="flex flex-wrap gap-2">
                        {product.variations.sizes.map(size => (
                          <span key={size} className="px-2 py-1 bg-[#1F2937] border border-[#374151] rounded text-xs text-white">
                            {size}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {product.variations.colors.length > 0 && (
                    <div>
                      <p className="text-xs text-[#6B7280] mb-1.5">Colors</p>
                      <div className="flex flex-wrap gap-2">
                        {product.variations.colors.map(color => (
                          <span key={color} className="px-2 py-1 bg-[#1F2937] border border-[#374151] rounded text-xs text-white">
                            {color}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {product.variations.fabrics.length > 0 && (
                    <div>
                      <p className="text-xs text-[#6B7280] mb-1.5">Fabrics</p>
                      <div className="flex flex-wrap gap-2">
                        {product.variations.fabrics.map(fabric => (
                          <span key={fabric} className="px-2 py-1 bg-[#1F2937] border border-[#374151] rounded text-xs text-white">
                            {fabric}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bg-[#111827] rounded-xl p-4">
              <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Category</span>
                  <span className="text-white">{product.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Status</span>
                  <span className="text-[#10B981] capitalize">{product.status}</span>
                </div>
                {product.barcode && (
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">Barcode</span>
                    <span className="text-white font-mono">{product.barcode}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Created</span>
                  <span className="text-white">{product.createdAt.toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg font-medium mt-6"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}