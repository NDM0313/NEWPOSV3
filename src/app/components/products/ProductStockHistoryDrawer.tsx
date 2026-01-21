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
      <div className="w-full max-w-md bg-[#0B0F17] h-full shadow-2xl flex flex-col border-l border-gray-800 animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-800 bg-[#111827] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Stock Movement</h2>
            <p className="text-sm text-blue-400 font-medium">{productName}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white hover:bg-gray-800">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="p-6 grid grid-cols-3 gap-3 border-b border-gray-800 bg-[#1F2937]/30">
           <div className="bg-gray-900 border border-gray-800 p-3 rounded-lg flex flex-col items-center justify-center text-center">
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Sold</span>
              <span className="text-xl font-bold text-white mt-1">{totalSold}</span>
              <ArrowUpRight size={12} className="text-orange-400 mt-1" />
           </div>
           <div className="bg-gray-900 border border-gray-800 p-3 rounded-lg flex flex-col items-center justify-center text-center">
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Purchased</span>
              <span className="text-xl font-bold text-white mt-1">{totalPurchased}</span>
              <ArrowDownRight size={12} className="text-green-400 mt-1" />
           </div>
           <div className="bg-gray-900 border border-gray-800 p-3 rounded-lg flex flex-col items-center justify-center text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-blue-900/10 z-0"></div>
              <span className="text-[10px] text-blue-300 uppercase font-bold tracking-wider relative z-10">Current</span>
              <span className="text-xl font-bold text-blue-400 mt-1 relative z-10">{currentStock}</span>
              <Package size={12} className="text-blue-500 mt-1 relative z-10" />
           </div>
        </div>

        {/* Timeline List */}
        <ScrollArea className="flex-1 bg-[#0B0F17] p-6">
           <div className="relative border-l border-gray-800 ml-3 space-y-8">
              {movements.map((move) => {
                const isPositive = move.quantity > 0;
                
                let icon = <ShoppingCart size={14} />;
                let colorClass = "bg-red-500 text-white";
                let badgeColor = "text-red-400 bg-red-900/20 border-red-900/50";

                if (move.type === 'purchase') {
                  icon = <Truck size={14} />;
                  colorClass = "bg-green-500 text-white";
                  badgeColor = "text-green-400 bg-green-900/20 border-green-900/50";
                } else if (move.type === 'return') {
                   icon = <RefreshCw size={14} />;
                   colorClass = "bg-orange-500 text-white";
                   badgeColor = "text-orange-400 bg-orange-900/20 border-orange-900/50";
                } else if (move.type === 'adjustment') {
                   icon = <Package size={14} />;
                   colorClass = "bg-gray-500 text-white";
                   badgeColor = "text-gray-400 bg-gray-900/20 border-gray-800";
                }

                return (
                  <div key={move.id} className="relative pl-8 group">
                     {/* Timeline Dot */}
                     <div className={cn(
                       "absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-[#0B0F17]",
                       move.quantity > 0 ? "bg-green-500" : "bg-red-500"
                     )}></div>

                     <div className="flex justify-between items-start">
                        <div>
                           <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 uppercase", badgeColor)}>
                                 {move.type}
                              </Badge>
                              <span className="text-sm font-bold text-white">{move.reference}</span>
                           </div>
                           <p className="text-xs text-gray-500">{move.date} • {move.time}</p>
                        </div>
                        <div className={cn(
                          "font-mono font-bold text-sm",
                          move.quantity > 0 ? "text-green-400" : "text-red-400"
                        )}>
                           {move.quantity > 0 ? "+" : ""}{move.quantity} Units
                        </div>
                     </div>
                  </div>
                );
              })}
           </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-5 border-t border-gray-800 bg-gray-950">
           <Button 
             variant="outline" 
             className="w-full border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
             onClick={() => {
               // Open product stock ledger view
               // This will show full ledger with all stock movements
               // For now, we'll show an alert - can be replaced with actual ledger drawer
               alert('Full Stock Ledger View\n\nThis will show:\n- All stock movements (in/out)\n- Running stock balance\n- Reference numbers\n- Dates and times\n\nFeature coming soon!');
             }}
           >
             View Full Ledger
           </Button>
        </div>

      </div>
    </div>
  );
};
