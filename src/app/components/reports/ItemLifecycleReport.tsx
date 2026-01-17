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
        <h2 
          className="text-2xl font-bold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Item Lifecycle Report
        </h2>
        <div className="flex flex-wrap gap-2">
           <Button 
             variant="outline" 
             size="sm"
             style={{
               borderColor: 'var(--color-border-secondary)',
               color: 'var(--color-text-secondary)'
             }}
             onMouseEnter={(e) => {
               e.currentTarget.style.color = 'var(--color-text-primary)';
             }}
             onMouseLeave={(e) => {
               e.currentTarget.style.color = 'var(--color-text-secondary)';
             }}
           >
             Export
           </Button>
           <Button 
             variant="outline" 
             size="sm"
             style={{
               borderColor: 'var(--color-border-secondary)',
               color: 'var(--color-text-secondary)'
             }}
             onMouseEnter={(e) => {
               e.currentTarget.style.color = 'var(--color-text-primary)';
             }}
             onMouseLeave={(e) => {
               e.currentTarget.style.color = 'var(--color-text-secondary)';
             }}
           >
             Print
           </Button>
        </div>
      </div>

      {/* 1. Header Filters */}
      <div 
        className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 rounded-xl border"
        style={{
          backgroundColor: 'rgba(17, 24, 39, 0.5)',
          borderColor: 'var(--color-border-primary)',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        <div className="md:col-span-2">
           <label 
             className="text-xs mb-1.5 block font-medium"
             style={{ color: 'var(--color-text-tertiary)' }}
           >
             Product Search
           </label>
           <div className="relative">
              <Search 
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                style={{ color: 'var(--color-text-tertiary)' }}
              />
              <Input 
                placeholder="Search by name or SKU..." 
                className="pl-9 h-11"
                defaultValue="Bridal Maxi Red (SKU-101)"
                style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  borderColor: 'var(--color-border-secondary)',
                  color: 'var(--color-text-primary)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--color-primary)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--color-border-secondary)';
                }}
              />
           </div>
        </div>
        
        <div>
           <label 
             className="text-xs mb-1.5 block font-medium"
             style={{ color: 'var(--color-text-tertiary)' }}
           >
             Location
           </label>
           <Select defaultValue="all">
             <SelectTrigger 
               className="h-11"
               style={{
                 backgroundColor: 'var(--color-bg-tertiary)',
                 borderColor: 'var(--color-border-secondary)',
                 color: 'var(--color-text-primary)'
               }}
             >
               <SelectValue placeholder="Select Branch" />
             </SelectTrigger>
             <SelectContent
               style={{
                 backgroundColor: 'var(--color-bg-card)',
                 borderColor: 'var(--color-border-primary)',
                 color: 'var(--color-text-primary)'
               }}
             >
               <SelectItem value="all">All Locations</SelectItem>
               <SelectItem value="main">Main Branch</SelectItem>
               <SelectItem value="warehouse">Warehouse</SelectItem>
             </SelectContent>
           </Select>
        </div>

        <div>
           <label 
             className="text-xs mb-1.5 block font-medium"
             style={{ color: 'var(--color-text-tertiary)' }}
           >
             Date Range
           </label>
           <Button 
             variant="outline" 
             className="w-full justify-start text-left font-normal h-11"
             style={{
               backgroundColor: 'var(--color-bg-tertiary)',
               borderColor: 'var(--color-border-secondary)',
               color: 'var(--color-text-primary)'
             }}
             onMouseEnter={(e) => {
               e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
             }}
             onMouseLeave={(e) => {
               e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
             }}
           >
             <CalendarIcon className="mr-2 h-4 w-4" />
             <span>Last 30 Days</span>
           </Button>
        </div>
      </div>

      {/* 2. Product Summary Strip */}
      <div 
        className="border p-4 rounded-xl flex flex-col md:flex-row items-center gap-6 shadow-lg"
        style={{
          background: 'linear-gradient(to right, var(--color-bg-card), var(--color-bg-card), var(--color-bg-card))',
          borderColor: 'var(--color-border-secondary)',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        <div 
          className="h-16 w-16 rounded-lg overflow-hidden border shrink-0"
          style={{
            borderColor: 'var(--color-border-secondary)',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-bg-card)'
          }}
        >
           <ImageWithFallback 
             src={productInfo.image} 
             alt={productInfo.name} 
             className="h-full w-full object-cover"
           />
        </div>
        
        <div className="flex-1 text-center md:text-left">
           <h3 
             className="text-xl font-bold"
             style={{ color: 'var(--color-text-primary)' }}
           >
             {productInfo.name}
           </h3>
           <p 
             className="text-sm font-mono mt-0.5"
             style={{ color: 'var(--color-text-secondary)' }}
           >
             {productInfo.sku}
           </p>
        </div>

        <div className="flex items-center gap-8 md:pr-4 w-full md:w-auto justify-around md:justify-end">
           <div className="text-center md:text-right">
              <p 
                className="text-xs uppercase tracking-wider font-medium mb-1"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Current Stock
              </p>
              <div className="flex items-center justify-center md:justify-end gap-2">
                 <Package size={18} style={{ color: 'var(--color-primary)' }} />
                 <span 
                   className="text-3xl font-bold"
                   style={{ color: 'var(--color-text-primary)' }}
                 >
                   {productInfo.currentStock}
                 </span>
              </div>
           </div>
           
           <div 
             className="h-10 w-px hidden md:block"
             style={{ backgroundColor: 'var(--color-border-secondary)' }}
           ></div>

           <div className="text-center md:text-right">
              <p 
                className="text-xs uppercase tracking-wider font-medium mb-1"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Avg Cost
              </p>
              <div className="flex items-center justify-center md:justify-end gap-2">
                 <TrendingUp size={18} style={{ color: 'var(--color-success)' }} />
                 <span 
                   className="text-2xl font-bold"
                   style={{ color: 'var(--color-text-primary)' }}
                 >
                   Rs {productInfo.avgCost}
                 </span>
              </div>
           </div>
        </div>
      </div>

      {/* 3. The "Movement" Table */}
      <div 
        className="border rounded-xl overflow-hidden shadow-sm"
        style={{
          borderColor: 'var(--color-border-primary)',
          borderRadius: 'var(--radius-xl)',
          backgroundColor: 'rgba(17, 24, 39, 0.3)'
        }}
      >
        <Table>
          <TableHeader
            style={{
              backgroundColor: 'var(--color-bg-tertiary)'
            }}
          >
            <TableRow
              style={{
                borderColor: 'var(--color-border-primary)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <TableHead 
                className="h-12"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Date
              </TableHead>
              <TableHead 
                className="h-12"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Type
              </TableHead>
              <TableHead 
                className="h-12"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Ref No
              </TableHead>
              <TableHead 
                className="h-12"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Party Name
              </TableHead>
              <TableHead 
                className="text-center h-12"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Qty Change
              </TableHead>
              <TableHead 
                className="text-right font-bold h-12"
                style={{ color: 'var(--color-text-primary)' }}
              >
                New Balance
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movementData.map((row) => (
              <TableRow 
                key={row.id}
                style={{
                  borderColor: 'var(--color-border-primary)',
                  backgroundColor: row.type === 'Sale' 
                    ? 'rgba(127, 29, 29, 0.1)' 
                    : row.type === 'Purchase' 
                      ? 'rgba(5, 150, 105, 0.1)' 
                      : 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = row.type === 'Sale' 
                    ? 'rgba(127, 29, 29, 0.2)' 
                    : row.type === 'Purchase' 
                      ? 'rgba(5, 150, 105, 0.2)' 
                      : 'var(--color-hover-bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = row.type === 'Sale' 
                    ? 'rgba(127, 29, 29, 0.1)' 
                    : row.type === 'Purchase' 
                      ? 'rgba(5, 150, 105, 0.1)' 
                      : 'transparent';
                }}
              >
                <TableCell 
                  className="font-mono text-xs py-4"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {row.date}
                </TableCell>
                <TableCell className="py-4">
                  <span 
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border"
                    style={{
                      backgroundColor: row.type === 'Sale' 
                        ? 'rgba(239, 68, 68, 0.1)' 
                        : row.type === 'Purchase' 
                          ? 'rgba(16, 185, 129, 0.1)' 
                          : 'rgba(55, 65, 81, 0.5)',
                      color: row.type === 'Sale' 
                        ? 'var(--color-error)' 
                        : row.type === 'Purchase' 
                          ? 'var(--color-success)' 
                          : 'var(--color-text-primary)',
                      borderColor: row.type === 'Sale' 
                        ? 'rgba(239, 68, 68, 0.2)' 
                        : row.type === 'Purchase' 
                          ? 'rgba(16, 185, 129, 0.2)' 
                          : 'var(--color-border-secondary)',
                      borderRadius: 'var(--radius-md)'
                    }}
                  >
                    {row.type === 'Sale' && <ArrowUpRight size={12} />}
                    {row.type === 'Purchase' && <ArrowDownRight size={12} />}
                    {row.type}
                  </span>
                </TableCell>
                <TableCell className="py-4">
                  <span 
                    className="hover:underline cursor-pointer text-sm font-medium"
                    style={{ color: 'var(--color-primary)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--color-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--color-primary)';
                    }}
                  >
                    {row.ref}
                  </span>
                </TableCell>
                <TableCell 
                  className="font-medium py-4"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {row.party}
                </TableCell>
                <TableCell className="text-center py-4">
                  <span 
                    className="font-mono font-bold text-sm"
                    style={{ 
                      color: row.change > 0 ? 'var(--color-success)' : 'var(--color-error)' 
                    }}
                  >
                    {row.change > 0 ? '+' : ''}{row.change}
                  </span>
                </TableCell>
                <TableCell 
                  className="text-right font-bold font-mono py-4 text-base"
                  style={{ color: 'var(--color-text-primary)' }}
                >
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
