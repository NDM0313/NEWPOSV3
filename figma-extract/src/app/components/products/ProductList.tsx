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
      className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg shadow-blue-900/20 px-6 py-3 h-auto gap-2 rounded-xl border border-transparent data-[state=active]:border-blue-500/50 transition-all duration-300"
    >
      <Icon size={16} />
      <span>{label}</span>
      {count && <Badge variant="secondary" className="ml-1 bg-white/20 text-current hover:bg-white/30 border-0 h-5 px-1.5 min-w-[20px]">{count}</Badge>}
    </TabsTrigger>
  );

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white p-6 gap-6">
      {/* Modern Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
             <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
               <Package className="text-white" size={24} />
             </div>
             Inventory Management
          </h1>
          <p className="text-gray-400 mt-2 text-sm ml-1">Manage products, stocks, categories, and attributes across all stores.</p>
        </div>
        
        <div className="flex items-center gap-3">
           <Button variant="outline" className="border-gray-800 text-gray-300 hover:text-white hover:bg-gray-900 h-10">
             <Filter size={16} className="mr-2" /> Filters
           </Button>
           <Button 
             className="bg-blue-600 hover:bg-blue-500 text-white h-10 px-6 shadow-lg shadow-blue-900/20 font-medium"
             onClick={() => setIsDrawerOpen(true)}
           >
             <Plus size={18} className="mr-2" /> Add {activeTab === 'products' ? 'Product' : activeTab === 'categories' ? 'Category' : activeTab === 'brands' ? 'Brand' : 'Unit'}
           </Button>
        </div>
      </div>

      {/* Quick Stats Header (New) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 flex items-center gap-4 hover:border-blue-500/30 transition-colors group">
           <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all">
             <TrendingUp size={24} />
           </div>
           <div>
             <p className="text-sm text-gray-500 font-medium">Total Valuation</p>
             <h3 className="text-2xl font-bold text-white font-mono">${totalValuation.toLocaleString()}</h3>
           </div>
         </div>
         
         <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 flex items-center gap-4 hover:border-red-500/30 transition-colors group">
           <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 group-hover:bg-red-500 group-hover:text-white transition-all">
             <AlertTriangle size={24} />
           </div>
           <div>
             <p className="text-sm text-gray-500 font-medium">Low Stock Items</p>
             <h3 className="text-2xl font-bold text-white font-mono">{lowStockCount}</h3>
           </div>
         </div>

         <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 flex items-center gap-4 hover:border-purple-500/30 transition-colors group">
           <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-all">
             <Layers size={24} />
           </div>
           <div>
             <p className="text-sm text-gray-500 font-medium">Active Categories</p>
             <h3 className="text-2xl font-bold text-white font-mono">{mockCategories.length}</h3>
           </div>
         </div>
      </div>

      <Tabs defaultValue="products" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col gap-6">
        <TabsList className="bg-gray-900/50 border border-gray-800 p-1 h-auto rounded-2xl w-full justify-start gap-2">
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
                        className="h-8 w-8 text-gray-500 hover:text-white"
                      >
                        <MoreVertical size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800 text-white">
                      <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer">
                        <Eye size={14} className="mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer">
                        <Edit2 size={14} className="mr-2" />
                        Edit Product
                      </DropdownMenuItem>
                      <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer">
                        <Copy size={14} className="mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer">
                        <Printer size={14} className="mr-2" />
                        Print Barcode
                      </DropdownMenuItem>
                      <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer">
                        <History size={14} className="mr-2" />
                        View History
                      </DropdownMenuItem>
                      <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer text-red-400">
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
                render: (item) => <span className="text-sm text-gray-300">{item.business}</span> 
              },
              { 
                key: 'location', 
                header: 'Location', 
                render: (item) => <span className="text-sm text-gray-300">{item.location}</span> 
              },
              { 
                key: 'name', 
                header: 'Product', 
                render: (item) => (
                  <div className="flex items-center gap-3 py-2">
                    <div className="w-10 h-10 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-600">
                      <Package size={18} />
                    </div>
                    <div>
                      <div className="font-medium text-white text-sm">{item.name}</div>
                    </div>
                  </div>
                )
              },
              { 
                key: 'unit', 
                header: 'Unit', 
                render: (item) => <span className="text-sm text-gray-300">{item.unit}</span> 
              },
              { 
                key: 'purchasePrice', 
                header: 'Purchase Price', 
                render: (item) => <span className="font-mono font-medium text-white text-sm">${item.purchasePrice}</span> 
              },
              { 
                key: 'sellingPrice', 
                header: 'Selling Price', 
                render: (item) => <span className="font-mono font-medium text-emerald-400 text-sm">${item.sellingPrice}</span> 
              },
              { 
                key: 'stock', 
                header: 'Current Stock', 
                render: (item) => {
                  const isLow = item.stock < 10;
                  const isOut = item.stock === 0;
                  
                  return (
                    <span className={cn("font-bold text-sm", isOut ? "text-red-500" : isLow ? "text-orange-400" : "text-emerald-400")}>
                      {item.stock}
                    </span>
                  );
                }
              },
              { 
                key: 'productType', 
                header: 'Product Type', 
                render: (item) => (
                  <Badge variant="outline" className={cn(
                    "text-xs",
                    item.productType === 'Variable' ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  )}>
                    {item.productType}
                  </Badge>
                )
              },
              { 
                key: 'category', 
                header: 'Category',
                render: (item) => (
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-300">{item.category}</span>
                    <span className="text-xs text-gray-500">{item.subCategory}</span>
                  </div>
                )
              },
              { 
                key: 'brand', 
                header: 'Brand', 
                render: (item) => <span className="text-sm text-gray-300">{item.brand}</span> 
              },
              { 
                key: 'tax', 
                header: 'Tax', 
                render: (item) => <span className="text-sm text-gray-400">{item.tax}</span> 
              },
              { 
                key: 'sku', 
                header: 'SKU', 
                render: (item) => <span className="text-xs text-gray-500 font-mono">{item.sku}</span> 
              },
            ]}
          />
        </TabsContent>


        {/* Tab Content Area - Categories */}
        <TabsContent value="categories" className="flex-1 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
             {mockCategories.map((cat) => (
               <div key={cat.id} className="group bg-gray-900/50 border border-gray-800 hover:border-blue-500/50 hover:bg-gray-900 transition-all rounded-xl overflow-hidden p-5 flex flex-col gap-4 relative">
                 <div className="flex justify-between items-start">
                   <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                     <FolderTree size={20} />
                   </div>
                   <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-white">
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-gray-950 border-gray-800 text-white">
                        <DropdownMenuItem className="hover:bg-gray-900"><Edit2 size={14} className="mr-2"/> Edit</DropdownMenuItem>
                        <DropdownMenuItem className="hover:bg-gray-900 text-red-400"><Trash2 size={14} className="mr-2"/> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                   </DropdownMenu>
                 </div>
                 
                 <div>
                   <h3 className="text-lg font-bold text-white mb-1">{cat.name}</h3>
                   <p className="text-sm text-gray-400">{cat.count} Products</p>
                 </div>
                 
                 <div className="pt-4 border-t border-gray-800">
                   <p className="text-xs font-semibold text-gray-500 uppercase mb-3 tracking-wider">Sub-Categories</p>
                   <div className="flex flex-wrap gap-2">
                     {cat.subCategories.map((sub, idx) => (
                       <Badge key={idx} variant="secondary" className="bg-gray-800 text-gray-300 hover:bg-gray-700 border-0 font-normal">
                         {sub}
                       </Badge>
                     ))}
                     <button className="h-5 w-5 rounded-full bg-gray-800 flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-700 transition-colors">
                       <Plus size={12} />
                     </button>
                   </div>
                 </div>
               </div>
             ))}
             
             {/* Add New Category Card */}
             <button className="border border-dashed border-gray-800 rounded-xl p-5 flex flex-col items-center justify-center gap-3 text-gray-500 hover:text-blue-500 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all min-h-[200px]">
                <div className="h-12 w-12 rounded-full bg-gray-900 flex items-center justify-center border border-gray-800">
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
                <div key={brand.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col items-center text-center gap-4 hover:border-purple-500/50 transition-all group relative">
                   <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500 hover:text-white"><MoreVertical size={14} /></Button>
                   </div>
                   
                   <div className="h-16 w-16 rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-gray-800 group-hover:border-purple-500 transition-colors">
                     {/* Placeholder for Brand Logo */}
                     <span className="text-black font-bold text-xl">{brand.name.substring(0, 2).toUpperCase()}</span>
                   </div>
                   
                   <div>
                     <h3 className="font-bold text-white text-lg">{brand.name}</h3>
                     <p className="text-sm text-gray-500">{brand.country}</p>
                   </div>
                   
                   <Badge variant="outline" className="mt-auto border-gray-800 bg-gray-950 text-gray-400 group-hover:border-purple-500/30 group-hover:text-purple-400">
                     {brand.products} Products
                   </Badge>
                </div>
              ))}
              
              <button className="border border-dashed border-gray-800 rounded-xl p-6 flex flex-col items-center justify-center gap-3 text-gray-500 hover:text-purple-500 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all min-h-[200px]">
                <Plus size={24} />
                <span className="font-medium">Add Brand</span>
             </button>
           </div>
        </TabsContent>

        {/* Tab Content Area - Units */}
        <TabsContent value="units" className="flex-1 mt-0">
           <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden max-w-3xl">
              <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
                <h3 className="font-semibold text-white">Measurement Units</h3>
                <p className="text-sm text-gray-500">Manage base units for products</p>
              </div>
              <div className="divide-y divide-gray-800">
                {mockUnits.map((unit) => (
                  <div key={unit.id} className="p-4 flex items-center justify-between hover:bg-gray-900 transition-colors group">
                    <div className="flex items-center gap-4">
                       <div className="h-10 w-10 rounded-lg bg-gray-800 flex items-center justify-center text-gray-400 font-mono text-sm border border-gray-700">
                         {unit.short}
                       </div>
                       <div>
                         <p className="font-medium text-white">{unit.name}</p>
                         <p className="text-xs text-gray-500">{unit.type}</p>
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <Button variant="ghost" size="sm" className="h-8 text-gray-400 hover:text-white">Edit</Button>
                       <Button variant="ghost" size="sm" className="h-8 text-red-400 hover:text-red-300 hover:bg-red-900/20">Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-gray-900/30 border-t border-gray-800">
                 <Button variant="outline" className="w-full border-dashed border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 hover:bg-gray-800">
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