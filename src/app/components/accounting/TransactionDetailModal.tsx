'use client';

import React, { useState, useEffect } from 'react';
import { X, ExternalLink, FileText, Paperclip, Image as ImageIcon, File } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { accountingService } from '@/app/services/accountingService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { format } from 'date-fns';
import { cn } from '@/app/components/ui/utils';

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  referenceNumber: string; // Can be journal_entry_id (UUID) or reference_no (string)
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  isOpen,
  onClose,
  referenceNumber,
}) => {
  const { companyId, branchId } = useSupabase();
  const [transaction, setTransaction] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && referenceNumber && companyId) {
      loadTransaction();
    }
  }, [isOpen, referenceNumber, companyId]);

  const loadTransaction = async () => {
    if (!referenceNumber || !companyId) return;

    setLoading(true);
    try {
      // CRITICAL FIX: Prioritize entry_no lookup (JE-0058) over UUID lookup
      // UUID format: 8-4-4-4-12 hex characters
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(referenceNumber);
      const looksLikeEntryNo = /^[A-Z]+-\d+$/i.test(referenceNumber.trim()); // JE-0058, EXP-0001, etc.
      
      console.log('[TRANSACTION DETAIL] Loading transaction:', {
        referenceNumber,
        isUUID,
        looksLikeEntryNo,
        companyId
      });

      let data = null;
      
      // PRIORITY 1: If it looks like entry_no (JE-0058), use reference lookup first
      if (looksLikeEntryNo) {
        console.log('[TRANSACTION DETAIL] Looks like entry_no, using reference lookup first...');
        data = await accountingService.getEntryByReference(referenceNumber, companyId);
        console.log('[TRANSACTION DETAIL] Reference lookup result:', data ? 'FOUND' : 'NOT FOUND');
      }
      
      // PRIORITY 2: If UUID, try ID-based lookup
      if (!data && isUUID) {
        console.log('[TRANSACTION DETAIL] Looks like UUID, using ID lookup...');
        data = await accountingService.getEntryById(referenceNumber, companyId);
        console.log('[TRANSACTION DETAIL] ID lookup result:', data ? 'FOUND' : 'NOT FOUND');
      }
      
      // PRIORITY 3: Fallback to reference lookup (for any other format)
      if (!data && !looksLikeEntryNo) {
        console.log('[TRANSACTION DETAIL] Trying reference lookup as fallback...');
        data = await accountingService.getEntryByReference(referenceNumber, companyId);
        console.log('[TRANSACTION DETAIL] Reference lookup result:', data ? 'FOUND' : 'NOT FOUND');
      }

      setTransaction(data);
      
      if (!data) {
        console.error('[TRANSACTION DETAIL] Transaction not found:', referenceNumber);
        console.error('[TRANSACTION DETAIL] Tried:', {
          entryNoLookup: looksLikeEntryNo,
          uuidLookup: isUUID,
          referenceLookup: true
        });
      }
    } catch (error: any) {
      console.error('[TRANSACTION DETAIL] Error loading transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!transaction && !loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Transaction Not Found</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8 text-gray-400">
            Transaction with reference {referenceNumber} not found.
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const journalLines = Array.isArray(transaction?.lines) 
    ? transaction.lines 
    : transaction?.lines 
      ? [transaction.lines] 
      : [];
  const payment = Array.isArray(transaction?.payment) 
    ? transaction.payment[0] 
    : transaction?.payment;
  const sale = Array.isArray(transaction?.sale) 
    ? transaction.sale[0] 
    : transaction?.sale;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!w-[800px] !max-w-[800px] sm:!max-w-[800px] max-h-[95vh] overflow-auto bg-gray-900 border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Transaction Details</h2>
              <p className="text-sm text-gray-400 mt-1">Reference: {referenceNumber}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X size={20} />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading transaction details...</div>
        ) : transaction ? (
          <div className="space-y-6">
            {/* SECTION A: BASIC INFO */}
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <FileText size={16} />
                Basic Information
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Reference Number:</span>
                  <p className="text-white font-medium">{transaction.entry_no || referenceNumber}</p>
                </div>
                <div>
                  <span className="text-gray-400">Date:</span>
                  <p className="text-white">
                    {format(new Date(transaction.entry_date), 'dd MMM yyyy')}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">Module:</span>
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 ml-2">
                    {transaction.reference_type === 'sale' ? 'Sales' : 
                     transaction.reference_type === 'expense' ? 'Expense' :
                     transaction.reference_type === 'payment' ? 'Payment' : 'Accounting'}
                  </Badge>
                </div>
                <div>
                  <span className="text-gray-400">Created By:</span>
                  <p className="text-white">{transaction.created_by ? 'User' : 'System'}</p>
                </div>
                {(transaction as any).branch && (
                  <div>
                    <span className="text-gray-400">Branch:</span>
                    <p className="text-white">
                      {(transaction as any).branch.code 
                        ? `${(transaction as any).branch.code} | ${(transaction as any).branch.name}`
                        : (transaction as any).branch.name}
                    </p>
                  </div>
                )}
                <div className="col-span-2">
                  <span className="text-gray-400">Description:</span>
                  <p className="text-white">{transaction.description || 'No description'}</p>
                </div>
              </div>
            </div>

            {/* SECTION B: LINKED RECORDS */}
            {(sale || payment) && (
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Linked Records</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {sale && (
                    <>
                      <div>
                        <span className="text-gray-400">Invoice Number:</span>
                        <p className="text-white font-medium">{sale.invoice_no}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Customer:</span>
                        <p className="text-white">{sale.customer_name}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Total Amount:</span>
                        <p className="text-white">Rs {parseFloat(sale.total || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Paid Amount:</span>
                        <p className="text-green-400">Rs {parseFloat(sale.paid_amount || 0).toLocaleString()}</p>
                      </div>
                    </>
                  )}
                  {payment && (
                    <>
                      <div>
                        <span className="text-gray-400">Payment Reference:</span>
                        <p className="text-white font-medium">{payment.reference_number}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Payment Method:</span>
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 ml-2 capitalize">
                          {payment.payment_method}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-gray-400">Payment Amount:</span>
                        <p className="text-white">Rs {parseFloat(payment.amount || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Payment Date:</span>
                        <p className="text-white">
                          {format(new Date(payment.payment_date), 'dd MMM yyyy')}
                        </p>
                      </div>
                      {/* CRITICAL FIX: Show attachment icon if payment has attachments */}
                      {payment.attachments && (
                        <div className="col-span-2">
                          <span className="text-gray-400">Attachments:</span>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {Array.isArray(payment.attachments) ? (
                              payment.attachments.map((att: any, idx: number) => {
                                const url = att.url || att.fileUrl || att;
                                const name = att.name || att.fileName || `Attachment ${idx + 1}`;
                                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                                return (
                                  <button
                                    key={idx}
                                    onClick={() => setSelectedAttachment(url)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 transition-colors"
                                  >
                                    {isImage ? <ImageIcon size={16} /> : <File size={16} />}
                                    <span className="text-sm">{name}</span>
                                    <Paperclip size={14} />
                                  </button>
                                );
                              })
                            ) : typeof payment.attachments === 'string' ? (
                              <button
                                onClick={() => setSelectedAttachment(payment.attachments)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 transition-colors"
                              >
                                <Paperclip size={16} />
                                <span className="text-sm">View Attachment</span>
                              </button>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* SECTION C: JOURNAL ENTRIES (MOST IMPORTANT) */}
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Journal Entries (Double Entry)</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-900">
                    <tr className="text-xs font-semibold text-gray-400 uppercase">
                      <th className="px-4 py-2 text-left">Account Name</th>
                      <th className="px-4 py-2 text-right">Debit</th>
                      <th className="px-4 py-2 text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journalLines.map((line: any) => {
                      const account = line.account || {};
                      return (
                        <tr key={line.id} className="border-b border-gray-700">
                          <td className="px-4 py-3 text-sm text-white">
                            <div>
                              <p className="font-medium">{account.name || 'Unknown Account'}</p>
                              {account.code && (
                                <p className="text-xs text-gray-400">{account.code}</p>
                              )}
                            </div>
                          </td>
                          <td className={cn(
                            "px-4 py-3 text-sm text-right tabular-nums",
                            line.debit > 0 ? "text-green-400 font-medium" : "text-gray-500"
                          )}>
                            {line.debit > 0 ? line.debit.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }) : '-'}
                          </td>
                          <td className={cn(
                            "px-4 py-3 text-sm text-right tabular-nums",
                            line.credit > 0 ? "text-red-400 font-medium" : "text-gray-500"
                          )}>
                            {line.credit > 0 ? line.credit.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-900">
                    <tr className="font-semibold text-white">
                      <td className="px-4 py-2 text-right">Total:</td>
                      <td className="px-4 py-2 text-right text-green-400">
                        {journalLines.reduce((sum: number, line: any) => sum + (line.debit || 0), 0).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-2 text-right text-red-400">
                        {journalLines.reduce((sum: number, line: any) => sum + (line.credit || 0), 0).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                💡 Double-entry accounting: Total Debit = Total Credit
              </p>
            </div>

            {/* SECTION D: EXTRA CONTEXT (if applicable) */}
            {transaction.description?.toLowerCase().includes('discount') && (
              <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/30">
                <h3 className="text-sm font-semibold text-yellow-400 mb-2">Sales Discount Applied</h3>
                <p className="text-sm text-gray-300">
                  This transaction includes a sales discount. The discount amount reduces Accounts Receivable.
                </p>
              </div>
            )}

            {transaction.description?.toLowerCase().includes('expense') && (
              <div className="bg-orange-500/10 rounded-lg p-4 border border-orange-500/30">
                <h3 className="text-sm font-semibold text-orange-400 mb-2">Extra Expense Recorded</h3>
                <p className="text-sm text-gray-300">
                  This transaction records an extra expense (e.g., stitching, packing) linked to the sale.
                </p>
              </div>
            )}

            {transaction.description?.toLowerCase().includes('commission') && (
              <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/30">
                <h3 className="text-sm font-semibold text-purple-400 mb-2">Commission Expense</h3>
                <p className="text-sm text-gray-300">
                  This transaction records commission expense for the salesperson.
                </p>
              </div>
            )}
          </div>
        ) : null}

        {/* Attachment Viewer Modal */}
        {selectedAttachment && (
          <div 
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setSelectedAttachment(null)}
          >
            <div className="relative max-w-6xl max-h-[90vh] w-full h-full flex items-center justify-center">
              <button
                onClick={() => setSelectedAttachment(null)}
                className="absolute top-4 right-4 text-white hover:text-gray-300 z-10 bg-gray-900/80 rounded-full p-2"
              >
                <X size={24} />
              </button>
              {/\.(jpg|jpeg|png|gif|webp)$/i.test(selectedAttachment) ? (
                <img 
                  src={selectedAttachment} 
                  alt="Attachment" 
                  className="max-w-full max-h-full object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <iframe
                  src={selectedAttachment}
                  className="w-full h-full border-0"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
