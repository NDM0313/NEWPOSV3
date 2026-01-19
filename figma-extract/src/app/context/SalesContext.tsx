// ============================================
// 🎯 SALES CONTEXT
// ============================================
// Manages sales, quotations, and invoices with auto-numbering

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useDocumentNumbering } from '@/app/hooks/useDocumentNumbering';
import { useAccounting } from '@/app/context/AccountingContext';
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
}

export interface Sale {
  id: string;
  invoiceNo: string;
  type: SaleType;
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
  getSaleById: (id: string) => Sale | undefined;
  createSale: (sale: Omit<Sale, 'id' | 'invoiceNo' | 'createdAt' | 'updatedAt'>) => Sale;
  updateSale: (id: string, updates: Partial<Sale>) => void;
  deleteSale: (id: string) => void;
  recordPayment: (saleId: string, amount: number, method: string) => void;
  updateShippingStatus: (saleId: string, status: ShippingStatus) => void;
  convertQuotationToInvoice: (quotationId: string) => Sale;
}

// ============================================
// CONTEXT
// ============================================

const SalesContext = createContext<SalesContextType | undefined>(undefined);

export const useSales = () => {
  const context = useContext(SalesContext);
  if (!context) {
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

export const SalesProvider = ({ children }: { children: ReactNode }) => {
  const [sales, setSales] = useState<Sale[]>(INITIAL_SALES);
  const { generateDocumentNumber, incrementNextNumber } = useDocumentNumbering();
  const accounting = useAccounting();

  // Get sale by ID
  const getSaleById = (id: string): Sale | undefined => {
    return sales.find(s => s.id === id);
  };

  // Create new sale
  const createSale = (saleData: Omit<Sale, 'id' | 'invoiceNo' | 'createdAt' | 'updatedAt'>): Sale => {
    const now = new Date().toISOString();
    
    // Generate document number based on type
    const docType = saleData.type === 'invoice' ? 'invoice' : 'quotation';
    const invoiceNo = generateDocumentNumber(docType);
    
    const newSale: Sale = {
      ...saleData,
      id: `sale-${Date.now()}`,
      invoiceNo,
      createdAt: now,
      updatedAt: now,
    };

    setSales(prev => [newSale, ...prev]);
    
    // Increment document number
    incrementNextNumber(docType);
    
    // Auto-post to accounting if invoice and paid
    if (newSale.type === 'invoice' && newSale.paid > 0) {
      accounting.recordSalePayment({
        saleId: newSale.id,
        invoiceNo: newSale.invoiceNo,
        customerName: newSale.customerName,
        amount: newSale.paid,
        paymentMethod: newSale.paymentMethod as any,
        date: now,
        notes: `Payment for ${newSale.invoiceNo}`,
      });
    }

    toast.success(`${docType === 'invoice' ? 'Invoice' : 'Quotation'} ${invoiceNo} created successfully!`);
    
    return newSale;
  };

  // Update sale
  const updateSale = (id: string, updates: Partial<Sale>) => {
    setSales(prev => prev.map(sale => 
      sale.id === id 
        ? { ...sale, ...updates, updatedAt: new Date().toISOString() }
        : sale
    ));
    
    toast.success('Sale updated successfully!');
  };

  // Delete sale
  const deleteSale = (id: string) => {
    const sale = getSaleById(id);
    if (sale) {
      setSales(prev => prev.filter(s => s.id !== id));
      toast.success(`${sale.invoiceNo} deleted successfully!`);
    }
  };

  // Record payment
  const recordPayment = (saleId: string, amount: number, method: string) => {
    const sale = getSaleById(saleId);
    if (!sale) return;

    const newPaid = sale.paid + amount;
    const newDue = sale.total - newPaid;
    
    let paymentStatus: PaymentStatus = 'unpaid';
    if (newPaid >= sale.total) {
      paymentStatus = 'paid';
    } else if (newPaid > 0) {
      paymentStatus = 'partial';
    }

    updateSale(saleId, {
      paid: newPaid,
      due: newDue,
      paymentStatus,
      paymentMethod: method,
    });

    // Auto-post to accounting
    accounting.recordSalePayment({
      saleId: sale.id,
      invoiceNo: sale.invoiceNo,
      customerName: sale.customerName,
      amount,
      paymentMethod: method as any,
      date: new Date().toISOString(),
      notes: `Payment received for ${sale.invoiceNo}`,
    });

    toast.success(`Payment of Rs. ${amount.toLocaleString()} recorded!`);
  };

  // Update shipping status
  const updateShippingStatus = (saleId: string, status: ShippingStatus) => {
    const sale = getSaleById(saleId);
    if (!sale) return;

    updateSale(saleId, { shippingStatus: status });
    toast.success(`Shipping status updated to ${status}!`);
  };

  // Convert quotation to invoice
  const convertQuotationToInvoice = (quotationId: string): Sale => {
    const quotation = getSaleById(quotationId);
    if (!quotation || quotation.type !== 'quotation') {
      throw new Error('Invalid quotation');
    }

    // Generate new invoice number
    const invoiceNo = generateDocumentNumber('invoice');
    
    const invoice: Sale = {
      ...quotation,
      id: `sale-${Date.now()}`,
      invoiceNo,
      type: 'invoice',
      updatedAt: new Date().toISOString(),
    };

    setSales(prev => [invoice, ...prev]);
    incrementNextNumber('invoice');

    toast.success(`Quotation ${quotation.invoiceNo} converted to Invoice ${invoiceNo}!`);
    
    return invoice;
  };

  const value: SalesContextType = {
    sales,
    getSaleById,
    createSale,
    updateSale,
    deleteSale,
    recordPayment,
    updateShippingStatus,
    convertQuotationToInvoice,
  };

  return (
    <SalesContext.Provider value={value}>
      {children}
    </SalesContext.Provider>
  );
};
