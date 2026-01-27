'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Download, Calendar, Search, FileText, Printer, FileSpreadsheet,
  ArrowLeft, TrendingUp, TrendingDown, MapPin, Building2, List, Grid, ChevronDown, ChevronRight
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { accountingService, AccountLedgerEntry } from '@/app/services/accountingService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { contactService } from '@/app/services/contactService';
import { branchService, Branch } from '@/app/services/branchService';
import { saleService } from '@/app/services/saleService';
import { supabase } from '@/lib/supabase';
import { CalendarDateRangePicker } from '@/app/components/ui/CalendarDateRangePicker';
import { format } from 'date-fns';
import { cn } from '@/app/components/ui/utils';
import { toast } from 'sonner';
import { TransactionDetailModal } from './TransactionDetailModal';
import './customer-ledger-print.css';

interface CustomerLedgerPageProps {
  customerId: string;
  customerName: string;
  customerCode?: string;
  onClose: () => void;
}

export const CustomerLedgerPage: React.FC<CustomerLedgerPageProps> = ({
  customerId,
  customerName,
  customerCode,
  onClose,
}) => {
  const { companyId, branchId: contextBranchId } = useSupabase();
  const [ledgerEntries, setLedgerEntries] = useState<AccountLedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | undefined>(contextBranchId);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReference, setSelectedReference] = useState<string | null>(null);
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'summary' | 'detail' | 'view'>('detail');
  const [expandedSales, setExpandedSales] = useState<Set<string>>(new Set());
  const [customerDetails, setCustomerDetails] = useState<any>(null); // For customer address, phone, etc.
  const [selectedSaleForView, setSelectedSaleForView] = useState<string | null>(null); // Sale ID for View tab
  const [saleItemsMap, setSaleItemsMap] = useState<Map<string, any[]>>(new Map()); // Sale items details
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('portrait');

  // Load branches
  useEffect(() => {
    const loadBranches = async () => {
      if (!companyId) return;
      try {
        const branchesData = await branchService.getAllBranches(companyId);
        setBranches(branchesData);
      } catch (error) {
        console.error('[CUSTOMER LEDGER] Error loading branches:', error);
      }
    };
    loadBranches();
  }, [companyId]);

  // Load customer details (address, phone, etc.) for print/PDF
  useEffect(() => {
    const loadCustomerDetails = async () => {
      if (!customerId || !companyId) return;
      try {
        const { data: contact } = await supabase
          .from('contacts')
          .select('id, name, code, phone, email, address, custom_field_1, custom_field_2')
          .eq('id', customerId)
          .eq('company_id', companyId)
          .single();
        
        if (contact) {
          setCustomerDetails(contact);
        }
      } catch (error) {
        console.error('[CUSTOMER LEDGER] Error loading customer details:', error);
      }
    };
    loadCustomerDetails();
  }, [customerId, companyId]);

  // Load ledger
  useEffect(() => {
    if (customerId && companyId) {
      loadLedger();
    }
  }, [customerId, companyId, selectedBranchId, dateRange]);

  const loadLedger = async () => {
    if (!customerId || !companyId) {
      console.warn('[CUSTOMER LEDGER] Missing customerId or companyId:', { customerId, companyId });
      return;
    }

    console.log('[CUSTOMER LEDGER] loadLedger called:', {
      customerId,
      customerIdType: typeof customerId,
      customerIdLength: customerId?.length,
      companyId,
      selectedBranchId,
      dateRange,
      searchTerm,
      customerName,
      customerCode
    });

    setLoading(true);
    try {
      const startDate = dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined;
      const endDate = dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined;

      console.log('[CUSTOMER LEDGER] Calling getCustomerLedger with:', {
        customerId,
        companyId,
        branchId: selectedBranchId,
        startDate,
        endDate,
        searchTerm: searchTerm.trim() || undefined
      });

      const entries = await accountingService.getCustomerLedger(
        customerId,
        companyId,
        selectedBranchId,
        startDate,
        endDate,
        searchTerm.trim() || undefined
      );

      console.log('[CUSTOMER LEDGER] Received entries from API:', {
        count: entries.length,
        sample: entries.slice(0, 3).map(e => ({
          ref: e.reference_number,
          debit: e.debit,
          credit: e.credit,
          journal_entry_id: e.journal_entry_id,
          // STEP 2: Verify both not non-zero
          bothNonZero: (e.debit || 0) > 0 && (e.credit || 0) > 0
        })),
        // STEP 6: Verify totals match
        totalDebit: entries.reduce((sum, e) => sum + (e.debit || 0), 0),
        totalCredit: entries.reduce((sum, e) => sum + (e.credit || 0), 0),
        finalBalance: entries.length > 0 ? entries[entries.length - 1].running_balance : 0
      });

      setLedgerEntries(entries);
      
      // Calculate opening balance (first entry's running balance minus first entry's change)
      if (entries.length > 0) {
        const firstEntry = entries[0];
        const firstChange = (firstEntry.debit || 0) - (firstEntry.credit || 0);
        setOpeningBalance(firstEntry.running_balance - firstChange);
        console.log('[CUSTOMER LEDGER] Opening balance calculated:', {
          firstEntryBalance: firstEntry.running_balance,
          firstChange,
          openingBalance: firstEntry.running_balance - firstChange
        });
      } else {
        setOpeningBalance(0);
        console.log('[CUSTOMER LEDGER] No entries found, opening balance = 0');
      }
    } catch (error: any) {
      console.error('[CUSTOMER LEDGER] Error loading ledger:', error);
      toast.error('Failed to load customer ledger');
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = useMemo(() => {
    if (!searchTerm.trim()) {
      return ledgerEntries;
    }

    const search = searchTerm.toLowerCase().trim();
    
    return ledgerEntries.filter(entry => {
      // Reference number match (JE-0047, EXP-0001, etc.)
      if (entry.reference_number?.toLowerCase().includes(search)) return true;
      
      // Description match
      if (entry.description?.toLowerCase().includes(search)) return true;
      
      // Amount match (partial)
      const amountStr = ((entry.debit || 0) + (entry.credit || 0)).toString();
      if (amountStr.includes(search)) return true;
      
      // Source module match
      if (entry.source_module?.toLowerCase().includes(search)) return true;
      
      return false;
    });
  }, [ledgerEntries, searchTerm]);

  // PHASE 4: Summary cards MUST use SAME data as table (NO SEPARATE API CALLS)
  const totals = useMemo(() => {
    console.log('[CUSTOMER LEDGER] Calculating totals from filteredEntries:', {
      entryCount: filteredEntries.length,
      sampleEntries: filteredEntries.slice(0, 3).map(e => ({
        ref: e.reference_number,
        debit: e.debit,
        credit: e.credit
      }))
    });

    // CRITICAL FIX: For Accounts Receivable account (code 2000):
    // - DEBIT entries = Sales/Charges (increases receivable - money owed to us)
    // - CREDIT entries = Payments received (decreases receivable - money received)
    // 
    // So:
    // - Total Charges = Sum of DEBIT entries (sales, expenses added to receivable)
    // - Total Payments = Sum of CREDIT entries (payments received, reduces receivable)
    
    const totalCharges = filteredEntries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
    const totalPayments = filteredEntries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
    
    // CRITICAL FIX: For ASSET account, discounts are CREDIT entries (reduce receivable)
    const totalDiscounts = filteredEntries
      .filter(entry => entry.description?.toLowerCase().includes('discount'))
      .reduce((sum, entry) => sum + (entry.credit || 0), 0);
    
    const outstandingBalance = filteredEntries.length > 0 
      ? filteredEntries[filteredEntries.length - 1].running_balance 
      : openingBalance;
    
    console.log('[CUSTOMER LEDGER] Calculated totals:', {
      totalCharges,
      totalPayments,
      totalDiscounts,
      outstandingBalance
    });
    
    return {
      totalCharges,
      totalPayments,
      totalDiscounts,
      outstandingBalance,
    };
  }, [filteredEntries, openingBalance]);

  // CRITICAL FIX: For ASSET account (AR), running balance = opening + debit - credit
  // Positive balance = customer owes us (receivable)
  // The running_balance from service is already calculated correctly
  const closingBalance = filteredEntries.length > 0 
    ? filteredEntries[filteredEntries.length - 1].running_balance 
    : openingBalance;
  
  // Log for debugging
  console.log('[CUSTOMER LEDGER] Balance calculation:', {
    openingBalance,
    closingBalance,
    lastEntryBalance: filteredEntries.length > 0 ? filteredEntries[filteredEntries.length - 1].running_balance : null,
    totalDebit: filteredEntries.reduce((sum, e) => sum + (e.debit || 0), 0),
    totalCredit: filteredEntries.reduce((sum, e) => sum + (e.credit || 0), 0),
    calculated: openingBalance + filteredEntries.reduce((sum, e) => sum + (e.debit || 0) - (e.credit || 0), 0)
  });

  const selectedBranch = branches.find(b => b.id === selectedBranchId);

  // CRITICAL FIX: Group entries by sale_id for Summary view
  const summaryData = useMemo(() => {
    // Group entries by sale_id
    const saleGroups = new Map<string, {
      saleId: string;
      invoiceNo: string;
      date: string;
      entries: AccountLedgerEntry[];
      totalCharges: number;
      totalPayments: number;
      outstanding: number;
      runningBalance: number;
    }>();

    // Also track standalone payments (not linked to sales)
    const standalonePayments: AccountLedgerEntry[] = [];

    filteredEntries.forEach(entry => {
      if (entry.sale_id) {
        if (!saleGroups.has(entry.sale_id)) {
          saleGroups.set(entry.sale_id, {
            saleId: entry.sale_id,
            invoiceNo: entry.reference_number, // Will be updated with actual invoice_no
            date: entry.date,
            entries: [],
            totalCharges: 0,
            totalPayments: 0,
            outstanding: 0,
            runningBalance: 0,
          });
        }
        const group = saleGroups.get(entry.sale_id)!;
        group.entries.push(entry);
        // CRITICAL FIX: For AR account, sales are DEBIT (increase receivable), payments are CREDIT (decrease receivable)
        group.totalCharges += entry.debit || 0; // Sales/Charges are DEBIT entries
        group.totalPayments += entry.credit || 0; // Payments are CREDIT entries
        group.runningBalance = entry.running_balance; // Use last entry's balance
      } else if (entry.payment_id && entry.source_module === 'Payment') {
        // Standalone payment (not linked to a sale)
        standalonePayments.push(entry);
      }
    });

    // Calculate outstanding for each sale group
    saleGroups.forEach(group => {
      group.outstanding = group.totalCharges - group.totalPayments;
    });

    // Fetch sale details to get invoice numbers
    const summaryArray = Array.from(saleGroups.values());
    
    return {
      sales: summaryArray,
      standalonePayments,
    };
  }, [filteredEntries]);

  // Fetch sale details for BOTH summary and detail views
  // CRITICAL: Detail view also needs sale amounts from sales table
  const [saleDetailsMap, setSaleDetailsMap] = useState<Map<string, any>>(new Map());
  
  useEffect(() => {
    // Get all unique sale_ids from filteredEntries (for both summary and detail views)
    const saleIds = Array.from(new Set(
      filteredEntries
        .filter(e => e.sale_id)
        .map(e => e.sale_id!)
    ));

    if (saleIds.length > 0 && companyId) {
      const fetchSaleDetails = async () => {
        try {
          // CRITICAL: Fetch all sale details from sales table (SINGLE SOURCE OF TRUTH)
          // Include: subtotal, shipping, expenses, discount, total (for detail breakdown)
          const { data: sales } = await supabase
            .from('sales')
            .select('id, invoice_no, subtotal, total, discount_amount, expenses, paid_amount, due_amount, invoice_date')
            .in('id', saleIds);

          console.log('[CUSTOMER LEDGER] Fetched sale details:', {
            saleIds: saleIds.length,
            salesFound: sales?.length || 0,
            sample: sales?.slice(0, 2).map(s => ({
              invoice_no: s.invoice_no,
              total: s.total,
              paid_amount: s.paid_amount,
              due_amount: s.due_amount
            }))
          });

          if (sales) {
            const map = new Map<string, any>();
            sales.forEach(sale => {
              map.set(sale.id, sale);
            });
            setSaleDetailsMap(map);
          }
        } catch (error) {
          console.error('[CUSTOMER LEDGER] Error fetching sale details:', error);
        }
      };
      fetchSaleDetails();
    } else {
      setSaleDetailsMap(new Map());
    }
  }, [filteredEntries, companyId]); // Changed dependency to filteredEntries (works for both views)

  // Fetch sale items for View tab
  useEffect(() => {
    if (selectedSaleForView && companyId) {
      const fetchSaleItems = async () => {
        try {
          // First try with products join
          let { data: items, error } = await supabase
            .from('sale_items')
            .select(`
              id,
              product_id,
              product_name,
              quantity,
              unit,
              unit_price,
              discount_amount,
              tax_amount,
              total,
              products:product_id (
                id,
                name,
                sku
              )
            `)
            .eq('sale_id', selectedSaleForView)
            .order('id');

          // If products join fails, try without it (products might not exist)
          if (error && (error.code === '42703' || error.message?.includes('does not exist'))) {
            console.warn('[CUSTOMER LEDGER] Products join failed, fetching without join:', error.message);
            const { data: itemsWithoutJoin, error: errorWithoutJoin } = await supabase
              .from('sale_items')
              .select(`
                id,
                product_id,
                product_name,
                quantity,
                unit,
                unit_price,
                discount_amount,
                tax_amount,
                total
              `)
              .eq('sale_id', selectedSaleForView)
              .order('id');
            
            if (errorWithoutJoin) throw errorWithoutJoin;
            items = itemsWithoutJoin;
          } else if (error) {
            throw error;
          }

          if (items) {
            const map = new Map<string, any[]>();
            map.set(selectedSaleForView, items);
            setSaleItemsMap(map);
            console.log('[CUSTOMER LEDGER] Fetched sale items:', {
              saleId: selectedSaleForView,
              itemsCount: items.length,
              sample: items.slice(0, 2)
            });
          }
        } catch (error) {
          console.error('[CUSTOMER LEDGER] Error fetching sale items:', error);
          toast.error('Failed to load sale items');
          // Clear the map on error so loading state is cleared
          setSaleItemsMap(new Map());
        }
      };
      fetchSaleItems();
    } else {
      // Clear map when no sale is selected
      setSaleItemsMap(new Map());
    }
  }, [selectedSaleForView, companyId]);

  // PHASE 6: Calculate Aging Report (based on outstanding sales)
  const agingReport = useMemo(() => {
    const today = new Date();
    let currentAmount = 0;
    let days30Amount = 0;
    let days60Amount = 0;
    let days90Amount = 0;
    let over90Amount = 0;

    // Calculate aging from outstanding sales (more accurate than entries)
    if (summaryData.sales.length > 0 && saleDetailsMap.size > 0) {
      summaryData.sales.forEach(summary => {
        const saleDetail = saleDetailsMap.get(summary.saleId);
        if (!saleDetail) return;
        
        const outstanding = saleDetail.due_amount || summary.outstanding;
        if (outstanding <= 0) return;

        const saleDate = saleDetail.invoice_date ? new Date(saleDetail.invoice_date) : new Date(summary.date);
        const daysDiff = Math.floor((today.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff <= 0) {
          currentAmount += outstanding;
        } else if (daysDiff <= 30) {
          days30Amount += outstanding;
        } else if (daysDiff <= 60) {
          days60Amount += outstanding;
        } else if (daysDiff <= 90) {
          days90Amount += outstanding;
        } else {
          over90Amount += outstanding;
        }
      });
    }

    const totalDue = currentAmount + days30Amount + days60Amount + days90Amount + over90Amount;

    return {
      current: currentAmount,
      days30: days30Amount,
      days60: days60Amount,
      days90: days90Amount,
      over90: over90Amount,
      total: totalDue
    };
  }, [summaryData, saleDetailsMap]);

  // PHASE 6: Print/PDF/Excel Export Functions
  const handleExportPDF = async () => {
    try {
      // Use jsPDF with html2canvas for PDF generation
      const { default: jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;
      
      const element = document.getElementById('ledger-print-area');
      if (!element) {
        toast.error('Print area not found');
        return;
      }

      // Temporarily show and position print area for capture
      const originalDisplay = element.style.display;
      const originalPosition = element.style.position;
      const originalLeft = element.style.left;
      const originalTop = element.style.top;
      const originalWidth = element.style.width;
      const originalHeight = element.style.height;
      
      element.style.display = 'block';
      element.style.position = 'absolute';
      element.style.left = '0';
      element.style.top = '0';
      // CRITICAL FIX: Set width/height based on printOrientation
      if (printOrientation === 'landscape') {
        element.style.width = '297mm';
        element.style.height = '210mm';
      } else {
        element.style.width = '210mm';
        element.style.height = 'auto';
      }
      element.style.zIndex = '9999';

      // Wait a bit for rendering
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight
      });

      // Restore original styles
      element.style.display = originalDisplay;
      element.style.position = originalPosition;
      element.style.left = originalLeft;
      element.style.top = originalTop;
      element.style.width = originalWidth;
      element.style.height = originalHeight;

      const imgData = canvas.toDataURL('image/png');
      const orientation = printOrientation === 'landscape' ? 'l' : 'p';
      const pdf = new jsPDF(orientation, 'mm', 'a4');
      
      const imgWidth = printOrientation === 'landscape' ? 297 : 210; // A4 width in mm
      const pageHeight = printOrientation === 'landscape' ? 210 : 297; // A4 height in mm
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

      pdf.save(`customer_ledger_${customerName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('[CUSTOMER LEDGER] PDF export error:', error);
      // Fallback: Use browser print to PDF
      toast.info('Using browser print to PDF. Press Ctrl+P and select "Save as PDF"');
      window.print();
    }
  };

  const handleExportExcel = () => {
    // PHASE 6: Excel export - Raw accounting format
    const csvData: string[] = [];
    
    // Header
    csvData.push('Date,Reference,Description,Debit,Credit,Running Balance');
    
    // Opening Balance
    csvData.push(`-,Opening Balance,Opening Balance,${openingBalance >= 0 ? openingBalance.toFixed(2) : ''},${openingBalance < 0 ? Math.abs(openingBalance).toFixed(2) : ''},${openingBalance.toFixed(2)}`);
    
    // Entries
    filteredEntries.forEach(entry => {
      const date = format(new Date(entry.date), 'yyyy-MM-dd');
      const ref = entry.reference_number || entry.entry_no || '';
      const desc = entry.description || '';
      const debit = (entry.debit || 0).toFixed(2);
      const credit = (entry.credit || 0).toFixed(2);
      const balance = (entry.running_balance || 0).toFixed(2);
      csvData.push(`${date},${ref},${desc},${debit},${credit},${balance}`);
    });
    
    // Closing Balance
    csvData.push(`-,Closing Balance,Closing Balance,${closingBalance >= 0 ? closingBalance.toFixed(2) : ''},${closingBalance < 0 ? Math.abs(closingBalance).toFixed(2) : ''},${closingBalance.toFixed(2)}`);
    
    // Download
    const csvContent = csvData.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `customer_ledger_${customerName}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Excel file downloaded');
  };

  const handlePrint = () => {
    // PHASE 6: Print - Plain black & white, table-based
    // Apply orientation to print area
    const printArea = document.getElementById('ledger-print-area');
    if (printArea) {
      if (printOrientation === 'landscape') {
        printArea.style.width = '297mm';
        printArea.style.height = '210mm';
      } else {
        printArea.style.width = '210mm';
        printArea.style.height = '297mm';
      }
    }
    window.print();
  };

  const handleReferenceClick = (entry: AccountLedgerEntry) => {
    // CRITICAL FIX: Use entry_no (JE-0058) from database for lookup
    // If entry_no is missing, use reference_number (displayed value) which should match entry_no
    // Only fallback to UUID if both are missing
    console.log('[CUSTOMER LEDGER] Reference click:', {
      reference_number: entry.reference_number, // Displayed value (should be entry_no)
      entry_no: entry.entry_no, // Actual DB entry_no
      journal_entry_id: entry.journal_entry_id
    });

    // PRIORITY 1: Use actual entry_no from database (most reliable)
    if (entry.entry_no && entry.entry_no.trim() !== '' && !entry.entry_no.match(/^[0-9a-f]{8}-/i)) {
      console.log('[CUSTOMER LEDGER] Using entry_no from DB:', entry.entry_no);
      setSelectedReference(entry.entry_no);
      return;
    }
    
    // PRIORITY 2: Use reference_number (displayed value) - should match entry_no format (JE-0058)
    // Only if it looks like entry_no format (not UUID)
    if (entry.reference_number && entry.reference_number.match(/^[A-Z]+-\d+$/i)) {
      console.log('[CUSTOMER LEDGER] Using reference_number (entry_no format):', entry.reference_number);
      setSelectedReference(entry.reference_number);
      return;
    }
    
    // PRIORITY 3: Fallback to journal_entry_id (UUID) - will use getEntryById
    if (entry.journal_entry_id) {
      console.log('[CUSTOMER LEDGER] Using journal_entry_id (UUID fallback):', entry.journal_entry_id);
      setSelectedReference(entry.journal_entry_id);
      return;
    }
    
    // ERROR: No valid lookup key
    console.error('[CUSTOMER LEDGER] No valid lookup key found!', entry);
    toast.error('Unable to find transaction reference');
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0F17] text-white flex flex-col print-area">
      {/* Print/PDF Area (hidden in screen, visible in print) */}
      <div 
        id="ledger-print-area" 
        className={`bg-white text-black p-8 ${printOrientation === 'landscape' ? 'landscape' : ''}`}
        style={{ 
          display: 'none', 
          position: 'absolute', 
          left: '-9999px', 
          width: printOrientation === 'landscape' ? '297mm' : '210mm',
          height: printOrientation === 'landscape' ? '210mm' : 'auto'
        }}
      >
        {/* Print Header - Customer Information */}
        <div className="print-header mb-4 border-b-2 border-black pb-3">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h1 className="text-2xl font-bold mb-2">PARTNER LEDGER</h1>
              <div className="text-sm space-y-1">
                <div><strong>{customerCode || 'N/A'}, {customerName}</strong></div>
                {customerDetails && (
                  <>
                    {customerDetails.address && <div>{customerDetails.address}</div>}
                    {customerDetails.phone && <div><strong>Mobile:</strong> {customerDetails.phone}</div>}
                    {customerDetails.email && <div><strong>Email:</strong> {customerDetails.email}</div>}
                    {customerDetails.custom_field_1 && <div><strong>Custom Field 1:</strong> {customerDetails.custom_field_1}</div>}
                  </>
                )}
              </div>
            </div>
            <div className="text-sm text-right">
              <div><strong>Date Range:</strong> {
                dateRange.from && dateRange.to 
                  ? `${format(dateRange.from, 'dd-MM-yyyy')} - ${format(dateRange.to, 'dd-MM-yyyy')}`
                  : 'All dates'
              }</div>
            </div>
          </div>
        </div>

        {/* Account Summary Box */}
        <div className="bg-gray-100 border-2 border-black p-4 mb-4">
          <h2 className="font-bold text-lg mb-3">Account Summary</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><strong>Opening Balance:</strong> Rs {openingBalance.toFixed(2)}</div>
            <div><strong>Total Invoice:</strong> Rs {totals.totalCharges.toFixed(2)}</div>
            <div><strong>Total Paid:</strong> Rs {totals.totalPayments.toFixed(2)}</div>
            <div><strong>Advance Balance:</strong> Rs 0.00</div>
            <div><strong>Ledger Discount:</strong> Rs {totals.totalDiscounts.toFixed(2)}</div>
            <div><strong>Balance Due:</strong> Rs {totals.outstandingBalance.toFixed(2)}</div>
          </div>
        </div>

        {/* Ledger Table for Print - Professional Format */}
        <div className="mb-4">
          <h2 className="font-bold text-lg mb-2">Showing all invoices and payments between {
            dateRange.from && dateRange.to 
              ? `${format(dateRange.from, 'dd-MM-yyyy')} and ${format(dateRange.to, 'dd-MM-yyyy')}`
              : 'all dates'
          }</h2>
        </div>
        
        <table className="w-full border-collapse border border-black text-sm">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-black p-2 text-left">Date</th>
              <th className="border border-black p-2 text-left">Type</th>
              <th className="border border-black p-2 text-left">Reference No</th>
              <th className="border border-black p-2 text-left">Payment Method</th>
              <th className="border border-black p-2 text-right">Debit</th>
              <th className="border border-black p-2 text-right">Credit</th>
              <th className="border border-black p-2 text-right">Balance</th>
              <th className="border border-black p-2 text-left">Others</th>
            </tr>
          </thead>
          <tbody>
            {/* Opening Balance */}
            <tr>
              <td className="border border-black p-2">{format(new Date(), 'dd-MM-yyyy')} 00:00</td>
              <td className="border border-black p-2">Opening Balance</td>
              <td className="border border-black p-2">-</td>
              <td className="border border-black p-2">-</td>
              <td className="border border-black p-2 text-right">{openingBalance >= 0 ? openingBalance.toFixed(2) : ''}</td>
              <td className="border border-black p-2 text-right">{openingBalance < 0 ? Math.abs(openingBalance).toFixed(2) : ''}</td>
              <td className="border border-black p-2 text-right">{Math.abs(openingBalance).toFixed(2)} {openingBalance >= 0 ? 'DR' : 'CR'}</td>
              <td className="border border-black p-2">-</td>
            </tr>
            {/* Entries - Group by sale for better readability */}
            {(() => {
              const rows: JSX.Element[] = [];
              const saleGroups = new Map<string, AccountLedgerEntry[]>();
              const standaloneEntries: AccountLedgerEntry[] = [];

              filteredEntries.forEach(entry => {
                if (entry.sale_id) {
                  if (!saleGroups.has(entry.sale_id)) {
                    saleGroups.set(entry.sale_id, []);
                  }
                  saleGroups.get(entry.sale_id)!.push(entry);
                } else {
                  standaloneEntries.push(entry);
                }
              });

              // Calculate running balance for print (sequential)
              let printRunningBalance = openingBalance;

              // Add sale invoice rows first
              saleGroups.forEach((entries, saleId) => {
                const saleDetail = saleDetailsMap.get(saleId);
                const invoiceNo = saleDetail?.invoice_no || entries[0]?.reference_number || 'N/A';
                const saleTotal = saleDetail?.total || 0;

                // Update running balance: opening + sale
                printRunningBalance += saleTotal;

                // Sale Invoice row
                rows.push(
                  <tr key={`print-sale-${saleId}`}>
                    <td className="border border-black p-2">
                      {saleDetail?.invoice_date ? format(new Date(saleDetail.invoice_date), 'dd-MM-yyyy') : format(new Date(entries[0].date), 'dd-MM-yyyy')} 00:00
                    </td>
                    <td className="border border-black p-2">Sell</td>
                    <td className="border border-black p-2">{invoiceNo}</td>
                    <td className="border border-black p-2">-</td>
                    <td className="border border-black p-2 text-right">{saleTotal > 0 ? saleTotal.toFixed(2) : ''}</td>
                    <td className="border border-black p-2 text-right"></td>
                    <td className="border border-black p-2 text-right">
                      {Math.abs(printRunningBalance).toFixed(2)} {printRunningBalance >= 0 ? 'DR' : 'CR'}
                    </td>
                    <td className="border border-black p-2">-</td>
                  </tr>
                );

                // Then add payment/discount entries for this sale
                entries.forEach((entry, idx) => {
                  if (entry.description?.toLowerCase().includes('commission')) return; // Skip commission
                  
                  // Update running balance: previous + debit - credit
                  printRunningBalance += (entry.debit || 0) - (entry.credit || 0);
                  
                  const entryType = entry.source_module === 'Payment' ? 'Payment' :
                                   entry.description?.toLowerCase().includes('discount') ? 'Ledger discount' :
                                   'Journal Entry';
                  const paymentMethod = entry.source_module === 'Payment' ? 
                    (entry.description?.match(/cash|bank|cheque/i)?.[0]?.toUpperCase() || '-') : '-';
                  
                  rows.push(
                    <tr key={`print-entry-${entry.journal_entry_id}-${idx}`}>
                      <td className="border border-black p-2">{format(new Date(entry.date), 'dd-MM-yyyy HH:mm')}</td>
                      <td className="border border-black p-2">{entryType}</td>
                      <td className="border border-black p-2">{entry.reference_number || entry.entry_no || '-'}</td>
                      <td className="border border-black p-2">{paymentMethod}</td>
                      <td className="border border-black p-2 text-right">{(entry.debit || 0).toFixed(2)}</td>
                      <td className="border border-black p-2 text-right">{(entry.credit || 0).toFixed(2)}</td>
                      <td className="border border-black p-2 text-right">
                        {Math.abs(printRunningBalance).toFixed(2)} {printRunningBalance >= 0 ? 'DR' : 'CR'}
                      </td>
                      <td className="border border-black p-2">{entry.description || '-'}</td>
                    </tr>
                  );
                });
              });

              // Add standalone entries
              standaloneEntries.forEach((entry, idx) => {
                // Update running balance
                printRunningBalance += (entry.debit || 0) - (entry.credit || 0);
                
                const entryType = entry.source_module === 'Payment' ? 'Payment' : 'Journal Entry';
                const paymentMethod = entry.source_module === 'Payment' ? 
                  (entry.description?.match(/cash|bank|cheque/i)?.[0]?.toUpperCase() || '-') : '-';
                
                rows.push(
                  <tr key={`print-standalone-${entry.journal_entry_id}-${idx}`}>
                    <td className="border border-black p-2">{format(new Date(entry.date), 'dd-MM-yyyy HH:mm')}</td>
                    <td className="border border-black p-2">{entryType}</td>
                    <td className="border border-black p-2">{entry.reference_number || entry.entry_no || '-'}</td>
                    <td className="border border-black p-2">{paymentMethod}</td>
                    <td className="border border-black p-2 text-right">{(entry.debit || 0).toFixed(2)}</td>
                    <td className="border border-black p-2 text-right">{(entry.credit || 0).toFixed(2)}</td>
                    <td className="border border-black p-2 text-right">
                      {Math.abs(printRunningBalance).toFixed(2)} {printRunningBalance >= 0 ? 'DR' : 'CR'}
                    </td>
                    <td className="border border-black p-2">{entry.description || '-'}</td>
                  </tr>
                );
              });

              return rows;
            })()}
            {/* Closing Balance */}
            <tr className="font-bold">
              <td className="border border-black p-2" colSpan={4}>Closing Balance</td>
              <td className="border border-black p-2 text-right">{closingBalance >= 0 ? closingBalance.toFixed(2) : ''}</td>
              <td className="border border-black p-2 text-right">{closingBalance < 0 ? Math.abs(closingBalance).toFixed(2) : ''}</td>
              <td className="border border-black p-2 text-right">
                {Math.abs(closingBalance).toFixed(2)} {closingBalance >= 0 ? 'DR' : 'CR'}
              </td>
              <td className="border border-black p-2">-</td>
            </tr>
          </tbody>
        </table>

        {/* Aging Report */}
        <div className="mt-6">
          <h2 className="font-bold text-lg mb-3">Aging Report</h2>
          <table className="w-full border-collapse border border-black text-sm">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-black p-2 text-left">Category</th>
                <th className="border border-black p-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black p-2">Current</td>
                <td className="border border-black p-2 text-right">Rs {agingReport.current.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="border border-black p-2">1-30 DAYS PAST DUE</td>
                <td className="border border-black p-2 text-right">Rs {agingReport.days30.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="border border-black p-2">30-60 DAYS PAST DUE</td>
                <td className="border border-black p-2 text-right">Rs {agingReport.days60.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="border border-black p-2">60-90 DAYS PAST DUE</td>
                <td className="border border-black p-2 text-right">Rs {agingReport.days90.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="border border-black p-2">OVER 90 DAYS PAST DUE</td>
                <td className="border border-black p-2 text-right">Rs {agingReport.over90.toFixed(2)}</td>
              </tr>
              <tr className="font-bold">
                <td className="border border-black p-2">AMOUNT DUE</td>
                <td className="border border-black p-2 text-right">Rs {agingReport.total.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Screen View Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-shrink-0 no-print">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">Customer Ledger</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-lg font-semibold text-gray-200">{customerName}</span>
              {customerCode && (
                <Badge variant="outline" className="bg-gray-800 text-gray-400 border-gray-700">
                  {customerCode}
                </Badge>
              )}
              {selectedBranch && (
                <div className="flex items-center gap-1 text-sm text-gray-400">
                  <Building2 size={14} />
                  <span>{selectedBranch.code ? `${selectedBranch.code} | ${selectedBranch.name}` : selectedBranch.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          <X size={20} />
        </Button>
      </div>

      {/* Summary Cards - Screen View Only */}
      <div className="bg-gray-950 border-b border-gray-800 px-6 py-4 flex-shrink-0 no-print">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase mb-1">Total Charges</p>
            <p className="text-2xl font-bold text-red-400">
              Rs {totals.totalCharges.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase mb-1">Total Payments</p>
            <p className="text-2xl font-bold text-green-400">
              Rs {totals.totalPayments.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase mb-1">Total Discounts</p>
            <p className="text-2xl font-bold text-yellow-400">
              Rs {totals.totalDiscounts.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase mb-1">Outstanding Balance</p>
            <p className={cn(
              "text-2xl font-bold",
              totals.outstandingBalance >= 0 ? "text-yellow-400" : "text-green-400"
            )}>
              Rs {Math.abs(totals.outstandingBalance).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>

        {/* Opening/Closing Balance */}
        <div className="mt-4 flex items-center justify-between text-sm">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-gray-400">Opening Balance</p>
              <p className={cn(
                "text-lg font-semibold mt-1",
                openingBalance >= 0 ? "text-yellow-400" : "text-green-400"
              )}>
                Rs {openingBalance.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div>
              <p className="text-gray-400">Closing Balance</p>
              {/* CRITICAL FIX: For ASSET account, positive = receivable (yellow), negative = credit balance (red) */}
              <p className={cn(
                "text-lg font-semibold mt-1",
                closingBalance >= 0 ? "text-yellow-400" : "text-red-400"
              )}>
                Rs {closingBalance.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4 flex-1">
          {/* Global Search - WIDE and PROMINENT */}
          <div className="relative flex-1 max-w-2xl">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input
              placeholder="Search by reference (JE-0047), description, customer, invoice, amount..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 pr-4 py-2.5 bg-gray-800 border-gray-700 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          {/* Compact Branch Filter */}
          <div className="flex items-center gap-2 min-w-[180px]">
            <Building2 size={16} className="text-gray-400" />
            <select
              value={selectedBranchId || 'all'}
              onChange={(e) => {
                const newBranchId = e.target.value === 'all' ? undefined : e.target.value;
                setSelectedBranchId(newBranchId);
                // Trigger reload when branch changes
                if (customerId && companyId) {
                  loadLedger();
                }
              }}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 flex-1"
            >
              <option value="all">All Branches</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>
                  {branch.code ? `${branch.code} | ${branch.name}` : branch.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Compact Date Range */}
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-gray-400" />
            <CalendarDateRangePicker
              dateRange={dateRange}
              onDateRangeChange={(range) => {
                setDateRange(range);
                // Auto-reload on date change
                if (customerId && companyId) {
                  setTimeout(() => loadLedger(), 100);
                }
              }}
            />
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
            <span className="text-xs text-gray-400">View:</span>
            <Button
              variant={viewMode === 'summary' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('summary')}
              className={viewMode === 'summary' 
                ? "bg-blue-600 text-white hover:bg-blue-700" 
                : "border-gray-700 text-gray-300 hover:bg-gray-800"}
            >
              <Grid size={14} className="mr-2" />
              Summary
            </Button>
            <Button
              variant={viewMode === 'detail' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('detail')}
              className={viewMode === 'detail' 
                ? "bg-blue-600 text-white hover:bg-blue-700" 
                : "border-gray-700 text-gray-300 hover:bg-gray-800"}
            >
              <List size={14} className="mr-2" />
              Detail
            </Button>
            <Button
              variant={viewMode === 'view' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setViewMode('view');
                // Auto-select first sale if none selected
                if (!selectedSaleForView && summaryData.sales.length > 0) {
                  setSelectedSaleForView(summaryData.sales[0].saleId);
                }
              }}
              className={viewMode === 'view' 
                ? "bg-blue-600 text-white hover:bg-blue-700" 
                : "border-gray-700 text-gray-300 hover:bg-gray-800"}
            >
              <FileText size={14} className="mr-2" />
              View
            </Button>
          </div>
          
          {/* Print Orientation Toggle */}
          <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
            <span className="text-xs text-gray-400">Print:</span>
            <Button
              variant={printOrientation === 'portrait' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPrintOrientation('portrait')}
              className={printOrientation === 'portrait' 
                ? "bg-green-600 text-white hover:bg-green-700" 
                : "border-gray-700 text-gray-300 hover:bg-gray-800"}
            >
              <FileText size={14} className="mr-2" />
              Portrait
            </Button>
            <Button
              variant={printOrientation === 'landscape' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPrintOrientation('landscape')}
              className={printOrientation === 'landscape' 
                ? "bg-green-600 text-white hover:bg-green-700" 
                : "border-gray-700 text-gray-300 hover:bg-gray-800"}
            >
              <FileText size={14} className="mr-2" />
              Landscape
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* Ledger Table - Screen View */}
      <div className="flex-1 overflow-auto bg-gray-950 no-print">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading ledger...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No ledger entries found</div>
        ) : viewMode === 'summary' ? (
          // SUMMARY VIEW (Sale-level aggregation)
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900 sticky top-0 border-b border-gray-800">
                <tr className="text-xs font-semibold text-gray-400 uppercase">
                  <th className="px-4 py-3 text-left w-8"></th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Invoice No</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-right">Sale Total</th>
                  <th className="px-4 py-3 text-right">Total Paid</th>
                  <th className="px-4 py-3 text-right">Outstanding Balance</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening Balance Row */}
                <tr className="bg-blue-500/10 border-b border-gray-800 font-semibold">
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-gray-300">-</td>
                  <td className="px-4 py-3 text-gray-500">-</td>
                  <td className="px-4 py-3 text-white">Opening Balance</td>
                  <td className="px-4 py-3 text-right text-gray-500">-</td>
                  <td className="px-4 py-3 text-right text-gray-500">-</td>
                  <td className={cn(
                    "px-4 py-3 text-right font-bold",
                    openingBalance >= 0 ? "text-yellow-400" : "text-green-400"
                  )}>
                    Rs {openingBalance.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>

                {summaryData.sales.map((summary, index) => {
                  const saleDetail = saleDetailsMap.get(summary.saleId);
                  const invoiceNo = saleDetail?.invoice_no || summary.invoiceNo;
                  // CRITICAL FIX: Use total from sales table (SINGLE SOURCE OF TRUTH for sale amount)
                  // Do NOT use summary.totalCharges (calculated from journal entries)
                  // sales.total = final sale amount including all charges
                  const saleTotal = saleDetail?.total || 0;
                  const totalPaid = saleDetail?.paid_amount || summary.totalPayments;
                  const outstanding = saleDetail?.due_amount || (saleTotal - totalPaid);
                  
                  console.log('[CUSTOMER LEDGER] Summary row sale amount:', {
                    saleId: summary.saleId,
                    invoiceNo,
                    sales_total: saleDetail?.total,
                    saleTotal,
                    totalCharges_from_journal: summary.totalCharges,
                    source: saleDetail?.total ? 'sales.total (CORRECT)' : 'MISSING - using 0'
                  });
                  const isExpanded = expandedSales.has(summary.saleId);

                  return (
                    <React.Fragment key={summary.saleId}>
                      {/* Summary Row */}
                      <tr className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors cursor-pointer"
                          onClick={() => {
                            const newExpanded = new Set(expandedSales);
                            if (isExpanded) {
                              newExpanded.delete(summary.saleId);
                            } else {
                              newExpanded.add(summary.saleId);
                            }
                            setExpandedSales(newExpanded);
                          }}>
                        <td className="px-4 py-3">
                          {isExpanded ? (
                            <ChevronDown size={16} className="text-gray-400" />
                          ) : (
                            <ChevronRight size={16} className="text-gray-400" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {format(new Date(summary.date), 'dd MMM yyyy')}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // CRITICAL FIX: Use entry_no for reference click (matches what user sees)
                              const firstEntry = summary.entries[0];
                              if (firstEntry?.entry_no && firstEntry.entry_no.trim() !== '') {
                                setSelectedReference(firstEntry.entry_no);
                              } else if (firstEntry?.journal_entry_id) {
                                setSelectedReference(firstEntry.journal_entry_id);
                              } else {
                                // Fallback to invoice number
                                setSelectedReference(invoiceNo);
                              }
                            }}
                            className="text-blue-400 hover:text-blue-300 hover:underline text-sm font-medium font-mono"
                          >
                            {invoiceNo}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          Sale Invoice
                        </td>
                        {/* CRITICAL FIX: For ASSET account (AR), Sale = DEBIT (green), Payment = CREDIT (red) */}
                        <td className="px-4 py-3 text-sm text-right tabular-nums text-green-400 font-semibold">
                          Rs {saleTotal.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-3 text-sm text-right tabular-nums text-red-400 font-semibold">
                          Rs {totalPaid.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        {/* CRITICAL FIX: For ASSET account, positive = receivable (yellow), negative = credit balance (red) */}
                        <td className={cn(
                          "px-4 py-3 text-sm font-semibold text-right tabular-nums",
                          outstanding >= 0 ? "text-yellow-400" : "text-red-400"
                        )}>
                          Rs {outstanding.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>

                      {/* Expanded Detail Rows */}
                      {isExpanded && summary.entries.map((entry, entryIndex) => {
                        const branch = branches.find(b => {
                          // Try to find branch from entry if available
                          return false;
                        });

                        return (
                          <tr
                            key={`${entry.journal_entry_id}-${entryIndex}`}
                            className="bg-gray-900/50 border-b border-gray-800/50"
                          >
                            <td className="px-4 py-3"></td>
                            <td className="px-4 py-3 text-sm text-gray-400 pl-8">
                              {format(new Date(entry.date), 'dd MMM yyyy')}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReferenceClick(entry);
                                }}
                                className="text-blue-400 hover:text-blue-300 hover:underline text-xs font-medium font-mono"
                              >
                                {entry.reference_number}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400 pl-8">
                              {entry.description}
                            </td>
                            <td className={cn(
                              "px-4 py-3 text-xs text-right tabular-nums",
                              entry.debit > 0 ? "text-green-400" : "text-gray-500"
                            )}>
                              {entry.debit > 0 ? (
                                <span>Rs {entry.debit.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}</span>
                              ) : (
                                <span>-</span>
                              )}
                            </td>
                            <td className={cn(
                              "px-4 py-3 text-xs text-right tabular-nums",
                              entry.credit > 0 ? "text-red-400" : "text-gray-500"
                            )}>
                              {entry.credit > 0 ? (
                                <span>Rs {entry.credit.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}</span>
                              ) : (
                                <span>-</span>
                              )}
                            </td>
                            {/* CRITICAL FIX: For ASSET account, positive = receivable (yellow), negative = credit balance (red) */}
                            <td className={cn(
                              "px-4 py-3 text-xs font-semibold text-right tabular-nums",
                              entry.running_balance >= 0 ? "text-yellow-400" : "text-red-400"
                            )}>
                              Rs {entry.running_balance.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}

                {/* Standalone Payments */}
                {summaryData.standalonePayments.map((entry, index) => (
                  <tr
                    key={`payment-${entry.payment_id}-${index}`}
                    className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {format(new Date(entry.date), 'dd MMM yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleReferenceClick(entry)}
                        className="text-blue-400 hover:text-blue-300 hover:underline text-sm font-medium font-mono"
                      >
                        {entry.reference_number}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {entry.description}
                    </td>
                    {/* CRITICAL FIX: Standalone payments are CREDIT entries (decrease receivable) */}
                    <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-500">
                      -
                    </td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums text-red-400 font-semibold">
                      Rs {(entry.credit || 0).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    {/* CRITICAL FIX: For ASSET account, positive = receivable (yellow), negative = credit balance (red) */}
                    <td className={cn(
                      "px-4 py-3 text-sm font-semibold text-right tabular-nums",
                      entry.running_balance >= 0 ? "text-yellow-400" : "text-red-400"
                    )}>
                      Rs {entry.running_balance.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}

                {/* Closing Balance Row */}
                <tr className="bg-gray-900 font-bold border-t-2 border-blue-500/30">
                  <td colSpan={4} className="px-4 py-3 text-right text-white uppercase text-sm">
                    Closing Balance:
                  </td>
                  {/* CRITICAL FIX: For ASSET account, Charges = DEBIT (green), Payments = CREDIT (red) */}
                  <td className="px-4 py-3 text-right text-green-400 text-lg">
                    Rs {totals.totalCharges.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3 text-right text-red-400 text-lg">
                    Rs {totals.totalPayments.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  {/* CRITICAL FIX: For ASSET account, positive = receivable (yellow), negative = credit balance (red) */}
                  <td className={cn(
                    "px-4 py-3 text-right text-2xl font-bold",
                    closingBalance >= 0 ? "text-yellow-400" : "text-red-400"
                  )}>
                    Rs {closingBalance.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : viewMode === 'view' ? (
          // VIEW TAB (Sale Item Details)
          <div className="overflow-x-auto">
            <div className="p-6">
              {/* Sale Selector */}
              <div className="mb-6">
                <label className="text-sm text-gray-400 mb-2 block">Select Sale Invoice:</label>
                <select
                  value={selectedSaleForView || ''}
                  onChange={(e) => setSelectedSaleForView(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 min-w-[300px]"
                >
                  <option value="">-- Select Sale --</option>
                  {summaryData.sales.map((summary) => {
                    const saleDetail = saleDetailsMap.get(summary.saleId);
                    const invoiceNo = saleDetail?.invoice_no || summary.invoiceNo;
                    return (
                      <option key={summary.saleId} value={summary.saleId}>
                        {invoiceNo} - {format(new Date(summary.date), 'dd MMM yyyy')} - Rs {saleDetail?.total?.toFixed(2) || summary.totalCharges.toFixed(2)}
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedSaleForView && saleItemsMap.has(selectedSaleForView) ? (
                <div>
                  {/* Sale Header */}
                  {(() => {
                    const saleDetail = saleDetailsMap.get(selectedSaleForView);
                    const saleItems = saleItemsMap.get(selectedSaleForView) || [];
                    const invoiceNo = saleDetail?.invoice_no || 'N/A';
                    
                    return (
                      <div className="mb-6">
                        <h2 className="text-xl font-bold mb-4">Sale Invoice: {invoiceNo}</h2>
                        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-400 mb-1">Invoice Date:</p>
                            <p className="text-white">{saleDetail?.invoice_date ? format(new Date(saleDetail.invoice_date), 'dd MMM yyyy') : 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 mb-1">Total Amount:</p>
                            <p className="text-green-400 font-semibold">Rs {saleDetail?.total?.toFixed(2) || '0.00'}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 mb-1">Subtotal:</p>
                            <p className="text-white">Rs {saleDetail?.subtotal?.toFixed(2) || '0.00'}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 mb-1">Discount:</p>
                            <p className="text-red-400">Rs {saleDetail?.discount_amount?.toFixed(2) || '0.00'}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 mb-1">Extra Charges:</p>
                            <p className="text-yellow-400">Rs {saleDetail?.expenses?.toFixed(2) || '0.00'}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 mb-1">Paid Amount:</p>
                            <p className="text-green-400">Rs {saleDetail?.paid_amount?.toFixed(2) || '0.00'}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Sale Items Table */}
                  <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-800 border-b border-gray-700">
                        <tr className="text-xs font-semibold text-gray-400 uppercase">
                          <th className="px-4 py-3 text-left">#</th>
                          <th className="px-4 py-3 text-left">Product</th>
                          <th className="px-4 py-3 text-right">Quantity</th>
                          <th className="px-4 py-3 text-right">Unit Price</th>
                          <th className="px-4 py-3 text-right">Discount</th>
                          <th className="px-4 py-3 text-right">Tax</th>
                          <th className="px-4 py-3 text-right">Price inc. tax</th>
                          <th className="px-4 py-3 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {saleItemsMap.get(selectedSaleForView)?.map((item, index) => {
                          const productName = item.product_name || item.products?.name || 'N/A';
                          const unit = item.unit || 'piece'; // Use unit from sale_items
                          const quantity = item.quantity || 0;
                          const unitPrice = item.unit_price || 0;
                          const discount = item.discount_amount || 0;
                          const tax = item.tax_amount || 0;
                          const priceIncTax = unitPrice + tax; // unit_price + tax_amount
                          const subtotal = item.total || 0; // Use total from sale_items

                          return (
                            <tr key={item.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                              <td className="px-4 py-3 text-sm text-gray-300">{index + 1}</td>
                              <td className="px-4 py-3 text-sm text-white font-medium">{productName}</td>
                              <td className="px-4 py-3 text-sm text-right text-gray-300">
                                {quantity.toFixed(2)} {unit}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-300">
                                Rs {unitPrice.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-red-400">
                                Rs {discount.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-300">
                                Rs {tax.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-300">
                                Rs {priceIncTax.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-green-400 font-semibold">
                                Rs {subtotal.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-800 border-t-2 border-gray-700">
                        <tr>
                          <td colSpan={7} className="px-4 py-3 text-right text-sm font-semibold text-gray-300">
                            Total:
                          </td>
                          <td className="px-4 py-3 text-right text-lg font-bold text-green-400">
                            {(() => {
                              const saleDetail = saleDetailsMap.get(selectedSaleForView);
                              return `Rs ${saleDetail?.total?.toFixed(2) || '0.00'}`;
                            })()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ) : selectedSaleForView ? (
                <div className="text-center py-12 text-gray-400">
                  Loading sale items...
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  Please select a sale invoice to view item details
                </div>
              )}
            </div>
          </div>
        ) : (
          // DETAIL VIEW (Step-by-step)
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900 sticky top-0 border-b border-gray-800">
                <tr className="text-xs font-semibold text-gray-400 uppercase">
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Reference No</th>
                  <th className="px-4 py-3 text-left">Document</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-right">Debit</th>
                  <th className="px-4 py-3 text-right">Credit</th>
                  <th className="px-4 py-3 text-right">Running Balance</th>
                  <th className="px-4 py-3 text-left">Branch</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening Balance Row */}
                <tr className="bg-blue-500/10 border-b border-gray-800 font-semibold">
                  <td className="px-4 py-3 text-gray-300">-</td>
                  <td className="px-4 py-3 text-gray-500">-</td>
                  <td className="px-4 py-3 text-gray-500">-</td>
                  <td className="px-4 py-3 text-white">Opening Balance</td>
                  <td className="px-4 py-3 text-right text-gray-500">-</td>
                  <td className="px-4 py-3 text-right text-gray-500">-</td>
                  <td className={cn(
                    "px-4 py-3 text-right font-bold",
                    openingBalance >= 0 ? "text-yellow-400" : "text-green-400"
                  )}>
                    Rs {openingBalance.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3 text-gray-500">-</td>
                </tr>

                {/* CRITICAL FIX: Group detail entries by sale_id and show Sale Invoice row first */}
                {(() => {
                  // Group entries by sale_id
                  const saleGroups = new Map<string, AccountLedgerEntry[]>();
                  const standaloneEntries: AccountLedgerEntry[] = [];

                  filteredEntries.forEach(entry => {
                    if (entry.sale_id) {
                      if (!saleGroups.has(entry.sale_id)) {
                        saleGroups.set(entry.sale_id, []);
                      }
                      saleGroups.get(entry.sale_id)!.push(entry);
                    } else {
                      standaloneEntries.push(entry);
                    }
                  });

                  const rows: JSX.Element[] = [];

                  // Render each sale group with Sale Invoice row first
                  saleGroups.forEach((entries, saleId) => {
                    const saleDetail = saleDetailsMap.get(saleId);
                    const invoiceNo = saleDetail?.invoice_no || entries[0]?.reference_number || 'N/A';
                    // PHASE 5: Get breakdown from sales table
                    const subtotal = saleDetail?.subtotal || 0;
                    const expenses = saleDetail?.expenses || 0; // Extra charges
                    const discount = saleDetail?.discount_amount || 0;
                    const saleTotal = saleDetail?.total || 0; // SINGLE SOURCE: sales.total (includes all)
                    
                    // PHASE 5: Show Sale Invoice row with breakdown
                    // Row 1: Sale Invoice (Total)
                    rows.push(
                      <tr
                        key={`sale-${saleId}`}
                        className="border-b-2 border-blue-500/30 bg-blue-500/5 font-semibold"
                      >
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {saleDetail?.invoice_date ? format(new Date(saleDetail.invoice_date), 'dd MMM yyyy') : format(new Date(entries[0].date), 'dd MMM yyyy')}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              const firstEntry = entries[0];
                              if (firstEntry?.entry_no && firstEntry.entry_no.trim() !== '') {
                                setSelectedReference(firstEntry.entry_no);
                              } else if (firstEntry?.journal_entry_id) {
                                setSelectedReference(firstEntry.journal_entry_id);
                              }
                            }}
                            className="text-blue-400 hover:text-blue-300 hover:underline text-sm font-medium font-mono"
                          >
                            {invoiceNo}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                            Sales
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-white font-semibold">
                          Sale Invoice (Total)
                        </td>
                        {/* CRITICAL: Sale amount from sales.total (DEBIT for AR) */}
                        <td className="px-4 py-3 text-sm text-right tabular-nums text-green-400 font-semibold">
                          {saleTotal > 0 ? (
                            <span>Rs {saleTotal.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}</span>
                          ) : (
                            <span className="text-gray-600">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-600">
                          0
                        </td>
                        {/* Running balance for sale - calculate: opening + sale amount */}
                        <td className={cn(
                          "px-4 py-3 text-sm font-semibold text-right tabular-nums",
                          (openingBalance + saleTotal) >= 0 ? "text-yellow-400" : "text-red-400"
                        )}>
                          Rs {(openingBalance + saleTotal).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {entries[0]?.branch_name || '-'}
                        </td>
                      </tr>
                    );

                    // PHASE 5: Show breakdown rows (if available)
                    if (saleDetail && (subtotal > 0 || expenses > 0 || discount > 0)) {
                      // Items Total
                      if (subtotal > 0) {
                        rows.push(
                          <tr key={`sale-${saleId}-subtotal`} className="bg-gray-900/30 border-b border-gray-800/50">
                            <td className="px-4 py-2 text-sm text-gray-400 pl-12"></td>
                            <td className="px-4 py-2 text-sm text-gray-400"></td>
                            <td className="px-4 py-2 text-sm text-gray-400"></td>
                            <td className="px-4 py-2 text-xs text-gray-400 pl-8">Items Total</td>
                            <td className="px-4 py-2 text-xs text-right text-gray-400">Rs {subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-4 py-2 text-xs text-right text-gray-500">0</td>
                            <td className="px-4 py-2 text-xs text-right text-gray-500">-</td>
                            <td className="px-4 py-2 text-xs text-gray-400">-</td>
                          </tr>
                        );
                      }
                      
                      // Extra Charges
                      if (expenses > 0) {
                        rows.push(
                          <tr key={`sale-${saleId}-expenses`} className="bg-gray-900/30 border-b border-gray-800/50">
                            <td className="px-4 py-2 text-sm text-gray-400 pl-12"></td>
                            <td className="px-4 py-2 text-sm text-gray-400"></td>
                            <td className="px-4 py-2 text-sm text-gray-400"></td>
                            <td className="px-4 py-2 text-xs text-gray-400 pl-8">Extra Charges</td>
                            <td className="px-4 py-2 text-xs text-right text-gray-400">Rs {expenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-4 py-2 text-xs text-right text-gray-500">0</td>
                            <td className="px-4 py-2 text-xs text-right text-gray-500">-</td>
                            <td className="px-4 py-2 text-xs text-gray-400">-</td>
                          </tr>
                        );
                      }
                      
                      // Discount
                      if (discount > 0) {
                        rows.push(
                          <tr key={`sale-${saleId}-discount`} className="bg-gray-900/30 border-b border-gray-800/50">
                            <td className="px-4 py-2 text-sm text-gray-400 pl-12"></td>
                            <td className="px-4 py-2 text-sm text-gray-400"></td>
                            <td className="px-4 py-2 text-sm text-gray-400"></td>
                            <td className="px-4 py-2 text-xs text-gray-400 pl-8">Discount</td>
                            <td className="px-4 py-2 text-xs text-right text-gray-500">0</td>
                            <td className="px-4 py-2 text-xs text-right text-red-400">Rs {discount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-4 py-2 text-xs text-right text-gray-500">-</td>
                            <td className="px-4 py-2 text-xs text-gray-400">-</td>
                          </tr>
                        );
                      }
                    }

                    // Then show journal entries for this sale (payments, discounts, extra expenses)
                    // EXCLUDE commission entries (already filtered in backend)
                    // CRITICAL: Calculate running balance starting from opening + sale amount
                    let runningBalanceForSale = openingBalance + saleTotal;
                    
                    entries.forEach((entry, entryIndex) => {
                      // Skip if this is a commission entry (should already be filtered, but double-check)
                      if (entry.description?.toLowerCase().includes('commission')) {
                        return; // Skip commission entries
                      }
                      
                      // Update running balance: previous + debit - credit
                      runningBalanceForSale = runningBalanceForSale + (entry.debit || 0) - (entry.credit || 0);

                      rows.push(
                        <tr
                          key={`${entry.journal_entry_id}-${entryIndex}`}
                          className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                        >
                          <td className="px-4 py-3 text-sm text-gray-300 pl-8">
                            {format(new Date(entry.date), 'dd MMM yyyy')}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleReferenceClick(entry)}
                              className="text-blue-400 hover:text-blue-300 hover:underline text-sm font-medium font-mono"
                            >
                              {entry.reference_number}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className="bg-gray-700 text-gray-300 text-xs">
                              {entry.source_module}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300 pl-8">{entry.description}</td>
                      {/* STEP 1: Debit column - DIRECT mapping, NO Math.abs(), NO conditionals */}
                      <td className={cn(
                        "px-4 py-3 text-sm text-right tabular-nums",
                        (entry.debit || 0) > 0 ? "text-green-400 font-semibold" : "text-gray-500"
                      )}>
                        {(entry.debit || 0) > 0 ? (
                          <span>Rs {(entry.debit || 0).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}</span>
                        ) : (
                          <span className="text-gray-600">0</span>
                        )}
                      </td>
                      {/* STEP 1: Credit column - DIRECT mapping, NO Math.abs(), NO conditionals */}
                      <td className={cn(
                        "px-4 py-3 text-sm text-right tabular-nums",
                        (entry.credit || 0) > 0 ? "text-red-400 font-semibold" : "text-gray-500"
                      )}>
                        {(entry.credit || 0) > 0 ? (
                          <span>Rs {(entry.credit || 0).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}</span>
                        ) : (
                          <span className="text-gray-600">0</span>
                        )}
                      </td>
                      {/* STEP 6: Running Balance - Formula: previous + debit - credit (already calculated in backend) */}
                          <td className={cn(
                            "px-4 py-3 text-sm font-semibold text-right tabular-nums",
                            runningBalanceForSale >= 0 ? "text-yellow-400" : "text-red-400"
                          )}>
                            Rs {runningBalanceForSale.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-400">
                            {entry.branch_name || '-'}
                          </td>
                        </tr>
                      );
                    });
                  });

                  // Render standalone entries (not linked to sales)
                  // Calculate running balance for standalone entries
                  let runningBalanceStandalone = openingBalance;
                  
                  // Add all sales and their entries to running balance first
                  saleGroups.forEach((entries, saleId) => {
                    const saleDetail = saleDetailsMap.get(saleId);
                    const saleTotal = saleDetail?.total || 0;
                    runningBalanceStandalone += saleTotal;
                    entries.forEach(entry => {
                      if (!entry.description?.toLowerCase().includes('commission')) {
                        runningBalanceStandalone += (entry.debit || 0) - (entry.credit || 0);
                      }
                    });
                  });

                  standaloneEntries.forEach((entry, index) => {
                    runningBalanceStandalone += (entry.debit || 0) - (entry.credit || 0);
                    
                    rows.push(
                      <tr
                        key={`standalone-${entry.journal_entry_id}-${index}`}
                        className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {format(new Date(entry.date), 'dd MMM yyyy')}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleReferenceClick(entry)}
                            className="text-blue-400 hover:text-blue-300 hover:underline text-sm font-medium font-mono"
                          >
                            {entry.reference_number}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className="bg-gray-700 text-gray-300 text-xs">
                            {entry.source_module}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">{entry.description}</td>
                        <td className={cn(
                          "px-4 py-3 text-sm text-right tabular-nums",
                          (entry.debit || 0) > 0 ? "text-green-400 font-semibold" : "text-gray-500"
                        )}>
                          {(entry.debit || 0) > 0 ? (
                            <span>Rs {(entry.debit || 0).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}</span>
                          ) : (
                            <span className="text-gray-600">0</span>
                          )}
                        </td>
                        <td className={cn(
                          "px-4 py-3 text-sm text-right tabular-nums",
                          (entry.credit || 0) > 0 ? "text-red-400 font-semibold" : "text-gray-500"
                        )}>
                          {(entry.credit || 0) > 0 ? (
                            <span>Rs {(entry.credit || 0).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}</span>
                          ) : (
                            <span className="text-gray-600">0</span>
                          )}
                        </td>
                        <td className={cn(
                          "px-4 py-3 text-sm font-semibold text-right tabular-nums",
                          runningBalanceStandalone >= 0 ? "text-yellow-400" : "text-red-400"
                        )}>
                          Rs {runningBalanceStandalone.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {entry.branch_name || '-'}
                        </td>
                      </tr>
                    );
                  });

                  return rows;
                })()}

                {/* Closing Balance Row */}
                <tr className="bg-gray-900 font-bold border-t-2 border-blue-500/30">
                  <td colSpan={4} className="px-4 py-3 text-right text-white uppercase text-sm">
                    Closing Balance:
                  </td>
                  {/* CRITICAL FIX: For ASSET account, Charges = DEBIT (green), Payments = CREDIT (red) */}
                  <td className="px-4 py-3 text-right text-green-400 text-lg">
                    Rs {totals.totalCharges.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3 text-right text-red-400 text-lg">
                    Rs {totals.totalPayments.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  {/* CRITICAL FIX: For ASSET account, positive = receivable (yellow), negative = credit balance (red) */}
                  <td className={cn(
                    "px-4 py-3 text-right text-2xl font-bold",
                    closingBalance >= 0 ? "text-yellow-400" : "text-red-400"
                  )}>
                    Rs {closingBalance.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Aging Report - Screen View Only */}
      <div className="bg-gray-900 border-t border-gray-800 px-6 py-4 no-print">
        <h2 className="text-lg font-bold mb-4">Aging Report</h2>
        <div className="grid grid-cols-6 gap-4 text-sm">
          <div>
            <p className="text-gray-400 mb-1">Current</p>
            <p className="text-white font-semibold">Rs {agingReport.current.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-gray-400 mb-1">1-30 Days</p>
            <p className="text-yellow-400 font-semibold">Rs {agingReport.days30.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-gray-400 mb-1">30-60 Days</p>
            <p className="text-orange-400 font-semibold">Rs {agingReport.days60.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-gray-400 mb-1">60-90 Days</p>
            <p className="text-red-400 font-semibold">Rs {agingReport.days90.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-gray-400 mb-1">Over 90 Days</p>
            <p className="text-red-600 font-semibold">Rs {agingReport.over90.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-gray-400 mb-1">Total Due</p>
            <p className="text-white font-bold text-lg">Rs {agingReport.total.toFixed(2)}</p>
          </div>
        </div>
      </div>

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
