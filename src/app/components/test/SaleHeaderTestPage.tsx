import React, { useState } from 'react';
import { 
  User, 
  Calendar, 
  FileText, 
  Hash, 
  CheckCircle, 
  UserCheck, 
  Tag,
  MoreVertical,
  Settings
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { CalendarDatePicker } from '../ui/CalendarDatePicker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { cn } from '../ui/utils';
import { format } from 'date-fns';

type DesignOption = 'A' | 'B' | 'C';

export const SaleHeaderTestPage = () => {
  const [selectedOption, setSelectedOption] = useState<DesignOption>('A');
  const [moreOpen, setMoreOpen] = useState(false);
  
  // Mock state for form fields
  const [customer, setCustomer] = useState('Walk-in Customer');
  const [date, setDate] = useState<Date>(new Date());
  const [refNumber, setRefNumber] = useState('REF-001');
  const [invoiceNumber, setInvoiceNumber] = useState('INV-2024-001');
  const [status, setStatus] = useState<'draft' | 'quotation' | 'order' | 'final'>('final');
  const [salesman, setSalesman] = useState('John Doe');
  const [type, setType] = useState<'regular' | 'studio'>('regular');

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'draft': return 'bg-gray-500/20 text-gray-400 border-gray-600/50';
      case 'quotation': return 'bg-yellow-500/20 text-yellow-400 border-yellow-600/50';
      case 'order': return 'bg-blue-500/20 text-blue-400 border-blue-600/50';
      case 'final': return 'bg-green-500/20 text-green-400 border-green-600/50';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-600/50';
    }
  };

  // Option A: Priority + Compression Layout
  const renderOptionA = () => (
    <div className="flex items-center gap-3 w-full">
      {/* Customer - Takes maximum space */}
      <div className="flex-1 min-w-0">
        <Label className="text-xs text-gray-500 mb-1.5 block">Customer</Label>
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
          <User size={14} className="text-gray-500 shrink-0" />
          <Input
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            className="border-0 bg-transparent p-0 h-auto text-sm text-white focus-visible:ring-0"
            placeholder="Select customer"
          />
        </div>
      </div>

      {/* Date */}
      <div className="w-32">
        <Label className="text-xs text-gray-500 mb-1.5 block">Date</Label>
        <div className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
          <div className="text-sm text-white">{format(date, 'MMM dd, yyyy')}</div>
        </div>
      </div>

      {/* Ref # - Compressed, muted */}
      <div className="w-24">
        <Label className="text-xs text-gray-500 mb-1.5 block">Ref #</Label>
        <Input
          value={refNumber}
          onChange={(e) => setRefNumber(e.target.value)}
          className="bg-gray-900/50 border-gray-800/50 text-gray-400 text-xs h-8"
          placeholder="REF"
        />
      </div>

      {/* Invoice # */}
      <div className="w-32">
        <Label className="text-xs text-gray-500 mb-1.5 block">Invoice #</Label>
        <Input
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
          className="bg-gray-900 border border-gray-800 text-white text-sm h-8"
        />
      </div>

      {/* Status */}
      <div className="w-28">
        <Label className="text-xs text-gray-500 mb-1.5 block">Status</Label>
        <Badge className={cn("w-full justify-center text-xs", getStatusColor(status))}>
          {status}
        </Badge>
      </div>

      {/* Salesman - Compressed with icon */}
      <div className="w-28">
        <Label className="text-xs text-gray-500 mb-1.5 block">Salesman</Label>
        <div className="flex items-center gap-1.5 bg-gray-900/50 border-gray-800/50 rounded-lg px-2 py-1.5">
          <UserCheck size={12} className="text-gray-500 shrink-0" />
          <span className="text-xs text-gray-400 truncate">{salesman}</span>
        </div>
      </div>

      {/* Type - Compressed with icon */}
      <div className="w-24">
        <Label className="text-xs text-gray-500 mb-1.5 block">Type</Label>
        <div className="flex items-center gap-1.5 bg-gray-900/50 border-gray-800/50 rounded-lg px-2 py-1.5">
          <Tag size={12} className="text-gray-500 shrink-0" />
          <span className="text-xs text-gray-400">{type}</span>
        </div>
      </div>
    </div>
  );

  // Option B: Grouped Single-Row Layout
  const renderOptionB = () => (
    <div className="flex items-center gap-4 w-full">
      {/* Left Group: Customer, Date, Ref */}
      <div className="flex items-center gap-3 flex-1 pr-4 border-r border-gray-800">
        {/* Customer */}
        <div className="flex-1 min-w-0">
          <Label className="text-xs text-gray-500 mb-1.5 block">Customer</Label>
          <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
            <User size={14} className="text-gray-500 shrink-0" />
            <Input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              className="border-0 bg-transparent p-0 h-auto text-sm text-white focus-visible:ring-0"
              placeholder="Select customer"
            />
          </div>
        </div>

        {/* Date */}
        <div className="w-32">
          <Label className="text-xs text-gray-500 mb-1.5 block">Date</Label>
          <div className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
            <div className="text-sm text-white">{format(date, 'MMM dd, yyyy')}</div>
          </div>
        </div>

        {/* Ref # */}
        <div className="w-24">
          <Label className="text-xs text-gray-500 mb-1.5 block">Ref #</Label>
          <Input
            value={refNumber}
            onChange={(e) => setRefNumber(e.target.value)}
            className="bg-gray-900 border border-gray-800 text-white text-xs h-8"
            placeholder="REF"
          />
        </div>
      </div>

      {/* Right Group: Invoice, Status, Salesman, Type */}
      <div className="flex items-center gap-3 pl-4">
        {/* Invoice # */}
        <div className="w-32">
          <Label className="text-xs text-gray-500 mb-1.5 block">Invoice #</Label>
          <Input
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            className="bg-gray-900 border border-gray-800 text-white text-sm h-8"
          />
        </div>

        {/* Status */}
        <div className="w-28">
          <Label className="text-xs text-gray-500 mb-1.5 block">Status</Label>
          <Badge className={cn("w-full justify-center text-xs", getStatusColor(status))}>
            {status}
          </Badge>
        </div>

        {/* Salesman */}
        <div className="w-32">
          <Label className="text-xs text-gray-500 mb-1.5 block">Salesman</Label>
          <Select value={salesman} onValueChange={setSalesman}>
            <SelectTrigger className="bg-gray-900 border-gray-800 text-white text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800 text-white">
              <SelectItem value="John Doe">John Doe</SelectItem>
              <SelectItem value="Jane Smith">Jane Smith</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Type */}
        <div className="w-28">
          <Label className="text-xs text-gray-500 mb-1.5 block">Type</Label>
          <Select value={type} onValueChange={(v: any) => setType(v)}>
            <SelectTrigger className="bg-gray-900 border-gray-800 text-white text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800 text-white">
              <SelectItem value="regular">Regular</SelectItem>
              <SelectItem value="studio">Studio</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  // Option C: Smart Collapse Layout
  const renderOptionC = () => (
    <div className="flex items-center gap-3 w-full">
      {/* Customer */}
      <div className="flex-1 min-w-0">
        <Label className="text-xs text-gray-500 mb-1.5 block">Customer</Label>
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
          <User size={14} className="text-gray-500 shrink-0" />
          <Input
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            className="border-0 bg-transparent p-0 h-auto text-sm text-white focus-visible:ring-0"
            placeholder="Select customer"
          />
        </div>
      </div>

      {/* Date */}
      <div className="w-32">
        <Label className="text-xs text-gray-500 mb-1.5 block">Date</Label>
        <div className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
          <div className="text-sm text-white">{format(date, 'MMM dd, yyyy')}</div>
        </div>
      </div>

      {/* Invoice # */}
      <div className="w-32">
        <Label className="text-xs text-gray-500 mb-1.5 block">Invoice #</Label>
        <Input
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
          className="bg-gray-900 border border-gray-800 text-white text-sm h-8"
        />
      </div>

      {/* Status */}
      <div className="w-28">
        <Label className="text-xs text-gray-500 mb-1.5 block">Status</Label>
        <Badge className={cn("w-full justify-center text-xs", getStatusColor(status))}>
          {status}
        </Badge>
      </div>

      {/* More Button */}
      <div className="w-auto pt-6">
        <Popover open={moreOpen} onOpenChange={setMoreOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800"
            >
              <MoreVertical size={16} />
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-64 bg-gray-900 border-gray-800 text-white p-4"
            align="end"
          >
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Ref #</Label>
                <Input
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white text-sm h-8"
                  placeholder="REF"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Salesman</Label>
                <Select value={salesman} onValueChange={setSalesman}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white text-sm h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="John Doe">John Doe</SelectItem>
                    <SelectItem value="Jane Smith">Jane Smith</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Type</Label>
                <Select value={type} onValueChange={(v: any) => setType(v)}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white text-sm h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="studio">Studio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#111827] text-white p-8">
      <div className="max-w-[1100px] mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Sale/Purchase Header Layout Test</h1>
          <p className="text-sm text-gray-400">
            Experimenting with different header layouts for Add Sale / Add Purchase forms
          </p>
        </div>

        {/* Option Selector */}
        <div className="mb-6 flex gap-2">
          <Button
            variant={selectedOption === 'A' ? 'default' : 'outline'}
            onClick={() => setSelectedOption('A')}
            className={cn(
              selectedOption === 'A' 
                ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                : 'border-gray-700 text-gray-300 hover:bg-gray-800'
            )}
          >
            Option A: Priority + Compression
          </Button>
          <Button
            variant={selectedOption === 'B' ? 'default' : 'outline'}
            onClick={() => setSelectedOption('B')}
            className={cn(
              selectedOption === 'B' 
                ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                : 'border-gray-700 text-gray-300 hover:bg-gray-800'
            )}
          >
            Option B: Grouped Single-Row
          </Button>
          <Button
            variant={selectedOption === 'C' ? 'default' : 'outline'}
            onClick={() => setSelectedOption('C')}
            className={cn(
              selectedOption === 'C' 
                ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                : 'border-gray-700 text-gray-300 hover:bg-gray-800'
            )}
          >
            Option C: Smart Collapse
          </Button>
        </div>

        {/* Test Container - Matches drawer width */}
        <div className="bg-[#0B1019] border border-gray-800 rounded-lg p-6">
          {/* Simulated Header Bar */}
          <div className="mb-4 pb-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">New Sale Invoice</h2>
                <p className="text-[10px] text-gray-500">Standard Entry</p>
              </div>
            </div>
          </div>

          {/* Header Fields Section */}
          <div className="bg-[#0F1419] rounded-lg p-4">
            {selectedOption === 'A' && renderOptionA()}
            {selectedOption === 'B' && renderOptionB()}
            {selectedOption === 'C' && renderOptionC()}
          </div>

          {/* Option Description */}
          <div className="mt-4 p-4 bg-gray-900/50 border border-gray-800 rounded-lg">
            <h3 className="text-sm font-semibold text-white mb-2">
              {selectedOption === 'A' && 'Option A: Priority + Compression Layout'}
              {selectedOption === 'B' && 'Option B: Grouped Single-Row Layout'}
              {selectedOption === 'C' && 'Option C: Smart Collapse Layout'}
            </h3>
            <p className="text-xs text-gray-400">
              {selectedOption === 'A' && 
                'Customer takes maximum space (flex-1). Lower priority fields (Ref, Type, Salesman) are visually compressed with icons and muted styling.'}
              {selectedOption === 'B' && 
                'Fields grouped into two logical sections: Left (Customer, Date, Ref) and Right (Invoice, Status, Salesman, Type) with visual separator.'}
              {selectedOption === 'C' && 
                'Default view shows only essential fields (Customer, Date, Invoice, Status). Click the "More" icon to access Ref #, Salesman, and Type in a popover.'}
            </p>
          </div>
        </div>

        {/* Visual Width Indicator */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            Container width: <span className="text-gray-400 font-mono">1100px</span> (matches drawer width)
          </p>
        </div>
      </div>
    </div>
  );
};
