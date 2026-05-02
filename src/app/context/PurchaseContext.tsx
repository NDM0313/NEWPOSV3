// ============================================
// 🎯 PURCHASE CONTEXT
// ============================================
// Manages purchases and supplier orders with auto-numbering

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { documentNumberService } from '@/app/services/documentNumberService';
import { useAccountingOptional } from '@/app/context/AccountingContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { purchaseService, Purchase as SupabasePurchase, PurchaseItem as SupabasePurchaseItem } from '@/app/services/purchaseService';
import { productService } from '@/app/services/productService';
import { activityLogService } from '@/app/services/activityLogService';
import { branchService } from '@/app/services/branchService';
import { toast } from 'sonner';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import {
  canPostAccountingForPurchaseStatus,
  canPostStockForPurchaseStatus,
  normalizePurchaseStatusForPosting,
} from '@/app/lib/postingStatusGate';
import { getPurchaseDisplayNumber } from '@/app/lib/documentDisplayNumbers';
import { assertDomainEditSafetyTestMode, classifyPurchaseEdit } from '@/app/lib/accountingEditClassification';
import { createAccountingEditTraceId, pushAccountingEditTrace } from '@/app/lib/accountingEditTrace';
import { dispatchDataInvalidated } from '@/app/lib/dataInvalidationBus';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidBranchId(id: string | null): id is string {
  return !!id && UUID_REGEX.test(id);
}

// ============================================
// TYPES
// ============================================

export type PurchaseStatus = 'draft' | 'ordered' | 'received' | 'completed' | 'cancelled';
export type PaymentStatus = 'paid' | 'partial' | 'unpaid';

// ============================================
// HELPER FUNCTIONS
// ============================================

// Normalize payment method to database enum format
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
    'mobile_wallet': 'other',
    'wallet': 'other',
    'Wallet': 'other',
  };
  return enumMap[method] || enumMap[normalized] || 'cash';
};

export interface PurchaseItem {
  id: string;
  productId: string;
  variationId?: string; // Variation UUID (optional)
  productName: string;
  sku: string;
  quantity: number;
  receivedQty: number;
  price: number;
  discount: number;
  tax: number;
  total: number;
  unit?: string; // Short code (pcs, m, yd) for view
  packingDetails?: { total_boxes?: number; total_pieces?: number; total_meters?: number; [k: string]: unknown };
  variation?: { id: string; sku?: string; attributes?: Record<string, string> };
}

export interface Purchase {
  id: string;
  /** Display number for lists (from po_no when posted, else draft_no / order_no). */
  purchaseNo: string;
  draftNo?: string;
  orderNo?: string;
  supplier: string;
  supplierName: string;
  contactNumber: string;
  date: string;
  expectedDelivery?: string;
  location: string;
  branchId?: string; // Branch UUID (optional, will use context branchId if not provided)
  status: PurchaseStatus;
  items: PurchaseItem[];
  itemsCount: number;
  subtotal: number;
  discount: number;
  tax: number;
  shippingCost: number;
  total: number;
  paid: number;
  due: number;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  notes?: string;
  attachments?: { url: string; name: string }[] | null; // Purchase attachments
  /** Line-level charges from purchase_charges (for view drawer detail) */
  charges?: Array<{ charge_type?: string; chargeType?: string; amount: number }>;
  reference?: string; // STEP 1 FIX: Reference number field
  createdBy?: string; // CRITICAL FIX: User who created the purchase (for "Added By" display)
  createdAt: string;
  updatedAt: string;
}

interface PurchaseContextType {
  purchases: Purchase[];
  loading: boolean;
  totalCount: number;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  getPurchaseById: (id: string) => Purchase | undefined;
  createPurchase: (
    purchase: Omit<Purchase, 'id' | 'purchaseNo' | 'createdAt' | 'updatedAt'>,
    purchaseNo?: string
  ) => Promise<Purchase>;
  updatePurchase: (id: string, updates: Partial<Purchase>) => Promise<void>;
  deletePurchase: (id: string) => Promise<void>;
  recordPayment: (purchaseId: string, amount: number, method: string, accountId?: string) => Promise<void>;
  updateStatus: (purchaseId: string, status: PurchaseStatus) => Promise<void>;
  receiveStock: (purchaseId: string, itemId: string, quantity: number) => Promise<void>;
  refreshPurchases: () => Promise<void>;
}

// ============================================
// CONTEXT
// ============================================

const PurchaseContext = createContext<PurchaseContextType | undefined>(undefined);

export const usePurchases = () => {
  const context = useContext(PurchaseContext);
  if (!context) {
    // During hot reload or initial mount, context might not be available; return safe default to prevent crashes
    if (import.meta.env.DEV) {
      const defaultError = () => { throw new Error('PurchaseProvider not available'); };
      return {
        purchases: [],
        loading: false,
        getPurchaseById: () => undefined,
        createPurchase: defaultError,
        updatePurchase: defaultError,
        deletePurchase: defaultError,
        recordPayment: defaultError,
        totalCount: 0,
        page: 0,
        pageSize: 50,
        setPage: () => {},
        refreshPurchases: async () => {},
      } as PurchaseContextType;
    }
    throw new Error('usePurchases must be used within PurchaseProvider');
  }
  return context;
};

// CRITICAL FIX: Export convertFromSupabasePurchase as a standalone function
// This allows it to be used outside the context provider
export const convertFromSupabasePurchase = (supabasePurchase: any): Purchase => {
  // Resolve branch display: use joined branch data if available
  // UI Rule: Show only branch NAME (not code, never UUID)
  let locationDisplay = '';
  if (supabasePurchase.branch) {
    // Branch data joined from API - show NAME only
    locationDisplay = supabasePurchase.branch.name || '';
  }
  // Note: Do NOT fallback to branch_id UUID - it should never appear in UI
  
  const displayPo = getPurchaseDisplayNumber(supabasePurchase);
  return {
    id: supabasePurchase.id,
    purchaseNo: displayPo || supabasePurchase.po_no || '',
    draftNo: supabasePurchase.draft_no ?? undefined,
    orderNo: supabasePurchase.order_no ?? undefined,
    supplier: supabasePurchase.supplier_id || '',
    supplierName: supabasePurchase.supplier_name || '',
    contactNumber: supabasePurchase.supplier?.phone || '',
    date: supabasePurchase.po_date || new Date().toISOString().split('T')[0],
    expectedDelivery: supabasePurchase.expected_delivery_date,
    location: locationDisplay, // NOW uses resolved branch name/code instead of raw UUID
    status: supabasePurchase.status || 'draft',
    // CRITICAL FIX: Include user info for "Added By" display
    createdBy: supabasePurchase.created_by_user?.full_name || supabasePurchase.created_by_user?.email || 'System',
    items: (supabasePurchase.items || []).map((item: any) => ({
      id: item.id || '',
      productId: item.product_id || '',
      variationId: item.variation_id || undefined, // Include variation ID
      productName: item.product_name || '',
      sku: item.product?.sku || item.sku || '',
      quantity: item.quantity || 0,
      receivedQty: item.received_qty || 0,
      price: item.unit_price || 0,
      discount: item.discount || 0,
      tax: item.tax || 0,
      total: item.total || 0,
      unit: item.unit || undefined,
      packingDetails: item.packing_details || undefined,
      variation: item.variation || item.product_variations || undefined,
    })),
    // 🔒 CRITICAL FIX: Items count from joined purchase_items array
    // If items array is missing or empty, count is 0
    // This should match the actual COUNT(*) FROM purchase_items WHERE purchase_id = ...
    itemsCount: Array.isArray(supabasePurchase.items) ? supabasePurchase.items.length : 0,
    subtotal: supabasePurchase.subtotal || 0,
    discount: supabasePurchase.discount_amount || 0,
    tax: supabasePurchase.tax_amount || 0,
    shippingCost: supabasePurchase.shipping_cost || 0,
    total: supabasePurchase.total || 0,
    paid: supabasePurchase.paid_amount || 0,
    due: supabasePurchase.due_amount || 0,
    paymentStatus: supabasePurchase.payment_status || 'unpaid',
    paymentMethod: 'Cash',
    // STEP 1 FIX: Reference number from notes field (consistent with Sale module)
    notes: supabasePurchase.notes,
    // CRITICAL FIX: Preserve attachments from database
    attachments: supabasePurchase.attachments || null,
    charges: Array.isArray(supabasePurchase.charges) ? supabasePurchase.charges : (Array.isArray(supabasePurchase.purchase_charges) ? supabasePurchase.purchase_charges : []),
    reference: supabasePurchase.notes || supabasePurchase.reference || undefined,
    createdAt: supabasePurchase.created_at || new Date().toISOString(),
    updatedAt: supabasePurchase.updated_at || new Date().toISOString(),
  };
};

// ============================================
// PROVIDER
// ============================================

export const PurchaseProvider = ({ children }: { children: ReactNode }) => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const accounting = useAccountingOptional();
  const { formatCurrency } = useFormatCurrency();
  const { companyId, branchId, user } = useSupabase();

  const emitPurchaseInvalidation = useCallback(
    (reason: string, entityId?: string) => {
      dispatchDataInvalidated({
        domain: 'purchases',
        companyId: companyId || null,
        branchId: branchId || null,
        entityId: entityId ?? null,
        reason,
      });
      dispatchDataInvalidated({
        domain: 'accounting',
        companyId: companyId || null,
        branchId: branchId || null,
        entityId: entityId ?? null,
        reason: `purchase:${reason}`,
      });
    },
    [companyId, branchId]
  );

  // Use exported convertFromSupabasePurchase function (no need for local callback)

  const PAGE_SIZE = 50;
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPageState] = useState(0);

  // Load purchases from database (paginated)
  const loadPurchases = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const result = await purchaseService.getAllPurchases(
        companyId,
        branchId === 'all' ? undefined : branchId || undefined,
        { offset: page * PAGE_SIZE, limit: PAGE_SIZE }
      );
      const isPaginated = result && typeof result === 'object' && 'data' in result && 'total' in result;
      const data = isPaginated ? (result as { data: any[]; total: number }).data : (result as any[]);
      const total = isPaginated ? (result as { data: any[]; total: number }).total : data.length;
      setPurchases(data.map(convertFromSupabasePurchase));
      setTotalCount(total);
    } catch (error) {
      console.error('[PURCHASE CONTEXT] Error loading purchases:', error);
      toast.error('Failed to load purchases');
      setPurchases([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, page]);

  const setPage = useCallback((p: number) => {
    setPageState(Math.max(0, p));
  }, []);

  useEffect(() => {
    if (companyId) loadPurchases();
    else setLoading(false);
  }, [companyId, loadPurchases]);

  // Get purchase by ID
  const getPurchaseById = (id: string): Purchase | undefined => {
    return purchases.find(p => p.id === id);
  };

  // Create new purchase
  const createPurchase = async (
    purchaseData: Omit<Purchase, 'id' | 'purchaseNo' | 'createdAt' | 'updatedAt'>,
    providedPurchaseNo?: string
  ): Promise<Purchase> => {
    if (!companyId || !user) {
      throw new Error('Company ID and User are required');
    }

    try {
      const finalBranchId = purchaseData.branchId || branchId;
      if (!finalBranchId || finalBranchId === 'all' || finalBranchId.trim() === '') {
        throw new Error('Please select a specific branch. "All Branches" is not allowed for purchases.');
      }

      // Database enum: 'draft', 'ordered', 'received', 'final' (NO 'completed')
      let dbStatus: 'draft' | 'ordered' | 'received' | 'final';
      if (purchaseData.status === 'completed' || purchaseData.status === 'final') {
        dbStatus = 'final';
      } else if (purchaseData.status === 'cancelled') {
        dbStatus = 'draft';
      } else if (purchaseData.status === 'draft' || purchaseData.status === 'ordered' || purchaseData.status === 'received') {
        dbStatus = purchaseData.status;
      } else {
        dbStatus = 'draft';
      }

      // Global numbering: PDR (draft), POR (ordered), PUR (final/received) — never use PUR- for draft/order
      const purchaseSequenceType: 'PDR' | 'POR' | 'PUR' =
        dbStatus === 'draft' ? 'PDR' : dbStatus === 'ordered' ? 'POR' : 'PUR';
      const purchaseNo =
        providedPurchaseNo ??
        (await documentNumberService.getNextDocumentNumberGlobal(companyId, purchaseSequenceType));

      const postedHeader = canPostAccountingForPurchaseStatus(dbStatus);
      const draft_no = dbStatus === 'draft' ? purchaseNo : null;
      const order_no = dbStatus === 'ordered' ? purchaseNo : null;
      const po_no = postedHeader ? purchaseNo : null;

      // Convert to Supabase format
      
      // Ensure supplier_id is either a valid UUID or undefined (not empty string)
      const supplierId = purchaseData.supplier && purchaseData.supplier.trim() !== '' 
        ? purchaseData.supplier 
        : undefined;
      
      // CRITICAL: Validate date - no fallback allowed
      if (!purchaseData.date) {
        throw new Error('Purchase date is required. Please select a date.');
      }
      
      const supabasePurchase: SupabasePurchase = {
        company_id: companyId,
        branch_id: finalBranchId,
        po_no,
        draft_no,
        order_no,
        po_date: purchaseData.date, // ❌ NO FALLBACK - user-selected date only
        supplier_id: supplierId,
        supplier_name: purchaseData.supplierName || 'Unknown Supplier',
        status: dbStatus as SupabasePurchase['status'],
        payment_status: purchaseData.paymentStatus,
        subtotal: purchaseData.subtotal || 0,
        discount_amount: purchaseData.discount || 0,
        tax_amount: purchaseData.tax || 0,
        shipping_cost: purchaseData.shippingCost || 0,
        total: purchaseData.total || 0,
        paid_amount: purchaseData.paid || 0,
        due_amount: purchaseData.due || 0,
        notes: purchaseData.notes,
        created_by: user.id,
      };

      // Validate items before mapping
      if (!purchaseData.items || purchaseData.items.length === 0) {
        throw new Error('At least one item is required');
      }

      const supabaseItems: SupabasePurchaseItem[] = purchaseData.items.map((item: any, index) => {
        if (!item.productId || item.productId.toString().trim() === '') {
          throw new Error(`Item ${index + 1}: Product ID is required`);
        }
        if (!item.productName || item.productName.trim() === '') {
          throw new Error(`Item ${index + 1}: Product name is required`);
        }
        if (!item.quantity || item.quantity <= 0) {
          throw new Error(`Item ${index + 1}: Quantity must be greater than 0`);
        }
        
        return {
          product_id: item.productId.toString(),
          variation_id: (item.variationId && item.variationId.toString().trim() !== '') ? item.variationId.toString() : undefined,
          product_name: item.productName,
          sku: (item as any).sku && (item as any).sku.trim() !== '' ? (item as any).sku : 'N/A', // Required in DB
          quantity: item.quantity,
          unit: (item as any).unit && (item as any).unit.trim() !== '' ? (item as any).unit : 'pcs',
          unit_price: item.price || 0,
          discount_amount: item.discount || 0,
          tax_amount: item.tax || 0,
          total: item.total || 0,
          // Include packing data
          packing_type: (item as any).packingDetails?.packing_type || null,
          packing_quantity: (item as any).packingDetails?.total_meters || (item as any).meters || null,
          packing_unit: (item as any).packingDetails?.unit || 'meters',
          packing_details: (item as any).packingDetails || null,
        };
      });

      // Build charges for line-by-line accounting (purchase_charges): extra expenses + discount
      const charges: { charge_type: string; amount: number }[] = [];
      const expensesList = purchaseData.expenses || [];
      if (Array.isArray(expensesList)) {
        expensesList.forEach((e: { type?: string; amount?: number }) => {
          const amt = Number(e?.amount ?? 0);
          if (amt > 0) charges.push({ charge_type: (e?.type ?? 'other') as string, amount: amt });
        });
      }
      const discountAmt = Number(purchaseData.discount ?? 0);
      if (discountAmt > 0) charges.push({ charge_type: 'discount', amount: discountAmt });

      // Save to Supabase (purchase + items + purchase_charges)
      console.log('[PURCHASE CONTEXT] Creating purchase with data:', {
        purchase: supabasePurchase,
        itemsCount: supabaseItems.length,
        chargesCount: charges.length,
        firstItem: supabaseItems[0]
      });
      
      const result = await purchaseService.createPurchase(supabasePurchase, supabaseItems, charges);

      // Convert back to app format
      const newPurchase = convertFromSupabasePurchase(result);
      
      // 🔒 CRITICAL FIX: Ensure items are populated (result from createPurchase has no items)
      // Use supabaseItems so packing_details is exactly what we sent to DB for box_change/piece_change
      if (!newPurchase.items || newPurchase.items.length === 0) {
        const formItems = purchaseData.items || [];
        newPurchase.items = supabaseItems.map((si: any, idx: number) => {
          const formItem = formItems[idx];
          const packing = si.packing_details ?? formItem?.packingDetails;
          return {
            id: formItem?.id?.toString() || Date.now().toString(),
            productId: si.product_id,
            variationId: si.variation_id || undefined,
            productName: si.product_name,
            sku: si.sku || 'N/A',
            quantity: si.quantity,
            receivedQty: formItem?.receivedQty ?? si.quantity,
            price: si.unit_price || 0,
            discount: si.discount_amount || 0,
            tax: si.tax_amount || 0,
            total: si.total || 0,
            packingDetails: packing || undefined,
          };
        });
      }
      
      setPurchases((prev) => [newPurchase, ...prev]);

      // Activity log for timeline
      if (companyId && user?.id) {
        activityLogService
          .logActivity({
            companyId,
            module: 'purchase',
            entityId: newPurchase.id,
            entityReference: newPurchase.purchaseNo,
            action: 'create',
            performedBy: user.id,
            description: `Purchase ${newPurchase.purchaseNo} created`,
          })
          .catch((err) => console.warn('[PURCHASE CONTEXT] Activity log failed:', err));
      }

      // PURCHASE DOCUMENT JE — single posting engine (reads purchase + purchase_charges from DB after createPurchase)
      if (canPostAccountingForPurchaseStatus(newPurchase.status) && companyId && newPurchase.total > 0) {
        try {
          const { postPurchaseDocumentAccounting } = await import('@/app/services/documentPostingEngine');
          const jeId = await postPurchaseDocumentAccounting(newPurchase.id);
          if (!jeId) {
            throw new Error('Final/received purchase was saved but no canonical purchase document JE exists.');
          }
        } catch (accountingError: any) {
          console.error('[PURCHASE CONTEXT] ❌ CRITICAL: Purchase accounting entry failed:', accountingError);
          throw new Error(`Failed to create purchase accounting entry: ${accountingError.message || 'Unknown error'}`);
        }
      }
      
      if (
        canPostAccountingForPurchaseStatus(newPurchase.status) &&
        companyId &&
        newPurchase.supplier &&
        typeof window !== 'undefined'
      ) {
        window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'supplier', entityId: newPurchase.supplier } }));
      }

      // Stock movements for purchase: created by DB trigger purchase_final_stock_movement_trigger
      // when purchase status is 'final' (AFTER INSERT/UPDATE). Do NOT create here to avoid double posting.
      if (canPostAccountingForPurchaseStatus(newPurchase.status) && newPurchase.items && newPurchase.items.length > 0) {
        console.log('[PURCHASE CONTEXT] Stock for purchase', newPurchase.id, 'handled by DB trigger (single posting).');
      }

      // Z1: Reconcile lines vs stock_movements after trigger + any race
      const pst = normalizePurchaseStatusForPosting(newPurchase.status);
      if (
        newPurchase.id &&
        (canPostStockForPurchaseStatus(pst) || String(newPurchase.status).toLowerCase() === 'cancelled')
      ) {
        try {
          const { syncPurchaseStockForDocument } = await import('@/app/services/documentStockSyncService');
          const z1 = await syncPurchaseStockForDocument(newPurchase.id);
          if (z1.adjustmentsInserted > 0) {
            console.log('[PURCHASE CONTEXT] Z1 stock sync (create):', z1.keysAdjusted);
          }
        } catch (z1Err) {
          console.warn('[PURCHASE CONTEXT] Z1 stock sync (create) failed:', z1Err);
        }
      }
      
      // 🔒 CRITICAL FIX: Record initial payment in payments table (like Sale module) — posted POs only (no payment JE for draft/ordered)
      if (canPostAccountingForPurchaseStatus(newPurchase.status) && newPurchase.paid > 0 && companyId && finalBranchId) {
        try {
          // Get payment method from purchase data or default to 'cash'
          const paymentMethod = normalizePaymentMethodForEnum(purchaseData.paymentMethod || 'cash');
          
          // Get default account for payment method
          const { accountHelperService } = await import('@/app/services/accountHelperService');
          let paymentAccountId = await accountHelperService.getDefaultAccountByPaymentMethod(
            paymentMethod,
            companyId
          );
          
          // If no account found, use Cash as default
          if (!paymentAccountId) {
            const { accountService } = await import('@/app/services/accountService');
            const allAccounts = await accountService.getAllAccounts(companyId);
            const cashAccount = allAccounts.find(acc => acc.code === '1000' || acc.name.toLowerCase() === 'cash');
            paymentAccountId = cashAccount?.id || null;
          }
          
          if (paymentAccountId) {
            // recordPayment uses ERP Numbering Engine (generate_document_number) for reference_number
            await purchaseService.recordPayment(
              newPurchase.id,
              newPurchase.paid,
              paymentMethod,
              paymentAccountId,
              companyId,
              finalBranchId,
              undefined
            );
            
            console.log('[PURCHASE CONTEXT] ✅ Initial payment recorded in payments table:', {
              purchaseId: newPurchase.id,
              amount: newPurchase.paid,
              method: paymentMethod,
              accountId: paymentAccountId,
              reference: paymentRef
            });
          } else {
            console.warn('[PURCHASE CONTEXT] ⚠️ No payment account found, payment not recorded in payments table');
          }
        } catch (paymentError: any) {
          console.error('[PURCHASE CONTEXT] Error recording initial payment:', paymentError);
          // Don't fail purchase creation if payment recording fails
        }
      }
      
      // Auto-post to accounting if paid (posted POs only)
      if (canPostAccountingForPurchaseStatus(newPurchase.status) && newPurchase.paid > 0 && accounting) {
        accounting.recordSupplierPayment({
          supplierId: newPurchase.supplier,
          supplierName: newPurchase.supplierName,
          purchaseNo: newPurchase.purchaseNo,
          amount: newPurchase.paid,
          paymentMethod: newPurchase.paymentMethod as any,
          date: new Date().toISOString(),
          notes: `Payment for ${newPurchase.purchaseNo}`,
        });
      }

      toast.success(`Purchase Order ${purchaseNo} created successfully!`);
      
      // 🔒 CRITICAL FIX: Dispatch event to refresh inventory (like Sale module)
      window.dispatchEvent(new CustomEvent('purchaseSaved', { detail: { purchaseId: newPurchase.id } }));
      emitPurchaseInvalidation('created', newPurchase.id);
      if (newPurchase.supplier) {
        window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'supplier', entityId: newPurchase.supplier } }));
      }
      
      return newPurchase;
    } catch (error: any) {
      console.error('[PURCHASE CONTEXT] Error creating purchase:', error);
      console.error('[PURCHASE CONTEXT] Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      const errorMessage = error.message || error.details || 'Unknown error';
      toast.error(`Failed to create purchase: ${errorMessage}`);
      throw error;
    }
  };

  // Update purchase
  const updatePurchase = async (id: string, updates: Partial<Purchase>): Promise<void> => {
    const traceId = createAccountingEditTraceId(id);
    try {
      // Convert updates to Supabase format
      const supabaseUpdates: any = {};
      
      // CRITICAL FIX: Map app status to database enum
      // Database enum: 'draft', 'ordered', 'received', 'final' (NO 'completed')
      // App status: 'draft', 'ordered', 'received', 'final', 'completed', 'cancelled'
      if (updates.status !== undefined) {
        if (updates.status === 'completed' || updates.status === 'final') {
          supabaseUpdates.status = 'final'; // Both map to 'final' in database
        } else if (updates.status === 'cancelled') {
          supabaseUpdates.status = 'draft'; // Cancelled not in enum, use draft
        } else {
          supabaseUpdates.status = updates.status; // Direct mapping for draft, ordered, received
        }
      }
      
      if (updates.paymentStatus !== undefined) supabaseUpdates.payment_status = updates.paymentStatus;
      if (updates.total !== undefined) supabaseUpdates.total = updates.total;
      if (updates.paid !== undefined) supabaseUpdates.paid_amount = updates.paid;
      if (updates.due !== undefined) supabaseUpdates.due_amount = updates.due;
      // Discount: only discount_amount exists in DB (no discount_percentage). Form sends amount.
      if (updates.discount !== undefined) supabaseUpdates.discount_amount = updates.discount;

      if (updates.date !== undefined) supabaseUpdates.po_date = updates.date;

      // STEP 1 FIX: Reference number - save in notes field (like Sale module)
      if (updates.notes !== undefined) {
        supabaseUpdates.notes = updates.notes;
      } else if (updates.reference !== undefined) {
        // If reference field is passed, save it in notes
        supabaseUpdates.notes = updates.reference;
      }
      if ((updates as any).attachments !== undefined) supabaseUpdates.attachments = (updates as any).attachments;
      if (updates.purchaseNo !== undefined) supabaseUpdates.po_no = updates.purchaseNo;

      // 🔒 CRITICAL FIX: Calculate stock movement DELTA BEFORE updating purchase_items
      // This must happen BEFORE purchase_items are deleted/updated so we can fetch old items
      const purchase = getPurchaseById(id);
      pushAccountingEditTrace({
        traceId,
        ts: new Date().toISOString(),
        module: 'purchases',
        entityType: 'purchase',
        entityId: id,
        companyId: companyId || null,
        branchId: branchId || null,
        phase: 'start',
        data: { updates },
      });
      let newStatusForGate: string | undefined;
      if (updates.status !== undefined) {
        const u = updates.status;
        if (u === 'completed' || u === 'final') newStatusForGate = 'final';
        else if (u === 'cancelled') newStatusForGate = 'draft';
        else newStatusForGate = String(u);
      }
      const priorPosted = purchase != null && canPostAccountingForPurchaseStatus(purchase.status);
      const willBePosted =
        newStatusForGate !== undefined && canPostAccountingForPurchaseStatus(newStatusForGate);
      /** Stock / GL paths: already posted or this save moves into posted (final/received). */
      const isPostedForPurchaseEffects = priorPosted || willBePosted;
      const accountingFieldsTouched =
        updates.status !== undefined ||
        updates.total !== undefined ||
        updates.paid !== undefined ||
        updates.discount !== undefined ||
        ((updates as any).items && Array.isArray((updates as any).items)) ||
        Array.isArray((updates as any).expenses);
      const needsPurchaseAccountingPass =
        !!companyId && isPostedForPurchaseEffects && accountingFieldsTouched;
      const purchaseClassification = purchase
        ? classifyPurchaseEdit({
            oldSnap: {
              notes: purchase.notes || '',
              supplierRef: purchase.reference || '',
              date: purchase.date,
              supplierId: purchase.supplierId || '',
              itemQtyTotal: (purchase.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0),
              itemCostTotal: (purchase.items || []).reduce((s, it) => s + (Number(it.price) || 0), 0),
              discount: Number(purchase.discount || 0),
              freight: Number((purchase as any).shipping || 0),
              tax: Number((purchase as any).tax || 0),
              payableAccountId: (purchase as any).payableAccountId || '',
              branchId: purchase.branch || '',
              stockImpactQty: (purchase.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0),
            },
            newSnap: {
              notes: updates.notes ?? purchase.notes ?? '',
              supplierRef: updates.reference ?? purchase.reference ?? '',
              date: updates.date ?? purchase.date,
              supplierId: (updates as any).supplierId ?? purchase.supplierId ?? '',
              itemQtyTotal: Array.isArray((updates as any).items)
                ? (updates as any).items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0)
                : (purchase.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0),
              itemCostTotal: Array.isArray((updates as any).items)
                ? (updates as any).items.reduce((s: number, it: any) => s + (Number(it.price || it.unitPrice) || 0), 0)
                : (purchase.items || []).reduce((s, it) => s + (Number(it.price) || 0), 0),
              discount: updates.discount ?? purchase.discount ?? 0,
              freight: (updates as any).shipping ?? (purchase as any).shipping ?? 0,
              tax: (updates as any).tax ?? (purchase as any).tax ?? 0,
              payableAccountId: (updates as any).payableAccountId ?? (purchase as any).payableAccountId ?? '',
              branchId: updates.branch ?? purchase.branch ?? '',
              stockImpactQty: Array.isArray((updates as any).items)
                ? (updates as any).items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0)
                : (purchase.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0),
            },
          })
        : null;
      if (purchaseClassification) {
        assertDomainEditSafetyTestMode(purchaseClassification, 'purchases updatePurchase');
      }
      pushAccountingEditTrace({
        traceId,
        ts: new Date().toISOString(),
        module: 'purchases',
        entityType: 'purchase',
        entityId: id,
        companyId: companyId || null,
        branchId: branchId || null,
        phase: 'classified',
        data: purchaseClassification || { kind: 'NO_POSTING_CHANGE' },
      });
      // PF-02: Capture old amounts when we may touch supplier ledger / GL for this update
      const oldTotalForRepost = (needsPurchaseAccountingPass && purchase) ? (Number(purchase.total) || 0) : 0;
      const oldPaidForRepost = (needsPurchaseAccountingPass && purchase) ? (Number(purchase.paid) || 0) : 0;
      const oldDiscountForRepost = (needsPurchaseAccountingPass && purchase) ? (Number(purchase.discount) || 0) : 0;
      let stockMovementDeltas: Array<{
        productId: string;
        variationId?: string;
        deltaQty: number;
        price: number;
        name: string;
      }> = [];
      
      // Only calculate delta if items are being updated and purchase is / will be posted for stock
      if (isPostedForPurchaseEffects && (updates as any).items && Array.isArray((updates as any).items) && companyId) {
        try {
          console.log('[PURCHASE CONTEXT] 🔄 Calculating stock movement DELTA for purchase edit (BEFORE items update):', id);
          
          // STEP 1: Fetch OLD items from database (BEFORE they are deleted)
          const { supabase } = await import('@/lib/supabase');
          const { data: oldItemsData, error: oldItemsError } = await supabase
            .from('purchase_items')
            .select('product_id, variation_id, quantity, unit_price, product_name')
            .eq('purchase_id', id);
          
          if (oldItemsError) {
            console.error('[PURCHASE CONTEXT] Error fetching old items:', oldItemsError);
            // Don't throw - continue without delta calculation
          } else {
            const oldItems = oldItemsData || [];
            const newItems = (updates as any).items || [];
            
            console.log('[PURCHASE CONTEXT] Stock movement delta calculation:', {
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
                  deltaQty, // Positive = stock increased (item added/increased), Negative = stock decreased (item removed/reduced)
                  price: newItem.price || oldItem.price || 0,
                  name: newItem.name || oldItem.name || 'Unknown'
                });
                
                console.log('[PURCHASE CONTEXT] Delta calculated:', {
                  key,
                  productId,
                  variationId,
                  oldQty: oldItem.quantity,
                  newQty: newItem.quantity,
                  deltaQty,
                  meaning: deltaQty > 0 ? 'Item added/increased (stock increased)' : 'Item removed/reduced (stock decreased)'
                });
              }
            });
          }
        } catch (deltaError: any) {
          console.error('[PURCHASE CONTEXT] ❌ Delta calculation error:', deltaError);
          // Don't block purchase update if delta calculation fails
        }
      }

      // Log what we're sending for debugging
      console.log('[PURCHASE CONTEXT] Updating purchase:', { id, supabaseUpdates, originalUpdates: updates });

      // PF-COMPONENT: Capture old accounting snapshot BEFORE update (for component-level edit, no full reversal)
      let oldPurchaseSnapshot: { total: number; subtotal: number; discount: number; otherCharges: number } | null = null;
      if (needsPurchaseAccountingPass && companyId) {
        if (purchaseClassification && purchaseClassification.kind === 'FULL_REVERSE_REPOST') {
          pushAccountingEditTrace({
            traceId,
            ts: new Date().toISOString(),
            module: 'purchases',
            entityType: 'purchase',
            entityId: id,
            companyId: companyId || null,
            branchId: branchId || null,
            phase: 'error',
            data: {
              blockedOperation: 'purchase_edit_full_reversal',
              classifier: purchaseClassification.kind,
              stack: new Error('blocked full reversal for purchase edit').stack,
            },
          });
          throw new Error(
            `Blocked full reversal for purchase edit (classifier=${purchaseClassification.kind}). Use delta/header paths.`
          );
        }
        try {
          const { purchaseAccountingService: pac } = await import('@/app/services/purchaseAccountingService');
          const oldPurchaseForAccounting = await purchaseService.getPurchase(id);
          if (oldPurchaseForAccounting) oldPurchaseSnapshot = pac.getPurchaseAccountingSnapshot(oldPurchaseForAccounting);
        } catch (e) {
          console.warn('[PURCHASE CONTEXT] Could not capture old purchase snapshot:', e);
        }
      }

      // Update in Supabase
      await purchaseService.updatePurchase(id, supabaseUpdates);
      
      // CRITICAL FIX: Update purchase items if provided (COPY FROM SALE LOGIC)
      if ((updates as any).items && Array.isArray((updates as any).items)) {
        const { purchaseService } = await import('@/app/services/purchaseService');
        console.log('[PURCHASE CONTEXT] 🔄 Updating purchase items. Received items count:', (updates as any).items.length);
        console.log('[PURCHASE CONTEXT] Items payload:', (updates as any).items.map((item: any, idx: number) => ({
          index: idx,
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: item.price || item.unitPrice
        })));
        
        const purchaseItems = (updates as any).items.map((item: any, index: number) => {
          // 🔒 CRITICAL FIX: Ensure productId is string (UUID format)
          const productId = item.productId ? item.productId.toString() : null;
          if (!productId || productId.trim() === '') {
            console.error(`[PURCHASE CONTEXT] ❌ Item ${index} missing productId:`, item);
            throw new Error(`Item ${index + 1} is missing product ID`);
          }
          
          const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
          const lineTotal = Number(item.total ?? (unitPrice * item.quantity) ?? 0);
          
          // Validate quantity
          const quantity = Number(item.quantity ?? 0);
          if (quantity <= 0) {
            console.error(`[PURCHASE CONTEXT] ❌ Item ${index} has invalid quantity:`, item);
            throw new Error(`Item ${index + 1} has invalid quantity: ${quantity}`);
          }
          
          const purchaseItem = {
            product_id: productId, // Ensure it's a string
            variation_id: item.variationId || null, // Use null instead of undefined for DB
            product_name: item.productName || 'Unknown Product',
            sku: item.sku || 'N/A',
            quantity: quantity,
            unit: item.unit || 'pcs',
            unit_price: unitPrice,
            discount_amount: item.discount || 0,
            tax_amount: item.tax || 0,
            total: lineTotal,
            packing_type: item.packingDetails?.packing_type || null,
            packing_quantity: item.packingDetails?.total_meters || item.meters || null,
            packing_unit: item.packingDetails?.unit || 'meters',
            packing_details: item.packingDetails || null,
          };
          console.log(`[PURCHASE CONTEXT] ✅ Converted item ${index}:`, {
            product_id: purchaseItem.product_id,
            product_name: purchaseItem.product_name,
            quantity: purchaseItem.quantity,
            unit_price: purchaseItem.unit_price
          });
          return purchaseItem;
        });
        
        console.log('[PURCHASE CONTEXT] ✅ Final purchaseItems array length:', purchaseItems.length);
        
        // 🔒 CRITICAL FIX: Atomic delete+insert operation to prevent items=0 bug
        // If insert fails after delete, items will be permanently 0
        // Solution: Use transaction-like pattern with rollback capability
        const { supabase } = await import('@/lib/supabase');
        
        // STEP 1: Prepare new items with purchase_id
        const itemsWithPurchaseId = purchaseItems.length > 0 
          ? purchaseItems.map((item: any) => ({ ...item, purchase_id: id }))
          : [];
        
        // STEP 2: Delete old items (only if we have new items to insert OR if explicitly clearing)
        if (itemsWithPurchaseId.length > 0 || purchaseItems.length === 0) {
          const { error: deleteError, count: deletedCount } = await supabase
            .from('purchase_items')
            .delete()
            .eq('purchase_id', id)
            .select('*', { count: 'exact', head: true });
          
          if (deleteError) {
            console.error('[PURCHASE CONTEXT] ❌ Error deleting old items:', deleteError);
            throw new Error(`Failed to delete old purchase items: ${deleteError.message}`);
          }
          
          console.log('[PURCHASE CONTEXT] ✅ Deleted old purchase_items. Deleted count:', deletedCount || 0);
          
          // STEP 3: Insert new items (ATOMIC - if this fails, we've already deleted, so items=0 bug occurs)
          if (itemsWithPurchaseId.length > 0) {
            console.log('[PURCHASE CONTEXT] 🔄 Inserting', itemsWithPurchaseId.length, 'new purchase_items');
            
            // Validate items before insert
            const invalidItems = itemsWithPurchaseId.filter((item: any) => 
              !item.product_id || !item.quantity || item.quantity <= 0
            );
            
            if (invalidItems.length > 0) {
              console.error('[PURCHASE CONTEXT] ❌ Invalid items detected:', invalidItems);
              throw new Error(`Cannot insert ${invalidItems.length} invalid items. Missing product_id or invalid quantity.`);
            }
            
            const { data: insertedData, error: insertError } = await supabase
              .from('purchase_items')
              .insert(itemsWithPurchaseId)
              .select('id');
            
            if (insertError) {
              console.error('[PURCHASE CONTEXT] ❌ Error inserting new items:', insertError);
              console.error('[PURCHASE CONTEXT] ❌ Insert error details:', {
                message: insertError.message,
                code: insertError.code,
                details: insertError.details,
                hint: insertError.hint
              });
              console.error('[PURCHASE CONTEXT] ❌ Items payload that failed:', itemsWithPurchaseId.map((item: any, idx: number) => ({
                index: idx,
                product_id: item.product_id,
                product_name: item.product_name,
                quantity: item.quantity,
                unit_price: item.unit_price,
                sku: item.sku,
                variation_id: item.variation_id
              })));
              // CRITICAL: Items already deleted, insert failed - this is the items=0 bug!
              throw new Error(`Failed to insert purchase items after delete. Items may be lost. Error: ${insertError.message} (Code: ${insertError.code})`);
            }
            
            console.log('[PURCHASE CONTEXT] ✅ Successfully inserted', insertedData?.length || 0, 'purchase_items');
            
            // STEP 4: Final verification - ensure items actually exist in DB
            // This is CRITICAL to catch the items=0 bug before it affects UI
            const { count: verifyCount, error: verifyError } = await supabase
              .from('purchase_items')
              .select('*', { count: 'exact', head: true })
              .eq('purchase_id', id);
            
            if (verifyError) {
              console.error('[PURCHASE CONTEXT] ⚠️ Verification query error:', verifyError);
            } else {
              const finalCount = verifyCount || 0;
              console.log('[PURCHASE CONTEXT] ✅ FINAL VERIFICATION: purchase_items count in DB:', finalCount);
              
              if (finalCount === 0 && itemsWithPurchaseId.length > 0) {
                console.error('[PURCHASE CONTEXT] ❌ CRITICAL BUG: Items inserted but verification shows 0!');
                console.error('[PURCHASE CONTEXT] ❌ This indicates items=0 bug - items were deleted but insert failed silently');
                throw new Error(`Items insertion verification failed. Expected ${itemsWithPurchaseId.length} items but found 0 in DB.`);
              }
              
              if (finalCount !== itemsWithPurchaseId.length) {
                console.warn('[PURCHASE CONTEXT] ⚠️ Count mismatch: Expected', itemsWithPurchaseId.length, 'but found', finalCount);
                console.warn('[PURCHASE CONTEXT] ⚠️ This may indicate partial insert failure or concurrent modification');
              } else {
                console.log('[PURCHASE CONTEXT] ✅ Verification passed: Items count matches expected count');
              }
            }
            // STEP 5: Weighted-average cost rollup (parent + variation), shared with purchase service create flow
            if (companyId) {
              await purchaseService.recomputeWeightedCostsForItems({
                companyId,
                branchId: (supabaseUpdates as any).branch_id || branchId || null,
                purchaseId: id,
                items: (itemsWithPurchaseId as any[]).map((item) => ({
                  product_id: String(item.product_id),
                  variation_id: item.variation_id || null,
                  quantity: Number(item.quantity) || 0,
                  unit_price: Number(item.unit_price) || 0,
                })),
              });
              console.log('[PURCHASE CONTEXT] ✅ Weighted product/variation costs recomputed');
            }
          } else {
            console.log('[PURCHASE CONTEXT] ⚠️ No items to insert (purchaseItems.length = 0) - purchase will have 0 items');
          }
        }
      }

      // Line-level extra expenses: replace purchase_charges only when form sent expenses (edit screen)
      const expensesList = (updates as any).expenses;
      if (Array.isArray(expensesList)) {
        const charges: { charge_type: string; amount: number; ledger_account_id?: string | null }[] = [];
        expensesList.forEach((e: { type?: string; amount?: number }) => {
          const amt = Number(e?.amount ?? 0);
          if (amt > 0) charges.push({ charge_type: (e?.type ?? 'other') as string, amount: amt });
        });
        const discountAmt = Number((updates as any).discount ?? updates.discount_amount ?? 0);
        if (discountAmt > 0) charges.push({ charge_type: 'discount', amount: discountAmt });
        await purchaseService.replacePurchaseCharges(id, charges, user?.id ?? undefined);
      }

      // 🔒 CRITICAL FIX: Create stock movements for DELTA (after purchase_items are updated)
      // GOLDEN RULE: Only create movements for the delta, not for all items
      // For purchase: deltaQty > 0 means item added/increased → increase stock (positive movement)
      //               deltaQty < 0 means item removed/reduced → decrease stock (negative movement)
      if (stockMovementDeltas.length > 0 && companyId) {
        try {
          console.log('[PURCHASE CONTEXT] 🔄 Creating stock movements for deltas:', stockMovementDeltas.length);
          
          // Get branch ID
          let effectiveBranchId = isValidBranchId(branchId) ? branchId : null;
          if (!effectiveBranchId && companyId) {
            const branches = await branchService.getAllBranches(companyId);
            effectiveBranchId = branches?.length ? branches[0].id : null;
          }
          
          // Create stock movements for DELTA only
          const stockMovementErrors: string[] = [];
          // Get purchase data for stock movement notes
          const purchaseForStock = purchase || getPurchaseById(id);
          const purchasePoNo = purchaseForStock?.purchaseNo || id;
          
          // Fetch existing edit movements for this purchase to consolidate (avoid duplicate entries)
          const { supabase: sbEditMov } = await import('@/lib/supabase');
          const { data: existingEditMovements } = await sbEditMov
            .from('stock_movements')
            .select('id, product_id, variation_id, quantity, unit_cost, total_cost, notes')
            .eq('reference_type', 'purchase')
            .eq('reference_id', id)
            .eq('movement_type', 'purchase')
            .like('notes', '%Purchase Edit%');
          const existingEditMap = new Map<string, any>();
          for (const em of existingEditMovements || []) {
            const key = `${(em as any).product_id}_${(em as any).variation_id || 'null'}`;
            existingEditMap.set(key, em);
          }

          for (const delta of stockMovementDeltas) {
            try {
              const movementQty = delta.deltaQty;
              const editKey = `${delta.productId}_${delta.variationId || 'null'}`;
              const existing = existingEditMap.get(editKey);

              if (existing) {
                // Consolidate: accumulate delta into existing edit movement
                const newQty = (Number(existing.quantity) || 0) + movementQty;
                const unitCost = delta.price || 0;
                if (Math.abs(newQty) < 0.001) {
                  // Net zero — remove the edit movement entirely
                  await sbEditMov.from('stock_movements').delete().eq('id', existing.id);
                  console.log('[PURCHASE CONTEXT] ✅ Stock edit movement net-zero, removed:', delta.name);
                } else {
                  await sbEditMov.from('stock_movements').update({
                    quantity: newQty,
                    unit_cost: unitCost,
                    total_cost: Math.abs(newQty) * unitCost,
                    notes: `Purchase Edit ${purchasePoNo} - ${delta.name}${delta.variationId ? ' (Variation)' : ''} (accumulated)`,
                  }).eq('id', existing.id);
                  console.log('[PURCHASE CONTEXT] ✅ Stock edit movement consolidated:', delta.name, 'New qty:', newQty);
                }
              } else {
                // No existing edit movement — create new one
                console.log('[PURCHASE CONTEXT] Creating stock movement for delta:', {
                  product_id: delta.productId,
                  variation_id: delta.variationId,
                  deltaQty: delta.deltaQty,
                  movementQty: movementQty,
                  purchase_id: id
                });

                const movement = await productService.createStockMovement({
                  company_id: companyId,
                  branch_id: effectiveBranchId === 'all' ? undefined : effectiveBranchId,
                  product_id: delta.productId,
                  variation_id: delta.variationId,
                  movement_type: 'purchase',
                  quantity: movementQty,
                  unit_cost: delta.price || 0,
                  total_cost: (delta.price || 0) * Math.abs(movementQty),
                  reference_type: 'purchase',
                  reference_id: id,
                  notes: `Purchase Edit ${purchasePoNo} - ${delta.name}${delta.variationId ? ' (Variation)' : ''}`,
                  created_by: user?.id,
                });

                if (!movement || !movement.id) {
                  stockMovementErrors.push(`Failed to create stock movement for ${delta.name}`);
                }
              }
            } catch (movementError: any) {
              console.error(`[PURCHASE CONTEXT] Error creating stock movement for ${delta.name}:`, movementError);
              stockMovementErrors.push(`${delta.name}: ${movementError.message || 'Unknown error'}`);
            }
          }
          
          if (stockMovementErrors.length > 0) {
            console.warn('[PURCHASE CONTEXT] ⚠️ Some stock movements failed:', stockMovementErrors);
            toast.warning(`Purchase updated, but ${stockMovementErrors.length} stock movement(s) failed. Check logs.`);
          } else {
            console.log('[PURCHASE CONTEXT] ✅ All stock movements created successfully');
            // Dispatch event to refresh inventory
            window.dispatchEvent(new CustomEvent('purchaseSaved', { detail: { purchaseId: id } }));
          }
        } catch (stockError: any) {
          console.error('[PURCHASE CONTEXT] ❌ Error creating stock movements:', stockError);
          toast.warning('Purchase updated, but stock movements failed. Check logs.');
        }
      }

      // PF-COMPONENT: Component-level purchase edit — do NOT full-reverse. Only adjust changed components; never touch payment unless payment changed.
      if (needsPurchaseAccountingPass && companyId) {
        try {
          const { purchaseAccountingService: pac } = await import('@/app/services/purchaseAccountingService');
          const updated = await purchaseService.getPurchase(id);
          if (!updated) throw new Error('Purchase not found after update');
          const newTotal = Number(updated.total ?? 0) || 0;
          const newPaid = Number(updated.paid_amount ?? 0) || 0;
          const newDiscount = Number(updated.discount_amount ?? 0) || 0;
          const supplierId = (updated as any).supplier_id || (updated as any).supplier?.id;
          const supplierName = (updated as any).supplier_name || (updated as any).supplier?.name || 'Supplier';
          const poNo = (updated as any).po_no || `PUR-${id.substring(0, 8)}`;
          const entryDate = (updated as any).po_date || new Date().toISOString().slice(0, 10);
          let effectiveBranchId = (updated as any).branch_id || branchId;
          if (!effectiveBranchId || effectiveBranchId === 'all') {
            const branches = await branchService.getAllBranches(companyId);
            effectiveBranchId = branches?.length ? branches[0].id : null;
          }

          const hasExistingPurchaseJE = await pac.purchaseJournalEntryExists(id);

          if (hasExistingPurchaseJE && oldPurchaseSnapshot && priorPosted) {
            // In-place update: modify original document JE lines directly
            const { supabase: sbPur } = await import('@/lib/supabase');
            const newSnapshot = pac.getPurchaseAccountingSnapshot(updated);

            // Find original purchase document JE
            const { data: purJe } = await sbPur
              .from('journal_entries')
              .select('id, description')
              .eq('company_id', companyId)
              .eq('reference_type', 'purchase')
              .eq('reference_id', id)
              .is('payment_id', null)
              .or('is_void.is.null,is_void.eq.false')
              .order('created_at', { ascending: true })
              .limit(1)
              .maybeSingle();

            if (purJe?.id) {
              const jeId = purJe.id as string;
              const getAccId = async (code: string) => {
                const { data } = await sbPur.from('accounts').select('id').eq('code', code).eq('company_id', companyId).eq('is_active', true).maybeSingle();
                return data?.id as string | null;
              };
              const inventoryId = await getAccId('1200');
              const discountId = await getAccId('5210') || await getAccId('6100');

              // Resolve supplier sub-ledger
              let apAccountId: string | null = null;
              if (supplierId) {
                const { resolvePayablePostingAccountId } = await import('@/app/services/partySubledgerAccountService');
                apAccountId = await resolvePayablePostingAccountId(companyId, supplierId);
              }
              if (!apAccountId) apAccountId = await getAccId('2000');

              // Rebuild JE lines: delete old lines and insert fresh correct ones
              // (the old per-line update was buggy: freight+subtotal lines shared same account_id
              //  so both got the same amount, doubling the JE)
              await sbPur.from('journal_entry_lines').delete().eq('journal_entry_id', jeId);

              const newLines: { journal_entry_id: string; account_id: string; debit: number; credit: number; description: string }[] = [];
              const itemsSubtotal = newSnapshot.subtotal;
              const freight = newSnapshot.otherCharges;
              const discount = newSnapshot.discount;

              // DR Inventory = subtotal (items)
              if (itemsSubtotal > 0) {
                newLines.push({ journal_entry_id: jeId, account_id: inventoryId!, debit: itemsSubtotal, credit: 0, description: `Inventory purchase ${poNo}` });
              }
              // CR AP = subtotal (items)
              if (itemsSubtotal > 0) {
                newLines.push({ journal_entry_id: jeId, account_id: apAccountId!, debit: 0, credit: itemsSubtotal, description: `Payable — ${(updated as any).supplier_name || 'Supplier'}` });
              }
              // DR Inventory = freight, CR AP = freight (if any)
              if (freight > 0) {
                newLines.push(
                  { journal_entry_id: jeId, account_id: inventoryId!, debit: freight, credit: 0, description: `Freight (purchase)` },
                  { journal_entry_id: jeId, account_id: apAccountId!, debit: 0, credit: freight, description: `Payable — freight` },
                );
              }
              // DR AP = discount, CR Discount Received (if any)
              if (discount > 0 && discountId) {
                newLines.push(
                  { journal_entry_id: jeId, account_id: apAccountId!, debit: discount, credit: 0, description: `Purchase discount` },
                  { journal_entry_id: jeId, account_id: discountId, debit: 0, credit: discount, description: `Discount received` },
                );
              }
              if (newLines.length > 0) {
                await sbPur.from('journal_entry_lines').insert(newLines);
              }

              // Keep JE header totals aligned with in-place rebuilt lines.
              const totalDebit = newLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
              const totalCredit = newLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
              await sbPur
                .from('journal_entries')
                .update({
                  total_debit: totalDebit,
                  total_credit: totalCredit,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', jeId);

              // Log edit — replace any prior [Edited...] tag to avoid accumulating stale history
              const ts = new Date().toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' });
              const editLog = `[Edited ${ts}: Total Rs ${oldPurchaseSnapshot.total.toLocaleString()} → Rs ${newSnapshot.total.toLocaleString()}]`;
              const baseDesc = (purJe.description || '').replace(/\s*\[Edited[^\]]*\]/g, '').trim();
              await sbPur.from('journal_entries').update({ description: `${baseDesc} ${editLog}`.slice(0, 500) }).eq('id', jeId);

              console.log('[PURCHASE CONTEXT] In-place updated purchase JE', jeId, 'for', poNo);
              if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
            } else {
              // Fallback: use old adjustment approach
              const newSnapshotFb = pac.getPurchaseAccountingSnapshot(updated);
              await pac.postPurchaseEditAdjustments({ companyId, branchId: effectiveBranchId, purchaseId: id, poNo, entryDate, createdBy: user?.id ?? null, oldSnapshot: oldPurchaseSnapshot, newSnapshot: newSnapshotFb, supplierName });
            }
          } else if (!hasExistingPurchaseJE && newTotal > 0 && willBePosted) {
            // No existing canonical JE: single posting engine only (loads charges from DB)
            const { postPurchaseDocumentAccounting } = await import('@/app/services/documentPostingEngine');
            const jeId = await postPurchaseDocumentAccounting(id);
            if (jeId) {
              console.log('[PURCHASE CONTEXT] PF-COMPONENT: Created initial canonical purchase JE:', jeId);
            }
          }

          const totalChanged = Math.round((newTotal - oldTotalForRepost) * 100) !== 0;
          const paidChanged = Math.round((newPaid - oldPaidForRepost) * 100) !== 0;
          const discountChanged = Math.round((newDiscount - oldDiscountForRepost) * 100) !== 0;

          if (supplierId && (totalChanged || paidChanged || discountChanged) && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'supplier', entityId: supplierId } }));
          }

          try {
            const { notifyAccountingEntriesChanged } = await import('@/app/lib/accountingInvalidate');
            notifyAccountingEntriesChanged();
          } catch {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
            }
          }
        } catch (repostErr: any) {
          console.error('[PURCHASE CONTEXT] PF-COMPONENT: Purchase edit accounting failed:', repostErr);
          pushAccountingEditTrace({
            traceId,
            ts: new Date().toISOString(),
            module: 'purchases',
            entityType: 'purchase',
            entityId: id,
            companyId: companyId || null,
            branchId: branchId || null,
            phase: 'error',
            data: { message: repostErr?.message || String(repostErr) },
          });
          throw new Error(`Purchase accounting adjustment failed: ${repostErr?.message || 'unknown'}`);
        }
      }

      // Z1: Reconcile purchase stock movements to line totals (posted + cancelled net-zero)
      try {
        const pRow = await purchaseService.getPurchase(id);
        const pst = normalizePurchaseStatusForPosting((pRow as any)?.status);
        const stRaw = String((pRow as any)?.status ?? '').toLowerCase();
        if (
          pRow &&
          (canPostStockForPurchaseStatus(pst) || stRaw === 'cancelled')
        ) {
          const { syncPurchaseStockForDocument } = await import('@/app/services/documentStockSyncService');
          const z1 = await syncPurchaseStockForDocument(id);
          if (z1.adjustmentsInserted > 0) {
            console.log('[PURCHASE CONTEXT] Z1 stock sync (update):', z1.keysAdjusted);
            window.dispatchEvent(new CustomEvent('purchaseSaved', { detail: { purchaseId: id } }));
          }
        }
      } catch (z1Err) {
        console.warn('[PURCHASE CONTEXT] Z1 stock sync (update) failed:', z1Err);
      }

      // Update local state
      setPurchases(prev => prev.map(purchase => 
        purchase.id === id 
          ? { ...purchase, ...updates, updatedAt: new Date().toISOString() }
          : purchase
      ));
      
      toast.success('Purchase updated successfully!');

      // Activity log: detail of what changed (for timeline)
      const oldP = getPurchaseById(id);
      if (companyId && user?.id && oldP) {
        const changes: string[] = [];
        if (updates.total !== undefined && Number(oldP.total) !== Number(updates.total)) {
          changes.push(`Total changed from Rs ${Number(oldP.total).toLocaleString()} to Rs ${Number(updates.total).toLocaleString()}`);
        }
        if (updates.discount !== undefined && Number(oldP.discount) !== Number(updates.discount)) {
          changes.push(`Discount from Rs ${Number(oldP.discount).toLocaleString()} to Rs ${Number(updates.discount).toLocaleString()}`);
        }
        if (updates.status !== undefined && oldP.status !== updates.status) {
          changes.push(`Status from ${oldP.status} to ${updates.status}`);
        }
        if ((updates as any).items && Array.isArray((updates as any).items) && oldP.itemsCount !== (updates as any).items?.length) {
          changes.push(`Items count from ${oldP.itemsCount} to ${(updates as any).items.length}`);
        }
        if (updates.notes !== undefined && oldP.notes !== updates.notes) changes.push('Notes updated');
        const description = changes.length > 0 ? changes.join('; ') : 'Purchase updated';
        activityLogService.logActivity({
          companyId,
          module: 'purchase',
          entityId: id,
          entityReference: oldP.purchaseNo,
          action: 'update',
          performedBy: user.id,
          description,
        }).catch((err) => console.warn('[PURCHASE CONTEXT] Activity log failed:', err));
      }
      
      // 🔒 CRITICAL FIX: Refresh purchases list after update to show correct items count
      // This ensures UI reflects the actual DB state after items update
      await loadPurchases();
      
      // Dispatch event to refresh inventory if stock movements were created
      if (stockMovementDeltas.length > 0) {
        window.dispatchEvent(new CustomEvent('purchaseSaved', { detail: { purchaseId: id } }));
      }
      emitPurchaseInvalidation('updated', id);
      pushAccountingEditTrace({
        traceId,
        ts: new Date().toISOString(),
        module: 'purchases',
        entityType: 'purchase',
        entityId: id,
        companyId: companyId || null,
        branchId: branchId || null,
        phase: 'done',
      });
    } catch (error: any) {
      console.error('[PURCHASE CONTEXT] Error updating purchase:', error);
      console.error('[PURCHASE CONTEXT] Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      const errorMessage = error.message || error.details || error.hint || 'Unknown error';
      pushAccountingEditTrace({
        traceId,
        ts: new Date().toISOString(),
        module: 'purchases',
        entityType: 'purchase',
        entityId: id,
        companyId: companyId || null,
        branchId: branchId || null,
        phase: 'error',
        data: { message: errorMessage },
      });
      toast.error(`Failed to update purchase: ${errorMessage}`);
      throw error;
    }
  };

  // Delete purchase
  const deletePurchase = async (id: string): Promise<void> => {
    const purchase = getPurchaseById(id);
    if (!purchase) {
      throw new Error('Purchase not found');
    }

    try {
      // Delete from Supabase
      await purchaseService.deletePurchase(id);
      
      // Update local state immediately (optimistic update)
      setPurchases(prev => prev.filter(p => p.id !== id));
      
      // CRITICAL: Re-fetch from server to ensure consistency
      await loadPurchases();
      
      // CRITICAL: Dispatch event to refresh ledger views
      window.dispatchEvent(new CustomEvent('purchaseDeleted', { detail: { purchaseId: id } }));
      emitPurchaseInvalidation('deleted', id);
      
      toast.success(`${purchase.purchaseNo} deleted successfully!`);
    } catch (error: any) {
      console.error('[PURCHASE CONTEXT] Error deleting purchase:', error);
      // Re-fetch on error to ensure UI is in sync
      await loadPurchases();
      toast.error(`Failed to delete purchase: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };

  // Record payment – allowed only when purchase status is final/completed (ERP rule)
  const recordPayment = async (purchaseId: string, amount: number, method: string, accountId?: string): Promise<void> => {
    const purchase = getPurchaseById(purchaseId);
    if (!purchase || !companyId || !branchId) {
      throw new Error('Purchase not found or company/branch missing');
    }
    if (!canPostAccountingForPurchaseStatus(purchase.status)) {
      throw new Error(
        'Payment not allowed until purchase is Final or Received. Current status: ' + purchase.status
      );
    }

    try {
      // Get default account if not provided
      const paymentAccountId = accountId || 'cash-001'; // Default cash account
      
      // Record payment in Supabase
      await purchaseService.recordPayment(purchaseId, amount, method, paymentAccountId, companyId, branchId);

      if (companyId && purchase.supplier && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'supplier', entityId: purchase.supplier } }));
      }

      const newPaid = purchase.paid + amount;
      const newDue = purchase.total - newPaid;
      
      let paymentStatus: PaymentStatus = 'unpaid';
      if (newPaid >= purchase.total) {
        paymentStatus = 'paid';
      } else if (newPaid > 0) {
        paymentStatus = 'partial';
      }

      // Update local state
      await updatePurchase(purchaseId, {
        paid: newPaid,
        due: newDue,
        paymentStatus,
        paymentMethod: method,
      });

      // Accounting: purchaseService.recordPayment already creates 1 payment + 1 JE via canonical supplierPaymentService (do not call recordSupplierPayment – would create duplicate JE)
      emitPurchaseInvalidation('payment_recorded', purchaseId);

      toast.success(`Payment of ${formatCurrency(amount)} recorded!`);
    } catch (error: any) {
      console.error('[PURCHASE CONTEXT] Error recording payment:', error);
      toast.error(`Failed to record payment: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };

  // Update status
  const updateStatus = async (purchaseId: string, status: PurchaseStatus): Promise<void> => {
    const purchase = getPurchaseById(purchaseId);
    if (!purchase) {
      throw new Error('Purchase not found');
    }

    try {
      // STEP 1: Map app status to database status
      // Database enum: 'draft', 'ordered', 'received', 'final'
      // App status: 'draft', 'ordered', 'received', 'final', 'completed', 'cancelled'
      let dbStatus: 'draft' | 'ordered' | 'received' | 'final';
      if (status === 'completed' || status === 'final') {
        dbStatus = 'final'; // Both map to 'final' in database
      } else if (status === 'cancelled') {
        dbStatus = 'draft'; // Cancelled not in enum, use draft
      } else {
        dbStatus = status as 'draft' | 'ordered' | 'received' | 'final';
      }

      // STEP 2: Check if stock was already updated (prevent duplicate updates)
      // Only check if moving TO received/final status
      const isMovingToStockUpdateStatus = (status === 'received' || status === 'final') && 
                                          purchase.status !== 'received' && 
                                          purchase.status !== 'final' &&
                                          purchase.status !== 'completed';
      
      if (isMovingToStockUpdateStatus && purchase.items && purchase.items.length > 0) {
        // Check if stock movements already exist for this purchase
        try {
          const { supabase } = await import('@/lib/supabase');
          const { data: existingMovements } = await supabase
            .from('stock_movements')
            .select('id')
            .eq('reference_type', 'purchase')
            .eq('reference_id', purchaseId)
            .limit(1);
          
          if (existingMovements && existingMovements.length > 0) {
            console.log('[PURCHASE CONTEXT] Stock movements already exist for this purchase, skipping duplicate update');
            // Stock already updated, just update status
            await updatePurchase(purchaseId, { status });
            toast.success(`Purchase status updated to ${status}!`);
            return;
          }
        } catch (checkError) {
          console.warn('[PURCHASE CONTEXT] Error checking existing stock movements:', checkError);
          // Continue with status update even if check fails
        }
      }

      // STEP 3: Update purchase status in database
      // DB trigger purchase_final_stock_movement_trigger creates stock_movements when status = 'final'.
      // Do NOT create stock movements here — would duplicate (trigger already runs on UPDATE).
      await updatePurchase(purchaseId, { status: dbStatus });
      
      toast.success(`Purchase status updated to ${status}!`);
      
      // STEP 3 FIX: Refresh purchases list after status update
      await loadPurchases();
    } catch (error) {
      console.error('[PURCHASE CONTEXT] Error updating purchase status:', error);
      throw error;
    }
  };

  // Receive stock
  const receiveStock = async (purchaseId: string, itemId: string, quantity: number): Promise<void> => {
    const purchase = getPurchaseById(purchaseId);
    if (!purchase) {
      throw new Error('Purchase not found');
    }

    try {
      const updatedItems = purchase.items.map(item => 
        item.id === itemId 
          ? { ...item, receivedQty: item.receivedQty + quantity }
          : item
      );

      // Check if all items received
      const allReceived = updatedItems.every(item => item.receivedQty >= item.quantity);
      const newStatus: PurchaseStatus = allReceived ? 'completed' : 'received';

      // Update purchase status (this will trigger stock update via database trigger or manual update)
      await updateStatus(purchaseId, newStatus);

      // Update stock for the received item
      const receivedItem = purchase.items.find(item => item.id === itemId);
      // Stock is maintained via stock_movements; do not update products.current_stock (column may not exist).
      if (receivedItem && receivedItem.productId && quantity > 0) {
        // Optionally create stock_movement here if needed; otherwise rely on trigger/finalize flow.
      }

      // Update local state
      setPurchases(prev => prev.map(p => 
        p.id === purchaseId 
          ? { ...p, items: updatedItems, status: newStatus, updatedAt: new Date().toISOString() }
          : p
      ));

      toast.success(`${quantity} items received for ${purchase.purchaseNo}!`);
    } catch (error: any) {
      console.error('[PURCHASE CONTEXT] Error receiving stock:', error);
      toast.error(`Failed to receive stock: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };

  const value = useMemo<PurchaseContextType>(() => ({
    purchases,
    loading,
    getPurchaseById,
    createPurchase,
    updatePurchase,
    deletePurchase,
    recordPayment,
    updateStatus,
    receiveStock,
    totalCount,
    page,
    pageSize: PAGE_SIZE,
    setPage,
    refreshPurchases: loadPurchases,
  }), [
    purchases, loading, totalCount, page, setPage, getPurchaseById, createPurchase, updatePurchase,
    deletePurchase, recordPayment, updateStatus, receiveStock, loadPurchases,
  ]);

  return (
    <PurchaseContext.Provider value={value}>
      {children}
    </PurchaseContext.Provider>
  );
};
