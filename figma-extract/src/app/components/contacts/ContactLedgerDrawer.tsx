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
      <div className="w-full max-w-5xl bg-[#0B0F17] h-full shadow-2xl flex flex-col border-l border-gray-800 animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-800 bg-[#111827] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-bold text-white tracking-tight">Ledger: {contact.name}</h2>
              <Badge variant="outline" className="bg-gray-800 text-gray-400 border-gray-700">
                {contact.type}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 font-mono">ID: #{1000 + contact.id}</p>
          </div>

          <div className="flex items-center gap-4">
             {/* Balance Badge */}
             <div className="px-4 py-2 bg-red-900/20 border border-red-900/50 rounded-lg flex flex-col items-end">
                <span className="text-[10px] text-red-400 font-medium uppercase tracking-wider">Net Payable</span>
                <span className="text-xl font-bold text-red-500">${contact.balance?.toLocaleString() || "15,000"}</span>
             </div>

             <div className="h-8 w-px bg-gray-800 mx-2"></div>

             <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white hover:bg-gray-800">
               <X className="h-5 w-5" />
             </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-gray-800 bg-[#1F2937]/50 flex justify-between items-center">
           <div className="flex items-center gap-3 flex-1">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                <Input 
                  placeholder="Search transactions..." 
                  className="pl-9 h-9 bg-gray-900 border-gray-700 text-white focus:border-blue-500" 
                />
              </div>
              <Button variant="outline" size="sm" className="h-9 border-gray-700 text-gray-300 hover:bg-gray-800">
                 <Calendar size={14} className="mr-2" /> Date Range
              </Button>
              <Button variant="outline" size="sm" className="h-9 border-gray-700 text-gray-300 hover:bg-gray-800">
                 <Filter size={14} className="mr-2" /> Filter Type
              </Button>
           </div>
           
           <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-9 text-gray-400 hover:text-white">
                 <Printer size={16} className="mr-2" /> Print
              </Button>
              <Button variant="outline" size="sm" className="h-9 border-gray-700 text-gray-300 hover:bg-gray-800">
                 <Download size={16} className="mr-2" /> Export CSV
              </Button>
           </div>
        </div>

        {/* Ledger Table */}
        <ScrollArea className="flex-1 bg-[#0B0F17]">
          <div className="min-w-full inline-block align-middle">
            <div className="border-b border-gray-800">
              <table className="min-w-full divide-y divide-gray-800">
                <thead className="bg-[#111827]">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Description</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Ref #</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Debit (In)</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Credit (Out)</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 bg-[#0B0F17]">
                  {mockTransactions.map((tx, index) => (
                    <tr 
                      key={tx.id} 
                      className={cn(
                        "hover:bg-gray-800/30 transition-colors",
                        index % 2 === 0 ? "bg-[#0B0F17]" : "bg-[#111827]/30" // Alternate row colors
                      )}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">
                        {tx.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        <div className="flex items-center gap-2">
                           {tx.type === 'Sale' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>}
                           {tx.type === 'Payment' && <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>}
                           {tx.type === 'Return' && <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>}
                           <span className={cn(
                             "font-medium",
                             tx.type === 'Return' && "text-orange-400"
                           )}>
                             {tx.description}
                           </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-400 hover:underline cursor-pointer">
                        {tx.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300 font-mono">
                        {tx.debit > 0 ? (
                           <span className="text-white font-medium">${tx.debit.toLocaleString()}</span>
                        ) : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300 font-mono">
                        {tx.credit > 0 ? (
                           <span className="text-green-400 font-medium">(${tx.credit.toLocaleString()})</span>
                        ) : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-white font-mono bg-gray-900/20">
                        ${tx.balance.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  
                  {/* Total Row */}
                  <tr className="bg-[#1F2937] border-t-2 border-gray-700">
                    <td colSpan={3} className="px-6 py-4 text-right text-sm font-bold text-white">
                       Total
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-white font-mono">
                       $30,000
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-green-400 font-mono">
                       ($17,000)
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-red-500 font-mono bg-gray-800">
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
