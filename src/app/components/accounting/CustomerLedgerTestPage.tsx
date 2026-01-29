'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Calendar, Printer, Download, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { accountingService, AccountLedgerEntry } from '@/app/services/accountingService';
import { contactService, Contact } from '@/app/services/contactService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { TransactionDetailModal } from './TransactionDetailModal';
import { CustomerSelector } from './CustomerLedgerComponents/CustomerSelector';
import { DateRangeFilter } from './CustomerLedgerComponents/DateRangeFilter';
import { LedgerSummaryStrip } from './CustomerLedgerComponents/LedgerSummaryStrip';
import { InvoiceSummaryStrip } from './CustomerLedgerComponents/InvoiceSummaryStrip';
import { LedgerTabs } from './CustomerLedgerComponents/LedgerTabs';
import './customer-ledger-test-print.css';

interface CustomerLedgerTestPageProps {
  onClose: () => void;
}

export const CustomerLedgerTestPage: React.FC<CustomerLedgerTestPageProps> = ({ onClose }) => {
  const { companyId, branchId } = useSupabase();
  const [selectedCustomer, setSelectedCustomer] = useState<Contact | null>(null);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [ledgerEntries, setLedgerEntries] = useState<AccountLedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedReference, setSelectedReference] = useState<string | null>(null);
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [companyName, setCompanyName] = useState<string>('');

  // Fetch company name for PDF/Print header
  useEffect(() => {
    if (!companyId) {
      setCompanyName('');
      return;
    }
    supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .maybeSingle()
      .then(({ data }) => setCompanyName(data?.name || ''));
  }, [companyId]);

  // Load ledger when customer and dates change
  useEffect(() => {
    if (selectedCustomer && companyId) {
      loadLedger();
    } else {
      setLedgerEntries([]);
    }
  }, [selectedCustomer, dateFrom, dateTo, companyId, branchId]);

  const loadLedger = async () => {
    if (!selectedCustomer || !companyId) return;

    setLoading(true);
    try {
      const entries = await accountingService.getCustomerLedger(
        selectedCustomer.id!,
        companyId,
        branchId,
        dateFrom || undefined,
        dateTo || undefined
      );

      // CRITICAL: Filter out commission entries
      const filteredEntries = entries.filter(entry => 
        !entry.description?.toLowerCase().includes('commission')
      );

      setLedgerEntries(filteredEntries);
    } catch (error: any) {
      console.error('[CUSTOMER LEDGER TEST] Error loading ledger:', error);
      toast.error('Failed to load customer ledger');
      setLedgerEntries([]);
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals from ledger entries (SINGLE SOURCE OF TRUTH)
  const totals = useMemo(() => {
    if (ledgerEntries.length === 0) {
      return {
        openingBalance: 0,
        totalDebit: 0,
        totalCredit: 0,
        closingBalance: 0,
      };
    }

    const firstEntry = ledgerEntries[0];
    const firstChange = (firstEntry.debit || 0) - (firstEntry.credit || 0);
    const openingBalance = firstEntry.running_balance - firstChange;

    const totalDebit = ledgerEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredit = ledgerEntries.reduce((sum, e) => sum + (e.credit || 0), 0);
    const closingBalance = ledgerEntries.length > 0 
      ? ledgerEntries[ledgerEntries.length - 1].running_balance 
      : openingBalance;

    return {
      openingBalance,
      totalDebit,
      totalCredit,
      closingBalance,
    };
  }, [ledgerEntries]);

  // State for sale details (for invoice summary)
  const [saleDetailsForSummary, setSaleDetailsForSummary] = useState<Map<string, any>>(new Map());

  // Fetch sale details for invoice summary
  useEffect(() => {
    if (ledgerEntries.length > 0 && companyId && selectedCustomer) {
      const saleIds = Array.from(new Set(
        ledgerEntries
          .filter(e => e.sale_id)
          .map(e => e.sale_id!)
      ));

      if (saleIds.length > 0) {
        const fetchSaleDetails = async () => {
          try {
            const { data: sales } = await supabase
              .from('sales')
              .select('id, invoice_no, total, paid_amount, due_amount')
              .in('id', saleIds)
              .eq('customer_id', selectedCustomer.id)
              .eq('company_id', companyId);

            if (sales) {
              const map = new Map<string, any>();
              sales.forEach(sale => {
                map.set(sale.id, sale);
              });
              setSaleDetailsForSummary(map);
            }
          } catch (error) {
            console.error('[CUSTOMER LEDGER TEST] Error fetching sale details for summary:', error);
          }
        };
        fetchSaleDetails();
      }
    }
  }, [ledgerEntries, companyId, selectedCustomer]);

  // Calculate invoice summary (same logic as InvoiceSummaryStrip)
  const invoiceSummary = useMemo(() => {
    const saleGroups = new Map<string, {
      saleId: string;
      totalPayments: number;
    }>();

    ledgerEntries.forEach(entry => {
      if (entry.sale_id) {
        if (!saleGroups.has(entry.sale_id)) {
          saleGroups.set(entry.sale_id, {
            saleId: entry.sale_id,
            totalPayments: 0,
          });
        }
        const group = saleGroups.get(entry.sale_id)!;
        
        // Count payments (CREDIT entries, exclude discounts)
        if (entry.credit > 0) {
          const desc = entry.description?.toLowerCase() || '';
          if (!desc.includes('discount')) {
            if (entry.payment_id || entry.source_module === 'Payment') {
              group.totalPayments += entry.credit;
            }
          }
        }
      }
    });

    let totalInvoices = saleGroups.size;
    let totalInvoiceAmount = 0;
    let totalPaymentReceived = 0;
    let fullyPaidCount = 0;
    let partiallyPaidCount = 0;
    let unpaidCount = 0;

    saleGroups.forEach((group, saleId) => {
      const saleDetail = saleDetailsForSummary.get(saleId);
      const invoiceTotal = saleDetail?.total || 0;
      const paidAmount = saleDetail?.paid_amount || group.totalPayments;
      
      totalInvoiceAmount += invoiceTotal;
      totalPaymentReceived += group.totalPayments;

      if (invoiceTotal > 0) {
        if (paidAmount >= invoiceTotal) {
          fullyPaidCount++;
        } else if (paidAmount > 0) {
          partiallyPaidCount++;
        } else {
          unpaidCount++;
        }
      }
    });

    return {
      totalInvoices,
      totalInvoiceAmount,
      totalPaymentReceived,
      pendingAmount: totalInvoiceAmount - totalPaymentReceived,
      fullyPaidCount,
      partiallyPaidCount,
      unpaidCount,
    };
  }, [ledgerEntries, saleDetailsForSummary]);

  const handleApply = () => {
    if (!selectedCustomer) {
      toast.error('Please select a customer');
      return;
    }
    loadLedger();
  };

  const handleReferenceClick = (entry: AccountLedgerEntry) => {
    if (entry.document_type === 'Opening Balance' || !entry.journal_entry_id) return;
    setSelectedReference(entry.journal_entry_id);
  };

  const handlePrint = () => {
    if (!selectedCustomer) {
      toast.error('Select a customer first');
      return;
    }
    const printArea = document.getElementById('ledger-print-area');
    if (!printArea) {
      toast.error('Print area not ready');
      return;
    }
    if (printOrientation === 'landscape') {
      printArea.style.width = '297mm';
      printArea.style.height = '210mm';
    } else {
      printArea.style.width = '210mm';
      printArea.style.height = '297mm';
    }
    window.print();
  };

  const handleExportPDF = async () => {
    const element = document.getElementById('ledger-print-area');
    if (!element) {
      toast.error('Print area not found. Select a customer and load ledger first.');
      return;
    }
    if (ledgerEntries.length === 0) {
      toast.error('No ledger data to export. Load a customer ledger first.');
      return;
    }
    try {
      const { default: jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      /* CSS has display:none !important – override via data attribute so html2canvas can capture */
      element.setAttribute('data-pdf-capture', 'true');
      if (printOrientation === 'landscape') {
        element.style.width = '297mm';
        element.style.height = '210mm';
      } else {
        element.style.width = '210mm';
        element.style.height = 'auto';
      }
      await new Promise(resolve => setTimeout(resolve, 150));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight
      });

      element.removeAttribute('data-pdf-capture');

      const imgData = canvas.toDataURL('image/png');
      const orientation = printOrientation === 'landscape' ? 'l' : 'p';
      const pdf = new jsPDF(orientation, 'mm', 'a4');
      
      const imgWidth = printOrientation === 'landscape' ? 297 : 210;
      const pageHeight = printOrientation === 'landscape' ? 210 : 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`customer_ledger_${selectedCustomer?.name?.replace(/\s+/g, '_') || 'ledger'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('[CUSTOMER LEDGER TEST] PDF export error:', error);
      toast.info('Using browser print to PDF. Press Ctrl+P and select "Save as PDF"');
      window.print();
    }
  };

  const handleExportExcel = () => {
    const csvData: string[] = [];
    csvData.push('Date,Reference No,Document Type,Payment Account,Description,Notes / Reference,Debit,Credit,Running Balance');
    
    csvData.push(`-,Opening Balance,Opening Balance,-,Opening Balance,-,${totals.openingBalance >= 0 ? totals.openingBalance.toFixed(2) : ''},${totals.openingBalance < 0 ? Math.abs(totals.openingBalance).toFixed(2) : ''},${totals.openingBalance.toFixed(2)}`);
    
    ledgerEntries.forEach(entry => {
      const date = format(new Date(entry.date), 'yyyy-MM-dd');
      const ref = entry.reference_number || entry.entry_no || '';
      const docType = entry.document_type || entry.source_module || '';
      const account = entry.account_name || '';
      const desc = entry.description || '';
      const notes = entry.notes || '';
      const debit = (entry.debit || 0).toFixed(2);
      const credit = (entry.credit || 0).toFixed(2);
      const balance = (entry.running_balance || 0).toFixed(2);
      csvData.push(`${date},${ref},${docType},${account},${desc},${notes},${debit},${credit},${balance}`);
    });
    
    csvData.push(`-,Closing Balance,Closing Balance,-,Closing Balance,-,${totals.closingBalance >= 0 ? totals.closingBalance.toFixed(2) : ''},${totals.closingBalance < 0 ? Math.abs(totals.closingBalance).toFixed(2) : ''},${totals.closingBalance.toFixed(2)}`);
    
    const csvContent = csvData.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `customer_ledger_${selectedCustomer?.name?.replace(/\s+/g, '_') || 'ledger'}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Excel file downloaded');
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0F17] text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <h1 className="text-2xl font-bold">Customer Ledger (Test)</h1>
        <div className="flex items-center gap-2">
          {selectedCustomer && (
            <>
              <div className="flex items-center gap-2 border-r border-gray-700 pr-4 mr-4">
                <span className="text-xs text-gray-400">Print:</span>
                <Button
                  variant={printOrientation === 'portrait' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPrintOrientation('portrait')}
                  className={printOrientation === 'portrait' ? 'bg-green-600 hover:bg-green-700' : ''}
                >
                  Portrait
                </Button>
                <Button
                  variant={printOrientation === 'landscape' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPrintOrientation('landscape')}
                  className={printOrientation === 'landscape' ? 'bg-green-600 hover:bg-green-700' : ''}
                >
                  Landscape
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                <Printer size={14} className="mr-2" />
                Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                <Download size={14} className="mr-2" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                <FileSpreadsheet size={14} className="mr-2" />
                Excel
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X size={20} />
          </Button>
        </div>
      </div>

      {/* Top Bar - Customer Search & Date Range */}
      <div className="bg-gray-950 border-b border-gray-800 px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[300px]">
            <CustomerSelector
              companyId={companyId || ''}
              selectedCustomer={selectedCustomer}
              onSelect={setSelectedCustomer}
            />
          </div>
          <DateRangeFilter
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
          />
          <Button
            onClick={handleApply}
            disabled={!selectedCustomer || loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Apply
          </Button>
        </div>

        {/* Selected Customer Info */}
        {selectedCustomer && (
          <div className="mt-4 flex items-center gap-4 text-sm">
            <span className="font-semibold">{selectedCustomer.name}</span>
            {selectedCustomer.code && (
              <>
                <span className="text-gray-400">|</span>
                <span className="text-gray-400">Code: {selectedCustomer.code}</span>
              </>
            )}
            {selectedCustomer.phone && (
              <>
                <span className="text-gray-400">|</span>
                <span className="text-gray-400">Phone: {selectedCustomer.phone}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Ledger Summary Strip */}
      {selectedCustomer && (
        <LedgerSummaryStrip
          openingBalance={totals.openingBalance}
          totalDebit={totals.totalDebit}
          totalCredit={totals.totalCredit}
          closingBalance={totals.closingBalance}
        />
      )}

      {/* Invoice Summary Strip (NEW - Business View) */}
      {selectedCustomer && ledgerEntries.length > 0 && (
        <InvoiceSummaryStrip
          ledgerEntries={ledgerEntries}
          customerId={selectedCustomer.id || ''}
          companyId={companyId || ''}
        />
      )}

      {/* Main Ledger Tabs */}
      {selectedCustomer && (
        <div className="flex-1 overflow-hidden">
          <LedgerTabs
            ledgerEntries={ledgerEntries}
            loading={loading}
            onReferenceClick={handleReferenceClick}
            companyId={companyId || ''}
            customerId={selectedCustomer.id || ''}
          />
        </div>
      )}

      {/* Empty State */}
      {!selectedCustomer && (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          Please select a customer to view ledger
        </div>
      )}

      {/* Print Area (Hidden) – Accounting ledger format: same data as screen, clean layout for Print & PDF */}
      {selectedCustomer && (
        <div
          id="ledger-print-area"
          className={`ledger-print-only bg-white text-black p-8 ${printOrientation === 'landscape' ? 'landscape' : ''}`}
          style={{
            display: 'none',
            position: 'absolute',
            left: '-9999px',
            width: printOrientation === 'landscape' ? '297mm' : '210mm',
            height: printOrientation === 'landscape' ? '210mm' : 'auto'
          }}
        >
          {/* Header: Company name, Customer name + code, Date range – classic print */}
          <div className="print-header ledger-print-header mb-4 border-b-2 border-black pb-3">
            {companyName && <h1 className="text-lg font-bold mb-1">{companyName}</h1>}
            <div className="print-meta text-sm">
              <div><strong>Customer:</strong> {selectedCustomer.name}{selectedCustomer.code ? ` (Code: ${selectedCustomer.code})` : ''}</div>
              <div className="mt-1">
                <strong>Date Range:</strong>{' '}
                {dateFrom && dateTo
                  ? `${format(new Date(dateFrom), 'dd-MM-yyyy')} to ${format(new Date(dateTo), 'dd-MM-yyyy')}`
                  : 'All dates'}
              </div>
            </div>
          </div>

          {/* Table: Date, Reference No, Description, Debit, Credit, Running Balance – classic */}
          <table className="w-full border-collapse border border-black text-sm ledger-print-table">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black p-2 text-left">Date</th>
                <th className="border border-black p-2 text-left">Reference No</th>
                <th className="border border-black p-2 text-left">Description</th>
                <th className="border border-black p-2 text-right">Debit</th>
                <th className="border border-black p-2 text-right">Credit</th>
                <th className="border border-black p-2 text-right">Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledgerEntries.map((entry, idx) => (
                <tr key={`print-${entry.journal_entry_id || 'ob'}-${idx}`}>
                  <td className="border border-black p-2">{format(new Date(entry.date), 'dd-MM-yyyy')}</td>
                  <td className="border border-black p-2">{entry.reference_number}</td>
                  <td className="border border-black p-2">{entry.description}</td>
                  <td className="border border-black p-2 text-right">{entry.debit > 0 ? entry.debit.toFixed(2) : ''}</td>
                  <td className="border border-black p-2 text-right">{entry.credit > 0 ? entry.credit.toFixed(2) : ''}</td>
                  <td className="border border-black p-2 text-right">{entry.running_balance.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer: Total Debit, Total Credit, Closing Balance – classic summary box */}
          <div className="print-summary-box mt-4 flex justify-end gap-8 text-sm font-semibold border-t-2 border-black pt-3">
            <span>Total Debit: Rs {totals.totalDebit.toFixed(2)}</span>
            <span>Total Credit: Rs {totals.totalCredit.toFixed(2)}</span>
            <span>Closing Balance: Rs {totals.closingBalance.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Transaction Detail Modal */}
      {selectedReference && (
        <TransactionDetailModal
          isOpen={!!selectedReference}
          onClose={() => setSelectedReference(null)}
          referenceNumber={selectedReference}
        />
      )}
    </div>
  );
};
