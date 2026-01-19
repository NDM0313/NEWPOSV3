import React, { useState, useRef, useEffect } from 'react';
import { DollarSign, Banknote, CreditCard, Building2, FileText, Calendar as CalendarIcon, AlertCircle } from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
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
import { Calendar } from "../ui/calendar";
import { format } from "date-fns";
import { cn } from "../ui/utils";

type PaymentMode = 'cash' | 'card' | 'bank' | 'cheque';
type PaymentStrategy = 'full_credit' | 'full_cash' | 'partial';

interface SmartPaymentWidgetProps {
  grandTotal: number;
  onPaymentChange?: (details: PaymentDetails) => void;
  type?: 'sale' | 'purchase';
}

export interface PaymentDetails {
  strategy: PaymentStrategy;
  paidAmount: number;
  paymentMode: PaymentMode;
  account: string;
  dueDate?: Date;
  balanceDue: number;
}

export const SmartPaymentWidget = ({ 
  grandTotal, 
  onPaymentChange,
  type = 'sale'
}: SmartPaymentWidgetProps) => {
  const [strategy, setStrategy] = useState<PaymentStrategy>('full_cash');
  const [paidAmount, setPaidAmount] = useState<number>(grandTotal);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [account, setAccount] = useState<string>('cash_hand');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Update paid amount when grand total changes (only for full_cash strategy)
  useEffect(() => {
    if (strategy === 'full_cash') {
      setPaidAmount(grandTotal);
    }
  }, [grandTotal, strategy]);

  // Notify parent of payment changes
  useEffect(() => {
    if (onPaymentChange) {
      onPaymentChange({
        strategy,
        paidAmount,
        paymentMode,
        account,
        dueDate,
        balanceDue: Math.max(0, grandTotal - paidAmount)
      });
    }
  }, [strategy, paidAmount, paymentMode, account, dueDate, grandTotal]);

  const balanceDue = Math.max(0, grandTotal - paidAmount);

  const handleFullCredit = () => {
    setStrategy('full_credit');
    setPaidAmount(0);
    // Set default due date to 30 days from now
    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 30);
    setDueDate(defaultDueDate);
  };

  const handleFullCash = () => {
    setStrategy('full_cash');
    setPaidAmount(grandTotal);
    setDueDate(undefined);
  };

  const handlePartial = () => {
    setStrategy('partial');
    setDueDate(undefined);
    // Focus the amount input
    setTimeout(() => {
      amountInputRef.current?.focus();
      amountInputRef.current?.select();
    }, 100);
  };

  const handleAmountChange = (value: number) => {
    setPaidAmount(value);
    if (value === 0) {
      setStrategy('full_credit');
    } else if (value >= grandTotal) {
      setStrategy('full_cash');
    } else {
      setStrategy('partial');
    }
  };

  const paymentModes = [
    { id: 'cash' as PaymentMode, icon: Banknote, label: 'Cash', color: 'text-green-400', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30' },
    { id: 'card' as PaymentMode, icon: CreditCard, label: 'Card', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30' },
    { id: 'bank' as PaymentMode, icon: Building2, label: 'Bank', color: 'text-purple-400', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30' },
    { id: 'cheque' as PaymentMode, icon: FileText, label: 'Cheque', color: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30' },
  ];

  const accounts = [
    { id: 'cash_hand', label: 'Cash in Hand', icon: '💵' },
    { id: 'bank_main', label: 'Meezan Bank (Main)', icon: '🏦' },
    { id: 'bank_saving', label: 'Allied Bank (Savings)', icon: '🏦' },
    { id: 'petty_cash', label: 'Petty Cash', icon: '💰' },
  ];

  return (
    <div className="bg-gray-900 border-t border-gray-800 p-6 space-y-6">
      {/* Grand Total Display */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400 uppercase tracking-wide">Net Payable</span>
          {type === 'sale' && (
            <div className="flex items-center gap-1 text-xs text-blue-400">
              <DollarSign size={12} />
              <span>Sales</span>
            </div>
          )}
        </div>
        <div className="text-[32px] font-bold text-white leading-none">
          ${grandTotal.toFixed(2)}
        </div>
      </div>

      {/* Quick Actions Row */}
      <div className="grid grid-cols-3 gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleFullCredit}
          className={cn(
            "h-11 flex flex-col items-center justify-center gap-1 border-2 transition-all",
            strategy === 'full_credit'
              ? "border-yellow-500 bg-yellow-500/10 text-yellow-400"
              : "border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/5"
          )}
        >
          <span className="text-lg">📝</span>
          <span className="text-xs font-medium">Full Credit</span>
        </Button>

        <Button
          type="button"
          onClick={handleFullCash}
          className={cn(
            "h-11 flex flex-col items-center justify-center gap-1 transition-all",
            strategy === 'full_cash'
              ? "bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-500/20"
              : "bg-green-600/80 hover:bg-green-600 text-white"
          )}
        >
          <span className="text-lg">💵</span>
          <span className="text-xs font-medium">Full Cash</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={handlePartial}
          className={cn(
            "h-11 flex flex-col items-center justify-center gap-1 border-2 transition-all",
            strategy === 'partial'
              ? "border-blue-500 bg-blue-500/10 text-blue-400"
              : "border-blue-500/30 text-blue-400 hover:bg-blue-500/5"
          )}
        >
          <span className="text-lg">🔀</span>
          <span className="text-xs font-medium">Partial</span>
        </Button>
      </div>

      {/* Payment Details Form */}
      <div className="space-y-4 p-4 bg-gray-950 border border-gray-800 rounded-lg">
        {/* Amount Input */}
        <div className="space-y-2">
          <Label htmlFor="amount" className="text-gray-300 text-sm">
            Amount Collecting
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">$</span>
            <Input
              ref={amountInputRef}
              id="amount"
              type="number"
              step="0.01"
              min="0"
              max={grandTotal}
              value={paidAmount}
              onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0)}
              className={cn(
                "pl-8 h-12 bg-gray-900 border-gray-700 text-white text-xl font-bold focus:border-blue-500",
                paidAmount < grandTotal && "focus:border-yellow-500"
              )}
              placeholder="0.00"
            />
          </div>
          
          {/* Balance Due Indicator */}
          {balanceDue > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <AlertCircle size={14} className="text-red-400" />
              <span className="text-red-400 font-medium">
                Balance Due: ${balanceDue.toFixed(2)}
              </span>
            </div>
          )}

          {/* Split Payment Display */}
          {strategy === 'partial' && paidAmount > 0 && balanceDue > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2">
                <div className="text-xs text-green-400 mb-1">Collecting Now</div>
                <div className="text-lg font-bold text-green-400">${paidAmount.toFixed(2)}</div>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2">
                <div className="text-xs text-yellow-400 mb-1">On Account</div>
                <div className="text-lg font-bold text-yellow-400">${balanceDue.toFixed(2)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Due Date Picker (Only for Full Credit) */}
        {strategy === 'full_credit' && (
          <div className="space-y-2 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
            <Label htmlFor="due-date" className="text-yellow-400 text-sm flex items-center gap-2">
              <CalendarIcon size={14} />
              Payment Due Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal bg-gray-900 border-yellow-500/30 text-white hover:bg-gray-800",
                    !dueDate && "text-gray-500"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-gray-900 border-gray-800">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                  className="bg-gray-900 text-white"
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-yellow-400/70">
              Customer will need to pay by this date
            </p>
          </div>
        )}

        {/* Payment Mode Visual Tabs */}
        {paidAmount > 0 && (
          <>
            <div className="space-y-2">
              <Label className="text-gray-300 text-sm">Payment Method</Label>
              <div className="grid grid-cols-4 gap-2">
                {paymentModes.map((mode) => {
                  const Icon = mode.icon;
                  const isActive = paymentMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setPaymentMode(mode.id)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all",
                        isActive
                          ? `${mode.bgColor} ${mode.borderColor} ${mode.color}`
                          : "bg-gray-900 border-gray-800 text-gray-500 hover:bg-gray-800 hover:border-gray-700"
                      )}
                    >
                      <Icon size={20} />
                      <span className="text-xs font-medium">{mode.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Account Select */}
            <div className="space-y-2">
              <Label htmlFor="account" className="text-gray-300 text-sm">
                Deposit To
              </Label>
              <Select value={account} onValueChange={setAccount}>
                <SelectTrigger className="bg-gray-900 border-gray-700 text-white h-10">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700 text-white">
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      <span className="flex items-center gap-2">
                        <span>{acc.icon}</span>
                        <span>{acc.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>

      {/* Payment Summary Badge */}
      <div className={cn(
        "flex items-center justify-between p-3 rounded-lg border-2",
        strategy === 'full_credit'
          ? "bg-yellow-500/10 border-yellow-500/30"
          : strategy === 'full_cash'
          ? "bg-green-500/10 border-green-500/30"
          : "bg-blue-500/10 border-blue-500/30"
      )}>
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            strategy === 'full_credit'
              ? "bg-yellow-400"
              : strategy === 'full_cash'
              ? "bg-green-400"
              : "bg-blue-400"
          )} />
          <span className={cn(
            "text-sm font-medium",
            strategy === 'full_credit'
              ? "text-yellow-400"
              : strategy === 'full_cash'
              ? "text-green-400"
              : "text-blue-400"
          )}>
            {strategy === 'full_credit' && "Full Credit (Udhaar)"}
            {strategy === 'full_cash' && "Paid in Full"}
            {strategy === 'partial' && "Partial Payment"}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {strategy === 'full_credit' && dueDate && `Due: ${format(dueDate, "MMM dd")}`}
          {strategy === 'full_cash' && "No Balance"}
          {strategy === 'partial' && `${((paidAmount / grandTotal) * 100).toFixed(0)}% Paid`}
        </span>
      </div>
    </div>
  );
};