import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  Calendar as CalendarIcon, 
  Building2, 
  Zap, 
  Users, 
  Plus, 
  Wallet, 
  CreditCard 
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "../ui/sheet";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { formatDate } from '../../../utils/dateFormat';
import { cn } from "../ui/utils";
import { VirtualNumpad } from "../ui/virtual-numpad";

interface AddExpenseDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddExpenseDrawer = ({ isOpen, onClose }: AddExpenseDrawerProps) => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isNumpadOpen, setIsNumpadOpen] = useState(false);

  // Mock data for dropdowns
  const categories = [
    { id: 'rent', name: 'Rent', icon: Building2, color: 'var(--color-primary)' },
    { id: 'utilities', name: 'Electricity', icon: Zap, color: 'var(--color-warning)' },
    { id: 'salary', name: 'Salary', icon: Users, color: 'var(--color-wholesale)' },
  ];

  const accounts = [
    { id: 'cash', name: 'Cash in Hand', balance: 45000, icon: Wallet },
    { id: 'meezan', name: 'Meezan Bank', balance: 1250000, icon: Building2 },
    { id: 'jazzcash', name: 'JazzCash', balance: 12500, icon: CreditCard },
  ];

  const handleAmountFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Check if mobile (width < 768px)
    if (window.innerWidth < 768) {
      e.preventDefault();
      e.target.blur(); // Prevent native keyboard
      setIsNumpadOpen(true);
    }
    // On desktop, do nothing (allow default focus/typing)
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent 
          side="right" 
          className="w-full sm:max-w-md border-l p-0 flex flex-col"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            borderLeftColor: 'var(--color-border-primary)',
            color: 'var(--color-text-primary)'
          }}
        >
          {/* Header */}
          <SheetHeader 
            className="p-6 border-b flex flex-row items-center justify-between space-y-0"
            style={{ borderBottomColor: 'var(--color-border-primary)' }}
          >
            <SheetTitle 
              className="text-xl font-bold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Record Expense
            </SheetTitle>
            <SheetClose asChild>
              <Button 
                variant="ghost" 
                size="icon"
                style={{ color: 'var(--color-text-secondary)' }}
                onClick={onClose}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                }}
              >
                <X size={24} />
              </Button>
            </SheetClose>
          </SheetHeader>

          {/* Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Row 1: Date Picker */}
            <div className="space-y-2">
              <Label style={{ color: 'var(--color-text-secondary)' }}>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal h-12",
                      !date && "text-muted-foreground"
                    )}
                    style={{
                      backgroundColor: 'var(--color-bg-card)',
                      borderColor: 'var(--color-border-secondary)',
                      color: 'var(--color-text-primary)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                      e.currentTarget.style.color = 'var(--color-text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                      e.currentTarget.style.color = 'var(--color-text-primary)';
                    }}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? formatDate(date) : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-primary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Row 2: Category Dropdown */}
            <div className="space-y-2">
              <Label style={{ color: 'var(--color-text-secondary)' }}>Category</Label>
              <Select>
                <SelectTrigger 
                  className="h-12"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-primary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  {categories.map((cat) => (
                    <SelectItem 
                      key={cat.id} 
                      value={cat.id} 
                      className="cursor-pointer"
                      style={{ color: 'var(--color-text-primary)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <cat.icon className="h-4 w-4" style={{ color: cat.color }} />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                  <div 
                    className="p-2 border-t mt-1"
                    style={{ borderTopColor: 'var(--color-border-primary)' }}
                  >
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full justify-start h-8"
                      style={{ color: 'var(--color-primary)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--color-primary)';
                        e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--color-primary)';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" /> Add Category
                    </Button>
                  </div>
                </SelectContent>
              </Select>
            </div>

            {/* Row 3: Paid From Account */}
            <div className="space-y-2">
              <Label style={{ color: 'var(--color-text-secondary)' }}>Paid From</Label>
              <Select>
                <SelectTrigger 
                  className="h-12"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  <SelectValue placeholder="Select Account" />
                </SelectTrigger>
                <SelectContent
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-primary)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  {accounts.map((acc) => (
                    <SelectItem 
                      key={acc.id} 
                      value={acc.id} 
                      className="cursor-pointer"
                      style={{ color: 'var(--color-text-primary)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div className="flex items-center justify-between w-full gap-4">
                        <div className="flex items-center gap-2">
                          <acc.icon className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
                          {acc.name}
                        </div>
                        <span 
                          className="text-xs font-mono"
                          style={{ color: 'var(--color-success)' }}
                        >
                          ${acc.balance.toLocaleString()}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Row 4: Amount Input */}
            <div className="space-y-2">
              <Label style={{ color: 'var(--color-text-secondary)' }}>Amount</Label>
              <div className="relative">
                <span 
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-light"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  $
                </span>
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onFocus={handleAmountFocus}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--color-border-secondary)';
                  }}
                  placeholder="0.00"
                  className="pl-8 h-12"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </div>
            </div>

            {/* Row 5: Description Area */}
            <div className="space-y-2">
              <Label style={{ color: 'var(--color-text-secondary)' }}>Description</Label>
              <Textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter expense details..." 
                className="min-h-[100px] resize-none"
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

            {/* Row 6: Upload Receipt Box */}
            <div className="space-y-2">
              <Label style={{ color: 'var(--color-text-secondary)' }}>Upload Receipt</Label>
              <div 
                className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group"
                style={{
                  borderColor: 'var(--color-border-secondary)',
                  backgroundColor: 'rgba(31, 41, 55, 0.5)',
                  borderRadius: 'var(--radius-lg)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.7)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.5)';
                }}
              >
                <div 
                  className="h-10 w-10 rounded-full flex items-center justify-center mb-2 transition-transform border"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-secondary)',
                    borderRadius: 'var(--radius-full)'
                  }}
                >
                  <Upload className="h-5 w-5" style={{ color: 'var(--color-text-secondary)' }} />
                </div>
                <p 
                  className="text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Click to upload bill
                </p>
                <p 
                  className="text-xs mt-1"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  PNG, JPG up to 5MB
                </p>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div 
            className="p-6 border-t backdrop-blur-sm"
            style={{
              borderTopColor: 'var(--color-border-primary)',
              backgroundColor: 'rgba(17, 24, 39, 0.8)'
            }}
          >
            <Button 
              className="w-full font-semibold py-6 text-lg transition-all active:scale-[0.98]"
              style={{
                backgroundColor: 'var(--color-warning)',
                color: 'var(--color-text-primary)',
                boxShadow: '0 10px 15px -3px rgba(249, 115, 22, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-warning)';
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-warning)';
                e.currentTarget.style.opacity = '1';
              }}
            >
              Save Expense
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <VirtualNumpad 
        isOpen={isNumpadOpen} 
        onClose={() => setIsNumpadOpen(false)}
        onSubmit={(val) => setAmount(val)}
        initialValue={amount}
        label="Enter Expense Amount"
      />
    </>
  );
};
