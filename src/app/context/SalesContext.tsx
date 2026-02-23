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
import { comboService } from '@/app/services/comboService';
import { getOrCreateLedger, addLedgerEntry } from '@/app/services/ledgerService';
import { useSettings } from '@/app/context/SettingsContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
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
  status?: 'draft' | 'quotation' | 'order' | 'final' | 'cancelled'; // Sale lifecycle; cancelled = reversed
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
  attachments?: { url: string; name: string }[] | null; // Sale attachments
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
    'mobile wallet': 'card', // Mobile Wallet maps to 'card' enum in database
    'Mobile Wallet': 'card',
    'other': 'card', // Legacy 'other' maps to 'card' for backward compatibility
    'Other': 'card',
    'bank': 'bank',
    'Bank': 'bank',
    'card': 'card',
    'Card': 'card',
    'cheque': 'other',
    'Cheque': 'other',
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
      // Packing: single source of truth from backend (same as Purchase – parse if JSON string from API)
      const rawPd = item.packing_details;
      const pd = rawPd != null && typeof rawPd === 'string'
        ? (() => { try { return JSON.parse(rawPd); } catch { return null; } })()
        : rawPd;
      const packingDetails = pd && typeof pd === 'object'
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
      // CRITICAL FIX: Preserve attachments from database
      attachments: supabaseSale.attachments || null,
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
  const { modules, inventorySettings } = useSettings();
  const { formatCurrency } = useFormatCurrency();

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
      // CRITICAL FIX: Generate document number based on sale source + status (central numbering only)
      // Regular sale (final) → invoice → SL-0001. Studio → studio → STD-0001. POS → POS-. Draft/Quotation/Order → respective prefix.
      // SL and STD have separate counters; never mix.
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

      // Negative stock enforcement: when negativeStockAllowed=false, block sale if any item would go negative
      const isFinal = saleData.status === 'final' || saleData.type === 'invoice';
      if (isFinal && !inventorySettings.negativeStockAllowed && saleData.items?.length > 0) {
        const { supabase } = await import('@/lib/supabase');
        const productIds = [...new Set(saleData.items.map((i) => i.productId))];
        const { data: prods } = await supabase.from('products').select('id, current_stock, has_variations').in('id', productIds);
        const productMap = new Map((prods || []).map((p: any) => [p.id, p]));

        for (const item of saleData.items) {
          const p = productMap.get(item.productId) as { current_stock?: number; has_variations?: boolean } | undefined;
          if (!p) continue;
          let stock = Number(p.current_stock || 0);
          if (p.has_variations && (item as any).variationId) {
            const movements = await productService.getStockMovements(item.productId, companyId, (item as any).variationId);
            const { calculateStockFromMovements } = await import('@/app/utils/stockCalculation');
            stock = calculateStockFromMovements(movements).currentBalance;
          }
          if (stock < item.quantity) {
            throw new Error(`${item.productName}: quantity (${item.quantity}) exceeds available stock (${stock})`);
          }
        }
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
        unit: (item as any).unit && String((item as any).unit).trim() ? (item as any).unit : ((item as any).packingDetails?.unit || 'pcs'),
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
                // 🔧 FIX: Use reference number from partialPayment if provided, otherwise auto-generate
                // Each payment method should have its own unique reference number
                const paymentRef = partialPayment.reference || generateDocumentNumber('payment');
                if (!partialPayment.reference) {
                  incrementNextNumber('payment');
                }
                
                await saleService.recordPayment(
                  newSale.id,
                  partialPayment.amount,
                  paymentMethod,
                  paymentAccountId,
                  companyId,
                  effectiveBranchId,
                  saleData.date,
                  paymentRef
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
                const paymentRef = generateDocumentNumber('payment');
                await saleService.recordPayment(
                  newSale.id,
                  newSale.paid,
                  paymentMethod,
                  paymentAccountId,
                  companyId,
                  effectiveBranchId,
                  saleData.date,
                  paymentRef
                );
                incrementNextNumber('payment');
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
      
      // CRITICAL: If sale is invoice (status = final), decrement stock
      // STEP 1 RULE: Silent fail NOT allowed - throw error if stock movement fails
      if (newSale.type === 'invoice' && newSale.status === 'final' && newSale.items && newSale.items.length > 0) {
        console.log('[SALES CONTEXT] 🔄 Creating stock movements for sale:', newSale.id, 'Items:', newSale.items.length);
        
        const stockMovementErrors: string[] = [];
        
        for (const item of newSale.items) {
          if (item.productId && item.quantity > 0) {
            try {
              // ============================================
              // COMBO HANDLING: Virtual Bundle Model
              // ============================================
              // If product is a combo, create stock movements for combo items
              // NOT for the combo product itself (combo product has no stock)
              // ============================================
              
              if (modules.combosEnabled) {
                const isCombo = await comboService.isComboProduct(item.productId, companyId);
                
                if (isCombo) {
                  console.log('[SALES CONTEXT] 🔄 Product is a combo, processing combo items:', {
                    combo_product_id: item.productId,
                    combo_quantity: item.quantity,
                    sale_id: newSale.id
                  });
                  
                  // Get combo details
                  const combo = await comboService.getComboByProductId(item.productId, companyId);
                  
                  if (!combo || !combo.items || combo.items.length === 0) {
                    throw new Error(`Combo product ${item.productId} has no items defined`);
                  }
                  
                  // Create stock movements for each combo item
                  for (const comboItem of combo.items) {
                    // Calculate quantity: combo_item.qty * sale_item.quantity
                    const componentQty = comboItem.qty * item.quantity;
                    
                    console.log('[SALES CONTEXT] Creating stock movement for combo item:', {
                      component_product_id: comboItem.product_id,
                      component_variation_id: comboItem.variation_id,
                      component_qty: componentQty,
                      combo_item_qty: comboItem.qty,
                      sale_item_qty: item.quantity
                    });
                    
                    // Create stock movement for component product (negative for stock OUT)
                    const movement = await productService.createStockMovement({
                      company_id: companyId,
                      branch_id: effectiveBranchId === 'all' ? undefined : effectiveBranchId,
                      product_id: comboItem.product_id,
                      variation_id: comboItem.variation_id || undefined,
                      movement_type: 'sale',
                      quantity: -componentQty, // Negative for stock OUT
                      unit_cost: comboItem.unit_price || 0,
                      total_cost: -(componentQty * (comboItem.unit_price || 0)),
                      reference_type: 'sale',
                      reference_id: newSale.id,
                      notes: `Combo sale ${newSale.invoiceNo}: ${combo.combo_name} - Component: ${comboItem.product_id}${comboItem.variation_id ? ' (Variation)' : ''}`,
                      created_by: user?.id,
                    });
                    
                    if (!movement || !movement.id) {
                      throw new Error(`Stock movement creation returned null for combo component ${comboItem.product_id}`);
                    }
                    
                    console.log('[SALES CONTEXT] ✅ Stock movement created for combo component:', {
                      movement_id: movement.id,
                      product_id: comboItem.product_id,
                      variation_id: comboItem.variation_id,
                      quantity: movement.quantity
                    });
                    
                    // Update component product stock
                    try {
                      const { supabase: sb } = await import('@/lib/supabase');
                      const { data: componentProduct } = await sb
                        .from('products')
                        .select('current_stock')
                        .eq('id', comboItem.product_id)
                        .single();
                      
                      if (componentProduct) {
                        const newStock = Math.max(0, (componentProduct.current_stock || 0) - componentQty);
                        await sb
                          .from('products')
                          .update({ current_stock: newStock })
                          .eq('id', comboItem.product_id);
                        
                        console.log(`[SALES CONTEXT] ✅ Updated combo component ${comboItem.product_id} stock: ${componentProduct.current_stock} → ${newStock}`);
                      }
                    } catch (stockUpdateError: any) {
                      console.error('[SALES CONTEXT] ❌ Direct stock update error for combo component (non-blocking):', stockUpdateError);
                    }
                  }
                  
                  // Skip creating stock movement for combo product itself (virtual bundle - no stock)
                  console.log('[SALES CONTEXT] ✅ Combo sale processed - stock movements created for all components');
                  continue;
                }
              }
              
              // ============================================
              // REGULAR PRODUCT HANDLING
              // ============================================
              console.log('[SALES CONTEXT] Creating stock movement for regular item:', {
                product_id: item.productId,
                variation_id: item.variationId,
                quantity: item.quantity,
                sale_id: newSale.id
              });
              
              const packing = (item as any).packingDetails;
              const boxOut = packing?.total_boxes != null ? Math.round(Number(packing.total_boxes)) : 0;
              const pieceOut = packing?.total_pieces != null ? Math.round(Number(packing.total_pieces)) : 0;
              const movement = await productService.createStockMovement({
                company_id: companyId,
                branch_id: effectiveBranchId === 'all' ? undefined : effectiveBranchId,
                product_id: item.productId,
                variation_id: item.variationId || undefined,
                movement_type: 'sale',
                quantity: -item.quantity,
                unit_cost: item.price || 0,
                total_cost: -((item.price || 0) * item.quantity),
                reference_type: 'sale',
                reference_id: newSale.id,
                notes: `Sale ${newSale.invoiceNo} - ${item.productName}${item.variationId ? ' (Variation)' : ''}`,
                created_by: user?.id,
                box_change: -boxOut,
                piece_change: -pieceOut,
              });
              
              if (!movement || !movement.id) {
                throw new Error(`Stock movement creation returned null/undefined for product ${item.productId}`);
              }
              
              console.log('[SALES CONTEXT] ✅ Stock movement created:', {
                movement_id: movement.id,
                product_id: item.productId,
                variation_id: item.variationId,
                quantity: movement.quantity
              });
              
              // CRITICAL: Also update products.current_stock directly to ensure immediate sync
              try {
                const { supabase: sb } = await import('@/lib/supabase');
                const { data: product } = await sb
                  .from('products')
                  .select('current_stock')
                  .eq('id', item.productId)
                  .single();
                
                if (product) {
                  const newStock = Math.max(0, (product.current_stock || 0) - item.quantity);
                  await sb
                    .from('products')
                    .update({ current_stock: newStock })
                    .eq('id', item.productId);
                  
                  console.log(`[SALES CONTEXT] ✅ Updated product ${item.productId} stock: ${product.current_stock} → ${newStock}`);
                }
              } catch (stockUpdateError: any) {
                console.error('[SALES CONTEXT] ❌ Direct stock update error (non-blocking):', stockUpdateError);
                // Continue even if direct update fails - stock_movements is the source of truth
              }
            } catch (movementError: any) {
              const errorMsg = `Failed to create stock movement for product ${item.productId} (${item.productName}): ${movementError.message || movementError}`;
              console.error('[SALES CONTEXT] ❌ Stock movement creation failed:', errorMsg);
              console.error('[SALES CONTEXT] Error details:', movementError);
              stockMovementErrors.push(errorMsg);
            }
          }
        }
        
        // CRITICAL: If any stock movement failed, throw error (no silent failures)
        if (stockMovementErrors.length > 0) {
          const errorMessage = `Stock movement creation failed for ${stockMovementErrors.length} item(s):\n${stockMovementErrors.join('\n')}`;
          console.error('[SALES CONTEXT] ❌ CRITICAL: Stock movements not created:', errorMessage);
          throw new Error(errorMessage);
        }
        
        console.log('[SALES CONTEXT] ✅ All stock movements created successfully for sale:', newSale.id);
      }
      
      // 🔒 ACCOUNTING OFF/ON BEHAVIOR RULE
      // Accounting OFF: Discount & Extra Charges stored in DB but NO journal entries
      // Single accounting engine: always create journal entries (no module toggle)
      if (newSale.type === 'invoice' && newSale.status === 'final') {
        try {
          const { supabase } = await import('@/lib/supabase');
          
          // Handle discount - ONLY if accounting enabled
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
          
          // Handle commission (if provided in saleData) - ONLY if accounting enabled
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
            } else if (salesmanId && salesmanId !== 'none' && salesmanId !== '1' && UUID_REGEX.test(salesmanId)) {
              // Sync to user ledger so commission shows in agent's ledger (only for valid user IDs)
              try {
                const { data: userRow } = await supabase
                  .from('users')
                  .select('full_name, email')
                  .eq('id', salesmanId)
                  .maybeSingle();
                const salesmanName = (userRow as any)?.full_name || (userRow as any)?.email || 'Agent';
                const ledger = await getOrCreateLedger(companyId, 'user', salesmanId, salesmanName);
                if (ledger) {
                  await addLedgerEntry({
                    companyId,
                    ledgerId: ledger.id,
                    entryDate: newSale.date || new Date().toISOString().split('T')[0],
                    debit: commissionAmount,
                    credit: 0,
                    source: 'commission',
                    referenceNo: newSale.invoiceNo,
                    referenceId: newSale.id,
                    remarks: `Commission - ${newSale.invoiceNo}`,
                  });
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'user', entityId: salesmanId } }));
                  }
                }
              } catch (ledgerErr: any) {
                console.warn('[SALES CONTEXT] User ledger commission entry failed:', ledgerErr?.message);
              }
            }
          }
          
          // Handle extra expenses - ONLY if accounting enabled
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
        }
      }

      // 🔧 UNPAID SALE JOURNAL ENTRY (MANDATORY)
      // CRITICAL: ALWAYS create journal entry for sale (paid or unpaid)
      // Rule: Accounts Receivable Dr (if unpaid) or Cash/Bank Dr (if paid), Sales Revenue Cr
      if (newSale.type === 'invoice' && newSale.status === 'final' && companyId && newSale.total > 0) {
        try {
          const { supabase } = await import('@/lib/supabase');
          
          // Get Accounts Receivable account – MUST match ledger (prefer code 2000, then 1100)
          const { data: arAccounts } = await supabase
            .from('accounts')
            .select('id, code')
            .eq('company_id', companyId)
            .or('code.eq.2000,code.eq.1100,name.ilike.%Accounts Receivable%');
          const arAccount = arAccounts?.find((a: any) => a.code === '2000')
            || arAccounts?.find((a: any) => a.code === '1100')
            || arAccounts?.[0];
          const arAccountId = arAccount?.id;
          
          // Get Sales Revenue account (can be "Sales" or "Sales Revenue")
          const { data: salesAccounts } = await supabase
            .from('accounts')
            .select('id')
            .eq('company_id', companyId)
            .or('name.ilike.Sales Revenue,name.ilike.Sales,code.eq.4000')
            .limit(1);
          
          const salesAccountId = salesAccounts?.[0]?.id;
          
          if (!arAccountId || !salesAccountId) {
            const errorMsg = `Missing required accounts for sale journal entry. AR: ${arAccountId ? 'OK' : 'MISSING'}, Sales: ${salesAccountId ? 'OK' : 'MISSING'}`;
            console.error('[SALES CONTEXT] ❌ CRITICAL:', errorMsg);
            throw new Error(errorMsg);
          }
          
          // Create main journal entry for sale (ALWAYS, paid or unpaid)
          const { data: mainJournalEntry, error: journalError } = await supabase
            .from('journal_entries')
            .insert({
              company_id: companyId,
              branch_id: effectiveBranchId,
              entry_date: newSale.date,
              description: `Sale ${newSale.invoiceNo} to ${newSale.customerName}`,
              reference_type: 'sale',
              reference_id: newSale.id,
              created_by: user?.id,
            })
            .select()
            .single();
          
          if (journalError || !mainJournalEntry) {
            console.error('[SALES CONTEXT] ❌ CRITICAL: Failed to create sale journal entry:', journalError);
            throw new Error(`Failed to create sale journal entry: ${journalError?.message || 'Unknown error'}`);
          }
          
          // Debit: Accounts Receivable (for unpaid portion) or Cash/Bank (for paid portion)
          const unpaidAmount = newSale.total - (newSale.paid || 0);
          
          if (unpaidAmount > 0) {
            // Debit: Accounts Receivable (credit sale)
            const { error: arDebitError } = await supabase
              .from('journal_entry_lines')
              .insert({
                journal_entry_id: mainJournalEntry.id,
                account_id: arAccountId,
                debit: unpaidAmount,
                credit: 0,
                description: `Accounts Receivable for ${newSale.invoiceNo}`,
              });
            
            if (arDebitError) {
              console.error('[SALES CONTEXT] ❌ CRITICAL: Failed to create AR debit line:', arDebitError);
              throw arDebitError;
            }
          }
          
          // Credit: Sales Revenue (always)
          const { error: salesCreditError } = await supabase
            .from('journal_entry_lines')
            .insert({
              journal_entry_id: mainJournalEntry.id,
              account_id: salesAccountId,
              debit: 0,
              credit: newSale.total,
              description: `Sales Revenue for ${newSale.invoiceNo}`,
            });
          
          if (salesCreditError) {
            console.error('[SALES CONTEXT] ❌ CRITICAL: Failed to create Sales Revenue credit line:', salesCreditError);
            throw salesCreditError;
          }
          
          console.log('[SALES CONTEXT] ✅ Created main accounting entry for sale (paid or unpaid):', mainJournalEntry.id);
          
          // If paid, create separate payment journal entry (handled below)
        } catch (accountingError: any) {
          console.error('[SALES CONTEXT] ❌ CRITICAL: Sale accounting entry failed:', accountingError);
          // CRITICAL: Throw error to prevent sale creation without accounting
          throw new Error(`Failed to create sale accounting entry: ${accountingError.message || 'Unknown error'}`);
        }
      }
      
      // CRITICAL FIX: Create payment journal entry separately (if paid)
      // Payment is separate from sale transaction (double-entry rule)
      if (newSale.type === 'invoice' && newSale.status === 'final' && newSale.paid > 0) {
        try {
          await accounting.recordSalePayment({
          saleId: newSale.id,
          invoiceNo: newSale.invoiceNo,
          customerName: newSale.customerName,
          amount: newSale.paid,
          paymentMethod: newSale.paymentMethod as any,
          });
        } catch (accountingError) {
          console.error('[SALES CONTEXT] ❌ CRITICAL: Payment journal entry failed:', accountingError);
          // Don't block sale creation if payment entry fails (sale entry already created)
          console.warn('[SALES CONTEXT] Warning: Sale created but payment entry failed');
        }
      }

      const createdLabel = docType === 'pos' ? 'POS sale' : docType === 'invoice' ? 'Invoice' : docType === 'quotation' ? 'Quotation' : docType === 'order' ? 'Order' : 'Draft';
      toast.success(`${createdLabel} ${invoiceNo} created successfully!`);
      
      // Dispatch event to refresh inventory
      window.dispatchEvent(new CustomEvent('saleSaved', { detail: { saleId: newSale.id } }));
      if (newSale.customerId) {
        window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'customer', entityId: newSale.customerId } }));
      }
      
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
      // CRITICAL FIX: DO NOT directly update paid_amount in sale
      // paid_amount should ONLY be updated by database trigger from payments table
      // If updates.paid is provided, we'll handle it by creating/updating payment record below
      // if (updates.paid !== undefined) supabaseUpdates.paid_amount = updates.paid; // REMOVED - Use payments table only
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
      if ((updates as any).attachments !== undefined) supabaseUpdates.attachments = (updates as any).attachments;

      // 🔒 CRITICAL FIX: Calculate stock movement DELTA BEFORE updating sale_items
      // This must happen BEFORE sale_items are deleted/updated so we can fetch old items
      const sale = getSaleById(id);
      const isFinalStatus = (updates.status === 'invoice' || updates.status === 'final') || (sale?.status === 'final' || sale?.type === 'invoice');
      let stockMovementDeltas: Array<{
        productId: string;
        variationId?: string;
        deltaQty: number;
        price: number;
        name: string;
      }> = [];
      
      // Only calculate delta if items are being updated and sale is final
      if (isFinalStatus && (updates as any).items && Array.isArray((updates as any).items) && companyId) {
        try {
          console.log('[SALES CONTEXT] 🔄 Calculating stock movement DELTA for sale edit (BEFORE items update):', id);
          
          // STEP 1: Fetch OLD items from database (BEFORE they are deleted)
          const { supabase } = await import('@/lib/supabase');
          const { data: oldItemsData, error: oldItemsError } = await supabase
            .from('sales_items')
            .select('product_id, variation_id, quantity, unit_price, product_name')
            .eq('sale_id', id);
          
          if (oldItemsError) {
            console.error('[SALES CONTEXT] Error fetching old items:', oldItemsError);
            // Don't throw - continue without delta calculation
          } else {
            const oldItems = oldItemsData || [];
            const newItems = (updates as any).items || [];
            
            console.log('[SALES CONTEXT] Stock movement delta calculation:', {
              oldItemsCount: oldItems.length,
              newItemsCount: newItems.length,
              oldItems: oldItems.map((i: any) => ({ product_id: i.product_id, variation_id: i.variation_id, qty: i.quantity })),
              newItems: newItems.map((i: any) => ({ product_id: i.productId, variation_id: i.variationId, qty: i.quantity }))
            });
            
            // STEP 2: Build maps for delta calculation
            // Key format: "productId_variationId" (use "null" for no variation)
            type ItemKey = string;
            const oldItemsMap = new Map<ItemKey, { quantity: number; price: number; name: string }>();
            const newItemsMap = new Map<ItemKey, { quantity: number; price: number; name: string }>();
            
            // Map old items
            oldItems.forEach((item: any) => {
              const key: ItemKey = `${item.product_id}_${item.variation_id || 'null'}`;
              oldItemsMap.set(key, {
                quantity: Number(item.quantity) || 0,
                price: Number(item.unit_price) || 0,
                name: item.product_name || 'Unknown'
              });
            });
            
            // Map new items
            newItems.forEach((item: any) => {
              if (item.productId && item.quantity > 0) {
                const key: ItemKey = `${item.productId}_${item.variationId || 'null'}`;
                newItemsMap.set(key, {
                  quantity: Number(item.quantity) || 0,
                  price: Number(item.price) || 0,
                  name: item.productName || 'Unknown'
                });
              }
            });
            
            // STEP 3: Calculate DELTA for each product+variation combination
            // Check all keys (old + new)
            const allKeys = new Set([...oldItemsMap.keys(), ...newItemsMap.keys()]);
            
            allKeys.forEach((key) => {
              const oldItem = oldItemsMap.get(key) || { quantity: 0, price: 0, name: '' };
              const newItem = newItemsMap.get(key) || { quantity: 0, price: 0, name: '' };
              
              const deltaQty = newItem.quantity - oldItem.quantity;
              
              // Only create movement if delta is non-zero
              if (deltaQty !== 0) {
                const [productId, variationIdStr] = key.split('_');
                const variationId = variationIdStr === 'null' ? undefined : variationIdStr;
                
                stockMovementDeltas.push({
                  productId,
                  variationId,
                  deltaQty, // Positive = stock increased (item removed/reduced), Negative = stock decreased (item added/increased)
                  price: newItem.price || oldItem.price || 0,
                  name: newItem.name || oldItem.name || 'Unknown'
                });
                
                console.log('[SALES CONTEXT] Delta calculated:', {
                  key,
                  productId,
                  variationId,
                  oldQty: oldItem.quantity,
                  newQty: newItem.quantity,
                  deltaQty,
                  meaning: deltaQty > 0 ? 'Item removed/reduced (stock restored)' : 'Item added/increased (stock reduced)'
                });
              }
            });
          }
        } catch (deltaError: any) {
          console.error('[SALES CONTEXT] ❌ Delta calculation error:', deltaError);
          // Don't block sale update if delta calculation fails
        }
      }

      // Negative stock enforcement: when negativeStockAllowed=false, block if any delta would cause negative stock
      const reducingDeltas = stockMovementDeltas.filter((d) => d.deltaQty < 0);
      if (!inventorySettings.negativeStockAllowed && reducingDeltas.length > 0 && companyId) {
        const { supabase } = await import('@/lib/supabase');
        const productIds = [...new Set(reducingDeltas.map((d) => d.productId))];
        const { data: prods } = await supabase.from('products').select('id, current_stock, has_variations').in('id', productIds);
        const productMap = new Map((prods || []).map((p: any) => [p.id, p]));

        for (const delta of reducingDeltas) {
          const p = productMap.get(delta.productId) as { current_stock?: number; has_variations?: boolean } | undefined;
          if (!p) continue;
          let stock = Number(p.current_stock || 0);
          if (p.has_variations && delta.variationId) {
            const movements = await productService.getStockMovements(delta.productId, companyId, delta.variationId);
            const { calculateStockFromMovements } = await import('@/app/utils/stockCalculation');
            stock = calculateStockFromMovements(movements).currentBalance;
          }
          const qtyNeeded = Math.abs(delta.deltaQty);
          if (stock < qtyNeeded) {
            throw new Error(`${delta.name}: quantity (${qtyNeeded}) exceeds available stock (${stock})`);
          }
        }
      }

      // CRITICAL FIX: Update sale items if provided
      if ((updates as any).items && Array.isArray((updates as any).items)) {
        const { saleService } = await import('@/app/services/saleService');
        console.log('[SALES CONTEXT] 🔄 Updating sale items. Received items count:', (updates as any).items.length);
        console.log('[SALES CONTEXT] Items payload:', (updates as any).items.map((item: any, idx: number) => ({
          index: idx,
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: item.price || item.unitPrice
        })));
        
        const saleItems = (updates as any).items.map((item: any, index: number) => {
          const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
          const lineTotal = Number(item.total ?? (unitPrice * item.quantity) ?? 0);
          const saleItem = {
          product_id: item.productId,
          variation_id: item.variationId || undefined,
          product_name: item.productName,
          sku: item.sku || 'N/A',
          quantity: item.quantity,
          unit: item.unit || 'pcs',
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
        console.log(`[SALES CONTEXT] ✅ Converted item ${index}:`, {
          product_id: saleItem.product_id,
          product_name: saleItem.product_name,
          quantity: saleItem.quantity,
          unit_price: saleItem.unit_price
        });
        return saleItem;
        });
        
        console.log('[SALES CONTEXT] ✅ Final saleItems array length:', saleItems.length);
        
        // Delete existing items and insert new ones
        const { supabase } = await import('@/lib/supabase');
        const { error: deleteError } = await supabase.from('sales_items').delete().eq('sale_id', id);
        if (deleteError) {
          console.error('[SALES CONTEXT] ❌ Error deleting old items:', deleteError);
          throw deleteError;
        }
        console.log('[SALES CONTEXT] ✅ Deleted old sale_items');
        
        if (saleItems.length > 0) {
          const itemsWithSaleId = saleItems.map((item: any) => ({ ...item, sale_id: id }));
          console.log('[SALES CONTEXT] 🔄 Inserting', itemsWithSaleId.length, 'new sale_items');
          const { error: insertError } = await supabase.from('sales_items').insert(itemsWithSaleId);
          if (insertError) {
            console.error('[SALES CONTEXT] ❌ Error inserting new items:', insertError);
            throw insertError;
          }
          console.log('[SALES CONTEXT] ✅ Successfully inserted', itemsWithSaleId.length, 'sale_items');
        } else {
          console.log('[SALES CONTEXT] ⚠️ No items to insert (saleItems.length = 0)');
        }
      }

      // 🔒 CRITICAL FIX: Create stock movements for DELTA (after sale_items are updated)
      // GOLDEN RULE: Only create movements for the delta, not for all items
      if (stockMovementDeltas.length > 0 && companyId) {
        try {
          console.log('[SALES CONTEXT] 🔄 Creating stock movements for deltas:', stockMovementDeltas.length);
          
          // Get branch ID
          let effectiveBranchId = isValidBranchId(branchId) ? branchId : null;
          if (!effectiveBranchId && companyId) {
            const branches = await branchService.getAllBranches(companyId);
            effectiveBranchId = branches?.length ? branches[0].id : null;
          }
          
          // Create stock movements for DELTA only
          const stockMovementErrors: string[] = [];
          const saleForStock = sale || (await saleService.getSaleById(id));
          const saleInvoiceNo = saleForStock?.invoiceNo || id;
          
          for (const delta of stockMovementDeltas) {
            try {
              // deltaQty > 0 means item was removed/reduced → restore stock (positive movement)
              // deltaQty < 0 means item was added/increased → reduce stock (negative movement)
              const movementQty = -delta.deltaQty; // Negate because: if deltaQty is positive (item removed), we restore stock (positive movement)
              
              console.log('[SALES CONTEXT] Creating stock movement for delta:', {
                product_id: delta.productId,
                variation_id: delta.variationId,
                deltaQty: delta.deltaQty,
                movementQty: movementQty,
                sale_id: id
              });
              
              // Create stock movement
              const movement = await productService.createStockMovement({
                company_id: companyId,
                branch_id: effectiveBranchId === 'all' ? undefined : effectiveBranchId,
                product_id: delta.productId,
                variation_id: delta.variationId,
                movement_type: 'sale',
                quantity: movementQty, // Positive = restore stock, Negative = reduce stock
                unit_cost: delta.price,
                total_cost: movementQty * delta.price,
                reference_type: 'sale',
                reference_id: id,
                notes: `Sale Edit ${saleInvoiceNo} - ${delta.name}${delta.variationId ? ' (Variation)' : ''} - Delta: ${delta.deltaQty > 0 ? 'Restore' : 'Reduce'}`,
                created_by: user?.id,
              });
              
              if (!movement || !movement.id) {
                throw new Error(`Stock movement creation returned null for product ${delta.productId}`);
              }
              
              console.log('[SALES CONTEXT] ✅ Stock movement created for delta:', delta.name, 'Movement ID:', movement.id, 'Qty:', movementQty);
            } catch (movementError: any) {
              const errorMsg = `Failed to create stock movement for ${delta.name}: ${movementError.message || movementError}`;
              console.error('[SALES CONTEXT] ❌', errorMsg);
              stockMovementErrors.push(errorMsg);
              // Continue with other deltas even if one fails
            }
          }
          
          if (stockMovementErrors.length > 0) {
            console.error('[SALES CONTEXT] ⚠️ Some stock movements failed:', stockMovementErrors);
            toast.warning(`Sale updated but ${stockMovementErrors.length} stock movement(s) failed. Check console for details.`);
          } else {
            console.log('[SALES CONTEXT] ✅ All stock movement deltas created successfully for sale:', id, 'Deltas:', stockMovementDeltas.length);
          }
          
          // Dispatch event to refresh inventory
          window.dispatchEvent(new CustomEvent('saleSaved', { 
            detail: { saleId: id } 
          }));
          const custId = sale?.customerId || (sale as any)?.customer_id;
          if (custId) {
            window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'customer', entityId: custId } }));
          }
        } catch (stockError: any) {
          console.error('[SALES CONTEXT] ❌ Stock movement delta creation error:', stockError);
          toast.warning('Sale updated but stock movements failed. Check console for details.');
          // Don't block update if stock movement fails
        }
      } else if (stockMovementDeltas.length === 0 && isFinalStatus && (updates as any).items) {
        console.log('[SALES CONTEXT] ✅ No stock movement delta (items unchanged or no delta)');
      }

      // Update in Supabase
      if (Object.keys(supabaseUpdates).length > 0) {
        await saleService.updateSale(id, supabaseUpdates);
      }

      // Handle commission when updating to final (draft→final or edit with commission)
      if (isFinalStatus && companyId) {
        const commissionAmount = (updates as any).commissionAmount || 0;
        const salesmanId = (updates as any).salesmanId || null;
        if (commissionAmount > 0 && salesmanId && salesmanId !== 'none' && salesmanId !== '1' && UUID_REGEX.test(salesmanId)) {
          try {
            const { supabase } = await import('@/lib/supabase');
            let effectiveBranchId = isValidBranchId(branchId) ? branchId : null;
            if (!effectiveBranchId) {
              const branches = await branchService.getAllBranches(companyId);
              effectiveBranchId = branches?.length ? branches[0].id : null;
            }
            const saleForComm = sale || (await saleService.getSaleById(id));
            const invoiceNo = saleForComm?.invoiceNo || id;
            const { data: existingCommission } = await supabase
              .from('journal_entries')
              .select('id')
              .eq('reference_type', 'sale')
              .eq('reference_id', id)
              .ilike('description', '%commission%')
              .limit(1)
              .maybeSingle();
            if (!existingCommission) {
              const { error: commissionError } = await supabase.rpc('create_commission_journal_entry', {
                p_sale_id: id,
                p_company_id: companyId,
                p_branch_id: effectiveBranchId,
                p_commission_amount: commissionAmount,
                p_salesperson_id: salesmanId,
                p_invoice_no: invoiceNo,
              });
              if (commissionError) {
                console.error('[SALES CONTEXT] Error creating commission journal entry (update):', commissionError);
              } else {
                const { data: userRow } = await supabase.from('users').select('full_name, email').eq('id', salesmanId).maybeSingle();
                const salesmanName = (userRow as any)?.full_name || (userRow as any)?.email || 'Agent';
                const ledger = await getOrCreateLedger(companyId, 'user', salesmanId, salesmanName);
                if (ledger) {
                  await addLedgerEntry({
                    companyId,
                    ledgerId: ledger.id,
                    entryDate: saleForComm?.date || new Date().toISOString().split('T')[0],
                    debit: commissionAmount,
                    credit: 0,
                    source: 'commission',
                    referenceNo: invoiceNo,
                    referenceId: id,
                    remarks: `Commission - ${invoiceNo}`,
                  });
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'user', entityId: salesmanId } }));
                  }
                }
              }
            }
          } catch (commErr: any) {
            console.warn('[SALES CONTEXT] Commission handling in update failed:', commErr?.message);
          }
        }
      }

      // 🔒 GOLDEN RULE: Payment MUST go to payments table, NEVER directly update sale.paid_amount
      // If updates.paid is provided, create/update payment record in payments table
      // Database trigger will automatically update sale.paid_amount from payments table
      if (updates.paid !== undefined) {
        try {
          const saleForSync = getSaleById(id);
          if (!saleForSync || !companyId) {
            console.warn('[SALES CONTEXT] Cannot sync payment: sale or company missing');
          } else {
            const existingPayments = await saleService.getSalePayments(id);
            const paidAmount = Number(updates.paid) || 0;
            const paymentMethod = updates.paymentMethod || saleForSync?.paymentMethod || 'Cash';
            
            let effectiveBranchId = isValidBranchId(branchId) ? branchId : null;
            if (!effectiveBranchId && companyId) {
              const branches = await branchService.getAllBranches(companyId);
              effectiveBranchId = branches?.length ? branches[0].id : null;
            }
            
            if (companyId && effectiveBranchId && user) {
              const { accountHelperService } = await import('@/app/services/accountHelperService');
              const { accountService } = await import('@/app/services/accountService');
              const normalizedMethod = normalizePaymentMethodForEnum(paymentMethod);
              
              // Get payment account ID
              let paymentAccountId = await accountHelperService.getDefaultAccountByPaymentMethod(normalizedMethod, companyId);
              if (!paymentAccountId) {
                const allAccounts = await accountService.getAllAccounts(companyId);
                paymentAccountId = allAccounts?.find((acc: any) => acc.code === '1000')?.id || null;
              }
              
              if (!paymentAccountId) {
                console.error('[SALES CONTEXT] No payment account found for', normalizedMethod);
                throw new Error(`No payment account found for ${normalizedMethod}. Please create a default account.`);
              }
              
              // If no payment exists and paidAmount > 0, create payment record
              if (existingPayments.length === 0 && paidAmount > 0) {
                const paymentRef = generateDocumentNumber('payment');
                await saleService.recordPayment(
                  id, 
                  paidAmount, 
                  paymentMethod, 
                  paymentAccountId, 
                  companyId, 
                  effectiveBranchId, 
                  saleForSync.date,
                  paymentRef
                );
                incrementNextNumber('payment');
                console.log('[SALES CONTEXT] ✅ Payment record created in payments table:', paymentRef);
              } 
              // If single payment exists, update it
              else if (existingPayments.length === 1) {
                await saleService.updatePayment(
                  existingPayments[0].id, 
                  id, 
                  { 
                    amount: paidAmount, 
                    paymentMethod: normalizedMethod,
                    paymentAccountId: paymentAccountId
                  }
                );
                console.log('[SALES CONTEXT] ✅ Payment record updated in payments table');
              }
              // If multiple payments exist, log warning (shouldn't happen in normal flow)
              else if (existingPayments.length > 1) {
                console.warn('[SALES CONTEXT] Multiple payments exist, cannot auto-update. Use payment management UI.');
              }
            }
          }
        } catch (syncErr: any) {
          console.error('[SALES CONTEXT] ❌ Payment sync failed:', syncErr);
          // Don't block sale update if payment sync fails, but log error
          toast.error(`Payment sync failed: ${syncErr.message || 'Unknown error'}`);
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
                const paymentRef = generateDocumentNumber('payment');
                await saleService.recordPayment(
                  id,
                  partialPayment.amount,
                  paymentMethod,
                  paymentAccountId,
                  companyId,
                  updateBranchId,
                  undefined,
                  paymentRef
                );
                incrementNextNumber('payment');
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
      
      // CRITICAL: Dispatch event to refresh ledger views and accounting
      window.dispatchEvent(new CustomEvent('saleDeleted', { detail: { saleId: id } }));
      const custId = sale.customerId || (sale as any)?.customer;
      if (custId) {
        window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'customer', entityId: custId } }));
      }
      
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
      
      // CRITICAL FIX: Record payment in Supabase (with account_id); use central PAY- reference
      const paymentRef = generateDocumentNumber('payment');
      await saleService.recordPayment(saleId, amount, method, paymentAccountId, companyId, effectiveBranchId, undefined, paymentRef);
      incrementNextNumber('payment');

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

      toast.success(`Payment of ${formatCurrency(amount)} recorded!`);
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
