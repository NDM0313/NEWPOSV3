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
import { formatDate } from '../../../utils/dateFormat';
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
    { id: 'cash' as PaymentMode, icon: Banknote, label: 'Cash', color: 'var(--color-success)', bgColor: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.3)' },
    { id: 'card' as PaymentMode, icon: CreditCard, label: 'Card', color: 'var(--color-primary)', bgColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)' },
    { id: 'bank' as PaymentMode, icon: Building2, label: 'Bank', color: 'var(--color-wholesale)', bgColor: 'rgba(168, 85, 247, 0.1)', borderColor: 'rgba(168, 85, 247, 0.3)' },
    { id: 'cheque' as PaymentMode, icon: FileText, label: 'Cheque', color: 'var(--color-warning)', bgColor: 'rgba(249, 115, 22, 0.1)', borderColor: 'rgba(249, 115, 22, 0.3)' },
  ];

  const accounts = [
    { id: 'cash_hand', label: 'Cash in Hand', icon: '💵' },
    { id: 'bank_main', label: 'Meezan Bank (Main)', icon: '🏦' },
    { id: 'bank_saving', label: 'Allied Bank (Savings)', icon: '🏦' },
    { id: 'petty_cash', label: 'Petty Cash', icon: '💰' },
  ];

  return (
    <div 
      className="border-t p-6 space-y-6"
      style={{
        backgroundColor: 'var(--color-bg-card)',
        borderTopColor: 'var(--color-border-primary)'
      }}
    >
      {/* Grand Total Display */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span 
            className="text-sm uppercase tracking-wide"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Net Payable
          </span>
          {type === 'sale' && (
            <div 
              className="flex items-center gap-1 text-xs"
              style={{ color: 'var(--color-primary)' }}
            >
              <DollarSign size={12} />
              <span>Sales</span>
            </div>
          )}
        </div>
        <div 
          className="text-[32px] font-bold leading-none"
          style={{ color: 'var(--color-text-primary)' }}
        >
          ${grandTotal.toFixed(2)}
        </div>
      </div>

      {/* Quick Actions Row */}
      <div className="grid grid-cols-3 gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleFullCredit}
          className="h-11 flex flex-col items-center justify-center gap-1 border-2 transition-all"
          style={{
            borderColor: strategy === 'full_credit' 
              ? 'var(--color-warning)' 
              : 'rgba(234, 179, 8, 0.3)',
            backgroundColor: strategy === 'full_credit' 
              ? 'rgba(234, 179, 8, 0.1)' 
              : 'transparent',
            color: 'var(--color-warning)'
          }}
          onMouseEnter={(e) => {
            if (strategy !== 'full_credit') {
              e.currentTarget.style.backgroundColor = 'rgba(234, 179, 8, 0.05)';
            }
          }}
          onMouseLeave={(e) => {
            if (strategy !== 'full_credit') {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <span className="text-lg">📝</span>
          <span className="text-xs font-medium">Full Credit</span>
        </Button>

        <Button
          type="button"
          onClick={handleFullCash}
          className="h-11 flex flex-col items-center justify-center gap-1 transition-all"
          style={{
            backgroundColor: strategy === 'full_cash' 
              ? 'var(--color-success)' 
              : 'rgba(34, 197, 94, 0.8)',
            color: 'var(--color-text-primary)',
            boxShadow: strategy === 'full_cash' 
              ? '0 10px 15px -3px rgba(34, 197, 94, 0.2)' 
              : 'none'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = strategy === 'full_cash' 
              ? 'rgba(34, 197, 94, 0.9)' 
              : 'var(--color-success)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = strategy === 'full_cash' 
              ? 'var(--color-success)' 
              : 'rgba(34, 197, 94, 0.8)';
          }}
        >
          <span className="text-lg">💵</span>
          <span className="text-xs font-medium">Full Cash</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={handlePartial}
          className="h-11 flex flex-col items-center justify-center gap-1 border-2 transition-all"
          style={{
            borderColor: strategy === 'partial' 
              ? 'var(--color-primary)' 
              : 'rgba(59, 130, 246, 0.3)',
            backgroundColor: strategy === 'partial' 
              ? 'rgba(59, 130, 246, 0.1)' 
              : 'transparent',
            color: 'var(--color-primary)'
          }}
          onMouseEnter={(e) => {
            if (strategy !== 'partial') {
              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
            }
          }}
          onMouseLeave={(e) => {
            if (strategy !== 'partial') {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <span className="text-lg">🔀</span>
          <span className="text-xs font-medium">Partial</span>
        </Button>
      </div>

      {/* Payment Details Form */}
      <div 
        className="space-y-4 p-4 border rounded-lg"
        style={{
          backgroundColor: 'var(--color-bg-tertiary)',
          borderColor: 'var(--color-border-primary)',
          borderRadius: 'var(--radius-lg)'
        }}
      >
        {/* Amount Input */}
        <div className="space-y-2">
          <Label 
            htmlFor="amount" 
            className="text-sm"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Amount Collecting
          </Label>
          <div className="relative">
            <span 
              className="absolute left-3 top-1/2 -translate-y-1/2 text-lg"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              $
            </span>
            <Input
              ref={amountInputRef}
              id="amount"
              type="number"
              step="0.01"
              min="0"
              max={grandTotal}
              value={paidAmount}
              onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0)}
              className="pl-8 h-12 text-xl font-bold"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderColor: paidAmount < grandTotal 
                  ? 'var(--color-warning)' 
                  : 'var(--color-border-secondary)',
                color: 'var(--color-text-primary)',
                borderRadius: 'var(--radius-sm)'
              }}
              placeholder="0.00"
            />
          </div>
          
          {/* Balance Due Indicator */}
          {balanceDue > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <AlertCircle size={14} style={{ color: 'var(--color-error)' }} />
              <span 
                className="font-medium"
                style={{ color: 'var(--color-error)' }}
              >
                Balance Due: ${balanceDue.toFixed(2)}
              </span>
            </div>
          )}

          {/* Split Payment Display */}
          {strategy === 'partial' && paidAmount > 0 && balanceDue > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div 
                className="border rounded-lg p-2"
                style={{
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  borderColor: 'rgba(34, 197, 94, 0.3)',
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                <div 
                  className="text-xs mb-1"
                  style={{ color: 'var(--color-success)' }}
                >
                  Collecting Now
                </div>
                <div 
                  className="text-lg font-bold"
                  style={{ color: 'var(--color-success)' }}
                >
                  ${paidAmount.toFixed(2)}
                </div>
              </div>
              <div 
                className="border rounded-lg p-2"
                style={{
                  backgroundColor: 'rgba(234, 179, 8, 0.1)',
                  borderColor: 'rgba(234, 179, 8, 0.3)',
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                <div 
                  className="text-xs mb-1"
                  style={{ color: 'var(--color-warning)' }}
                >
                  On Account
                </div>
                <div 
                  className="text-lg font-bold"
                  style={{ color: 'var(--color-warning)' }}
                >
                  ${balanceDue.toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Due Date Picker (Only for Full Credit) */}
        {strategy === 'full_credit' && (
          <div 
            className="space-y-2 p-3 border rounded-lg"
            style={{
              backgroundColor: 'rgba(234, 179, 8, 0.05)',
              borderColor: 'rgba(234, 179, 8, 0.2)',
              borderRadius: 'var(--radius-lg)'
            }}
          >
            <Label 
              htmlFor="due-date" 
              className="text-sm flex items-center gap-2"
              style={{ color: 'var(--color-warning)' }}
            >
              <CalendarIcon size={14} />
              Payment Due Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'rgba(234, 179, 8, 0.3)',
                    color: dueDate ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                  }}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? formatDate(dueDate) : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-auto p-0"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border-primary)'
                }}
              >
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </PopoverContent>
            </Popover>
            <p 
              className="text-xs"
              style={{ color: 'rgba(234, 179, 8, 0.7)' }}
            >
              Customer will need to pay by this date
            </p>
          </div>
        )}

            {/* Payment Mode Visual Tabs */}
        {paidAmount > 0 && (
          <>
            <div className="space-y-2">
              <Label 
                className="text-sm"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Payment Method
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {paymentModes.map((mode) => {
                  const Icon = mode.icon;
                  const isActive = paymentMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setPaymentMode(mode.id)}
                      className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all"
                      style={{
                        backgroundColor: isActive ? mode.bgColor : 'var(--color-bg-card)',
                        borderColor: isActive ? mode.borderColor : 'var(--color-border-primary)',
                        color: isActive ? mode.color : 'var(--color-text-tertiary)',
                        borderRadius: 'var(--radius-lg)'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                          e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                        }
                      }}
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
              <Label 
                htmlFor="account" 
                className="text-sm"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Deposit To
              </Label>
              <Select value={account} onValueChange={setAccount}>
                <SelectTrigger 
                  className="h-10"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent 
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
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
      <div 
        className="flex items-center justify-between p-3 rounded-lg border-2"
        style={{
          backgroundColor: strategy === 'full_credit'
            ? 'rgba(234, 179, 8, 0.1)'
            : strategy === 'full_cash'
            ? 'rgba(34, 197, 94, 0.1)'
            : 'rgba(59, 130, 246, 0.1)',
          borderColor: strategy === 'full_credit'
            ? 'rgba(234, 179, 8, 0.3)'
            : strategy === 'full_cash'
            ? 'rgba(34, 197, 94, 0.3)'
            : 'rgba(59, 130, 246, 0.3)',
          borderRadius: 'var(--radius-lg)'
        }}
      >
        <div className="flex items-center gap-2">
          <div 
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: strategy === 'full_credit'
                ? 'var(--color-warning)'
                : strategy === 'full_cash'
                ? 'var(--color-success)'
                : 'var(--color-primary)',
              borderRadius: 'var(--radius-full)'
            }}
          />
          <span 
            className="text-sm font-medium"
            style={{
              color: strategy === 'full_credit'
                ? 'var(--color-warning)'
                : strategy === 'full_cash'
                ? 'var(--color-success)'
                : 'var(--color-primary)'
            }}
          >
            {strategy === 'full_credit' && "Full Credit (Udhaar)"}
            {strategy === 'full_cash' && "Paid in Full"}
            {strategy === 'partial' && "Partial Payment"}
          </span>
        </div>
        <span 
          className="text-xs"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          {strategy === 'full_credit' && dueDate && `Due: ${formatDate(dueDate)}`}
          {strategy === 'full_cash' && "No Balance"}
          {strategy === 'partial' && `${((paidAmount / grandTotal) * 100).toFixed(0)}% Paid`}
        </span>
      </div>
    </div>
  );
};