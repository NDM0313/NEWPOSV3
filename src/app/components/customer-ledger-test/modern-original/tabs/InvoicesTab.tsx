import { useState } from 'react';
import { Search, Download, ChevronDown, ChevronRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { ModernItemsTable } from '../ModernItemsTable';
import type { Invoice } from '@/app/services/customerLedgerTypes';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useFormatDate } from '@/app/hooks/useFormatDate';

interface InvoicesTabProps {
  invoices: Invoice[];
}

export function InvoicesTab({ invoices }: InvoicesTabProps) {
  const { formatCurrency } = useFormatCurrency();
  const { formatDate } = useFormatDate();
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Fully Paid' | 'Partially Paid' | 'Unpaid'>('all');

  const safeInvoices = invoices || [];

  const toggleInvoice = (invoiceKey: string) => {
    const newExpanded = new Set(expandedInvoices);
    if (newExpanded.has(invoiceKey)) {
      newExpanded.delete(invoiceKey);
    } else {
      newExpanded.add(invoiceKey);
    }
    setExpandedInvoices(newExpanded);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'Fully Paid':
        return { icon: CheckCircle2, color: 'text-green-400 bg-green-500/10 border-green-500/20' };
      case 'Partially Paid':
        return { icon: Clock, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' };
      case 'Unpaid':
        return { icon: AlertCircle, color: 'text-red-400 bg-red-500/10 border-red-500/20' };
      default:
        return { icon: AlertCircle, color: 'text-gray-400 bg-gray-500/10 border-gray-500/20' };
    }
  };

  const filteredInvoices = safeInvoices.filter(inv => {
    const matchesSearch = inv.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: safeInvoices.reduce((sum, inv) => sum + inv.invoiceTotal, 0),
    paid: safeInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0),
    pending: safeInvoices.reduce((sum, inv) => sum + inv.pendingAmount, 0),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search invoice number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm focus:outline-none bg-gray-950 border border-gray-700 text-white placeholder:text-gray-500 focus:border-gray-600"
          />
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2.5 rounded-lg text-sm focus:outline-none bg-gray-950 border border-gray-700 text-white"
          >
            <option value="all">All Status</option>
            <option value="Fully Paid">Fully Paid</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Unpaid">Unpaid</option>
          </select>
          <button className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500 transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Invoice Amount</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{formatCurrency(stats.total)}</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Paid</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{formatCurrency(stats.paid)}</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Pending</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">{formatCurrency(stats.pending)}</p>
        </div>
      </div>

      <div className="text-sm text-gray-500">
        Showing <span className="text-white font-medium">{filteredInvoices.length}</span> of {safeInvoices.length} invoices
      </div>

      <div className="space-y-3">
        {filteredInvoices.map((invoice) => {
          const statusConfig = getStatusConfig(invoice.status);
          const StatusIcon = statusConfig.icon;
          const invoiceKey = invoice.id ?? invoice.invoiceNo;
          const isExpanded = expandedInvoices.has(invoiceKey);

          return (
            <div
              key={invoiceKey}
              className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden"
            >
              <div
                onClick={() => toggleInvoice(invoiceKey)}
                className="px-6 py-4 flex justify-between items-center cursor-pointer hover:bg-gray-800/30 transition-colors border-b border-gray-800/50"
              >
                <div className="flex items-center gap-4">
                  <div className="text-gray-500">
                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="text-base font-medium text-white mb-0.5">{invoice.invoiceNo}</div>
                    <div className="text-xs text-gray-500">
                      {formatDate(invoice.date)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-xs text-gray-500 mb-0.5">Invoice Total</div>
                    <div className="text-lg font-medium text-white">{formatCurrency(invoice.invoiceTotal)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 mb-0.5">Paid</div>
                    <div className="text-base text-green-400 font-medium">{formatCurrency(invoice.paidAmount)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 mb-0.5">Pending</div>
                    <div className="text-base text-yellow-400 font-medium">{formatCurrency(invoice.pendingAmount)}</div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border ${statusConfig.color}`}>
                    <StatusIcon className="w-4 h-4" />
                    {invoice.status}
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div className="bg-gray-950/50 border-t border-gray-800">
                  <ModernItemsTable items={invoice.items} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
