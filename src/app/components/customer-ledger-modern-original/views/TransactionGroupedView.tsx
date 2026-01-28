import { useState } from 'react';
import { ChevronDown, ChevronRight, MapPin, FileText, Calendar, CreditCard } from 'lucide-react';
import type { Transaction } from '../../../types';

interface TransactionGroupedViewProps {
  transactions: Transaction[];
  onTransactionClick: (transaction: Transaction) => void;
}

// Mock product detail data for demonstration
const getProductDetails = (transaction: Transaction) => {
  // In real app, this would come from backend
  if (transaction.documentType === 'Invoice') {
    return [
      {
        id: '1',
        name: 'Premium Cotton Fabric',
        description: 'High quality 100% cotton, 60" width',
        quantity: '25 M&Y',
        unitPrice: 450,
        discount: 22.5,
        tax: 85.5,
        priceIncTax: 513,
        subtotal: 12825
      },
      {
        id: '2',
        name: 'Silk Blend Material',
        description: 'Luxury silk-polyester blend, 45" width',
        quantity: '15 M&Y',
        unitPrice: 850,
        discount: 127.5,
        tax: 192.38,
        priceIncTax: 914.88,
        subtotal: 13723.2
      }
    ];
  } else if (transaction.documentType === 'Payment') {
    return [
      {
        id: '1',
        name: 'Cash Payment',
        description: 'Received via counter',
        quantity: '1',
        unitPrice: transaction.credit,
        discount: 0,
        tax: 0,
        priceIncTax: transaction.credit,
        subtotal: transaction.credit
      }
    ];
  }
  return [];
};

export function TransactionGroupedView({ transactions, onTransactionClick }: TransactionGroupedViewProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getPaymentStatus = (transaction: Transaction) => {
    if (transaction.documentType === 'Payment') {
      return { label: 'Paid', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.15)' };
    } else if (transaction.debit > 0) {
      return { label: 'Due', color: '#f97316', bgColor: 'rgba(249, 115, 22, 0.15)' };
    }
    return { label: 'Pending', color: '#6b7280', bgColor: 'rgba(107, 116, 128, 0.15)' };
  };

  return (
    <div className="space-y-3">
      {transactions.map((transaction, index) => {
        const isExpanded = expandedRows.has(transaction.id);
        const productDetails = getProductDetails(transaction);
        const status = getPaymentStatus(transaction);
        const hasDetails = productDetails.length > 0;

        return (
          <div 
            key={transaction.id}
            className="rounded-xl overflow-hidden"
            style={{ 
              background: '#1f2937',
              border: '1px solid #374151'
            }}
          >
            {/* Transaction Header Row (Master) */}
            <div 
              className="px-6 py-4 cursor-pointer hover:bg-opacity-90 transition-colors"
              style={{ 
                background: isExpanded ? '#1f2937' : '#1f2937',
                borderBottom: isExpanded ? '1px solid #374151' : 'none'
              }}
              onClick={() => hasDetails && toggleRow(transaction.id)}
            >
              <div className="flex items-center gap-6">
                {/* Expand/Collapse Icon */}
                <div className="flex items-center justify-center w-6">
                  {hasDetails && (
                    isExpanded ? 
                      <ChevronDown className="w-5 h-5" style={{ color: '#9ca3af' }} /> :
                      <ChevronRight className="w-5 h-5" style={{ color: '#9ca3af' }} />
                  )}
                </div>

                {/* Date */}
                <div className="w-36">
                  <div className="text-xs mb-1" style={{ color: '#9ca3af' }}>Date</div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" style={{ color: '#60a5fa' }} />
                    <span className="font-medium" style={{ color: '#ffffff' }}>
                      {new Date(transaction.date).toLocaleDateString('en-GB', { 
                        day: '2-digit', 
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>

                {/* Reference Number */}
                <div className="w-40">
                  <div className="text-xs mb-1" style={{ color: '#9ca3af' }}>Reference</div>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" style={{ color: '#60a5fa' }} />
                    <span className="font-medium font-mono" style={{ color: '#ffffff' }}>
                      {transaction.referenceNo}
                    </span>
                  </div>
                </div>

                {/* Type */}
                <div className="w-32">
                  <div className="text-xs mb-1" style={{ color: '#9ca3af' }}>Type</div>
                  <div 
                    className="inline-flex px-3 py-1 rounded-lg text-xs font-medium"
                    style={{ 
                      background: transaction.documentType === 'Invoice' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: transaction.documentType === 'Invoice' ? '#60a5fa' : '#10b981'
                    }}
                  >
                    {transaction.documentType}
                  </div>
                </div>

                {/* Location */}
                <div className="w-32">
                  <div className="text-xs mb-1" style={{ color: '#9ca3af' }}>Location</div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" style={{ color: '#9ca3af' }} />
                    <span className="text-sm" style={{ color: '#ffffff' }}>
                      {transaction.paymentAccount.split(' ')[0]}
                    </span>
                  </div>
                </div>

                {/* Payment Status */}
                <div className="w-28">
                  <div className="text-xs mb-1" style={{ color: '#9ca3af' }}>Status</div>
                  <div 
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ 
                      background: status.bgColor,
                      color: status.color
                    }}
                  >
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ background: status.color }}
                    />
                    {status.label}
                  </div>
                </div>

                {/* Debit Amount */}
                <div className="flex-1 text-right">
                  <div className="text-xs mb-1" style={{ color: '#9ca3af' }}>Debit Amount</div>
                  <div className="text-lg font-bold tabular-nums" style={{ 
                    color: transaction.debit > 0 ? '#f97316' : '#6b7280'
                  }}>
                    {transaction.debit > 0 ? `Rs ${transaction.debit.toLocaleString('en-PK')}` : '-'}
                  </div>
                </div>

                {/* Running Balance */}
                <div className="w-44 text-right">
                  <div className="text-xs mb-1" style={{ color: '#9ca3af' }}>Balance</div>
                  <div 
                    className="text-xl font-bold tabular-nums"
                    style={{ color: '#3b82f6' }}
                  >
                    Rs {transaction.runningBalance.toLocaleString('en-PK')}
                  </div>
                </div>
              </div>
            </div>

            {/* Nested Product Detail Table (Child) */}
            {isExpanded && hasDetails && (
              <div 
                className="px-6 py-4"
                style={{ background: '#111827' }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <div className="text-xs font-semibold" style={{ color: '#9ca3af' }}>PRODUCT BREAKDOWN</div>
                  <div className="flex-1 h-px" style={{ background: '#374151' }} />
                </div>

                {/* Product Table */}
                <div className="overflow-hidden rounded-lg" style={{ border: '1px solid #374151' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: '#1f2937', borderBottom: '1px solid #374151' }}>
                        <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: '#9ca3af' }}>
                          Product Name
                        </th>
                        <th className="text-center px-4 py-3 text-xs font-semibold" style={{ color: '#9ca3af' }}>
                          Quantity
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-semibold" style={{ color: '#9ca3af' }}>
                          Unit Price
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-semibold" style={{ color: '#9ca3af' }}>
                          Discount
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-semibold" style={{ color: '#9ca3af' }}>
                          Tax
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-semibold" style={{ color: '#9ca3af' }}>
                          Price inc. Tax
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-semibold" style={{ color: '#9ca3af' }}>
                          Subtotal
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {productDetails.map((product, idx) => (
                        <tr 
                          key={product.id}
                          className="transition-colors hover:bg-opacity-50"
                          style={{ 
                            background: idx % 2 === 0 ? '#1f2937' : '#111827',
                            borderBottom: idx < productDetails.length - 1 ? '1px solid #374151' : 'none'
                          }}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium" style={{ color: '#ffffff' }}>{product.name}</div>
                            <div className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{product.description}</div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-medium tabular-nums" style={{ color: '#ffffff' }}>
                              {product.quantity}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-medium tabular-nums" style={{ color: '#ffffff' }}>
                              Rs {product.unitPrice.toLocaleString('en-PK')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="tabular-nums" style={{ color: '#f97316' }}>
                              {product.discount > 0 ? `Rs ${product.discount.toLocaleString('en-PK')}` : '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="tabular-nums" style={{ color: '#10b981' }}>
                              Rs {product.tax.toLocaleString('en-PK')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-medium tabular-nums" style={{ color: '#60a5fa' }}>
                              Rs {product.priceIncTax.toLocaleString('en-PK')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold tabular-nums text-base" style={{ color: '#ffffff' }}>
                              Rs {product.subtotal.toLocaleString('en-PK')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {/* Total Row */}
                    <tfoot>
                      <tr style={{ background: '#1f2937', borderTop: '2px solid #374151' }}>
                        <td colSpan={6} className="px-4 py-3 text-right">
                          <span className="font-bold text-sm" style={{ color: '#9ca3af' }}>TOTAL:</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold tabular-nums text-lg" style={{ color: '#3b82f6' }}>
                            Rs {productDetails.reduce((sum, p) => sum + p.subtotal, 0).toLocaleString('en-PK')}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
