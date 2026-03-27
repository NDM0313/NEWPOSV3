import { useState, Fragment } from 'react';
import { Search, Download, CreditCard, ChevronDown, ChevronRight } from 'lucide-react';
import type { Transaction } from '@/app/services/customerLedgerTypes';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useFormatDate } from '@/app/hooks/useFormatDate';
import { Badge } from '@/app/components/ui/badge';

interface PaymentsTabProps {
  transactions: Transaction[];
  onTransactionClick: (transaction: Transaction) => void;
}

export function PaymentsTab({ transactions, onTransactionClick }: PaymentsTabProps) {
  const { formatCurrency } = useFormatCurrency();
  const { formatDate } = useFormatDate();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const payments = transactions.filter(
    t =>
      t.documentType === 'Payment' ||
      t.documentType === 'On-account Payment' ||
      t.documentType === 'Return Payment' ||
      t.documentType === 'Rental Payment'
  );

  const filteredPayments = payments.filter(p =>
    p.referenceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.paymentAccount.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const methodKeyFor = (p: Transaction) =>
    (p.paymentMethodKind || p.paymentAccount || '').toLowerCase();

  const paymentsByMethod = payments.reduce((acc, payment) => {
    const label = payment.paymentAccountDisplay || payment.paymentAccount;
    if (!acc[label]) {
      acc[label] = { count: 0, total: 0 };
    }
    acc[label].count += 1;
    acc[label].total += payment.credit;
    return acc;
  }, {} as Record<string, { count: number; total: number }>);

  const getPaymentIcon = (p: Transaction) => {
    const m = methodKeyFor(p);
    if (m.includes('cash')) return <CreditCard className="w-4 h-4 text-green-500" />;
    if (m.includes('bank')) return <CreditCard className="w-4 h-4 text-blue-500" />;
    if (m.includes('wallet') || m.includes('jazz')) return <CreditCard className="w-4 h-4 text-purple-400" />;
    return <CreditCard className="w-4 h-4 text-gray-500" />;
  };

  const getPaymentBadgeClass = (p: Transaction) => {
    const m = methodKeyFor(p);
    if (m.includes('cash')) return 'bg-green-500/10 text-green-400 border-green-500/20';
    if (m.includes('bank')) return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (m.includes('wallet')) return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search payments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm focus:outline-none bg-gray-950 border border-gray-700 text-white placeholder:text-gray-500 focus:border-gray-600"
          />
        </div>
        <button className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500 transition-colors flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export Payments
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {Object.entries(paymentsByMethod).map(([method, data]) => (
          <div
            key={method}
            className="bg-gray-900/50 border border-gray-800 rounded-xl p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold truncate max-w-[180px]" title={method}>
                  {method}
                </p>
                <p className="text-2xl font-bold text-white mt-1">{formatCurrency(data.total)}</p>
                <p className="text-xs text-gray-500 mt-1">{data.count} payments</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-4 h-4 text-green-500" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Showing <span className="text-white font-medium">{filteredPayments.length}</span> of {payments.length} payments</span>
        <span>Total Received: <span className="text-green-400 font-semibold">{formatCurrency(payments.reduce((sum, p) => sum + p.credit, 0))}</span></span>
      </div>

      <div className="overflow-x-auto border border-gray-800 rounded-xl bg-gray-900/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-950/95 border-b border-gray-800">
              <th className="px-2 py-3 w-10" aria-label="Expand" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reference</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment Method</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount Received</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.map((payment, index) => {
              const expandRows = payment.ledgerExpandRows?.length ? payment.ledgerExpandRows : null;
              const expanded = expandedIds.has(payment.id);
              return (
              <Fragment key={payment.id}>
              <tr
                className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer ${
                  index % 2 === 0 ? '' : 'bg-gray-900/30'
                }`}
                onClick={() => onTransactionClick(payment)}
              >
                <td className="px-2 py-4 w-10 text-gray-500" onClick={(e) => e.stopPropagation()}>
                  {expandRows ? (
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-gray-800"
                      onClick={() => toggleExpand(payment.id)}
                      aria-expanded={expanded}
                    >
                      {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  ) : null}
                </td>
                <td className="px-4 py-4 text-white whitespace-nowrap">
                  {formatDate(payment.date)}
                </td>
                <td className="px-4 py-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTransactionClick(payment);
                    }}
                    className="text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-2 flex-wrap"
                  >
                    {payment.referenceNo}
                    {payment.ledgerPaymentLifecycle === 'voided' ? (
                      <Badge className="bg-red-500/15 text-red-300 border-red-500/30 text-[10px]">Voided</Badge>
                    ) : null}
                  </button>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-col gap-0.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border w-fit ${getPaymentBadgeClass(payment)}`}>
                      {getPaymentIcon(payment)}
                      <span className="max-w-[200px] truncate" title={payment.paymentAccount}>
                        {payment.paymentAccountDisplay || payment.paymentAccount}
                      </span>
                    </span>
                    {payment.paymentMethodKind && payment.paymentAccountDisplay ? (
                      <span className="text-[10px] text-gray-500 capitalize">{payment.paymentMethodKind}</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-4 text-gray-400 max-w-xs truncate">{payment.description}</td>
                <td className="px-4 py-4 text-gray-500 text-xs max-w-32 truncate">{payment.notes || '-'}</td>
                <td className="px-4 py-4 text-right text-green-400 tabular-nums font-semibold">
                  {formatCurrency(payment.credit)}
                </td>
              </tr>
              {expanded && expandRows ? (
                <tr className="bg-gray-950/80 border-b border-gray-800">
                  <td colSpan={7} className="px-4 py-3 pl-12">
                    <p className="text-[10px] font-semibold uppercase text-slate-500 mb-2">Allocations</p>
                    <ul className="space-y-1 text-sm text-gray-300">
                      {expandRows.map((row, i) => (
                        <li key={i} className="flex justify-between gap-4">
                          <span>
                            {row.label}
                            {row.sublabel ? <span className="text-gray-500 text-xs block">{row.sublabel}</span> : null}
                          </span>
                          <span className="tabular-nums text-emerald-400">{formatCurrency(row.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ) : null}
              </Fragment>
            );})}
          </tbody>
        </table>
      </div>
    </div>
  );
}
