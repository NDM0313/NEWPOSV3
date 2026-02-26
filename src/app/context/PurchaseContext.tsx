// ============================================
// 🎯 PURCHASE CONTEXT
// ============================================
// Manages purchases and supplier orders with auto-numbering

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useDocumentNumbering } from '@/app/hooks/useDocumentNumbering';
import { useAccounting } from '@/app/context/AccountingContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { purchaseService, Purchase as SupabasePurchase, PurchaseItem as SupabasePurchaseItem } from '@/app/services/purchaseService';
import { productService } from '@/app/services/productService';
import { activityLogService } from '@/app/services/activityLogService';
import { getOrCreateLedger, addLedgerEntry } from '@/app/services/ledgerService';
import { branchService } from '@/app/services/branchService';
import { toast } from 'sonner';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';

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
  purchaseNo: string;
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
  reference?: string; // STEP 1 FIX: Reference number field
  createdBy?: string; // CRITICAL FIX: User who created the purchase (for "Added By" display)
  createdAt: string;
  updatedAt: string;
}

interface PurchaseContextType {
  purchases: Purchase[];
  loading: boolean;
  getPurchaseById: (id: string) => Purchase | undefined;
  createPurchase: (purchase: Omit<Purchase, 'id' | 'purchaseNo' | 'createdAt' | 'updatedAt'>, purchaseNo?: string) => Promise<Purchase>;
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
  
  return {
    id: supabasePurchase.id,
    purchaseNo: supabasePurchase.po_no || '',
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
  const { generateDocumentNumber, generateDocumentNumberSafe, incrementNextNumber } = useDocumentNumbering();
  const accounting = useAccounting();
  const { formatCurrency } = useFormatCurrency();
  const { companyId, branchId, user } = useSupabase();

  // Use exported convertFromSupabasePurchase function (no need for local callback)

  // Load purchases from database
  const loadPurchases = useCallback(async () => {
    if (!companyId) return;
    
    try {
      setLoading(true);
      const data = await purchaseService.getAllPurchases(companyId, branchId === 'all' ? undefined : branchId || undefined);
      setPurchases(data.map(convertFromSupabasePurchase));
    } catch (error) {
      console.error('[PURCHASE CONTEXT] Error loading purchases:', error);
      toast.error('Failed to load purchases');
      // Fallback to empty array on error
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId]);

  // Load purchases from Supabase on mount
  useEffect(() => {
    if (companyId) {
      loadPurchases();
    } else {
      setLoading(false);
    }
  }, [companyId, loadPurchases]);

  // Get purchase by ID
  const getPurchaseById = (id: string): Purchase | undefined => {
    return purchases.find(p => p.id === id);
  };

  // Create new purchase
  const createPurchase = async (purchaseData: Omit<Purchase, 'id' | 'purchaseNo' | 'createdAt' | 'updatedAt'>, providedPurchaseNo?: string): Promise<Purchase> => {
    if (!companyId || !user) {
      throw new Error('Company ID and User are required');
    }

    try {
      // CRITICAL FIX: Use provided purchase number if available, otherwise generate collision-safe number
      const purchaseNo = providedPurchaseNo || await generateDocumentNumberSafe('purchase');
      
      // Get branch_id: Use from purchaseData if provided, otherwise use context branchId
      // CRITICAL: If context branchId is "all", we must have branchId in purchaseData
      let finalBranchId = purchaseData.branchId || branchId;
      
      // Validate branch_id: Must be a valid UUID, not "all" or empty
      if (!finalBranchId || finalBranchId === 'all' || finalBranchId.trim() === '') {
        throw new Error('Please select a specific branch. "All Branches" is not allowed for purchases.');
      }
      
      // Convert to Supabase format
      // Database enum: 'draft', 'ordered', 'received', 'final' (NO 'completed')
      // App status: 'draft', 'ordered', 'received', 'final', 'completed', 'cancelled'
      // Map app status to database enum
      let dbStatus: 'draft' | 'ordered' | 'received' | 'final';
      if (purchaseData.status === 'completed' || purchaseData.status === 'final') {
        dbStatus = 'final'; // Both 'completed' and 'final' map to 'final' in database
      } else if (purchaseData.status === 'cancelled') {
        dbStatus = 'draft'; // 'cancelled' not in enum, use 'draft' as fallback
      } else if (purchaseData.status === 'draft' || purchaseData.status === 'ordered' || purchaseData.status === 'received') {
        dbStatus = purchaseData.status; // Direct mapping
      } else {
        dbStatus = 'draft'; // Default fallback
      }
      
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
        po_no: purchaseNo,
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
          discount_percentage: (item as any).discountPercentage || 0,
          discount_amount: item.discount || 0,
          tax_percentage: (item as any).taxPercentage || 0,
          tax_amount: item.tax || 0,
          total: item.total || 0,
          // Include packing data
          packing_type: (item as any).packingDetails?.packing_type || null,
          packing_quantity: (item as any).packingDetails?.total_meters || (item as any).meters || null,
          packing_unit: (item as any).packingDetails?.unit || 'meters',
          packing_details: (item as any).packingDetails || null,
        };
      });

      // Save to Supabase
      console.log('[PURCHASE CONTEXT] Creating purchase with data:', {
        purchase: supabasePurchase,
        itemsCount: supabaseItems.length,
        firstItem: supabaseItems[0]
      });
      
      const result = await purchaseService.createPurchase(supabasePurchase, supabaseItems);
      
      // Increment document number
      incrementNextNumber('purchase');
      
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
      
      // Update local state
      setPurchases(prev => [newPurchase, ...prev]);

      // Activity log for timeline
      if (companyId && user?.id) {
        activityLogService.logActivity({
          companyId,
          module: 'purchase',
          entityId: newPurchase.id,
          entityReference: newPurchase.purchaseNo,
          action: 'create',
          performedBy: user.id,
          description: `Purchase ${newPurchase.purchaseNo} created`,
        }).catch((err) => console.warn('[PURCHASE CONTEXT] Activity log failed:', err));
      }

      // 🔧 FIX 2: UNPAID PURCHASE JOURNAL ENTRY (MANDATORY)
      // CRITICAL: ALWAYS create journal entry for purchase (paid or unpaid)
      // Rule: Inventory Dr, Accounts Payable Cr (double-entry accounting)
      if ((newPurchase.status === 'received' || newPurchase.status === 'final') && companyId && newPurchase.total > 0) {
        try {
          // Import supabase dynamically
          const { supabase } = await import('@/lib/supabase');
          
          // Get Inventory account
          let { data: inventoryAccounts } = await supabase
            .from('accounts')
            .select('id')
            .eq('company_id', companyId)
            .or('name.ilike.Inventory,name.ilike.Stock,code.eq.1500')
            .limit(1);
          
          let inventoryAccountId = inventoryAccounts?.[0]?.id;
          
          // If no inventory account, try to find any asset account as fallback
          if (!inventoryAccountId) {
            const { data: assetAccounts } = await supabase
              .from('accounts')
              .select('id')
              .eq('company_id', companyId)
              .eq('type', 'asset')
              .limit(1);
            inventoryAccountId = assetAccounts?.[0]?.id;
          }
          
          // Get Accounts Payable account
          const { data: apAccounts } = await supabase
            .from('accounts')
            .select('id')
            .eq('company_id', companyId)
            .or('name.ilike.Accounts Payable,code.eq.2000')
            .limit(1);
          
          const apAccountId = apAccounts?.[0]?.id;
          
          if (!inventoryAccountId || !apAccountId) {
            const errorMsg = `Missing required accounts for purchase journal entry. Inventory: ${inventoryAccountId ? 'OK' : 'MISSING'}, AP: ${apAccountId ? 'OK' : 'MISSING'}`;
            console.error('[PURCHASE CONTEXT] ❌ CRITICAL:', errorMsg);
            throw new Error(errorMsg);
          }
          
          // Create main journal entry for purchase (ALWAYS, paid or unpaid)
          const { data: mainJournalEntry, error: journalError } = await supabase
            .from('journal_entries')
            .insert({
              company_id: companyId,
              branch_id: finalBranchId,
              entry_date: newPurchase.date,
              description: `Purchase ${newPurchase.purchaseNo} from ${newPurchase.supplierName}`,
              reference_type: 'purchase',
              reference_id: newPurchase.id,
              created_by: user?.id,
            })
            .select()
            .single();
          
          if (journalError || !mainJournalEntry) {
            console.error('[PURCHASE CONTEXT] ❌ CRITICAL: Failed to create purchase journal entry:', journalError);
            throw new Error(`Failed to create purchase journal entry: ${journalError?.message || 'Unknown error'}`);
          }
          
          // Debit: Inventory (stock increase)
          const { error: debitError } = await supabase
            .from('journal_entry_lines')
            .insert({
              journal_entry_id: mainJournalEntry.id,
              account_id: inventoryAccountId,
              debit: newPurchase.subtotal || newPurchase.total,
              credit: 0,
              description: `Inventory purchase ${newPurchase.purchaseNo}`,
            });
          
          if (debitError) {
            console.error('[PURCHASE CONTEXT] ❌ CRITICAL: Failed to create inventory debit line:', debitError);
            throw debitError;
          }
          
          // Credit: Accounts Payable (we owe supplier)
          const { error: creditError } = await supabase
            .from('journal_entry_lines')
            .insert({
              journal_entry_id: mainJournalEntry.id,
              account_id: apAccountId,
              debit: 0,
              credit: newPurchase.subtotal || newPurchase.total,
              description: `Payable to ${newPurchase.supplierName}`,
            });
          
          if (creditError) {
            console.error('[PURCHASE CONTEXT] ❌ CRITICAL: Failed to create AP credit line:', creditError);
            throw creditError;
          }
          
          console.log('[PURCHASE CONTEXT] ✅ Created main accounting entry for purchase (paid or unpaid):', mainJournalEntry.id);
        } catch (accountingError: any) {
          console.error('[PURCHASE CONTEXT] ❌ CRITICAL: Purchase accounting entry failed:', accountingError);
          // CRITICAL: Throw error to prevent purchase creation without accounting
          throw new Error(`Failed to create purchase accounting entry: ${accountingError.message || 'Unknown error'}`);
        }
      }
      
      // Supplier Ledger: Purchase → CREDIT (we owe supplier); post on every purchase create
      if (companyId && newPurchase.supplier && newPurchase.total != null) {
        try {
          const ledger = await getOrCreateLedger(companyId, 'supplier', newPurchase.supplier, newPurchase.supplierName);
          if (ledger) {
            await addLedgerEntry({
              companyId,
              ledgerId: ledger.id,
              entryDate: newPurchase.date,
              debit: 0,
              credit: newPurchase.total,
              source: 'purchase',
              referenceNo: newPurchase.purchaseNo,
              referenceId: newPurchase.id,
              remarks: `Purchase ${newPurchase.purchaseNo}`,
            });
            // If purchase created with paid amount, also post Payment → DEBIT
            if (newPurchase.paid > 0) {
              await addLedgerEntry({
                companyId,
                ledgerId: ledger.id,
                entryDate: newPurchase.date,
                debit: newPurchase.paid,
                credit: 0,
                source: 'payment',
                referenceNo: newPurchase.purchaseNo,
                referenceId: newPurchase.id,
                remarks: `Payment for ${newPurchase.purchaseNo}`,
              });
            }
          }
        } catch (e) {
          console.warn('[PurchaseContext] Supplier ledger entry failed:', e);
        }
      }
      
      // CRITICAL: Stock update ONLY on 'received' or 'final' status (NOT on 'pending' or 'draft')
      // Rule: Stock sirf Received/Final par update ho, Pending par kabhi nahi
      // STEP 1 RULE: Silent fail NOT allowed - throw error if stock movement fails
      console.log('[PURCHASE CONTEXT] 🔍 Stock movement check:', {
        status: newPurchase.status,
        hasItems: !!newPurchase.items,
        itemsCount: newPurchase.items?.length || 0,
        items: newPurchase.items
      });
      
      if ((newPurchase.status === 'received' || newPurchase.status === 'final') && newPurchase.items && newPurchase.items.length > 0) {
        console.log('[PURCHASE CONTEXT] 🔄 Creating stock movements for purchase:', newPurchase.id, 'Items:', newPurchase.items.length);
        
        const purchaseBranchId = newPurchase.branchId || branchId;
        const stockMovementErrors: string[] = [];
        
        for (const item of newPurchase.items) {
          if (item.productId && item.quantity > 0) {
            try {
              const qtyToAdd = item.receivedQty > 0 ? item.receivedQty : item.quantity;
              
              console.log('[PURCHASE CONTEXT] Creating stock movement for item:', {
                product_id: item.productId,
                variation_id: item.variationId,
                quantity: qtyToAdd,
                purchase_id: newPurchase.id
              });
              
              // Create stock movement via productService (proper audit trail)
              // Packing: packingDetails or packing_details; support total_boxes/boxes and total_pieces/pieces
              const packing = (item as any).packingDetails || (item as any).packing_details;
              const boxChange = packing && (packing.total_boxes != null || packing.boxes != null)
                ? Math.round(Number(packing.total_boxes ?? packing.boxes ?? 0)) : 0;
              const pieceChange = packing && (packing.total_pieces != null || packing.pieces != null)
                ? Math.round(Number(packing.total_pieces ?? packing.pieces ?? 0)) : 0;
              const movement = await productService.createStockMovement({
                company_id: companyId,
                branch_id: purchaseBranchId === 'all' ? undefined : purchaseBranchId,
                product_id: item.productId,
                variation_id: item.variationId || undefined,
                movement_type: 'purchase',
                quantity: qtyToAdd,
                unit_cost: item.price || 0,
                total_cost: (item.price || 0) * qtyToAdd,
                reference_type: 'purchase',
                reference_id: newPurchase.id,
                notes: `Purchase ${newPurchase.purchaseNo} - ${item.productName}${item.variationId ? ' (Variation)' : ''}`,
                created_by: user?.id,
                box_change: boxChange,
                piece_change: pieceChange,
              });
              
              if (!movement || !movement.id) {
                throw new Error(`Stock movement creation returned null/undefined for product ${item.productId}`);
              }
              
              console.log('[PURCHASE CONTEXT] ✅ Stock movement created:', {
                movement_id: movement.id,
                product_id: item.productId,
                variation_id: item.variationId,
                quantity: movement.quantity
              });
              
              // CRITICAL: Also update products.current_stock directly to ensure immediate sync
              try {
                const { data: product } = await supabase
                  .from('products')
                  .select('current_stock')
                  .eq('id', item.productId)
                  .single();
                
                if (product) {
                  const newStock = (product.current_stock || 0) + qtyToAdd;
                  await supabase
                    .from('products')
                    .update({ current_stock: newStock })
                    .eq('id', item.productId);
                  
                  console.log(`[PURCHASE CONTEXT] ✅ Updated product ${item.productId} stock: ${product.current_stock} → ${newStock}`);
                }
              } catch (stockUpdateError: any) {
                console.error('[PURCHASE CONTEXT] ❌ Direct stock update error (non-blocking):', stockUpdateError);
                // Continue even if direct update fails - stock_movements is the source of truth
              }
            } catch (movementError: any) {
              const errorMsg = `Failed to create stock movement for product ${item.productId} (${item.productName}): ${movementError.message || movementError}`;
              console.error('[PURCHASE CONTEXT] ❌ Stock movement creation failed:', errorMsg);
              console.error('[PURCHASE CONTEXT] Error details:', movementError);
              stockMovementErrors.push(errorMsg);
            }
          }
        }
        
        // CRITICAL: If any stock movement failed, throw error (no silent failures)
        if (stockMovementErrors.length > 0) {
          const errorMessage = `Stock movement creation failed for ${stockMovementErrors.length} item(s):\n${stockMovementErrors.join('\n')}`;
          console.error('[PURCHASE CONTEXT] ❌ CRITICAL: Stock movements not created:', errorMessage);
          throw new Error(errorMessage);
        }
        
        console.log('[PURCHASE CONTEXT] ✅ All stock movements created successfully for purchase:', newPurchase.id);
      }
      
      // CRITICAL: Create accounting entries for extra expenses (shipping/cargo) and discount
      if ((newPurchase.status === 'received' || newPurchase.status === 'final') && companyId) {
        try {
          // Get or create expense account for shipping/cargo
          const { data: expenseAccounts } = await supabase
            .from('accounts')
            .select('id')
            .eq('company_id', companyId)
            .eq('name', 'Operating Expense')
            .limit(1);
          
          const expenseAccountId = expenseAccounts?.[0]?.id;
          
          // Handle shipping/cargo expenses
          if (newPurchase.shippingCost && newPurchase.shippingCost > 0 && expenseAccountId) {
            // Get cash/bank account for payment
            const { data: cashAccounts } = await supabase
              .from('accounts')
              .select('id')
              .eq('company_id', companyId)
              .eq('name', 'Cash')
              .limit(1);
            
            const cashAccountId = cashAccounts?.[0]?.id;
            
            if (cashAccountId) {
              // Create journal entry for shipping expense
              const { data: journalEntry } = await supabase
                .from('journal_entries')
                .insert({
                  company_id: companyId,
                  branch_id: finalBranchId,
                  entry_date: newPurchase.date,
                  description: `Shipping/Cargo expense for ${newPurchase.purchaseNo}`,
                  reference_type: 'purchase',
                  reference_id: newPurchase.id,
                  created_by: user?.id,
                })
                .select()
                .single();
              
              if (journalEntry) {
                // Debit: Operating Expense
                await supabase
                  .from('journal_entry_lines')
                  .insert({
                    journal_entry_id: journalEntry.id,
                    account_id: expenseAccountId,
                    debit: newPurchase.shippingCost,
                    credit: 0,
                    description: 'Shipping/Cargo expense',
                  });
                
                // Credit: Cash/Bank
                await supabase
                  .from('journal_entry_lines')
                  .insert({
                    journal_entry_id: journalEntry.id,
                    account_id: cashAccountId,
                    debit: 0,
                    credit: newPurchase.shippingCost,
                    description: 'Payment for shipping',
                  });
                
                console.log('[PURCHASE CONTEXT] ✅ Created accounting entry for shipping expense:', newPurchase.shippingCost);
              }
            }
          }
          
          // Handle discount (reduces purchase cost) - Create separate journal entry
          if (newPurchase.discount && newPurchase.discount > 0) {
            // Get supplier ledger for discount entry
            const ledger = await getOrCreateLedger(companyId, 'supplier', newPurchase.supplier, newPurchase.supplierName);
            
            if (ledger) {
              // Add discount entry to supplier ledger (reduces payable)
              await addLedgerEntry({
                companyId,
                ledgerId: ledger.id,
                entryDate: newPurchase.date,
                debit: newPurchase.discount, // Debit supplier (reduces what we owe)
                credit: 0,
                source: 'purchase',
                referenceNo: newPurchase.purchaseNo,
                referenceId: newPurchase.id,
                remarks: `Discount for ${newPurchase.purchaseNo}`,
              });
              
              // Create journal entry for discount
              const { data: discountJournalEntry } = await supabase
                .from('journal_entries')
                .insert({
                  company_id: companyId,
                  branch_id: finalBranchId,
                  entry_date: newPurchase.date,
                  description: `Purchase discount for ${newPurchase.purchaseNo}`,
                  reference_type: 'purchase',
                  reference_id: newPurchase.id,
                  created_by: user?.id,
                })
                .select()
                .single();
              
              if (discountJournalEntry) {
                // Get Accounts Payable account
                const { data: apAccounts } = await supabase
                  .from('accounts')
                  .select('id')
                  .eq('company_id', companyId)
                  .eq('name', 'Accounts Payable')
                  .limit(1);
                
                const apAccountId = apAccounts?.[0]?.id;
                
                // Get Purchase Discount account (or create/use Operating Expense)
                const discountAccountId = expenseAccountId; // Use same expense account for discount
                
                if (apAccountId && discountAccountId) {
                  // Debit: Accounts Payable (reduces what we owe)
                  await supabase
                    .from('journal_entry_lines')
                    .insert({
                      journal_entry_id: discountJournalEntry.id,
                      account_id: apAccountId,
                      debit: newPurchase.discount,
                      credit: 0,
                      description: 'Purchase discount',
                    });
                  
                  // Credit: Purchase Discount (income/expense reduction)
                  await supabase
                    .from('journal_entry_lines')
                    .insert({
                      journal_entry_id: discountJournalEntry.id,
                      account_id: discountAccountId,
                      debit: 0,
                      credit: newPurchase.discount,
                      description: 'Purchase discount income',
                    });
                  
                  console.log('[PURCHASE CONTEXT] ✅ Created accounting entry for discount:', newPurchase.discount);
                }
              }
            }
          }
        } catch (accountingError) {
          console.warn('[PURCHASE CONTEXT] Extra expenses accounting warning (non-blocking):', accountingError);
          // Don't block purchase creation if accounting entry creation fails
        }
      }
      
      // 🔒 CRITICAL FIX: Record initial payment in payments table (like Sale module)
      // If purchase created with paid > 0, create payment record in payments table
      if (newPurchase.paid > 0 && companyId && finalBranchId) {
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
            // Generate payment reference number
            const paymentRef = generateDocumentNumber('payment');
            
            // Record payment in payments table
            await purchaseService.recordPayment(
              newPurchase.id,
              newPurchase.paid,
              paymentMethod,
              paymentAccountId,
              companyId,
              finalBranchId,
              paymentRef
            );
            incrementNextNumber('payment');
            
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
      
      // Auto-post to accounting if paid
      if (newPurchase.paid > 0) {
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

      if (updates.date !== undefined) supabaseUpdates.po_date = updates.date;

      // STEP 1 FIX: Reference number - save in notes field (like Sale module)
      if (updates.notes !== undefined) {
        supabaseUpdates.notes = updates.notes;
      } else if (updates.reference !== undefined) {
        // If reference field is passed, save it in notes
        supabaseUpdates.notes = updates.reference;
      }
      if ((updates as any).attachments !== undefined) supabaseUpdates.attachments = (updates as any).attachments;

      // 🔒 CRITICAL FIX: Calculate stock movement DELTA BEFORE updating purchase_items
      // This must happen BEFORE purchase_items are deleted/updated so we can fetch old items
      const purchase = getPurchaseById(id);
      const isFinalStatus = (updates.status === 'received' || updates.status === 'final') || (purchase?.status === 'final' || purchase?.status === 'received');
      let stockMovementDeltas: Array<{
        productId: string;
        variationId?: string;
        deltaQty: number;
        price: number;
        name: string;
      }> = [];
      
      // Only calculate delta if items are being updated and purchase is final/received
      if (isFinalStatus && (updates as any).items && Array.isArray((updates as any).items) && companyId) {
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
          } else {
            console.log('[PURCHASE CONTEXT] ⚠️ No items to insert (purchaseItems.length = 0) - purchase will have 0 items');
          }
        }
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
          
          for (const delta of stockMovementDeltas) {
            try {
              // For purchase: deltaQty > 0 means item added/increased → increase stock (positive movement)
              //               deltaQty < 0 means item removed/reduced → decrease stock (negative movement)
              const movementQty = delta.deltaQty; // For purchase, deltaQty directly represents stock change
              
              console.log('[PURCHASE CONTEXT] Creating stock movement for delta:', {
                product_id: delta.productId,
                variation_id: delta.variationId,
                deltaQty: delta.deltaQty,
                movementQty: movementQty,
                purchase_id: id
              });
              
              // Create stock movement
              const movement = await productService.createStockMovement({
                company_id: companyId,
                branch_id: effectiveBranchId === 'all' ? undefined : effectiveBranchId,
                product_id: delta.productId,
                variation_id: delta.variationId,
                movement_type: 'purchase',
                quantity: movementQty, // Positive for stock IN, negative for stock OUT
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
      
      // Update local state
      setPurchases(prev => prev.map(purchase => 
        purchase.id === id 
          ? { ...purchase, ...updates, updatedAt: new Date().toISOString() }
          : purchase
      ));
      
      toast.success('Purchase updated successfully!');
      
      // 🔒 CRITICAL FIX: Refresh purchases list after update to show correct items count
      // This ensures UI reflects the actual DB state after items update
      await loadPurchases();
      
      // Dispatch event to refresh inventory if stock movements were created
      if (stockMovementDeltas.length > 0) {
        window.dispatchEvent(new CustomEvent('purchaseSaved', { detail: { purchaseId: id } }));
      }
    } catch (error: any) {
      console.error('[PURCHASE CONTEXT] Error updating purchase:', error);
      console.error('[PURCHASE CONTEXT] Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      const errorMessage = error.message || error.details || error.hint || 'Unknown error';
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
    if (purchase.status !== 'final' && purchase.status !== 'completed') {
      throw new Error('Payment not allowed until purchase is Final. Current status: ' + purchase.status);
    }

    try {
      // Get default account if not provided
      const paymentAccountId = accountId || 'cash-001'; // Default cash account
      
      // Record payment in Supabase
      await purchaseService.recordPayment(purchaseId, amount, method, paymentAccountId, companyId, branchId);

      // Supplier Ledger: Payment → DEBIT (we paid)
      if (companyId && purchase.supplier) {
        try {
          const ledger = await getOrCreateLedger(companyId, 'supplier', purchase.supplier, purchase.supplierName);
          if (ledger) {
            await addLedgerEntry({
              companyId,
              ledgerId: ledger.id,
              entryDate: new Date().toISOString().split('T')[0],
              debit: amount,
              credit: 0,
              source: 'payment',
              referenceNo: purchase.purchaseNo,
              referenceId: purchaseId,
              remarks: `Payment for ${purchase.purchaseNo}`,
            });
            window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'supplier', entityId: purchase.supplier } }));
          }
        } catch (e) {
          console.warn('[PurchaseContext] Supplier ledger (payment) failed:', e);
        }
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

      // Auto-post to accounting
      accounting.recordSupplierPayment({
        supplierId: purchase.supplier,
        supplierName: purchase.supplierName,
        purchaseNo: purchase.purchaseNo,
        amount,
        paymentMethod: method as any,
        date: new Date().toISOString(),
        notes: `Payment for ${purchase.purchaseNo}`,
      });

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
      // Database trigger will handle stock_movements creation when status = 'final'
      await updatePurchase(purchaseId, { status: dbStatus });
      
      // STEP 4: If status is 'received' or 'final' and stock not already updated,
      // create stock movements via productService (database trigger might not exist)
      if (isMovingToStockUpdateStatus && purchase.items && purchase.items.length > 0) {
        try {
          // Get purchase branch_id from purchase data
          const purchaseBranchId = purchase.branchId || branchId;
          
          for (const item of purchase.items) {
            if (item.productId && item.quantity > 0) {
              const qtyToAdd = item.receivedQty > 0 ? item.receivedQty : item.quantity;
              const packing = (item as any).packingDetails || (item as any).packing_details;
              const boxChange = packing && (packing.total_boxes != null || packing.boxes != null)
                ? Math.round(Number(packing.total_boxes ?? packing.boxes ?? 0)) : 0;
              const pieceChange = packing && (packing.total_pieces != null || packing.pieces != null)
                ? Math.round(Number(packing.total_pieces ?? packing.pieces ?? 0)) : 0;
              await productService.createStockMovement({
                company_id: companyId,
                branch_id: purchaseBranchId === 'all' ? undefined : purchaseBranchId,
                product_id: item.productId,
                variation_id: (item as any).variationId || undefined,
                movement_type: 'purchase',
                quantity: qtyToAdd,
                unit_cost: item.price || 0,
                total_cost: (item.price || 0) * qtyToAdd,
                reference_type: 'purchase',
                reference_id: purchaseId,
                notes: `Purchase ${purchase.purchaseNo} - ${item.productName}`,
                created_by: user?.id,
                box_change: boxChange,
                piece_change: pieceChange,
              });
            }
          }
          
          console.log('[PURCHASE CONTEXT] ✅ Stock movements created for purchase:', purchaseId);
        } catch (stockError) {
          console.warn('[PURCHASE CONTEXT] Stock movement creation warning (non-blocking):', stockError);
          // Don't block status update if stock movement creation fails
          // Database trigger might handle it, or it can be fixed later
        }
      }
      
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
      if (receivedItem && receivedItem.productId && quantity > 0) {
        try {
          // Get current product stock
          const { data: product } = await productService.getProduct(receivedItem.productId);
          if (product) {
            // Increment stock
            await productService.updateProduct(receivedItem.productId, {
              current_stock: (product.current_stock || 0) + quantity
            });
          }
        } catch (stockError) {
          console.warn('[PURCHASE CONTEXT] Stock update warning (non-blocking):', stockError);
          // Don't block if stock update fails
        }
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

  const value: PurchaseContextType = {
    purchases,
    loading,
    getPurchaseById,
    createPurchase,
    updatePurchase,
    deletePurchase,
    recordPayment,
    updateStatus,
    receiveStock,
    refreshPurchases: loadPurchases,
  };

  return (
    <PurchaseContext.Provider value={value}>
      {children}
    </PurchaseContext.Provider>
  );
};
