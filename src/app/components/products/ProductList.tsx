import React, { useState } from 'react';
import { SmartTable } from '../ui/SmartTable';
import { ProductDrawer } from './ProductDrawer';
import { 
  MoreVertical, 
  Printer, 
  Copy, 
  History, 
  Trash2, 
  Package, 
  Tags, 
  Scale, 
  Layers, 
  Search, 
  Plus, 
  Filter, 
  Box,
  LayoutGrid,
  Settings2,
  FolderTree,
  Edit2,
  Eye,
  AlertTriangle,
  TrendingUp,
  Archive,
  CheckCircle2,
  AlertCircle,
  XCircle
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { Progress } from "../ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../ui/tabs";
import { cn } from "../ui/utils";

const mockProducts = [
  { 
    id: '1', 
    name: 'Cotton T-Shirt', 
    sku: 'TS-001', 
    category: 'Apparel', 
    subCategory: 'Tops', 
    brand: 'Nike',
    purchasePrice: 19.99,
    sellingPrice: 29.99, 
    stock: 124, 
    status: 'Active',
    unit: 'Piece',
    productType: 'Simple',
    tax: '5%',
    business: 'Main Store',
    location: 'Warehouse A'
  },
  { 
    id: '2', 
    name: 'Denim Jeans', 
    sku: 'DN-002', 
    category: 'Apparel', 
    subCategory: 'Bottoms', 
    brand: 'Levis',
    purchasePrice: 34.99,
    sellingPrice: 49.99, 
    stock: 56, 
    status: 'Active',
    unit: 'Piece',
    productType: 'Variable',
    tax: '5%',
    business: 'Main Store',
    location: 'Warehouse A'
  },
  { 
    id: '3', 
    name: 'Leather Jacket', 
    sku: 'LJ-003', 
    category: 'Outerwear', 
    subCategory: 'Jackets', 
    brand: 'Zara',
    purchasePrice: 129.99,
    sellingPrice: 199.99, 
    stock: 8, 
    status: 'Low Stock',
    unit: 'Piece',
    productType: 'Simple',
    tax: '10%',
    business: 'Main Store',
    location: 'Warehouse B'
  },
  { 
    id: '4', 
    name: 'Sneakers', 
    sku: 'SN-004', 
    category: 'Footwear', 
    subCategory: 'Sports', 
    brand: 'Adidas',
    purchasePrice: 59.99,
    sellingPrice: 89.99, 
    stock: 0, 
    status: 'Out of Stock',
    unit: 'Pair',
    productType: 'Variable',
    tax: '5%',
    business: 'Branch 2',
    location: 'Warehouse A'
  },
  { 
    id: '5', 
    name: 'Wool Scarf', 
    sku: 'WS-005', 
    category: 'Accessories', 
    subCategory: 'Winter', 
    brand: 'Gucci',
    purchasePrice: 14.99,
    sellingPrice: 24.99, 
    stock: 45, 
    status: 'Active',
    unit: 'Piece',
    productType: 'Simple',
    tax: '5%',
    business: 'Main Store',
    location: 'Warehouse A'
  },
];

const mockCategories = [
  { id: 1, name: 'Apparel', count: 124, subCategories: ['Tops', 'Bottoms', 'Dresses', 'Activewear'] },
  { id: 2, name: 'Footwear', count: 45, subCategories: ['Sneakers', 'Boots', 'Sandals', 'Formal'] },
  { id: 3, name: 'Accessories', count: 32, subCategories: ['Bags', 'Jewelry', 'Scarves', 'Belts'] },
  { id: 4, name: 'Fabrics', count: 210, subCategories: ['Cotton', 'Silk', 'Lawn', 'Chiffon', 'Velvet'] },
];

const mockBrands = [
  { id: 1, name: 'Sapphire', products: 45, country: 'Pakistan' },
  { id: 2, name: 'Khaadi', products: 62, country: 'Pakistan' },
  { id: 3, name: 'Gul Ahmed', products: 38, country: 'Pakistan' },
  { id: 4, name: 'J.', products: 24, country: 'Pakistan' },
  { id: 5, name: 'Bonanza Satrangi', products: 18, country: 'Pakistan' },
];

const mockUnits = [
  { id: 1, name: 'Piece', short: 'pc', type: 'Count' },
  { id: 2, name: 'Meter', short: 'm', type: 'Length' },
  { id: 3, name: 'Yard', short: 'yd', type: 'Length' },
  { id: 4, name: 'Kilogram', short: 'kg', type: 'Weight' },
  { id: 5, name: 'Box', short: 'box', type: 'Volume' },
];

export const ProductList = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("products");

  // Calculate Quick Stats
  const totalValuation = mockProducts.reduce((sum, p) => sum + (p.sellingPrice * p.stock), 0);
  const lowStockCount = mockProducts.filter(p => p.stock < 10).length;
  
  const TabButton = ({ value, icon: Icon, label, count }: any) => (
    <TabsTrigger 
      value={value}
      className="px-6 py-3 h-auto gap-2 rounded-xl border border-transparent transition-all duration-300"
      style={{
        backgroundColor: 'var(--color-primary)',
        color: 'var(--color-text-primary)',
        boxShadow: 'var(--shadow-lg) var(--color-primary-shadow)',
        borderColor: 'rgba(59, 130, 246, 0.5)'
      }}
    >
      <Icon size={16} />
      <span>{label}</span>
      {count && <Badge variant="secondary" className="ml-1 bg-white/20 text-current hover:bg-white/30 border-0 h-5 px-1.5 min-w-[20px]">{count}</Badge>}
    </TabsTrigger>
  );

  return (
    <div 
      className="flex flex-col h-full p-6 gap-6"
      style={{
        backgroundColor: 'var(--color-bg-tertiary)',
        color: 'var(--color-text-primary)'
      }}
    >
      {/* Modern Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 
            className="text-3xl font-bold tracking-tight flex items-center gap-3"
            style={{ color: 'var(--color-text-primary)' }}
          >
             <div 
               className="h-10 w-10 rounded-xl flex items-center justify-center shadow-lg"
               style={{
                 backgroundColor: 'var(--color-primary)',
                 borderRadius: 'var(--radius-xl)',
                 boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.2)'
               }}
             >
               <Package 
                 size={24}
                 style={{ color: 'var(--color-text-primary)' }}
               />
             </div>
             Inventory Management
          </h1>
          <p 
            className="mt-2 text-sm ml-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Manage products, stocks, categories, and attributes across all stores.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
           <Button 
             variant="outline" 
             className="h-10"
             style={{
               borderColor: 'var(--color-border-primary)',
               color: 'var(--color-text-secondary)'
             }}
             onMouseEnter={(e) => {
               e.currentTarget.style.color = 'var(--color-text-primary)';
               e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
             }}
             onMouseLeave={(e) => {
               e.currentTarget.style.color = 'var(--color-text-secondary)';
               e.currentTarget.style.backgroundColor = 'transparent';
             }}
           >
             <Filter size={16} className="mr-2" /> Filters
           </Button>
           <Button 
             className="h-10 px-6 font-medium"
             onClick={() => setIsDrawerOpen(true)}
             style={{
               backgroundColor: 'var(--color-primary)',
               color: 'var(--color-text-primary)',
               boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.2)'
             }}
             onMouseEnter={(e) => {
               e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 1)'; // blue-500
             }}
             onMouseLeave={(e) => {
               e.currentTarget.style.backgroundColor = 'var(--color-primary)';
             }}
           >
             <Plus size={18} className="mr-2" /> Add {activeTab === 'products' ? 'Product' : activeTab === 'categories' ? 'Category' : activeTab === 'brands' ? 'Brand' : 'Unit'}
           </Button>
        </div>
      </div>

      {/* Quick Stats Header (New) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div 
           className="border rounded-xl p-5 flex items-center gap-4 transition-colors group"
           style={{
             backgroundColor: 'rgba(17, 24, 39, 0.5)',
             borderColor: 'var(--color-border-primary)',
             borderRadius: 'var(--radius-xl)'
           }}
           onMouseEnter={(e) => {
             e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
           }}
           onMouseLeave={(e) => {
             e.currentTarget.style.borderColor = 'var(--color-border-primary)';
           }}
         >
           <div 
             className="h-12 w-12 rounded-full flex items-center justify-center transition-all"
             style={{
               backgroundColor: 'rgba(16, 185, 129, 0.1)',
               borderRadius: '50%',
               color: 'rgba(16, 185, 129, 1)'
             }}
             onMouseEnter={(e) => {
               e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 1)';
               e.currentTarget.style.color = 'var(--color-text-primary)';
             }}
             onMouseLeave={(e) => {
               e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
               e.currentTarget.style.color = 'rgba(16, 185, 129, 1)';
             }}
           >
             <TrendingUp size={24} />
           </div>
           <div>
             <p 
               className="text-sm font-medium"
               style={{ color: 'var(--color-text-tertiary)' }}
             >
               Total Valuation
             </p>
             <h3 
               className="text-2xl font-bold font-mono"
               style={{ color: 'var(--color-text-primary)' }}
             >
               ${totalValuation.toLocaleString()}
             </h3>
           </div>
         </div>
         
         <div 
           className="border rounded-xl p-5 flex items-center gap-4 transition-colors group"
           style={{
             backgroundColor: 'rgba(17, 24, 39, 0.5)',
             borderColor: 'var(--color-border-primary)',
             borderRadius: 'var(--radius-xl)'
           }}
           onMouseEnter={(e) => {
             e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
           }}
           onMouseLeave={(e) => {
             e.currentTarget.style.borderColor = 'var(--color-border-primary)';
           }}
         >
           <div 
             className="h-12 w-12 rounded-full flex items-center justify-center transition-all"
             style={{
               backgroundColor: 'rgba(239, 68, 68, 0.1)',
               borderRadius: '50%',
               color: 'var(--color-error)'
             }}
             onMouseEnter={(e) => {
               e.currentTarget.style.backgroundColor = 'var(--color-error)';
               e.currentTarget.style.color = 'var(--color-text-primary)';
             }}
             onMouseLeave={(e) => {
               e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
               e.currentTarget.style.color = 'var(--color-error)';
             }}
           >
             <AlertTriangle size={24} />
           </div>
           <div>
             <p 
               className="text-sm font-medium"
               style={{ color: 'var(--color-text-tertiary)' }}
             >
               Low Stock Items
             </p>
             <h3 
               className="text-2xl font-bold font-mono"
               style={{ color: 'var(--color-text-primary)' }}
             >
               {lowStockCount}
             </h3>
           </div>
         </div>

         <div 
           className="border rounded-xl p-5 flex items-center gap-4 transition-colors group"
           style={{
             backgroundColor: 'rgba(17, 24, 39, 0.5)',
             borderColor: 'var(--color-border-primary)',
             borderRadius: 'var(--radius-xl)'
           }}
           onMouseEnter={(e) => {
             e.currentTarget.style.borderColor = 'rgba(147, 51, 234, 0.3)';
           }}
           onMouseLeave={(e) => {
             e.currentTarget.style.borderColor = 'var(--color-border-primary)';
           }}
         >
           <div 
             className="h-12 w-12 rounded-full flex items-center justify-center transition-all"
             style={{
               backgroundColor: 'rgba(147, 51, 234, 0.1)',
               borderRadius: '50%',
               color: 'var(--color-wholesale)'
             }}
             onMouseEnter={(e) => {
               e.currentTarget.style.backgroundColor = 'var(--color-wholesale)';
               e.currentTarget.style.color = 'var(--color-text-primary)';
             }}
             onMouseLeave={(e) => {
               e.currentTarget.style.backgroundColor = 'rgba(147, 51, 234, 0.1)';
               e.currentTarget.style.color = 'var(--color-wholesale)';
             }}
           >
             <Layers size={24} />
           </div>
           <div>
             <p 
               className="text-sm font-medium"
               style={{ color: 'var(--color-text-tertiary)' }}
             >
               Active Categories
             </p>
             <h3 
               className="text-2xl font-bold font-mono"
               style={{ color: 'var(--color-text-primary)' }}
             >
               {mockCategories.length}
             </h3>
           </div>
         </div>
      </div>

      <Tabs defaultValue="products" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col gap-6">
        <TabsList 
          className="border p-1 h-auto rounded-2xl w-full justify-start gap-2"
          style={{
            backgroundColor: 'rgba(17, 24, 39, 0.5)',
            borderColor: 'var(--color-border-primary)',
            borderRadius: 'var(--radius-2xl)'
          }}
        >
          <TabButton value="products" icon={Package} label="Products" count={mockProducts.length} />
          <TabButton value="categories" icon={FolderTree} label="Categories" count={mockCategories.length} />
          <TabButton value="brands" icon={Tags} label="Brands" count={mockBrands.length} />
          <TabButton value="units" icon={Scale} label="Units" count={mockUnits.length} />
        </TabsList>

        {/* Tab Content Area - Products */}
        <TabsContent value="products" className="flex-1 mt-0">
          <SmartTable 
            data={mockProducts}
            keyField="id"
            searchPlaceholder="Search products by name, SKU or category..."
            onAdd={() => setIsDrawerOpen(true)}
            columns={[
              {
                key: 'id',
                header: '',
                render: (item) => (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        style={{ color: 'var(--color-text-tertiary)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--color-text-primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--color-text-tertiary)';
                        }}
                      >
                        <MoreVertical size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      align="end"
                      style={{
                        backgroundColor: 'var(--color-bg-primary)',
                        borderColor: 'var(--color-border-primary)',
                        color: 'var(--color-text-primary)'
                      }}
                    >
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        style={{ color: 'var(--color-text-primary)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <Eye size={14} className="mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        style={{ color: 'var(--color-text-primary)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <Edit2 size={14} className="mr-2" />
                        Edit Product
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        style={{ color: 'var(--color-text-primary)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <Copy size={14} className="mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        style={{ color: 'var(--color-text-primary)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <Printer size={14} className="mr-2" />
                        Print Barcode
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        style={{ color: 'var(--color-text-primary)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <History size={14} className="mr-2" />
                        View History
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        style={{ color: 'var(--color-error)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <Trash2 size={14} className="mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )
              },
              { 
                key: 'business', 
                header: 'Business', 
                render: (item) => (
                  <span 
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {item.business}
                  </span>
                )
              },
              { 
                key: 'location', 
                header: 'Location', 
                render: (item) => (
                  <span 
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {item.location}
                  </span>
                )
              },
              { 
                key: 'name', 
                header: 'Product', 
                render: (item) => (
                  <div className="flex items-center gap-3 py-2">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{
                        backgroundColor: 'var(--color-bg-primary)',
                        borderColor: 'var(--color-border-primary)',
                        borderRadius: 'var(--radius-lg)',
                        color: 'var(--color-text-disabled)'
                      }}
                    >
                      <Package size={18} />
                    </div>
                    <div>
                      <div 
                        className="font-medium text-sm"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {item.name}
                      </div>
                    </div>
                  </div>
                )
              },
              { 
                key: 'unit', 
                header: 'Unit', 
                render: (item) => (
                  <span 
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {item.unit}
                  </span>
                )
              },
              { 
                key: 'purchasePrice', 
                header: 'Purchase Price', 
                render: (item) => (
                  <span 
                    className="font-mono font-medium text-sm"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    ${item.purchasePrice}
                  </span>
                )
              },
              { 
                key: 'sellingPrice', 
                header: 'Selling Price', 
                render: (item) => (
                  <span 
                    className="font-mono font-medium text-sm"
                    style={{ color: 'rgba(16, 185, 129, 1)' }}
                  >
                    ${item.sellingPrice}
                  </span>
                )
              },
              { 
                key: 'stock', 
                header: 'Current Stock', 
                render: (item) => {
                  const isLow = item.stock < 10;
                  const isOut = item.stock === 0;
                  
                  return (
                    <span 
                      className="font-bold text-sm"
                      style={{
                        color: isOut 
                          ? 'var(--color-error)' 
                          : isLow 
                          ? 'var(--color-warning)' 
                          : 'rgba(16, 185, 129, 1)'
                      }}
                    >
                      {item.stock}
                    </span>
                  );
                }
              },
              { 
                key: 'productType', 
                header: 'Product Type', 
                render: (item) => (
                  <Badge 
                    variant="outline" 
                    className="text-xs"
                    style={
                      item.productType === 'Variable' 
                        ? {
                            backgroundColor: 'rgba(147, 51, 234, 0.1)',
                            color: 'var(--color-wholesale)',
                            borderColor: 'rgba(147, 51, 234, 0.2)',
                            borderRadius: 'var(--radius-sm)'
                          }
                        : {
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            color: 'var(--color-primary)',
                            borderColor: 'rgba(59, 130, 246, 0.2)',
                            borderRadius: 'var(--radius-sm)'
                          }
                    }
                  >
                    {item.productType}
                  </Badge>
                )
              },
              { 
                key: 'category', 
                header: 'Category',
                render: (item) => (
                  <div className="flex flex-col">
                    <span 
                      className="text-sm font-medium"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {item.category}
                    </span>
                    <span 
                      className="text-xs"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      {item.subCategory}
                    </span>
                  </div>
                )
              },
              { 
                key: 'brand', 
                header: 'Brand', 
                render: (item) => (
                  <span 
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {item.brand}
                  </span>
                )
              },
              { 
                key: 'tax', 
                header: 'Tax', 
                render: (item) => (
                  <span 
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {item.tax}
                  </span>
                )
              },
              { 
                key: 'sku', 
                header: 'SKU', 
                render: (item) => (
                  <span 
                    className="text-xs font-mono"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    {item.sku}
                  </span>
                )
              },
            ]}
          />
        </TabsContent>


        {/* Tab Content Area - Categories */}
        <TabsContent value="categories" className="flex-1 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
             {mockCategories.map((cat) => (
               <div 
                 key={cat.id} 
                 className="group border rounded-xl overflow-hidden p-5 flex flex-col gap-4 relative transition-all"
                 style={{
                   backgroundColor: 'rgba(17, 24, 39, 0.5)',
                   borderColor: 'var(--color-border-primary)',
                   borderRadius: 'var(--radius-xl)'
                 }}
                 onMouseEnter={(e) => {
                   e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                   e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                 }}
                 onMouseLeave={(e) => {
                   e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                   e.currentTarget.style.backgroundColor = 'rgba(17, 24, 39, 0.5)';
                 }}
               >
                 <div className="flex justify-between items-start">
                   <div 
                     className="h-10 w-10 rounded-lg flex items-center justify-center transition-colors"
                     style={{
                       backgroundColor: 'rgba(59, 130, 246, 0.1)',
                       borderRadius: 'var(--radius-lg)',
                       color: 'var(--color-primary)'
                     }}
                     onMouseEnter={(e) => {
                       e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                       e.currentTarget.style.color = 'var(--color-text-primary)';
                     }}
                     onMouseLeave={(e) => {
                       e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                       e.currentTarget.style.color = 'var(--color-primary)';
                     }}
                   >
                     <FolderTree size={20} />
                   </div>
                   <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          style={{ color: 'var(--color-text-tertiary)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--color-text-primary)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--color-text-tertiary)';
                          }}
                        >
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent 
                        align="end"
                        style={{
                          backgroundColor: 'var(--color-bg-tertiary)',
                          borderColor: 'var(--color-border-primary)',
                          color: 'var(--color-text-primary)'
                        }}
                      >
                        <DropdownMenuItem 
                          style={{ color: 'var(--color-text-primary)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <Edit2 size={14} className="mr-2"/> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          style={{ color: 'var(--color-error)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <Trash2 size={14} className="mr-2"/> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                   </DropdownMenu>
                 </div>
                 
                 <div>
                   <h3 
                     className="text-lg font-bold mb-1"
                     style={{ color: 'var(--color-text-primary)' }}
                   >
                     {cat.name}
                   </h3>
                   <p 
                     className="text-sm"
                     style={{ color: 'var(--color-text-secondary)' }}
                   >
                     {cat.count} Products
                   </p>
                 </div>
                 
                 <div 
                   className="pt-4 border-t"
                   style={{ borderTopColor: 'var(--color-border-primary)' }}
                 >
                   <p 
                     className="text-xs font-semibold uppercase mb-3 tracking-wider"
                     style={{ color: 'var(--color-text-tertiary)' }}
                   >
                     Sub-Categories
                   </p>
                   <div className="flex flex-wrap gap-2">
                     {cat.subCategories.map((sub, idx) => (
                       <Badge 
                         key={idx} 
                         variant="secondary" 
                         className="border-0 font-normal"
                         style={{
                           backgroundColor: 'var(--color-bg-card)',
                           color: 'var(--color-text-secondary)',
                           borderRadius: 'var(--radius-sm)'
                         }}
                         onMouseEnter={(e) => {
                           e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                         }}
                         onMouseLeave={(e) => {
                           e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                         }}
                       >
                         {sub}
                       </Badge>
                     ))}
                     <button 
                       className="h-5 w-5 rounded-full flex items-center justify-center transition-colors"
                       style={{
                         backgroundColor: 'var(--color-bg-card)',
                         borderRadius: '50%',
                         color: 'var(--color-text-tertiary)'
                       }}
                       onMouseEnter={(e) => {
                         e.currentTarget.style.color = 'var(--color-text-primary)';
                         e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                       }}
                       onMouseLeave={(e) => {
                         e.currentTarget.style.color = 'var(--color-text-tertiary)';
                         e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                       }}
                     >
                       <Plus size={12} />
                     </button>
                   </div>
                 </div>
               </div>
             ))}
             
             {/* Add New Category Card */}
             <button 
               className="border border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-3 transition-all min-h-[200px]"
               style={{
                 borderColor: 'var(--color-border-primary)',
                 borderRadius: 'var(--radius-xl)',
                 color: 'var(--color-text-tertiary)'
               }}
               onMouseEnter={(e) => {
                 e.currentTarget.style.color = 'var(--color-primary)';
                 e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                 e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
               }}
               onMouseLeave={(e) => {
                 e.currentTarget.style.color = 'var(--color-text-tertiary)';
                 e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                 e.currentTarget.style.backgroundColor = 'transparent';
               }}
             >
                <div 
                  className="h-12 w-12 rounded-full flex items-center justify-center border"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    borderColor: 'var(--color-border-primary)',
                    borderRadius: '50%'
                  }}
                >
                  <Plus size={24} />
                </div>
                <span className="font-medium">Add New Category</span>
              </button>
          </div>
        </TabsContent>

        {/* Tab Content Area - Brands */}
        <TabsContent value="brands" className="flex-1 mt-0">
           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {mockBrands.map((brand) => (
                <div 
                  key={brand.id} 
                  className="border rounded-xl p-6 flex flex-col items-center text-center gap-4 transition-all group relative"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    borderColor: 'var(--color-border-primary)',
                    borderRadius: 'var(--radius-xl)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(147, 51, 234, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                  }}
                >
                   <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <Button 
                       variant="ghost" 
                       size="icon" 
                       className="h-6 w-6"
                       style={{ color: 'var(--color-text-tertiary)' }}
                       onMouseEnter={(e) => {
                         e.currentTarget.style.color = 'var(--color-text-primary)';
                       }}
                       onMouseLeave={(e) => {
                         e.currentTarget.style.color = 'var(--color-text-tertiary)';
                       }}
                     >
                       <MoreVertical size={14} />
                     </Button>
                   </div>
                   
                   <div 
                     className="h-16 w-16 rounded-full flex items-center justify-center overflow-hidden border-2 transition-colors"
                     style={{
                       backgroundColor: 'var(--color-text-primary)',
                       borderRadius: '50%',
                       borderColor: 'var(--color-border-primary)'
                     }}
                     onMouseEnter={(e) => {
                       e.currentTarget.style.borderColor = 'var(--color-wholesale)';
                     }}
                     onMouseLeave={(e) => {
                       e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                     }}
                   >
                     {/* Placeholder for Brand Logo */}
                     <span 
                       className="font-bold text-xl"
                       style={{ color: 'var(--color-bg-primary)' }}
                     >
                       {brand.name.substring(0, 2).toUpperCase()}
                     </span>
                   </div>
                   
                   <div>
                     <h3 
                       className="font-bold text-lg"
                       style={{ color: 'var(--color-text-primary)' }}
                     >
                       {brand.name}
                     </h3>
                     <p 
                       className="text-sm"
                       style={{ color: 'var(--color-text-tertiary)' }}
                     >
                       {brand.country}
                     </p>
                   </div>
                   
                   <Badge 
                     variant="outline" 
                     className="mt-auto"
                     style={{
                       borderColor: 'var(--color-border-primary)',
                       backgroundColor: 'var(--color-bg-tertiary)',
                       color: 'var(--color-text-secondary)',
                       borderRadius: 'var(--radius-sm)'
                     }}
                     onMouseEnter={(e) => {
                       e.currentTarget.style.borderColor = 'rgba(147, 51, 234, 0.3)';
                       e.currentTarget.style.color = 'var(--color-wholesale)';
                     }}
                     onMouseLeave={(e) => {
                       e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                       e.currentTarget.style.color = 'var(--color-text-secondary)';
                     }}
                   >
                     {brand.products} Products
                   </Badge>
                </div>
              ))}
              
              <button 
                className="border border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-all min-h-[200px]"
                style={{
                  borderColor: 'var(--color-border-primary)',
                  borderRadius: 'var(--radius-xl)',
                  color: 'var(--color-text-tertiary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-wholesale)';
                  e.currentTarget.style.borderColor = 'rgba(147, 51, 234, 0.5)';
                  e.currentTarget.style.backgroundColor = 'rgba(147, 51, 234, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-tertiary)';
                  e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Plus size={24} />
                <span className="font-medium">Add Brand</span>
             </button>
           </div>
        </TabsContent>

        {/* Tab Content Area - Units */}
        <TabsContent value="units" className="flex-1 mt-0">
           <div 
             className="border rounded-xl overflow-hidden max-w-3xl"
             style={{
               backgroundColor: 'rgba(17, 24, 39, 0.5)',
               borderColor: 'var(--color-border-primary)',
               borderRadius: 'var(--radius-xl)'
             }}
           >
              <div 
                className="p-4 border-b flex justify-between items-center"
                style={{
                  borderBottomColor: 'var(--color-border-primary)',
                  backgroundColor: 'var(--color-bg-primary)'
                }}
              >
                <h3 
                  className="font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Measurement Units
                </h3>
                <p 
                  className="text-sm"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Manage base units for products
                </p>
              </div>
              <div>
                {mockUnits.map((unit) => (
                  <div 
                    key={unit.id} 
                    className="p-4 flex items-center justify-between transition-colors group border-b"
                    style={{
                      borderBottomColor: 'var(--color-border-primary)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div className="flex items-center gap-4">
                       <div 
                         className="h-10 w-10 rounded-lg flex items-center justify-center font-mono text-sm border"
                         style={{
                           backgroundColor: 'var(--color-bg-card)',
                           borderColor: 'var(--color-border-secondary)',
                           borderRadius: 'var(--radius-lg)',
                           color: 'var(--color-text-secondary)'
                         }}
                       >
                         {unit.short}
                       </div>
                       <div>
                         <p 
                           className="font-medium"
                           style={{ color: 'var(--color-text-primary)' }}
                         >
                           {unit.name}
                         </p>
                         <p 
                           className="text-xs"
                           style={{ color: 'var(--color-text-tertiary)' }}
                         >
                           {unit.type}
                         </p>
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         className="h-8"
                         style={{ color: 'var(--color-text-secondary)' }}
                         onMouseEnter={(e) => {
                           e.currentTarget.style.color = 'var(--color-text-primary)';
                         }}
                         onMouseLeave={(e) => {
                           e.currentTarget.style.color = 'var(--color-text-secondary)';
                         }}
                       >
                         Edit
                       </Button>
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         className="h-8"
                         style={{ color: 'var(--color-error)' }}
                         onMouseEnter={(e) => {
                           e.currentTarget.style.color = 'rgba(248, 113, 113, 1)';
                           e.currentTarget.style.backgroundColor = 'rgba(127, 29, 29, 0.2)';
                         }}
                         onMouseLeave={(e) => {
                           e.currentTarget.style.color = 'var(--color-error)';
                           e.currentTarget.style.backgroundColor = 'transparent';
                         }}
                       >
                         Delete
                       </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div 
                className="p-4 border-t"
                style={{
                  borderTopColor: 'var(--color-border-primary)',
                  backgroundColor: 'rgba(17, 24, 39, 0.3)'
                }}
              >
                 <Button 
                   variant="outline" 
                   className="w-full border-dashed"
                   style={{
                     borderColor: 'var(--color-border-secondary)',
                     color: 'var(--color-text-secondary)'
                   }}
                   onMouseEnter={(e) => {
                     e.currentTarget.style.color = 'var(--color-text-primary)';
                     e.currentTarget.style.borderColor = 'var(--color-text-tertiary)';
                     e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                   }}
                   onMouseLeave={(e) => {
                     e.currentTarget.style.color = 'var(--color-text-secondary)';
                     e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                     e.currentTarget.style.backgroundColor = 'transparent';
                   }}
                 >
                   <Plus size={16} className="mr-2" /> Add New Unit
                 </Button>
              </div>
           </div>
        </TabsContent>
      </Tabs>

      <ProductDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </div>
  );
};