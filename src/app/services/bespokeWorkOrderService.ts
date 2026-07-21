import { supabase } from '@/lib/supabase';
import { buildBespokeMetadataForPersist } from '@/app/types/bespoke';
import { mapCreateWorkOrderError } from '@/app/components/bespoke/bespokePartyLabels';

export type BespokeWorkOrderStatus = 'draft' | 'in_progress' | 'completed' | 'cancelled';

export interface BespokeWorkOrder {
  id: string;
  company_id: string;
  branch_id: string;
  sale_id: string;
  parent_sales_item_id: string;
  work_order_no: string;
  tailor_contact_id: string;
  production_cost: number;
  status: BespokeWorkOrderStatus;
  instructions_snapshot: Record<string, unknown>;
  notes?: string | null;
  completed_at?: string | null;
  journal_entry_id?: string | null;
  created_at?: string;
  tailor?: { id: string; name?: string; phone?: string | null };
}

export interface BespokeWorkOrderDetail extends BespokeWorkOrder {
  sale?: {
    id: string;
    invoice_no?: string | null;
    order_no?: string | null;
    customer_name?: string | null;
    status?: string | null;
  } | null;
  parent_item?: { id: string; product_name?: string | null } | null;
  branch?: { id: string; name?: string | null } | null;
  journal_entry?: { id: string; entry_no?: string | null } | null;
}

export interface BespokeWorkOrderListFilters {
  status?: BespokeWorkOrderStatus | 'all';
  branchId?: string;
  tailorContactId?: string;
  search?: string;
}

const WORK_ORDER_DETAIL_SELECT =
  '*, tailor:contacts!tailor_contact_id(id, name, phone), sale:sales!sale_id(id, invoice_no, order_no, customer_name, status), parent_item:sales_items!parent_sales_item_id(id, product_name), branch:branches!branch_id(id, name), journal_entry:journal_entries!journal_entry_id(id, entry_no)';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NO_SALE_BRANCH_ERROR =
  'This sale has no branch set. Edit the sale and assign a branch first.';

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

async function resolveWorkOrderBranchId(
  branchId: string | undefined,
  saleId: string,
): Promise<string> {
  if (branchId && isUuid(branchId)) return branchId;

  const { data, error } = await supabase
    .from('sales')
    .select('branch_id')
    .eq('id', saleId)
    .maybeSingle();
  if (error) throw error;

  const fromSale = (data as { branch_id?: string | null } | null)?.branch_id;
  if (fromSale && isUuid(fromSale)) return fromSale;

  throw new Error(NO_SALE_BRANCH_ERROR);
}

function assertUuid(value: string, label: string): void {
  if (!UUID_RE.test(value)) {
    if (import.meta.env?.DEV) {
      console.warn(`[bespokeWorkOrderService] Invalid ${label}:`, value);
    }
    throw new Error(`Invalid ${label} for work order.`);
  }
}

/** bespoke_work_orders.created_by FK → public.users(id), not auth.users.id */
async function resolveBespokeCreatedBy(authUserId?: string | null): Promise<string | null> {
  if (!authUserId) return null;
  const { data } = await supabase
    .from('users')
    .select('id')
    .or(`id.eq.${authUserId},auth_user_id.eq.${authUserId}`)
    .maybeSingle();
  return data?.id ?? null;
}

async function fetchTailorContact(contactId: string): Promise<{ id: string; name?: string } | undefined> {
  const { data } = await supabase
    .from('contacts')
    .select('id, name')
    .eq('id', contactId)
    .maybeSingle();
  if (!data) return undefined;
  return { id: data.id, name: data.name ?? undefined };
}

function throwMappedError(error: unknown): never {
  const mapped = mapCreateWorkOrderError(error);
  if (error && typeof error === 'object' && 'message' in error) {
    throw Object.assign(new Error(mapped), { cause: error });
  }
  throw new Error(mapped);
}

export const bespokeWorkOrderService = {
  async listBySale(saleId: string): Promise<BespokeWorkOrder[]> {
    const { data, error } = await supabase
      .from('bespoke_work_orders')
      .select('*, tailor:contacts!tailor_contact_id(id, name)')
      .eq('sale_id', saleId)
      .order('created_at', { ascending: false });
    if (error) throwMappedError(error);
    return (data ?? []) as BespokeWorkOrder[];
  },

  async getById(id: string): Promise<BespokeWorkOrderDetail | null> {
    const { data, error } = await supabase
      .from('bespoke_work_orders')
      .select(WORK_ORDER_DETAIL_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throwMappedError(error);
    return (data as BespokeWorkOrderDetail) ?? null;
  },

  async listByCompany(
    companyId: string,
    filters?: BespokeWorkOrderListFilters,
  ): Promise<BespokeWorkOrderDetail[]> {
    let query = supabase
      .from('bespoke_work_orders')
      .select(WORK_ORDER_DETAIL_SELECT)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }
    if (filters?.branchId) {
      query = query.eq('branch_id', filters.branchId);
    }
    if (filters?.tailorContactId) {
      query = query.eq('tailor_contact_id', filters.tailorContactId);
    }

    const { data, error } = await query;
    if (error) throwMappedError(error);

    let rows = (data ?? []) as BespokeWorkOrderDetail[];
    const search = filters?.search?.trim().toLowerCase();
    if (search) {
      rows = rows.filter((row) => {
        const haystack = [
          row.work_order_no,
          row.sale?.invoice_no,
          row.sale?.customer_name,
          row.tailor?.name,
          row.parent_item?.product_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(search);
      });
    }
    return rows;
  },

  async getNextWorkOrderNo(companyId: string): Promise<string> {
    const { data } = await supabase
      .from('bespoke_work_orders')
      .select('work_order_no')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50);
    let max = 0;
    for (const row of data ?? []) {
      const m = String((row as { work_order_no?: string }).work_order_no ?? '').match(/BWO-(\d+)/i);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `BWO-${String(max + 1).padStart(4, '0')}`;
  },

  async createWorkOrder(params: {
    companyId: string;
    branchId: string;
    saleId: string;
    parentSalesItemId: string;
    tailorContactId: string;
    productionCost: number;
    instructionsSnapshot: unknown;
    notes?: string;
    createdBy?: string;
    partyName?: string;
  }): Promise<BespokeWorkOrder> {
    assertUuid(params.companyId, 'company');
    assertUuid(params.saleId, 'sale');
    assertUuid(params.parentSalesItemId, 'sale line item');
    assertUuid(params.tailorContactId, 'worker or supplier contact');

    const resolvedBranchId = await resolveWorkOrderBranchId(params.branchId, params.saleId);

    const workOrderNo = await this.getNextWorkOrderNo(params.companyId);
    const snapshot =
      buildBespokeMetadataForPersist(params.instructionsSnapshot) ??
      (typeof params.instructionsSnapshot === 'object' && params.instructionsSnapshot
        ? (params.instructionsSnapshot as Record<string, unknown>)
        : {});
    const createdBy = await resolveBespokeCreatedBy(params.createdBy);

    const { data, error } = await supabase
      .from('bespoke_work_orders')
      .insert({
        company_id: params.companyId,
        branch_id: resolvedBranchId,
        sale_id: params.saleId,
        parent_sales_item_id: params.parentSalesItemId,
        work_order_no: workOrderNo,
        tailor_contact_id: params.tailorContactId,
        production_cost: params.productionCost,
        instructions_snapshot: snapshot,
        notes: params.notes?.trim() || null,
        status: 'draft',
        created_by: createdBy,
      })
      .select('*')
      .single();
    if (error) throwMappedError(error);

    const row = data as BespokeWorkOrder;
    const tailor =
      params.partyName?.trim()
        ? { id: params.tailorContactId, name: params.partyName.trim() }
        : await fetchTailorContact(params.tailorContactId);
    return tailor ? { ...row, tailor } : row;
  },

  async updateStatus(id: string, status: BespokeWorkOrderStatus): Promise<void> {
    const { error } = await supabase.from('bespoke_work_orders').update({ status }).eq('id', id);
    if (error) throwMappedError(error);
  },

  async updateWorkOrder(params: {
    id: string;
    tailorContactId: string;
    productionCost: number;
    notes?: string;
    userId?: string;
    status?: BespokeWorkOrderStatus;
    createdAt?: Date | string | null;
    completedAt?: Date | string | null;
  }): Promise<{
    detail: BespokeWorkOrderDetail;
    stockMovementsPosted?: number;
    stockMovementsReversed?: number;
    reopened?: boolean;
    completed?: boolean;
  }> {
    assertUuid(params.id, 'work order');
    assertUuid(params.tailorContactId, 'worker or supplier contact');

    const erpUserId = await resolveBespokeCreatedBy(params.userId);
    const toTs = (d?: Date | string | null): string | null => {
      if (!d) return null;
      const date = d instanceof Date ? d : new Date(d);
      if (Number.isNaN(date.getTime())) return null;
      return date.toISOString();
    };

    const { data, error } = await supabase.rpc('update_bespoke_work_order', {
      p_work_order_id: params.id,
      p_tailor_contact_id: params.tailorContactId,
      p_production_cost: params.productionCost,
      p_notes: params.notes?.trim() || null,
      p_user_id: erpUserId,
      p_status: params.status ?? null,
      p_created_at: toTs(params.createdAt),
      p_completed_at: toTs(params.completedAt),
    });
    if (error) throwMappedError(error);
    const result = data as {
      success?: boolean;
      error?: string;
      stock_movements_posted?: number;
      stock_movements_reversed?: number;
      reopened?: boolean;
      completed?: boolean;
    };
    if (result?.success === false) {
      throw new Error(result.error || 'Failed to update work order');
    }

    const updated = await this.getById(params.id);
    if (!updated) throw new Error('Work order not found after update');

    if (updated.sale_id) {
      const { dispatchBespokeFabricStockUpdated } = await import(
        '@/app/services/bespokeFabricStockService'
      );
      if (
        (result.stock_movements_posted ?? 0) > 0 ||
        (result.stock_movements_reversed ?? 0) > 0 ||
        result.reopened
      ) {
        dispatchBespokeFabricStockUpdated(updated.sale_id);
      }
    }

    return {
      detail: updated,
      stockMovementsPosted: result.stock_movements_posted,
      stockMovementsReversed: result.stock_movements_reversed,
      reopened: result.reopened,
      completed: result.completed,
    };
  },

  async cancelStockPost(
    id: string,
    userId?: string,
  ): Promise<{ stockMovementsReversed: number }> {
    const erpUserId = await resolveBespokeCreatedBy(userId);
    const { data, error } = await supabase.rpc('cancel_bespoke_work_order_stock', {
      p_work_order_id: id,
      p_user_id: erpUserId,
    });
    if (error) throwMappedError(error);
    const result = data as {
      success?: boolean;
      error?: string;
      stock_movements_reversed?: number;
    };
    if (result?.success === false) {
      throw new Error(result.error || 'Failed to cancel stock post');
    }

    const wo = await this.getById(id);
    if (wo?.sale_id && (result.stock_movements_reversed ?? 0) > 0) {
      const { dispatchBespokeFabricStockUpdated } = await import(
        '@/app/services/bespokeFabricStockService'
      );
      dispatchBespokeFabricStockUpdated(wo.sale_id);
    }

    return { stockMovementsReversed: result.stock_movements_reversed ?? 0 };
  },

  /** Soft-cancel WO: reverse stock, void JE, set status=cancelled. */
  async cancelWorkOrder(
    id: string,
    userId?: string,
    reason?: string,
  ): Promise<{ stockMovementsReversed: number }> {
    const erpUserId = await resolveBespokeCreatedBy(userId);
    const { data, error } = await supabase.rpc('cancel_bespoke_work_order', {
      p_work_order_id: id,
      p_user_id: erpUserId,
      p_reason: reason?.trim() || null,
    });
    if (error) throwMappedError(error);
    const result = data as {
      success?: boolean;
      error?: string;
      stock_movements_reversed?: number;
      cancelled?: boolean;
    };
    if (result?.success === false) {
      throw new Error(result.error || 'Failed to cancel work order');
    }

    const wo = await this.getById(id);
    if (wo?.sale_id) {
      const { dispatchBespokeFabricStockUpdated } = await import(
        '@/app/services/bespokeFabricStockService'
      );
      dispatchBespokeFabricStockUpdated(wo.sale_id);
    }

    return { stockMovementsReversed: result.stock_movements_reversed ?? 0 };
  },

  async complete(
    id: string,
    userId?: string,
  ): Promise<{ journalEntryId?: string; stockMovementsPosted?: number; stockWarning?: string }> {
    const erpUserId = await resolveBespokeCreatedBy(userId);
    const { data, error } = await supabase.rpc('complete_bespoke_work_order', {
      p_work_order_id: id,
      p_user_id: erpUserId,
    });
    if (error) throwMappedError(error);
    const result = data as {
      success?: boolean;
      error?: string;
      journal_entry_id?: string;
      stock_movements_posted?: number;
      already_completed?: boolean;
    };
    if (result?.success === false) {
      throw new Error(result.error || 'Failed to complete work order');
    }

    let stockPosted = result.stock_movements_posted ?? 0;
    let stockWarning: string | undefined;

    const wo = await this.getById(id);
    const saleId = wo?.sale_id;
    if (saleId) {
      const {
        dispatchBespokeFabricStockUpdated,
        postBespokeFabricStockOnWorkOrderComplete,
        getWorkOrderStockPostStatus,
      } = await import('@/app/services/bespokeFabricStockService');
      if (stockPosted === 0) {
        try {
          stockPosted = await postBespokeFabricStockOnWorkOrderComplete(id);
        } catch (fallbackErr) {
          stockWarning =
            fallbackErr instanceof Error
              ? fallbackErr.message
              : 'Stock was not posted';
        }
      } else {
        dispatchBespokeFabricStockUpdated(saleId);
      }

      if (stockPosted === 0 && !stockWarning && wo?.parent_sales_item_id) {
        const status = await getWorkOrderStockPostStatus(
          id,
          wo.parent_sales_item_id,
          saleId,
          wo.work_order_no,
        );
        if (status.needsStockPost) {
          stockWarning =
            'Work order completed but stock was not fully posted — use Post stock on the work order.';
        }
      }
    }

    return {
      journalEntryId: result.journal_entry_id,
      stockMovementsPosted: stockPosted,
      stockWarning,
    };
  },

  /** Re-run stock posting (fabric + custom parent) for a completed work order (idempotent). */
  async repostWorkOrderStock(
    id: string,
    userId?: string,
  ): Promise<{ stockMovementsPosted: number; stockWarning?: string }> {
    return this.repostFabricStock(id, userId);
  },

  async repostFabricStock(
    id: string,
    userId?: string,
  ): Promise<{ stockMovementsPosted: number; stockWarning?: string }> {
    const erpUserId = await resolveBespokeCreatedBy(userId);
    const { data, error } = await supabase.rpc('complete_bespoke_work_order', {
      p_work_order_id: id,
      p_user_id: erpUserId,
    });
    if (error) throwMappedError(error);
    const result = data as {
      success?: boolean;
      error?: string;
      stock_movements_posted?: number;
    };
    if (result?.success === false) {
      throw new Error(result.error || 'Failed to post fabric stock');
    }

    let stockPosted = result.stock_movements_posted ?? 0;
    let stockWarning: string | undefined;
    const wo = await this.getById(id);
    const saleId = wo?.sale_id;

    const { dispatchBespokeFabricStockUpdated, postBespokeFabricStockOnWorkOrderComplete } =
      await import('@/app/services/bespokeFabricStockService');

    if (stockPosted === 0) {
      try {
        stockPosted = await postBespokeFabricStockOnWorkOrderComplete(id);
      } catch (fallbackErr) {
        stockWarning =
          fallbackErr instanceof Error ? fallbackErr.message : 'Fabric stock was not posted';
      }
    } else if (saleId) {
      dispatchBespokeFabricStockUpdated(saleId);
    }

    if (stockPosted === 0 && !stockWarning && wo?.parent_sales_item_id && saleId) {
      const { getWorkOrderStockPostStatus } = await import('@/app/services/bespokeFabricStockService');
      const status = await getWorkOrderStockPostStatus(
        id,
        wo.parent_sales_item_id,
        saleId,
        wo.work_order_no,
      );
      if (status.needsStockPost) {
        stockWarning =
          'No stock was posted — check linked fabric lines on the sale or contact support.';
      }
    }

    return { stockMovementsPosted: stockPosted, stockWarning };
  },
};
