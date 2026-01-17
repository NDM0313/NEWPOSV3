import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Trash2, 
  Plus, 
  Minus, 
  Search, 
  ScanBarcode, 
  CreditCard,
  Banknote,
  Truck,
  AlertCircle,
  ArrowDownRight,
  LayoutGrid,
  Box,
  Layers,
  Package,
  Settings2,
  ShoppingBag,
  RotateCcw,
  User,
  Check,
  ChevronsUpDown,
  PlusCircle,
  X,
  Tag,
  Filter
} from 'lucide-react';
import { formatDate } from '../../../utils/dateFormat';
import { cn } from "../ui/utils";
import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { ScrollArea } from "../ui/scroll-area";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { PackingInputButton } from './PackingInputButton';
import { PackingDetails } from './PackingEntryModal';
import { SmartPaymentWidget, PaymentDetails } from './SmartPaymentWidget';
import { PaymentModal } from './PaymentModal';
import { ProductDrawer } from '../products/ProductDrawer';
import { QuickAddProductModal } from '../products/QuickAddProductModal';
import { FreightPopover, FreightDetails } from './FreightPopover';
import { QuickAddContactModal } from '../contacts/QuickAddContactModal';
import { Badge } from "../ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../ui/tabs";

// Mock Data
const initialProducts = [
  { id: 1, name: "Premium Cotton Fabric - Beige", sku: "FABRIC-001", stock: 50, price: 85, category: "Fabrics" },
  { id: 2, name: "Lawn Print - Floral Design", sku: "LAWN-045", stock: 120, price: 125, category: "Fabrics" },
  { id: 3, name: "Silk Dupatta - Red", sku: "SILK-022", stock: 35, price: 450, category: "Accessories" },
  { id: 4, name: "Unstitched 3-Piece Suit", sku: "SUIT-103", stock: 18, price: 2200, category: "Apparel" },
  { id: 5, name: "Chiffon Fabric - Mint Green", sku: "CHIFF-078", stock: 65, price: 95, category: "Fabrics" },
  { id: 6, name: "Velvet Shawl - Black", sku: "VELVET-001", stock: 12, price: 1500, category: "Winter" },
  { id: 7, name: "Linen Shirt", sku: "LIN-002", stock: 40, price: 850, category: "Apparel" },
  { id: 8, name: "Kids Kurta", sku: "KID-005", stock: 25, price: 650, category: "Kids" },
];

const categories = ["All", "Fabrics", "Apparel", "Accessories", "Winter", "Kids"];

const initialCustomers = [
  { id: 1, name: "Walk-in Customer" },
  { id: 2, name: "John Doe" },
  { id: 3, name: "Jane Smith" },
];

type TransactionType = 'sale' | 'purchase';

interface TransactionFormProps {
  type: TransactionType;
  onClose: () => void;
}

interface CartItem {
  id: number;
  name: string;
  sku: string;
  stock: number;
  qty: number;
  price: number;
  discount: number;
  packingDetails?: PackingDetails;
}

export const TransactionForm = ({ type: initialType, onClose }: TransactionFormProps) => {
  // State for POS Mode (The "Top Option")
  const [posMode, setPosMode] = useState<'retail' | 'wholesale' | 'return'>('retail');
  const [transactionType, setTransactionType] = useState<TransactionType>(initialType);

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  
  const [customers, setCustomers] = useState(initialCustomers);
  const [selectedCustomerId, setSelectedCustomerId] = useState("1");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [isQuickContactOpen, setIsQuickContactOpen] = useState(false);
  
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isProductDrawerOpen, setIsProductDrawerOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [freight, setFreight] = useState<FreightDetails | null>(null);
  const [services, setServices] = useState<{ id: number; name: string; cost: number }[]>([]);

  const isMobile = useMediaQuery('(max-width: 768px)');

  // Sync mode with type roughly
  useEffect(() => {
    if (transactionType === 'purchase') {
       // Maybe add purchase mode logic if needed
    }
  }, [transactionType]);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { ...product, qty: 1, discount: 0 }];
    });
  };

  const handleSaveAndAddProduct = (newProduct: any) => {
    setProducts(prev => [...prev, newProduct]);
    addToCart(newProduct);
    setIsProductDrawerOpen(false);
    setIsQuickAddOpen(false);
  };

  const handleSaveContact = (newContact: any) => {
    setCustomers(prev => [...prev, newContact]);
    setSelectedCustomerId(newContact.id.toString());
    setCustomerSearchOpen(false);
  };

  const updateItem = (id: number, field: keyof CartItem, value: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const removeItem = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updatePackingDetails = (id: number, packingDetails: PackingDetails) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, packingDetails, qty: packingDetails.total_meters };
      }
      return item;
    }));
  };

  const addService = () => {
    setServices([...services, { id: Date.now(), name: "Stitching", cost: 0 }]);
  };

  const removeService = (id: number) => {
    setServices(services.filter(s => s.id !== id));
  };

  const updateService = (id: number, field: 'name' | 'cost', value: string | number) => {
    setServices(services.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const totalDiscount = cart.reduce((sum, item) => sum + item.discount, 0);
  const servicesTotal = services.reduce((sum, s) => sum + s.cost, 0);
  const taxRate = 0.10;
  const tax = (subtotal - totalDiscount + servicesTotal) * taxRate;
  const shippingCost = (freight && freight.includeInInvoice) ? freight.amount : 0;
  const grandTotal = subtotal - totalDiscount + servicesTotal + tax + shippingCost;

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.includes(search);
    const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const selectedCustomer = customers.find(c => c.id.toString() === selectedCustomerId);
  const themeColor = transactionType === 'purchase' ? 'orange' : 'blue';

  return (
    <div 
      className="flex flex-col h-full overflow-hidden"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        color: 'var(--color-text-primary)'
      }}
    >
      
      {/* 1. TOP HEADER & MODE SWITCHER */}
      <div 
        className="h-16 shrink-0 border-b flex items-center justify-between px-4 sm:px-6 z-20 shadow-md"
        style={{
          backgroundColor: 'var(--color-bg-panel)',
          borderBottomColor: 'var(--color-border-primary)'
        }}
      >
        <div className="flex items-center gap-4">
           <Button 
             variant="ghost" 
             size="icon" 
             onClick={onClose}
             style={{ color: 'var(--color-text-secondary)' }}
             onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-primary)'}
             onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
           >
              <X size={20} />
           </Button>
           <h2 
             className="text-lg font-bold hidden sm:block"
             style={{ color: 'var(--color-text-primary)' }}
           >
             {transactionType === 'sale' ? 'Point of Sale' : 'Purchase Order'}
           </h2>
        </div>

        {/* CENTER: MODE SWITCHER (Segmented Control) */}
        <div 
          className="p-1 rounded-lg border flex items-center"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            borderColor: 'var(--color-border-primary)',
            borderRadius: 'var(--radius-lg)'
          }}
        >
           <button 
             onClick={() => setPosMode('retail')}
             className="px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2"
             style={{
               backgroundColor: posMode === 'retail' ? 'var(--color-primary)' : 'transparent',
               color: posMode === 'retail' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
               borderRadius: 'var(--radius-md)',
               boxShadow: posMode === 'retail' ? 'var(--shadow-blue-glow)' : 'none'
             }}
             onMouseEnter={(e) => {
               if (posMode !== 'retail') {
                 e.currentTarget.style.color = 'var(--color-text-primary)';
               }
             }}
             onMouseLeave={(e) => {
               if (posMode !== 'retail') {
                 e.currentTarget.style.color = 'var(--color-text-secondary)';
               }
             }}
           >
             <ShoppingBag size={14} />
             <span className="hidden sm:inline">Retail Sale</span>
           </button>
           <div 
             className="w-px h-4 mx-1"
             style={{ backgroundColor: 'var(--color-border-primary)' }}
           ></div>
           <button 
             onClick={() => setPosMode('wholesale')}
             className="px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2"
             style={
               posMode === 'wholesale' 
                 ? {
                     backgroundColor: 'var(--color-wholesale)',
                     color: 'var(--color-text-primary)',
                     boxShadow: 'var(--shadow-purple-glow)',
                     borderRadius: 'var(--radius-md)'
                   }
                 : {
                     color: 'var(--color-text-secondary)',
                     borderRadius: 'var(--radius-md)'
                   }
             }
             onMouseEnter={(e) => {
               if (posMode !== 'wholesale') {
                 e.currentTarget.style.color = 'var(--color-text-primary)';
               }
             }}
             onMouseLeave={(e) => {
               if (posMode !== 'wholesale') {
                 e.currentTarget.style.color = 'var(--color-text-secondary)';
               }
             }}
           >
             <Truck size={14} />
             <span className="hidden sm:inline">Wholesale</span>
           </button>
           <div 
             className="w-px h-4 mx-1"
             style={{ backgroundColor: 'var(--color-border-primary)' }}
           ></div>
           <button 
             onClick={() => setPosMode('return')}
             className="px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2"
             style={
               posMode === 'return' 
                 ? {
                     backgroundColor: 'var(--color-warning)',
                     color: 'var(--color-text-primary)',
                     boxShadow: 'var(--shadow-orange-glow)',
                     borderRadius: 'var(--radius-md)'
                   }
                 : {
                     color: 'var(--color-text-secondary)',
                     borderRadius: 'var(--radius-md)'
                   }
             }
             onMouseEnter={(e) => {
               if (posMode !== 'return') {
                 e.currentTarget.style.color = 'var(--color-text-primary)';
               }
             }}
             onMouseLeave={(e) => {
               if (posMode !== 'return') {
                 e.currentTarget.style.color = 'var(--color-text-secondary)';
               }
             }}
           >
             <RotateCcw size={14} />
             <span className="hidden sm:inline">Returns</span>
           </button>
        </div>

        <div className="flex items-center gap-3">
          <div 
            className="hidden sm:flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border"
            style={{
              color: 'var(--color-text-secondary)',
              backgroundColor: 'var(--color-bg-primary)',
              borderColor: 'var(--color-border-primary)',
              borderRadius: '9999px'
            }}
          >
             <div 
               className="w-2 h-2 rounded-full animate-pulse"
               style={{ backgroundColor: 'var(--color-success)' }}
             ></div>
             Online
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
          >
             <Settings2 size={20} />
          </Button>
        </div>
      </div>

      {/* 2. MAIN LAYOUT GRID */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
        
        {/* LEFT PANEL: PRODUCT CATALOG (Span 7 or 8) */}
        <div 
          className="hidden md:flex md:col-span-7 lg:col-span-8 flex-col border-r"
          style={{
            borderRightColor: 'var(--color-border-primary)',
            backgroundColor: 'var(--color-bg-primary)'
          }}
        >
           {/* Catalog Toolbar */}
           <div 
             className="p-4 border-b space-y-4"
             style={{
               borderBottomColor: 'var(--color-border-primary)',
               backgroundColor: 'var(--color-bg-primary)'
             }}
           >
              {/* Search Bar */}
              <div className="relative">
                 <Search 
                   className="absolute left-4 top-1/2 -translate-y-1/2" 
                   size={20}
                   style={{ color: 'var(--color-text-tertiary)' }}
                 />
                 <Input 
                   className="pl-12 h-12 rounded-xl text-base"
                   style={{
                     backgroundColor: 'var(--color-bg-panel)',
                     borderColor: 'var(--color-border-primary)',
                     color: 'var(--color-text-primary)',
                     borderRadius: 'var(--radius-xl)'
                   }}
                   placeholder="Search products by name, SKU, or scan barcode..."
                   value={search}
                   onChange={(e) => setSearch(e.target.value)}
                 />
                 <Button 
                   className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                   style={{
                     backgroundColor: 'var(--color-bg-card)',
                     color: 'var(--color-text-secondary)'
                   }}
                   onMouseEnter={(e) => {
                     e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                   }}
                   onMouseLeave={(e) => {
                     e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                   }}
                 >
                    <ScanBarcode size={16} />
                 </Button>
              </div>

              {/* Categories Pills */}
              <ScrollArea className="w-full whitespace-nowrap pb-2">
                 <div className="flex gap-2">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={cn(
                          "px-4 py-2 rounded-full text-sm font-medium transition-all border",
                          selectedCategory === cat 
                            ? "bg-white text-black border-white" 
                            : {
                                backgroundColor: 'var(--color-bg-panel)',
                                color: 'var(--color-text-secondary)',
                                borderColor: 'var(--color-border-primary)'
                              }
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                 </div>
              </ScrollArea>
           </div>

           {/* Product Grid */}
           <div 
             className="flex-1 overflow-y-auto p-4"
             style={{ backgroundColor: 'var(--color-bg-panel)' }}
           >
              {filteredProducts.length === 0 ? (
                 <div 
                   className="h-full flex flex-col items-center justify-center gap-4"
                   style={{ color: 'var(--color-text-tertiary)' }}
                 >
                    <div 
                      className="w-20 h-20 rounded-full flex items-center justify-center"
                      style={{
                        backgroundColor: 'rgba(31, 41, 55, 0.5)', // bg-gray-800/50
                        borderRadius: '9999px'
                      }}
                    >
                       <Search size={32} opacity={0.5} />
                    </div>
                    <p>No products found</p>
                    <Button variant="outline" onClick={() => setIsQuickAddOpen(true)}>Add New Product</Button>
                 </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                   {filteredProducts.map(product => (
                      <button 
                        key={product.id}
                        onClick={() => addToCart(product)}
                        className="flex flex-col border rounded-xl overflow-hidden transition-all text-left group"
                        style={{
                          backgroundColor: 'var(--color-bg-primary)',
                          borderColor: 'var(--color-border-primary)',
                          borderRadius: 'var(--radius-xl)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'; // border-blue-500/50
                          e.currentTarget.style.boxShadow = 'var(--shadow-blue-glow)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                         <div 
                           className="aspect-[4/3] w-full relative"
                           style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
                         >
                            {/* Placeholder Image */}
                            <div 
                              className="absolute inset-0 flex items-center justify-center"
                              style={{
                                color: 'var(--color-text-tertiary)',
                                backgroundColor: 'var(--color-bg-panel)'
                              }}
                            >
                               <Package size={32} />
                            </div>
                            <div className="absolute top-2 right-2">
                               <Badge 
                                 className="backdrop-blur border-0"
                                 style={{
                                   backgroundColor: 'rgba(0, 0, 0, 0.5)',
                                   color: product.stock < 10 ? 'var(--color-error)' : 'var(--color-success)'
                                 }}
                               >
                                  {product.stock} left
                               </Badge>
                            </div>
                         </div>
                         <div className="p-3 flex-1 flex flex-col">
                            <h3 
                              className="font-medium text-sm line-clamp-2 transition-colors"
                              style={{ color: 'var(--color-text-primary)' }}
                              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-primary)'}
                            >
                               {product.name}
                            </h3>
                            <p 
                              className="text-xs mt-1 mb-2"
                              style={{ color: 'var(--color-text-tertiary)' }}
                            >
                              {product.sku}
                            </p>
                            <div className="mt-auto flex items-center justify-between">
                               <span 
                                 className="font-bold"
                                 style={{ color: 'var(--color-text-primary)' }}
                               >
                                 ${product.price}
                               </span>
                               <div 
                                 className="w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0"
                                 style={{
                                   backgroundColor: 'var(--color-primary)',
                                   color: 'var(--color-text-primary)',
                                   borderRadius: '9999px'
                                 }}
                               >
                                  <Plus size={14} />
                               </div>
                            </div>
                         </div>
                      </button>
                   ))}
                   
                   {/* Add New Card */}
                   <button 
                      onClick={() => setIsQuickAddOpen(true)}
                      className="flex flex-col items-center justify-center border border-dashed rounded-xl min-h-[200px] transition-all gap-3"
                      style={{
                        backgroundColor: 'var(--color-bg-primary)',
                        borderColor: 'var(--color-border-primary)',
                        borderRadius: 'var(--radius-xl)',
                        color: 'var(--color-text-tertiary)',
                        borderStyle: 'dashed'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                      }}
                   >
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center"
                        style={{
                          backgroundColor: 'var(--color-bg-card)',
                          borderRadius: '9999px'
                        }}
                      >
                         <Plus size={24} />
                      </div>
                      <span className="font-medium">Add Manual Item</span>
                   </button>
                </div>
              )}
           </div>
        </div>

        {/* RIGHT PANEL: CART & CHECKOUT (Span 5 or 4) */}
        <div 
          className="col-span-1 md:col-span-5 lg:col-span-4 flex flex-col h-full border-l shadow-2xl z-10"
          style={{
            backgroundColor: 'var(--color-bg-panel)',
            borderLeftColor: 'var(--color-border-primary)'
          }}
        >
           
           {/* Customer & Date Header */}
           <div 
             className="p-4 border-b space-y-3"
             style={{
               borderBottomColor: 'var(--color-border-primary)',
               backgroundColor: 'var(--color-bg-panel)'
             }}
           >
              <div className="flex items-center justify-between">
                 <h3 
                   className="font-semibold flex items-center gap-2"
                   style={{ color: 'var(--color-text-primary)' }}
                 >
                    <User size={16} style={{ color: 'var(--color-primary)' }} />
                    Customer Details
                 </h3>
                 <Button 
                   variant="ghost" 
                   size="sm" 
                   className="h-7 text-xs p-0" 
                   onClick={() => setIsQuickContactOpen(true)}
                   style={{ color: 'var(--color-primary)' }}
                   onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary-hover)'}
                   onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                 >
                    + New Customer
                 </Button>
              </div>
              
              <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerSearchOpen}
                    className="w-full justify-between h-11"
                    style={{
                      backgroundColor: 'var(--color-bg-primary)',
                      borderColor: 'var(--color-border-primary)',
                      color: 'var(--color-text-primary)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                      e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                      e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                    }}
                  >
                    {selectedCustomer ? (
                      <div className="flex items-center gap-3">
                         <div 
                           className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                           style={{
                             backgroundColor: 'rgba(37, 99, 235, 0.2)', // bg-blue-600/20
                             color: 'var(--color-primary)',
                             borderRadius: '9999px'
                           }}
                         >
                            {selectedCustomer.name.substring(0, 1)}
                         </div>
                         <div className="flex flex-col items-start">
                            <span className="text-sm font-medium leading-none">{selectedCustomer.name}</span>
                         </div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--color-text-tertiary)' }}>
                        Select Customer
                      </span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-[350px] p-0"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    borderColor: 'var(--color-border-primary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  <Command 
                    style={{
                      backgroundColor: 'var(--color-bg-primary)',
                      color: 'var(--color-text-primary)'
                    }}
                  >
                    <CommandInput 
                      placeholder="Search customer..." 
                      className="h-9 border-none focus:ring-0" 
                      value={customerSearchTerm} 
                      onValueChange={setCustomerSearchTerm}
                      style={{ color: 'var(--color-text-primary)' }}
                    />
                    <CommandList>
                      <CommandEmpty>No customer found.</CommandEmpty>
                      <CommandGroup>
                        {customers.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={customer.name}
                            onSelect={() => {
                              setSelectedCustomerId(customer.id.toString());
                              setCustomerSearchOpen(false);
                            }}
                            className="cursor-pointer"
                            style={{
                              color: 'var(--color-text-primary)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedCustomerId === customer.id.toString() ? "opacity-100" : "opacity-0")} />
                            {customer.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <div className="grid grid-cols-2 gap-3">
                 <div 
                   className="border rounded-lg p-2 flex flex-col"
                   style={{
                     backgroundColor: 'var(--color-bg-primary)',
                     borderColor: 'var(--color-border-primary)',
                     borderRadius: 'var(--radius-lg)'
                   }}
                 >
                    <label className="text-[10px] uppercase font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>
                      Invoice Date
                    </label>
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                      {date ? formatDate(date) : "Today"}
                    </span>
                 </div>
                 <div 
                   className="border rounded-lg p-2 flex flex-col"
                   style={{
                     backgroundColor: 'var(--color-bg-primary)',
                     borderColor: 'var(--color-border-primary)',
                     borderRadius: 'var(--radius-lg)'
                   }}
                 >
                    <label className="text-[10px] uppercase font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>
                      Order ID
                    </label>
                    <span 
                      className="text-sm font-medium"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      #ORD-{Math.floor(Math.random() * 10000)}
                    </span>
                 </div>
              </div>
           </div>

           {/* Cart Items List */}
           <div 
             className="flex-1 overflow-y-auto p-2 space-y-1"
             style={{ backgroundColor: 'var(--color-bg-panel)' }}
           >
              {cart.length === 0 ? (
                 <div 
                   className="h-full flex flex-col items-center justify-center p-8 text-center"
                   style={{ 
                     color: 'var(--color-text-tertiary)',
                     opacity: 0.6
                   }}
                 >
                    <ShoppingBag 
                      size={48} 
                      className="mb-4"
                      style={{ color: 'var(--color-text-disabled)' }}
                    />
                    <h4 
                      className="text-lg font-medium"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Cart is Empty
                    </h4>
                    <p className="text-sm mt-1">Select products from the left to start a sale.</p>
                 </div>
              ) : (
                 cart.map((item) => (
                    <div 
                      key={item.id} 
                      className="border p-3 rounded-xl flex gap-3 group transition-colors relative"
                      style={{
                        backgroundColor: 'var(--color-bg-primary)',
                        borderColor: 'rgba(31, 41, 55, 0.5)', // border-gray-800/50
                        borderRadius: 'var(--radius-xl)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(31, 41, 55, 0.5)';
                      }}
                    >
                       {/* Remove Button (Hover) */}
                       <button 
                          onClick={() => removeItem(item.id)}
                          className="absolute -top-2 -right-2 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-10"
                          style={{
                            backgroundColor: 'var(--color-error)',
                            color: 'var(--color-text-primary)',
                            borderRadius: '9999px'
                          }}
                       >
                          <X size={12} />
                       </button>

                       {/* Image Thumbnail */}
                       <div 
                         className="h-16 w-16 rounded-lg border flex items-center justify-center shrink-0"
                         style={{
                           backgroundColor: 'var(--color-bg-panel)',
                           borderColor: 'var(--color-border-primary)',
                           borderRadius: 'var(--radius-lg)',
                           color: 'var(--color-text-disabled)'
                         }}
                       >
                          <Package size={20} />
                       </div>

                       {/* Info */}
                       <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                             <div>
                                <h4 
                                  className="font-medium text-sm truncate pr-2"
                                  style={{ color: 'var(--color-text-primary)' }}
                                >
                                  {item.name}
                                </h4>
                                <p 
                                  className="text-xs"
                                  style={{ color: 'var(--color-text-tertiary)' }}
                                >
                                  {item.sku}
                                </p>
                             </div>
                             <span 
                               className="font-bold text-sm"
                               style={{ color: 'var(--color-text-primary)' }}
                             >
                               ${(item.price * item.qty).toFixed(2)}
                             </span>
                          </div>

                          <div className="flex items-center justify-between mt-3">
                             <div 
                               className="flex items-center gap-1 rounded-lg p-0.5"
                               style={{
                                 backgroundColor: 'var(--color-bg-panel)',
                                 borderColor: 'var(--color-border-primary)',
                                 borderRadius: 'var(--radius-lg)'
                               }}
                             >
                                <button 
                                   onClick={() => item.qty > 1 && updateItem(item.id, 'qty', item.qty - 1)}
                                   className="h-6 w-6 flex items-center justify-center rounded"
                                   style={{
                                     color: 'var(--color-text-secondary)',
                                     borderRadius: 'var(--radius-md)'
                                   }}
                                   onMouseEnter={(e) => {
                                     e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                                     e.currentTarget.style.color = 'var(--color-text-primary)';
                                   }}
                                   onMouseLeave={(e) => {
                                     e.currentTarget.style.backgroundColor = 'transparent';
                                     e.currentTarget.style.color = 'var(--color-text-secondary)';
                                   }}
                                >
                                   <Minus size={12} />
                                </button>
                                <input 
                                   type="text" 
                                   value={item.qty} 
                                   readOnly 
                                   className="w-8 text-center bg-transparent text-sm font-medium focus:outline-none"
                                   style={{ color: 'var(--color-text-primary)' }} 
                                />
                                <button 
                                   onClick={() => updateItem(item.id, 'qty', item.qty + 1)}
                                   className="h-6 w-6 flex items-center justify-center rounded"
                                   style={{
                                     color: 'var(--color-text-secondary)',
                                     borderRadius: 'var(--radius-md)'
                                   }}
                                   onMouseEnter={(e) => {
                                     e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                                     e.currentTarget.style.color = 'var(--color-text-primary)';
                                   }}
                                   onMouseLeave={(e) => {
                                     e.currentTarget.style.backgroundColor = 'transparent';
                                     e.currentTarget.style.color = 'var(--color-text-secondary)';
                                   }}
                                >
                                   <Plus size={12} />
                                </button>
                             </div>
                             
                             <div 
                               className="text-xs"
                               style={{ color: 'var(--color-text-secondary)' }}
                             >
                                ${item.price} x {item.qty}
                             </div>
                          </div>
                       </div>
                    </div>
                 ))
              )}
           </div>

           {/* Totals & Actions */}
           <div 
             className="border-t p-4 space-y-4 z-20"
             style={{
               backgroundColor: 'var(--color-bg-primary)',
               borderTopColor: 'var(--color-border-primary)',
               boxShadow: 'var(--shadow-deep)' // shadow-[0_-10px_40px_rgba(0,0,0,0.5)]
             }}
           >
              <div className="space-y-2 text-sm">
                 <div 
                   className="flex justify-between"
                   style={{ color: 'var(--color-text-secondary)' }}
                 >
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                 </div>
                 <div 
                   className="flex justify-between"
                   style={{ color: 'var(--color-text-secondary)' }}
                 >
                    <span>Tax (10%)</span>
                    <span>${tax.toFixed(2)}</span>
                 </div>
                 <div 
                   className="flex justify-between"
                   style={{ color: 'var(--color-text-secondary)' }}
                 >
                    <span>Discount</span>
                    <span className="text-red-400">-${totalDiscount.toFixed(2)}</span>
                 </div>
                 {shippingCost > 0 && (
                   <div 
                   className="flex justify-between"
                   style={{ color: 'var(--color-text-secondary)' }}
                 >
                      <span>Shipping</span>
                      <span>${shippingCost.toFixed(2)}</span>
                   </div>
                 )}
                 <div 
                   className="pt-3 border-t flex justify-between items-center"
                   style={{ borderTopColor: 'var(--color-border-primary)' }}
                 >
                    <span 
                      className="text-base font-bold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Grand Total
                    </span>
                    <span 
                      className="text-2xl font-bold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      ${grandTotal.toFixed(2)}
                    </span>
                 </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                 <Button 
                   variant="outline" 
                   className="col-span-1 h-12 flex flex-col gap-1 text-[10px]"
                   style={{
                     borderColor: 'var(--color-border-secondary)',
                     color: 'var(--color-text-secondary)'
                   }}
                   onMouseEnter={(e) => {
                     e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                     e.currentTarget.style.color = 'var(--color-text-primary)';
                   }}
                   onMouseLeave={(e) => {
                     e.currentTarget.style.backgroundColor = 'transparent';
                     e.currentTarget.style.color = 'var(--color-text-secondary)';
                   }}
                 >
                    <Tag size={16} />
                    Discount
                 </Button>
                 <Button 
                   variant="outline" 
                   className="col-span-1 h-12 flex flex-col gap-1 text-[10px]"
                   style={{
                     borderColor: 'var(--color-border-secondary)',
                     color: 'var(--color-text-secondary)'
                   }}
                   onMouseEnter={(e) => {
                     e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                     e.currentTarget.style.color = 'var(--color-text-primary)';
                   }}
                   onMouseLeave={(e) => {
                     e.currentTarget.style.backgroundColor = 'transparent';
                     e.currentTarget.style.color = 'var(--color-text-secondary)';
                   }}
                 >
                    <CreditCard size={16} />
                    Card
                 </Button>
                 <Button 
                    className="col-span-2 h-12 text-base font-bold shadow-lg"
                    style={{
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-text-primary)',
                      boxShadow: 'var(--shadow-blue-glow)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                    }}
                    onClick={() => setIsPaymentModalOpen(true)}
                    disabled={cart.length === 0}
                 >
                    Pay Now
                 </Button>
              </div>
           </div>
        </div>
      </div>

      {/* Modals */}
      <QuickAddContactModal 
        isOpen={isQuickContactOpen} 
        onClose={() => setIsQuickContactOpen(false)} 
        onSave={handleSaveContact} 
      />
      
      <QuickAddProductModal 
         isOpen={isQuickAddOpen}
         onClose={() => setIsQuickAddOpen(false)}
         onSave={handleSaveAndAddProduct}
      />
      
      <ProductDrawer
        isOpen={isProductDrawerOpen}
        onClose={() => setIsProductDrawerOpen(false)}
      />

      <PaymentModal 
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        totalAmount={grandTotal}
        onProcessPayment={(details) => {
          setPaymentDetails(details);
          setIsPaymentModalOpen(false);
          // Here you would typically save the transaction
          onClose(); 
        }}
      />
    </div>
  );
};