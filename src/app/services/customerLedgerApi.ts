import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/app/utils/formatCurrency';
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
   * Get all customers for ledger (company_id only).
   * No is_system_generated or created_by filter — walk-in must be included so ledger shows all walk-in sales.
   */
  async getCustomers(companyId: string): Promise<Customer[]> {
    const { data, error } = await supabase
      .from('contacts')
      .select('id, name, code, phone, city, email, address, credit_limit, opening_balance')
      .eq('company_id', companyId)
      .in('type', ['customer', 'both'])
      .order('name');

    if (error) throw error;

    // Calculate outstanding balance from sales + rentals (includes walk-in)
    const { data: sales } = await supabase
      .from('sales')
      .select('customer_id, due_amount')
      .eq('company_id', companyId)
      .gt('due_amount', 0);

    const { data: rentals } = await supabase
      .from('rentals')
      .select('customer_id, due_amount')
      .eq('company_id', companyId)
      .gt('due_amount', 0);

    const customerDueMap = new Map<string, number>();
    (sales || []).forEach((sale: any) => {
      const current = customerDueMap.get(sale.customer_id) || 0;
      customerDueMap.set(sale.customer_id, current + (sale.due_amount || 0));
    });
    (rentals || []).forEach((r: any) => {
      if (r.customer_id) {
        const current = customerDueMap.get(r.customer_id) || 0;
        customerDueMap.set(r.customer_id, current + (r.due_amount || 0));
      }
    });

    return (data || []).map((c: any) => ({
      id: c.id,
      code: c.code != null && String(c.code).trim() !== '' ? String(c.code).trim() : '—',
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
      .select('id, name, code, phone, city, email, address, credit_limit, opening_balance')
      .eq('id', customerId)
      .in('type', ['customer', 'both'])
      .single();

    if (error) throw error;
    if (!data) return null;

    const salesDue = (await supabase.from('sales').select('due_amount').eq('customer_id', customerId).gt('due_amount', 0)).data || [];
    const rentalsDue = (await supabase.from('rentals').select('due_amount').eq('customer_id', customerId).gt('due_amount', 0)).data || [];
    const outstandingBalance =
      (salesDue as any[]).reduce((sum, s: any) => sum + (s.due_amount || 0), 0) +
      (rentalsDue as any[]).reduce((sum, r: any) => sum + (r.due_amount || 0), 0) ||
      (data as any).opening_balance ||
      0;

    return {
      id: (data as any).id,
      code: (data as any).code != null && String((data as any).code).trim() !== '' ? String((data as any).code).trim() : '—',
      name: (data as any).name || '',
      phone: (data as any).phone || '',
      city: (data as any).city || '',
      email: (data as any).email || '',
      address: (data as any).address || '',
      creditLimit: (data as any).credit_limit || 0,
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
        .select('id, invoice_no, total, paid_amount, due_amount, payment_status, invoice_date')
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

    // Ensure invoice_no for studio detection (RPC may not return it)
    const missingInvoiceNo = invoices.some((s: any) => !s.invoice_no);
    if (missingInvoiceNo && invoices.length > 0) {
      const { data: invData } = await supabase
        .from('sales')
        .select('id, invoice_no')
        .in('id', invoices.map((s: any) => s.id));
      const invMap = new Map(((invData || []) as any[]).map((r: any) => [r.id, r.invoice_no]));
      invoices.forEach((s: any) => { if (!s.invoice_no && invMap.has(s.id)) s.invoice_no = invMap.get(s.id); });
    }

    // Studio sales: add production stage costs (same as getTransactions/getInvoices)
    const studioSaleIds = invoices
      .filter((s: any) => {
        const inv = (s.invoice_no || '').toString().trim().toUpperCase();
        return inv.startsWith('STD-') || inv.startsWith('ST-');
      })
      .map((s: any) => s.id);
    const studioChargesBySaleId = new Map<string, number>();
    if (studioSaleIds.length > 0) {
      try {
        const { data: productions } = await supabase
          .from('studio_productions')
          .select('id, sale_id')
          .in('sale_id', studioSaleIds);
        const prodIds = (productions || []).map((p: any) => p.id).filter(Boolean);
        if (prodIds.length > 0) {
          const { data: stages } = await supabase
            .from('studio_production_stages')
            .select('production_id, cost')
            .in('production_id', prodIds);
          const prodBySale = new Map<string, string>();
          (productions || []).forEach((p: any) => { if (p.sale_id) prodBySale.set(p.sale_id, p.id); });
          const chargesByProd = new Map<string, number>();
          (stages || []).forEach((s: any) => {
            const prev = chargesByProd.get(s.production_id) || 0;
            chargesByProd.set(s.production_id, prev + (Number(s.cost) || 0));
          });
          prodBySale.forEach((prodId, saleId) => {
            const ch = chargesByProd.get(prodId) || 0;
            if (ch > 0) studioChargesBySaleId.set(saleId, ch);
          });
        }
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') console.warn('[LEDGER] getLedgerSummary studio charges failed:', e);
      }
    }

    const totalInvoiceAmount = invoices.reduce((sum, s) => {
      const base = Number(s.total) || 0;
      const inv = (s.invoice_no || '').toString().trim().toUpperCase();
      const studioCharges = (inv.startsWith('STD-') || inv.startsWith('ST-')) ? (studioChargesBySaleId.get(s.id) || 0) : 0;
      return sum + base + studioCharges;
    }, 0);
    const totalPaymentReceived = invoices.reduce((sum, s) => sum + (s.paid_amount || 0), 0);
    // Sale returns (final) in date range – CREDIT, reduce customer balance
    let returnsInRange = 0;
    let returnsQuery = supabase.from('sale_returns').select('id, total').eq('company_id', companyId).eq('customer_id', cId).eq('status', 'final');
    if (fromDate) returnsQuery = returnsQuery.gte('return_date', fromDate);
    if (toDate) returnsQuery = returnsQuery.lte('return_date', toDate);
    const { data: rangeReturns } = await returnsQuery;
    const saleReturnIdsInRange = (rangeReturns || []).map((r: any) => r.id);
    returnsInRange = (rangeReturns || []).reduce((sum: number, r: any) => sum + (Number(r.total) || 0), 0);
    const pendingAmount = Math.max(0, invoices.reduce((sum, s) => {
      const base = Number(s.total) || 0;
      const paid = Number(s.paid_amount) || 0;
      const inv = (s.invoice_no || '').toString().trim().toUpperCase();
      const studioCharges = (inv.startsWith('STD-') || inv.startsWith('ST-')) ? (studioChargesBySaleId.get(s.id) || 0) : 0;
      const effectiveTotal = base + studioCharges;
      return sum + Math.max(0, effectiveTotal - paid);
    }, 0) - returnsInRange);
    const fullyPaid = invoices.filter(s => {
      const base = Number(s.total) || 0;
      const paid = Number(s.paid_amount) || 0;
      const inv = (s.invoice_no || '').toString().trim().toUpperCase();
      const studioCharges = (inv.startsWith('STD-') || inv.startsWith('ST-')) ? (studioChargesBySaleId.get(s.id) || 0) : 0;
      return paid >= base + studioCharges;
    }).length;
    const partiallyPaid = invoices.filter(s => {
      const base = Number(s.total) || 0;
      const paid = Number(s.paid_amount) || 0;
      const inv = (s.invoice_no || '').toString().trim().toUpperCase();
      const studioCharges = (inv.startsWith('STD-') || inv.startsWith('ST-')) ? (studioChargesBySaleId.get(s.id) || 0) : 0;
      const effectiveTotal = base + studioCharges;
      return paid > 0 && paid < effectiveTotal;
    }).length;
    const unpaid = totalInvoices - fullyPaid - partiallyPaid;

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
      // Rentals before fromDate
      let prevRentalTotal = 0;
      let prevRentalPaid = 0;
      try {
        const rpcPrevRentals = await supabase.rpc('get_customer_ledger_rentals', {
          p_company_id: companyId,
          p_customer_id: cId,
          p_from_date: null,
          p_to_date: dayBeforeFrom,
        });
        const prevRentals = !rpcPrevRentals.error ? (rpcPrevRentals.data ?? []) : [];
        prevRentalTotal = prevRentals.reduce((s: number, r: any) => s + (Number(r.total_amount) || 0), 0);
        const prevRentalIds = prevRentals.map((r: any) => r.id);
        if (prevRentalIds.length > 0) {
          const { data: prevRp } = await supabase
            .from('rental_payments')
            .select('amount')
            .in('rental_id', prevRentalIds)
            .lt('payment_date', fromDate);
          prevRentalPaid = (prevRp || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
        }
      } catch (_) {}
      openingBalance = previousTotal - previousPaid - previousReturnsTotal - prevReturnPaymentsTotal + prevStudioOrderNet + prevRentalTotal - prevRentalPaid;
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
    // Rentals: charges by rental date (in range), payments by payment_date (in range)
    let rentalDebit = 0;
    let rentalCredit = 0;
    try {
      const rpcRentals = await supabase.rpc('get_customer_ledger_rentals', {
        p_company_id: companyId,
        p_customer_id: cId,
        p_from_date: null,
        p_to_date: null,
      });
      const allRentals = !rpcRentals.error ? (rpcRentals.data ?? []) : [];
      allRentals.forEach((r: any) => {
        const rawDate = r.pickup_date || r.booking_date || r.created_at;
        const d = rawDate ? (typeof rawDate === 'string' && rawDate.length >= 10 ? rawDate.slice(0, 10) : new Date(rawDate).toISOString().slice(0, 10)) : '';
        if (!d) return;
        if (fromDate && d < fromDate) return;
        if (toDate && d > toDate) return;
        rentalDebit += Number(r.total_amount) || 0;
      });
      const allRentalIds = allRentals.map((r: any) => r.id);
      if (allRentalIds.length > 0) {
        let rpQuery = supabase.from('rental_payments').select('amount').in('rental_id', allRentalIds);
        if (fromDate) rpQuery = rpQuery.gte('payment_date', fromDate);
        if (toDate) rpQuery = rpQuery.lte('payment_date', toDate);
        const { data: rpData } = await rpQuery;
        rentalCredit = (rpData || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
      }
    } catch (_) {}

    const totalDebit = totalInvoiceAmount + studioOrderDebit + rentalDebit;
    const totalCredit = totalPaymentReceived + returnsInRange + returnPaymentsInRange + studioOrderCredit + rentalCredit;
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
      .select('id, return_no, return_date, total, status, notes')
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

    // Fetch notes for sales (RPC doesn't return notes)
    const saleNotesMap = new Map<string, string>();
    if (saleIds.length > 0) {
      const { data: saleNotes } = await supabase.from('sales').select('id, notes').in('id', saleIds);
      (saleNotes || []).forEach((s: any) => { if (s.notes) saleNotesMap.set(s.id, s.notes); });
    }

    // Combine and format transactions
    const transactions: Transaction[] = [];

    // Studio sales: fetch production stage costs to add to sale total (sale.total + worker costs)
    const studioSaleIds = (sales || [])
      .filter((s: any) => {
        const inv = (s.invoice_no || '').toString().trim().toUpperCase();
        return inv.startsWith('STD-') || inv.startsWith('ST-');
      })
      .map((s: any) => s.id);
    const studioChargesBySaleId = new Map<string, number>();
    if (studioSaleIds.length > 0) {
      try {
        const { data: productions } = await supabase
          .from('studio_productions')
          .select('id, sale_id')
          .in('sale_id', studioSaleIds);
        const prodIds = (productions || []).map((p: any) => p.id).filter(Boolean);
        if (prodIds.length > 0) {
          const { data: stages } = await supabase
            .from('studio_production_stages')
            .select('production_id, cost')
            .in('production_id', prodIds);
          const prodBySale = new Map<string, string>();
          (productions || []).forEach((p: any) => {
            if (p.sale_id) prodBySale.set(p.sale_id, p.id);
          });
          const chargesByProd = new Map<string, number>();
          (stages || []).forEach((s: any) => {
            const prev = chargesByProd.get(s.production_id) || 0;
            chargesByProd.set(s.production_id, prev + (Number(s.cost) || 0));
          });
          prodBySale.forEach((prodId, saleId) => {
            const ch = chargesByProd.get(prodId) || 0;
            if (ch > 0) studioChargesBySaleId.set(saleId, ch);
          });
        }
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') console.warn('[LEDGER] Studio charges fetch failed:', e);
      }
    }

    // Add sales as debit transactions (regular + studio sales from sales table)
    (sales || []).forEach((sale: any) => {
      const inv = (sale.invoice_no || '').toString().trim().toUpperCase();
      const isStudioSale = inv.startsWith('STD-') || inv.startsWith('ST-');
      const baseTotal = Number(sale.total) || 0;
      const studioCharges = studioChargesBySaleId.get(sale.id) || 0;
      const debitAmount = isStudioSale ? baseTotal + studioCharges : baseTotal;
      transactions.push({
        id: sale.id,
        date: sale.invoice_date,
        referenceNo: sale.invoice_no || '',
        documentType: isStudioSale ? ('Studio Sale' as const) : ('Sale' as const),
        description: isStudioSale ? `Studio Sale ${sale.invoice_no || ''}` : `Sale Invoice ${sale.invoice_no}`,
        paymentAccount: '',
        notes: saleNotesMap.get(sale.id) || '',
        debit: debitAmount,
        credit: 0,
        runningBalance: 0, // Will be calculated
        linkedInvoices: [sale.invoice_no],
      });
    });

    // Studio orders (studio_orders table) – debit total_cost, credit advance_paid so net = balance_due
    let studioOrdersQuery = supabase
      .from('studio_orders')
      .select('id, order_no, order_date, total_cost, advance_paid, balance_due, notes')
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
      const orderNotes = [order.notes, advancePaid > 0 ? `Advance ${formatCurrency(advancePaid)}` : ''].filter(Boolean).join(' / ');
      transactions.push({
        id: order.id,
        date: order.order_date,
        referenceNo: order.order_no || `ORD-${(order.id || '').slice(0, 8)}`,
        documentType: 'Studio Order' as const,
        description: `Studio Order ${order.order_no || order.id?.slice(0, 8)}`,
        paymentAccount: '',
        notes: orderNotes || '',
        debit: totalCost,
        credit: advancePaid,
        runningBalance: 0,
        linkedInvoices: [],
      });
    });

    // Rentals: fetch via RPC or direct query (pass null dates to get all; filter in merge)
    let customerRentals: any[] = [];
    try {
      const rpcRentals = await supabase.rpc('get_customer_ledger_rentals', {
        p_company_id: companyId,
        p_customer_id: cId,
        p_from_date: null,
        p_to_date: null,
      });
      if (!rpcRentals.error) {
        customerRentals = rpcRentals.data ?? [];
      } else {
        const { data: directRentals } = await supabase
          .from('rentals')
          .select('id, booking_no, booking_date, pickup_date, return_date, total_amount, paid_amount, due_amount, created_at')
          .eq('company_id', companyId)
          .eq('customer_id', cId);
        customerRentals = directRentals ?? [];
      }
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') console.warn('[LEDGER] Rental fetch failed:', e);
    }
    const rentalIds = customerRentals.map((r: any) => r.id);
    const rentalNotesMap = new Map<string, string>();
    if (rentalIds.length > 0) {
      const { data: rentalNotes } = await supabase.from('rentals').select('id, notes').in('id', rentalIds);
      (rentalNotes || []).forEach((r: any) => { if (r.notes) rentalNotesMap.set(r.id, r.notes); });
    }
    let customerRentalPayments: any[] = [];
    if (rentalIds.length > 0) {
      let rpQuery = supabase
        .from('rental_payments')
        .select('id, rental_id, amount, method, reference, payment_date, created_at')
        .in('rental_id', rentalIds);
      if (fromDate) rpQuery = rpQuery.gte('payment_date', fromDate);
      if (toDate) rpQuery = rpQuery.lte('payment_date', toDate);
      const { data: rpData } = await rpQuery.order('payment_date', { ascending: false });
      customerRentalPayments = rpData ?? [];
    }
    const rentalsMap = new Map(customerRentals.map((r: any) => [r.id, r]));

    // Add rental charges as debit transactions
    customerRentals.forEach((r: any) => {
      const rawDate = r.pickup_date || r.booking_date || r.created_at;
      const d = rawDate ? (typeof rawDate === 'string' && rawDate.length >= 10 ? rawDate.slice(0, 10) : new Date(rawDate).toISOString().slice(0, 10)) : '';
      if (!d) return;
      if (fromDate && d < fromDate) return;
      if (toDate && d > toDate) return;
      const total = Number(r.total_amount) || 0;
      if (total <= 0) return;
      transactions.push({
        id: r.id,
        date: d,
        referenceNo: r.booking_no || `RN-${(r.id || '').slice(0, 8)}`,
        documentType: 'Rental' as const,
        description: `Rental ${r.booking_no || r.id?.slice(0, 8)}`,
        paymentAccount: '',
        notes: rentalNotesMap.get(r.id) || '',
        debit: total,
        credit: 0,
        runningBalance: 0,
        linkedInvoices: [r.booking_no || ''],
      });
    });

    // Add rental payments as credit transactions
    customerRentalPayments.forEach((p: any) => {
      const rawDate = p.payment_date || p.created_at;
      const d = rawDate ? (typeof rawDate === 'string' && rawDate.length >= 10 ? rawDate.slice(0, 10) : new Date(rawDate).toISOString().slice(0, 10)) : '';
      if (!d) return;
      if (fromDate && d < fromDate) return;
      if (toDate && d > toDate) return;
      const rental = rentalsMap.get(p.rental_id);
      const ref = rental?.booking_no || `RN-${(p.rental_id || '').slice(0, 8)}`;
      transactions.push({
        id: p.id,
        date: d,
        referenceNo: `${ref}-PAY`,
        documentType: 'Rental Payment' as const,
        description: `Rental Payment via ${p.method || 'other'}`,
        paymentAccount: p.method || '',
        notes: p.reference || '',
        debit: 0,
        credit: Number(p.amount) || 0,
        runningBalance: 0,
        linkedPayments: [`${ref}-PAY`],
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
        notes: ret.notes || '',
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

      // Rentals before fromDate: total charges - rental payments
      let prevRentalTotal = 0;
      let prevRentalPaid = 0;
      try {
        const rpcPrevRentals = await supabase.rpc('get_customer_ledger_rentals', {
          p_company_id: companyId,
          p_customer_id: cId,
          p_from_date: null,
          p_to_date: dayBeforeFrom,
        });
        const prevRentals = !rpcPrevRentals.error ? (rpcPrevRentals.data ?? []) : [];
        prevRentalTotal = prevRentals.reduce((s: number, r: any) => s + (Number(r.total_amount) || 0), 0);
        const prevRentalIds = prevRentals.map((r: any) => r.id);
        if (prevRentalIds.length > 0) {
          const { data: prevRp } = await supabase
            .from('rental_payments')
            .select('amount')
            .in('rental_id', prevRentalIds)
            .lt('payment_date', fromDate);
          prevRentalPaid = (prevRp || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
        }
      } catch (_) {}

      runningBalance = prevTotal - prevPaid - prevReturnsTotal - prevReturnPmts + prevStudioOrderNet + prevRentalTotal - prevRentalPaid;
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

    const { data: salesData, error } = await query.order('invoice_date', { ascending: false });

    if (error) throw error;
    const sales = salesData || [];

    // Studio sales: add production stage costs to invoice total (same as getTransactions)
    const studioSaleIds = sales
      .filter((s: any) => {
        const inv = (s.invoice_no || '').toString().trim().toUpperCase();
        return inv.startsWith('STD-') || inv.startsWith('ST-');
      })
      .map((s: any) => s.id);
    const studioChargesBySaleId = new Map<string, number>();
    if (studioSaleIds.length > 0) {
      try {
        const { data: productions } = await supabase
          .from('studio_productions')
          .select('id, sale_id')
          .in('sale_id', studioSaleIds);
        const prodIds = (productions || []).map((p: any) => p.id).filter(Boolean);
        if (prodIds.length > 0) {
          const { data: stages } = await supabase
            .from('studio_production_stages')
            .select('production_id, cost')
            .in('production_id', prodIds);
          const prodBySale = new Map<string, string>();
          (productions || []).forEach((p: any) => {
            if (p.sale_id) prodBySale.set(p.sale_id, p.id);
          });
          const chargesByProd = new Map<string, number>();
          (stages || []).forEach((s: any) => {
            const prev = chargesByProd.get(s.production_id) || 0;
            chargesByProd.set(s.production_id, prev + (Number(s.cost) || 0));
          });
          prodBySale.forEach((prodId, saleId) => {
            const ch = chargesByProd.get(prodId) || 0;
            if (ch > 0) studioChargesBySaleId.set(saleId, ch);
          });
        }
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') console.warn('[LEDGER] getInvoices studio charges failed:', e);
      }
    }

    return sales.map((sale: any) => {
      const inv = (sale.invoice_no || '').toString().trim().toUpperCase();
      const isStudioSale = inv.startsWith('STD-') || inv.startsWith('ST-');
      const baseTotal = Number(sale.total) || 0;
      const studioCharges = studioChargesBySaleId.get(sale.id) || 0;
      const invoiceTotal = isStudioSale ? baseTotal + studioCharges : baseTotal;
      const paidAmount = Number(sale.paid_amount) || 0;
      const pendingAmount = Math.max(0, invoiceTotal - paidAmount);
      const status = pendingAmount <= 0 ? 'Fully Paid' as const : paidAmount > 0 ? 'Partially Paid' as const : 'Unpaid' as const;
      return {
        invoiceNo: sale.invoice_no || '',
        date: sale.invoice_date,
        invoiceTotal,
        items: (sale.items || []).map((item: any) => ({
          itemName: item.product_name || '',
          qty: item.quantity || 0,
          rate: item.unit_price || 0,
          lineTotal: item.total || 0,
        })),
        status,
        paidAmount,
        pendingAmount,
      };
    });
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
