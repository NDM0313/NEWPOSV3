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
import { format } from "date-fns";
import { cn } from "../ui/utils";
import { formatQty } from '@/app/utils/quantity';
import { Button } from "../ui/button";
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
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
      
      {/* 1. TOP HEADER & MODE SWITCHER */}
      <div className="h-16 shrink-0 bg-popover border-b border-border flex items-center justify-between px-4 sm:px-6 z-20 shadow-md">
        <div className="flex items-center gap-4">
           <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X size={20} />
           </Button>
           <h2 className="text-lg font-bold text-foreground hidden sm:block">
             {transactionType === 'sale' ? 'Point of Sale' : 'Purchase Order'}
           </h2>
        </div>

        {/* CENTER: MODE SWITCHER (Segmented Control) */}
        <div className="bg-background p-1 rounded-lg border border-border flex items-center">
           <button 
             onClick={() => setPosMode('retail')}
             className={cn(
               "px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2",
               posMode === 'retail' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-muted-foreground hover:text-foreground"
             )}
           >
             <ShoppingBag size={14} />
             <span className="hidden sm:inline">Retail Sale</span>
           </button>
           <div className="w-px h-4 bg-muted mx-1"></div>
           <button 
             onClick={() => setPosMode('wholesale')}
             className={cn(
               "px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2",
               posMode === 'wholesale' ? "bg-purple-600 text-white shadow-lg shadow-purple-900/20" : "text-muted-foreground hover:text-foreground"
             )}
           >
             <Truck size={14} />
             <span className="hidden sm:inline">Wholesale</span>
           </button>
           <div className="w-px h-4 bg-muted mx-1"></div>
           <button 
             onClick={() => setPosMode('return')}
             className={cn(
               "px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2",
               posMode === 'return' ? "bg-orange-600 text-white shadow-lg shadow-orange-900/20" : "text-muted-foreground hover:text-foreground"
             )}
           >
             <RotateCcw size={14} />
             <span className="hidden sm:inline">Returns</span>
           </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground bg-background px-3 py-1.5 rounded-full border border-border">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
             Online
          </div>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
             <Settings2 size={20} />
          </Button>
        </div>
      </div>

      {/* 2. MAIN LAYOUT GRID */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
        
        {/* LEFT PANEL: PRODUCT CATALOG (Span 7 or 8) */}
        <div className="hidden md:flex md:col-span-7 lg:col-span-8 flex-col border-r border-border bg-background">
           {/* Catalog Toolbar */}
           <div className="p-4 border-b border-border space-y-4 bg-background">
              {/* Search Bar */}
              <div className="relative">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                 <Input 
                   className="pl-12 h-12 bg-popover border-border text-foreground placeholder:text-muted-foreground rounded-xl text-base focus:ring-blue-500/20 focus:border-blue-500"
                   placeholder="Search products by name, SKU, or scan barcode..."
                   value={search}
                   onChange={(e) => setSearch(e.target.value)}
                 />
                 <Button className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 bg-muted hover:bg-muted text-muted-foreground">
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
                            : "bg-popover text-muted-foreground border-border hover:border-gray-600 hover:text-foreground"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                 </div>
              </ScrollArea>
           </div>

           {/* Product Grid */}
           <div className="flex-1 overflow-y-auto p-4 bg-[#0F1623]">
              {filteredProducts.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4">
                    <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center">
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
                        className="flex flex-col bg-background border border-border hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-900/10 rounded-xl overflow-hidden transition-all text-left group"
                      >
                         <div className="aspect-[4/3] bg-card w-full relative">
                            {/* Placeholder Image */}
                            <div className="absolute inset-0 flex items-center justify-center text-gray-700 bg-popover">
                               <Package size={32} />
                            </div>
                            <div className="absolute top-2 right-2">
                               <Badge className={cn("bg-black/50 backdrop-blur text-foreground border-0", product.stock < 10 ? "text-red-400" : "text-[var(--erp-money-positive)]")}>
                                  {formatQty(product.stock)} left
                               </Badge>
                            </div>
                         </div>
                         <div className="p-3 flex-1 flex flex-col">
                            <h3 className="font-medium text-gray-200 text-sm line-clamp-2 group-hover:text-blue-400 transition-colors">
                               {product.name}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1 mb-2">{product.sku}</p>
                            <div className="mt-auto flex items-center justify-between">
                               <span className="font-bold text-foreground">${product.price}</span>
                               <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                                  <Plus size={14} />
                               </div>
                            </div>
                         </div>
                      </button>
                   ))}
                   
                   {/* Add New Card */}
                   <button 
                      onClick={() => setIsQuickAddOpen(true)}
                      className="flex flex-col items-center justify-center bg-background border border-dashed border-border hover:border-gray-600 hover:bg-card rounded-xl min-h-[200px] transition-all gap-3 text-muted-foreground"
                   >
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                         <Plus size={24} />
                      </div>
                      <span className="font-medium">Add Manual Item</span>
                   </button>
                </div>
              )}
           </div>
        </div>

        {/* RIGHT PANEL: CART & CHECKOUT (Span 5 or 4) */}
        <div className="col-span-1 md:col-span-5 lg:col-span-4 flex flex-col h-full bg-popover border-l border-border shadow-2xl z-10">
           
           {/* Customer & Date Header */}
           <div className="p-4 border-b border-border bg-popover space-y-3">
              <div className="flex items-center justify-between">
                 <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <User size={16} className="text-blue-500" />
                    Customer Details
                 </h3>
                 <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-400 hover:text-blue-300 p-0" onClick={() => setIsQuickContactOpen(true)}>
                    + New Customer
                 </Button>
              </div>
              
              <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerSearchOpen}
                    className="w-full justify-between bg-background border-border text-foreground hover:bg-muted hover:text-foreground hover:border-border h-11"
                  >
                    {selectedCustomer ? (
                      <div className="flex items-center gap-3">
                         <div className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-500 flex items-center justify-center text-xs font-bold">
                            {selectedCustomer.name.substring(0, 1)}
                         </div>
                         <div className="flex flex-col items-start">
                            <span className="text-sm font-medium leading-none">{selectedCustomer.name}</span>
                         </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Select Customer</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0 bg-background border-border text-foreground">
                  <Command className="bg-background text-foreground">
                    <CommandInput placeholder="Search customer..." className="h-9 border-none focus:ring-0 text-foreground" value={customerSearchTerm} onValueChange={setCustomerSearchTerm} />
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
                            className="text-foreground hover:bg-muted cursor-pointer"
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
                 <div className="bg-background border border-border rounded-lg p-2 flex flex-col">
                    <label className="text-[10px] text-muted-foreground uppercase font-semibold">Invoice Date</label>
                    <span className="text-sm text-muted-foreground font-medium">{date ? format(date, "MMM dd, yyyy") : "Today"}</span>
                 </div>
                 <div className="bg-background border border-border rounded-lg p-2 flex flex-col">
                    <label className="text-[10px] text-muted-foreground uppercase font-semibold">Order ID</label>
                    <span className="text-sm text-muted-foreground font-medium">#ORD-{Math.floor(Math.random() * 10000)}</span>
                 </div>
              </div>
           </div>

           {/* Cart Items List */}
           <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-popover">
              {cart.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center opacity-60">
                    <ShoppingBag size={48} className="mb-4 text-gray-700" />
                    <h4 className="text-lg font-medium text-muted-foreground">Cart is Empty</h4>
                    <p className="text-sm mt-1">Select products from the left to start a sale.</p>
                 </div>
              ) : (
                 cart.map((item) => (
                    <div key={item.id} className="bg-background border border-border p-3 rounded-xl flex gap-3 group hover:border-border transition-colors relative">
                       {/* Remove Button (Hover) */}
                       <button 
                          onClick={() => removeItem(item.id)}
                          className="absolute -top-2 -right-2 bg-red-500 text-foreground p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-10"
                       >
                          <X size={12} />
                       </button>

                       {/* Image Thumbnail */}
                       <div className="h-16 w-16 bg-popover rounded-lg border border-border flex items-center justify-center text-muted-foreground shrink-0">
                          <Package size={20} />
                       </div>

                       {/* Info */}
                       <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                             <div>
                                <h4 className="font-medium text-gray-200 text-sm truncate pr-2">{item.name}</h4>
                                <p className="text-xs text-muted-foreground">{item.sku}</p>
                             </div>
                             <span className="font-bold text-foreground text-sm">${(item.price * item.qty).toFixed(2)}</span>
                          </div>

                          <div className="flex items-center justify-between mt-3">
                             <div className="flex items-center gap-1 bg-popover rounded-lg border border-border p-0.5">
                                <button 
                                   onClick={() => item.qty > 1 && updateItem(item.id, 'qty', item.qty - 1)}
                                   className="h-6 w-6 flex items-center justify-center hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                                >
                                   <Minus size={12} />
                                </button>
                                <input 
                                   type="text" 
                                   value={item.qty} 
                                   readOnly 
                                   className="w-8 text-center bg-transparent text-sm font-medium text-foreground focus:outline-none" 
                                />
                                <button 
                                   onClick={() => updateItem(item.id, 'qty', item.qty + 1)}
                                   className="h-6 w-6 flex items-center justify-center hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                                >
                                   <Plus size={12} />
                                </button>
                             </div>
                             
                             <div className="text-xs text-muted-foreground">
                                ${item.price} x {item.qty}
                             </div>
                          </div>
                       </div>
                    </div>
                 ))
              )}
           </div>

           {/* Totals & Actions */}
           <div className="bg-background border-t border-border p-4 space-y-4 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-20">
              <div className="space-y-2 text-sm">
                 <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                 </div>
                 <div className="flex justify-between text-muted-foreground">
                    <span>Tax (10%)</span>
                    <span>${tax.toFixed(2)}</span>
                 </div>
                 <div className="flex justify-between text-muted-foreground">
                    <span>Discount</span>
                    <span className="text-red-400">-${totalDiscount.toFixed(2)}</span>
                 </div>
                 {shippingCost > 0 && (
                   <div className="flex justify-between text-muted-foreground">
                      <span>Shipping</span>
                      <span>${shippingCost.toFixed(2)}</span>
                   </div>
                 )}
                 <div className="pt-3 border-t border-border flex justify-between items-center">
                    <span className="text-base font-bold text-foreground">Grand Total</span>
                    <span className="text-2xl font-bold text-foreground">${grandTotal.toFixed(2)}</span>
                 </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                 <Button variant="outline" className="col-span-1 border-border hover:bg-muted hover:text-foreground text-muted-foreground h-12 flex flex-col gap-1 text-[10px]">
                    <Tag size={16} />
                    Discount
                 </Button>
                 <Button variant="outline" className="col-span-1 border-border hover:bg-muted hover:text-foreground text-muted-foreground h-12 flex flex-col gap-1 text-[10px]">
                    <CreditCard size={16} />
                    Card
                 </Button>
                 <Button 
                    className="col-span-2 bg-blue-600 hover:bg-blue-500 text-white h-12 text-base font-bold shadow-lg shadow-blue-900/20"
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