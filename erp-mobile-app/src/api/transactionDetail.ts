import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type TransactionReferenceType =
  | 'sale'
  | 'purchase'
  | 'payment'
  | 'expense'
  | 'expense_payment'
  | 'rental'
  | 'journal'
  | 'on_account'
  | 'worker_payment'
  | 'stock_movement'
  | 'studio';

export interface TransactionDetailLine {
  accountName: string;
  accountCode: string;
  debit: number;
  credit: number;
  description: string;
}

export interface TransactionDetail {
  id: string;
  entryNo: string;
  date: string;
  createdAt: string;
  referenceType: string;
  referenceId: string | null;
  description: string;
  lines: TransactionDetailLine[];
  totals: { debit: number; credit: number };
  headerMeta: Record<string, string | number | null>;
}

/**
 * Load a single transaction's full detail (journal entry lines + optional header
 * metadata pulled from the source table). referenceId is the source row id.
 * For `journal` the referenceId IS the journal_entries.id.
 */
export async function getTransactionDetail(
  companyId: string,
  referenceType: TransactionReferenceType,
  referenceId: string,
): Promise<{ data: TransactionDetail | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };

  let jeQuery = supabase
    .from('journal_entries')
    .select(
      `id, entry_no, entry_date, description, reference_type, reference_id, created_at, is_void,
       lines:journal_entry_lines(debit, credit, description, account:accounts(code, name))`,
    )
    .eq('company_id', companyId)
    .limit(1);

  if (referenceType === 'journal') {
    jeQuery = jeQuery.eq('id', referenceId);
  } else {
    jeQuery = jeQuery.eq('reference_id', referenceId);
  }

  const { data: jeRows, error: jeError } = await jeQuery;
  if (jeError) return { data: null, error: jeError.message };
  const je = (jeRows || [])[0] as Record<string, unknown> | undefined;

  let headerMeta: Record<string, string | number | null> = {};
  try {
    if (referenceType === 'sale') {
      const { data } = await supabase
        .from('sales')
        .select('invoice_no, customer_name, total, paid_amount, due_amount, invoice_date, payment_status, status')
        .eq('id', referenceId)
        .maybeSingle();
      if (data) {
        headerMeta = {
          'Invoice #': String(data.invoice_no ?? ''),
          Customer: String(data.customer_name ?? ''),
          Date: data.invoice_date ? String(data.invoice_date).slice(0, 10) : '',
          Total: Number(data.total) || 0,
          Paid: Number(data.paid_amount) || 0,
          Due: Number(data.due_amount) || 0,
          Status: String(data.status ?? ''),
          Payment: String(data.payment_status ?? ''),
        };
      }
    } else if (referenceType === 'purchase') {
      const { data } = await supabase
        .from('purchases')
        .select('po_no, supplier_name, total, paid_amount, due_amount, po_date, payment_status, status')
        .eq('id', referenceId)
        .maybeSingle();
      if (data) {
        headerMeta = {
          'PO #': String(data.po_no ?? ''),
          Supplier: String(data.supplier_name ?? ''),
          Date: data.po_date ? String(data.po_date).slice(0, 10) : '',
          Total: Number(data.total) || 0,
          Paid: Number(data.paid_amount) || 0,
          Due: Number(data.due_amount) || 0,
          Status: String(data.status ?? ''),
          Payment: String(data.payment_status ?? ''),
        };
      }
    } else if (referenceType === 'expense') {
      const { data } = await supabase
        .from('expenses')
        .select('expense_no, category, description, amount, payment_method, expense_date, status')
        .eq('id', referenceId)
        .maybeSingle();
      if (data) {
        headerMeta = {
          'Expense #': String(data.expense_no ?? ''),
          Category: String(data.category ?? ''),
          Description: String(data.description ?? ''),
          Amount: Number(data.amount) || 0,
          Method: String(data.payment_method ?? ''),
          Date: data.expense_date ? String(data.expense_date).slice(0, 10) : '',
          Status: String(data.status ?? ''),
        };
      }
    } else if (referenceType === 'payment') {
      const { data } = await supabase
        .from('payments')
        .select('payment_no, amount, payment_method, reference_number, payment_date, notes, status')
        .eq('id', referenceId)
        .maybeSingle();
      if (data) {
        headerMeta = {
          'Payment #': String(data.payment_no ?? ''),
          Amount: Number(data.amount) || 0,
          Method: String(data.payment_method ?? ''),
          Reference: String(data.reference_number ?? ''),
          Date: data.payment_date ? String(data.payment_date).slice(0, 10) : '',
          Notes: String(data.notes ?? ''),
          Status: String(data.status ?? ''),
        };
      }
    } else if (referenceType === 'stock_movement') {
      const { data } = await supabase
        .from('stock_movements')
        .select(
          `id, movement_type, quantity, unit_cost, total_cost, reference_type, reference_id, notes, created_at,
           product:products(name, sku),
           user:users(name, email)`,
        )
        .eq('id', referenceId)
        .maybeSingle();
      if (data) {
        const prod = (data.product as { name?: string; sku?: string } | null) || {};
        const u = (data.user as { name?: string; email?: string } | null) || {};
        headerMeta = {
          Product: String(prod.name ?? ''),
          SKU: String(prod.sku ?? ''),
          Type: String(data.movement_type ?? ''),
          Qty: Number(data.quantity) || 0,
          'Unit Cost': Number(data.unit_cost) || 0,
          'Total Cost': Number(data.total_cost) || 0,
          'Ref Type': String(data.reference_type ?? ''),
          Notes: String(data.notes ?? ''),
          By: String(u.name || u.email || ''),
          Date: data.created_at ? String(data.created_at).slice(0, 10) : '',
        };
      }
    } else if (referenceType === 'studio') {
      const { data } = await supabase
        .from('studio_productions')
        .select(
          `id, production_no, status, production_date, quantity, created_at,
           product:products(name, sku),
           sale:sales(invoice_no, customer_name, total),
           stages:studio_production_stages(id, stage_type, status, cost, worker:workers(name))`,
        )
        .eq('id', referenceId)
        .maybeSingle();
      if (data) {
        const prod = (data.product as { name?: string; sku?: string } | null) || {};
        const sale = (data.sale as { invoice_no?: string; customer_name?: string; total?: number } | null) || {};
        const stages = (data.stages as Array<{ stage_type: string; status: string; cost: number; worker?: { name?: string } }>) || [];
        const workerCost = stages.reduce((s, st) => s + (Number(st.cost) || 0), 0);
        const stagesCompleted = stages.filter((s) => s.status === 'completed').length;
        headerMeta = {
          'Production #': String(data.production_no ?? ''),
          Product: String(prod.name ?? ''),
          Invoice: String(sale.invoice_no ?? ''),
          Customer: String(sale.customer_name ?? ''),
          Quantity: Number(data.quantity) || 0,
          'Customer Charge': Number(sale.total) || 0,
          'Worker Cost': workerCost,
          Profit: (Number(sale.total) || 0) - workerCost,
          Stages: `${stagesCompleted}/${stages.length}`,
          Status: String(data.status ?? ''),
          Date: data.production_date ? String(data.production_date).slice(0, 10) : '',
        };
      }
    } else if (referenceType === 'rental') {
      const { data } = await supabase
        .from('rentals')
        .select(
          `id, booking_no, customer_name, status, booking_date, pickup_date, return_date, actual_return_date,
           total_amount, paid_amount, due_amount, penalty_amount, damage_amount, notes,
           items:rental_items(product_name, quantity, rate_per_day, duration_days, total)`,
        )
        .eq('id', referenceId)
        .maybeSingle();
      if (data) {
        const items = (data.items as Array<{ product_name: string; quantity: number; total: number }>) || [];
        const itemSummary = items.map((it) => `${it.product_name} ×${it.quantity}`).join(', ');
        headerMeta = {
          'Booking #': String(data.booking_no ?? ''),
          Customer: String(data.customer_name ?? ''),
          Status: String(data.status ?? ''),
          'Booking Date': data.booking_date ? String(data.booking_date).slice(0, 10) : '',
          Pickup: data.pickup_date ? String(data.pickup_date).slice(0, 10) : '',
          Return: data.return_date ? String(data.return_date).slice(0, 10) : '',
          'Returned On': data.actual_return_date ? String(data.actual_return_date).slice(0, 10) : '',
          Items: itemSummary,
          Total: Number(data.total_amount) || 0,
          Paid: Number(data.paid_amount) || 0,
          Due: Number(data.due_amount) || 0,
          Penalty: Number(data.penalty_amount) || 0,
          Damage: Number(data.damage_amount) || 0,
          Notes: String(data.notes ?? ''),
        };
      }
    }
  } catch {
    /* header meta is best-effort; continue with journal lines only */
  }

  if (!je) {
    if (Object.keys(headerMeta).length === 0) return { data: null, error: 'Transaction not found.' };
    return {
      data: {
        id: referenceId,
        entryNo: '',
        date: '',
        createdAt: '',
        referenceType,
        referenceId,
        description: '',
        lines: [],
        totals: { debit: 0, credit: 0 },
        headerMeta,
      },
      error: null,
    };
  }

  if (je.is_void === true) {
    return {
      data: {
        id: String(je.id),
        entryNo: String(je.entry_no ?? ''),
        date: je.entry_date ? String(je.entry_date).slice(0, 10) : '',
        createdAt: String(je.created_at ?? ''),
        referenceType: String(je.reference_type ?? referenceType),
        referenceId: je.reference_id ? String(je.reference_id) : referenceId,
        description: `[VOID] ${String(je.description ?? '')}`,
        lines: [],
        totals: { debit: 0, credit: 0 },
        headerMeta,
      },
      error: null,
    };
  }

  const linesRaw = (je.lines as Record<string, unknown>[]) || [];
  let totalDebit = 0;
  let totalCredit = 0;
  const lines: TransactionDetailLine[] = linesRaw.map((l) => {
    const acc = (l.account as Record<string, unknown>) || {};
    const d = Number(l.debit || 0);
    const c = Number(l.credit || 0);
    totalDebit += d;
    totalCredit += c;
    return {
      accountCode: String(acc.code ?? ''),
      accountName: String(acc.name ?? ''),
      debit: d,
      credit: c,
      description: String(l.description ?? ''),
    };
  });

  return {
    data: {
      id: String(je.id),
      entryNo: String(je.entry_no ?? ''),
      date: je.entry_date ? String(je.entry_date).slice(0, 10) : '',
      createdAt: String(je.created_at ?? ''),
      referenceType: String(je.reference_type ?? referenceType),
      referenceId: je.reference_id ? String(je.reference_id) : referenceId,
      description: String(je.description ?? ''),
      lines,
      totals: { debit: totalDebit, credit: totalCredit },
      headerMeta,
    },
    error: null,
  };
}
