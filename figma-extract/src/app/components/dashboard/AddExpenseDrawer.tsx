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
  CreditCard,
  MapPin
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
import { Sheet, SheetContent } from "../ui/sheet";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { format } from "date-fns";
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
  const [selectedBranch, setSelectedBranch] = useState("main-store");

  // Mock user role (in real app, get from auth context)
  const userRole = "Admin"; // Change to "Manager" or "Staff" to test

  // Mock data for branches
  const branches = [
    { id: 'main-store', name: 'Main Store', location: 'Liberty Market' },
    { id: 'outlet-1', name: 'Outlet 1', location: 'Gulberg' },
    { id: 'outlet-2', name: 'Outlet 2', location: 'DHA Phase 5' },
    { id: 'warehouse', name: 'Warehouse', location: 'Sundar Industrial' },
  ];

  // Get current branch details
  const currentBranch = branches.find(b => b.id === selectedBranch) || branches[0];

  // Mock data for dropdowns
  const categories = [
    { id: 'rent', name: 'Rent', icon: Building2, color: 'text-blue-500' },
    { id: 'utilities', name: 'Electricity', icon: Zap, color: 'text-yellow-500' },
    { id: 'salary', name: 'Salary', icon: Users, color: 'text-purple-500' },
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
        <SheetContent side="right" className="w-full sm:max-w-md bg-[#111827] border-l border-gray-800 text-white p-0 flex flex-col">
          
          {/* TOP HEADER - Branch Info */}
          <div className="bg-gray-900 p-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-600/20 backdrop-blur-sm flex items-center justify-center border border-blue-600/30">
                  <Building2 size={20} className="text-blue-400" />
                </div>
                <div>
                  {userRole === "Admin" ? (
                    // Admin sees dropdown
                    <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                      <SelectTrigger className="h-8 bg-gray-800 border-gray-700 text-white hover:bg-gray-700 w-[200px] focus:ring-0 focus:ring-offset-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-gray-700 text-white">
                        {branches.map((branch) => (
                          <SelectItem 
                            key={branch.id} 
                            value={branch.id}
                            className="focus:bg-gray-800 focus:text-white cursor-pointer"
                          >
                            <div className="flex flex-col items-start">
                              <span className="font-medium">{branch.name}</span>
                              <span className="text-xs text-gray-400">{branch.location}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    // Other roles see static text
                    <>
                      <p className="text-white font-semibold text-sm">{currentBranch.name}</p>
                      <p className="text-gray-400 text-xs flex items-center gap-1">
                        <MapPin size={10} />
                        {currentBranch.location}
                      </p>
                    </>
                  )}
                </div>
              </div>
              
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-gray-400 hover:text-white hover:bg-gray-800 h-8 w-8" 
                onClick={onClose}
              >
                <X size={20} />
              </Button>
            </div>
          </div>

          {/* TITLE BAR */}
          <div className="p-4 border-b border-gray-800">
            <h2 className="text-xl font-bold text-white">Record Expense</h2>
            <p className="text-sm text-gray-400 mt-1">Track operational costs and expenditures</p>
          </div>

          {/* Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* Row 1: Date Picker */}
            <div className="space-y-2">
              <Label className="text-gray-400 text-sm">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal h-11 bg-gray-900 border-gray-700 text-white hover:bg-gray-800 hover:text-white",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-gray-900 border-gray-800 text-white">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    className="bg-gray-900 text-white"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Row 2: Category Dropdown */}
            <div className="space-y-2">
              <Label className="text-gray-400 text-sm">Category</Label>
              <Select>
                <SelectTrigger className="h-11 bg-gray-900 border-gray-700 text-white">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800 text-white">
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id} className="focus:bg-gray-800 focus:text-white cursor-pointer">
                      <div className="flex items-center gap-2">
                        <cat.icon className={cn("h-4 w-4", cat.color)} />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                  <div className="p-2 border-t border-gray-800 mt-1">
                    <Button variant="ghost" size="sm" className="w-full justify-start text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 h-8">
                      <Plus className="mr-2 h-4 w-4" /> Add Category
                    </Button>
                  </div>
                </SelectContent>
              </Select>
            </div>

            {/* Row 3: Paid From Account */}
            <div className="space-y-2">
              <Label className="text-gray-400 text-sm">Paid From</Label>
              <Select>
                <SelectTrigger className="h-11 bg-gray-900 border-gray-700 text-white">
                  <SelectValue placeholder="Select Account" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800 text-white">
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id} className="focus:bg-gray-800 focus:text-white cursor-pointer">
                      <div className="flex items-center justify-between w-full gap-4">
                        <div className="flex items-center gap-2">
                          <acc.icon className="h-4 w-4 text-gray-400" />
                          {acc.name}
                        </div>
                        <span className="text-xs text-green-500 font-mono">
                          Rs {acc.balance.toLocaleString()}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Row 4: Amount Input */}
            <div className="space-y-2">
              <Label className="text-gray-400 text-sm">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">Rs</span>
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onFocus={handleAmountFocus}
                  placeholder="0.00"
                  className="pl-10 h-11 bg-gray-900 border-gray-700 text-white placeholder:text-gray-600 focus:border-blue-500 text-base"
                />
              </div>
            </div>

            {/* Row 5: Description Area */}
            <div className="space-y-2">
              <Label className="text-gray-400 text-sm">Description</Label>
              <Textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter expense details..." 
                className="bg-gray-900 border-gray-700 text-white min-h-[100px] resize-none focus:border-blue-500"
              />
            </div>

            {/* Row 6: Upload Receipt Box */}
            <div className="space-y-2">
              <Label className="text-gray-400 text-sm">Upload Receipt (Optional)</Label>
              <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-gray-800/50 transition-colors cursor-pointer group bg-gray-900/50">
                <div className="h-10 w-10 rounded-full bg-gray-800 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform border border-gray-700">
                  <Upload className="h-5 w-5 text-gray-400" />
                </div>
                <p className="text-sm text-gray-400">Click to upload bill</p>
                <p className="text-xs text-gray-600 mt-1">PNG, JPG up to 5MB</p>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-800 bg-gray-900/80 backdrop-blur-sm">
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white h-11"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button className="bg-orange-600 hover:bg-orange-500 text-white font-semibold h-11 shadow-lg shadow-orange-600/20 transition-all active:scale-[0.98]">
                Save Expense
              </Button>
            </div>
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