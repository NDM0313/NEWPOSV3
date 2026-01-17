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
      <DialogContent 
        className="sm:max-w-[600px] p-0 gap-0 overflow-hidden shadow-2xl"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          borderColor: 'var(--color-border-primary)',
          color: 'var(--color-text-primary)'
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Print Labels for: {productName}</DialogTitle>
        </DialogHeader>
        {/* Header */}
        <div 
          className="p-5 border-b flex items-center justify-between"
          style={{
            borderBottomColor: 'var(--color-border-primary)',
            backgroundColor: 'var(--color-bg-tertiary)'
          }}
        >
          <div 
            className="text-lg font-bold flex items-center gap-2"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <BarcodeIcon size={20} style={{ color: 'var(--color-primary)' }} />
            Print Labels for: <span style={{ color: 'var(--color-primary)' }}>{productName}</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col md:flex-row gap-8">
          
          {/* Settings Column */}
          <div className="flex-1 space-y-6">
            <div className="space-y-3">
              <Label 
                className="text-xs uppercase tracking-wider"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Label Size
              </Label>
              <Select value={labelSize} onValueChange={setLabelSize}>
                <SelectTrigger
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  <SelectItem value="thermal">38x25mm (Thermal)</SelectItem>
                  <SelectItem value="a4">A4 Sheet (30 Labels)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label 
                className="text-xs uppercase tracking-wider"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Quantity
              </Label>
              <Input 
                type="number" 
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                style={{
                  backgroundColor: 'var(--color-bg-card)',
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

            <div className="space-y-3">
              <Label 
                className="text-xs uppercase tracking-wider"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Info to Print
              </Label>
              <div className="space-y-3 pt-1">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="showPrice" 
                    checked={showPrice} 
                    onCheckedChange={(checked) => setShowPrice(checked as boolean)}
                  />
                  <Label 
                    htmlFor="showPrice" 
                    className="text-sm font-medium leading-none cursor-pointer"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Show Price
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="showName" 
                    checked={showName} 
                    onCheckedChange={(checked) => setShowName(checked as boolean)}
                  />
                  <Label 
                    htmlFor="showName" 
                    className="text-sm font-medium leading-none cursor-pointer"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Show Product Name
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="showBusiness" 
                    checked={showBusinessName} 
                    onCheckedChange={(checked) => setShowBusinessName(checked as boolean)}
                  />
                  <Label 
                    htmlFor="showBusiness" 
                    className="text-sm font-medium leading-none cursor-pointer"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Show Business Name
                  </Label>
                </div>
              </div>
            </div>
          </div>

          {/* Preview Column */}
          <div className="flex-1">
             <Label 
               className="text-xs uppercase tracking-wider mb-3 block"
               style={{ color: 'var(--color-text-tertiary)' }}
             >
               Preview
             </Label>
             
             {/* Sticker Container */}
             <div 
               className="rounded-xl border border-dashed p-8 flex items-center justify-center h-full min-h-[250px]"
               style={{
                 backgroundColor: 'rgba(31, 41, 55, 0.5)',
                 borderColor: 'var(--color-border-secondary)',
                 borderRadius: 'var(--radius-xl)'
               }}
             >
                {/* The Sticker Itself */}
                <div className="bg-white text-black p-3 rounded-sm shadow-xl w-[200px] flex flex-col items-center text-center space-y-1 relative">
                   {showBusinessName && <p className="text-[8px] font-bold uppercase tracking-wider" style={{ color: '#4B5563' }}>Fashion Store</p>}
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
             <p 
               className="text-center text-xs mt-2"
               style={{ color: 'var(--color-text-tertiary)' }}
             >
               {labelSize === 'thermal' ? '38mm x 25mm Preview' : 'A4 Grid Item Preview'}
             </p>
          </div>

        </div>

        {/* Footer */}
        <div 
          className="p-5 border-t flex justify-end gap-3"
          style={{
            borderTopColor: 'var(--color-border-primary)',
            backgroundColor: 'var(--color-bg-tertiary)'
          }}
        >
          <Button 
            variant="ghost" 
            onClick={onClose}
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}
          >
            Cancel
          </Button>
          <Button 
            className="font-semibold"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-primary)',
              boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary)';
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary)';
              e.currentTarget.style.opacity = '1';
            }}
          >
            <Printer size={16} className="mr-2" />
            Print {quantity} Labels
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};