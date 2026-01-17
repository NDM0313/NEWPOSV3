import React, { useState } from 'react';
import { 
  X, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Download, 
  Printer, 
  Search, 
  Calendar,
  Filter
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../ui/utils";

interface ContactLedgerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  contact: {
    id: number;
    name: string;
    type: string;
    balance: number;
  } | null;
}

// Mock Ledger Data
const mockTransactions = [
  { id: "INV-2024-001", date: "2024-01-28", type: "Sale", description: "Bridal Lehenga Rental", debit: 25000, credit: 0, balance: 25000 },
  { id: "PMT-2024-089", date: "2024-01-29", type: "Payment", description: "Advance Payment (Cash)", debit: 0, credit: 10000, balance: 15000 },
  { id: "INV-2024-005", date: "2024-02-01", type: "Sale", description: "Jewelry Set Purchase", debit: 5000, credit: 0, balance: 20000 },
  { id: "PMT-2024-092", date: "2024-02-02", type: "Payment", description: "Bank Transfer", debit: 0, credit: 5000, balance: 15000 },
  { id: "RET-2024-001", date: "2024-02-03", type: "Return", description: "Damaged Item Adjustment", debit: 0, credit: 2000, balance: 13000 },
];

export const ContactLedgerDrawer = ({ isOpen, onClose, contact }: ContactLedgerDrawerProps) => {
  if (!isOpen || !contact) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div 
        className="w-full max-w-5xl h-full shadow-2xl flex flex-col border-l animate-in slide-in-from-right duration-300"
        style={{
          backgroundColor: 'var(--color-bg-panel)',
          borderLeftColor: 'var(--color-border-primary)'
        }}
      >
        
        {/* Header */}
        <div 
          className="px-6 py-5 border-b flex items-center justify-between"
          style={{
            borderBottomColor: 'var(--color-border-primary)',
            backgroundColor: 'var(--color-bg-primary)'
          }}
        >
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 
                className="text-xl font-bold tracking-tight"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Ledger: {contact.name}
              </h2>
              <Badge 
                variant="outline"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  color: 'var(--color-text-secondary)',
                  borderColor: 'var(--color-border-secondary)'
                }}
              >
                {contact.type}
              </Badge>
            </div>
            <p 
              className="text-sm font-mono"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              ID: #{1000 + contact.id}
            </p>
          </div>

          <div className="flex items-center gap-4">
             {/* Balance Badge */}
             <div 
               className="px-4 py-2 border rounded-lg flex flex-col items-end"
               style={{
                 backgroundColor: 'rgba(153, 27, 27, 0.2)',
                 borderColor: 'rgba(153, 27, 27, 0.5)',
                 borderRadius: 'var(--radius-lg)'
               }}
             >
                <span 
                  className="text-[10px] font-medium uppercase tracking-wider"
                  style={{ color: 'var(--color-error)' }}
                >
                  Net Payable
                </span>
                <span 
                  className="text-xl font-bold"
                  style={{ color: 'var(--color-error)' }}
                >
                  ${contact.balance?.toLocaleString() || "15,000"}
                </span>
             </div>

             <div 
               className="h-8 w-px mx-2"
               style={{ backgroundColor: 'var(--color-border-primary)' }}
             ></div>

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
               <X className="h-5 w-5" />
             </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div 
          className="px-6 py-3 border-b flex justify-between items-center"
          style={{
            borderBottomColor: 'var(--color-border-primary)',
            backgroundColor: 'rgba(31, 41, 55, 0.5)' // bg-[#1F2937]/50
          }}
        >
           <div className="flex items-center gap-3 flex-1">
              <div className="relative w-64">
                <Search 
                  className="absolute left-3 top-1/2 -translate-y-1/2" 
                  size={14}
                  style={{ color: 'var(--color-text-tertiary)' }}
                />
                <Input 
                  placeholder="Search transactions..." 
                  className="pl-9 h-9"
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
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9"
                style={{
                  borderColor: 'var(--color-border-secondary)',
                  color: 'var(--color-text-secondary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                 <Calendar size={14} className="mr-2" /> Date Range
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9"
                style={{
                  borderColor: 'var(--color-border-secondary)',
                  color: 'var(--color-text-secondary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                 <Filter size={14} className="mr-2" /> Filter Type
              </Button>
           </div>
           
           <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                }}
              >
                 <Printer size={16} className="mr-2" /> Print
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9"
                style={{
                  borderColor: 'var(--color-border-secondary)',
                  color: 'var(--color-text-secondary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                 <Download size={16} className="mr-2" /> Export CSV
              </Button>
           </div>
        </div>

        {/* Ledger Table */}
        <ScrollArea 
          className="flex-1"
          style={{ backgroundColor: 'var(--color-bg-panel)' }}
        >
          <div className="min-w-full inline-block align-middle">
            <div 
              className="border-b"
              style={{ borderColor: 'var(--color-border-primary)' }}
            >
              <table className="min-w-full divide-y">
                <thead style={{ backgroundColor: 'var(--color-bg-primary)' }}>
                  <tr>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Date
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Description
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Ref #
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Debit (In)
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Credit (Out)
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody 
                  className="divide-y"
                  style={{
                    borderColor: 'var(--color-border-primary)',
                    backgroundColor: 'var(--color-bg-panel)'
                  }}
                >
                  {mockTransactions.map((tx, index) => (
                    <tr 
                      key={tx.id} 
                      className="transition-colors"
                      style={{
                        backgroundColor: index % 2 === 0 
                          ? 'var(--color-bg-panel)' 
                          : 'rgba(17, 24, 39, 0.3)' // bg-[#111827]/30 equivalent
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = index % 2 === 0 
                          ? 'var(--color-bg-panel)' 
                          : 'rgba(17, 24, 39, 0.3)';
                      }}
                    >
                      <td 
                        className="px-6 py-4 whitespace-nowrap text-sm font-mono"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {tx.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                           {tx.type === 'Sale' && (
                             <span 
                               className="w-1.5 h-1.5 rounded-full"
                               style={{ 
                                 backgroundColor: 'var(--color-primary)',
                                 borderRadius: 'var(--radius-full)'
                               }}
                             ></span>
                           )}
                           {tx.type === 'Payment' && (
                             <span 
                               className="w-1.5 h-1.5 rounded-full"
                               style={{ 
                                 backgroundColor: 'var(--color-success)',
                                 borderRadius: 'var(--radius-full)'
                               }}
                             ></span>
                           )}
                           {tx.type === 'Return' && (
                             <span 
                               className="w-1.5 h-1.5 rounded-full"
                               style={{ 
                                 backgroundColor: 'var(--color-warning)',
                                 borderRadius: 'var(--radius-full)'
                               }}
                             ></span>
                           )}
                           <span 
                             className="font-medium"
                             style={{ 
                               color: tx.type === 'Return' 
                                 ? 'var(--color-warning)' 
                                 : 'var(--color-text-primary)'
                             }}
                           >
                             {tx.description}
                           </span>
                        </div>
                      </td>
                      <td 
                        className="px-6 py-4 whitespace-nowrap text-sm hover:underline cursor-pointer"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        {tx.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono">
                        {tx.debit > 0 ? (
                           <span 
                             className="font-medium"
                             style={{ color: 'var(--color-text-primary)' }}
                           >
                             ${tx.debit.toLocaleString()}
                           </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono">
                        {tx.credit > 0 ? (
                           <span 
                             className="font-medium"
                             style={{ color: 'var(--color-success)' }}
                           >
                             (${tx.credit.toLocaleString()})
                           </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
                        )}
                      </td>
                      <td 
                        className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold font-mono"
                        style={{
                          color: 'var(--color-text-primary)',
                          backgroundColor: 'rgba(17, 24, 39, 0.2)'
                        }}
                      >
                        ${tx.balance.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  
                  {/* Total Row */}
                  <tr 
                    className="border-t-2"
                    style={{
                      backgroundColor: 'var(--color-bg-card)',
                      borderTopColor: 'var(--color-border-secondary)',
                      borderTopWidth: '2px'
                    }}
                  >
                    <td 
                      colSpan={3} 
                      className="px-6 py-4 text-right text-sm font-bold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                       Total
                    </td>
                    <td 
                      className="px-6 py-4 text-right text-sm font-bold font-mono"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                       $30,000
                    </td>
                    <td 
                      className="px-6 py-4 text-right text-sm font-bold font-mono"
                      style={{ color: 'var(--color-success)' }}
                    >
                       ($17,000)
                    </td>
                    <td 
                      className="px-6 py-4 text-right text-sm font-bold font-mono"
                      style={{
                        color: 'var(--color-error)',
                        backgroundColor: 'var(--color-bg-card)'
                      }}
                    >
                       $13,000
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
