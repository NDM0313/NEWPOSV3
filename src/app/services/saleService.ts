import { supabase } from '@/lib/supabase';
import { getDocumentConversionSchemaFlags } from '@/app/lib/documentConversionSchema';
import { SALE_BUSINESS_ONLY_STATUSES } from '@/app/lib/documentStatusConstants';
import {
  canPostAccountingForSaleStatus,
  canPostStockForSaleStatus,
  wasSalePostedForReversal,
} from '@/app/lib/postingStatusGate';
import { documentNumberService } from '@/app/services/documentNumberService';
import { generatePaymentReference } from '@/app/utils/paymentUtils';
import { employeeService } from './employeeService';
import { activityLogService } from '@/app/services/activityLogService';
import { settingsService } from '@/app/services/settingsService';
import { productService } from '@/app/services/productService';
import { postSaleDocumentAccounting, reverseSaleDocumentAccounting } from './documentPostingEngine';
import { auditLogService } from './auditLogService';
import { dispatchContactBalancesRefresh } from '@/app/lib/contactBalancesRefresh';
import {
  syncJournalEntryDateByDocumentRefs,
  syncJournalEntryDateByPaymentId,
} from '@/app/services/journalTransactionDateSyncService';

/** Enrich sales with creator full_name. sales.created_by stores auth.users.id; resolve via users.auth_user_id. */
async function enrichSalesWithCreatorNames(sales: any[]): Promise<void> {
  const ids = [...new Set((sales || []).map((s: any) => s.created_by).filter(Boolean))] as string[];
  if (ids.length === 0) return;
  const nameByCreatedBy = new Map<string, string>();
  // Primary: created_by = auth.users.id → join on users.auth_user_id
  const { data: usersByAuth } = await supabase.from('users').select('auth_user_id, full_name, email').in('auth_user_id', ids);
  (usersByAuth || []).forEach((u: any) => {
    if (u?.auth_user_id) nameByCreatedBy.set(u.auth_user_id, u.full_name || u.email || '');
  });
  // Fallback: legacy rows where created_by = public.users.id
  const missing = ids.filter((id) => !nameByCreatedBy.has(id));
  if (missing.length > 0) {
    const { data: usersById } = await supabase.from('users').select('id, full_name, email').in('id', missing);
    (usersById || []).forEach((u: any) => {
      if (u?.id) nameByCreatedBy.set(u.id, u.full_name || u.email || '');
    });
  }
  sales.forEach((sale: any) => {
    const uid = sale.created_by;
    if (uid && typeof uid === 'string') {
      const name = nameByCreatedBy.get(uid) || null;
      sale.created_by = { full_name: name };
    }
  });
}

export interface Sale {
  id?: string;
  company_id: string;
  branch_id: string;
  invoice_no?: string | null;
  /** Stage numbers (same row); invoice_no is final-only. */
  draft_no?: string | null;
  quotation_no?: string | null;
  order_no?: string | null;
  invoice_date: string;
  customer_id?: string;
  customer_name: string;
  contact_number?: string;
  type: 'invoice' | 'quotation';
  status: 'draft' | 'quotation' | 'order' | 'final' | 'cancelled';
  payment_status: 'paid' | 'partial' | 'unpaid';
  payment_method?: string;
  shipping_status?: 'pending' | 'processing' | 'delivered' | 'cancelled';
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  expenses: number; // Changed from shipping_charges to match DB
  total: number;
  paid_amount: number;
  due_amount: number;
  return_due?: number;
  notes?: string;
  /** Delivery/deadline date (YYYY-MM-DD) for studio sales. */
  deadline?: string;
  attachments?: { url: string; name: string }[] | null;
  created_by: string;
  is_studio?: boolean;
  /** Salesperson for commission (user id). */
  salesman_id?: string | null;
  /** Commission amount stored on sale for period reporting. */
  commission_amount?: number;
  /** Base amount used for commission calculation (e.g. subtotal, excludes shipping/freight). */
  commission_eligible_amount?: number | null;
  /** pending = not posted to ledger; posted = included in a commission batch */
  commission_status?: 'pending' | 'posted';
  /** Set when commission is posted via Generate to Ledger */
  commission_batch_id?: string | null;
  /** Commission rate at time of sale (for audit). */
  commission_percent?: number | null;
}

export interface SaleItem {
  product_id: string;
  variation_id?: string;
  product_name: string;
  sku: string; // Required in DB
  quantity: number;
  unit?: string;
  unit_price: number;
  /** Only discount_amount is stored in DB; percentage is UI-only. */
  discount_amount?: number;
  /** Only tax_amount is stored in DB; percentage is UI-only. */
  tax_amount?: number;
  total: number;
  // Packing fields
  packing_type?: string;
  packing_quantity?: number;
  packing_unit?: string;
  packing_details?: any; // JSONB
  notes?: string;
}

/** Options for createSale. allowNegativeStock: when true, skip stock check (caller already validated). */
export type CreateSaleOptions = {
  allowNegativeStock?: boolean;
};

function saleRowNeedsFinalInvoiceAllocation(row: Record<string, unknown>): boolean {
  const inv = String(row.invoice_no ?? '').trim();
  if (!inv) return true;
  return /^(SDR-|SQT-|SOR-)/i.test(inv);
}

function finalSaleDocumentSequenceKey(row: Record<string, unknown>): 'SL' | 'STD' | 'PS' {
  const isStudio =
    row.is_studio === true ||
    String(row.order_no ?? '')
      .toUpperCase()
      .startsWith('STD-') ||
    String(row.order_no ?? '')
      .toUpperCase()
      .startsWith('ST-');
  if (isStudio) return 'STD';
  const inv = String(row.invoice_no ?? '').trim();
  if (/^POS-/i.test(inv)) return 'PS';
  return 'SL';
}

/** True when DB rejected insert/update because (company_id, invoice_no) already exists. */
export function isSalesInvoiceNoUniqueViolation(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err || err.code !== '23505') return false;
  const m = String(err.message || '');
  return m.includes('idx_sales_company_invoice_no_when_set') || (m.includes('invoice_no') && m.includes('duplicate key'));
}

/** Allocate SL/STD/PS invoice_no when final if missing or still SDR/SQT/SOR. Retries on rare RPC/DB drift duplicates. */
async function ensureFinalSaleInvoiceNoAllocated(saleId: string, row: Record<string, unknown>) {
  if (!saleRowNeedsFinalInvoiceAllocation(row)) return row;
  const companyId = String(row.company_id ?? '');
  if (!companyId) throw new Error('Cannot finalize: company_id missing.');
  const seq = finalSaleDocumentSequenceKey(row);
  const maxAttempts = 12;
  let lastDup: string | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let nextNo: string;
    try {
      nextNo = await documentNumberService.getNextDocumentNumberGlobal(companyId, seq);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Cannot finalize: could not allocate invoice number (${seq}). ${msg}`);
    }
    const { data: patched, error } = await supabase
      .from('sales')
      .update({ invoice_no: nextNo })
      .eq('id', saleId)
      .select()
      .single();
    if (!error) {
      return (patched ?? { ...row, invoice_no: nextNo }) as Record<string, unknown>;
    }
    if (isSalesInvoiceNoUniqueViolation(error)) {
      lastDup = nextNo;
      continue;
    }
    throw new Error(`Cannot finalize: failed to save invoice number: ${error.message}`);
  }
  throw new Error(
    `Cannot finalize: invoice number still conflicts after ${maxAttempts} attempts (last tried: ${lastDup ?? 'n/a'}).`
  );
}

export const saleService = {
  // Create sale with items. options.allowNegativeStock from caller (context or DB) — allow if either says true.
  async createSale(sale: Sale, items: SaleItem[], options?: CreateSaleOptions) {
    const fromCaller = options?.allowNegativeStock === true;
    const fromDb = fromCaller ? true : await settingsService.getAllowNegativeStock(sale.company_id);
    const allowNegative = fromCaller || fromDb;
    if (import.meta.env?.DEV) {
      console.log('[SALE SERVICE] Negative stock check:', { allowNegative, fromCaller, fromDb, companyId: sale.company_id });
    }
    const inv = (sale.invoice_no || '').toString();
    const ord = ((sale as { order_no?: string | null }).order_no || '').toString();
    const isStudio =
      (sale as { is_studio?: boolean }).is_studio === true ||
      ord.toUpperCase().startsWith('STD-') ||
      ord.toUpperCase().startsWith('ST-') ||
      inv.toUpperCase().startsWith('STD-') ||
      inv.toUpperCase().startsWith('ST-');
    if (isStudio && items.length === 0) {
      throw new Error('Studio order must have at least one product (fabric/material). Add an item before saving.');
    }
    if (canPostStockForSaleStatus(sale.status) && items.length > 0 && !allowNegative) {
      const branchId = sale.branch_id || undefined;
      const productIds = [...new Set(items.map(i => i.product_id))];
      const stockMap = await productService.getStockForProducts(productIds, sale.company_id, branchId);
      for (const item of items) {
        const key = item.variation_id ? `${item.product_id}:${item.variation_id}` : `${item.product_id}:`;
        const currentBalance = stockMap.get(key) ?? 0;
        if (Number(item.quantity) > currentBalance) {
          throw new Error(
            `Insufficient stock: ${item.product_name || item.sku} — requested ${item.quantity}, available ${currentBalance}. ` +
            'Enable "Negative Stock Allowed" in Settings → Inventory to allow.'
          );
        }
      }
    }

    // Build insert row: notes + deadline (always send both so JSON never drops them)
    const deadlineForDb = sale.deadline != null && String(sale.deadline).trim() !== '' ? String(sale.deadline).trim() : null;
    const insertRow = {
      ...sale,
      notes: sale.notes ?? null,
      deadline: deadlineForDb,
      // Same-row lifecycle: non-posted stages use draft_no / quotation_no / order_no; invoice_no only when final
      draft_no: sale.draft_no ?? null,
      quotation_no: sale.quotation_no ?? null,
      order_no: sale.order_no ?? null,
      invoice_no: canPostAccountingForSaleStatus(sale.status) ? sale.invoice_no ?? null : null,
    };
    if (import.meta.env?.DEV && deadlineForDb) {
      console.log('[SALE SERVICE] createSale inserting deadline:', deadlineForDb);
    }

    let saleData: any;
    const { data: inserted, error: saleError } = await supabase
      .from('sales')
      .insert(insertRow)
      .select()
      .single();

    if (saleError) {
      // If insert fails because deadline column is missing, retry without deadline then update
      const missingColumn = saleError.message?.includes('deadline') || saleError.code === '42703';
      if (missingColumn && sale.deadline) {
        const { deadline: _d, ...rowWithoutDeadline } = insertRow;
        const retry = await supabase.from('sales').insert(rowWithoutDeadline).select().single();
        if (retry.error) throw retry.error;
        saleData = retry.data;
        const { error: upErr } = await supabase.from('sales').update({ deadline: sale.deadline }).eq('id', saleData.id);
        if (upErr) console.warn('[SALE SERVICE] deadline update failed:', upErr.message);
        (saleData as any).deadline = upErr ? null : sale.deadline;
      } else if (isSalesInvoiceNoUniqueViolation(saleError)) {
        // 409 / 23505 on invoice_no: final sales get a fresh invoice; studio/order-stage rows use order_no (STD) — duplicate can happen when DB trigger or drift collides; non-final was previously not recovered.
        const studioOrderStage =
          !canPostAccountingForSaleStatus(sale.status) &&
          ((sale as { is_studio?: boolean }).is_studio === true ||
            /^STD-/i.test(String(sale.order_no ?? '').trim()) ||
            /^ST-/i.test(String(sale.order_no ?? '').trim()));

        if (canPostAccountingForSaleStatus(sale.status)) {
          const retryRow = { ...insertRow, invoice_no: null as string | null };
          const retry = await supabase.from('sales').insert(retryRow).select().single();
          if (retry.error) {
            const miss2 = retry.error.message?.includes('deadline') || retry.error.code === '42703';
            if (miss2 && sale.deadline) {
              const { deadline: _d2, ...noDl } = retryRow;
              const r2 = await supabase.from('sales').insert(noDl).select().single();
              if (r2.error) throw r2.error;
              saleData = r2.data;
              const { error: upErr } = await supabase.from('sales').update({ deadline: sale.deadline }).eq('id', saleData.id);
              if (upErr) console.warn('[SALE SERVICE] deadline update failed:', upErr.message);
              (saleData as any).deadline = upErr ? null : sale.deadline;
            } else {
              throw retry.error;
            }
          } else {
            saleData = retry.data;
          }
          const mergedForAlloc = {
            ...saleData,
            company_id: sale.company_id,
            is_studio: (sale as { is_studio?: boolean }).is_studio,
            order_no: sale.order_no,
          } as Record<string, unknown>;
          saleData = (await ensureFinalSaleInvoiceNoAllocated(String(saleData.id), mergedForAlloc)) as typeof saleData;
          if (import.meta.env?.DEV) {
            console.warn('[SALE SERVICE] Recovered from duplicate invoice_no; allocated new number:', (saleData as any)?.invoice_no);
          }
        } else if (studioOrderStage && sale.company_id) {
          let freshStd: string;
          try {
            freshStd = await documentNumberService.getNextDocumentNumberGlobal(String(sale.company_id), 'STD');
          } catch {
            throw saleError;
          }
          const retryRow = {
            ...insertRow,
            invoice_no: null as string | null,
            order_no: freshStd,
          };
          const retry = await supabase.from('sales').insert(retryRow).select().single();
          if (retry.error) {
            const miss2 = retry.error.message?.includes('deadline') || retry.error.code === '42703';
            if (miss2 && sale.deadline) {
              const { deadline: _d2, ...noDl } = retryRow;
              const r2 = await supabase.from('sales').insert(noDl).select().single();
              if (r2.error) throw r2.error;
              saleData = r2.data;
              const { error: upErr } = await supabase.from('sales').update({ deadline: sale.deadline }).eq('id', saleData.id);
              if (upErr) console.warn('[SALE SERVICE] deadline update failed:', upErr.message);
              (saleData as any).deadline = upErr ? null : sale.deadline;
            } else {
              throw retry.error;
            }
          } else {
            saleData = retry.data;
          }
          if (import.meta.env?.DEV) {
            console.warn('[SALE SERVICE] Recovered studio order duplicate; fresh order_no:', freshStd);
          }
        } else {
          throw saleError;
        }
      } else {
        throw saleError;
      }
    } else {
      saleData = inserted;
    }

    // Persist deadline: try direct update, then RPC fallback so it always saves
    if (deadlineForDb && saleData?.id) {
      const { error: deadlineUpErr } = await supabase
        .from('sales')
        .update({ deadline: deadlineForDb })
        .eq('id', saleData.id);
      if (deadlineUpErr) {
        console.warn('[SALE SERVICE] deadline update failed, trying RPC:', deadlineUpErr.message);
        const { error: rpcErr } = await supabase.rpc('set_sale_deadline', {
          p_sale_id: saleData.id,
          p_deadline: deadlineForDb,
        });
        if (rpcErr) {
          console.warn('[SALE SERVICE] set_sale_deadline RPC failed:', rpcErr.message);
          (saleData as any).deadlineError = deadlineUpErr.message || rpcErr.message;
        } else {
          (saleData as any).deadline = deadlineForDb;
        }
      } else {
        (saleData as any).deadline = deadlineForDb;
      }
    }

    // Insert items: only send columns that exist in DB (no discount_percentage / tax_percentage)
    const sanitizeItem = (item: SaleItem) => {
      const row: Record<string, unknown> = { ...item, sale_id: saleData.id };
      delete row.discount_percentage;
      delete row.tax_percentage;
      return row;
    };
    const itemsWithSaleId = items.map(sanitizeItem);

    // CRITICAL FIX: Use sales_items table (created via migration)
    // Try sales_items first, fallback to sale_items for backward compatibility
    let itemsError: any = null;
    const { error: salesItemsError } = await supabase
      .from('sales_items')
      .insert(itemsWithSaleId);
    
    if (salesItemsError) {
      itemsError = salesItemsError;
    }

    if (itemsError) {
      // ROLLBACK: Delete sale if items insert fails
      await supabase.from('sales').delete().eq('id', saleData.id);
      throw new Error(`Failed to create sale items: ${itemsError.message}. Sale rolled back.`);
    }

    void auditLogService.logSaleAction(sale.company_id, saleData.id, 'created', {
      invoice_no: saleData.invoice_no,
      draft_no: (saleData as any).draft_no,
      quotation_no: (saleData as any).quotation_no,
      order_no: (saleData as any).order_no,
    });

    // CRITICAL FIX: Fetch the complete sale with items to return
    // This ensures items are included in the response
    let completeSale = null;
    let fetchError = null;

    // Try sales_items first
    const { data: salesItemsData, error: fetchSalesItemsError } = await supabase
      .from('sales')
      .select(`
        *,
        customer:contacts(*),
        items:sales_items(
          *,
          product:products(id, name, sku, cost_price, retail_price, has_variations),
          variation:product_variations(id, product_id, sku, attributes)
        )
      `)
      .eq('id', saleData.id)
      .single();

    if (fetchSalesItemsError) {
      // If sales_items fails, try sale_items (backward compatibility)
      if (fetchSalesItemsError.code === '42P01' || fetchSalesItemsError.message?.includes('does not exist')) {
        const { data: saleItemsData, error: fetchSaleItemsError } = await supabase
          .from('sales')
          .select(`
            *,
            customer:contacts(*),
            items:sale_items(
              *,
              product:products(id, name, sku, cost_price, retail_price, has_variations),
              variation:product_variations(id, product_id, sku, attributes)
            )
          `)
          .eq('id', saleData.id)
          .single();
        
        if (!fetchSaleItemsError) {
          completeSale = saleItemsData;
        } else {
          fetchError = fetchSaleItemsError;
        }
      } else {
        fetchError = fetchSalesItemsError;
      }
    } else {
      completeSale = salesItemsData;
    }

    if (fetchError || !completeSale) {
      // If fetch fails, still return saleData (items will be fetched separately on refresh)
      console.warn('[SALE SERVICE] Failed to fetch sale with items:', fetchError);
      return saleData;
    }

    return completeSale;
  },

  // Get single sale by ID (with items for edit form).
  // DB may have sale_items or sales_items; if nested items are empty, fetch items separately.
  async getSaleById(saleId: string) {
    const selectWithItems = (table: 'sales_items' | 'sale_items') => `
      *,
      customer:contacts(*),
      branch:branches(id, name, code),
      items:${table}(
        *,
        product:products(id, name, sku, cost_price, retail_price, has_variations),
        variation:product_variations(id, product_id, sku, attributes)
      )
    `;
    let data: any = null;
    let err: any = null;

    const res1 = await supabase.from('sales').select(selectWithItems('sales_items')).eq('id', saleId).single();
    if (!res1.error && res1.data) {
      data = res1.data;
    } else {
      const res2 = await supabase.from('sales').select(selectWithItems('sale_items')).eq('id', saleId).single();
      if (!res2.error && res2.data) data = res2.data;
      else err = res2.error;
    }

    if (err) throw err;
    if (!data) throw new Error('Sale not found');

    // If items missing (wrong table or RLS), fetch line items directly
    if (!data.items || data.items.length === 0) {
      const { data: rows } = await supabase.from('sales_items').select('*, product:products(id, name, sku, cost_price, retail_price, has_variations), variation:product_variations(id, product_id, sku, attributes)').eq('sale_id', saleId);
      if (rows && rows.length > 0) data.items = rows;
      else {
        const { data: rows2 } = await supabase.from('sale_items').select('*, product:products(id, name, sku, cost_price, retail_price, has_variations), variation:product_variations(id, product_id, sku, attributes)').eq('sale_id', saleId);
        if (rows2 && rows2.length > 0) data.items = rows2;
      }
    }

    // 🔒 LOCK CHECK: Check if sale has returns (prevents editing)
    const { data: returns } = await supabase
      .from('sale_returns')
      .select('id')
      .eq('original_sale_id', saleId)
      .eq('status', 'final')
      .limit(1);
    
    data.hasReturn = (returns && returns.length > 0) || false;
    data.returnCount = returns?.length || 0;

    // Line-level charges for edit form (sale_charges table)
    const { data: chargeRows } = await supabase.from('sale_charges').select('*').eq('sale_id', saleId);
    data.charges = Array.isArray(chargeRows) ? chargeRows : [];

    // Enrich creator name for sale details (created_by = auth.users.id → resolve via users.auth_user_id)
    await enrichSalesWithCreatorNames([data]);

    return data;
  },

  /** One row per charge for audit-ready ledger. */
  replaceSaleCharges(saleId: string, charges: { charge_type: string; amount: number; ledger_account_id?: string | null }[], createdBy?: string | null) {
    return (async () => {
      const { error: delError } = await supabase.from('sale_charges').delete().eq('sale_id', saleId);
      if (delError) {
        console.warn('[SALE SERVICE] replaceSaleCharges delete failed:', delError);
        throw delError;
      }
      const chargeRows = (charges || []).filter((c) => c.amount > 0).map((c) => ({
        sale_id: saleId,
        charge_type: c.charge_type,
        ledger_account_id: c.ledger_account_id ?? null,
        amount: Number(c.amount),
        created_by: createdBy ?? null,
      }));
      if (chargeRows.length > 0) {
        const { error: insError } = await supabase.from('sale_charges').insert(chargeRows);
        if (insError) {
          console.warn('[SALE SERVICE] replaceSaleCharges insert failed:', insError);
          throw insError;
        }
      }
    })();
  },

  /** Pagination options: when provided, returns { data, total }; otherwise returns data array (backward compat). */
  async getAllSales(
    companyId: string,
    branchId?: string,
    opts?: { limit?: number; offset?: number }
  ): Promise<any[] | { data: any[]; total: number }> {
    const selectWithoutCreator = `*, customer:contacts(*), branch:branches(id, name, code), items:sales_items(*, product:products(id, name, sku, cost_price, retail_price, has_variations), variation:product_variations(id, product_id, sku, attributes))`;
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    const schemaFlags = await getDocumentConversionSchemaFlags();
    const runMainList = (hideConverted: boolean) => {
      let q = supabase
        .from('sales')
        .select(selectWithoutCreator, opts ? { count: 'exact' } : undefined)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .order('invoice_date', { ascending: false });
      if (hideConverted && schemaFlags.salesConvertedColumn) q = q.eq('converted', false);
      if (branchId) q = q.eq('branch_id', branchId);
      if (opts) q = q.range(offset, offset + limit - 1);
      return q;
    };

    let { data, error, count } = await runMainList(true);
    if (error && schemaFlags.salesConvertedColumn) {
      const retry = await runMainList(false);
      if (!retry.error) {
        data = retry.data;
        error = retry.error;
        count = retry.count;
      }
    }

    if (error && (error.code === '42P01' || error.message?.includes('sales_items'))) {
      if (opts) throw error;
      const altSelect = `*, customer:contacts(*), branch:branches(id, name, code), items:sale_items(*, product:products(id, name, sku, cost_price, retail_price, has_variations), variation:product_variations(id, product_id, sku, attributes))`;
      let retryQuery = supabase.from('sales').select(altSelect).eq('company_id', companyId).order('invoice_date', { ascending: false });
      if (branchId) retryQuery = retryQuery.eq('branch_id', branchId);
      const { data: retryData, error: retryError } = await retryQuery;
      if (retryError) throw retryError;
      await enrichSalesWithCreatorNames(retryData || []);
      if (retryData && retryData.length > 0) {
        const saleIds = retryData.map((s: any) => s.id);
        const { data: allReturns } = await supabase.from('sale_returns').select('original_sale_id').in('original_sale_id', saleIds).eq('status', 'final');
        const returnsMap = new Map<string, number>();
        (allReturns || []).forEach((r: any) => { const c = returnsMap.get(r.original_sale_id) || 0; returnsMap.set(r.original_sale_id, c + 1); });
        retryData.forEach((sale: any) => { sale.hasReturn = returnsMap.has(sale.id); sale.returnCount = returnsMap.get(sale.id) || 0; });
        try {
          const { data: studioRows } = await supabase.rpc('get_sale_studio_charges_batch', { p_sale_ids: saleIds });
          if (studioRows && Array.isArray(studioRows)) {
            const studioBySale = new Map<string, number>();
            (studioRows as { sale_id: string; studio_cost: number }[]).forEach((row: any) => {
              if (row.sale_id) studioBySale.set(row.sale_id, Number(row.studio_cost) || 0);
            });
            retryData.forEach((sale: any) => {
              const cost = studioBySale.get(sale.id);
              if (cost != null && cost > 0) {
                sale.studio_charges = cost; // metadata only — don't recalculate due_amount (studio line already in total)
              }
            });
          }
        } catch (_) {}
      }
      return retryData || [];
    }

    if (error) throw error;

    await enrichSalesWithCreatorNames(data || []);

    // 🔒 LOCK CHECK: Add hasReturn and returnCount to each sale
    if (data && data.length > 0) {
      const saleIds = data.map((s: any) => s.id);
      const { data: allReturns } = await supabase
        .from('sale_returns')
        .select('original_sale_id')
        .in('original_sale_id', saleIds)
        .eq('status', 'final');
      const returnsMap = new Map<string, number>();
      (allReturns || []).forEach((r: any) => {
        const count = returnsMap.get(r.original_sale_id) || 0;
        returnsMap.set(r.original_sale_id, count + 1);
      });
      data.forEach((sale: any) => {
        sale.hasReturn = returnsMap.has(sale.id);
        sale.returnCount = returnsMap.get(sale.id) || 0;
      });

      // Enrich studio cost from productions/stages so due balance = (total + studio_charges) - paid
      try {
        const { data: studioRows } = await supabase.rpc('get_sale_studio_charges_batch', {
          p_sale_ids: saleIds,
        });
        if (studioRows && Array.isArray(studioRows)) {
          const studioBySale = new Map<string, number>();
          (studioRows as { sale_id: string; studio_cost: number }[]).forEach((row: any) => {
            const id = row.sale_id;
            if (id) studioBySale.set(id, Number(row.studio_cost) || 0);
          });
          data.forEach((sale: any) => {
            const cost = studioBySale.get(sale.id);
            if (cost != null && cost > 0) {
              sale.studio_charges = cost; // metadata only — don't recalculate due_amount (studio line already in total)
            }
          });
        }
      } catch (_) {
        // RPC may not exist yet (migration not run); leave studio_charges/due_amount as from DB
      }

      // Enrich from sales_with_shipping (first shipment status per sale — avoid N+1)
      try {
        const { data: shippingRows } = await supabase
          .from('sales_with_shipping')
          .select('id, shipment_status, first_shipment_id')
          .in('id', saleIds);
        if (shippingRows && shippingRows.length > 0) {
          const bySale = new Map(shippingRows.map((r: any) => [r.id, r]));
          data.forEach((sale: any) => {
            const row = bySale.get(sale.id);
            if (row) {
              sale.shipment_status = row.shipment_status;
              sale.first_shipment_id = row.first_shipment_id;
            }
          });
        }
      } catch (_) {
        // View may not exist yet (migration not run)
      }
    }

    if (opts) {
      return { data: data || [], total: count ?? 0 };
    }
    return data || [];
  },

  /** Get next studio invoice number from DB. Uses ORDER BY + LIMIT 1 instead of fetching all rows. */
  async getNextStudioInvoiceNumber(companyId: string): Promise<number> {
    const { data, error } = await supabase
      .from('sales')
      .select('invoice_no')
      .eq('company_id', companyId)
      .ilike('invoice_no', 'STD-%')
      .order('invoice_no', { ascending: false })
      .limit(1);
    if (error || !data || data.length === 0) return 1;
    const match = (data[0].invoice_no || '').match(/^STD-0*(\d+)$/i);
    return match ? parseInt(match[1], 10) + 1 : 1;
  },

  // Get studio sales (is_studio/order_no/invoice_no). Optional pagination: opts = { limit?, offset? } returns { data, total }.
  async getStudioSales(
    companyId: string,
    branchId?: string,
    opts?: { limit?: number; offset?: number }
  ): Promise<any[] | { data: any[]; total: number }> {
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    const schemaFlags = await getDocumentConversionSchemaFlags();
    const selectWithItems = (itemsTable: 'sales_items' | 'sale_items') =>
      `*, customer:contacts(name, phone), items:${itemsTable}(*)`;
    const runQuery = async (
      itemsTable: 'sales_items' | 'sale_items',
      orderBy: string,
      useRange: boolean,
      hideConverted: boolean
    ) => {
      let q = supabase
        .from('sales')
        .select(selectWithItems(itemsTable), useRange ? { count: 'exact' } : undefined)
        .eq('company_id', companyId)
        // Studio identity can be on is_studio flag or order/invoice prefixes depending on lifecycle stage.
        .or('is_studio.eq.true,order_no.ilike.STD-%,order_no.ilike.ST-%,invoice_no.ilike.STD-%,invoice_no.ilike.ST-%')
        .neq('status', 'cancelled');
      if (hideConverted && schemaFlags.salesConvertedColumn) q = q.eq('converted', false);
      if (branchId && branchId !== 'all') q = q.eq('branch_id', branchId);
      q = q.order(orderBy, { ascending: false });
      if (useRange) q = q.range(offset, offset + limit - 1);
      return await q;
    };
    let result: { data: any[]; error: any; count?: number } = await runQuery('sales_items', 'invoice_date', !!opts, true);
    if (result.error && schemaFlags.salesConvertedColumn) {
      const r0 = await runQuery('sales_items', 'invoice_date', !!opts, false);
      if (!r0.error) result = r0;
    }
    if (result.error && (result.error.code === '42P01' || result.error.code === '42703' || String(result.error.message || '').includes('sales_items') || String(result.error.message || '').includes('invoice_date'))) {
      result = await runQuery('sale_items', 'created_at', !!opts, true);
      if (result.error && schemaFlags.salesConvertedColumn) {
        const r1 = await runQuery('sale_items', 'created_at', !!opts, false);
        if (!r1.error) result = r1;
      }
    }
    if (result.error) throw result.error;
    const data = result.data || [];
    if (opts) return { data, total: result.count ?? 0 };
    return data;
  },
  
  // Get single sale (include sale_charges for line-level extra expenses on edit)
  async getSale(id: string) {
    const baseSelect = `
      *,
      customer:contacts(*),
      items:sales_items(
        *,
        product:products(id, name, sku, cost_price, retail_price, has_variations),
        variation:product_variations(id, product_id, sku, attributes)
      ),
      sale_charges(*)
    `;
    const { data, error } = await supabase
      .from('sales')
      .select(baseSelect)
      .eq('id', id)
      .single();

    const saleData = data;
    if (error) throw error;

    // 🔒 LOCK CHECK: Check if sale has returns (prevents editing)
    const { data: returns } = await supabase
      .from('sale_returns')
      .select('id')
      .eq('original_sale_id', id)
      .eq('status', 'final')
      .limit(1);
    
    if (saleData) {
      saleData.hasReturn = (returns && returns.length > 0) || false;
      saleData.returnCount = returns?.length || 0;
      saleData.charges = Array.isArray((saleData as any).sale_charges) ? (saleData as any).sale_charges : [];
    }

    return saleData;
  },

  /** Cancel final sale: reverses stock, sets status=cancelled. shippingDeduction keeps that amount in AR (not refunded to customer). */
  async cancelSale(
    id: string,
    options?: { reason?: string; performedBy?: string; refundOption?: string; refundAmount?: number; refundMethod?: string; refundAccountId?: string; shippingDeduction?: number }
  ) {
    await this.updateSaleStatus(id, 'cancelled');
    // Shipping is non-refundable: shipping JE (Dr AR, Cr Shipping Income) stays active.
    // No shipping deduction JE needed since cancel reversal no longer touches shipping.
  },

  // Update sale status (when 'cancelled': create SALE_CANCELLED stock reversals, then update status)
  async updateSaleStatus(id: string, status: Sale['status']) {
    if (status === 'cancelled') {
      const { data: saleRow } = await supabase.from('sales').select('id, invoice_no, branch_id, company_id, total, status, discount_amount, shipment_charges').eq('id', id).single();
      if (!saleRow) throw new Error('Sale not found');
      const invoiceNo = (saleRow as any).invoice_no || `SL-${id.substring(0, 8)}`;
      const priorPosted = wasSalePostedForReversal((saleRow as any).status);

      // Draft / quotation / order: no stock reversal, no accounting reversal (nothing was posted)
      if (!priorPosted) {
        const { data, error } = await supabase.from('sales').update({ status }).eq('id', id).select().single();
        if (error) throw error;
        return data;
      }

      const { data: existingReversal } = await supabase
        .from('stock_movements')
        .select('id')
        .eq('reference_type', 'sale')
        .eq('reference_id', id)
        .eq('movement_type', 'SALE_CANCELLED')
        .limit(1);
      if (existingReversal && existingReversal.length > 0) {
        const { data, error } = await supabase.from('sales').update({ status }).eq('id', id).select().single();
        if (error) throw error;
        return data;
      }

      const { data: stockMovements } = await supabase
        .from('stock_movements')
        .select('id, company_id, branch_id, product_id, variation_id, quantity, unit_cost, total_cost, box_change, piece_change')
        .eq('reference_type', 'sale')
        .eq('reference_id', id)
        .eq('movement_type', 'sale');

      // Smart cancel: subtract already-returned quantities so we don't double-count.
      // Returns that are still active (not voided) already added stock back; only reverse the NET remaining.
      const returnedQtyMap = new Map<string, number>();
      const returnedBoxMap = new Map<string, number>();
      const returnedPieceMap = new Map<string, number>();
      {
        const { data: activeReturns } = await supabase
          .from('sale_returns')
          .select('id')
          .eq('original_sale_id', id)
          .neq('status', 'void');
        const activeReturnIds = (activeReturns || []).map((r: any) => r.id);
        if (activeReturnIds.length > 0) {
          // Get return stock movements (positive qty = stock added back)
          const { data: returnMov } = await supabase
            .from('stock_movements')
            .select('product_id, variation_id, quantity, box_change, piece_change')
            .in('reference_id', activeReturnIds)
            .eq('reference_type', 'sale_return')
            .in('movement_type', ['sale_return', 'sell_return']);
          for (const rm of returnMov || []) {
            const key = `${rm.product_id}:${rm.variation_id || ''}`;
            returnedQtyMap.set(key, (returnedQtyMap.get(key) || 0) + Math.abs(Number(rm.quantity) || 0));
            if (rm.box_change != null) returnedBoxMap.set(key, (returnedBoxMap.get(key) || 0) + Math.abs(Number(rm.box_change) || 0));
            if (rm.piece_change != null) returnedPieceMap.set(key, (returnedPieceMap.get(key) || 0) + Math.abs(Number(rm.piece_change) || 0));
          }
        }
      }

      if (stockMovements && stockMovements.length > 0) {
        for (const m of stockMovements) {
          const key = `${m.product_id}:${m.variation_id || ''}`;
          const alreadyReturned = returnedQtyMap.get(key) || 0;
          const originalQty = Math.abs(Number(m.quantity) || 0);
          const netReverseQty = Math.max(0, originalQty - alreadyReturned);
          // Consume used return qty so it's not double-subtracted for a second movement with same key
          if (alreadyReturned > 0) returnedQtyMap.set(key, Math.max(0, alreadyReturned - originalQty));

          if (netReverseQty <= 0) continue; // Fully returned — nothing to reverse

          const originalCost = Math.abs(Number(m.total_cost) || 0);
          const costRatio = originalQty > 0 ? netReverseQty / originalQty : 1;

          const reverseMovement: Record<string, unknown> = {
            company_id: m.company_id,
            branch_id: m.branch_id,
            product_id: m.product_id,
            variation_id: m.variation_id ?? null,
            movement_type: 'SALE_CANCELLED',
            quantity: netReverseQty,
            unit_cost: Number(m.unit_cost) || 0,
            total_cost: Math.round(originalCost * costRatio * 100) / 100,
            reference_type: 'sale',
            reference_id: id,
            notes: alreadyReturned > 0
              ? `Reversal of ${invoiceNo} (Cancelled, net of ${alreadyReturned} returned)`
              : `Reversal of ${invoiceNo} (Cancelled)`,
          };
          if (m.box_change != null) {
            const retBox = returnedBoxMap.get(key) || 0;
            reverseMovement.box_change = Math.max(0, Math.abs(Number(m.box_change) || 0) - retBox);
          }
          if (m.piece_change != null) {
            const retPiece = returnedPieceMap.get(key) || 0;
            reverseMovement.piece_change = Math.max(0, Math.abs(Number(m.piece_change) || 0) - retPiece);
          }
          const { error: insertErr } = await supabase.from('stock_movements').insert(reverseMovement);
          if (insertErr) throw insertErr;
        }
      }

      // Payments are NOT voided on cancel — the money was received and stays in the books.
      // After cancellation, customer has a credit balance (we owe them refund).
      // Shipping JEs also stay (courier was already paid).
      // The refund is processed manually when the company pays the customer back.

      const { data, error } = await supabase.from('sales').update({ status }).eq('id', id).select().single();
      if (error) throw error;

      // Accounting reversal: only if the sale was previously posted (final)
      if (priorPosted) {
        reverseSaleDocumentAccounting(id).catch((err: any) =>
          console.warn('[saleService] Document accounting reversal failed (non-critical):', err?.message)
        );
      }

      // Refresh customer balance so cancelled sale reflects in customer ledger immediately
      if ((saleRow as any).company_id) {
        dispatchContactBalancesRefresh((saleRow as any).company_id);
      }

      return data;
    }

    const { data: priorForStatus } = await supabase.from('sales').select('status').eq('id', id).maybeSingle();
    if (String((priorForStatus as { status?: string } | null)?.status).toLowerCase() === 'cancelled') {
      throw new Error(
        'Cannot change status from cancelled. Use Restore to Draft, Quotation, or Order from the sales list first.'
      );
    }

    let { data, error } = await supabase
      .from('sales')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Accounting: canonical document JE when sale is finalized (single posting engine)
    if (canPostAccountingForSaleStatus(status)) {
      try {
        data = (await ensureFinalSaleInvoiceNoAllocated(id, data as Record<string, unknown>)) as typeof data;
      } catch (allocErr: unknown) {
        const msg = allocErr instanceof Error ? allocErr.message : String(allocErr);
        await supabase.from('sales').update({ status: (priorForStatus as { status?: string } | null)?.status ?? 'order' }).eq('id', id);
        throw new Error(msg);
      }
      postSaleDocumentAccounting(data.id).catch((err: any) =>
        console.warn('[saleService] Sale document posting engine failed (non-critical):', err?.message)
      );
    }

    // Commission: NOT posted here. Stored on sale (commission_amount, commission_status=pending).
    // Admin posts via Commission Report → "Post Commission" (batch) only.

    return data;
  },

  /**
   * QA / repair: if status is final but invoice_no is empty or still SDR/SQT/SOR, allocate SL/STD/PS and persist.
   * Does not change status or re-run document posting.
   */
  async repairMissingFinalInvoiceNumber(id: string) {
    const { data: row, error } = await supabase.from('sales').select('*').eq('id', id).maybeSingle();
    if (error || !row) throw new Error('Sale not found');
    if (!canPostAccountingForSaleStatus((row as { status?: string }).status)) {
      throw new Error('Repair invoice number only applies to finalized (posted) sales.');
    }
    if (!saleRowNeedsFinalInvoiceAllocation(row as Record<string, unknown>)) {
      return row;
    }
    const next = await ensureFinalSaleInvoiceNoAllocated(id, row as Record<string, unknown>);
    return next;
  },

  /**
   * Move a cancelled sale back to a non-posted lifecycle stage so it can be edited and finalized again.
   * Does not delete historical reversal JEs or stock rows — audit trail stays intact.
   */
  async restoreCancelledSale(
    id: string,
    target: 'draft' | 'quotation' | 'order',
    companyId: string
  ) {
    const { data: row, error: fetchErr } = await supabase.from('sales').select('*').eq('id', id).single();
    if (fetchErr || !row) throw new Error('Sale not found');
    if (String((row as { status?: string }).status).toLowerCase() !== 'cancelled') {
      throw new Error('Only cancelled sales can be restored.');
    }

    const r = row as Record<string, unknown>;
    const patch: Record<string, unknown> = {
      status: target,
      invoice_no: null,
    };

    if (target === 'draft' && !(r.draft_no && String(r.draft_no).trim())) {
      patch.draft_no = await documentNumberService.getNextDocumentNumberGlobal(companyId, 'SDR');
    }
    if (target === 'quotation' && !(r.quotation_no && String(r.quotation_no).trim())) {
      patch.quotation_no = await documentNumberService.getNextDocumentNumberGlobal(companyId, 'SQT');
    }
    if (target === 'order' && !(r.order_no && String(r.order_no).trim())) {
      patch.order_no = await documentNumberService.getNextDocumentNumberGlobal(companyId, 'SOR');
    }

    const { error } = await supabase.from('sales').update(patch).eq('id', id).eq('status', 'cancelled');
    if (error) throw error;
  },

  // Update sale (full update)
  async updateSale(id: string, updates: Partial<Sale>) {
    // 🔒 CANCELLED: No updates allowed on cancelled sales
    const { data: existingSale } = await supabase.from('sales').select('id, status, company_id, branch_id, invoice_no, total').eq('id', id).single();
    if (existingSale && (existingSale as any).status === 'cancelled') {
      throw new Error('Cannot edit a cancelled invoice.');
    }
    // 🔒 LOCK CHECK: Prevent editing if sale has returns
    const { data: returns } = await supabase
      .from('sale_returns')
      .select('id')
      .eq('original_sale_id', id)
      .eq('status', 'final')
      .limit(1);
    
    if (returns && returns.length > 0) {
      throw new Error('Cannot edit sale: This sale has a return and is locked. Returns cannot be edited or deleted.');
    }

    const sanitized = { ...updates };
    delete (sanitized as any).discount_percentage;
    delete (sanitized as any).tax_percentage;
    // Ensure notes + deadline are persisted when present (DB columns)
    if ('notes' in updates) (sanitized as any).notes = updates.notes ?? null;
    if ('deadline' in updates) (sanitized as any).deadline = updates.deadline ?? null;

    const { data, error } = await supabase
      .from('sales')
      .update(sanitized)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if ('invoice_date' in updates && updates.invoice_date != null && data) {
      const cid = (data as any).company_id;
      if (cid) {
        syncJournalEntryDateByDocumentRefs({
          companyId: cid,
          referenceTypes: ['sale', 'sale_adjustment'],
          referenceId: id,
          entryDate: String(updates.invoice_date),
        }).catch((e) => console.warn('[saleService] journal entry_date sync:', e));
      }
    }

    // Accounting: if sale just became final for the first time, create journal entry
    const prevStatus = (existingSale as any)?.status;
    const newStatus = updates.status ?? (data as any)?.status;
    if (canPostAccountingForSaleStatus(newStatus) && !canPostAccountingForSaleStatus(prevStatus)) {
      postSaleDocumentAccounting(id).catch((err: any) =>
        console.warn('[saleService] updateSale document posting engine failed (non-critical):', err?.message)
      );
    }

    return data;
  },

  // Delete sale (hard delete - removes sale and cascade deletes items)
  // Delete sale with complete cascade delete (STEP 3: Reverse, not hide)
  // CRITICAL: This deletes ALL related data in correct order
  // Order: Payments → Journal Entries → Stock Movements (reverse) → Ledger Entries → Activity Logs → Sale Items → Sale
  async deleteSale(id: string) {
    // 🔒 CANCELLED: No delete allowed on cancelled sales (they are already reversed)
    const { data: existingSale } = await supabase.from('sales').select('status').eq('id', id).single();
    if (existingSale && (existingSale as any).status === 'cancelled') {
      throw new Error('Cannot delete a cancelled invoice.');
    }
    console.log('[SALE SERVICE] Starting cascade delete for sale:', id);
    
    try {
      // STEP 1: Delete all payments for this sale (and their journal entries)
      const { data: payments } = await supabase
        .from('payments')
        .select('id')
        .eq('reference_type', 'sale')
        .eq('reference_id', id);

      if (payments && payments.length > 0) {
        console.log(`[SALE SERVICE] Found ${payments.length} payments to delete`);
        for (const payment of payments) {
          try {
            await this.deletePaymentDirect(payment.id, id);
          } catch (paymentError: any) {
            console.error(`[SALE SERVICE] Error deleting payment ${payment.id}:`, paymentError);
            // Continue with other deletions even if one payment fails
          }
        }
      }

      // STEP 2: Reverse stock movements (to restore stock)
      // CRITICAL: Include variation_id for proper stock reversal
      const { data: stockMovements } = await supabase
        .from('stock_movements')
        .select('id, company_id, branch_id, product_id, variation_id, quantity, unit_cost, total_cost')
        .eq('reference_type', 'sale')
        .eq('reference_id', id);

      if (stockMovements && stockMovements.length > 0) {
        console.log(`[SALE SERVICE] Found ${stockMovements.length} stock movements to reverse`);
        // Create reverse stock movements before deleting (STEP 3: Reverse, not hide)
        for (const movement of stockMovements) {
          try {
            // Create reverse movement (positive quantity to restore stock - sale was negative)
            // CRITICAL: Include variation_id for variation-specific stock reversal
            const reverseMovement = {
              company_id: movement.company_id,
              branch_id: movement.branch_id,
              product_id: movement.product_id,
              variation_id: movement.variation_id || null, // CRITICAL: Include variation_id
              movement_type: 'adjustment',
              quantity: Math.abs(Number(movement.quantity) || 0), // Positive to reverse negative sale
              unit_cost: Number(movement.unit_cost) || 0,
              total_cost: Math.abs(Number(movement.total_cost) || 0), // Positive to reverse
              reference_type: 'sale',
              reference_id: id,
              notes: `Reverse stock from deleted sale ${id}`,
            };
            
            console.log('[SALE SERVICE] Creating reverse stock movement:', {
              product_id: reverseMovement.product_id,
              variation_id: reverseMovement.variation_id,
              quantity: reverseMovement.quantity
            });
            
            const { data: reverseData, error: reverseError } = await supabase
              .from('stock_movements')
              .insert(reverseMovement)
              .select()
              .single();
            
            if (reverseError) {
              console.error('[SALE SERVICE] ❌ Failed to create reverse stock movement:', reverseError);
              throw reverseError; // Don't allow silent failure
            }
            
            console.log('[SALE SERVICE] ✅ Reverse stock movement created:', reverseData?.id);
          } catch (reverseError: any) {
            console.error('[SALE SERVICE] ❌ CRITICAL: Could not create reverse stock movement:', reverseError);
            throw new Error(`Failed to reverse stock movement: ${reverseError.message || reverseError}`);
          }
        }
        
        // Delete original stock movements
        const { error: stockError } = await supabase
          .from('stock_movements')
          .delete()
          .eq('reference_type', 'sale')
          .eq('reference_id', id);

        if (stockError) {
          console.error('[SALE SERVICE] Error deleting stock movements:', stockError);
          throw stockError;
        }
      }

      // STEP 3: Delete journal entries directly linked to sale (customer balance = sales + payments + GL; no duplicate subledger)
      const { data: journalEntries } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('reference_type', 'sale')
        .eq('reference_id', id);

      if (journalEntries && journalEntries.length > 0) {
        console.log(`[SALE SERVICE] Found ${journalEntries.length} journal entries to delete`);
        for (const entry of journalEntries) {
          // Delete journal entry lines first
          const { error: lineError } = await supabase
            .from('journal_entry_lines')
            .delete()
            .eq('journal_entry_id', entry.id);

          if (lineError) {
            console.error('[SALE SERVICE] Error deleting journal entry lines:', lineError);
          }

          // Then delete journal entry
          const { error: entryError } = await supabase
            .from('journal_entries')
            .delete()
            .eq('id', entry.id);

          if (entryError) {
            console.error('[SALE SERVICE] Error deleting journal entry:', entryError);
          }
        }
      }

      // STEP 5: Delete activity logs
      const { error: activityError } = await supabase
        .from('activity_logs')
        .delete()
        .eq('module', 'sale')
        .eq('entity_id', id);

      if (activityError) {
        console.warn('[SALE SERVICE] Error deleting activity logs (non-critical):', activityError);
        // Activity logs deletion failure is non-critical
      }

      // STEP 6: Delete sale items (cascade should handle this, but explicit for safety)
      const { error: itemsError } = await supabase
        .from('sale_items')
        .delete()
        .eq('sale_id', id);

      if (itemsError) {
        // Try sales_items table as well
        const { error: itemsError2 } = await supabase
          .from('sales_items')
          .delete()
          .eq('sale_id', id);
        
        if (itemsError2) {
          console.error('[SALE SERVICE] Error deleting sale items:', itemsError2);
          // Continue - sale deletion will cascade
        }
      }

      // STEP 6b: Unlink studio_productions so sale can be deleted (FK: studio_productions_sale_id_fkey)
      const { data: studioProductions } = await supabase
        .from('studio_productions')
        .select('id')
        .eq('sale_id', id);
      if (studioProductions && studioProductions.length > 0) {
        const productionIds = studioProductions.map((p: { id: string }) => p.id);
        for (const prodId of productionIds) {
          const { error: stagesErr } = await supabase
            .from('studio_production_stages')
            .delete()
            .eq('production_id', prodId);
          if (stagesErr) {
            console.warn('[SALE SERVICE] Error deleting studio_production_stages (non-critical):', stagesErr);
          }
        }
        const { error: prodErr } = await supabase
          .from('studio_productions')
          .delete()
          .eq('sale_id', id);
        if (prodErr) {
          console.error('[SALE SERVICE] Error deleting studio_productions:', prodErr);
          throw prodErr;
        }
      }

      // STEP 7: Finally delete the sale record itself
      const { error: saleError } = await supabase
        .from('sales')
        .delete()
        .eq('id', id);

      if (saleError) {
        console.error('[SALE SERVICE] Error deleting sale:', saleError);
        throw saleError;
      }

      console.log('[SALE SERVICE] ✅ Cascade delete completed successfully for sale:', id);
    } catch (error: any) {
      console.error('[SALE SERVICE] ❌ Cascade delete failed for sale:', id, error);
      throw new Error(`Failed to delete sale: ${error.message || 'Unknown error'}`);
    }
  },

  // Record payment
  // CRITICAL: Enforces payment_account_id, payment_date, and reference_number
  async recordPayment(
    saleId: string, 
    amount: number, 
    paymentMethod: string, 
    accountId: string, 
    companyId: string, 
    branchId: string,
    paymentDate?: string,
    referenceNumber?: string,
    options?: { notes?: string; attachments?: any }
  ) {
    // 🔒 CANCELLED: No payment allowed on cancelled sales
    const { data: saleRow } = await supabase.from('sales').select('status').eq('id', saleId).single();
    if (saleRow && (saleRow as any).status === 'cancelled') {
      throw new Error('Cannot record payment on a cancelled invoice.');
    }
    if (saleRow && !canPostAccountingForSaleStatus((saleRow as any).status)) {
      throw new Error(
        `Payment and payment journal entries are only allowed after the sale is Final. Current status: ${(saleRow as any).status || 'unknown'}`
      );
    }
    // CRITICAL VALIDATION: All required fields must be present
    if (!accountId) {
      throw new Error('Payment account_id is required. Cannot save payment without account.');
    }
    
    if (!companyId || !branchId) {
      throw new Error('Company and branch are required for payment.');
    }
    
    // Let DB trigger set reference_number to avoid duplicate key (payments_reference_number_unique).
    // Do not send reference_number on insert unless caller explicitly provided one (e.g. edit flow).
    const callerRef = referenceNumber && String(referenceNumber).trim() ? String(referenceNumber).trim() : null;

    // Use provided date or current date
    const paymentDateValue = paymentDate || new Date().toISOString().split('T')[0];
    
    // CRITICAL FIX: Normalize payment method to lowercase enum values
    // DB enum payment_method_enum: cash, bank, card, other (lowercase only). mobile_wallet maps to 'other'.
    // PaymentMethod type uses: 'Cash', 'Bank', 'Mobile Wallet' (capitalized)
    const normalizedPaymentMethod = paymentMethod.toLowerCase().trim();
    const paymentMethodMap: Record<string, string> = {
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
    // Try exact match first, then normalized match, then default to 'cash'
    const enumPaymentMethod = paymentMethodMap[paymentMethod] || paymentMethodMap[normalizedPaymentMethod] || 'cash';
    
    console.log('[SALE SERVICE] Payment method normalization:', {
      original: paymentMethod,
      normalized: normalizedPaymentMethod,
      enumValue: enumPaymentMethod
    });
    
    // Identity: use auth.uid() for created_by and received_by (never public.users.id)
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const authUserId = authUser?.id ?? null;

    let uniqueRef: string;
    if (callerRef) {
      uniqueRef = callerRef;
    } else {
      try {
        uniqueRef = await documentNumberService.getNextDocumentNumber(companyId, branchId ?? null, 'customer_receipt');
      } catch {
        uniqueRef = generatePaymentReference(null);
      }
    }
    const paymentData: any = {
      company_id: companyId,
      branch_id: branchId,
      payment_type: 'received',
      reference_type: 'sale',
      reference_id: saleId,
      amount,
      payment_method: enumPaymentMethod,
      payment_date: paymentDateValue,
      payment_account_id: accountId,
      received_by: authUserId,
      created_by: authUserId,
      reference_number: uniqueRef,
    };
    if (options?.notes !== undefined && options.notes !== '') {
      paymentData.notes = options.notes;
    }
    if (options?.attachments !== undefined && options.attachments != null) {
      const arr = Array.isArray(options.attachments) ? options.attachments : [options.attachments];
      if (arr.length > 0) {
        paymentData.attachments = JSON.parse(JSON.stringify(arr));
      }
    }

    // Guardrail: On duplicate reference_number (unique constraint), do NOT retry with same uniqueRef—call getNextDocumentNumber again for a new ref.
    const doInsert = (data: typeof paymentData) => supabase.from('payments').insert(data).select().single();
    let result = await doInsert(paymentData);

    if (result.error && result.error.code === 'PGRST204' && result.error.message?.includes('attachments')) {
      delete paymentData.attachments;
      result = await doInsert(paymentData);
    }
    if (result.error) {
      console.error('[SALE SERVICE] Payment insert error:', {
        error: result.error,
        paymentData,
        accountId,
        companyId,
        branchId
      });
      throw result.error;
    }
    // Activity timeline: log payment_added for sale (non-blocking)
    activityLogService.logActivity({
      companyId,
      module: 'sale',
      entityId: saleId,
      action: 'payment_added',
      amount,
      paymentMethod: paymentMethod as string,
      paymentAccountId: accountId,
      description: `Payment of Rs ${Number(amount).toLocaleString()} via ${paymentMethod} recorded`,
    }).catch((err) => console.warn('[SALE SERVICE] Activity log payment_added failed:', err));

    const paymentRow = result.data as { id?: string } | null;
    if (paymentRow?.id) {
      auditLogService.logPaymentCreated(companyId, paymentRow.id, {
        reference_type: 'sale',
        reference_id: saleId,
        amount,
      });
      const { ensureSalePaymentJournalAfterInsert } = await import('@/app/services/saleAccountingService');
      const { assertActiveJournalForPaymentId } = await import('@/app/lib/paymentPostingInvariant');
      const jeId = await ensureSalePaymentJournalAfterInsert(paymentRow.id);
      if (!jeId) {
        throw new Error(
          'Payment was saved but no journal entry was created (trigger may be disabled or AR/payment account missing). Check Accounts Receivable (1100) and re-post.'
        );
      }
      await assertActiveJournalForPaymentId(paymentRow.id, 'saleService.recordPayment');
    }

    dispatchContactBalancesRefresh(companyId);
    return result.data;
  },

  /**
   * Record on-account payment (direct customer payment without invoice).
   * Uses reference_type = 'on_account', reference_id = null, contact_id for ledger.
   */
  async recordOnAccountPayment(
    contactId: string,
    contactName: string,
    amount: number,
    paymentMethod: string,
    accountId: string,
    companyId: string,
    branchId: string,
    paymentDate?: string,
    options?: { notes?: string; attachments?: any }
  ) {
    if (!accountId || !companyId || !branchId) {
      throw new Error('Account, company and branch are required for on-account payment.');
    }
    const normalizedPaymentMethod = (paymentMethod || 'cash').toLowerCase().trim();
    const paymentMethodMap: Record<string, string> = {
      cash: 'cash', Cash: 'cash', bank: 'bank', Bank: 'bank', card: 'card', Card: 'card',
      cheque: 'other', Cheque: 'other', 'mobile wallet': 'other', 'Mobile Wallet': 'other',
      mobile_wallet: 'other', wallet: 'other', Wallet: 'other',
    };
    const enumPaymentMethod = paymentMethodMap[paymentMethod] || paymentMethodMap[normalizedPaymentMethod] || 'cash';
    const paymentDateValue = paymentDate || new Date().toISOString().split('T')[0];
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const authUserId = authUser?.id ?? null;
    let uniqueRef: string;
    try {
      uniqueRef = await documentNumberService.getNextDocumentNumber(companyId, branchId ?? null, 'customer_receipt');
    } catch {
      uniqueRef = generatePaymentReference(null);
    }
    const paymentData: any = {
      company_id: companyId,
      branch_id: branchId,
      payment_type: 'received',
      reference_type: 'on_account',
      reference_id: null,
      contact_id: contactId,
      amount,
      payment_method: enumPaymentMethod,
      payment_date: paymentDateValue,
      payment_account_id: accountId,
      received_by: authUserId,
      created_by: authUserId,
      reference_number: uniqueRef,
    };
    if (options?.notes !== undefined && options.notes !== '') paymentData.notes = options.notes;
    if (options?.attachments !== undefined && options.attachments != null) {
      const arr = Array.isArray(options.attachments) ? options.attachments : [options.attachments];
      if (arr.length > 0) paymentData.attachments = JSON.parse(JSON.stringify(arr));
    }
    const doInsert = (data: typeof paymentData) => supabase.from('payments').insert(data).select().single();
    let result = await doInsert(paymentData);
    if (result.error && result.error.code === 'PGRST204' && result.error.message?.includes('attachments')) {
      delete paymentData.attachments;
      result = await doInsert(paymentData);
    }
    if (result.error) throw result.error;
    const row = result.data as { id: string; reference_number: string };
    auditLogService.logPaymentCreated(companyId, row.id, {
      reference_type: 'on_account',
      contact_id: contactId,
      amount,
    });
    if (row?.id) {
      const { ensureOnAccountCustomerJournalIfMissing } = await import('@/app/services/saleAccountingService');
      const { assertActiveJournalForPaymentId } = await import('@/app/lib/paymentPostingInvariant');
      const jeId = await ensureOnAccountCustomerJournalIfMissing(row.id, contactName);
      if (!jeId) {
        throw new Error(
          'On-account payment was saved but the journal entry could not be posted (AR 1100 or payment account missing).'
        );
      }
      // Patch trigger JE from parent 1100 to customer sub-ledger
      if (jeId) {
        const { patchPaymentJeToSubLedger } = await import('@/app/services/saleAccountingService');
        await patchPaymentJeToSubLedger(row.id, jeId);
      }
      await assertActiveJournalForPaymentId(row.id, 'saleService.recordOnAccountPayment');
    }
    dispatchContactBalancesRefresh(companyId);
    return row;
  },

  // Update payment
  async updatePayment(
    paymentId: string,
    saleId: string,
    updates: {
      amount?: number;
      paymentMethod?: string;
      accountId?: string;
      paymentDate?: string;
      referenceNumber?: string;
      notes?: string;
      attachments?: any;
    }
  ) {
    try {
      const { tracePaymentEditFlow } = await import('@/app/lib/paymentEditFlowTrace');
      tracePaymentEditFlow('saleService.updatePayment.start', {
        paymentId,
        saleId,
        updatesKeys: Object.keys(updates),
      });
      // PF-14.1: Capture current payment before update (for amount and/or account adjustment JEs)
      let oldAmount: number | null = null;
      let oldAccountId: string | null = null;
      let paymentAccountId: string | null = null;
      let companyId: string | null = null;
      let branchId: string | null = null;
      let paymentDate: string | null = null;
      const needPreState = updates.amount !== undefined || updates.accountId !== undefined || updates.paymentMethod !== undefined;
      if (needPreState) {
        const { data: current } = await supabase
          .from('payments')
          .select('amount, payment_account_id, company_id, branch_id, payment_date')
          .eq('id', paymentId)
          .single();
        if (current) {
          const c = current as any;
          oldAmount = Number(c.amount ?? 0) || 0;
          oldAccountId = c.payment_account_id ?? null;
          paymentAccountId = c.payment_account_id ?? null;
          companyId = c.company_id ?? null;
          branchId = c.branch_id ?? null;
          paymentDate = c.payment_date ?? null;
        }
      }

      // Normalize payment method if provided
      let normalizedPaymentMethod = updates.paymentMethod;
      if (updates.paymentMethod) {
        const normalized = updates.paymentMethod.toLowerCase().trim();
        const paymentMethodMap: Record<string, string> = {
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
        normalizedPaymentMethod = paymentMethodMap[updates.paymentMethod] || paymentMethodMap[normalized] || 'cash';
      }

      // Build update data
      const updateData: any = {};
      if (updates.amount !== undefined) updateData.amount = updates.amount;
      if (normalizedPaymentMethod) updateData.payment_method = normalizedPaymentMethod;
      if (updates.accountId) updateData.payment_account_id = updates.accountId;
      if (updates.paymentDate) updateData.payment_date = updates.paymentDate;
      if (updates.referenceNumber !== undefined) updateData.reference_number = updates.referenceNumber;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.attachments !== undefined) {
        const arr = Array.isArray(updates.attachments) ? updates.attachments : [updates.attachments];
        updateData.attachments = arr.length > 0 ? JSON.parse(JSON.stringify(arr)) : null;
      }

      let updateResult = await supabase
        .from('payments')
        .update(updateData)
        .eq('id', paymentId)
        .select()
        .single();

      if (updateResult.error && updateResult.error.code === 'PGRST204' && updateResult.error.message?.includes('attachments')) {
        delete updateData.attachments;
        updateResult = await supabase.from('payments').update(updateData).eq('id', paymentId).select().single();
      }
      if (updateResult.error) {
        console.error('[SALE SERVICE] Error updating payment:', updateResult.error);
        throw updateResult.error;
      }
      const data = updateResult.data;
      tracePaymentEditFlow('saleService.updatePayment.db_updated', {
        paymentId,
        saleId,
        oldAmount,
        oldAccountId,
        newAmount: updates.amount !== undefined ? Number(updates.amount) : oldAmount,
        newAccountId: (data as any)?.payment_account_id ?? updates.accountId ?? null,
      });

      // Phase 3: Log payment_edited only when something changed; avoid "from 33000 to 33000"
      const newAmount = updates.amount !== undefined ? Number(updates.amount) : oldAmount;
      const paymentMethodDisplay = (updates.paymentMethod ?? (data as any)?.payment_method ?? 'Cash').toString();
      const amountChanged = oldAmount != null && newAmount != null && oldAmount !== newAmount;
      const accountOrMethodOnly = (updates.accountId !== undefined || updates.paymentMethod !== undefined) && !amountChanged;
      if ((amountChanged || accountOrMethodOnly) && (data as any)?.company_id) {
        const saleRow = await this.getSaleById(saleId).catch(() => null);
        const invoiceNo = (saleRow as any)?.invoice_no ?? (saleRow as any)?.invoiceNo ?? saleId?.slice(0, 8) ?? 'N/A';
        const { data: { user } } = await supabase.auth.getUser();
        const companyIdForLog = (data as any).company_id;
        const description = amountChanged
          ? `Payment edited from Rs ${Number(oldAmount).toLocaleString()} to Rs ${Number(newAmount).toLocaleString()} via ${paymentMethodDisplay}`
          : `Payment account/method changed to ${paymentMethodDisplay}`;
        activityLogService.logActivity({
          companyId: companyIdForLog,
          module: 'sale',
          entityId: saleId,
          entityReference: invoiceNo,
          action: 'payment_edited',
          oldValue: oldAmount ?? undefined,
          newValue: newAmount ?? undefined,
          amount: newAmount ?? undefined,
          paymentMethod: paymentMethodDisplay,
          performedBy: (user as any)?.id ?? null,
          description,
        }).catch((e) => console.warn('[SALE SERVICE] Activity log payment_edited failed:', e));
      }

      // PF-14.1: Post payment adjustment JE when amount changed (original payment JE stays untouched)
      if (
        oldAmount != null &&
        newAmount != null &&
        oldAmount !== newAmount &&
        companyId &&
        paymentAccountId
      ) {
        try {
          const saleRow = await this.getSaleById(saleId).catch(() => null);
          const invoiceNo = (saleRow as any)?.invoice_no ?? (saleRow as any)?.invoiceNo ?? saleId?.slice(0, 8) ?? 'N/A';
          let receivableAccountId: string | undefined;
          if (companyId && saleRow && (saleRow as any).customer_id) {
            const { resolveReceivablePostingAccountId } = await import('@/app/services/partySubledgerAccountService');
            receivableAccountId =
              (await resolveReceivablePostingAccountId(companyId, String((saleRow as any).customer_id))) || undefined;
          }
          // In-place update: modify existing JE lines directly instead of creating adjustment JE
          tracePaymentEditFlow('saleService.updatePayment.post_amount_adjust', {
            paymentId, saleId, oldAmount, newAmount,
            deltaLiquidityAccountId: oldAccountId || paymentAccountId,
          });
          // Find the existing payment JE and update its line amounts
          const { data: existingJe } = await supabase
            .from('journal_entries')
            .select('id')
            .eq('payment_id', paymentId)
            .or('is_void.is.null,is_void.eq.false')
            .not('reference_type', 'eq', 'correction_reversal')
            .not('reference_type', 'eq', 'payment_adjustment')
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          if (existingJe?.id) {
            // Update all debit lines to new amount
            await supabase
              .from('journal_entry_lines')
              .update({ debit: newAmount })
              .eq('journal_entry_id', existingJe.id)
              .gt('debit', 0);
            // Update all credit lines to new amount
            await supabase
              .from('journal_entry_lines')
              .update({ credit: newAmount })
              .eq('journal_entry_id', existingJe.id)
              .gt('credit', 0);
            // Log the edit in description
            const oldDesc = (await supabase.from('journal_entries').select('description').eq('id', existingJe.id).maybeSingle())?.data?.description || '';
            const ts = new Date().toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' });
            await supabase.from('journal_entries').update({
              description: `${oldDesc} [Edited ${ts}: Rs ${oldAmount.toLocaleString()} → Rs ${newAmount.toLocaleString()}]`.slice(0, 500)
            }).eq('id', existingJe.id);
          } else {
            // Fallback: if no existing JE found, create adjustment (legacy behavior)
            const { postPaymentAmountAdjustment } = await import('@/app/services/paymentAdjustmentService');
            const { data: { user } } = await supabase.auth.getUser();
            await postPaymentAmountAdjustment({
              context: 'sale', companyId, branchId, paymentId, referenceId: saleId,
              oldAmount, newAmount,
              paymentAccountId: oldAccountId || paymentAccountId || '',
              invoiceNoOrRef: invoiceNo,
              entryDate: (updates.paymentDate || paymentDate || new Date().toISOString().split('T')[0]).toString().slice(0, 10),
              createdBy: (user as any)?.id ?? null, receivableAccountId,
            });
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
          }
        } catch (adjErr: any) {
          console.warn('[SALE SERVICE] Payment adjustment JE failed (payment row already updated):', adjErr?.message || adjErr);
        }
      }

      // PF-14.1: When payment account/method changed (Cash → Bank), update existing JE line's account_id in-place
      const newAccountId = (data as any)?.payment_account_id ?? updates.accountId ?? null;
      if (
        companyId &&
        oldAccountId != null &&
        newAccountId != null &&
        oldAccountId !== newAccountId &&
        (newAmount != null && newAmount > 0)
      ) {
        try {
          tracePaymentEditFlow('saleService.updatePayment.post_account_adjust', {
            paymentId,
            saleId,
            oldAccountId,
            newAccountId,
            amount: newAmount,
          });
          // Find existing primary JE for this payment
          const { data: existingJe } = await supabase
            .from('journal_entries')
            .select('id')
            .eq('payment_id', paymentId)
            .or('is_void.is.null,is_void.eq.false')
            .not('reference_type', 'eq', 'correction_reversal')
            .not('reference_type', 'eq', 'payment_adjustment')
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (existingJe?.id) {
            // In-place: update the liquidity line's account_id (the line matching oldAccountId)
            await supabase
              .from('journal_entry_lines')
              .update({ account_id: newAccountId })
              .eq('journal_entry_id', existingJe.id)
              .eq('account_id', oldAccountId);
            // Log the account change in JE description
            const oldDesc = (await supabase.from('journal_entries').select('description').eq('id', existingJe.id).maybeSingle())?.data?.description || '';
            const ts = new Date().toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' });
            await supabase.from('journal_entries').update({
              description: `${oldDesc} [Acct changed ${ts}: ${oldAccountId.slice(0, 8)} → ${newAccountId.slice(0, 8)}]`.slice(0, 500)
            }).eq('id', existingJe.id);
          } else {
            // Fallback: create adjustment JE if no existing JE found (legacy behavior)
            const { postPaymentAccountAdjustment } = await import('@/app/services/paymentAdjustmentService');
            const saleRow = await this.getSaleById(saleId).catch(() => null);
            const invoiceNo = (saleRow as any)?.invoice_no ?? (saleRow as any)?.invoiceNo ?? saleId?.slice(0, 8) ?? 'N/A';
            const { data: { user } } = await supabase.auth.getUser();
            await postPaymentAccountAdjustment({
              context: 'sale', companyId, branchId, paymentId, referenceId: saleId,
              oldAccountId, newAccountId, amount: newAmount, invoiceNoOrRef: invoiceNo,
              entryDate: (updates.paymentDate || paymentDate || (data as any)?.payment_date || new Date().toISOString().split('T')[0]).toString().slice(0, 10),
              createdBy: (user as any)?.id ?? null,
            });
          }
          // Clear payment sync cache so next sync re-evaluates this payment
          const { clearSkippedPaymentCache } = await import('@/app/services/paymentAdjustmentService');
          clearSkippedPaymentCache(paymentId);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
          }
        } catch (accErr: any) {
          console.warn('[SALE SERVICE] Payment account adjustment JE failed:', accErr?.message || accErr);
        }
      }

      console.log('[SALE SERVICE] Payment updated successfully');

      // Keep sales.paid_amount / due_amount + payment_allocations aligned with payments.amount so
      // get_contact_balances_summary matches ledger after receipt edits (UnifiedPaymentDialog sale-linked path).
      const refType = String((data as any)?.reference_type || '').toLowerCase();
      // FIFO rebuild only applies to manual_receipt (paymentAllocationService skips other reference_type).
      if (refType === 'manual_receipt') {
        if (import.meta.env.DEV) {
          console.debug('[SALE SERVICE] updatePayment: rebuildManualReceiptAllocations', { paymentId, refType });
        }
        try {
          tracePaymentEditFlow('saleService.updatePayment.rebuild_manual_receipt_allocations', { paymentId, saleId });
          await this.rebuildManualReceiptAllocations(paymentId);
        } catch (fifoErr: any) {
          console.warn(
            '[SALE SERVICE] rebuildManualReceiptAllocations after updatePayment failed:',
            fifoErr?.message || fifoErr
          );
        }
      }

      if (updates.paymentDate && (data as any)?.company_id) {
        syncJournalEntryDateByPaymentId({
          companyId: (data as any).company_id,
          paymentId,
          entryDate: updates.paymentDate,
        }).catch((e) => console.warn('[saleService] payment journal entry_date sync:', e));
      }
      if ((data as any)?.company_id) {
        dispatchContactBalancesRefresh(String((data as any).company_id));
        const cid = (data as any)?.contact_id;
        if (cid && typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'customer', entityId: String(cid) } })
          );
        }
      }
      return data;
    } catch (error: any) {
      console.error('[SALE SERVICE] Error updating payment:', error);
      throw error;
    }
  },

  // Get sales report
  async getSalesReport(companyId: string, startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'final')
      .gte('invoice_date', startDate)
      .lte('invoice_date', endDate)
      .order('invoice_date');

    if (error) throw error;
    return data;
  },

  // Get a single payment by ID (for ledger detail panel)
  async getPaymentById(paymentId: string) {
    let id = paymentId;
    // Synthetic allocation row id from payment history — resolve to parent payments.id
    if (typeof paymentId === 'string' && paymentId.startsWith('alloc:')) {
      const allocId = paymentId.slice('alloc:'.length);
      const { data: allocRow } = await supabase
        .from('payment_allocations')
        .select('payment_id')
        .eq('id', allocId)
        .maybeSingle();
      if (!allocRow?.payment_id) return null;
      id = allocRow.payment_id as string;
    }
    const { data, error } = await supabase
      .from('payments')
      .select(`
        id,
        reference_number,
        payment_date,
        amount,
        payment_method,
        payment_account_id,
        contact_id,
        reference_id,
        reference_type,
        notes,
        created_at,
        account:accounts(id, name)
      `)
      .eq('id', id)
      .single();

    if (error || !data) return null;
    const p = data as any;
    return {
      id: p.id,
      referenceNo: p.reference_number || '',
      date: p.payment_date,
      amount: parseFloat(p.amount || 0),
      method: p.payment_method || 'cash',
      accountId: p.payment_account_id,
      accountName: p.account?.name || '',
      contactId: p.contact_id || null,
      referenceId: p.reference_id,
      referenceType: p.reference_type,
      notes: p.notes || '',
      createdAt: p.created_at,
    };
  },

  /** Final invoices with open balance for a customer (manual receipt allocation picker). */
  async listOpenFinalInvoicesForCustomer(companyId: string, customerId: string) {
    const { data, error } = await supabase
      .from('sales')
      .select('id, invoice_no, due_amount, total, invoice_date, payment_status')
      .eq('company_id', companyId)
      .eq('customer_id', customerId)
      .eq('status', 'final')
      .gt('due_amount', 0.009)
      .order('invoice_date', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  // Get payments for a specific sale (by sale ID), including manual_receipt allocations
  async getSalePayments(saleId: string) {
    const selectWithAttachments = `
      id,
      payment_date,
      reference_number,
      amount,
      payment_method,
      payment_account_id,
      notes,
      attachments,
      created_at,
      updated_at,
      voided_at,
      received_by,
      account:accounts(id, name)
    `;
    let result = await supabase
      .from('payments')
      .select(selectWithAttachments)
      .eq('reference_type', 'sale')
      .eq('reference_id', saleId)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (result.error && result.error.code === 'PGRST204' && result.error.message?.includes('attachments')) {
      result = await supabase
        .from('payments')
        .select(`
          id,
          payment_date,
          reference_number,
          amount,
          payment_method,
          payment_account_id,
          notes,
          created_at,
          updated_at,
          voided_at,
          received_by,
          account:accounts(id, name)
        `)
        .eq('reference_type', 'sale')
        .eq('reference_id', saleId)
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false });
    }

    const data = result.data;
    const error = result.error;

    if (error) {
      console.error('[SALE SERVICE] Error fetching payments:', error);
    }

    const directRows: any[] = [];
    if (data && data.length > 0) {
      console.log('[SALE SERVICE] Found', data.length, 'payments for sale:', saleId);
      const receivedByIds = [...new Set((data as any[]).map((p: any) => p.received_by).filter(Boolean))] as string[];
      const nameByReceivedBy = new Map<string, string>();
      if (receivedByIds.length > 0) {
        const { data: usersByAuth } = await supabase.from('users').select('auth_user_id, full_name, email').in('auth_user_id', receivedByIds);
        (usersByAuth || []).forEach((u: any) => {
          if (u?.auth_user_id) nameByReceivedBy.set(u.auth_user_id, u.full_name || u.email || '');
        });
      }
      for (const p of data as any[]) {
        if (p.voided_at) continue;
        let att = p.attachments;
        if (typeof att === 'string' && att) {
          try {
            att = JSON.parse(att);
          } catch {
            att = null;
          }
        }
        directRows.push({
          id: p.id,
          date: p.payment_date,
          referenceNo: p.reference_number || '',
          amount: parseFloat(p.amount || 0),
          method: p.payment_method || 'cash',
          accountId: p.payment_account_id,
          accountName: p.account?.name || '',
          notes: p.notes || '',
          attachments: att ?? null,
          createdAt: p.created_at,
          updatedAt: p.updated_at ?? p.created_at,
          receivedBy: p.received_by ? (nameByReceivedBy.get(p.received_by) || null) : null,
          source: 'sale_payment' as const,
        });
      }
    }

    const allocRows: any[] = [];
    try {
      const { data: allocs, error: aErr } = await supabase
        .from('payment_allocations')
        .select('id, allocated_amount, allocation_date, payment_id, allocation_order')
        .eq('sale_id', saleId);
      if (!aErr && allocs && allocs.length > 0) {
        const payIds = [...new Set(allocs.map((a: any) => a.payment_id).filter(Boolean))];
        const { data: parents } = await supabase
          .from('payments')
          .select(
            `id, payment_date, reference_number, amount, payment_method, payment_account_id, notes, attachments, voided_at, created_at, updated_at, account:accounts(id, name)`
          )
          .in('id', payIds);
        const parentById = new Map((parents || []).map((p: any) => [p.id, p]));
        for (const a of allocs as any[]) {
          const p = parentById.get(a.payment_id);
          if (!p || (p as any).voided_at) continue;
          const ord = Number(a.allocation_order) || 0;
          allocRows.push({
            id: `alloc:${a.id}`,
            date: p?.payment_date || a.allocation_date,
            referenceNo: p?.reference_number || '',
            allocationBadge: `Receipt alloc #${ord || '—'}`,
            amount: parseFloat(a.allocated_amount || 0),
            /** Parent payment header amount — required so Edit opens UnifiedPaymentDialog with full receipt, not alloc slice */
            parentPaymentAmount: parseFloat(p?.amount || 0),
            method: p?.payment_method || 'cash',
            accountId: p?.payment_account_id,
            accountName: p?.account?.name || '',
            notes: p?.notes || '',
            attachments: p?.attachments ?? null,
            createdAt: p?.created_at,
            updatedAt: p?.updated_at ?? p?.created_at,
            receivedBy: null,
            source: 'manual_receipt_allocation' as const,
            parentPaymentId: a.payment_id,
            allocationOrder: ord,
          });
        }
      }
    } catch (e) {
      console.warn('[SALE SERVICE] payment_allocations fetch skipped:', e);
    }

    const combined = [...directRows, ...allocRows].sort((x, y) => {
      const dx = new Date(x.date).getTime();
      const dy = new Date(y.date).getTime();
      if (dy !== dx) return dy - dx;
      return String(y.referenceNo).localeCompare(String(x.referenceNo));
    });

    if (combined.length > 0) return combined;

    // FALLBACK: If no payments found by reference_id, check if sale has paid_amount > 0
    try {
      const { data: saleData } = await supabase
        .from('sales')
        .select('id, invoice_no, paid_amount, due_amount')
        .eq('id', saleId)
        .single();

      if (saleData && saleData.paid_amount > 0) {
        if (!(saleService as any)._paidAmountWarningIds) (saleService as any)._paidAmountWarningIds = new Set<string>();
        const warned = (saleService as any)._paidAmountWarningIds as Set<string>;
        if (!warned.has(saleId)) {
          warned.add(saleId);
          console.warn(
            '[SALE SERVICE] Sale has paid_amount > 0 but no payment rows in payments table (legacy or missing sync). Sale:',
            saleData.invoice_no,
            'Paid:',
            saleData.paid_amount
          );
        }
      }
    } catch (saleError) {
      console.error('[SALE SERVICE] Error checking sale paid_amount:', saleError);
    }

    return [];
  },

  // Delete payment (with reverse entry for accounting integrity)
  async deletePayment(paymentId: string, saleId: string) {
    if (!paymentId || !saleId) {
      throw new Error('Payment ID and Sale ID are required');
    }

    try {
      // CRITICAL FIX: Use RPC function for transaction-safe deletion
      // This ensures all operations happen in a single transaction
      const { data, error } = await supabase.rpc('delete_payment_with_reverse', {
        p_payment_id: paymentId,
        p_sale_id: saleId
      });

      if (error) {
        // If RPC doesn't exist, fallback to direct delete (with proper error handling)
        if (error.code === '42883' || error.message?.includes('function') || error.message?.includes('does not exist')) {
          console.warn('[SALE SERVICE] RPC function not found, using direct delete');
          return await this.deletePaymentDirect(paymentId, saleId);
        }
        console.error('[SALE SERVICE] Error deleting payment via RPC:', error);
        throw error;
      }

      console.log('[SALE SERVICE] Payment deleted successfully with reverse entry');
      return true;
    } catch (error: any) {
      console.error('[SALE SERVICE] Error deleting payment:', error);
      throw error;
    }
  },

  // Direct delete fallback (if RPC not available)
  async deletePaymentDirect(paymentId: string, saleId: string) {
    try {
      // CRITICAL FIX: Fetch payment details before deletion
      const { data: paymentData, error: fetchError } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (fetchError || !paymentData) {
        throw new Error('Payment not found');
      }

      // CRITICAL FIX: Delete related journal entries first (if they exist)
      // Journal entries are linked via payment_id (FK with SET NULL, so safe to delete)
      const { data: journalEntries } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('payment_id', paymentId);

      if (journalEntries && journalEntries.length > 0) {
        // Delete journal entry lines first (foreign key constraint)
        for (const entry of journalEntries) {
          const { error: lineError } = await supabase
            .from('journal_entry_lines')
            .delete()
            .eq('journal_entry_id', entry.id);
          
          if (lineError) {
            console.error('[SALE SERVICE] Error deleting journal entry lines:', lineError);
            // Continue even if some lines fail
          }
        }

        // Then delete journal entries
        const { error: entryError } = await supabase
          .from('journal_entries')
          .delete()
          .eq('payment_id', paymentId);
        
        if (entryError) {
          console.error('[SALE SERVICE] Error deleting journal entries:', entryError);
          // Continue - payment can still be deleted
        }
      }

      // CRITICAL FIX: Delete the payment record
      // Database triggers will:
      // 1. Create reverse journal entry (trigger_create_payment_reverse_entry)
      // 2. Update sale totals (trigger_update_sale_totals_delete)
      const { error: deleteError } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentId);

      if (deleteError) {
        console.error('[SALE SERVICE] Error deleting payment:', deleteError);
        throw deleteError;
      }

      // CRITICAL FIX: Wait a bit for triggers to complete, then verify
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify sale totals were updated
      const { data: updatedSale } = await supabase
        .from('sales')
        .select('paid_amount, due_amount, payment_status')
        .eq('id', saleId)
        .single();

      if (updatedSale) {
        console.log('[SALE SERVICE] Payment deleted, updated sale totals:', {
          paid_amount: updatedSale.paid_amount,
          due_amount: updatedSale.due_amount,
          payment_status: updatedSale.payment_status
        });
      }

      return true;
    } catch (error: any) {
      console.error('[SALE SERVICE] Error in direct delete:', error);
      throw error;
    }
  },

  /** Log sale action for audit (view_details, share_whatsapp, print_a4, etc.) */
  async logSaleAction(saleId: string, actionType: string, userId?: string | null, metadata?: Record<string, unknown>): Promise<void> {
    try {
      await supabase.rpc('log_sale_action', {
        p_sale_id: saleId,
        p_action_type: actionType,
        p_user_id: userId ?? null,
        p_metadata: metadata ?? {},
      });
    } catch (e) {
      console.warn('[SALE SERVICE] log_sale_action failed (RPC may not exist):', e);
    }
  },

  /** Log share action (whatsapp / pdf / link) */
  async logShare(saleId: string, shareType: 'whatsapp' | 'pdf' | 'link', userId?: string | null): Promise<void> {
    try {
      await supabase.rpc('log_share', {
        p_sale_id: saleId,
        p_share_type: shareType,
        p_user_id: userId ?? null,
        p_metadata: {},
      });
    } catch (e) {
      console.warn('[SALE SERVICE] log_share failed (RPC may not exist):', e);
    }
  },

  /** Log print action (A4 / Thermal) */
  async logPrint(saleId: string, printType: 'A4' | 'Thermal' | 'thermal_80mm' | 'thermal_58mm', userId?: string | null): Promise<void> {
    try {
      await supabase.rpc('log_print', {
        p_sale_id: saleId,
        p_print_type: printType,
        p_user_id: userId ?? null,
        p_metadata: {},
      });
    } catch (e) {
      console.warn('[SALE SERVICE] log_print failed (RPC may not exist):', e);
    }
  },

  /** Rerun FIFO invoice allocations for a manual_receipt payment (e.g. after amount or customer change). */
  async rebuildManualReceiptAllocations(paymentId: string): Promise<void> {
    const { rebuildManualReceiptFifoAllocations } = await import('@/app/services/paymentAllocationService');
    await rebuildManualReceiptFifoAllocations({ paymentId });
  },
};
