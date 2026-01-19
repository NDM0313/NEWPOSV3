// ============================================
// 🎯 PURCHASE CONTEXT
// ============================================
// Manages purchases and supplier orders with auto-numbering

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useDocumentNumbering } from '@/app/hooks/useDocumentNumbering';
import { useAccounting } from '@/app/context/AccountingContext';
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
  getPurchaseById: (id: string) => Purchase | undefined;
  createPurchase: (purchase: Omit<Purchase, 'id' | 'purchaseNo' | 'createdAt' | 'updatedAt'>) => Purchase;
  updatePurchase: (id: string, updates: Partial<Purchase>) => void;
  deletePurchase: (id: string) => void;
  recordPayment: (purchaseId: string, amount: number, method: string) => void;
  updateStatus: (purchaseId: string, status: PurchaseStatus) => void;
  receiveStock: (purchaseId: string, itemId: string, quantity: number) => void;
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
// MOCK DATA (Initial)
// ============================================

const INITIAL_PURCHASES: Purchase[] = [
  {
    id: 'purchase-1',
    purchaseNo: 'PO-0001',
    supplier: 'Fabric Suppliers Ltd',
    supplierName: 'Ali Textiles',
    contactNumber: '+92-300-1111111',
    date: '2024-01-10',
    expectedDelivery: '2024-01-20',
    location: 'Main Branch (HQ)',
    status: 'completed',
    items: [],
    itemsCount: 50,
    subtotal: 150000,
    discount: 5000,
    tax: 0,
    shippingCost: 2000,
    total: 147000,
    paid: 147000,
    due: 0,
    paymentStatus: 'paid',
    paymentMethod: 'Bank Transfer',
    createdAt: '2024-01-10T09:00:00Z',
    updatedAt: '2024-01-10T09:00:00Z',
  },
  {
    id: 'purchase-2',
    purchaseNo: 'PO-0002',
    supplier: 'Accessories Hub',
    supplierName: 'Fashion Accessories',
    contactNumber: '+92-321-2222222',
    date: '2024-01-12',
    expectedDelivery: '2024-01-18',
    location: 'Main Branch (HQ)',
    status: 'received',
    items: [],
    itemsCount: 30,
    subtotal: 85000,
    discount: 0,
    tax: 0,
    shippingCost: 1500,
    total: 86500,
    paid: 50000,
    due: 36500,
    paymentStatus: 'partial',
    paymentMethod: 'Cash',
    createdAt: '2024-01-12T10:30:00Z',
    updatedAt: '2024-01-12T10:30:00Z',
  },
];

// ============================================
// PROVIDER
// ============================================

export const PurchaseProvider = ({ children }: { children: ReactNode }) => {
  const [purchases, setPurchases] = useState<Purchase[]>(INITIAL_PURCHASES);
  const { generateDocumentNumber, incrementNextNumber } = useDocumentNumbering();
  const accounting = useAccounting();

  // Get purchase by ID
  const getPurchaseById = (id: string): Purchase | undefined => {
    return purchases.find(p => p.id === id);
  };

  // Create new purchase
  const createPurchase = (purchaseData: Omit<Purchase, 'id' | 'purchaseNo' | 'createdAt' | 'updatedAt'>): Purchase => {
    const now = new Date().toISOString();
    
    // Generate purchase order number
    const purchaseNo = generateDocumentNumber('purchase');
    
    const newPurchase: Purchase = {
      ...purchaseData,
      id: `purchase-${Date.now()}`,
      purchaseNo,
      createdAt: now,
      updatedAt: now,
    };

    setPurchases(prev => [newPurchase, ...prev]);
    
    // Increment document number
    incrementNextNumber('purchase');
    
    // Auto-post to accounting if paid
    if (newPurchase.paid > 0) {
      accounting.recordSupplierPayment({
        supplierId: newPurchase.supplier,
        supplierName: newPurchase.supplierName,
        purchaseNo: newPurchase.purchaseNo,
        amount: newPurchase.paid,
        paymentMethod: newPurchase.paymentMethod as any,
        date: now,
        notes: `Payment for ${newPurchase.purchaseNo}`,
      });
    }

    toast.success(`Purchase Order ${purchaseNo} created successfully!`);
    
    return newPurchase;
  };

  // Update purchase
  const updatePurchase = (id: string, updates: Partial<Purchase>) => {
    setPurchases(prev => prev.map(purchase => 
      purchase.id === id 
        ? { ...purchase, ...updates, updatedAt: new Date().toISOString() }
        : purchase
    ));
    
    toast.success('Purchase updated successfully!');
  };

  // Delete purchase
  const deletePurchase = (id: string) => {
    const purchase = getPurchaseById(id);
    if (purchase) {
      setPurchases(prev => prev.filter(p => p.id !== id));
      toast.success(`${purchase.purchaseNo} deleted successfully!`);
    }
  };

  // Record payment
  const recordPayment = (purchaseId: string, amount: number, method: string) => {
    const purchase = getPurchaseById(purchaseId);
    if (!purchase) return;

    const newPaid = purchase.paid + amount;
    const newDue = purchase.total - newPaid;
    
    let paymentStatus: PaymentStatus = 'unpaid';
    if (newPaid >= purchase.total) {
      paymentStatus = 'paid';
    } else if (newPaid > 0) {
      paymentStatus = 'partial';
    }

    updatePurchase(purchaseId, {
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
  };

  // Update status
  const updateStatus = (purchaseId: string, status: PurchaseStatus) => {
    const purchase = getPurchaseById(purchaseId);
    if (!purchase) return;

    updatePurchase(purchaseId, { status });
    toast.success(`Purchase status updated to ${status}!`);
  };

  // Receive stock
  const receiveStock = (purchaseId: string, itemId: string, quantity: number) => {
    const purchase = getPurchaseById(purchaseId);
    if (!purchase) return;

    const updatedItems = purchase.items.map(item => 
      item.id === itemId 
        ? { ...item, receivedQty: item.receivedQty + quantity }
        : item
    );

    // Check if all items received
    const allReceived = updatedItems.every(item => item.receivedQty >= item.quantity);
    const newStatus: PurchaseStatus = allReceived ? 'completed' : 'received';

    updatePurchase(purchaseId, { 
      items: updatedItems,
      status: newStatus
    });

    toast.success(`${quantity} items received for ${purchase.purchaseNo}!`);
  };

  const value: PurchaseContextType = {
    purchases,
    getPurchaseById,
    createPurchase,
    updatePurchase,
    deletePurchase,
    recordPayment,
    updateStatus,
    receiveStock,
  };

  return (
    <PurchaseContext.Provider value={value}>
      {children}
    </PurchaseContext.Provider>
  );
};
