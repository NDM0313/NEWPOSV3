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
import { branchService } from '@/app/services/branchService';
import { toast } from 'sonner';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidBranchId(id: string | null): id is string {
  return !!id && UUID_REGEX.test(id);
}

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
  variationId?: string; // Backend variation id - for ledger/reporting/stock
  /** Unit from backend (sales_items.unit): piece, box, meters, etc. */
  unit?: string;
  /** Packing from backend (sales_items.packing_*) - for display/reports */
  packingDetails?: { packing_type?: string; packing_quantity?: number; packing_unit?: string; [k: string]: unknown };
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
  shippingCharges?: number; // For backward compatibility
  otherCharges?: number; // Extra charges beyond shipping
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
  is_studio?: boolean;
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

// CRITICAL FIX: Export convertFromSupabaseSale as a standalone function
// This allows it to be used outside the context provider
export const convertFromSupabaseSale = (supabaseSale: any): Sale => {
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
    status: supabaseSale.status || (supabaseSale.type === 'invoice' ? 'final' : 'quotation'),
    customer: supabaseSale.customer_id || '',
    customerName: supabaseSale.customer_name || '',
    contactNumber: supabaseSale.customer?.phone || '',
    date: supabaseSale.invoice_date || new Date().toISOString().split('T')[0],
    location: locationDisplay,
    items: (supabaseSale.items || []).map((item: any) => {
      // Packing: single source of truth from backend – pre-fill modal on edit (no zero/blank)
      const pd = item.packing_details;
      const packingDetails = pd
        ? { ...pd, total_boxes: pd.total_boxes ?? 0, total_pieces: pd.total_pieces ?? 0, total_meters: pd.total_meters ?? item.packing_quantity ?? 0, boxes: pd.boxes || [] }
        : (item.packing_quantity != null && item.packing_quantity !== '')
          ? { total_boxes: 0, total_pieces: 0, total_meters: Number(item.packing_quantity) || 0, boxes: [] as any[] }
          : undefined;
      return {
        id: item.id || '',
        productId: item.product_id || '',
        productName: item.product_name || '',
        sku: item.sku || item.product?.sku || 'N/A',
        quantity: item.quantity || 0,
        price: item.unit_price || 0,
        discount: item.discount_amount || 0,
        tax: item.tax_amount || 0,
        total: item.total || 0,
        variationId: item.variation_id || undefined,
        unit: item.unit || undefined,
        size: item.variation?.size || item.size || undefined,
        color: item.variation?.color || item.color || undefined,
        packingDetails: packingDetails ?? undefined,
        thaans: packingDetails?.total_boxes ?? item.packing_details?.thaans,
        meters: packingDetails?.total_meters ?? item.packing_quantity ?? undefined,
      };
    }),
    itemsCount: supabaseSale.items?.length || 0,
    subtotal: supabaseSale.subtotal || 0,
    discount: supabaseSale.discount_amount || 0,
    tax: supabaseSale.tax_amount || 0,
    expenses: supabaseSale.expenses || supabaseSale.shipping_charges || 0,
    shippingCharges: supabaseSale.expenses || supabaseSale.shipping_charges || 0, // Map expenses to shippingCharges for UI
    otherCharges: supabaseSale.other_charges || 0, // Extra charges if any
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
    is_studio: !!supabaseSale.is_studio,
  };
};

export const SalesProvider = ({ children }: { children: ReactNode }) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const { generateDocumentNumber, incrementNextNumber } = useDocumentNumbering();
  const accounting = useAccounting();
  const { companyId, branchId, user } = useSupabase();

  // Load sales from database
  const loadSales = useCallback(async () => {
    if (!companyId) return;
    
    try {
      setLoading(true);
      const data = await saleService.getAllSales(companyId, branchId === 'all' ? undefined : branchId || undefined);
      setSales(data.map(convertFromSupabaseSale));
    } catch (error) {
      console.error('[SALES CONTEXT] Error loading sales:', error);
      toast.error('Failed to load sales');
      // Fallback to empty array on error
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId]);

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
    if (!companyId || !user) {
      throw new Error('Company ID and User are required');
    }
    // DB requires branch_id UUID; when Admin has "All Branches", branchId is 'all' – resolve to first branch
    let effectiveBranchId = isValidBranchId(branchId) ? branchId : null;
    if (!effectiveBranchId) {
      const branches = await branchService.getAllBranches(companyId);
      if (!branches?.length) throw new Error('No branch found. Please create at least one branch.');
      effectiveBranchId = branches[0].id;
    }

    try {
      // CRITICAL FIX: Generate document number based on sale source + status
      // POS → POS-0001, Studio → STD-0001, Draft → DRAFT-0001, Quotation → QT-0001, Order → SO-0001, Final (regular) → INV-0001
      const isPOS = (saleData as any).isPOS === true;
      const isStudioSale = (saleData as any).isStudioSale === true;
      let docType: 'draft' | 'quotation' | 'order' | 'invoice' | 'pos' | 'studio' = 'invoice';
      if (isPOS) {
        docType = 'pos';
      } else if (isStudioSale) {
        docType = 'studio';
      } else if (saleData.status === 'draft') {
        docType = 'draft';
      } else if (saleData.status === 'quotation') {
        docType = 'quotation';
      } else if (saleData.status === 'order') {
        docType = 'order';
      } else if (saleData.type === 'invoice' || saleData.status === 'final') {
        docType = 'invoice';
      }
      // Use form-provided invoice number when present (Form already generated STD-XXXX / DRAFT-XXXX etc.) to avoid double-increment
      const formInvoiceNo = (saleData as any).invoiceNo as string | undefined;
      const invoiceNo = (typeof formInvoiceNo === 'string' && formInvoiceNo && !formInvoiceNo.includes('undefined'))
        ? formInvoiceNo
        : generateDocumentNumber(docType);
      const weGeneratedNumber = !formInvoiceNo;
      if (!invoiceNo || invoiceNo.includes('undefined') || invoiceNo.includes('NaN')) {
        throw new Error(`Invalid invoice number generated: ${invoiceNo}. Check document numbering settings.`);
      }
      // Convert to Supabase format (use effectiveBranchId – valid UUID for DB)
      const supabaseSale: SupabaseSale = {
        company_id: companyId,
        branch_id: effectiveBranchId,
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
        // Do not send is_studio in insert – column may not exist yet; set via update after create
      };

      const supabaseItems: SupabaseSaleItem[] = saleData.items.map(item => {
        const unitPrice = Number((item as any).unitPrice ?? item.price ?? 0);
        const lineTotal = Number((item as any).total ?? (unitPrice * item.quantity) ?? 0);
        return {
        product_id: item.productId,
        variation_id: item.variationId || undefined,
        product_name: item.productName,
        sku: (item as any).sku || 'N/A', // Required in DB
        quantity: item.quantity,
        unit: (item as any).packingDetails ? ((item as any).packingDetails?.unit || 'meters') : ((item as any).unit || 'piece'),
        unit_price: unitPrice, // POS sends unitPrice; SaleForm sends price – ensure never null for DB NOT NULL
        discount_percentage: (item as any).discountPercentage || 0,
        discount_amount: (item as any).discount || 0,
        tax_percentage: (item as any).taxPercentage || 0,
        tax_amount: (item as any).tax || 0,
        total: lineTotal,
        // Include packing data
        packing_type: (item as any).packingDetails?.packing_type || null,
        packing_quantity: (item as any).packingDetails?.total_meters || (item as any).meters || null,
        packing_unit: (item as any).packingDetails?.unit || 'meters',
        packing_details: (item as any).packingDetails || null,
      };
      });

      const result = await saleService.createSale(supabaseSale, supabaseItems);
      // Set is_studio after create (avoids 400 if sales.is_studio column not yet added by migration)
      if (isStudioSale && result?.id) {
        try {
          const { supabase: sb } = await import('@/lib/supabase');
          await sb.from('sales').update({ is_studio: true }).eq('id', result.id);
        } catch (_) { /* column may not exist */ }
      }
      // Only increment when we generated the number (Form did not send invoiceNo); Form already increments when it sends number
      if (weGeneratedNumber) incrementNextNumber(docType);
      
      // Convert back to app format
      const newSale = convertFromSupabaseSale(result);
      
      // CRITICAL FIX: Record MULTIPLE payments if partialPayments array exists
      // Each payment method = separate payment record = separate reference number = separate journal entry
      const partialPayments = (saleData as any).partialPayments || [];
      
      if (newSale.paid > 0 && companyId && effectiveBranchId && user) {
        try {
          const { accountHelperService } = await import('@/app/services/accountHelperService');
          const { saleService } = await import('@/app/services/saleService');
          const { accountService } = await import('@/app/services/accountService');
          
          // CRITICAL FIX: If partialPayments array exists, split into separate payments
          if (partialPayments.length > 0) {
            // Split payments: each method gets its own payment record
            for (const partialPayment of partialPayments) {
              const paymentMethod = normalizePaymentMethodForEnum(partialPayment.method || 'cash');
              
              // Get account for this payment method
              let paymentAccountId = await accountHelperService.getDefaultAccountByPaymentMethod(
                paymentMethod,
                companyId
              );
              
              // If no account found, use Cash as default
              if (!paymentAccountId) {
                const allAccounts = await accountService.getAllAccounts(companyId);
                const cashAccount = allAccounts.find(acc => acc.code === '1000');
                paymentAccountId = cashAccount?.id || null;
              }
              
              if (paymentAccountId && partialPayment.amount > 0) {
                // Record separate payment (reference will be auto-generated by trigger)
                await saleService.recordPayment(
                  newSale.id,
                  partialPayment.amount,
                  paymentMethod,
                  paymentAccountId,
                  companyId,
                  effectiveBranchId,
                  saleData.date
                  // Reference number will be auto-generated by trigger
                );
                
                // Create separate journal entry for this payment
                accounting.recordSalePayment({
                  saleId: newSale.id,
                  invoiceNo: newSale.invoiceNo,
                  customerName: newSale.customerName,
                  amount: partialPayment.amount,
                  paymentMethod: paymentMethod as any,
                  accountId: paymentAccountId,
                });
              }
            }
          } else {
            // Fallback: Single payment (backward compatibility)
            const paymentMethod = normalizePaymentMethodForEnum(saleData.paymentMethod || 'cash');
            let paymentAccountId: string | null = null;
            
            // Check if payment already exists (from SQL trigger)
            const { supabase } = await import('@/lib/supabase');
            const { data: existingPayment } = await supabase
              .from('payments')
              .select('id, payment_account_id')
              .eq('reference_type', 'sale')
              .eq('reference_id', newSale.id)
              .eq('amount', newSale.paid)
              .limit(1)
              .maybeSingle();
            
            if (existingPayment) {
              // Payment already exists from trigger, use its account_id
              paymentAccountId = existingPayment.payment_account_id;
            } else {
              // Payment doesn't exist, create it
              paymentAccountId = await accountHelperService.getDefaultAccountByPaymentMethod(
                paymentMethod,
                companyId
              );
              
              // If no account found, use Cash as default
              if (!paymentAccountId) {
                const allAccounts = await accountService.getAllAccounts(companyId);
                const cashAccount = allAccounts.find(acc => acc.code === '1000');
                paymentAccountId = cashAccount?.id || null;
              }
              
              if (paymentAccountId) {
                // Record initial payment (reference will be auto-generated by trigger)
                await saleService.recordPayment(
                  newSale.id,
                  newSale.paid,
                  paymentMethod,
                  paymentAccountId,
                  companyId,
                  effectiveBranchId,
                  saleData.date
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
              p_branch_id: effectiveBranchId,
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
              p_branch_id: effectiveBranchId,
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
                p_branch_id: effectiveBranchId,
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

      const createdLabel = docType === 'pos' ? 'POS sale' : docType === 'invoice' ? 'Invoice' : docType === 'quotation' ? 'Quotation' : docType === 'order' ? 'Order' : 'Draft';
      toast.success(`${createdLabel} ${invoiceNo} created successfully!`);
      
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
      // CRITICAL FIX: Handle full sale update (not just status)
      const supabaseUpdates: any = {};
      
      // When converting to Studio, allow updating invoice_no to STD-XXXX (Form sends new number)
      if ((updates as any).is_studio === true && typeof (updates as any).invoiceNo === 'string' && (updates as any).invoiceNo) {
        supabaseUpdates.invoice_no = (updates as any).invoiceNo;
      }
      // Otherwise preserve invoice_no when editing (no change)

      if (updates.status !== undefined) supabaseUpdates.status = updates.status === 'invoice' ? 'final' : (updates.status as string);
      if (updates.type !== undefined) supabaseUpdates.type = updates.type === 'invoice' ? 'invoice' : 'quotation';
      if (updates.paymentStatus !== undefined) supabaseUpdates.payment_status = updates.paymentStatus;
      if (updates.total !== undefined) supabaseUpdates.total = updates.total;
      if (updates.subtotal !== undefined) supabaseUpdates.subtotal = updates.subtotal;
      if (updates.discount !== undefined) supabaseUpdates.discount_amount = updates.discount;
      if (updates.tax !== undefined) supabaseUpdates.tax_amount = updates.tax;
      if (updates.expenses !== undefined) supabaseUpdates.expenses = updates.expenses;
      if (updates.paid !== undefined) supabaseUpdates.paid_amount = updates.paid;
      if (updates.due !== undefined) supabaseUpdates.due_amount = updates.due;
      if (updates.date !== undefined) supabaseUpdates.invoice_date = updates.date;
      if (updates.customerName !== undefined) supabaseUpdates.customer_name = updates.customerName;
      // UUID column: empty string is invalid; use null for walk-in / no customer
      if (updates.customer !== undefined) supabaseUpdates.customer_id = (updates.customer === '' || updates.customer == null) ? null : updates.customer;
      if (updates.location !== undefined) {
        // Location is branch_id, need to resolve branch name to ID
        // For now, if it's already a UUID, use it directly
        supabaseUpdates.branch_id = updates.location;
      }
      if (updates.notes !== undefined) supabaseUpdates.notes = updates.notes;
      if (updates.shippingStatus !== undefined) supabaseUpdates.shipping_status = updates.shippingStatus;
      if (updates.paymentMethod !== undefined) {
        supabaseUpdates.payment_method = normalizePaymentMethodForEnum(updates.paymentMethod);
      }
      if (updates.is_studio !== undefined) {
        supabaseUpdates.is_studio = updates.is_studio;
      }

      // CRITICAL FIX: Update sale items if provided
      if ((updates as any).items && Array.isArray((updates as any).items)) {
        const { saleService } = await import('@/app/services/saleService');
        const saleItems = (updates as any).items.map((item: any) => {
          const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
          const lineTotal = Number(item.total ?? (unitPrice * item.quantity) ?? 0);
          return {
          product_id: item.productId,
          variation_id: item.variationId || undefined,
          product_name: item.productName,
          sku: item.sku || 'N/A',
          quantity: item.quantity,
          unit: item.unit || 'piece',
          unit_price: unitPrice,
          discount_percentage: item.discountPercentage || 0,
          discount_amount: item.discount || 0,
          tax_percentage: item.taxPercentage || 0,
          tax_amount: item.tax || 0,
          total: lineTotal,
          packing_type: item.packingDetails?.packing_type || null,
          packing_quantity: item.packingDetails?.total_meters || item.meters || null,
          packing_unit: item.packingDetails?.unit || 'meters',
          packing_details: item.packingDetails || null,
        };
        });
        
        // Delete existing items and insert new ones
        const { supabase } = await import('@/lib/supabase');
        await supabase.from('sales_items').delete().eq('sale_id', id);
        if (saleItems.length > 0) {
          const itemsWithSaleId = saleItems.map((item: any) => ({ ...item, sale_id: id }));
          await supabase.from('sales_items').insert(itemsWithSaleId);
        }
      }

      // If status is changing to invoice (final), decrement stock
      const sale = getSaleById(id);
      if (sale && updates.status === 'invoice' && sale.type !== 'invoice' && (updates as any).items) {
        try {
          for (const item of (updates as any).items) {
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
      if (Object.keys(supabaseUpdates).length > 0) {
        await saleService.updateSale(id, supabaseUpdates);
      }

      // POS: Keep payment record in sync with paid amount (so Paid display matches Payment Details)
      const saleForSync = getSaleById(id);
      const isPOSSale = saleForSync?.invoiceNo?.startsWith('POS-');
      if (isPOSSale && updates.paid !== undefined) {
        try {
          const existingPayments = await saleService.getSalePayments(id);
          const paidAmount = Number(updates.paid) || 0;
          const paymentMethod = updates.paymentMethod || saleForSync?.paymentMethod || 'Cash';
          if (existingPayments.length === 0 && paidAmount > 0) {
            let syncBranchId = isValidBranchId(branchId) ? branchId : null;
            if (!syncBranchId && companyId) {
              const branches = await branchService.getAllBranches(companyId);
              syncBranchId = branches?.length ? branches[0].id : null;
            }
            if (companyId && syncBranchId && user) {
              const { accountHelperService } = await import('@/app/services/accountHelperService');
              const { accountService } = await import('@/app/services/accountService');
              const normalizedMethod = normalizePaymentMethodForEnum(paymentMethod);
              let paymentAccountId = await accountHelperService.getDefaultAccountByPaymentMethod(normalizedMethod, companyId);
              if (!paymentAccountId) {
                const allAccounts = await accountService.getAllAccounts(companyId);
                paymentAccountId = allAccounts?.find((acc: any) => acc.code === '1000')?.id || null;
              }
              if (paymentAccountId) {
                await saleService.recordPayment(id, paidAmount, paymentMethod, paymentAccountId, companyId, syncBranchId);
              }
            }
          } else if (existingPayments.length === 1) {
            await saleService.updatePayment(existingPayments[0].id, id, { amount: paidAmount, paymentMethod });
          }
        } catch (syncErr: any) {
          console.warn('[SALES CONTEXT] POS payment sync (non-blocking):', syncErr);
        }
      }

      // CRITICAL FIX: Handle payments if provided in updates
      // When editing, existing payments should NOT be recreated
      // Only new payments (not marked as existing) should be created
      if ((updates as any).partialPayments && Array.isArray((updates as any).partialPayments)) {
        const partialPayments = (updates as any).partialPayments;
        const newPayments = partialPayments.filter((p: any) => !p.isExisting);
        let updateBranchId = isValidBranchId(branchId) ? branchId : null;
        if (!updateBranchId && companyId) {
          const branches = await branchService.getAllBranches(companyId);
          updateBranchId = branches?.length ? branches[0].id : null;
        }
        if (newPayments.length > 0 && companyId && updateBranchId && user) {
          try {
            const { accountHelperService } = await import('@/app/services/accountHelperService');
            const { saleService } = await import('@/app/services/saleService');
            const { accountService } = await import('@/app/services/accountService');
            
            for (const partialPayment of newPayments) {
              const paymentMethod = normalizePaymentMethodForEnum(partialPayment.method || 'cash');
              
              // Get account for this payment method
              let paymentAccountId = await accountHelperService.getDefaultAccountByPaymentMethod(
                paymentMethod,
                companyId
              );
              
              // If no account found, use Cash as default
              if (!paymentAccountId) {
                const allAccounts = await accountService.getAllAccounts(companyId);
                const cashAccount = allAccounts.find(acc => acc.code === '1000');
                paymentAccountId = cashAccount?.id || null;
              }
              
              if (paymentAccountId && partialPayment.amount > 0) {
                // Record separate payment (reference will be auto-generated by trigger)
                await saleService.recordPayment(
                  id,
                  partialPayment.amount,
                  paymentMethod,
                  paymentAccountId,
                  companyId,
                  updateBranchId
                );
                
                // Create separate journal entry for this payment
                accounting.recordSalePayment({
                  saleId: id,
                  invoiceNo: sale?.invoiceNo || '',
                  customerName: sale?.customerName || '',
                  amount: partialPayment.amount,
                  paymentMethod: paymentMethod as any,
                  accountId: paymentAccountId,
                });
              }
            }
          } catch (error: any) {
            console.error('[SALES CONTEXT] Error recording new payments during edit:', error);
            // Don't fail update if payment recording fails
          }
        }
      }
      
      // CRITICAL FIX: Reload sale from database to get fresh data
      const updatedSaleData = await saleService.getSaleById(id);
      if (updatedSaleData) {
        const updatedSale = convertFromSupabaseSale(updatedSaleData);
        setSales(prev => prev.map(s => s.id === id ? updatedSale : s));
      } else {
        // Fallback: Update local state
        setSales(prev => prev.map(sale => 
          sale.id === id 
            ? { ...sale, ...updates, updatedAt: new Date().toISOString() }
            : sale
        ));
      }
      // POS updates show their own toast; avoid duplicate for POS invoices
      const isPOS = getSaleById(id)?.invoiceNo?.startsWith('POS-');
      if (!isPOS) toast.success('Sale updated successfully!');
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
    if (!sale || !companyId) {
      throw new Error('Sale not found or company missing');
    }
    let effectiveBranchId = isValidBranchId(branchId) ? branchId : null;
    if (!effectiveBranchId) {
      const branches = await branchService.getAllBranches(companyId);
      if (!branches?.length) throw new Error('No branch found. Please create at least one branch.');
      effectiveBranchId = branches[0].id;
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
      await saleService.recordPayment(saleId, amount, method, paymentAccountId, companyId, effectiveBranchId);

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
      
      // CRITICAL FIX: Update local state immediately for instant UI feedback
      setSales(prev => prev.map(s => 
        s.id === saleId ? { ...s, shippingStatus: status } : s
      ));
      
      // Also refresh from database to ensure consistency
      await loadSales();
      
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
