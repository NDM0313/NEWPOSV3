import React from 'react';
import { X, Printer, Share2, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";

interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
  total: number;
}

interface ThermalReceiptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  date: string;
  customerName: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  total: number;
}

// Mock Data Default
const defaultItems = [
  { name: "Cotton T-Shirt (L)", qty: 2, price: 1500, total: 3000 },
  { name: "Denim Jeans (32)", qty: 1, price: 3500, total: 3500 },
];

export const ThermalReceiptPreviewModal = ({
  isOpen,
  onClose,
  invoiceId = "INV-1023",
  date = "28-Dec-2024 14:30",
  customerName = "Walk-in Customer",
  items = defaultItems,
  subtotal = 6500,
  discount = 500,
  total = 6000
}: ThermalReceiptPreviewModalProps) => {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-transparent border-none shadow-none p-0 flex flex-col items-center justify-center">
        <DialogTitle className="sr-only">Receipt Preview</DialogTitle>
        
        {/* Receipt Container (The "Paper") */}
        <div className="bg-white text-black w-[300px] shadow-2xl relative animate-in zoom-in-95 duration-200">
           
           {/* Jagged Edge Top (CSS Trick or SVG) */}
           <div className="absolute -top-2 left-0 right-0 h-4 bg-white" style={{ clipPath: 'polygon(0% 100%, 5% 0%, 10% 100%, 15% 0%, 20% 100%, 25% 0%, 30% 100%, 35% 0%, 40% 100%, 45% 0%, 50% 100%, 55% 0%, 60% 100%, 65% 0%, 70% 100%, 75% 0%, 80% 100%, 85% 0%, 90% 100%, 95% 0%, 100% 100%)' }}></div>

           <div className="p-6 pb-8 flex flex-col items-center">
              
              {/* Header */}
              <div className="text-center mb-4">
                 <h2 className="text-xl font-bold uppercase tracking-wider">Fashion Store</h2>
                 <p className="text-[10px] text-gray-600">Shop #12, Mall Road, Lahore</p>
                 <p className="text-[10px] text-gray-600">Tel: +92 300 1234567</p>
              </div>

              {/* Invoice Meta */}
              <div className="w-full border-b border-dashed border-gray-300 pb-2 mb-2 flex justify-between text-[10px]">
                 <span>{date}</span>
                 <span className="font-bold">{invoiceId}</span>
              </div>
              <div className="w-full mb-4 text-[11px] text-left">
                 <span className="text-gray-500">Customer:</span> <span className="font-semibold">{customerName}</span>
              </div>

              {/* Items Table */}
              <div className="w-full mb-4">
                 <table className="w-full text-[11px] leading-tight">
                    <thead>
                       <tr className="text-left border-b border-black">
                          <th className="pb-1 w-1/2">Item</th>
                          <th className="pb-1 text-center">Qty</th>
                          <th className="pb-1 text-right">Amt</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                       {items.map((item, i) => (
                          <tr key={i}>
                             <td className="py-1 pr-1">{item.name}</td>
                             <td className="py-1 text-center">{item.qty}</td>
                             <td className="py-1 text-right">{item.total.toLocaleString()}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>

              {/* Totals */}
              <div className="w-full space-y-1 border-t border-black pt-2 mb-6">
                 <div className="flex justify-between text-[11px]">
                    <span className="text-gray-600">Subtotal</span>
                    <span>{subtotal.toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between text-[11px]">
                    <span className="text-gray-600">Discount</span>
                    <span>-{discount.toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t border-dashed border-gray-300">
                    <span>TOTAL</span>
                    <span>Rs {total.toLocaleString()}</span>
                 </div>
              </div>

              {/* Barcode Footer */}
              <div className="flex flex-col items-center gap-1 w-full">
                 <div className="h-8 w-4/5 flex justify-center items-end gap-[1px]">
                    {[...Array(40)].map((_, i) => (
                      <div key={i} className="bg-black" style={{ width: Math.random() > 0.5 ? '2px' : '1px', height: '100%' }}></div>
                    ))}
                 </div>
                 <p className="text-[9px] tracking-[0.2em] font-mono mt-1 text-gray-500">THANK YOU</p>
              </div>

           </div>

           {/* Jagged Edge Bottom */}
           <div className="absolute -bottom-2 left-0 right-0 h-4 bg-white rotate-180" style={{ clipPath: 'polygon(0% 100%, 5% 0%, 10% 100%, 15% 0%, 20% 100%, 25% 0%, 30% 100%, 35% 0%, 40% 100%, 45% 0%, 50% 100%, 55% 0%, 60% 100%, 65% 0%, 70% 100%, 75% 0%, 80% 100%, 85% 0%, 90% 100%, 95% 0%, 100% 100%)' }}></div>
        </div>

        {/* Action Buttons (Outside the receipt) */}
        <div className="mt-6 flex gap-3">
           <Button variant="outline" onClick={onClose} className="border-gray-600 text-gray-300 hover:bg-gray-800 rounded-full h-10 w-10 p-0">
             <X size={20} />
           </Button>
           <Button className="bg-blue-600 hover:bg-blue-500 text-white rounded-full px-6 font-semibold shadow-lg shadow-blue-600/30">
             <Printer size={18} className="mr-2" /> Print
           </Button>
           <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-800 rounded-full h-10 w-10 p-0">
             <Share2 size={18} />
           </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
};
