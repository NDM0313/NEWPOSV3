// ============================================
// 🎯 SALES CONTEXT
// ============================================
// Manages sales, quotations, and invoices with auto-numbering

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useDocumentNumbering } from '@/app/hooks/useDocumentNumbering';
import { useAccounting } from '@/app/context/AccountingContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { saleService, Sale as SupabaseSale, SaleItem as SupabaseSaleItem } from '@/app/services/saleService';
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
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const { generateDocumentNumber, incrementNextNumber } = useDocumentNumbering();
  const accounting = useAccounting();
  const { companyId, branchId, user } = useSupabase();

  // Convert Supabase sale format to app format
  const convertFromSupabaseSale = useCallback((supabaseSale: any): Sale => {
    return {
      id: supabaseSale.id,
      invoiceNo: supabaseSale.invoice_no || '',
      type: supabaseSale.status === 'quotation' ? 'quotation' : 'invoice',
      customer: supabaseSale.customer_id || '',
      customerName: supabaseSale.customer_name || '',
      contactNumber: supabaseSale.customer?.phone || '',
      date: supabaseSale.invoice_date || new Date().toISOString().split('T')[0],
      location: supabaseSale.branch_id || '',
      items: (supabaseSale.items || []).map((item: any) => ({
        id: item.id || '',
        productId: item.product_id || '',
        productName: item.product_name || '',
        sku: item.product?.sku || '',
        quantity: item.quantity || 0,
        price: item.unit_price || 0,
        discount: 0,
        tax: 0,
        total: item.total || 0,
      })),
      itemsCount: supabaseSale.items?.length || 0,
      subtotal: supabaseSale.subtotal || 0,
      discount: supabaseSale.discount_amount || 0,
      tax: supabaseSale.tax_amount || 0,
      expenses: supabaseSale.shipping_charges || 0,
      total: supabaseSale.total || 0,
      paid: supabaseSale.paid_amount || 0,
      due: supabaseSale.due_amount || 0,
      returnDue: 0,
      paymentStatus: supabaseSale.payment_status || 'unpaid',
      paymentMethod: 'Cash',
      shippingStatus: 'pending',
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
      // Generate document number based on type
      const docType = saleData.type === 'invoice' ? 'invoice' : 'quotation';
      const invoiceNo = generateDocumentNumber(docType);
      
      // Convert to Supabase format
      const supabaseSale: SupabaseSale = {
        company_id: companyId,
        branch_id: branchId,
        invoice_no: invoiceNo,
        invoice_date: saleData.date,
        customer_id: saleData.customer || undefined,
        customer_name: saleData.customerName,
        status: saleData.type === 'invoice' ? 'final' : 'quotation',
        payment_status: saleData.paymentStatus,
        subtotal: saleData.subtotal,
        discount_amount: saleData.discount,
        tax_amount: saleData.tax,
        shipping_charges: saleData.expenses,
        total: saleData.total,
        paid_amount: saleData.paid,
        due_amount: saleData.due,
        notes: saleData.notes,
        created_by: user.id,
      };

      const supabaseItems: SupabaseSaleItem[] = saleData.items.map(item => ({
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: item.price,
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
      
      // Update local state
      setSales(prev => [newSale, ...prev]);
      
      // Auto-post to accounting if invoice and paid
      if (newSale.type === 'invoice' && newSale.paid > 0) {
        accounting.recordSalePayment({
          saleId: newSale.id,
          invoiceNo: newSale.invoiceNo,
          customerName: newSale.customerName,
          amount: newSale.paid,
          paymentMethod: newSale.paymentMethod as any,
          date: new Date().toISOString(),
          notes: `Payment for ${newSale.invoiceNo}`,
        });
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
      // Delete from Supabase (or soft delete by updating status)
      await saleService.updateSaleStatus(id, 'cancelled' as any);
      
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
      // Get default account if not provided
      const paymentAccountId = accountId || 'cash-001'; // Default cash account
      
      // Record payment in Supabase
      await saleService.recordPayment(saleId, amount, method, paymentAccountId, companyId, branchId);

      const newPaid = sale.paid + amount;
      const newDue = sale.total - newPaid;
      
      let paymentStatus: PaymentStatus = 'unpaid';
      if (newPaid >= sale.total) {
        paymentStatus = 'paid';
      } else if (newPaid > 0) {
        paymentStatus = 'partial';
      }

      // Update local state
      await updateSale(saleId, {
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
