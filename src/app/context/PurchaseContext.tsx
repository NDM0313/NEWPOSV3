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
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

export type PurchaseStatus = 'draft' | 'ordered' | 'received' | 'completed' | 'cancelled';
export type PaymentStatus = 'paid' | 'partial' | 'unpaid';

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
  reference?: string; // STEP 1 FIX: Reference number field
  createdAt: string;
  updatedAt: string;
}

interface PurchaseContextType {
  purchases: Purchase[];
  loading: boolean;
  getPurchaseById: (id: string) => Purchase | undefined;
  createPurchase: (purchase: Omit<Purchase, 'id' | 'purchaseNo' | 'createdAt' | 'updatedAt'>) => Promise<Purchase>;
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
    // During hot reload in development, context might not be available
    // Return a safe default to prevent crashes
    if (import.meta.env.DEV) {
      console.warn('[PurchaseContext] usePurchases called outside PurchaseProvider, returning default context');
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
    })),
    itemsCount: supabasePurchase.items?.length || 0,
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
  const { generateDocumentNumber, incrementNextNumber } = useDocumentNumbering();
  const accounting = useAccounting();
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
  const createPurchase = async (purchaseData: Omit<Purchase, 'id' | 'purchaseNo' | 'createdAt' | 'updatedAt'>): Promise<Purchase> => {
    if (!companyId || !user) {
      throw new Error('Company ID and User are required');
    }

    try {
      // Generate purchase order number
      const purchaseNo = generateDocumentNumber('purchase');
      
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
      
      const supabasePurchase: SupabasePurchase = {
        company_id: companyId,
        branch_id: finalBranchId,
        po_no: purchaseNo,
        po_date: purchaseData.date,
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
          unit: (item as any).unit && (item as any).unit.trim() !== '' ? (item as any).unit : 'piece',
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
      
      // Update local state
      setPurchases(prev => [newPurchase, ...prev]);
      
      // CRITICAL: Stock update ONLY on 'received' or 'final' status (NOT on 'pending' or 'draft')
      // Rule: Stock sirf Received/Final par update ho, Pending par kabhi nahi
      // Use stock_movements instead of direct product update
      if ((newPurchase.status === 'received' || newPurchase.status === 'final') && newPurchase.items && newPurchase.items.length > 0) {
        try {
          const purchaseBranchId = newPurchase.branchId || branchId;
          
          for (const item of newPurchase.items) {
            if (item.productId && item.quantity > 0) {
              const qtyToAdd = item.receivedQty > 0 ? item.receivedQty : item.quantity;
              
              // Create stock movement via productService (proper audit trail)
              await productService.createStockMovement({
                company_id: companyId,
                branch_id: purchaseBranchId === 'all' ? undefined : purchaseBranchId,
                product_id: item.productId,
                movement_type: 'purchase',
                quantity: qtyToAdd, // Positive for stock IN
                unit_cost: item.price || 0,
                total_cost: (item.price || 0) * qtyToAdd,
                reference_type: 'purchase',
                reference_id: newPurchase.id,
                notes: `Purchase ${newPurchase.purchaseNo} - ${item.productName}`,
                created_by: user?.id,
              });
            }
          }
          
          console.log('[PURCHASE CONTEXT] ✅ Stock movements created for new purchase:', newPurchase.id);
        } catch (stockError) {
          console.warn('[PURCHASE CONTEXT] Stock movement creation warning (non-blocking):', stockError);
          // Don't block purchase creation if stock movement creation fails
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
      
      // STEP 1 FIX: Reference number - save in notes field (like Sale module)
      if (updates.notes !== undefined) {
        supabaseUpdates.notes = updates.notes;
      } else if (updates.reference !== undefined) {
        // If reference field is passed, save it in notes
        supabaseUpdates.notes = updates.reference;
      }

      // Log what we're sending for debugging
      console.log('[PURCHASE CONTEXT] Updating purchase:', { id, supabaseUpdates, originalUpdates: updates });
      
      // Update in Supabase
      await purchaseService.updatePurchase(id, supabaseUpdates);
      
      // Update local state
      setPurchases(prev => prev.map(purchase => 
        purchase.id === id 
          ? { ...purchase, ...updates, updatedAt: new Date().toISOString() }
          : purchase
      ));
      
      toast.success('Purchase updated successfully!');
      
      // STEP 3 FIX: Refresh purchases list after update
      await loadPurchases();
    } catch (error: any) {
      console.error('[PURCHASE CONTEXT] Error updating purchase:', error);
      console.error('[PURCHASE CONTEXT] Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        supabaseUpdates
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
      
      // Update local state
      setPurchases(prev => prev.filter(p => p.id !== id));
      toast.success(`${purchase.purchaseNo} deleted successfully!`);
    } catch (error: any) {
      console.error('[PURCHASE CONTEXT] Error deleting purchase:', error);
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

      toast.success(`Payment of Rs. ${amount.toLocaleString()} recorded!`);
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
              // Use receivedQty if available, otherwise use quantity
              const qtyToAdd = item.receivedQty > 0 ? item.receivedQty : item.quantity;
              
              // Create stock movement via productService
              await productService.createStockMovement({
                company_id: companyId,
                branch_id: purchaseBranchId === 'all' ? undefined : purchaseBranchId,
                product_id: item.productId,
                movement_type: 'purchase',
                quantity: qtyToAdd, // Positive for stock IN
                unit_cost: item.price || 0,
                total_cost: (item.price || 0) * qtyToAdd,
                reference_type: 'purchase',
                reference_id: purchaseId,
                notes: `Purchase ${purchase.purchaseNo} - ${item.productName}`,
                created_by: user?.id,
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
