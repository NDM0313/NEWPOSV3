/**
 * Purchase Header Test Page – Sale jesa design, Purchase fields only.
 * Scope: UI/layout only. No business logic or backend.
 * Use for visual approval before applying to actual Purchase module.
 */

import React, { useState } from 'react';
import { X, User, FileText, Hash, Building2, ChevronRight, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { CalendarDatePicker } from '../ui/CalendarDatePicker';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { cn } from '../ui/utils';
import { useNavigation } from '@/app/context/NavigationContext';

type PurchaseStatus = 'draft' | 'ordered' | 'received' | 'final';

const STATUS_OPTIONS: PurchaseStatus[] = ['draft', 'ordered', 'received', 'final'];
const BRANCHES = [{ id: '1', name: 'Main Branch' }, { id: '2', name: 'Branch B' }];
const SUPPLIERS: { id: string; name: string; dueBalance: number }[] = [
  { id: '1', name: 'Supplier A', dueBalance: 0 },
  { id: '2', name: 'Supplier B', dueBalance: -12500 },
  { id: '3', name: 'Supplier C', dueBalance: 8500 },
  { id: '4', name: 'Supplier XYZ', dueBalance: 0 },
  { id: '5', name: 'John Supplies', dueBalance: -500 },
  { id: '6', name: 'Sarah Enterprises', dueBalance: 12000 },
];

export const PurchaseHeaderTestPage = () => {
  const { setCurrentView, openDrawer } = useNavigation();
  const [status, setStatus] = useState<PurchaseStatus>('draft');
  const [statusOpen, setStatusOpen] = useState(false);
  const [branchId, setBranchId] = useState('1');
  const [branchOpen, setBranchOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('2');
  const [supplierSearchOpen, setSupplierSearchOpen] = useState(false);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [refNumber, setRefNumber] = useState('REF-001');
  const [invoiceNumber, setInvoiceNumber] = useState('PO-2024-001');

  const getStatusChipColor = () => {
    switch (status) {
      case 'draft': return 'bg-gray-500/20 text-gray-400 border-gray-600/50';
      case 'ordered': return 'bg-yellow-500/20 text-yellow-400 border-yellow-600/50';
      case 'received': return 'bg-blue-500/20 text-blue-400 border-blue-600/50';
      case 'final': return 'bg-green-500/20 text-green-400 border-green-600/50';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-600/50';
    }
  };

  const branchName = BRANCHES.find(b => b.id === branchId)?.name ?? 'Main Branch';
  const selectedSupplier = SUPPLIERS.find(s => s.id === supplierId);
  const filteredSuppliers = SUPPLIERS.filter(s =>
    s.name.toLowerCase().includes(supplierSearchTerm.toLowerCase())
  );

  const formatDueBalanceCompact = (due: number) => {
    if (due === 0) return '0';
    if (due < 0) return `-${Math.abs(due).toLocaleString()}`;
    return `+${due.toLocaleString()}`;
  };
  const getDueBalanceColor = (due: number) => {
    if (due < 0) return 'text-green-400';
    if (due > 0) return 'text-red-400';
    return 'text-gray-500';
  };
  const selectedSupplierDue = selectedSupplier?.dueBalance ?? 0;

  return (
    <div className="flex flex-col h-screen bg-[#111827] text-white overflow-hidden">
      {/* ============ LAYER 1: FIXED HEADER (Same as Sale) ============ */}
      <div className="shrink-0 bg-[#0B1019] border-b border-gray-800 z-20">
        {/* Top Bar – Invoice # left, Status + Branch right (NO Salesman) */}
        <div className="h-12 flex items-center justify-between px-6 border-b border-gray-800/50">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentView('purchases')}
              className="text-gray-400 hover:text-white h-8 w-8"
            >
              <X size={18} />
            </Button>
            <div>
              <h2 className="text-sm font-bold text-white">New Purchase Order</h2>
              <p className="text-[10px] text-gray-500">Standard Entry</p>
            </div>
            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-800">
              <Hash size={14} className="text-cyan-500" />
              <span className="text-sm font-mono text-cyan-400">{invoiceNumber}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Status – Chip (same style as Sale) */}
            <Popover open={statusOpen} onOpenChange={setStatusOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5',
                    getStatusChipColor(),
                    'hover:opacity-80 cursor-pointer'
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 bg-gray-900 border-gray-800 text-white p-2" align="start">
                <div className="space-y-1">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { setStatus(s); setStatusOpen(false); }}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2',
                        status === s ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      )}
                    >
                      <span
                        className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          s === 'draft' && 'bg-gray-500',
                          s === 'ordered' && 'bg-yellow-500',
                          s === 'received' && 'bg-blue-500',
                          s === 'final' && 'bg-green-500'
                        )}
                      />
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Branch – same style as Sale (no Salesman) */}
            <Popover open={branchOpen} onOpenChange={setBranchOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg px-2.5 py-1 hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  <Building2 size={14} className="text-gray-500 shrink-0" />
                  <span className="text-xs text-white">{branchName}</span>
                  <ChevronRight size={12} className="text-gray-500 rotate-90 shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 bg-gray-900 border-gray-800 text-white p-2" align="end">
                <div className="space-y-1">
                  {BRANCHES.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => { setBranchId(b.id); setBranchOpen(false); }}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2',
                        branchId === b.id ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      )}
                    >
                      <Building2 size={16} className={cn(branchId === b.id ? 'text-blue-400' : 'text-gray-500')} />
                      <span>{b.name}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Form Header – Supplier, Date, Ref # (same layout as Sale; no Invoice # row) */}
        <div className="px-6 py-4 bg-[#0F1419]">
          <div className="invoice-container mx-auto w-full">
            <div className="bg-gray-900/30 border border-gray-800/50 rounded-lg p-3">
              <div className="flex items-end gap-3 w-full flex-wrap">
                {/* Supplier – same as Sale Customer: due balance on top + list with balance */}
                <div className="flex-1 min-w-0 min-w-[200px]">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-orange-400 font-medium text-[10px] uppercase tracking-wide h-[14px]">
                      Supplier
                    </Label>
                    {supplierId && (
                      <span className={cn('text-[10px] font-medium tabular-nums', getDueBalanceColor(selectedSupplierDue))}>
                        {formatDueBalanceCompact(selectedSupplierDue)}
                      </span>
                    )}
                  </div>
                  <Popover open={supplierSearchOpen} onOpenChange={setSupplierSearchOpen}>
                    <PopoverTrigger asChild>
                      <div className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg px-2.5 py-1 hover:bg-gray-800 transition-colors cursor-pointer w-full min-h-[40px]">
                        <User size={14} className="text-gray-500 shrink-0" />
                        <span className="text-xs text-white flex-1 truncate text-left">
                          {selectedSupplier?.name || 'Select Supplier'}
                        </span>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            openDrawer?.('addContact', 'addPurchase', { contactType: 'supplier', prefillName: supplierSearchTerm || undefined });
                            setSupplierSearchOpen(false);
                            setSupplierSearchTerm('');
                          }}
                          className="p-0.5 hover:bg-gray-700 rounded transition-colors cursor-pointer"
                        >
                          <Plus size={12} className="text-gray-400 hover:text-blue-400" />
                        </div>
                        <ChevronRight size={12} className="text-gray-500 rotate-90 shrink-0" />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 bg-gray-900 border-gray-800 text-white p-2" align="start">
                      <div className="space-y-2">
                        <Input
                          placeholder="Search suppliers..."
                          value={supplierSearchTerm}
                          onChange={(e) => setSupplierSearchTerm(e.target.value)}
                          className="bg-gray-800 border-gray-700 text-white text-sm h-9"
                        />
                        <div className="space-y-1 max-h-64 overflow-y-auto">
                          {filteredSuppliers.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-gray-400 text-center">No suppliers found</div>
                          ) : (
                            filteredSuppliers.map((sup) => (
                              <button
                                key={sup.id}
                                type="button"
                                onClick={() => {
                                  setSupplierId(sup.id);
                                  setSupplierSearchOpen(false);
                                  setSupplierSearchTerm('');
                                }}
                                className={cn(
                                  'w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center justify-between',
                                  supplierId === sup.id ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                )}
                              >
                                <span className="font-medium">{sup.name}</span>
                                <span className={cn(
                                  'text-xs font-semibold tabular-nums ml-2',
                                  sup.dueBalance < 0 && 'text-green-400',
                                  sup.dueBalance > 0 && 'text-red-400',
                                  sup.dueBalance === 0 && 'text-gray-500'
                                )}>
                                  {formatDueBalanceCompact(sup.dueBalance)}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex flex-col w-32">
                  <Label className="text-gray-500 font-medium text-xs uppercase tracking-wide h-[14px] mb-1.5">
                    Date
                  </Label>
                  <div className="[&>div>button]:bg-gray-900/50 [&>div>button]:border-gray-800 [&>div>button]:text-white [&>div>button]:text-xs [&>div>button]:h-10 [&>div>button]:min-h-[40px] [&>div>button]:px-2.5 [&>div>button]:py-1 [&>div>button]:rounded-lg [&>div>button]:border [&>div>button]:hover:bg-gray-800 [&>div>button]:w-full [&>div>button]:justify-start">
                    <CalendarDatePicker
                      value={date}
                      onChange={(d) => setDate(d || new Date())}
                      showTime={true}
                    />
                  </div>
                </div>

                <div className="flex flex-col w-24">
                  <Label className="text-gray-500 font-medium text-xs uppercase tracking-wide h-[14px] mb-1.5">
                    Ref #
                  </Label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
                    <Input
                      value={refNumber}
                      onChange={(e) => setRefNumber(e.target.value)}
                      className="pl-9 bg-gray-950 border-gray-700 h-10 text-sm text-white"
                      placeholder="PO-001"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Placeholder body – same container width */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="invoice-container mx-auto w-full max-w-[1100px]">
          <p className="text-sm text-gray-500">
            Purchase top header test – Sale jesa design. Fields: Supplier (dropdown like Sale), Date, Ref #, Status (top bar), Branch (top bar). Invoice # removed from row; PO # in top bar only.
          </p>
          <p className="text-xs text-gray-600 mt-2">
            Container width matches Sale. After visual approval, apply this layout to the actual Purchase module.
          </p>
        </div>
      </div>
    </div>
  );
};
