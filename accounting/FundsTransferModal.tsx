import React, { useState } from 'react';
import { 
  X, 
  ArrowRight, 
  Calendar, 
  Paperclip,
  MoveRight,
  ChevronDown
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { cn } from "../ui/utils";
import { CalendarDatePicker } from "../ui/CalendarDatePicker";

import { VirtualNumpad } from '../ui/virtual-numpad';

interface FundsTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FundsTransferModal = ({ isOpen, onClose }: FundsTransferModalProps) => {
  const [amount, setAmount] = useState<string>("");
  const [fromAccount, setFromAccount] = useState("meezan");
  const [toAccount, setToAccount] = useState("jazzcash");
  const [isNumpadOpen, setIsNumpadOpen] = useState(false);

  // Prevent default keyboard on mobile/tablet for the amount input
  const handleAmountFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Check if it's a touch device or just always show for this demo
    e.target.blur(); // Remove focus to prevent native keyboard
    setIsNumpadOpen(true);
  };

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] bg-gray-900 text-white border-gray-800 p-0 gap-0 overflow-hidden shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Transfer Funds</DialogTitle>
        </DialogHeader>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800 bg-[#111827]">
          <div className="text-lg font-bold">Transfer Funds</div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white hover:bg-gray-800">
            <X size={20} />
          </Button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-8 bg-[#0B0F17]">
          
          {/* Date Row */}
          <div className="grid grid-cols-2 gap-4">
             <div className="col-span-2">
                <CalendarDatePicker
                  label="Date & Time"
                  value={new Date()}
                  onChange={() => {}}
                  showTime={true}
                />
             </div>
          </div>

          {/* The Flow Card */}
          <div className="bg-gray-800/40 rounded-xl border border-gray-700/50 p-4 flex items-center justify-between relative overflow-hidden">
             {/* Background Decoration */}
             <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-green-500/5 pointer-events-none" />

             {/* From Account */}
             <div className="flex-1 space-y-2 relative z-10">
                <Label className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">From Account</Label>
                <Select value={fromAccount} onValueChange={setFromAccount}>
                  <SelectTrigger className="bg-gray-900 border-gray-700 text-white h-12 shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700 text-white">
                    <SelectItem value="meezan">Meezan Bank Corp</SelectItem>
                    <SelectItem value="cash">Cash in Hand</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs font-medium text-green-400 flex items-center gap-1">
                   Available: $125,000
                </p>
             </div>

             {/* Arrow Center */}
             <div className="px-4 flex flex-col items-center justify-center pt-6">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20 text-white">
                   <MoveRight size={20} />
                </div>
             </div>

             {/* To Account */}
             <div className="flex-1 space-y-2 relative z-10">
                <Label className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">To Account</Label>
                <Select value={toAccount} onValueChange={setToAccount}>
                  <SelectTrigger className="bg-gray-900 border-gray-700 text-white h-12 shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700 text-white">
                    <SelectItem value="jazzcash">JazzCash Wallet</SelectItem>
                    <SelectItem value="hbl">HBL Current</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs font-medium text-gray-500">
                   Current Balance: $12,500
                </p>
             </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-3 text-center">
             <Label className="text-sm text-gray-400">Amount to Transfer</Label>
             <div className="relative max-w-[240px] mx-auto">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-2xl font-light">$</span>
                <Input 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onFocus={handleAmountFocus}
                  type="text" 
                  inputMode="none" 
                  placeholder="5,000" 
                  className="bg-transparent border-b-2 border-gray-700 border-t-0 border-x-0 rounded-none text-center text-4xl font-bold focus:border-blue-500 focus:ring-0 px-8 h-16 placeholder:text-gray-700 text-white caret-transparent cursor-pointer" 
                />
             </div>
          </div>

          {/* Details Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-2">
                <Label className="text-xs text-gray-500">Description / Note</Label>
                <Textarea 
                  placeholder="e.g. Monthly utility bill payment" 
                  className="bg-gray-800 border-gray-700 text-white resize-none min-h-[80px]" 
                />
             </div>
             
             <div className="space-y-2">
                <Label className="text-xs text-gray-500">Proof / Attachment</Label>
                <div className="border-2 border-dashed border-gray-700 rounded-lg h-[80px] bg-gray-800/30 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-800/50 hover:border-gray-600 transition-colors group">
                   <Paperclip size={18} className="text-gray-500 group-hover:text-blue-400 mb-1" />
                   <span className="text-xs text-gray-500 group-hover:text-gray-300">Upload Receipt/Screenshot</span>
                </div>
             </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-800 bg-[#111827] flex justify-end">
          <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-semibold text-base py-6 px-8 shadow-lg shadow-blue-600/20">
             Transfer Now
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <VirtualNumpad 
      isOpen={isNumpadOpen} 
      onClose={() => setIsNumpadOpen(false)}
      onSubmit={(val) => setAmount(val)}
      initialValue={amount}
      label="Enter Amount"
    />
    </>
  );
};