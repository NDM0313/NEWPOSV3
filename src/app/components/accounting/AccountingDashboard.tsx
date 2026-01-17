import React, { useState } from 'react';
import { 
  Plus, 
  ArrowLeftRight, 
  Landmark, 
  Wallet, 
  CreditCard, 
  Paperclip,
  MoreVertical,
  Search,
  Filter,
  Download,
  Eye,
  Pencil,
  FileText,
  Snowflake,
  Trash
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { toast } from "sonner";
import { FundsTransferModal } from './FundsTransferModal';
import { AddAccountDrawer } from './AddAccountDrawer';

// Mock Data for Accounts
const accounts = [
  { id: 1, name: 'Meezan Bank Corp', type: 'Bank', balance: 1250000, color: 'from-green-900/80 to-green-950', border: 'border-green-800/50', icon: Landmark, number: 'PK65MEZN001234567890', provider: 'Visa', status: true, opening: 500000 },
  { id: 2, name: 'Shop Cash Drawer', type: 'Cash', balance: 45000, color: 'from-gray-800 to-gray-900', border: 'border-gray-700/50', icon: Wallet, number: 'Drawer #1', provider: null, status: true, opening: 10000 },
  { id: 3, name: 'JazzCash Wallet', type: 'Mobile Wallet', balance: 12500, color: 'from-red-900/80 to-red-950', border: 'border-red-800/50', icon: CreditCard, number: '0300-1234567', provider: 'Mastercard', status: true, opening: 5000 },
  { id: 4, name: 'HBL Operational', type: 'Bank', balance: 85000, color: 'from-teal-900/80 to-teal-950', border: 'border-teal-800/50', icon: Landmark, number: 'PK88HABB009876543210', provider: 'Visa', status: false, opening: 100000 },
];

// Mock Data for Transactions
const transactions = [
  { id: 1, date: 'Today, 10:23 AM', desc: 'Transfer to JazzCash', attach: true, type: 'debit', amount: 500.00, bal: 124500 },
  { id: 2, date: 'Yesterday, 4:15 PM', desc: 'Client Payment - Inv #102', attach: false, type: 'credit', amount: 12500.00, bal: 125000 },
  { id: 3, date: '26 Dec, 11:00 AM', desc: 'Utility Bill Payment', attach: true, type: 'debit', amount: 4500.00, bal: 112500 },
  { id: 4, date: '25 Dec, 09:30 AM', desc: 'Shop Cash Deposit', attach: true, type: 'credit', amount: 25000.00, bal: 117000 },
  { id: 5, date: '24 Dec, 02:45 PM', desc: 'Supplier Payment (Fabrics)', attach: false, type: 'debit', amount: 15000.00, bal: 92000 },
];

export const AccountingDashboard = () => {
  const [activeTab, setActiveTab] = useState<'transactions' | 'accounts'>('transactions');
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header Section */}
      <div 
        className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-4"
        style={{ borderColor: 'var(--color-border-primary)' }}
      >
        <div className="space-y-4 w-full md:w-auto">
          <div>
            <h2 
              className="text-3xl font-bold tracking-tight"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Accounting
            </h2>
            <p 
              className="mt-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Manage treasury, bank accounts, and funds.
            </p>
          </div>
          
          {/* Tabs */}
          <div className="flex items-center gap-6 mt-6">
            {(['transactions', 'accounts'] as const).map((tab) => {
              const isActive = activeTab === tab;
              const tabLabels: Record<typeof tab, string> = {
                transactions: 'Transactions',
                accounts: 'Accounts List'
              };
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="pb-2 text-sm font-medium transition-all relative"
                  style={{
                    color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--color-text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--color-text-secondary)';
                    }
                  }}
                >
                  {tabLabels[tab]}
                  {isActive && (
                    <span 
                      className="absolute bottom-0 left-0 w-full h-0.5 rounded-full"
                      style={{
                        backgroundColor: 'var(--color-primary)',
                        borderRadius: 'var(--radius-full)'
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
           {activeTab === 'accounts' && (
             <Button 
               onClick={() => setIsAddAccountOpen(true)}
               variant="outline"
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
               <Plus size={18} className="mr-2" /> Add Account
             </Button>
           )}
           <Button 
             onClick={() => setIsTransferOpen(true)}
             className="gap-2"
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
             <ArrowLeftRight size={18} />
             Fund Transfer
           </Button>
        </div>
      </div>

      {/* Content Area */}
      {activeTab === 'transactions' ? (
        <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
          {/* 1. Accounts Grid (Debit Cards) - Only visible in Transactions Tab */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {accounts.map((account) => {
              const getGradientColors = (colorClass: string) => {
                if (colorClass.includes('green')) {
                  return {
                    from: 'rgba(20, 83, 45, 0.8)',
                    to: 'rgba(5, 46, 22, 1)',
                    border: 'rgba(22, 101, 52, 0.5)'
                  };
                }
                if (colorClass.includes('gray')) {
                  return {
                    from: 'rgba(31, 41, 55, 1)',
                    to: 'rgba(17, 24, 39, 1)',
                    border: 'rgba(55, 65, 81, 0.5)'
                  };
                }
                if (colorClass.includes('red')) {
                  return {
                    from: 'rgba(153, 27, 27, 0.8)',
                    to: 'rgba(69, 10, 10, 1)',
                    border: 'rgba(185, 28, 28, 0.5)'
                  };
                }
                if (colorClass.includes('teal')) {
                  return {
                    from: 'rgba(19, 78, 74, 0.8)',
                    to: 'rgba(19, 78, 74, 1)',
                    border: 'rgba(20, 184, 166, 0.5)'
                  };
                }
                return {
                  from: 'rgba(31, 41, 55, 1)',
                  to: 'rgba(17, 24, 39, 1)',
                  border: 'rgba(55, 65, 81, 0.5)'
                };
              };
              
              const gradient = getGradientColors(account.color);
              
              return (
                <div 
                  key={account.id}
                  className="relative aspect-[1.586] rounded-xl p-5 flex flex-col justify-between shadow-2xl overflow-hidden group transition-all border"
                  style={{
                    background: `linear-gradient(to bottom right, ${gradient.from}, ${gradient.to})`,
                    borderColor: gradient.border,
                    borderRadius: 'var(--radius-xl)',
                    transform: 'scale(1)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {/* Glossy Overlay */}
                  <div 
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'linear-gradient(to top right, rgba(255, 255, 255, 0.05), transparent)',
                      opacity: 0.5
                    }}
                  />
                  <div 
                    className="absolute -right-12 -top-12 w-32 h-32 rounded-full blur-2xl pointer-events-none"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                  />

                  {/* Card Header */}
                  <div className="flex justify-between items-start relative z-10">
                     <div className="flex items-center gap-2">
                        <account.icon size={16} style={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                        <span 
                          className="text-[10px] uppercase tracking-wider font-bold"
                          style={{ color: 'rgba(255, 255, 255, 0.6)' }}
                        >
                          {account.type}
                        </span>
                     </div>
                     {account.provider && (
                       <span 
                         className="font-bold italic text-lg"
                         style={{ color: 'rgba(255, 255, 255, 0.4)' }}
                       >
                         {account.provider}
                       </span>
                     )}
                  </div>

                  {/* Middle: Chip & Number */}
                  <div className="relative z-10 pl-1">
                     <div 
                       className="w-8 h-6 rounded mb-3 flex items-center justify-center border"
                       style={{
                         backgroundColor: 'rgba(254, 240, 138, 0.2)',
                         borderColor: 'rgba(254, 240, 138, 0.4)',
                         borderRadius: 'var(--radius-sm)'
                       }}
                     >
                        <div 
                          className="w-4 h-3 border rounded-[2px]"
                          style={{ borderColor: 'rgba(254, 240, 138, 0.3)' }}
                        />
                     </div>
                     <p 
                       className="font-mono text-sm tracking-widest"
                       style={{ 
                         color: 'rgba(255, 255, 255, 0.8)',
                         textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
                       }}
                     >
                        {account.number.includes('****') ? account.number : `**** ${account.number.slice(-4)}`}
                     </p>
                  </div>

                  {/* Bottom: Name & Balance */}
                  <div className="relative z-10 flex justify-between items-end">
                     <div>
                        <p 
                          className="text-[9px] uppercase mb-0.5"
                          style={{ color: 'rgba(255, 255, 255, 0.5)' }}
                        >
                          Account Name
                        </p>
                        <h3 
                          className="text-xs font-bold tracking-wide truncate max-w-[120px]"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {account.name}
                        </h3>
                     </div>
                     <div className="text-right">
                        <h2 
                          className="text-xl font-bold tracking-tight"
                          style={{ 
                            color: 'var(--color-text-primary)',
                            textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
                          }}
                        >
                          ${account.balance.toLocaleString()}
                        </h2>
                     </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 2. Transaction History Table */}
          <div 
            className="border rounded-xl overflow-hidden"
            style={{
              backgroundColor: 'rgba(17, 24, 39, 0.5)',
              borderColor: 'var(--color-border-primary)',
              borderRadius: 'var(--radius-xl)'
            }}
          >
            {/* Table Header / Toolbar */}
            <div 
              className="p-5 border-b flex flex-col sm:flex-row justify-between items-center gap-4"
              style={{ borderColor: 'var(--color-border-primary)' }}
            >
               <h3 
                 className="text-lg font-bold flex items-center gap-2"
                 style={{ color: 'var(--color-text-primary)' }}
               >
                  Transaction History
                  <span 
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: 'var(--color-bg-card)',
                      color: 'var(--color-text-secondary)',
                      borderRadius: 'var(--radius-full)'
                    }}
                  >
                    Recent 5
                  </span>
               </h3>
               <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                     <Search 
                       size={14} 
                       className="absolute left-3 top-1/2 -translate-y-1/2"
                       style={{ color: 'var(--color-text-tertiary)' }}
                     />
                     <Input 
                       placeholder="Search transactions..." 
                       className="text-sm pl-9 h-9"
                       style={{
                         backgroundColor: 'var(--color-bg-tertiary)',
                         borderColor: 'var(--color-border-primary)',
                         color: 'var(--color-text-primary)'
                       }}
                     />
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-9 w-9"
                    style={{
                      borderColor: 'var(--color-border-primary)',
                      backgroundColor: 'var(--color-bg-tertiary)',
                      color: 'var(--color-text-secondary)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--color-text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--color-text-secondary)';
                    }}
                  >
                     <Filter size={14} />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-9 w-9"
                    style={{
                      borderColor: 'var(--color-border-primary)',
                      backgroundColor: 'var(--color-bg-tertiary)',
                      color: 'var(--color-text-secondary)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--color-text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--color-text-secondary)';
                    }}
                  >
                     <Download size={14} />
                  </Button>
               </div>
            </div>

            {/* The Table */}
            <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                  <thead 
                    className="text-xs uppercase border-b"
                    style={{
                      color: 'var(--color-text-tertiary)',
                      backgroundColor: 'rgba(3, 7, 18, 0.5)',
                      borderColor: 'var(--color-border-primary)'
                    }}
                  >
                     <tr>
                        <th className="px-6 py-3 font-medium">Date / Time</th>
                        <th className="px-6 py-3 font-medium">Description</th>
                        <th className="px-6 py-3 font-medium text-center">Attachment</th>
                        <th className="px-6 py-3 font-medium text-right">Amount</th>
                        <th className="px-6 py-3 font-medium text-right">Balance</th>
                        <th className="px-6 py-3 font-medium text-center">Action</th>
                     </tr>
                  </thead>
                  <tbody 
                    className="divide-y"
                    style={{ borderColor: 'var(--color-border-primary)' }}
                  >
                     {transactions.map((tx) => (
                        <tr 
                          key={tx.id} 
                          className="group transition-colors"
                          style={{ backgroundColor: 'transparent' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                           <td 
                             className="px-6 py-4 font-medium"
                             style={{ color: 'var(--color-text-primary)' }}
                           >
                              {tx.date}
                           </td>
                           <td className="px-6 py-4">
                              <span 
                                className="font-medium block"
                                style={{ color: 'var(--color-text-primary)' }}
                              >
                                {tx.desc}
                              </span>
                              <span 
                                className="text-xs"
                                style={{ color: 'var(--color-text-tertiary)' }}
                              >
                                {tx.type === 'debit' ? 'Outgoing' : 'Incoming'} Transfer
                              </span>
                           </td>
                           <td className="px-6 py-4 text-center">
                              {tx.attach ? (
                                 <button 
                                   className="inline-flex items-center justify-center h-8 w-8 rounded-full transition-colors"
                                   style={{
                                     backgroundColor: 'rgba(30, 58, 138, 0.2)',
                                     color: 'var(--color-primary)',
                                     borderRadius: 'var(--radius-full)'
                                   }}
                                   onMouseEnter={(e) => {
                                     e.currentTarget.style.backgroundColor = 'rgba(30, 58, 138, 0.4)';
                                   }}
                                   onMouseLeave={(e) => {
                                     e.currentTarget.style.backgroundColor = 'rgba(30, 58, 138, 0.2)';
                                   }}
                                 >
                                    <Paperclip size={14} />
                                 </button>
                              ) : (
                                 <span style={{ color: 'var(--color-text-disabled)' }}>-</span>
                              )}
                           </td>
                           <td 
                             className="px-6 py-4 text-right font-bold"
                             style={{
                               color: tx.type === 'credit' ? 'var(--color-success)' : 'var(--color-error)'
                             }}
                           >
                              {tx.type === 'credit' ? '+' : '-'}${tx.amount.toLocaleString()}
                           </td>
                           <td 
                             className="px-6 py-4 text-right font-mono"
                             style={{ color: 'var(--color-text-secondary)' }}
                           >
                              ${tx.bal.toLocaleString()}
                           </td>
                           <td className="px-6 py-4 text-center">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ color: 'var(--color-text-tertiary)' }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = 'var(--color-text-primary)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = 'var(--color-text-tertiary)';
                                }}
                              >
                                 <MoreVertical size={14} />
                              </Button>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
            
            {/* Pagination Footer */}
            <div 
              className="p-4 border-t flex justify-center"
              style={{
                borderColor: 'var(--color-border-primary)',
                backgroundColor: 'rgba(3, 7, 18, 0.3)'
              }}
            >
               <Button 
                 variant="link" 
                 className="text-xs"
                 style={{ color: 'var(--color-primary)' }}
               >
                 View All Transactions
               </Button>
            </div>
          </div>
        </div>
      ) : (
        /* Accounts List View */
        <div 
          className="border rounded-xl overflow-hidden animate-in slide-in-from-bottom-2 duration-300"
          style={{
            backgroundColor: 'rgba(17, 24, 39, 0.5)',
            borderColor: 'var(--color-border-primary)',
            borderRadius: 'var(--radius-xl)'
          }}
        >
          <div className="overflow-x-auto">
             <table className="w-full text-sm text-left">
                <thead 
                  className="text-xs uppercase border-b"
                  style={{
                    color: 'var(--color-text-tertiary)',
                    backgroundColor: 'rgba(3, 7, 18, 0.5)',
                    borderColor: 'var(--color-border-primary)'
                  }}
                >
                   <tr>
                      <th className="px-6 py-3 font-medium">Account Name</th>
                      <th className="px-6 py-3 font-medium">Type</th>
                      <th className="px-6 py-3 font-medium">Account Number</th>
                      <th className="px-6 py-3 font-medium text-right">Opening Balance</th>
                      <th className="px-6 py-3 font-medium text-right">Current Balance</th>
                      <th className="px-6 py-3 font-medium text-center">Status</th>
                      <th className="px-6 py-3 font-medium text-center">Actions</th>
                   </tr>
                </thead>
                <tbody 
                  className="divide-y"
                  style={{ borderColor: 'var(--color-border-primary)' }}
                >
                   {accounts.map((acc) => {
                     const getTypeColor = (type: string) => {
                       if (type === 'Bank') return 'var(--color-primary)';
                       if (type === 'Cash') return 'var(--color-success)';
                       if (type === 'Mobile Wallet') return 'var(--color-wholesale)';
                       return 'var(--color-text-secondary)';
                     };
                     
                     return (
                       <tr 
                         key={acc.id} 
                         className="group transition-colors"
                         style={{ backgroundColor: 'transparent' }}
                         onMouseEnter={(e) => {
                           e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.3)';
                         }}
                         onMouseLeave={(e) => {
                           e.currentTarget.style.backgroundColor = 'transparent';
                         }}
                       >
                          <td 
                            className="px-6 py-4 font-bold"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                             {acc.name}
                          </td>
                          <td className="px-6 py-4">
                             <Badge 
                               variant="outline" 
                               className="flex w-fit items-center gap-1.5"
                               style={{
                                 backgroundColor: 'var(--color-bg-card)',
                                 color: 'var(--color-text-secondary)',
                                 borderColor: 'var(--color-border-secondary)'
                               }}
                             >
                                <acc.icon size={12} style={{ color: getTypeColor(acc.type) }} />
                                {acc.type}
                             </Badge>
                          </td>
                          <td 
                            className="px-6 py-4 font-mono text-xs"
                            style={{ color: 'var(--color-text-tertiary)' }}
                          >
                             {acc.number}
                          </td>
                          <td 
                            className="px-6 py-4 text-right"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                             ${acc.opening?.toLocaleString() || '0'}
                          </td>
                          <td 
                            className="px-6 py-4 text-right font-bold text-base"
                            style={{ color: 'var(--color-success)' }}
                          >
                             Rs {acc.balance.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-center">
                              <div className="flex justify-center">
                                 <Switch checked={acc.status} />
                              </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                             <DropdownMenu>
                               <DropdownMenuTrigger asChild>
                                 <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   className="h-8 w-8"
                                   style={{ color: 'var(--color-text-tertiary)' }}
                                   onMouseEnter={(e) => {
                                     e.currentTarget.style.color = 'var(--color-text-primary)';
                                     e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                                   }}
                                   onMouseLeave={(e) => {
                                     e.currentTarget.style.color = 'var(--color-text-tertiary)';
                                     e.currentTarget.style.backgroundColor = 'transparent';
                                   }}
                                 >
                                   <MoreVertical size={16} />
                                 </Button>
                               </DropdownMenuTrigger>
                               <DropdownMenuContent 
                                 align="end" 
                                 className="w-[160px]"
                                 style={{
                                   backgroundColor: 'var(--color-bg-card)',
                                   borderColor: 'var(--color-border-secondary)',
                                   color: 'var(--color-text-primary)'
                                 }}
                               >
                                 <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                 <DropdownMenuSeparator style={{ backgroundColor: 'var(--color-border-primary)' }} />
                                 <DropdownMenuItem 
                                   className="cursor-pointer"
                                   style={{ backgroundColor: 'transparent' }}
                                   onMouseEnter={(e) => {
                                     e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                                   }}
                                   onMouseLeave={(e) => {
                                     e.currentTarget.style.backgroundColor = 'transparent';
                                   }}
                                 >
                                   <Pencil className="mr-2 h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                                   <span>Edit</span>
                                 </DropdownMenuItem>
                                 <DropdownMenuItem 
                                   className="cursor-pointer"
                                   style={{ backgroundColor: 'transparent' }}
                                   onMouseEnter={(e) => {
                                     e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                                   }}
                                   onMouseLeave={(e) => {
                                     e.currentTarget.style.backgroundColor = 'transparent';
                                   }}
                                   onClick={() => setActiveTab('transactions')}
                                 >
                                   <FileText className="mr-2 h-4 w-4" style={{ color: 'var(--color-success)' }} />
                                   <span>Statement</span>
                                 </DropdownMenuItem>
                                 <DropdownMenuItem 
                                   className="cursor-pointer"
                                   style={{ backgroundColor: 'transparent' }}
                                   onMouseEnter={(e) => {
                                     e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                                   }}
                                   onMouseLeave={(e) => {
                                     e.currentTarget.style.backgroundColor = 'transparent';
                                   }}
                                 >
                                   <Snowflake className="mr-2 h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
                                   <span>{acc.status ? 'Freeze' : 'Unfreeze'}</span>
                                 </DropdownMenuItem>
                                 <DropdownMenuSeparator style={{ backgroundColor: 'var(--color-border-primary)' }} />
                                 <DropdownMenuItem 
                                   className="cursor-pointer"
                                   style={{ 
                                     backgroundColor: 'transparent',
                                     color: 'var(--color-error)'
                                   }}
                                   onMouseEnter={(e) => {
                                     e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                                   }}
                                   onMouseLeave={(e) => {
                                     e.currentTarget.style.backgroundColor = 'transparent';
                                   }}
                                   onClick={() => toast.error("Delete action triggered")}
                                 >
                                   <Trash className="mr-2 h-4 w-4" />
                                   <span>Delete</span>
                                 </DropdownMenuItem>
                               </DropdownMenuContent>
                             </DropdownMenu>
                          </td>
                       </tr>
                     );
                   })}
                </tbody>
             </table>
          </div>
        </div>
      )}

      {/* Modals & Drawers */}
      <FundsTransferModal isOpen={isTransferOpen} onClose={() => setIsTransferOpen(false)} />
      <AddAccountDrawer isOpen={isAddAccountOpen} onClose={() => setIsAddAccountOpen(false)} />

    </div>
  );
};
