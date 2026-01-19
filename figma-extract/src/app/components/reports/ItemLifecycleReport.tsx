import React from 'react';
import { 
  Search, 
  Calendar as CalendarIcon, 
  MapPin, 
  ArrowUpRight, 
  ArrowDownRight,
  Package,
  TrendingUp
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { cn } from "../ui/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { ImageWithFallback } from "../figma/ImageWithFallback";

// Mock Data
const productInfo = {
  name: "Bridal Maxi Red",
  sku: "SKU-101",
  currentStock: 77,
  avgCost: 500,
  image: "https://images.unsplash.com/photo-1594576722512-582bcd46fba3?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
};

const movementData = [
  { id: 1, date: "28-Dec-2025", type: "Sale", ref: "INV-10023", party: "Mrs. Saad", change: -1, balance: 77 },
  { id: 2, date: "25-Dec-2025", type: "Purchase", ref: "PO-9921", party: "Silk Traders Ltd", change: 50, balance: 78 },
  { id: 3, date: "20-Dec-2025", type: "Sale", ref: "INV-10019", party: "Walk-in Customer", change: -2, balance: 28 },
  { id: 4, date: "15-Dec-2025", type: "Return", ref: "RET-004", party: "Bridal Boutique", change: 1, balance: 30 },
  { id: 5, date: "01-Dec-2025", type: "Purchase", ref: "PO-9900", party: "Silk Traders Ltd", change: 20, balance: 29 },
  { id: 6, date: "28-Nov-2025", type: "Sale", ref: "INV-9980", party: "Zara Ahmed", change: -1, balance: 9 },
];

export const ItemLifecycleReport = () => {
  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-white">Item Lifecycle Report</h2>
        <div className="flex flex-wrap gap-2">
           <Button variant="outline" size="sm" className="border-gray-700 text-gray-300">Export</Button>
           <Button variant="outline" size="sm" className="border-gray-700 text-gray-300">Print</Button>
        </div>
      </div>

      {/* 1. Header Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-900/50 p-6 rounded-xl border border-gray-800">
        <div className="md:col-span-2">
           <label className="text-xs text-gray-500 mb-1.5 block font-medium">Product Search</label>
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input 
                placeholder="Search by name or SKU..." 
                className="pl-9 bg-gray-950 border-gray-700 text-white h-11"
                defaultValue="Bridal Maxi Red (SKU-101)"
              />
           </div>
        </div>
        
        <div>
           <label className="text-xs text-gray-500 mb-1.5 block font-medium">Location</label>
           <Select defaultValue="all">
             <SelectTrigger className="bg-gray-950 border-gray-700 text-white h-11">
               <SelectValue placeholder="Select Branch" />
             </SelectTrigger>
             <SelectContent className="bg-gray-900 border-gray-800 text-white">
               <SelectItem value="all">All Locations</SelectItem>
               <SelectItem value="main">Main Branch</SelectItem>
               <SelectItem value="warehouse">Warehouse</SelectItem>
             </SelectContent>
           </Select>
        </div>

        <div>
           <label className="text-xs text-gray-500 mb-1.5 block font-medium">Date Range</label>
           <Button variant="outline" className="w-full justify-start text-left font-normal bg-gray-950 border-gray-700 text-white h-11">
             <CalendarIcon className="mr-2 h-4 w-4" />
             <span>Last 30 Days</span>
           </Button>
        </div>
      </div>

      {/* 2. Product Summary Strip */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border border-gray-700 p-4 rounded-xl flex flex-col md:flex-row items-center gap-6 shadow-lg">
        <div className="h-16 w-16 rounded-lg overflow-hidden border border-gray-600 shrink-0 bg-gray-800">
           <ImageWithFallback 
             src={productInfo.image} 
             alt={productInfo.name} 
             className="h-full w-full object-cover"
           />
        </div>
        
        <div className="flex-1 text-center md:text-left">
           <h3 className="text-xl font-bold text-white">{productInfo.name}</h3>
           <p className="text-gray-400 text-sm font-mono mt-0.5">{productInfo.sku}</p>
        </div>

        <div className="flex items-center gap-8 md:pr-4 w-full md:w-auto justify-around md:justify-end">
           <div className="text-center md:text-right">
              <p className="text-gray-400 text-xs uppercase tracking-wider font-medium mb-1">Current Stock</p>
              <div className="flex items-center justify-center md:justify-end gap-2">
                 <Package size={18} className="text-blue-500" />
                 <span className="text-3xl font-bold text-white">{productInfo.currentStock}</span>
              </div>
           </div>
           
           <div className="h-10 w-px bg-gray-700 hidden md:block"></div>

           <div className="text-center md:text-right">
              <p className="text-gray-400 text-xs uppercase tracking-wider font-medium mb-1">Avg Cost</p>
              <div className="flex items-center justify-center md:justify-end gap-2">
                 <TrendingUp size={18} className="text-green-500" />
                 <span className="text-2xl font-bold text-white">Rs {productInfo.avgCost}</span>
              </div>
           </div>
        </div>
      </div>

      {/* 3. The "Movement" Table */}
      <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900/30 shadow-sm">
        <Table>
          <TableHeader className="bg-gray-950">
            <TableRow className="border-gray-800 hover:bg-gray-950">
              <TableHead className="text-gray-400 h-12">Date</TableHead>
              <TableHead className="text-gray-400 h-12">Type</TableHead>
              <TableHead className="text-gray-400 h-12">Ref No</TableHead>
              <TableHead className="text-gray-400 h-12">Party Name</TableHead>
              <TableHead className="text-center text-gray-400 h-12">Qty Change</TableHead>
              <TableHead className="text-right text-white font-bold h-12">New Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movementData.map((row) => (
              <TableRow 
                key={row.id} 
                className={cn(
                  "border-gray-800 transition-colors",
                  row.type === 'Sale' ? 'bg-red-950/10 hover:bg-red-950/20' : 
                  row.type === 'Purchase' ? 'bg-green-950/10 hover:bg-green-950/20' : 
                  'hover:bg-gray-800/30'
                )}
              >
                <TableCell className="text-gray-300 font-mono text-xs py-4">{row.date}</TableCell>
                <TableCell className="py-4">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border",
                    row.type === 'Sale' ? "bg-red-500/10 text-red-400 border-red-500/20" :
                    row.type === 'Purchase' ? "bg-green-500/10 text-green-400 border-green-500/20" :
                    "bg-gray-700/50 text-gray-300 border-gray-600"
                  )}>
                    {row.type === 'Sale' && <ArrowUpRight size={12} />}
                    {row.type === 'Purchase' && <ArrowDownRight size={12} />}
                    {row.type}
                  </span>
                </TableCell>
                <TableCell className="py-4">
                  <span className="text-blue-400 hover:text-blue-300 hover:underline cursor-pointer text-sm font-medium">
                    {row.ref}
                  </span>
                </TableCell>
                <TableCell className="text-gray-300 font-medium py-4">{row.party}</TableCell>
                <TableCell className="text-center py-4">
                  <span className={cn(
                    "font-mono font-bold text-sm",
                    row.change > 0 ? "text-green-500" : "text-red-500"
                  )}>
                    {row.change > 0 ? '+' : ''}{row.change}
                  </span>
                </TableCell>
                <TableCell className="text-right text-white font-bold font-mono py-4 text-base">
                  {row.balance}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
