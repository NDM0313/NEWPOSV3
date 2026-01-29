import { supabase } from '@/lib/supabase';
import type { Customer, Transaction, Invoice, Payment, LedgerData } from './customerLedgerTypes';

export interface CustomerLedgerSummary {
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  totalInvoices: number;
  totalInvoiceAmount: number;
  totalPaymentReceived: number;
  pendingAmount: number;
  fullyPaid: number;
  partiallyPaid: number;
  unpaid: number;
}

export interface AgingReport {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
  total: number;
}

export const customerLedgerAPI = {
  /**
   * Get all customers
   */
  async getCustomers(companyId: string): Promise<Customer[]> {
    const { data, error } = await supabase
      .from('contacts')
      .select('id, name, phone, city, email, address, credit_limit, opening_balance')
      .eq('company_id', companyId)
      .eq('type', 'customer')
      .order('name');

    if (error) throw error;

    // Calculate outstanding balance from sales
    const { data: sales } = await supabase
      .from('sales')
      .select('customer_id, due_amount')
      .eq('company_id', companyId)
      .gt('due_amount', 0);

    // Create a map of customer_id to total due amount
    const customerDueMap = new Map<string, number>();
    (sales || []).forEach((sale: any) => {
      const current = customerDueMap.get(sale.customer_id) || 0;
      customerDueMap.set(sale.customer_id, current + (sale.due_amount || 0));
    });

    return (data || []).map((c, index) => ({
      id: c.id,
      // Generate code from ID or use index as fallback
      code: `CUS-${String(index + 1).padStart(4, '0')}`,
      name: c.name || '',
      phone: c.phone || '',
      city: c.city || '',
      email: c.email || '',
      address: c.address || '',
      creditLimit: c.credit_limit || 0,
      outstandingBalance: customerDueMap.get(c.id) || c.opening_balance || 0,
    }));
  },

  /**
   * Get customer details by ID
   */
  async getCustomerById(customerId: string): Promise<Customer | null> {
    const { data, error } = await supabase
      .from('contacts')
      .select('id, name, phone, city, email, address, credit_limit, opening_balance')
      .eq('id', customerId)
      .eq('type', 'customer')
      .single();

    if (error) throw error;
    if (!data) return null;

    // Calculate outstanding balance from sales
    const { data: sales } = await supabase
      .from('sales')
      .select('due_amount')
      .eq('customer_id', customerId)
      .gt('due_amount', 0);

    const outstandingBalance = (sales || []).reduce((sum, s: any) => sum + (s.due_amount || 0), 0) || data.opening_balance || 0;

    // Generate a short code from the ID
    const shortId = data.id.substring(0, 8).toUpperCase();

    return {
      id: data.id,
      code: `CUS-${shortId}`,
      name: data.name || '',
      phone: data.phone || '',
      city: data.city || '',
      email: data.email || '',
      address: data.address || '',
      creditLimit: data.credit_limit || 0,
      outstandingBalance,
    };
  },

  /**
   * Get ledger summary for a customer
   */
  async getLedgerSummary(
    customerId: string,
    companyId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<CustomerLedgerSummary> {
    // Simplified approach: Calculate from sales and payments data directly
    // This avoids complex nested queries that may fail
    
    // Get sales data for this customer
    let salesQuery = supabase
      .from('sales')
      .select('id, total, paid_amount, due_amount, payment_status, invoice_date')
      .eq('company_id', companyId)
      .eq('customer_id', customerId);

    if (fromDate) {
      salesQuery = salesQuery.gte('invoice_date', fromDate);
    }
    if (toDate) {
      salesQuery = salesQuery.lte('invoice_date', toDate);
    }

    const { data: sales, error: salesError } = await salesQuery;
    
    if (salesError) {
      console.error('[CUSTOMER LEDGER API] Error fetching sales for summary:', salesError);
    }

    const invoices = sales || [];
    const totalInvoices = invoices.length;
    const totalInvoiceAmount = invoices.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalPaymentReceived = invoices.reduce((sum, s) => sum + (s.paid_amount || 0), 0);
    const pendingAmount = invoices.reduce((sum, s) => sum + (s.due_amount || 0), 0);
    const fullyPaid = invoices.filter(s => s.payment_status === 'paid').length;
    const partiallyPaid = invoices.filter(s => s.payment_status === 'partial').length;
    const unpaid = invoices.filter(s => s.payment_status === 'unpaid').length;

    // Calculate opening balance (sales before fromDate)
    let openingBalance = 0;
    if (fromDate) {
      const { data: previousSales } = await supabase
        .from('sales')
        .select('total, paid_amount')
        .eq('company_id', companyId)
        .eq('customer_id', customerId)
        .lt('invoice_date', fromDate);
      
      if (previousSales) {
        const previousTotal = previousSales.reduce((sum, s) => sum + (s.total || 0), 0);
        const previousPaid = previousSales.reduce((sum, s) => sum + (s.paid_amount || 0), 0);
        openingBalance = previousTotal - previousPaid;
      }
    }

    // Calculate totals
    const totalDebit = totalInvoiceAmount;
    const totalCredit = totalPaymentReceived;
    const closingBalance = openingBalance + totalDebit - totalCredit;

    return {
      openingBalance,
      totalDebit,
      totalCredit,
      closingBalance,
      totalInvoices,
      totalInvoiceAmount,
      totalPaymentReceived,
      pendingAmount,
      fullyPaid,
      partiallyPaid,
      unpaid,
    };
  },

  /**
   * Get all transactions for a customer
   */
  async getTransactions(
    customerId: string,
    companyId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<Transaction[]> {
    // Get sales for this customer (simplified query without nested joins)
    let salesQuery = supabase
      .from('sales')
      .select('id, invoice_no, invoice_date, total, paid_amount, due_amount, payment_status')
      .eq('company_id', companyId)
      .eq('customer_id', customerId);

    if (fromDate) {
      salesQuery = salesQuery.gte('invoice_date', fromDate);
    }
    if (toDate) {
      salesQuery = salesQuery.lte('invoice_date', toDate);
    }

    const { data: sales, error: salesError } = await salesQuery.order('invoice_date', { ascending: false });
    
    if (salesError) {
      console.error('[CUSTOMER LEDGER API] Error fetching sales:', salesError);
      // Return empty array on error
    }

    // Get payments for this customer (simplified query)
    const saleIds = (sales || []).map(s => s.id);
    
    let paymentsQuery = supabase
      .from('payments')
      .select('id, reference_number, payment_date, amount, payment_method, notes, reference_id')
      .eq('company_id', companyId)
      .eq('reference_type', 'sale');

    if (saleIds.length > 0) {
      paymentsQuery = paymentsQuery.in('reference_id', saleIds);
    } else {
      // If no sales, return empty payments
      paymentsQuery = paymentsQuery.eq('reference_id', '00000000-0000-0000-0000-000000000000'); // Non-existent ID
    }

    if (fromDate) {
      paymentsQuery = paymentsQuery.gte('payment_date', fromDate);
    }
    if (toDate) {
      paymentsQuery = paymentsQuery.lte('payment_date', toDate);
    }

    const { data: payments, error: paymentsError } = await paymentsQuery.order('payment_date', { ascending: false });
    
    if (paymentsError) {
      console.error('[CUSTOMER LEDGER API] Error fetching payments:', paymentsError);
    }

    // Combine and format transactions
    const transactions: Transaction[] = [];

    // Add sales as debit transactions
    (sales || []).forEach((sale: any) => {
      transactions.push({
        id: sale.id,
        date: sale.invoice_date,
        referenceNo: sale.invoice_no || '',
        documentType: 'Sale' as const,
        description: `Sale Invoice ${sale.invoice_no}`,
        paymentAccount: '',
        notes: '',
        debit: sale.total || 0,
        credit: 0,
        runningBalance: 0, // Will be calculated
        linkedInvoices: [sale.invoice_no],
      });
    });

    // Add payments as credit transactions
    (payments || []).forEach((payment: any) => {
      transactions.push({
        id: payment.id,
        date: payment.payment_date,
        referenceNo: payment.reference_number || '',
        documentType: 'Payment' as const,
        description: `Payment via ${payment.payment_method}`,
        paymentAccount: payment.payment_method || '',
        notes: payment.notes || '',
        debit: 0,
        credit: payment.amount || 0,
        runningBalance: 0, // Will be calculated
        linkedPayments: [payment.reference_number],
      });
    });

    // Sort by date
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // When date range is applied, running balance must start from opening balance (before fromDate)
    let runningBalance = 0;
    if (fromDate) {
      const { data: prevSales } = await supabase
        .from('sales')
        .select('total, paid_amount')
        .eq('company_id', companyId)
        .eq('customer_id', customerId)
        .lt('invoice_date', fromDate);
      const prevTotal = (prevSales || []).reduce((sum, s) => sum + (s.total || 0), 0);
      const prevPaid = (prevSales || []).reduce((sum, s) => sum + (s.paid_amount || 0), 0);
      runningBalance = prevTotal - prevPaid;
    }
    transactions.forEach(t => {
      runningBalance += t.debit - t.credit;
      t.runningBalance = runningBalance;
    });

    return transactions;
  },

  /**
   * Get invoices for a customer
   */
  async getInvoices(
    customerId: string,
    companyId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<Invoice[]> {
    // Full sale_items columns – single source of truth (packing_type, packing_quantity, packing_unit, quantity, unit, variation_id)
    let query = supabase
      .from('sales')
      .select(`
        id,
        invoice_no,
        invoice_date,
        total,
        paid_amount,
        due_amount,
        payment_status,
        items:sales_items(
          product_name,
          quantity,
          unit,
          unit_price,
          discount_amount,
          tax_amount,
          total,
          packing_type,
          packing_quantity,
          packing_unit,
          variation_id
        )
      `)
      .eq('company_id', companyId)
      .eq('customer_id', customerId);

    if (fromDate) {
      query = query.gte('invoice_date', fromDate);
    }
    if (toDate) {
      query = query.lte('invoice_date', toDate);
    }

    const { data, error } = await query.order('invoice_date', { ascending: false });

    if (error) throw error;

    return (data || []).map((sale: any) => ({
      invoiceNo: sale.invoice_no || '',
      date: sale.invoice_date,
      invoiceTotal: sale.total || 0,
      items: (sale.items || []).map((item: any) => ({
        itemName: item.product_name || '',
        qty: item.quantity || 0,
        rate: item.unit_price || 0,
        lineTotal: item.total || 0,
      })),
      status: sale.payment_status === 'paid' ? 'Fully Paid' as const :
              sale.payment_status === 'partial' ? 'Partially Paid' as const :
              'Unpaid' as const,
      paidAmount: sale.paid_amount || 0,
      pendingAmount: sale.due_amount || 0,
    }));
  },

  /**
   * Get payments for a customer
   */
  async getPayments(
    customerId: string,
    companyId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<Payment[]> {
    // First get all sales for this customer
    const { data: sales } = await supabase
      .from('sales')
      .select('id')
      .eq('company_id', companyId)
      .eq('customer_id', customerId);

    if (!sales || sales.length === 0) return [];

    let query = supabase
      .from('payments')
      .select(`
        id,
        reference_number,
        payment_date,
        amount,
        payment_method,
        notes,
        reference_id
      `)
      .eq('company_id', companyId)
      .eq('reference_type', 'sale')
      .in('reference_id', sales.map(s => s.id));

    if (fromDate) {
      query = query.gte('payment_date', fromDate);
    }
    if (toDate) {
      query = query.lte('payment_date', toDate);
    }

    const { data, error } = await query.order('payment_date', { ascending: false });

    if (error) throw error;

    // Get invoice numbers for each payment
    const paymentIds = (data || []).map(p => p.reference_id);
    const { data: relatedSales } = await supabase
      .from('sales')
      .select('id, invoice_no')
      .in('id', paymentIds);

    const invoiceMap = new Map((relatedSales || []).map(s => [s.id, s.invoice_no]));

    return (data || []).map((payment: any) => ({
      id: payment.id,
      paymentNo: payment.reference_number || '',
      date: payment.payment_date,
      amount: payment.amount || 0,
      method: payment.payment_method || '',
      referenceNo: payment.reference_number || '',
      appliedInvoices: invoiceMap.get(payment.reference_id) ? [invoiceMap.get(payment.reference_id)!] : [],
      status: 'Completed' as const,
    }));
  },

  /**
   * Get aging report for a customer
   */
  async getAgingReport(
    customerId: string,
    companyId: string
  ): Promise<AgingReport> {
    const { data: sales } = await supabase
      .from('sales')
      .select('invoice_date, due_amount, invoice_no')
      .eq('company_id', companyId)
      .eq('customer_id', customerId)
      .gt('due_amount', 0);

    if (!sales) {
      return {
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days90plus: 0,
        total: 0,
      };
    }

    const today = new Date();
    let current = 0;
    let days1to30 = 0;
    let days31to60 = 0;
    let days61to90 = 0;
    let days90plus = 0;

    sales.forEach((sale: any) => {
      const invoiceDate = new Date(sale.invoice_date);
      const daysDiff = Math.floor((today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
      const amount = sale.due_amount || 0;

      if (daysDiff <= 0) {
        current += amount;
      } else if (daysDiff <= 30) {
        days1to30 += amount;
      } else if (daysDiff <= 60) {
        days31to60 += amount;
      } else if (daysDiff <= 90) {
        days61to90 += amount;
      } else {
        days90plus += amount;
      }
    });

    return {
      current,
      days1to30,
      days31to60,
      days61to90,
      days90plus,
      total: current + days1to30 + days31to60 + days61to90 + days90plus,
    };
  },
};
