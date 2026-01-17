import React from 'react';
import { X, ArrowUpRight, ArrowDownRight, Package, RefreshCw, ShoppingCart, Truck } from 'lucide-react';
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";

interface StockMovement {
  id: string;
  type: 'sale' | 'purchase' | 'return' | 'adjustment';
  reference: string;
  quantity: number; // Positive or negative
  date: string;
  time: string;
}

interface ProductStockHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  totalSold: number;
  totalPurchased: number;
  currentStock: number;
}

// Mock Data
const movements: StockMovement[] = [
  { id: "1", type: 'sale', reference: "Inv-101", quantity: -2, date: "Today", time: "10 mins ago" },
  { id: "2", type: 'purchase', reference: "PO-500", quantity: 50, date: "2 days ago", time: "10:00 AM" },
  { id: "3", type: 'return', reference: "Inv-099", quantity: 1, date: "5 days ago", time: "2:30 PM" },
  { id: "4", type: 'adjustment', reference: "Audit-Jan", quantity: -1, date: "1 week ago", time: "Stock Check" },
  { id: "5", type: 'sale', reference: "Inv-085", quantity: -1, date: "1 week ago", time: "11:00 AM" },
];

export const ProductStockHistoryDrawer = ({
  isOpen,
  onClose,
  productName,
  totalSold,
  totalPurchased,
  currentStock
}: ProductStockHistoryDrawerProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md h-full shadow-2xl flex flex-col border-l animate-in slide-in-from-right duration-300"
        style={{
          backgroundColor: 'var(--color-bg-panel)',
          borderLeftColor: 'var(--color-border-primary)'
        }}
      >
        
        {/* Header */}
        <div 
          className="px-6 py-5 border-b flex items-center justify-between"
          style={{
            borderBottomColor: 'var(--color-border-primary)',
            backgroundColor: 'var(--color-bg-primary)'
          }}
        >
          <div>
            <h2 
              className="text-lg font-bold tracking-tight"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Stock Movement
            </h2>
            <p 
              className="text-sm font-medium"
              style={{ color: 'var(--color-primary)' }}
            >
              {productName}
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-text-primary)';
              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-secondary)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Summary Cards */}
        <div 
          className="p-6 grid grid-cols-3 gap-3 border-b"
          style={{
            borderBottomColor: 'var(--color-border-primary)',
            backgroundColor: 'rgba(31, 41, 55, 0.3)' // bg-[#1F2937]/30
          }}
        >
           <div 
             className="border p-3 rounded-lg flex flex-col items-center justify-center text-center"
             style={{
               backgroundColor: 'var(--color-bg-card)',
               borderColor: 'var(--color-border-primary)',
               borderRadius: 'var(--radius-lg)'
             }}
           >
              <span 
                className="text-[10px] uppercase font-bold tracking-wider"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Sold
              </span>
              <span 
                className="text-xl font-bold mt-1"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {totalSold}
              </span>
              <ArrowUpRight size={12} style={{ color: 'var(--color-warning)' }} className="mt-1" />
           </div>
           <div 
             className="border p-3 rounded-lg flex flex-col items-center justify-center text-center"
             style={{
               backgroundColor: 'var(--color-bg-card)',
               borderColor: 'var(--color-border-primary)',
               borderRadius: 'var(--radius-lg)'
             }}
           >
              <span 
                className="text-[10px] uppercase font-bold tracking-wider"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Purchased
              </span>
              <span 
                className="text-xl font-bold mt-1"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {totalPurchased}
              </span>
              <ArrowDownRight size={12} style={{ color: 'var(--color-success)' }} className="mt-1" />
           </div>
           <div 
             className="border p-3 rounded-lg flex flex-col items-center justify-center text-center relative overflow-hidden"
             style={{
               backgroundColor: 'var(--color-bg-card)',
               borderColor: 'var(--color-border-primary)',
               borderRadius: 'var(--radius-lg)'
             }}
           >
              <div 
                className="absolute inset-0 z-0"
                style={{ backgroundColor: 'rgba(30, 58, 138, 0.1)' }}
              ></div>
              <span 
                className="text-[10px] uppercase font-bold tracking-wider relative z-10"
                style={{ color: 'var(--color-primary)' }}
              >
                Current
              </span>
              <span 
                className="text-xl font-bold mt-1 relative z-10"
                style={{ color: 'var(--color-primary)' }}
              >
                {currentStock}
              </span>
              <Package size={12} style={{ color: 'var(--color-primary)' }} className="mt-1 relative z-10" />
           </div>
        </div>

        {/* Timeline List */}
        <ScrollArea 
          className="flex-1 p-6"
          style={{ backgroundColor: 'var(--color-bg-panel)' }}
        >
           <div 
             className="relative border-l ml-3 space-y-8"
             style={{ borderColor: 'var(--color-border-primary)' }}
           >
              {movements.map((move) => {
                const isPositive = move.quantity > 0;
                
                let icon = <ShoppingCart size={14} />;
                let badgeStyle = {
                  color: 'var(--color-error)',
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  borderColor: 'rgba(153, 27, 27, 0.5)'
                };

                if (move.type === 'purchase') {
                  icon = <Truck size={14} />;
                  badgeStyle = {
                    color: 'var(--color-success)',
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    borderColor: 'rgba(5, 150, 105, 0.5)'
                  };
                } else if (move.type === 'return') {
                   icon = <RefreshCw size={14} />;
                   badgeStyle = {
                     color: 'var(--color-warning)',
                     backgroundColor: 'rgba(249, 115, 22, 0.2)',
                     borderColor: 'rgba(154, 52, 18, 0.5)'
                   };
                } else if (move.type === 'adjustment') {
                   icon = <Package size={14} />;
                   badgeStyle = {
                     color: 'var(--color-text-secondary)',
                     backgroundColor: 'rgba(17, 24, 39, 0.2)',
                     borderColor: 'var(--color-border-primary)'
                   };
                }

                return (
                  <div key={move.id} className="relative pl-8 group">
                     {/* Timeline Dot */}
                     <div 
                       className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border-2"
                       style={{
                         backgroundColor: move.quantity > 0 ? 'var(--color-success)' : 'var(--color-error)',
                         borderColor: 'var(--color-bg-panel)',
                         borderRadius: 'var(--radius-full)'
                       }}
                     ></div>

                     <div className="flex justify-between items-start">
                        <div>
                           <div className="flex items-center gap-2 mb-1">
                              <Badge 
                                variant="outline" 
                                className="text-[10px] h-5 px-1.5 uppercase"
                                style={badgeStyle}
                              >
                                 {move.type}
                              </Badge>
                              <span 
                                className="text-sm font-bold"
                                style={{ color: 'var(--color-text-primary)' }}
                              >
                                {move.reference}
                              </span>
                           </div>
                           <p 
                             className="text-xs"
                             style={{ color: 'var(--color-text-tertiary)' }}
                           >
                             {move.date} • {move.time}
                           </p>
                        </div>
                        <div 
                          className="font-mono font-bold text-sm"
                          style={{
                            color: move.quantity > 0 ? 'var(--color-success)' : 'var(--color-error)'
                          }}
                        >
                           {move.quantity > 0 ? "+" : ""}{move.quantity} Units
                        </div>
                     </div>
                  </div>
                );
              })}
           </div>
        </ScrollArea>

        {/* Footer */}
        <div 
          className="p-5 border-t"
          style={{
            borderColor: 'var(--color-border-primary)',
            backgroundColor: 'var(--color-bg-tertiary)'
          }}
        >
           <Button 
             variant="outline" 
             className="w-full"
             style={{
               borderColor: 'var(--color-border-secondary)',
               color: 'var(--color-text-secondary)'
             }}
             onMouseEnter={(e) => {
               e.currentTarget.style.color = 'var(--color-text-primary)';
               e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
             }}
             onMouseLeave={(e) => {
               e.currentTarget.style.color = 'var(--color-text-secondary)';
               e.currentTarget.style.backgroundColor = 'transparent';
             }}
           >
             View Full Ledger
           </Button>
        </div>

      </div>
    </div>
  );
};
