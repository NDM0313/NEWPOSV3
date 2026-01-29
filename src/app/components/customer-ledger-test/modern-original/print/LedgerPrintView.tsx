import { useEffect, useState } from 'react';
import type { Transaction } from '@/app/services/customerLedgerTypes';
import React from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import './ledger-print-view-print.css';

interface LedgerPrintViewProps {
  transactions: Transaction[];
  saleItemsMap?: Map<string, any[]>;
  accountName: string;
  dateRange: { from: string; to: string };
  openingBalance: number;
  orientation: 'portrait' | 'landscape';
  onClose: () => void;
}

// Sale product breakdown from backend only – no mock
function getSaleProductsFromBackend(transaction: Transaction, saleItemsMap: Map<string, any[]>): any[] {
  if (transaction.documentType !== 'Sale' || !transaction.id) return [];
  return saleItemsMap.get(transaction.id) || [];
}

export function LedgerPrintView({ 
  transactions, 
  saleItemsMap = new Map(),
  accountName, 
  dateRange, 
  openingBalance,
  orientation: initialOrientation,
  onClose 
}: LedgerPrintViewProps) {
  
  const { enablePacking } = useSupabase();
  const [orientation, setOrientation] = React.useState<'portrait' | 'landscape'>(initialOrientation);
  
  // Period totals (exclude Opening Balance row for summary)
  const periodTransactions = transactions.filter(t => t.documentType !== 'Opening Balance');
  const totalDebit = periodTransactions.reduce((sum, t) => sum + t.debit, 0);
  const totalCredit = periodTransactions.reduce((sum, t) => sum + t.credit, 0);
  const closingBalance = openingBalance + totalDebit - totalCredit;

  useEffect(() => {
    // Set print styles
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        @page {
          size: ${orientation === 'landscape' ? 'landscape' : 'portrait'};
          margin: 15mm;
        }
        
        body * {
          visibility: hidden;
        }
        
        #ledger-print-content,
        #ledger-print-content * {
          visibility: visible;
        }
        
        #ledger-print-content {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
        
        .no-print {
          display: none !important;
        }
        
        .page-break {
          page-break-after: always;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, [orientation]);

  const handlePrint = () => {
    window.print();
  };

  const handleClose = () => {
    onClose();
  };

  const getDescription = (transaction: Transaction) => {
    if (transaction.documentType === 'Opening Balance') {
      return 'Opening Balance';
    }
    if (transaction.documentType === 'Sale') {
      return `Sale - ${transaction.referenceNo}`;
    }
    if (transaction.documentType === 'Payment') {
      return 'Payment Received';
    }
    return transaction.description || transaction.documentType;
  };

  return (
    <>
      {/* Overlay backdrop */}
      <div 
        className="fixed inset-0 z-50 no-print"
        style={{ 
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)'
        }}
        onClick={handleClose}
      />

      {/* Print preview modal */}
      <div 
        className="fixed inset-0 z-50 overflow-auto no-print"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}
      >
        <div 
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            maxWidth: orientation === 'landscape' ? '1100px' : '800px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Control buttons */}
          <div 
            className="no-print"
            style={{
              padding: '16px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc'
            }}
          >
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
                Print Preview - {orientation === 'landscape' ? 'Landscape' : 'Portrait'}
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                Review before printing or saving as PDF
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {/* Orientation Selector */}
              <div style={{ display: 'flex', gap: '6px', background: '#e2e8f0', padding: '4px', borderRadius: '8px' }}>
                <button
                  onClick={() => setOrientation('portrait')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    background: orientation === 'portrait' ? '#3b82f6' : 'transparent',
                    color: orientation === 'portrait' ? '#ffffff' : '#64748b',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  📄 Portrait
                </button>
                <button
                  onClick={() => setOrientation('landscape')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    background: orientation === 'landscape' ? '#3b82f6' : 'transparent',
                    color: orientation === 'landscape' ? '#ffffff' : '#64748b',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  📃 Landscape
                </button>
              </div>

              <button
                onClick={handlePrint}
                style={{
                  padding: '10px 20px',
                  background: '#3b82f6',
                  color: '#ffffff',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 6 2 18 2 18 9"></polyline>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                  <rect x="6" y="14" width="12" height="8"></rect>
                </svg>
                Print / Save as PDF
              </button>
              <button
                onClick={handleClose}
                style={{
                  padding: '10px 20px',
                  background: '#e2e8f0',
                  color: '#475569',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>

          {/* Printable content */}
          <div 
            id="ledger-print-content"
            style={{
              padding: '40px',
              background: '#ffffff',
              color: '#000000',
              fontFamily: 'Arial, sans-serif'
            }}
          >
            {/* Header */}
            <div style={{ marginBottom: '30px', borderBottom: '3px solid #000000', paddingBottom: '20px' }}>
              <h1 style={{ 
                fontSize: '24px', 
                fontWeight: '700', 
                margin: '0 0 8px 0',
                color: '#000000'
              }}>
                CUSTOMER LEDGER
              </h1>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '12px',
                marginTop: '16px'
              }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#666666', margin: '0 0 4px 0', fontWeight: '600' }}>
                    ACCOUNT NAME:
                  </p>
                  <p style={{ fontSize: '16px', fontWeight: '700', margin: '0', color: '#000000' }}>
                    {accountName}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '12px', color: '#666666', margin: '0 0 4px 0', fontWeight: '600' }}>
                    PERIOD:
                  </p>
                  <p style={{ fontSize: '14px', fontWeight: '600', margin: '0', color: '#000000' }}>
                    {new Date(dateRange.from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} 
                    {' to '}
                    {new Date(dateRange.to).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>

            {/* Ledger Table (first row = Opening Balance when transactions include it) */}
            <table 
              style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                fontSize: '11px',
                marginBottom: '20px'
              }}
            >
              <thead>
                <tr style={{ background: '#000000', color: '#ffffff' }}>
                  <th style={{ 
                    padding: '10px 8px', 
                    textAlign: 'left',
                    fontWeight: '700',
                    fontSize: '10px',
                    width: '80px'
                  }}>
                    DATE
                  </th>
                  <th style={{ 
                    padding: '10px 8px', 
                    textAlign: 'left',
                    fontWeight: '700',
                    fontSize: '10px',
                    width: '100px'
                  }}>
                    REF NO
                  </th>
                  <th style={{ 
                    padding: '10px 8px', 
                    textAlign: 'left',
                    fontWeight: '700',
                    fontSize: '10px'
                  }}>
                    DESCRIPTION
                  </th>
                  <th style={{ 
                    padding: '10px 8px', 
                    textAlign: 'left',
                    fontWeight: '700',
                    fontSize: '10px',
                    width: orientation === 'landscape' ? '120px' : '80px'
                  }}>
                    PAYMENT METHOD
                  </th>
                  <th style={{ 
                    padding: '10px 8px', 
                    textAlign: 'right',
                    fontWeight: '700',
                    fontSize: '10px',
                    width: '90px'
                  }}>
                    DEBIT
                  </th>
                  <th style={{ 
                    padding: '10px 8px', 
                    textAlign: 'right',
                    fontWeight: '700',
                    fontSize: '10px',
                    width: '90px'
                  }}>
                    CREDIT
                  </th>
                  <th style={{ 
                    padding: '10px 8px', 
                    textAlign: 'right',
                    fontWeight: '700',
                    fontSize: '10px',
                    width: '100px'
                  }}>
                    BALANCE
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction, index) => {
                  const isSale = transaction.documentType === 'Sale';
                  const products = isSale ? getSaleProductsFromBackend(transaction, saleItemsMap) : [];
                  
                  return (
                    <React.Fragment key={transaction.id}>
                      {/* Main transaction row */}
                      <tr 
                        style={{ 
                          borderBottom: '1px solid #dee2e6',
                          background: index % 2 === 0 ? '#ffffff' : '#f8f9fa'
                        }}
                      >
                        <td style={{ padding: '8px', color: '#000000' }}>
                          {new Date(transaction.date).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td style={{ padding: '8px', fontWeight: '600', color: '#000000' }}>
                          {transaction.referenceNo}
                        </td>
                        <td style={{ padding: '8px', color: '#000000' }}>
                          <div style={{ fontWeight: '600' }}>{getDescription(transaction)}</div>
                          {transaction.description && (
                            <div style={{ fontSize: '10px', color: '#666666', marginTop: '2px' }}>
                              {transaction.description}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '8px', color: '#000000', fontSize: '10px' }}>
                          {transaction.paymentAccount}
                        </td>
                        <td style={{ 
                          padding: '8px', 
                          textAlign: 'right',
                          fontWeight: '600',
                          fontFamily: 'monospace',
                          color: transaction.debit > 0 ? '#000000' : '#999999'
                        }}>
                          {transaction.debit > 0 ? transaction.debit.toLocaleString('en-PK') : '-'}
                        </td>
                        <td style={{ 
                          padding: '8px', 
                          textAlign: 'right',
                          fontWeight: '600',
                          fontFamily: 'monospace',
                          color: transaction.credit > 0 ? '#000000' : '#999999'
                        }}>
                          {transaction.credit > 0 ? transaction.credit.toLocaleString('en-PK') : '-'}
                        </td>
                        <td style={{ 
                          padding: '8px', 
                          textAlign: 'right',
                          fontWeight: '700',
                          fontFamily: 'monospace',
                          color: '#000000'
                        }}>
                          {transaction.runningBalance.toLocaleString('en-PK')}
                        </td>
                      </tr>
                      
                      {/* Product breakdown – 1:1 with sale_items: Variation, Packing, Qty, Unit separate */}
                      {products.length > 0 && (
                        <tr style={{ background: '#f1f5f9' }}>
                          <td colSpan={7} style={{ padding: '8px 8px 8px 24px' }}>
                            <table style={{ width: '100%', fontSize: '10px' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                                  <th style={{ padding: '4px', textAlign: 'left', fontSize: '9px', color: '#64748b', fontWeight: '600' }}>#</th>
                                  <th style={{ padding: '4px', textAlign: 'left', fontSize: '9px', color: '#64748b', fontWeight: '600' }}>PRODUCT NAME</th>
                                  <th style={{ padding: '4px', textAlign: 'left', fontSize: '9px', color: '#64748b', fontWeight: '600' }}>VARIATION</th>
                                  {enablePacking && <th style={{ padding: '4px', textAlign: 'left', fontSize: '9px', color: '#64748b', fontWeight: '600' }}>PACKING</th>}
                                  <th style={{ padding: '4px', textAlign: 'right', fontSize: '9px', color: '#64748b', fontWeight: '600' }}>QTY</th>
                                  <th style={{ padding: '4px', textAlign: 'left', fontSize: '9px', color: '#64748b', fontWeight: '600' }}>UNIT</th>
                                  <th style={{ padding: '4px', textAlign: 'right', fontSize: '9px', color: '#64748b', fontWeight: '600' }}>UNIT PRICE</th>
                                  <th style={{ padding: '4px', textAlign: 'right', fontSize: '9px', color: '#64748b', fontWeight: '600' }}>DISCOUNT</th>
                                  <th style={{ padding: '4px', textAlign: 'right', fontSize: '9px', color: '#64748b', fontWeight: '600' }}>TAX</th>
                                  <th style={{ padding: '4px', textAlign: 'right', fontSize: '9px', color: '#64748b', fontWeight: '600' }}>LINE TOTAL</th>
                                </tr>
                              </thead>
                              <tbody>
                                {products.map((item: any, idx: number) => {
                                  const attrs = item.variation?.attributes || item.product_variations?.attributes || {};
                                  const variationText = (attrs.size || attrs.color) ? [attrs.size, attrs.color].filter(Boolean).join(' / ') : '—';
                                  // Packing: structured – Boxes + Pieces (never merge with Qty/Unit)
                                  const pd = item.packing_details || {};
                                  const totalBoxes = pd.total_boxes ?? 0;
                                  const totalPieces = pd.total_pieces ?? 0;
                                  const packingParts: string[] = [];
                                  if (Number(totalBoxes) > 0) packingParts.push(`${totalBoxes} Box${Number(totalBoxes) !== 1 ? 'es' : ''}`);
                                  if (Number(totalPieces) > 0) packingParts.push(`${totalPieces} Piece${Number(totalPieces) !== 1 ? 's' : ''}`);
                                  const packingText = packingParts.length
                                    ? packingParts.join(', ')
                                    : (item.packing_type || item.packing_quantity != null || item.packing_unit)
                                      ? [item.packing_type, item.packing_quantity != null && item.packing_quantity !== '' ? String(item.packing_quantity) : null, item.packing_unit].filter(Boolean).join(' ')
                                      : '—';
                                  const qty = Number(item.quantity) || 0;
                                  const unit = item.unit ?? 'piece';
                                  const unitPrice = Number(item.unit_price) || 0;
                                  const discount = Number(item.discount_amount) || 0;
                                  const tax = Number(item.tax_amount) || 0;
                                  const lineTotal = Number(item.total) || 0;
                                  return (
                                    <tr key={item.id}>
                                      <td style={{ padding: '4px', color: '#64748b' }}>{idx + 1}</td>
                                      <td style={{ padding: '4px', color: '#000000' }}>{item.product_name || 'N/A'}</td>
                                      <td style={{ padding: '4px', color: '#000000' }}>{variationText}</td>
                                      {enablePacking && <td style={{ padding: '4px', color: '#000000' }}>{packingText}</td>}
                                      <td style={{ padding: '4px', textAlign: 'right', color: '#000000', fontWeight: '600' }}>{qty.toFixed(2)}</td>
                                      <td style={{ padding: '4px', color: '#000000' }}>{unit}</td>
                                      <td style={{ padding: '4px', textAlign: 'right', fontFamily: 'monospace', color: '#000000' }}>{unitPrice.toLocaleString('en-PK')}</td>
                                      <td style={{ padding: '4px', textAlign: 'right', fontFamily: 'monospace', color: '#000000' }}>{discount > 0 ? discount.toLocaleString('en-PK') : '—'}</td>
                                      <td style={{ padding: '4px', textAlign: 'right', fontFamily: 'monospace', color: '#000000' }}>{tax.toLocaleString('en-PK')}</td>
                                      <td style={{ padding: '4px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', color: '#000000' }}>{lineTotal.toLocaleString('en-PK')}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

            {/* Summary Section */}
            <div style={{ 
              marginTop: '30px', 
              padding: '20px', 
              background: '#f8f9fa',
              border: '2px solid #000000',
              borderRadius: '4px'
            }}>
              <h3 style={{ 
                fontSize: '14px', 
                fontWeight: '700', 
                margin: '0 0 16px 0',
                color: '#000000',
                textTransform: 'uppercase',
                borderBottom: '2px solid #dee2e6',
                paddingBottom: '8px'
              }}>
                PERIOD SUMMARY
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <p style={{ fontSize: '11px', color: '#666666', margin: '0 0 4px 0', fontWeight: '600' }}>
                    TOTAL DEBIT:
                  </p>
                  <p style={{ fontSize: '16px', fontWeight: '700', margin: '0', fontFamily: 'monospace', color: '#000000' }}>
                    Rs {totalDebit.toLocaleString('en-PK')}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '11px', color: '#666666', margin: '0 0 4px 0', fontWeight: '600' }}>
                    TOTAL CREDIT:
                  </p>
                  <p style={{ fontSize: '16px', fontWeight: '700', margin: '0', fontFamily: 'monospace', color: '#000000' }}>
                    Rs {totalCredit.toLocaleString('en-PK')}
                  </p>
                </div>
                <div style={{ 
                  background: '#ffffff', 
                  padding: '12px', 
                  borderRadius: '4px',
                  border: '2px solid #000000'
                }}>
                  <p style={{ fontSize: '11px', color: '#666666', margin: '0 0 4px 0', fontWeight: '600' }}>
                    CLOSING BALANCE:
                  </p>
                  <p style={{ fontSize: '18px', fontWeight: '700', margin: '0', fontFamily: 'monospace', color: '#000000' }}>
                    Rs {closingBalance.toLocaleString('en-PK')}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ 
              marginTop: '40px', 
              paddingTop: '16px',
              borderTop: '1px solid #dee2e6',
              fontSize: '10px',
              color: '#666666',
              textAlign: 'center'
            }}>
              <p style={{ margin: '0' }}>
                Generated on {new Date().toLocaleDateString('en-GB', { 
                  day: '2-digit', 
                  month: 'long', 
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
              <p style={{ margin: '4px 0 0 0' }}>
                This is a computer-generated ledger statement
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}