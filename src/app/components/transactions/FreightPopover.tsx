import React, { useState, useEffect } from 'react';
import { Truck, Info, Plus, X } from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import { Separator } from "../ui/separator";

export interface FreightDetails {
  description: string;
  amount: number;
  includeInInvoice: boolean;
  paymentMethod?: string;
}

interface FreightPopoverProps {
  onSave: (details: FreightDetails | null) => void;
  currentDetails: FreightDetails | null;
}

export const FreightPopover = ({ onSave, currentDetails }: FreightPopoverProps) => {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [includeInInvoice, setIncludeInInvoice] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('cash');

  // Reset form when opening or when currentDetails changes
  useEffect(() => {
    if (open) {
      if (currentDetails) {
        setDescription(currentDetails.description);
        setAmount(currentDetails.amount.toString());
        setIncludeInInvoice(currentDetails.includeInInvoice);
        setPaymentMethod(currentDetails.paymentMethod || 'cash');
      } else {
        setDescription('');
        setAmount('');
        setIncludeInInvoice(true);
        setPaymentMethod('cash');
      }
    }
  }, [open, currentDetails]);

  const handleSave = () => {
    const cost = parseFloat(amount);
    if (!description || isNaN(cost) || cost <= 0) return;

    onSave({
      description,
      amount: cost,
      includeInInvoice,
      paymentMethod: includeInInvoice ? undefined : paymentMethod
    });
    setOpen(false);
  };

  const handleRemove = () => {
    onSave(null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-auto p-0 text-blue-400 hover:text-blue-300 hover:bg-transparent font-normal"
        >
          {currentDetails ? (
            <span className="flex items-center gap-1">
              Edit <Truck size={12} />
            </span>
          ) : (
            <span className="flex items-center gap-1">
              Add (+)
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-gray-900 border-gray-800 text-white shadow-xl" align="end">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-950">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Truck size={16} className="text-orange-500" />
            Add Landing Costs
          </h4>
          {currentDetails && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:bg-red-900/20" onClick={handleRemove}>
              <X size={14} />
            </Button>
          )}
        </div>
        
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-gray-400">Description</Label>
            <Input 
              placeholder="e.g. TCS Charges, Labor, Freight" 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-gray-800 border-gray-700 h-8 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-gray-400">Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
              <Input 
                type="number" 
                placeholder="0.00" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-gray-800 border-gray-700 h-8 pl-7 text-sm"
              />
            </div>
          </div>

          <Separator className="bg-gray-800" />

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="invoice-toggle" className="text-sm font-medium">Include in Supplier Invoice?</Label>
              <p className="text-[10px] text-gray-500 leading-tight">
                {includeInInvoice 
                  ? "Amount will be added to Supplier's Pending Balance."
                  : "Amount paid immediately to Transporter."}
              </p>
            </div>
            <Switch 
              id="invoice-toggle" 
              checked={includeInInvoice}
              onCheckedChange={setIncludeInInvoice}
              className="data-[state=checked]:bg-orange-600"
            />
          </div>

          {!includeInInvoice && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <Label className="text-xs text-gray-400">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="bg-gray-800 border-gray-700 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-blue-400 flex items-center gap-1">
                <Info size={10} />
                Paid from {paymentMethod === 'cash' ? 'Cash Till' : 'Main Bank Account'}
              </p>
            </div>
          )}

          <Button onClick={handleSave} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-semibold shadow-lg shadow-orange-600/10 mt-2">
            Apply Cost
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
