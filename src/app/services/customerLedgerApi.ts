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
      .in('type', ['customer', 'both'])
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
    const cId = String(customerId ?? '').trim();
    if (!cId) {
      return {
        openingBalance: 0,
        totalDebit: 0,
        totalCredit: 0,
        closingBalance: 0,
        totalInvoices: 0,
        totalInvoiceAmount: 0,
        totalPaymentReceived: 0,
        pendingAmount: 0,
        fullyPaid: 0,
        partiallyPaid: 0,
        unpaid: 0,
      };
    }
    // Prefer RPC so ledger sees all sales for customer (bypasses branch RLS)
    let sales: any[] | null = null;
    const rpcSales = await supabase.rpc('get_customer_ledger_sales', {
      p_company_id: companyId,
      p_customer_id: cId,
      p_from_date: fromDate || null,
      p_to_date: toDate || null,
    });
    if (!rpcSales.error) {
      sales = rpcSales.data ?? [];
    } else {
      let salesQuery = supabase
        .from('sales')
        .select('id, total, paid_amount, due_amount, payment_status, invoice_date')
        .eq('company_id', companyId)
        .eq('customer_id', cId);
      if (fromDate) salesQuery = salesQuery.gte('invoice_date', fromDate);
      if (toDate) salesQuery = salesQuery.lte('invoice_date', toDate);
      const res = await salesQuery;
      sales = res.data ?? [];
      if (res.error) console.error('[CUSTOMER LEDGER API] Error fetching sales for summary:', res.error);
    }

    const invoices = sales || [];
    const totalInvoices = invoices.length;
    const totalInvoiceAmount = invoices.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalPaymentReceived = invoices.reduce((sum, s) => sum + (s.paid_amount || 0), 0);
    // Sale returns (final) in date range – CREDIT, reduce customer balance
    let returnsInRange = 0;
    let returnsQuery = supabase.from('sale_returns').select('id, total').eq('company_id', companyId).eq('customer_id', cId).eq('status', 'final');
    if (fromDate) returnsQuery = returnsQuery.gte('return_date', fromDate);
    if (toDate) returnsQuery = returnsQuery.lte('return_date', toDate);
    const { data: rangeReturns } = await returnsQuery;
    const saleReturnIdsInRange = (rangeReturns || []).map((r: any) => r.id);
    returnsInRange = (rangeReturns || []).reduce((sum: number, r: any) => sum + (Number(r.total) || 0), 0);
    const pendingAmount = Math.max(0, invoices.reduce((sum, s) => sum + (s.due_amount || 0), 0) - returnsInRange);
    const fullyPaid = invoices.filter(s => s.payment_status === 'paid').length;
    const partiallyPaid = invoices.filter(s => s.payment_status === 'partial').length;
    const unpaid = invoices.filter(s => s.payment_status === 'unpaid').length;

    // Calculate opening balance (sales - paid - sale returns before fromDate)
    let openingBalance = 0;
    if (fromDate) {
      const dayBeforeFrom = (() => {
        const d = new Date(fromDate + 'T12:00:00Z');
        d.setUTCDate(d.getUTCDate() - 1);
        return d.toISOString().split('T')[0];
      })();
      let previousSales: any[] = [];
      const rpcPrev = await supabase.rpc('get_customer_ledger_sales', {
        p_company_id: companyId,
        p_customer_id: cId,
        p_from_date: null,
        p_to_date: dayBeforeFrom,
      });
      if (!rpcPrev.error) {
        previousSales = rpcPrev.data ?? [];
      } else {
        const res = await supabase
          .from('sales')
          .select('total, paid_amount')
          .eq('company_id', companyId)
          .eq('customer_id', cId)
          .lt('invoice_date', fromDate);
        previousSales = res.data ?? [];
      }
      const previousTotal = previousSales.reduce((sum, s) => sum + (s.total || 0), 0);
      const previousPaid = previousSales.reduce((sum, s) => sum + (s.paid_amount || 0), 0);
      const { data: previousReturns } = await supabase
        .from('sale_returns')
        .select('total')
        .eq('company_id', companyId)
        .eq('customer_id', cId)
        .eq('status', 'final')
        .lt('return_date', fromDate);
      const previousReturnsTotal = (previousReturns || []).reduce((sum, r: any) => sum + (Number(r.total) || 0), 0);
      const { data: prevRetIds } = await supabase
        .from('sale_returns')
        .select('id')
        .eq('company_id', companyId)
        .eq('customer_id', cId)
        .eq('status', 'final')
        .lt('return_date', fromDate);
      const prevRetIdList = (prevRetIds || []).map((r: any) => r.id);
      let prevReturnPaymentsTotal = 0;
      if (prevRetIdList.length > 0) {
        const { data: prevRetPays } = await supabase
          .from('payments')
          .select('amount')
          .eq('company_id', companyId)
          .eq('reference_type', 'sale_return')
          .in('reference_id', prevRetIdList)
          .lt('payment_date', fromDate);
        prevReturnPaymentsTotal = (prevRetPays || []).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
      }
      // Studio orders before fromDate (table may not exist in all deployments)
      let prevStudioOrderNet = 0;
      const { data: prevStudioOrders, error: prevSOErr } = await supabase
        .from('studio_orders')
        .select('total_cost, advance_paid')
        .eq('company_id', companyId)
        .eq('customer_id', cId)
        .lt('order_date', fromDate);
      if (!prevSOErr && prevStudioOrders) {
        prevStudioOrders.forEach((o: any) => {
          prevStudioOrderNet += (Number(o.total_cost ?? 0) || 0) - (Number(o.advance_paid ?? 0) || 0);
        });
      }
      openingBalance = previousTotal - previousPaid - previousReturnsTotal - prevReturnPaymentsTotal + prevStudioOrderNet;
    }

    // Studio orders in date range – debit total_cost, credit advance_paid
    let studioOrderDebit = 0;
    let studioOrderCredit = 0;
    let soQuery = supabase.from('studio_orders').select('total_cost, advance_paid').eq('company_id', companyId).eq('customer_id', cId);
    if (fromDate) soQuery = soQuery.gte('order_date', fromDate);
    if (toDate) soQuery = soQuery.lte('order_date', toDate);
    const { data: rangeStudioOrders, error: rangeSOErr } = await soQuery;
    if (!rangeSOErr && rangeStudioOrders) {
      rangeStudioOrders.forEach((o: any) => {
        studioOrderDebit += Number(o.total_cost ?? 0) || 0;
        studioOrderCredit += Number(o.advance_paid ?? 0) || 0;
      });
    }

    // Return payments in range (credit)
    let returnPaymentsInRange = 0;
    if (saleReturnIdsInRange.length > 0) {
      let rpQuery = supabase
        .from('payments')
        .select('amount, payment_date')
        .eq('company_id', companyId)
        .eq('reference_type', 'sale_return')
        .in('reference_id', saleReturnIdsInRange);
      if (fromDate) rpQuery = rpQuery.gte('payment_date', fromDate);
      if (toDate) rpQuery = rpQuery.lte('payment_date', toDate);
      const { data: rpInRange } = await rpQuery;
      returnPaymentsInRange = (rpInRange || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
    }
    const totalDebit = totalInvoiceAmount + studioOrderDebit;
    const totalCredit = totalPaymentReceived + returnsInRange + returnPaymentsInRange + studioOrderCredit;
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
    const cId = String(customerId ?? '').trim();
    if (!cId) return [];

    // Prefer RPC so ledger sees all sales/payments for customer (bypasses branch RLS)
    let sales: any[] | null = null;
    let salesError: any = null;
    const rpcSales = await supabase.rpc('get_customer_ledger_sales', {
      p_company_id: companyId,
      p_customer_id: cId,
      p_from_date: fromDate || null,
      p_to_date: toDate || null,
    });
    if (process.env.NODE_ENV !== 'production') {
      console.log('[LEDGER] get_customer_ledger_sales', {
        companyId,
        customerId: cId,
        fromDate: fromDate || null,
        toDate: toDate || null,
        rpcError: rpcSales.error?.message ?? null,
        salesCount: (rpcSales.data ?? []).length,
      });
    }
    if (!rpcSales.error) {
      sales = rpcSales.data ?? [];
    } else {
      // Fallback: direct query (subject to RLS – may miss rows if user lacks branch access)
      let salesQuery = supabase
        .from('sales')
        .select('id, invoice_no, invoice_date, total, paid_amount, due_amount, payment_status')
        .eq('company_id', companyId)
        .eq('customer_id', cId);
      if (fromDate) salesQuery = salesQuery.gte('invoice_date', fromDate);
      if (toDate) salesQuery = salesQuery.lte('invoice_date', toDate);
      const result = await salesQuery.order('invoice_date', { ascending: false });
      sales = result.data;
      salesError = result.error;
      if (salesError) {
        console.error('[CUSTOMER LEDGER API] Error fetching sales:', salesError);
        let retryQuery = supabase
          .from('sales')
          .select('id, invoice_no, invoice_date, total, paid_amount, due_amount')
          .eq('company_id', companyId)
          .eq('customer_id', cId);
        if (fromDate) retryQuery = retryQuery.gte('invoice_date', fromDate);
        if (toDate) retryQuery = retryQuery.lte('invoice_date', toDate);
        const retry = await retryQuery.order('invoice_date', { ascending: false });
        if (!retry.error) {
          sales = retry.data;
          salesError = null;
        }
      }
    }

    const saleIds = (sales || []).map((s: any) => s.id);
    let payments: any[] | null = null;
    if (saleIds.length > 0) {
      const rpcPayments = await supabase.rpc('get_customer_ledger_payments', {
        p_company_id: companyId,
        p_sale_ids: saleIds,
        p_from_date: fromDate || null,
        p_to_date: toDate || null,
      });
      if (!rpcPayments.error) {
        payments = rpcPayments.data ?? [];
      }
    }
    if (payments === null) {
      let paymentsQuery = supabase
        .from('payments')
        .select('id, reference_number, payment_date, amount, payment_method, notes, reference_id')
        .eq('company_id', companyId)
        .eq('reference_type', 'sale');
      if (saleIds.length > 0) {
        paymentsQuery = paymentsQuery.in('reference_id', saleIds);
      } else {
        paymentsQuery = paymentsQuery.eq('reference_id', '00000000-0000-0000-0000-000000000000');
      }
      if (fromDate) paymentsQuery = paymentsQuery.gte('payment_date', fromDate);
      if (toDate) paymentsQuery = paymentsQuery.lte('payment_date', toDate);
      const payResult = await paymentsQuery.order('payment_date', { ascending: false });
      payments = payResult.data ?? [];
      if (payResult.error) {
        console.error('[CUSTOMER LEDGER API] Error fetching payments:', payResult.error);
      }
    }

    // Get sale returns for this customer (CREDIT - reduces balance)
    let returnsQuery = supabase
      .from('sale_returns')
      .select('id, return_no, return_date, total, status')
      .eq('company_id', companyId)
      .eq('customer_id', cId)
      .eq('status', 'final');

    if (fromDate) returnsQuery = returnsQuery.gte('return_date', fromDate);
    if (toDate) returnsQuery = returnsQuery.lte('return_date', toDate);

    const { data: saleReturns, error: returnsError } = await returnsQuery.order('return_date', { ascending: false });
    if (returnsError) {
      console.error('[CUSTOMER LEDGER API] Error fetching sale returns:', returnsError);
    }

    // Get return payments (payments against sale returns – credit to customer)
    const saleReturnIds = (saleReturns || []).map((r: any) => r.id);
    let returnPaymentsQuery = supabase
      .from('payments')
      .select('id, reference_number, payment_date, amount, payment_method, notes, reference_id')
      .eq('company_id', companyId)
      .eq('reference_type', 'sale_return');
    if (saleReturnIds.length > 0) {
      returnPaymentsQuery = returnPaymentsQuery.in('reference_id', saleReturnIds);
    } else {
      returnPaymentsQuery = returnPaymentsQuery.eq('reference_id', '00000000-0000-0000-0000-000000000000');
    }
    if (fromDate) returnPaymentsQuery = returnPaymentsQuery.gte('payment_date', fromDate);
    if (toDate) returnPaymentsQuery = returnPaymentsQuery.lte('payment_date', toDate);
    const { data: returnPayments, error: returnPaymentsError } = await returnPaymentsQuery.order('payment_date', { ascending: false });
    if (returnPaymentsError) {
      console.error('[CUSTOMER LEDGER API] Error fetching return payments:', returnPaymentsError);
    }

    // Combine and format transactions
    const transactions: Transaction[] = [];

    // Add sales as debit transactions (regular + studio sales from sales table)
    (sales || []).forEach((sale: any) => {
      const inv = (sale.invoice_no || '').toString().trim().toUpperCase();
      const isStudioSale = inv.startsWith('STD-') || inv.startsWith('ST-');
      transactions.push({
        id: sale.id,
        date: sale.invoice_date,
        referenceNo: sale.invoice_no || '',
        documentType: isStudioSale ? ('Studio Sale' as const) : ('Sale' as const),
        description: isStudioSale ? `Studio Sale ${sale.invoice_no || ''}` : `Sale Invoice ${sale.invoice_no}`,
        paymentAccount: '',
        notes: '',
        debit: sale.total || 0,
        credit: 0,
        runningBalance: 0, // Will be calculated
        linkedInvoices: [sale.invoice_no],
      });
    });

    // Studio orders (studio_orders table) – debit total_cost, credit advance_paid so net = balance_due
    let studioOrdersQuery = supabase
      .from('studio_orders')
      .select('id, order_no, order_date, total_cost, advance_paid, balance_due')
      .eq('company_id', companyId)
      .eq('customer_id', cId);
    if (fromDate) studioOrdersQuery = studioOrdersQuery.gte('order_date', fromDate);
    if (toDate) studioOrdersQuery = studioOrdersQuery.lte('order_date', toDate);
    const { data: studioOrders, error: studioOrdersError } = await studioOrdersQuery.order('order_date', { ascending: false });
    if (studioOrdersError) {
      // studio_orders table may not exist in all deployments
      if (studioOrdersError.code !== '42P01') console.error('[CUSTOMER LEDGER API] Error fetching studio orders:', studioOrdersError);
    }
    (studioOrders || []).forEach((order: any) => {
      const totalCost = Number(order.total_cost ?? 0) || 0;
      const advancePaid = Number(order.advance_paid ?? 0) || 0;
      transactions.push({
        id: order.id,
        date: order.order_date,
        referenceNo: order.order_no || `ORD-${(order.id || '').slice(0, 8)}`,
        documentType: 'Studio Order' as const,
        description: `Studio Order ${order.order_no || order.id?.slice(0, 8)}`,
        paymentAccount: '',
        notes: advancePaid > 0 ? `Advance Rs ${advancePaid}` : '',
        debit: totalCost,
        credit: advancePaid,
        runningBalance: 0,
        linkedInvoices: [],
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

    // Add sale returns as credit transactions (reduces customer balance)
    (saleReturns || []).forEach((ret: any) => {
      transactions.push({
        id: ret.id,
        date: ret.return_date,
        referenceNo: ret.return_no || `RET-${ret.id?.slice(0, 8)}`,
        documentType: 'Sale Return' as const,
        description: `Sale Return ${ret.return_no || ret.id?.slice(0, 8)}`,
        paymentAccount: '',
        notes: '',
        debit: 0,
        credit: ret.total || 0,
        runningBalance: 0,
        linkedInvoices: [],
      });
    });

    // Add return payments as credit (refund to customer against return)
    (returnPayments || []).forEach((payment: any) => {
      transactions.push({
        id: payment.id,
        date: payment.payment_date,
        referenceNo: payment.reference_number || '',
        documentType: 'Return Payment' as const,
        description: `Return Payment via ${payment.payment_method}`,
        paymentAccount: payment.payment_method || '',
        notes: payment.notes || '',
        debit: 0,
        credit: payment.amount || 0,
        runningBalance: 0,
        linkedPayments: [payment.reference_number],
      });
    });

    // Sort by date
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // When date range is applied, running balance must start from opening balance (before fromDate)
    let runningBalance = 0;
    if (fromDate) {
      const dayBeforeFrom = (() => {
        const d = new Date(fromDate + 'T12:00:00Z');
        d.setUTCDate(d.getUTCDate() - 1);
        return d.toISOString().split('T')[0];
      })();
      let prevSales: any[] = [];
      const rpcPrev = await supabase.rpc('get_customer_ledger_sales', {
        p_company_id: companyId,
        p_customer_id: cId,
        p_from_date: null,
        p_to_date: dayBeforeFrom,
      });
      if (!rpcPrev.error) prevSales = rpcPrev.data ?? [];
      else {
        const res = await supabase
          .from('sales')
          .select('total, paid_amount')
          .eq('company_id', companyId)
          .eq('customer_id', cId)
          .lt('invoice_date', fromDate);
        prevSales = res.data ?? [];
      }
      const prevTotal = prevSales.reduce((sum, s) => sum + (s.total || 0), 0);
      const prevPaid = prevSales.reduce((sum, s) => sum + (s.paid_amount || 0), 0);
      const { data: prevReturns } = await supabase
        .from('sale_returns')
        .select('id, total')
        .eq('company_id', companyId)
        .eq('customer_id', cId)
        .eq('status', 'final')
        .lt('return_date', fromDate);
      const prevReturnsTotal = (prevReturns || []).reduce((sum, r: any) => sum + (Number(r.total) || 0), 0);
      const prevRetIdsForBal = (prevReturns || []).map((r: any) => r.id);
      let prevReturnPmts = 0;
      if (prevRetIdsForBal.length > 0) {
        const { data: prevRp } = await supabase
          .from('payments')
          .select('amount')
          .eq('company_id', companyId)
          .eq('reference_type', 'sale_return')
          .in('reference_id', prevRetIdsForBal)
          .lt('payment_date', fromDate);
        prevReturnPmts = (prevRp || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
      }
      // Studio orders before fromDate: net receivable = total_cost - advance_paid
      let prevStudioOrderNet = 0;
      const { data: prevStudioOrders } = await supabase
        .from('studio_orders')
        .select('total_cost, advance_paid')
        .eq('company_id', companyId)
        .eq('customer_id', cId)
        .lt('order_date', fromDate);
      (prevStudioOrders || []).forEach((o: any) => {
        prevStudioOrderNet += (Number(o.total_cost ?? 0) || 0) - (Number(o.advance_paid ?? 0) || 0);
      });
      runningBalance = prevTotal - prevPaid - prevReturnsTotal - prevReturnPmts + prevStudioOrderNet;
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
