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
    throw new Error('usePurchases must be used within PurchaseProvider');
  }
  return context;
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

  // Convert Supabase purchase format to app format
  const convertFromSupabasePurchase = useCallback((supabasePurchase: any): Purchase => {
    return {
      id: supabasePurchase.id,
      purchaseNo: supabasePurchase.po_no || '',
      supplier: supabasePurchase.supplier_id || '',
      supplierName: supabasePurchase.supplier_name || '',
      contactNumber: supabasePurchase.supplier?.phone || '',
      date: supabasePurchase.po_date || new Date().toISOString().split('T')[0],
      expectedDelivery: supabasePurchase.expected_delivery_date,
      location: supabasePurchase.branch_id || '',
      status: supabasePurchase.status || 'draft',
      items: (supabasePurchase.items || []).map((item: any) => ({
        id: item.id || '',
        productId: item.product_id || '',
        productName: item.product_name || '',
        sku: item.product?.sku || '',
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
      notes: supabasePurchase.notes,
      createdAt: supabasePurchase.created_at || new Date().toISOString(),
      updatedAt: supabasePurchase.updated_at || new Date().toISOString(),
    };
  }, []);

  // Load purchases from database
  const loadPurchases = useCallback(async () => {
    if (!companyId) return;
    
    try {
      setLoading(true);
      const data = await purchaseService.getAllPurchases(companyId, branchId || undefined);
      setPurchases(data.map(convertFromSupabasePurchase));
    } catch (error) {
      console.error('[PURCHASE CONTEXT] Error loading purchases:', error);
      toast.error('Failed to load purchases');
      // Fallback to empty array on error
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, convertFromSupabasePurchase]);

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
    if (!companyId || !branchId || !user) {
      throw new Error('Company ID, Branch ID, and User are required');
    }

    try {
      // Generate purchase order number
      const purchaseNo = generateDocumentNumber('purchase');
      
      // Convert to Supabase format
      const supabasePurchase: SupabasePurchase = {
        company_id: companyId,
        branch_id: branchId,
        po_no: purchaseNo,
        po_date: purchaseData.date,
        supplier_id: purchaseData.supplier || undefined,
        supplier_name: purchaseData.supplierName,
        status: purchaseData.status,
        payment_status: purchaseData.paymentStatus,
        subtotal: purchaseData.subtotal,
        discount_amount: purchaseData.discount,
        tax_amount: purchaseData.tax,
        shipping_cost: purchaseData.shippingCost,
        total: purchaseData.total,
        paid_amount: purchaseData.paid,
        due_amount: purchaseData.due,
        notes: purchaseData.notes,
        created_by: user.id,
      };

      const supabaseItems: SupabasePurchaseItem[] = purchaseData.items.map(item => ({
        product_id: item.productId,
        variation_id: item.variationId || undefined,
        product_name: item.productName,
        sku: (item as any).sku || 'N/A', // Required in DB
        quantity: item.quantity,
        unit: (item as any).unit || 'piece',
        unit_price: item.price,
        discount_percentage: (item as any).discountPercentage || 0,
        discount_amount: item.discount || 0,
        tax_percentage: (item as any).taxPercentage || 0,
        tax_amount: item.tax || 0,
        total: item.total,
        // Include packing data
        packing_type: (item as any).packingDetails?.packing_type || null,
        packing_quantity: (item as any).packingDetails?.total_meters || (item as any).meters || null,
        packing_unit: (item as any).packingDetails?.unit || 'meters',
        packing_details: (item as any).packingDetails || null,
      }));

      // Save to Supabase
      const result = await purchaseService.createPurchase(supabasePurchase, supabaseItems);
      
      // Increment document number
      incrementNextNumber('purchase');
      
      // Convert back to app format
      const newPurchase = convertFromSupabasePurchase(result);
      
      // Update local state
      setPurchases(prev => [newPurchase, ...prev]);
      
      // If purchase status is 'received' or 'completed', update stock
      if ((newPurchase.status === 'received' || newPurchase.status === 'completed') && newPurchase.items && newPurchase.items.length > 0) {
        try {
          for (const item of newPurchase.items) {
            if (item.productId && item.quantity > 0) {
              const product = await productService.getProduct(item.productId);
              if (product) {
                const qtyToAdd = item.receivedQty > 0 ? item.receivedQty : item.quantity;
                await productService.updateProduct(item.productId, {
                  current_stock: (product.current_stock || 0) + qtyToAdd
                });
              }
            }
          }
        } catch (stockError) {
          console.warn('[PURCHASE CONTEXT] Stock update warning (non-blocking):', stockError);
          // Don't block purchase creation if stock update fails
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
      toast.error(`Failed to create purchase: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };

  // Update purchase
  const updatePurchase = async (id: string, updates: Partial<Purchase>): Promise<void> => {
    try {
      // Convert updates to Supabase format
      const supabaseUpdates: any = {};
      if (updates.status !== undefined) supabaseUpdates.status = updates.status;
      if (updates.paymentStatus !== undefined) supabaseUpdates.payment_status = updates.paymentStatus;
      if (updates.total !== undefined) supabaseUpdates.total = updates.total;
      if (updates.paid !== undefined) supabaseUpdates.paid_amount = updates.paid;
      if (updates.due !== undefined) supabaseUpdates.due_amount = updates.due;

      // Update in Supabase
      await purchaseService.updatePurchase(id, supabaseUpdates);
      
      // Update local state
      setPurchases(prev => prev.map(purchase => 
        purchase.id === id 
          ? { ...purchase, ...updates, updatedAt: new Date().toISOString() }
          : purchase
      ));
      
      toast.success('Purchase updated successfully!');
    } catch (error: any) {
      console.error('[PURCHASE CONTEXT] Error updating purchase:', error);
      toast.error(`Failed to update purchase: ${error.message || 'Unknown error'}`);
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

  // Record payment
  const recordPayment = async (purchaseId: string, amount: number, method: string, accountId?: string): Promise<void> => {
    const purchase = getPurchaseById(purchaseId);
    if (!purchase || !companyId || !branchId) {
      throw new Error('Purchase not found or company/branch missing');
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
      // If status is 'received' or 'completed', also set to 'final' in DB to trigger stock update
      const dbStatus = (status === 'received' || status === 'completed') ? 'final' : status;
      
      await updatePurchase(purchaseId, { status });
      
      // If status changed to received/completed, manually update stock (in case trigger doesn't fire)
      if ((status === 'received' || status === 'completed') && purchase.items) {
        try {
          // Update stock for each item
          for (const item of purchase.items) {
            if (item.productId && item.quantity > 0) {
              // Get current stock
              const { data: product } = await productService.getProduct(item.productId);
              if (product) {
                // Update stock
                await productService.updateProduct(item.productId, {
                  current_stock: (product.current_stock || 0) + item.quantity
                });
              }
            }
          }
        } catch (stockError) {
          console.warn('[PURCHASE CONTEXT] Stock update warning (non-blocking):', stockError);
          // Don't block status update if stock update fails
        }
      }
      
      toast.success(`Purchase status updated to ${status}!`);
    } catch (error) {
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
