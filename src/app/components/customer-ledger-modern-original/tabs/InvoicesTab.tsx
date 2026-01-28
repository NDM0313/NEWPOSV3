import { useState } from 'react';
import { Search, Download, ChevronDown, ChevronRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { ModernItemsTable } from '../ModernItemsTable';
import type { Invoice } from '../../../types/index';

interface InvoicesTabProps {
  invoices: Invoice[];
}

export function InvoicesTab({ invoices }: InvoicesTabProps) {
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Fully Paid' | 'Partially Paid' | 'Unpaid'>('all');

  // Safety check for invoices array
  const safeInvoices = invoices || [];

  const toggleInvoice = (invoiceNo: string) => {
    const newExpanded = new Set(expandedInvoices);
    if (newExpanded.has(invoiceNo)) {
      newExpanded.delete(invoiceNo);
    } else {
      newExpanded.add(invoiceNo);
    }
    setExpandedInvoices(newExpanded);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'Fully Paid':
        return { icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50' };
      case 'Partially Paid':
        return { icon: Clock, color: 'text-amber-700 bg-amber-50' };
      case 'Unpaid':
        return { icon: AlertCircle, color: 'text-red-700 bg-red-50' };
      default:
        return { icon: AlertCircle, color: 'text-slate-700 bg-slate-50' };
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
      {/* Search and Filter Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search invoice number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            style={{ 
              background: 'rgba(30, 41, 59, 0.3)',
              border: '1px solid rgba(100, 116, 139, 0.3)',
              color: '#e2e8f0'
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ 
              background: 'rgba(30, 41, 59, 0.3)',
              border: '1px solid rgba(100, 116, 139, 0.3)',
              color: '#e2e8f0'
            }}
          >
            <option value="all">All Status</option>
            <option value="Fully Paid">Fully Paid</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Unpaid">Unpaid</option>
          </select>

          <button className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div 
          className="rounded-xl p-4"
          style={{ 
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%)'
          }}
        >
          <div className="text-xs mb-1" style={{ color: '#60a5fa' }}>Total Invoice Amount</div>
          <div className="text-2xl" style={{ color: '#3b82f6' }}>Rs {stats.total.toLocaleString('en-PK')}</div>
        </div>
        <div 
          className="rounded-xl p-4"
          style={{ 
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.1) 100%)'
          }}
        >
          <div className="text-xs mb-1" style={{ color: '#34d399' }}>Total Paid</div>
          <div className="text-2xl" style={{ color: '#10b981' }}>Rs {stats.paid.toLocaleString('en-PK')}</div>
        </div>
        <div 
          className="rounded-xl p-4"
          style={{ 
            background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(234, 88, 12, 0.1) 100%)'
          }}
        >
          <div className="text-xs mb-1" style={{ color: '#fb923c' }}>Total Pending</div>
          <div className="text-2xl" style={{ color: '#f97316' }}>Rs {stats.pending.toLocaleString('en-PK')}</div>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm" style={{ color: '#94a3b8' }}>
        Showing <span style={{ color: '#e2e8f0' }}>{filteredInvoices.length}</span> of {safeInvoices.length} invoices
      </div>

      {/* Invoices List */}
      <div className="space-y-3">
        {filteredInvoices.map((invoice) => {
          const statusConfig = getStatusConfig(invoice.status);
          const StatusIcon = statusConfig.icon;
          const isExpanded = expandedInvoices.has(invoice.invoiceNo);

          return (
            <div 
              key={invoice.invoiceNo} 
              className="rounded-xl overflow-hidden transition-colors"
              style={{ 
                border: '1px solid rgba(100, 116, 139, 0.3)',
                background: '#273548'
              }}
            >
              {/* Invoice Header */}
              <div
                onClick={() => toggleInvoice(invoice.invoiceNo)}
                className="px-6 py-4 flex justify-between items-center cursor-pointer transition-colors"
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div className="flex items-center gap-4">
                  <div style={{ color: '#64748b' }}>
                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="text-base mb-1" style={{ color: '#e2e8f0' }}>{invoice.invoiceNo}</div>
                    <div className="text-xs" style={{ color: '#64748b' }}>
                      {new Date(invoice.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-xs mb-1" style={{ color: '#94a3b8' }}>Invoice Total</div>
                    <div className="text-lg" style={{ color: '#e2e8f0' }}>Rs {invoice.invoiceTotal.toLocaleString('en-PK')}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs mb-1" style={{ color: '#94a3b8' }}>Paid</div>
                    <div className="text-base text-emerald-500">Rs {invoice.paidAmount.toLocaleString('en-PK')}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs mb-1" style={{ color: '#94a3b8' }}>Pending</div>
                    <div className="text-base text-orange-500">Rs {invoice.pendingAmount.toLocaleString('en-PK')}</div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${statusConfig.color}`}>
                    <StatusIcon className="w-4 h-4" />
                    {invoice.status}
                  </span>
                </div>
              </div>

              {/* Invoice Items Table */}
              {isExpanded && (
                <div 
                  style={{ 
                    background: 'rgba(30, 41, 59, 0.5)',
                    borderTop: '1px solid rgba(100, 116, 139, 0.2)'
                  }}
                >
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