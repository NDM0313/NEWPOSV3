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
    // Update border color on focus
    e.target.style.borderBottomColor = 'var(--color-primary)';
  };

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="sm:max-w-[600px] p-0 gap-0 overflow-hidden shadow-2xl"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          color: 'var(--color-text-primary)',
          borderColor: 'var(--color-border-primary)'
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Transfer Funds</DialogTitle>
        </DialogHeader>
        {/* Header */}
        <div 
          className="flex items-center justify-between p-5 border-b"
          style={{
            borderBottomColor: 'var(--color-border-primary)',
            backgroundColor: 'var(--color-bg-primary)'
          }}
        >
          <div className="text-lg font-bold">Transfer Funds</div>
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
            <X size={20} />
          </Button>
        </div>

        {/* Body */}
        <div 
          className="p-6 space-y-8"
          style={{ backgroundColor: 'var(--color-bg-panel)' }}
        >
          
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
          <div 
            className="rounded-xl border p-4 flex items-center justify-between relative overflow-hidden"
            style={{
              backgroundColor: 'rgba(31, 41, 55, 0.4)',
              borderColor: 'rgba(55, 65, 81, 0.5)',
              borderRadius: 'var(--radius-xl)'
            }}
          >
             {/* Background Decoration */}
             <div 
               className="absolute inset-0 pointer-events-none"
               style={{
                 background: 'linear-gradient(to right, rgba(59, 130, 246, 0.05), transparent, rgba(16, 185, 129, 0.05))'
               }}
             />

             {/* From Account */}
             <div className="flex-1 space-y-2 relative z-10">
                <Label 
                  className="text-[10px] uppercase tracking-wider font-bold"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  From Account
                </Label>
                <Select value={fromAccount} onValueChange={setFromAccount}>
                  <SelectTrigger 
                    className="h-12 shadow-sm"
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
                    <SelectItem value="meezan">Meezan Bank Corp</SelectItem>
                    <SelectItem value="cash">Cash in Hand</SelectItem>
                  </SelectContent>
                </Select>
                <p 
                  className="text-xs font-medium flex items-center gap-1"
                  style={{ color: 'var(--color-success)' }}
                >
                   Available: $125,000
                </p>
             </div>

             {/* Arrow Center */}
             <div className="px-4 flex flex-col items-center justify-center pt-6">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-text-primary)',
                    borderRadius: 'var(--radius-full)',
                    boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.2)'
                  }}
                >
                   <MoveRight size={20} />
                </div>
             </div>

             {/* To Account */}
             <div className="flex-1 space-y-2 relative z-10">
                <Label 
                  className="text-[10px] uppercase tracking-wider font-bold"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  To Account
                </Label>
                <Select value={toAccount} onValueChange={setToAccount}>
                  <SelectTrigger 
                    className="h-12 shadow-sm"
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
                    <SelectItem value="jazzcash">JazzCash Wallet</SelectItem>
                    <SelectItem value="hbl">HBL Current</SelectItem>
                  </SelectContent>
                </Select>
                <p 
                  className="text-xs font-medium"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                   Current Balance: $12,500
                </p>
             </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-3 text-center">
             <Label 
               className="text-sm"
               style={{ color: 'var(--color-text-secondary)' }}
             >
               Amount to Transfer
             </Label>
             <div className="relative max-w-[240px] mx-auto">
                <span 
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-light"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  $
                </span>
                <Input 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onFocus={handleAmountFocus}
                  onBlur={(e) => {
                    e.target.style.borderBottomColor = 'var(--color-border-secondary)';
                  }}
                  type="text" 
                  inputMode="none" 
                  placeholder="5,000" 
                  className="bg-transparent border-b-2 border-t-0 border-x-0 rounded-none text-center text-4xl font-bold focus:ring-0 px-8 h-16 caret-transparent cursor-pointer"
                  style={{
                    borderBottomColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)',
                    caretColor: 'transparent'
                  }}
                />
             </div>
          </div>

          {/* Details Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-2">
                <Label 
                  className="text-xs"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Description / Note
                </Label>
                <Textarea 
                  placeholder="e.g. Monthly utility bill payment" 
                  className="resize-none min-h-[80px]"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                />
             </div>
             
             <div className="space-y-2">
                <Label 
                  className="text-xs"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Proof / Attachment
                </Label>
                <div 
                  className="border-2 border-dashed rounded-lg h-[80px] flex flex-col items-center justify-center cursor-pointer transition-colors group"
                  style={{
                    borderColor: 'var(--color-border-secondary)',
                    backgroundColor: 'rgba(31, 41, 55, 0.3)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.5)';
                    e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.3)';
                    e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                  }}
                >
                   <Paperclip 
                     size={18} 
                     className="mb-1"
                     style={{ color: 'var(--color-text-tertiary)' }}
                   />
                   <span 
                     className="text-xs"
                     style={{ color: 'var(--color-text-tertiary)' }}
                   >
                     Upload Receipt/Screenshot
                   </span>
                </div>
             </div>
          </div>

        </div>

        {/* Footer */}
        <div 
          className="p-5 border-t flex justify-end"
          style={{
            borderTopColor: 'var(--color-border-primary)',
            backgroundColor: 'var(--color-bg-primary)'
          }}
        >
          <Button 
            className="w-full sm:w-auto font-semibold text-base py-6 px-8"
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