// ============================================
// 🎯 SALES CONTEXT
// ============================================
// Manages sales, quotations, and invoices with auto-numbering

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useDocumentNumbering } from '@/app/hooks/useDocumentNumbering';
import { useAccounting } from '@/app/context/AccountingContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { saleService, Sale as SupabaseSale, SaleItem as SupabaseSaleItem } from '@/app/services/saleService';
import { productService } from '@/app/services/productService';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

export type PaymentStatus = 'paid' | 'partial' | 'unpaid';
export type ShippingStatus = 'delivered' | 'processing' | 'pending' | 'cancelled';
export type SaleType = 'invoice' | 'quotation';

export interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  price: number;
  discount: number;
  tax: number;
  total: number;
  variationId?: string; // CRITICAL FIX: Add variationId for variation tracking
}

export interface Sale {
  id: string;
  invoiceNo: string;
  type: SaleType;
  status?: 'draft' | 'quotation' | 'order' | 'final'; // CRITICAL FIX: Add status field
  customer: string;
  customerName: string;
  contactNumber: string;
  date: string;
  location: string;
  items: SaleItem[];
  itemsCount: number;
  subtotal: number;
  discount: number;
  tax: number;
  expenses: number;
  total: number;
  paid: number;
  due: number;
  returnDue: number;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  shippingStatus: ShippingStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface SalesContextType {
  sales: Sale[];
  loading: boolean;
  getSaleById: (id: string) => Sale | undefined;
  createSale: (sale: Omit<Sale, 'id' | 'invoiceNo' | 'createdAt' | 'updatedAt'>) => Promise<Sale>;
  updateSale: (id: string, updates: Partial<Sale>) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  recordPayment: (saleId: string, amount: number, method: string, accountId?: string) => Promise<void>;
  updateShippingStatus: (saleId: string, status: ShippingStatus) => Promise<void>;
  convertQuotationToInvoice: (quotationId: string) => Promise<Sale>;
  refreshSales: () => Promise<void>;
}

// ============================================
// CONTEXT
// ============================================

const SalesContext = createContext<SalesContextType | undefined>(undefined);

export const useSales = () => {
  const context = useContext(SalesContext);
  if (!context) {
    // During hot reload in development, context might not be available
    // Return a safe default to prevent crashes
    if (import.meta.env.DEV) {
      console.warn('[SalesContext] useSales called outside SalesProvider, returning default context');
      const defaultError = () => { throw new Error('SalesProvider not available'); };
      return {
        sales: [],
        loading: false,
        getSaleById: () => undefined,
        createSale: defaultError,
        updateSale: defaultError,
        deleteSale: defaultError,
        recordPayment: defaultError,
        updateShippingStatus: defaultError,
        convertQuotationToInvoice: defaultError,
        refreshSales: async () => {},
      } as SalesContextType;
    }
    throw new Error('useSales must be used within SalesProvider');
  }
  return context;
};

// ============================================
// MOCK DATA (Initial)
// ============================================

const INITIAL_SALES: Sale[] = [
  {
    id: 'sale-1',
    invoiceNo: 'INV-0001',
    type: 'invoice',
    customer: 'Ahmed Retailers',
    customerName: 'Ahmed Ali',
    contactNumber: '+92-300-1234567',
    date: '2024-01-15',
    location: 'Main Branch (HQ)',
    items: [],
    itemsCount: 12,
    subtotal: 45000,
    discount: 0,
    tax: 0,
    expenses: 500,
    total: 45500,
    paid: 45500,
    due: 0,
    returnDue: 0,
    paymentStatus: 'paid',
    paymentMethod: 'Cash',
    shippingStatus: 'delivered',
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
  },
  {
    id: 'sale-2',
    invoiceNo: 'INV-0002',
    type: 'invoice',
    customer: 'Walk-in Customer',
    customerName: 'Sara Khan',
    contactNumber: '+92-321-9876543',
    date: '2024-01-15',
    location: 'Mall Outlet',
    items: [],
    itemsCount: 3,
    subtotal: 8000,
    discount: 0,
    tax: 0,
    expenses: 200,
    total: 8200,
    paid: 5000,
    due: 3200,
    returnDue: 0,
    paymentStatus: 'partial',
    paymentMethod: 'Card',
    shippingStatus: 'pending',
    createdAt: '2024-01-15T11:00:00Z',
    updatedAt: '2024-01-15T11:00:00Z',
  },
  {
    id: 'sale-3',
    invoiceNo: 'QUO-0001',
    type: 'quotation',
    customer: 'Local Store',
    customerName: 'Bilal Ahmed',
    contactNumber: '+92-333-5555555',
    date: '2024-01-14',
    location: 'Main Branch (HQ)',
    items: [],
    itemsCount: 24,
    subtotal: 98000,
    discount: 0,
    tax: 0,
    expenses: 1200,
    total: 99200,
    paid: 0,
    due: 99200,
    returnDue: 0,
    paymentStatus: 'unpaid',
    paymentMethod: 'Credit',
    shippingStatus: 'pending',
    createdAt: '2024-01-14T14:20:00Z',
    updatedAt: '2024-01-14T14:20:00Z',
  },
];

// ============================================
// PROVIDER
// ============================================

// Helper function to normalize payment method to enum values
// Returns lowercase enum values: 'cash', 'bank', 'card', 'other'
const normalizePaymentMethodForEnum = (method: string | undefined): string => {
  if (!method) return 'cash';
  const normalized = method.toLowerCase().trim();
  const enumMap: Record<string, string> = {
    'cash': 'cash',
    'Cash': 'cash',
    'bank': 'bank',
    'Bank': 'bank',
    'card': 'card',
    'Card': 'card',
    'cheque': 'other',
    'Cheque': 'other',
    'mobile wallet': 'other',
    'Mobile Wallet': 'other',
    'wallet': 'other',
    'Wallet': 'other',
  };
  return enumMap[method] || enumMap[normalized] || 'cash';
};

export const SalesProvider = ({ children }: { children: ReactNode }) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const { generateDocumentNumber, incrementNextNumber } = useDocumentNumbering();
  const accounting = useAccounting();
  const { companyId, branchId, user } = useSupabase();

  // Convert Supabase sale format to app format
  const convertFromSupabaseSale = useCallback((supabaseSale: any): Sale => {
    // Resolve branch display: use joined branch data if available
    // UI Rule: Show only branch NAME (not code, never UUID)
    let locationDisplay = '';
    if (supabaseSale.branch) {
      // Branch data joined from API - show NAME only
      locationDisplay = supabaseSale.branch.name || '';
    }
    // Note: Do NOT fallback to branch_id UUID - it should never appear in UI
    
    return {
      id: supabaseSale.id,
      invoiceNo: supabaseSale.invoice_no || '',
      type: supabaseSale.status === 'quotation' ? 'quotation' : 'invoice',
      status: supabaseSale.status || (supabaseSale.type === 'invoice' ? 'final' : 'quotation'), // CRITICAL FIX: Include status
      customer: supabaseSale.customer_id || '',
      customerName: supabaseSale.customer_name || '',
      contactNumber: supabaseSale.customer?.phone || '',
      date: supabaseSale.invoice_date || new Date().toISOString().split('T')[0],
      location: locationDisplay, // NOW uses resolved branch name/code instead of raw UUID
      items: (supabaseSale.items || []).map((item: any) => ({
        id: item.id || '',
        productId: item.product_id || '',
        productName: item.product_name || '',
        sku: item.sku || item.product?.sku || 'N/A',
        quantity: item.quantity || 0,
        price: item.unit_price || 0,
        discount: item.discount_amount || 0,
        tax: item.tax_amount || 0,
        total: item.total || 0,
        variationId: item.variation_id || undefined, // CRITICAL FIX: Include variationId
      })),
      itemsCount: supabaseSale.items?.length || 0,
      subtotal: supabaseSale.subtotal || 0,
      discount: supabaseSale.discount_amount || 0,
      tax: supabaseSale.tax_amount || 0,
      expenses: supabaseSale.expenses || supabaseSale.shipping_charges || 0,
      total: supabaseSale.total || 0,
      paid: supabaseSale.paid_amount || 0,
      due: supabaseSale.due_amount || 0,
      returnDue: supabaseSale.return_due || 0,
      paymentStatus: supabaseSale.payment_status || 'unpaid',
      paymentMethod: supabaseSale.payment_method || 'Cash',
      shippingStatus: supabaseSale.shipping_status || 'pending',
      notes: supabaseSale.notes,
      createdAt: supabaseSale.created_at || new Date().toISOString(),
      updatedAt: supabaseSale.updated_at || new Date().toISOString(),
    };
  }, []);

  // Load sales from database
  const loadSales = useCallback(async () => {
    if (!companyId) return;
    
    try {
      setLoading(true);
      const data = await saleService.getAllSales(companyId, branchId || undefined);
      setSales(data.map(convertFromSupabaseSale));
    } catch (error) {
      console.error('[SALES CONTEXT] Error loading sales:', error);
      toast.error('Failed to load sales');
      // Fallback to empty array on error
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, convertFromSupabaseSale]);

  // Load sales from Supabase on mount
  useEffect(() => {
    if (companyId) {
      loadSales();
    } else {
      setLoading(false);
    }
  }, [companyId, loadSales]);

  // Get sale by ID
  const getSaleById = (id: string): Sale | undefined => {
    return sales.find(s => s.id === id);
  };

  // Create new sale
  const createSale = async (saleData: Omit<Sale, 'id' | 'invoiceNo' | 'createdAt' | 'updatedAt'>): Promise<Sale> => {
    if (!companyId || !branchId || !user) {
      throw new Error('Company ID, Branch ID, and User are required');
    }

    try {
      // CRITICAL FIX: Generate document number based on sale status/type
      // Draft → DRAFT-XXX, Quotation → QT-XXX, Order → SO-XXX, Final → INV-XXX
      let docType: 'draft' | 'quotation' | 'order' | 'invoice' = 'invoice';
      if (saleData.status === 'draft') {
        docType = 'draft';
      } else if (saleData.status === 'quotation') {
        docType = 'quotation';
      } else if (saleData.status === 'order') {
        docType = 'order';
      } else if (saleData.type === 'invoice' || saleData.status === 'final') {
        docType = 'invoice';
      }
      
      const invoiceNo = generateDocumentNumber(docType);
      
      // Validate invoice number is not undefined
      if (!invoiceNo || invoiceNo.includes('undefined') || invoiceNo.includes('NaN')) {
        throw new Error(`Invalid invoice number generated: ${invoiceNo}. Check document numbering settings.`);
      }
      
      // Convert to Supabase format
      const supabaseSale: SupabaseSale = {
        company_id: companyId,
        branch_id: branchId,
        invoice_no: invoiceNo,
        invoice_date: saleData.date,
        customer_id: saleData.customer || undefined,
        customer_name: saleData.customerName,
        type: saleData.type === 'invoice' ? 'invoice' : 'quotation',
        status: saleData.status || (saleData.type === 'invoice' ? 'final' : 'quotation'), // Use status from saleData if provided
        payment_status: saleData.paymentStatus,
        payment_method: saleData.paymentMethod ? normalizePaymentMethodForEnum(saleData.paymentMethod) : undefined,
        subtotal: saleData.subtotal,
        discount_amount: saleData.discount || 0,
        tax_amount: saleData.tax || 0,
        expenses: saleData.expenses || 0, // Database has 'expenses' not 'shipping_charges'
        total: saleData.total,
        paid_amount: saleData.paid || 0,
        due_amount: saleData.due || 0,
        return_due: saleData.returnDue || 0,
        notes: saleData.notes,
        created_by: user.id,
      };

      const supabaseItems: SupabaseSaleItem[] = saleData.items.map(item => ({
        product_id: item.productId,
        variation_id: item.variationId || undefined,
        product_name: item.productName,
        sku: (item as any).sku || 'N/A', // Required in DB
        quantity: item.quantity,
        unit: (item as any).unit || 'piece',
        unit_price: item.price,
        discount_percentage: (item as any).discountPercentage || 0,
        discount_amount: (item as any).discount || 0,
        tax_percentage: (item as any).taxPercentage || 0,
        tax_amount: (item as any).tax || 0,
        total: item.total,
        // Include packing data
        packing_type: (item as any).packingDetails?.packing_type || null,
        packing_quantity: (item as any).packingDetails?.total_meters || (item as any).meters || null,
        packing_unit: (item as any).packingDetails?.unit || 'meters',
        packing_details: (item as any).packingDetails || null,
      }));

      // Save to Supabase
      const result = await saleService.createSale(supabaseSale, supabaseItems);
      
      // Increment document number
      incrementNextNumber(docType);
      
      // Convert back to app format
      const newSale = convertFromSupabaseSale(result);
      
      // CRITICAL FIX: Record initial payment if sale has paid_amount > 0
      // NOTE: SQL trigger will also try to create this, so we check if it already exists
      if (newSale.paid > 0 && companyId && branchId && user) {
        try {
          // CRITICAL FIX: Check if payment already exists (from SQL trigger)
          // If trigger created it, we only need to create journal entry
          // If not, we create both payment and journal entry
          const { supabase } = await import('@/lib/supabase');
          const { data: existingPayment } = await supabase
            .from('payments')
            .select('id, payment_account_id')
            .eq('reference_type', 'sale')
            .eq('reference_id', newSale.id)
            .eq('amount', newSale.paid)
            .limit(1)
            .maybeSingle();
          
          const paymentMethod = normalizePaymentMethodForEnum(saleData.paymentMethod || 'cash');
          let paymentAccountId: string | null = null;
          
          if (existingPayment) {
            // Payment already exists from trigger, use its account_id
            paymentAccountId = existingPayment.payment_account_id;
          } else {
            // Payment doesn't exist, create it
            const { accountHelperService } = await import('@/app/services/accountHelperService');
            paymentAccountId = await accountHelperService.getDefaultAccountByPaymentMethod(
              paymentMethod,
              companyId
            );
            
            // If no account found, use Cash as default
            if (!paymentAccountId) {
              const { accountService } = await import('@/app/services/accountService');
              const allAccounts = await accountService.getAllAccounts(companyId);
              const cashAccount = allAccounts.find(acc => acc.code === '1000');
              paymentAccountId = cashAccount?.id || null;
            }
            
            if (paymentAccountId) {
              // Record initial payment (reference will be auto-generated by trigger)
              const { saleService } = await import('@/app/services/saleService');
              await saleService.recordPayment(
                newSale.id,
                newSale.paid,
                paymentMethod,
                paymentAccountId,
                companyId,
                branchId,
                saleData.date
                // Reference number will be auto-generated by trigger
              );
            }
          }
          
          // Create journal entry for initial payment (whether payment existed or was just created)
          if (paymentAccountId) {
            accounting.recordSalePayment({
              saleId: newSale.id,
              invoiceNo: newSale.invoiceNo,
              customerName: newSale.customerName,
              amount: newSale.paid,
              paymentMethod: paymentMethod as any,
              accountId: paymentAccountId,
            });
          }
        } catch (error: any) {
          console.error('[SALES CONTEXT] Error recording initial payment:', error);
          // Don't fail sale creation if payment recording fails
        }
      }
      
      // Update local state
      setSales(prev => [newSale, ...prev]);
      
      // If sale is invoice (status = final), decrement stock
      if (newSale.type === 'invoice' && newSale.items && newSale.items.length > 0) {
        try {
          for (const item of newSale.items) {
            if (item.productId && item.quantity > 0) {
              const product = await productService.getProduct(item.productId);
              if (product) {
                // Decrement stock
                const newStock = Math.max(0, (product.current_stock || 0) - item.quantity);
                await productService.updateProduct(item.productId, {
                  current_stock: newStock
                });
              }
            }
          }
        } catch (stockError) {
          console.warn('[SALES CONTEXT] Stock update warning (non-blocking):', stockError);
          // Don't block sale creation if stock update fails
        }
      }
      
      // CRITICAL FIX: Create accounting entries for discount, commission, and extra expenses
      // Only for final invoices
      if (newSale.type === 'invoice' && newSale.status === 'final') {
        try {
          const { supabase } = await import('@/lib/supabase');
          
          // Handle discount
          if (saleData.discount && saleData.discount > 0) {
            const { error: discountError } = await supabase.rpc('create_discount_journal_entry', {
              p_sale_id: newSale.id,
              p_company_id: companyId,
              p_branch_id: branchId,
              p_discount_amount: saleData.discount,
              p_invoice_no: newSale.invoiceNo
            });
            if (discountError) {
              console.error('[SALES CONTEXT] Error creating discount journal entry:', discountError);
            }
          }
          
          // Handle commission (if provided in saleData)
          const commissionAmount = (saleData as any).commissionAmount || 0;
          if (commissionAmount > 0) {
            const salesmanId = (saleData as any).salesmanId || null;
            const { error: commissionError } = await supabase.rpc('create_commission_journal_entry', {
              p_sale_id: newSale.id,
              p_company_id: companyId,
              p_branch_id: branchId,
              p_commission_amount: commissionAmount,
              p_salesperson_id: salesmanId,
              p_invoice_no: newSale.invoiceNo
            });
            if (commissionError) {
              console.error('[SALES CONTEXT] Error creating commission journal entry:', commissionError);
            }
          }
          
          // Handle extra expenses
          const extraExpenses = (saleData as any).extraExpenses || [];
          for (const expense of extraExpenses) {
            if (expense.amount > 0) {
              const { error: expenseError } = await supabase.rpc('create_extra_expense_journal_entry', {
                p_sale_id: newSale.id,
                p_company_id: companyId,
                p_branch_id: branchId,
                p_expense_amount: expense.amount,
                p_expense_name: expense.name || 'Extra Expense',
                p_invoice_no: newSale.invoiceNo
              });
              if (expenseError) {
                console.error('[SALES CONTEXT] Error creating extra expense journal entry:', expenseError);
              }
            }
          }
        } catch (error: any) {
          console.error('[SALES CONTEXT] Error creating accounting entries:', error);
          // Don't fail sale creation if accounting entries fail
        }
      }
      
      // CRITICAL FIX: Auto-post to accounting ONLY if invoice (final) and paid
      // Draft/Quotation should NOT create accounting entries
      if (newSale.type === 'invoice' && newSale.status === 'final' && newSale.paid > 0) {
        try {
          await accounting.recordSalePayment({
            saleId: newSale.id, // CRITICAL FIX: UUID for reference_id
            invoiceNo: newSale.invoiceNo, // Invoice number for referenceNo
            customerName: newSale.customerName,
            amount: newSale.paid,
            paymentMethod: newSale.paymentMethod as any,
          });
        } catch (accountingError) {
          console.warn('[SALES CONTEXT] Accounting entry creation warning (non-blocking):', accountingError);
          // Don't block sale creation if accounting fails
        }
      }

      toast.success(`${docType === 'invoice' ? 'Invoice' : 'Quotation'} ${invoiceNo} created successfully!`);
      
      return newSale;
    } catch (error: any) {
      console.error('[SALES CONTEXT] Error creating sale:', error);
      toast.error(`Failed to create sale: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };

  // Update sale
  const updateSale = async (id: string, updates: Partial<Sale>): Promise<void> => {
    try {
      // Convert updates to Supabase format
      const supabaseUpdates: any = {};
      if (updates.status !== undefined) supabaseUpdates.status = updates.status === 'invoice' ? 'final' : 'quotation';
      if (updates.paymentStatus !== undefined) supabaseUpdates.payment_status = updates.paymentStatus;
      if (updates.total !== undefined) supabaseUpdates.total = updates.total;
      if (updates.paid !== undefined) supabaseUpdates.paid_amount = updates.paid;
      if (updates.due !== undefined) supabaseUpdates.due_amount = updates.due;

      // If status is changing to invoice (final), decrement stock
      const sale = getSaleById(id);
      if (sale && updates.status === 'invoice' && sale.type !== 'invoice' && sale.items) {
        try {
          for (const item of sale.items) {
            if (item.productId && item.quantity > 0) {
              const product = await productService.getProduct(item.productId);
              if (product) {
                // Decrement stock
                const newStock = Math.max(0, (product.current_stock || 0) - item.quantity);
                await productService.updateProduct(item.productId, {
                  current_stock: newStock
                });
              }
            }
          }
        } catch (stockError) {
          console.warn('[SALES CONTEXT] Stock update warning (non-blocking):', stockError);
          // Don't block update if stock update fails
        }
      }

      // Update in Supabase
      await saleService.updateSaleStatus(id, supabaseUpdates.status || 'final');
      
      // Update local state
      setSales(prev => prev.map(sale => 
        sale.id === id 
          ? { ...sale, ...updates, updatedAt: new Date().toISOString() }
          : sale
      ));
      
      toast.success('Sale updated successfully!');
    } catch (error: any) {
      console.error('[SALES CONTEXT] Error updating sale:', error);
      toast.error(`Failed to update sale: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };

  // Delete sale
  const deleteSale = async (id: string): Promise<void> => {
    const sale = getSaleById(id);
    if (!sale) {
      throw new Error('Sale not found');
    }

    try {
      // CRITICAL FIX: Use hard delete since 'cancelled' status doesn't exist in enum
      // sale_status enum only supports: draft, quotation, order, final
      await saleService.deleteSale(id);
      
      // Update local state
      setSales(prev => prev.filter(s => s.id !== id));
      toast.success(`${sale.invoiceNo} deleted successfully!`);
    } catch (error: any) {
      console.error('[SALES CONTEXT] Error deleting sale:', error);
      toast.error(`Failed to delete sale: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };

  // Record payment
  const recordPayment = async (saleId: string, amount: number, method: string, accountId?: string): Promise<void> => {
    const sale = getSaleById(saleId);
    if (!sale || !companyId || !branchId) {
      throw new Error('Sale not found or company/branch missing');
    }

    try {
      // CRITICAL FIX: Get account ID from payment method if not provided
      let paymentAccountId = accountId;
      
      if (!paymentAccountId && companyId) {
        const { accountHelperService } = await import('@/app/services/accountHelperService');
        paymentAccountId = await accountHelperService.getDefaultAccountByPaymentMethod(
          method,
          companyId
        ) || null;
      }
      
      // If still no account, throw error
      if (!paymentAccountId) {
        throw new Error(`No account found for ${method} payment. Please create a default account.`);
      }
      
      // CRITICAL FIX: Record payment in Supabase (with account_id)
      // This will trigger update_sale_payment_totals() which auto-updates paid/due amounts
      await saleService.recordPayment(saleId, amount, method, paymentAccountId, companyId, branchId);

      // CRITICAL FIX: Reload sale to get updated paid/due amounts from database (trigger updated them)
      // Don't manually calculate - let database trigger handle it
      const updatedSaleData = await saleService.getSaleById(saleId);
      if (updatedSaleData) {
        const updatedSale = convertFromSupabaseSale(updatedSaleData);
        setSales(prev => prev.map(s => s.id === saleId ? updatedSale : s));
      }

      // CRITICAL FIX: Create journal entry ONLY (payment already recorded above)
      // DO NOT call recordPayment again - it's already done
      accounting.recordSalePayment({
        saleId: sale.id, // CRITICAL FIX: UUID for reference_id
        invoiceNo: sale.invoiceNo, // Invoice number for referenceNo
        customerName: sale.customerName,
        amount,
        paymentMethod: method as any,
        accountId: paymentAccountId, // CRITICAL: Pass account ID
      });

      toast.success(`Payment of Rs. ${amount.toLocaleString()} recorded!`);
    } catch (error: any) {
      console.error('[SALES CONTEXT] Error recording payment:', error);
      toast.error(`Failed to record payment: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };

  // Update shipping status
  const updateShippingStatus = async (saleId: string, status: ShippingStatus): Promise<void> => {
    const sale = getSaleById(saleId);
    if (!sale) {
      throw new Error('Sale not found');
    }

    try {
      await updateSale(saleId, { shippingStatus: status });
      toast.success(`Shipping status updated to ${status}!`);
    } catch (error) {
      throw error;
    }
  };

  // Convert quotation to invoice
  const convertQuotationToInvoice = async (quotationId: string): Promise<Sale> => {
    const quotation = getSaleById(quotationId);
    if (!quotation || quotation.type !== 'quotation') {
      throw new Error('Invalid quotation');
    }

    try {
      // Update status in Supabase
      await saleService.updateSaleStatus(quotationId, 'final');
      
      // Decrement stock when converting to invoice
      if (quotation.items && quotation.items.length > 0) {
        try {
          for (const item of quotation.items) {
            if (item.productId && item.quantity > 0) {
              const product = await productService.getProduct(item.productId);
              if (product) {
                // Decrement stock
                const newStock = Math.max(0, (product.current_stock || 0) - item.quantity);
                await productService.updateProduct(item.productId, {
                  current_stock: newStock
                });
              }
            }
          }
        } catch (stockError) {
          console.warn('[SALES CONTEXT] Stock update warning (non-blocking):', stockError);
          // Don't block conversion if stock update fails
        }
      }
      
      // Generate new invoice number
      const invoiceNo = generateDocumentNumber('invoice');
      
      // Update local state
      const invoice: Sale = {
        ...quotation,
        invoiceNo,
        type: 'invoice',
        updatedAt: new Date().toISOString(),
      };

      setSales(prev => prev.map(s => s.id === quotationId ? invoice : s));
      incrementNextNumber('invoice');

      toast.success(`Quotation ${quotation.invoiceNo} converted to Invoice ${invoiceNo}!`);
      
      return invoice;
    } catch (error: any) {
      console.error('[SALES CONTEXT] Error converting quotation:', error);
      toast.error(`Failed to convert quotation: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };

  const value: SalesContextType = {
    sales,
    loading,
    getSaleById,
    createSale,
    updateSale,
    deleteSale,
    recordPayment,
    updateShippingStatus,
    convertQuotationToInvoice,
    refreshSales: loadSales,
  };

  return (
    <SalesContext.Provider value={value}>
      {children}
    </SalesContext.Provider>
  );
};
