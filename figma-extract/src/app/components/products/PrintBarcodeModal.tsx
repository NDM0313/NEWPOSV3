import React, { useState } from 'react';
import { Printer, X, Barcode as BarcodeIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Checkbox } from "../ui/checkbox";

interface PrintBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  sku: string;
  price: number;
  currentStock: number;
}

export const PrintBarcodeModal = ({
  isOpen,
  onClose,
  productName,
  sku,
  price,
  currentStock
}: PrintBarcodeModalProps) => {
  const [labelSize, setLabelSize] = useState("thermal");
  const [quantity, setQuantity] = useState(currentStock.toString());
  const [showPrice, setShowPrice] = useState(true);
  const [showName, setShowName] = useState(true);
  const [showBusinessName, setShowBusinessName] = useState(true);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] bg-gray-900 text-white border-gray-800 p-0 gap-0 overflow-hidden shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Print Labels for: {productName}</DialogTitle>
        </DialogHeader>
        {/* Header */}
        <div className="p-5 border-b border-gray-800 bg-gray-950 flex items-center justify-between">
          <div className="text-lg font-bold text-white flex items-center gap-2">
            <BarcodeIcon className="text-blue-500" size={20} />
            Print Labels for: <span className="text-blue-400">{productName}</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col md:flex-row gap-8">
          
          {/* Settings Column */}
          <div className="flex-1 space-y-6">
            <div className="space-y-3">
              <Label className="text-xs text-gray-500 uppercase tracking-wider">Label Size</Label>
              <Select value={labelSize} onValueChange={setLabelSize}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  <SelectItem value="thermal">38x25mm (Thermal)</SelectItem>
                  <SelectItem value="a4">A4 Sheet (30 Labels)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-xs text-gray-500 uppercase tracking-wider">Quantity</Label>
              <Input 
                type="number" 
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-xs text-gray-500 uppercase tracking-wider">Info to Print</Label>
              <div className="space-y-3 pt-1">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="showPrice" 
                    checked={showPrice} 
                    onCheckedChange={(checked) => setShowPrice(checked as boolean)}
                    className="border-gray-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                  <Label htmlFor="showPrice" className="text-sm font-medium leading-none text-gray-300 cursor-pointer">Show Price</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="showName" 
                    checked={showName} 
                    onCheckedChange={(checked) => setShowName(checked as boolean)}
                    className="border-gray-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                  <Label htmlFor="showName" className="text-sm font-medium leading-none text-gray-300 cursor-pointer">Show Product Name</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="showBusiness" 
                    checked={showBusinessName} 
                    onCheckedChange={(checked) => setShowBusinessName(checked as boolean)}
                    className="border-gray-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                  <Label htmlFor="showBusiness" className="text-sm font-medium leading-none text-gray-300 cursor-pointer">Show Business Name</Label>
                </div>
              </div>
            </div>
          </div>

          {/* Preview Column */}
          <div className="flex-1">
             <Label className="text-xs text-gray-500 uppercase tracking-wider mb-3 block">Preview</Label>
             
             {/* Sticker Container */}
             <div className="bg-gray-800/50 rounded-xl border border-dashed border-gray-700 p-8 flex items-center justify-center h-full min-h-[250px]">
                {/* The Sticker Itself */}
                <div className="bg-white text-black p-3 rounded-sm shadow-xl w-[200px] flex flex-col items-center text-center space-y-1 relative">
                   {showBusinessName && <p className="text-[8px] font-bold uppercase tracking-wider text-gray-600">Fashion Store</p>}
                   {showName && <p className="text-xs font-bold leading-tight line-clamp-2">{productName}</p>}
                   
                   {/* Fake Barcode Lines */}
                   <div className="h-10 w-full flex justify-center items-end gap-[1px] my-1">
                      {[...Array(25)].map((_, i) => (
                        <div key={i} className="bg-black" style={{ width: Math.random() > 0.5 ? '2px' : '1px', height: Math.random() > 0.5 ? '100%' : '80%' }}></div>
                      ))}
                   </div>
                   <p className="text-[10px] font-mono tracking-widest">{sku}</p>
                   
                   {showPrice && <p className="text-sm font-bold mt-1">${price.toLocaleString()}</p>}
                </div>
             </div>
             <p className="text-center text-xs text-gray-500 mt-2">
               {labelSize === 'thermal' ? '38mm x 25mm Preview' : 'A4 Grid Item Preview'}
             </p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-800 bg-gray-950 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} className="text-gray-400 hover:text-white">
            Cancel
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/20">
            <Printer size={16} className="mr-2" />
            Print {quantity} Labels
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};