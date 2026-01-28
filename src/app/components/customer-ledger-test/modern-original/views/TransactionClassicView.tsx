import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { Transaction } from '@/app/services/customerLedgerTypes';

interface TransactionClassicViewProps {
  transactions: Transaction[];
  onTransactionClick: (transaction: Transaction) => void;
}

// Mock product detail data for sales
const getSaleProducts = (transaction: Transaction) => {
  if (transaction.documentType === 'Invoice') {
    return [
      {
        id: '1',
        name: 'Premium Cotton Fabric',
        quantity: 25,
        unit: 'M&Y',
        unitPrice: 450,
        discount: 22.5,
        tax: 85.5,
        lineTotal: 12825
      },
      {
        id: '2',
        name: 'Silk Blend Material',
        quantity: 15,
        unit: 'M&Y',
        unitPrice: 850,
        discount: 127.5,
        tax: 192.38,
        lineTotal: 13723.2
      }
    ];
  }
  return [];
};

// Separate component for transaction row group
function TransactionRowGroup({ 
  transaction, 
  index, 
  isExpanded, 
  onToggle 
}: { 
  transaction: Transaction; 
  index: number; 
  isExpanded: boolean; 
  onToggle: () => void;
}) {
  const isSale = transaction.documentType === 'Invoice';
  const products = isSale ? getSaleProducts(transaction) : [];
  const hasProducts = products.length > 0;

  const getDescription = (transaction: Transaction) => {
    if (transaction.documentType === 'Invoice') {
      return `Sale - ${transaction.referenceNo}`;
    } else if (transaction.documentType === 'Payment') {
      return `Payment Received - ${transaction.referenceNo}`;
    }
    return transaction.description || transaction.documentType;
  };

  return (
    <>
      {/* Main Transaction Row */}
      <tr
        className="cursor-pointer transition-colors"
        style={{
          background: index % 2 === 0 ? '#111827' : '#1f2937',
          borderBottom: '1px solid #374151'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#374151';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = index % 2 === 0 ? '#111827' : '#1f2937';
        }}
        onClick={() => hasProducts && onToggle()}
      >
        {/* Expand/Collapse Icon */}
        <td className="px-4 py-3" style={{ width: '40px' }}>
          {hasProducts && (
            <div style={{ color: '#9ca3af' }}>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </div>
          )}
        </td>

        {/* Date */}
        <td className="px-4 py-3" style={{ color: '#e5e7eb', fontSize: '13px' }}>
          {new Date(transaction.date).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          })}
        </td>

        {/* Reference No */}
        <td className="px-4 py-3" style={{ color: '#60a5fa', fontSize: '13px', fontWeight: '600' }}>
          {transaction.referenceNo}
        </td>

        {/* Description */}
        <td className="px-4 py-3">
          <div style={{ color: '#e5e7eb', fontSize: '13px', fontWeight: '500' }}>
            {getDescription(transaction)}
          </div>
          {transaction.description && (
            <div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '2px' }}>
              {transaction.description}
            </div>
          )}
        </td>

        {/* Payment Method / Location */}
        <td className="px-4 py-3" style={{ color: '#cbd5e1', fontSize: '13px' }}>
          {transaction.paymentAccount}
        </td>

        {/* Debit */}
        <td className="px-4 py-3 text-right tabular-nums" style={{ 
          color: transaction.debit > 0 ? '#f97316' : '#6b7280',
          fontSize: '13px',
          fontWeight: '600'
        }}>
          {transaction.debit > 0 ? transaction.debit.toLocaleString('en-PK') : '-'}
        </td>

        {/* Credit */}
        <td className="px-4 py-3 text-right tabular-nums" style={{ 
          color: transaction.credit > 0 ? '#10b981' : '#6b7280',
          fontSize: '13px',
          fontWeight: '600'
        }}>
          {transaction.credit > 0 ? transaction.credit.toLocaleString('en-PK') : '-'}
        </td>

        {/* Running Balance */}
        <td className="px-4 py-3 text-right tabular-nums" style={{ 
          color: '#3b82f6',
          fontSize: '14px',
          fontWeight: '700'
        }}>
          {transaction.runningBalance.toLocaleString('en-PK')}
        </td>
      </tr>

      {/* Expandable Product Details (Only for Sales) */}
      {isExpanded && hasProducts && (
        <tr style={{ 
          background: '#0f172a',
          borderBottom: '1px solid #374151'
        }}>
          <td colSpan={8} className="px-0 py-0">
            <div style={{ 
              padding: '12px 16px 12px 56px',
              borderTop: '1px solid #374151'
            }}>
              {/* Product Details Table */}
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#1e293b' }}>
                    <th 
                      className="px-3 py-2 text-left text-xs font-semibold"
                      style={{ color: '#9ca3af', width: '40px' }}
                    >
                      #
                    </th>
                    <th 
                      className="px-3 py-2 text-left text-xs font-semibold"
                      style={{ color: '#9ca3af' }}
                    >
                      PRODUCT NAME
                    </th>
                    <th 
                      className="px-3 py-2 text-center text-xs font-semibold"
                      style={{ color: '#9ca3af', width: '100px' }}
                    >
                      QUANTITY
                    </th>
                    <th 
                      className="px-3 py-2 text-right text-xs font-semibold"
                      style={{ color: '#9ca3af', width: '120px' }}
                    >
                      UNIT PRICE
                    </th>
                    <th 
                      className="px-3 py-2 text-right text-xs font-semibold"
                      style={{ color: '#9ca3af', width: '100px' }}
                    >
                      DISCOUNT
                    </th>
                    <th 
                      className="px-3 py-2 text-right text-xs font-semibold"
                      style={{ color: '#9ca3af', width: '100px' }}
                    >
                      TAX
                    </th>
                    <th 
                      className="px-3 py-2 text-right text-xs font-semibold"
                      style={{ color: '#9ca3af', width: '130px' }}
                    >
                      LINE TOTAL
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, idx) => (
                    <tr 
                      key={product.id}
                      style={{ 
                        background: idx % 2 === 0 ? '#0f172a' : '#1e293b',
                        borderBottom: idx < products.length - 1 ? '1px solid #374151' : 'none'
                      }}
                    >
                      {/* Row Number */}
                      <td className="px-3 py-2" style={{ color: '#6b7280', fontSize: '12px' }}>
                        {idx + 1}
                      </td>

                      {/* Product Name */}
                      <td className="px-3 py-2" style={{ color: '#e5e7eb', fontSize: '13px' }}>
                        {product.name}
                      </td>

                      {/* Quantity */}
                      <td className="px-3 py-2 text-center tabular-nums" style={{ 
                        color: '#cbd5e1',
                        fontSize: '13px',
                        fontWeight: '600'
                      }}>
                        {product.quantity} {product.unit}
                      </td>

                      {/* Unit Price */}
                      <td className="px-3 py-2 text-right tabular-nums" style={{ 
                        color: '#cbd5e1',
                        fontSize: '13px'
                      }}>
                        {product.unitPrice.toLocaleString('en-PK')}
                      </td>

                      {/* Discount */}
                      <td className="px-3 py-2 text-right tabular-nums" style={{ 
                        color: '#f97316',
                        fontSize: '13px'
                      }}>
                        {product.discount > 0 ? product.discount.toLocaleString('en-PK') : '-'}
                      </td>

                      {/* Tax */}
                      <td className="px-3 py-2 text-right tabular-nums" style={{ 
                        color: '#10b981',
                        fontSize: '13px'
                      }}>
                        {product.tax.toLocaleString('en-PK')}
                      </td>

                      {/* Line Total */}
                      <td className="px-3 py-2 text-right tabular-nums" style={{ 
                        color: '#60a5fa',
                        fontSize: '13px',
                        fontWeight: '700'
                      }}>
                        {product.lineTotal.toLocaleString('en-PK')}
                      </td>
                    </tr>
                  ))}
                  
                  {/* Total Row */}
                  <tr style={{ 
                    background: '#1e293b',
                    borderTop: '2px solid #4b5563'
                  }}>
                    <td colSpan={6} className="px-3 py-2 text-right text-xs font-semibold" style={{ 
                      color: '#9ca3af'
                    }}>
                      SALE TOTAL:
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ 
                      color: '#3b82f6',
                      fontSize: '14px',
                      fontWeight: '700'
                    }}>
                      {products.reduce((sum, p) => sum + p.lineTotal, 0).toLocaleString('en-PK')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function TransactionClassicView({ transactions, onTransactionClick }: TransactionClassicViewProps) {
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

  // Calculate totals for summary
  const totalDebit = transactions.reduce((sum, t) => sum + t.debit, 0);
  const totalCredit = transactions.reduce((sum, t) => sum + t.credit, 0);
  const closingBalance = transactions.length > 0 
    ? transactions[transactions.length - 1].runningBalance 
    : 0;

  return (
    <div 
      className="overflow-hidden"
      style={{ 
        border: '1px solid #374151',
        background: '#111827',
        borderRadius: '8px'
      }}
    >
      {/* Classic Ledger Table */}
      <table 
        className="w-full"
        style={{ 
          borderCollapse: 'collapse',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif'
        }}
      >
        {/* Table Header */}
        <thead>
          <tr style={{ 
            background: '#1f2937',
            borderBottom: '2px solid #374151'
          }}>
            <th 
              className="px-4 py-3 text-left text-xs font-semibold"
              style={{ color: '#9ca3af', width: '40px' }}
            >
              {/* Expand icon column */}
            </th>
            <th 
              className="px-4 py-3 text-left text-xs font-semibold"
              style={{ color: '#9ca3af', width: '110px' }}
            >
              DATE
            </th>
            <th 
              className="px-4 py-3 text-left text-xs font-semibold"
              style={{ color: '#9ca3af', width: '130px' }}
            >
              REFERENCE NO
            </th>
            <th 
              className="px-4 py-3 text-left text-xs font-semibold"
              style={{ color: '#9ca3af' }}
            >
              DESCRIPTION
            </th>
            <th 
              className="px-4 py-3 text-left text-xs font-semibold"
              style={{ color: '#9ca3af', width: '150px' }}
            >
              PAYMENT METHOD
            </th>
            <th 
              className="px-4 py-3 text-right text-xs font-semibold"
              style={{ color: '#9ca3af', width: '130px' }}
            >
              DEBIT
            </th>
            <th 
              className="px-4 py-3 text-right text-xs font-semibold"
              style={{ color: '#9ca3af', width: '130px' }}
            >
              CREDIT
            </th>
            <th 
              className="px-4 py-3 text-right text-xs font-semibold"
              style={{ color: '#9ca3af', width: '150px' }}
            >
              BALANCE
            </th>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody>
          {transactions.map((transaction, index) => (
            <TransactionRowGroup
              key={transaction.id}
              transaction={transaction}
              index={index}
              isExpanded={expandedRows.has(transaction.id)}
              onToggle={() => toggleRow(transaction.id)}
            />
          ))}
        </tbody>
      </table>

      {/* TOTAL SUMMARY SECTION */}
      <div 
        style={{ 
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          borderTop: '3px solid #4b5563',
          padding: '16px 24px'
        }}
      >
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: '1fr auto auto auto',
          gap: '24px',
          alignItems: 'center'
        }}>
          {/* Summary Label */}
          <div>
            <div style={{ 
              color: '#60a5fa',
              fontSize: '14px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Period Summary
            </div>
            <div style={{ 
              color: '#6b7280',
              fontSize: '11px',
              marginTop: '2px'
            }}>
              All Transactions Total
            </div>
          </div>

          {/* Total Debit */}
          <div style={{ textAlign: 'right', minWidth: '130px' }}>
            <div style={{ 
              color: '#9ca3af',
              fontSize: '10px',
              fontWeight: '600',
              textTransform: 'uppercase',
              marginBottom: '4px'
            }}>
              Total Debit
            </div>
            <div style={{ 
              color: '#f97316',
              fontSize: '16px',
              fontWeight: '700',
              fontFamily: 'monospace'
            }}>
              {totalDebit.toLocaleString('en-PK')}
            </div>
          </div>

          {/* Total Credit */}
          <div style={{ textAlign: 'right', minWidth: '130px' }}>
            <div style={{ 
              color: '#9ca3af',
              fontSize: '10px',
              fontWeight: '600',
              textTransform: 'uppercase',
              marginBottom: '4px'
            }}>
              Total Credit
            </div>
            <div style={{ 
              color: '#10b981',
              fontSize: '16px',
              fontWeight: '700',
              fontFamily: 'monospace'
            }}>
              {totalCredit.toLocaleString('en-PK')}
            </div>
          </div>

          {/* Closing Balance */}
          <div 
            style={{ 
              textAlign: 'right',
              minWidth: '150px',
              background: '#1e293b',
              padding: '12px 16px',
              borderRadius: '6px',
              border: '1px solid #3b82f6'
            }}
          >
            <div style={{ 
              color: '#60a5fa',
              fontSize: '10px',
              fontWeight: '600',
              textTransform: 'uppercase',
              marginBottom: '4px'
            }}>
              Closing Balance
            </div>
            <div style={{ 
              color: '#3b82f6',
              fontSize: '18px',
              fontWeight: '800',
              fontFamily: 'monospace'
            }}>
              {closingBalance.toLocaleString('en-PK')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}