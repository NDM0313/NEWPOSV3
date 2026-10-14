/**
 * Physical Stock Count — Capacitor client over the same stock_count_* RPCs as web.
 * Draft counts never write stock_movements; posting uses post_stock_count_session.
 * Pure math/display helpers are shared from src/app/lib (same engine as web).
 */
import { supabase } from '../lib/supabase';
import { applyBranchStockMovementFilter } from '../utils/branchId';
import {
  parseVariationAttributesRaw,
  publicVariationAttributes,
} from '@/app/utils/variationFieldMap';
import { classifyCountStatus, computeDifference } from '@/app/lib/stockCountMath';
import {
  categorizeStockMovement,
  formatVariationAttributesLabel,
  pickProductImageRef,
  resolveItemKind,
  sumHistoryByCategory,
  withRunningBalance,
  type StockCountItemKind,
  type StockHistoryCategoryTotals,
} from '@/app/lib/stockCountDisplay';
import {
  summarizeStockMovements,
  type StockLedgerSummary,
} from '@/app/lib/stockLedgerSummary';
import {
  compareBaselineToCurrent,
  ledgerRunningBalanceFromMovements,
  movementsAfterBaseline,
  shouldBlockPostForDrift,
  type DriftMovementLike,
} from '@/app/lib/stockCountDrift';

function formatVariationName(attributes: Record<string, string>): string {
  return Object.entries(publicVariationAttributes(attributes))
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
}

/** Same SoT as web inventoryService.getStock — sum of stock_movements.quantity. */
async function getStockQty(
  companyId: string,
  productId: string,
  variationId?: string | null,
  branchId?: string | null
): Promise<number> {
  let q = supabase
    .from('stock_movements')
    .select('quantity')
    .eq('company_id', companyId)
    .eq('product_id', productId);
  if (variationId != null) {
    q = q.eq('variation_id', variationId);
  } else {
    q = q.is('variation_id', null);
  }
  q = applyBranchStockMovementFilter(q, branchId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).reduce((sum: number, row: { quantity?: number }) => sum + (Number(row.quantity) || 0), 0);
}

type InventoryMovementRow = {
  id?: string;
  created_at?: string;
  quantity?: number | null;
  movement_type?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  notes?: string | null;
  variation_id?: string | null;
  branch_id?: string | null;
};

async function fetchProductStockMovements(
  productId: string,
  companyId: string,
  variationId?: string | null,
  branchId?: string | null
): Promise<InventoryMovementRow[]> {
  let q = supabase
    .from('stock_movements')
    .select(
      'id, created_at, quantity, movement_type, reference_type, reference_id, notes, variation_id, branch_id'
    )
    .eq('company_id', companyId)
    .eq('product_id', productId)
    .order('created_at', { ascending: true });
  if (variationId) {
    q = q.eq('variation_id', variationId);
  }
  q = applyBranchStockMovementFilter(q, branchId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as InventoryMovementRow[];
}

/** Resilient product_variations select — avoids HTTP 400 on schemas missing optional columns. */
async function selectProductVariations(
  selectLayers: string[],
  apply: (select: string) => Promise<{ data: unknown[] | null; error: { message?: string } | null }>
): Promise<any[]> {
  let lastMsg = '';
  for (const layer of selectLayers) {
    const { data, error } = await apply(layer);
    if (!error) return (data || []) as any[];
    lastMsg = error.message || lastMsg;
    if (!/column|does not exist|400|PGRST/i.test(error.message || '')) {
      console.warn('[stockCount] product_variations:', error.message);
      return [];
    }
  }
  console.warn('[stockCount] product_variations:', lastMsg);
  return [];
}

const VARIATION_SEARCH_LAYERS = [
  'id, product_id, sku, barcode, attributes, is_active',
  'id, product_id, sku, attributes, is_active',
  'id, product_id, sku, attributes',
] as const;

export type StockCountSessionStatus =
  | 'draft'
  | 'in_progress'
  | 'pending_review'
  | 'posted'
  | 'cancelled';

export type StockCountSession = {
  id: string;
  company_id: string;
  /** Null when scope_type = all_branches */
  branch_id: string | null;
  scope_type?: 'single_branch' | 'all_branches';
  status: StockCountSessionStatus;
  notes?: string | null;
  created_by?: string | null;
  posted_by?: string | null;
  created_at?: string;
  updated_at?: string;
  completed_at?: string | null;
  posted_at?: string | null;
  post_client_operation_id?: string | null;
};

export type StockCountLine = {
  id: string;
  company_id: string;
  session_id: string;
  /** Branch this line counts (required for all-branches sessions). */
  branch_id?: string | null;
  product_id: string;
  variation_id?: string | null;
  /** Frozen system qty at add-line / recount — posting basis. */
  system_qty_baseline: number;
  baseline_at: string;
  /**
   * Latest movement balance (Full Stock Ledger / getStock).
   * May differ from system_qty_baseline when stock moved after the count pass.
   */
  current_system_qty?: number | null;
  /** current − baseline when both known */
  movement_since_baseline?: number | null;
  baseline_drifted?: boolean;
  physical_qty: number | null;
  active_pass_number: number;
  variance: number | null;
  count_status: 'uncounted' | 'counted_zero' | 'counted_qty';
  notes?: string | null;
  reason?: string | null;
  stock_movement_id?: string | null;
  posted_at?: string | null;
  reconciled_at?: string | null;
  updated_at?: string;
  // enriched client fields
  product_name?: string;
  /** Parent catalog SKU (not variation SKU). */
  product_sku?: string;
  variation_sku?: string | null;
  /** e.g. Size: M · Color: Green */
  variation_label?: string | null;
  attributes_incomplete?: boolean;
  item_kind?: StockCountItemKind;
  /** Raw storage ref / URL for ProductImage (do not hand-build public URLs). */
  image_url?: string | null;
  unit?: string | null;
  difference?: number | null;
};

export type StockCountUnmatchedIssue = {
  id: string;
  session_id: string;
  description: string;
  notes?: string | null;
  status: string;
  created_at?: string;
};

export type StockCountSearchHit = {
  product_id: string;
  name: string;
  /** Parent product SKU */
  sku: string | null;
  barcode?: string | null;
  description?: string | null;
  image_url?: string | null;
  has_variations: boolean;
  variation_id?: string | null;
  variation_sku?: string | null;
  variation_label?: string | null;
  attributes_incomplete?: boolean;
  item_kind: StockCountItemKind;
  system_qty: number;
  exact_match: boolean;
};

export type StockCountHistoryResult = {
  movements: Array<InventoryMovementRow & { running_balance: number; category: string }>;
  totals: StockHistoryCategoryTotals;
  system_qty: number;
};

function rpcError(error: { message?: string } | null): Error {
  return new Error(error?.message || 'Stock count request failed');
}

function mapLine(raw: Record<string, unknown>): StockCountLine {
  const physical =
    raw.physical_qty == null || raw.physical_qty === ''
      ? null
      : Number(raw.physical_qty);
  const baseline = Number(raw.system_qty_baseline) || 0;
  return {
    id: String(raw.id),
    company_id: String(raw.company_id),
    session_id: String(raw.session_id),
    branch_id: (raw.branch_id as string) || null,
    product_id: String(raw.product_id),
    variation_id: (raw.variation_id as string) || null,
    system_qty_baseline: baseline,
    baseline_at: String(raw.baseline_at || ''),
    physical_qty: physical,
    active_pass_number: Number(raw.active_pass_number) || 1,
    variance:
      raw.variance == null ? computeDifference(physical, baseline) : Number(raw.variance),
    count_status:
      (raw.count_status as StockCountLine['count_status']) ||
      classifyCountStatus(physical),
    notes: (raw.notes as string) || null,
    reason: (raw.reason as string) || null,
    stock_movement_id: (raw.stock_movement_id as string) || null,
    posted_at: (raw.posted_at as string) || null,
    reconciled_at: (raw.reconciled_at as string) || null,
    updated_at: (raw.updated_at as string) || undefined,
    difference: computeDifference(physical, baseline),
  };
}

async function enrichLines(
  companyId: string,
  lines: StockCountLine[]
): Promise<StockCountLine[]> {
  if (!lines.length) return lines;
  const productIds = [...new Set(lines.map((l) => l.product_id))];
  const variationIds = [
    ...new Set(lines.map((l) => l.variation_id).filter(Boolean) as string[]),
  ];

  const { data: products } = await supabase
    .from('products')
    .select('id, name, sku, image_urls, unit_id')
    .eq('company_id', companyId)
    .in('id', productIds);

  let variations: Array<{
    id: string;
    sku?: string | null;
    attributes?: unknown;
  }> = [];
  if (variationIds.length) {
    const { data } = await supabase
      .from('product_variations')
      .select('id, sku, attributes')
      .in('id', variationIds);
    variations = (data as typeof variations) || [];
  }

  const productMap = new Map((products || []).map((p: any) => [p.id, p]));
  const variationMap = new Map(variations.map((v) => [v.id, v]));

  return lines.map((line) => {
    const p = productMap.get(line.product_id);
    const v = line.variation_id ? variationMap.get(line.variation_id) : null;
    const attrLabel = v ? formatVariationAttributesLabel(v.attributes) : '';
    const attrs = v
      ? publicVariationAttributes(parseVariationAttributesRaw(v.attributes))
      : null;
    const hasVar = Boolean(line.variation_id);
    const attributes_incomplete = hasVar && !attrLabel;
    return {
      ...line,
      product_name: p?.name || 'Product',
      product_sku: p?.sku || '',
      variation_sku: v?.sku || null,
      variation_label:
        attrLabel ||
        (attrs && Object.keys(attrs).length
          ? formatVariationName(attrs as Record<string, string>)
          : null),
      attributes_incomplete,
      item_kind: resolveItemKind(hasVar),
      image_url: pickProductImageRef(p?.image_urls) || null,
    };
  });
}

/** Attach live Current System Stock (same getStock path as inventory / ledger sum). */
async function enrichCurrentSystemQty(
  companyId: string,
  lines: StockCountLine[],
  sessionBranchId?: string | null
): Promise<StockCountLine[]> {
  if (!lines.length) return lines;
  const qtys = await Promise.all(
    lines.map((l) => {
      const bid = l.branch_id || sessionBranchId;
      if (!bid) return Promise.resolve(null as number | null);
      return getStockQty(companyId, l.product_id, l.variation_id ?? null, bid);
    })
  );
  return lines.map((line, i) => {
    const current = qtys[i];
    if (current == null) return line;
    const snap = compareBaselineToCurrent(line.system_qty_baseline, current);
    return {
      ...line,
      current_system_qty: snap.currentSystemStock,
      movement_since_baseline: snap.movementSinceBaseline,
      baseline_drifted: snap.drifted,
    };
  });
}

export const stockCountApi = {
  async createSession(
    branchId: string | null,
    notes?: string,
    allBranches = false
  ): Promise<StockCountSession> {
    if (!allBranches && (!branchId || branchId === 'all')) {
      throw new Error('Select a physical branch, or choose All Branches for a multi-branch count');
    }
    const payload: Record<string, unknown> = {
      p_branch_id: allBranches ? null : branchId,
      p_notes: notes || null,
    };
    // p_all_branches requires migration 20261014160000_*; omit when false for older RPC.
    if (allBranches) payload.p_all_branches = true;
    const { data, error } = await supabase.rpc('create_stock_count_session', payload);
    if (error) throw rpcError(error);
    return data as StockCountSession;
  },

  isAllBranchesSession(session: StockCountSession | null | undefined): boolean {
    return session?.scope_type === 'all_branches' || (!!session && !session.branch_id);
  },

  async listSessions(opts?: {
    branchId?: string | null;
    status?: string | null;
    limit?: number;
  }): Promise<StockCountSession[]> {
    const { data, error } = await supabase.rpc('list_stock_count_sessions', {
      p_branch_id: opts?.branchId && opts.branchId !== 'all' ? opts.branchId : null,
      p_status: opts?.status || null,
      p_limit: opts?.limit ?? 50,
    });
    if (error) throw rpcError(error);
    return (Array.isArray(data) ? data : []) as StockCountSession[];
  },

  async getSession(sessionId: string): Promise<{
    session: StockCountSession;
    lines: StockCountLine[];
    unmatched_issues: StockCountUnmatchedIssue[];
  }> {
    const { data, error } = await supabase.rpc('get_stock_count_session', {
      p_session_id: sessionId,
    });
    if (error) throw rpcError(error);
    const payload = data as {
      session: StockCountSession;
      lines: Record<string, unknown>[];
      unmatched_issues: StockCountUnmatchedIssue[];
    };
    const mapped = (payload.lines || []).map(mapLine);
    const withMeta = await enrichLines(payload.session.company_id, mapped);
    const lines = await enrichCurrentSystemQty(
      payload.session.company_id,
      withMeta,
      payload.session.branch_id
    );
    return {
      session: payload.session,
      lines,
      unmatched_issues: payload.unmatched_issues || [],
    };
  },

  /** Lines that must be recounted or acknowledged before post (baseline ≠ current). */
  linesBlockingPostForDrift(
    lines: StockCountLine[],
    acknowledgedLineIds?: Set<string> | string[]
  ): StockCountLine[] {
    const ack = new Set(
      acknowledgedLineIds instanceof Set
        ? acknowledgedLineIds
        : acknowledgedLineIds || []
    );
    return lines.filter((l) => {
      const drifted =
        l.baseline_drifted === true ||
        (l.current_system_qty != null &&
          compareBaselineToCurrent(l.system_qty_baseline, l.current_system_qty).drifted);
      const gate = shouldBlockPostForDrift({
        drifted,
        countStatus: l.count_status,
        driftAcknowledged: ack.has(l.id),
        recountedAfterDrift:
          l.current_system_qty != null &&
          Math.abs(Number(l.system_qty_baseline) - Number(l.current_system_qty)) < 0.0000001,
      });
      return gate.block;
    });
  },

  async addLine(
    sessionId: string,
    productId: string,
    variationId?: string | null,
    notes?: string
  ): Promise<StockCountLine[]> {
    const { data, error } = await supabase.rpc('stock_count_add_line', {
      p_session_id: sessionId,
      p_product_id: productId,
      p_variation_id: variationId || null,
      p_notes: notes || null,
    });
    if (error) throw rpcError(error);
    // all_branches RPC returns { lines: [...] }; single returns one line object
    if (data && typeof data === 'object' && Array.isArray((data as any).lines)) {
      return ((data as any).lines as Record<string, unknown>[]).map(mapLine);
    }
    return [mapLine(data as Record<string, unknown>)];
  },

  async applyEvent(
    lineId: string,
    eventType: 'increment' | 'decrement' | 'set' | 'confirm_zero' | 'start_recount',
    value?: number | null,
    reason?: string
  ): Promise<StockCountLine> {
    const { data, error } = await supabase.rpc('stock_count_apply_event', {
      p_line_id: lineId,
      p_event_type: eventType,
      p_value: value ?? null,
      p_reason: reason || null,
    });
    if (error) throw rpcError(error);
    const mapped = mapLine(data as Record<string, unknown>);
    // Preserve display fields from caller via partial enrich of current stock only
    try {
      const bid = mapped.branch_id;
      if (bid && mapped.company_id) {
        const current = await getStockQty(
          mapped.company_id,
          mapped.product_id,
          mapped.variation_id ?? null,
          bid
        );
        const snap = compareBaselineToCurrent(mapped.system_qty_baseline, current);
        return {
          ...mapped,
          current_system_qty: snap.currentSystemStock,
          movement_since_baseline: snap.movementSinceBaseline,
          baseline_drifted: snap.drifted,
        };
      }
    } catch {
      /* keep mapped */
    }
    return mapped;
  },

  async recordUnmatched(
    sessionId: string,
    description: string,
    notes?: string
  ): Promise<StockCountUnmatchedIssue> {
    const { data, error } = await supabase.rpc('stock_count_record_unmatched', {
      p_session_id: sessionId,
      p_description: description,
      p_notes: notes || null,
    });
    if (error) throw rpcError(error);
    return data as StockCountUnmatchedIssue;
  },

  async completeSession(sessionId: string, allowPartial = false): Promise<StockCountSession> {
    const { data, error } = await supabase.rpc('complete_stock_count_session', {
      p_session_id: sessionId,
      p_allow_partial: allowPartial,
    });
    if (error) throw rpcError(error);
    return data as StockCountSession;
  },

  async postSession(
    sessionId: string,
    clientOperationId?: string,
    allowPartial = false
  ): Promise<{
    session: StockCountSession;
    posted_movements: number;
    zero_variance: number;
    idempotent?: boolean;
  }> {
    const { data, error } = await supabase.rpc('post_stock_count_session', {
      p_session_id: sessionId,
      p_client_operation_id: clientOperationId || crypto.randomUUID(),
      p_allow_partial: allowPartial,
    });
    if (error) throw rpcError(error);
    return data as {
      session: StockCountSession;
      posted_movements: number;
      zero_variance: number;
      idempotent?: boolean;
    };
  },

  async cancelSession(sessionId: string): Promise<StockCountSession> {
    const { data, error } = await supabase.rpc('cancel_stock_count_session', {
      p_session_id: sessionId,
    });
    if (error) throw rpcError(error);
    return data as StockCountSession;
  },

  /**
   * Fast company-scoped search. Exact SKU/barcode ranked first.
   * Does not auto-pick ambiguous matches — returns the full list.
   * Pass branchIds for all-branches sessions (system_qty = sum across those branches).
   */
  async searchCatalog(
    companyId: string,
    branchId: string | null,
    query: string,
    limit = 25,
    opts?: { allBranches?: boolean; branchIds?: string[] }
  ): Promise<StockCountSearchHit[]> {
    const q = query.trim();
    const allBranches = !!opts?.allBranches;
    const scopeBranchIds =
      allBranches && opts?.branchIds?.length
        ? opts.branchIds.filter((id) => id && id !== 'all')
        : branchId && branchId !== 'all'
          ? [branchId]
          : [];
    if (!companyId || !q || scopeBranchIds.length === 0) return [];

    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, sku, barcode, description, image_urls, has_variations, is_active')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .or(
        `sku.ilike.%${q}%,name.ilike.%${q}%,barcode.ilike.%${q}%,description.ilike.%${q}%`
      )
      .limit(40);

    if (error) throw rpcError(error);

    const productList = products || [];
    const variationParents = productList.filter((p: any) => p.has_variations);
    let variations: any[] = [];
    if (variationParents.length) {
      const parentIds = variationParents.map((p: any) => p.id);
      variations = await selectProductVariations([...VARIATION_SEARCH_LAYERS], async (sel) =>
        supabase.from('product_variations').select(sel).in('product_id', parentIds).limit(80)
      );
    }

    // Also search variations by SKU / barcode (layered — barcode column may be absent)
    const varBySku = await selectProductVariations(
      [
        'id, product_id, sku, barcode, attributes, is_active',
        'id, product_id, sku, attributes, is_active',
        'id, product_id, sku, attributes',
      ],
      async (sel) => {
        const hasBarcode = sel.includes('barcode');
        let query = supabase.from('product_variations').select(sel);
        query = hasBarcode
          ? query.or(`sku.ilike.%${q}%,barcode.ilike.%${q}%`)
          : query.ilike('sku', `%${q}%`);
        return query.limit(40);
      }
    );
    const varMap = new Map<string, any>();
    for (const v of [...variations, ...varBySku]) {
      if (v?.id) varMap.set(v.id, v);
    }

    const missingParentIds = [...varMap.values()]
      .map((v) => v.product_id)
      .filter((id) => !productList.some((p: any) => p.id === id));
    let extraProducts: any[] = [];
    if (missingParentIds.length) {
      const { data } = await supabase
        .from('products')
        .select('id, name, sku, barcode, description, image_urls, has_variations, is_active')
        .eq('company_id', companyId)
        .in('id', missingParentIds);
      extraProducts = data || [];
    }
    const allProducts = [...productList, ...extraProducts];
    const productById = new Map(allProducts.map((p: any) => [p.id, p]));

    const qLower = q.toLowerCase();

    const pending: Array<Omit<StockCountSearchHit, 'system_qty'> & { _vid: string | null }> =
      [];

    for (const p of allProducts) {
      if (!p || p.is_active === false) continue;
      const images = Array.isArray(p.image_urls) ? p.image_urls : [];
      if (p.has_variations) {
        const vars = [...varMap.values()].filter((v) => v.product_id === p.id);
        for (const v of vars) {
          if (v.is_active === false) continue;
          const attrs = publicVariationAttributes(parseVariationAttributesRaw(v.attributes));
          const attrLabel = formatVariationAttributesLabel(v.attributes);
          const label =
            attrLabel ||
            (Object.keys(attrs || {}).length
              ? formatVariationName(attrs as Record<string, string>)
              : '');
          const attrText = Object.values(attrs || {}).join(' ').toLowerCase();
          const sku = String(v.sku || p.sku || '');
          const barcode = String(v.barcode || p.barcode || '');
          const matches =
            sku.toLowerCase().includes(qLower) ||
            barcode.toLowerCase().includes(qLower) ||
            String(p.name || '')
              .toLowerCase()
              .includes(qLower) ||
            String(p.description || '')
              .toLowerCase()
              .includes(qLower) ||
            attrText.includes(qLower) ||
            label.toLowerCase().includes(qLower);
          if (!matches) continue;
          const exact =
            sku.toLowerCase() === qLower || barcode.toLowerCase() === qLower;
          pending.push({
            product_id: p.id,
            name: p.name,
            sku: p.sku,
            barcode: v.barcode || p.barcode,
            description: p.description,
            image_url: pickProductImageRef(images) || null,
            has_variations: true,
            variation_id: v.id,
            variation_sku: v.sku,
            variation_label: label || null,
            attributes_incomplete: !attrLabel,
            item_kind: 'variation',
            exact_match: exact,
            _vid: v.id,
          });
        }
        // Never add parent-total hits for variation products (would double-count stock).
      } else {
        const sku = String(p.sku || '');
        const barcode = String(p.barcode || '');
        const exact =
          sku.toLowerCase() === qLower || barcode.toLowerCase() === qLower;
        pending.push({
          product_id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          description: p.description,
          image_url: pickProductImageRef(images) || null,
          has_variations: false,
          variation_id: null,
          variation_sku: null,
          variation_label: null,
          attributes_incomplete: false,
          item_kind: 'product',
          exact_match: exact,
          _vid: null,
        });
      }
    }

    void productById;

    const ranked = pending
      .sort((a, b) => {
        if (a.exact_match !== b.exact_match) return a.exact_match ? -1 : 1;
        return String(a.name).localeCompare(String(b.name));
      })
      .slice(0, limit);

    const qtys = await Promise.all(
      ranked.map(async (h) => {
        if (scopeBranchIds.length === 1) {
          return getStockQty(companyId, h.product_id, h._vid, scopeBranchIds[0]);
        }
        const perBranch = await Promise.all(
          scopeBranchIds.map((bid) => getStockQty(companyId, h.product_id, h._vid, bid))
        );
        return perBranch.reduce((s, n) => s + (Number(n) || 0), 0);
      })
    );

    return ranked.map(({ _vid: _unused, ...rest }, i) => ({
      ...rest,
      system_qty: qtys[i] ?? 0,
    }));
  },

  partitionLines(lines: StockCountLine[]): {
    counted: StockCountLine[];
    uncounted: StockCountLine[];
    variance: StockCountLine[];
  } {
    const counted = lines.filter((l) => l.count_status !== 'uncounted');
    const uncounted = lines.filter((l) => l.count_status === 'uncounted');
    const variance = counted.filter(
      (l) => l.difference != null && Math.abs(Number(l.difference)) > 0.0000001
    );
    return { counted, uncounted, variance };
  },

  /**
   * Read-only movement history — same source as Full Stock Ledger
   * (productService.getStockMovements + ledger running balance).
   * Does not change count state.
   */
  async getLineHistory(opts: {
    companyId: string;
    branchId?: string | null;
    branchIds?: string[];
    productId: string;
    variationId?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
    baselineAt?: string | null;
    countBaseline?: number | null;
  }): Promise<
    StockCountHistoryResult & {
      ledgerSummary: StockLedgerSummary;
      outstandingRentSummary: StockLedgerSummary;
      countBaseline?: number | null;
      movementsSinceBaseline: DriftMovementLike[];
      byBranch?: Array<{
        branch_id: string;
        system_qty: number;
        movements: StockCountHistoryResult['movements'];
        totals: StockCountHistoryResult['totals'];
      }>;
    }
  > {
    const multi =
      opts.branchIds && opts.branchIds.length > 0
        ? opts.branchIds.filter((id) => id && id !== 'all')
        : opts.branchId && opts.branchId !== 'all'
          ? [opts.branchId]
          : [];
    if (multi.length === 0) {
      throw new Error('History requires the count session branch (or all-branches scope)');
    }

    const filterVariation = (rows: any[]) =>
      rows.filter((r) => {
        if (opts.variationId) return r.variation_id === opts.variationId;
        return r.variation_id == null;
      });

    const inDateRange = (rows: any[]) => {
      if (!opts.dateFrom && !opts.dateTo) return rows;
      return rows.filter((r) => {
        const t = new Date(r.created_at || 0).getTime();
        if (opts.dateFrom && t < new Date(opts.dateFrom).getTime()) return false;
        if (opts.dateTo && t > new Date(opts.dateTo + 'T23:59:59.999Z').getTime()) return false;
        return true;
      });
    };

    const loadOne = async (bid: string) => {
      // Same loader as FullStockLedgerView
      const raw = await fetchProductStockMovements(
        opts.productId,
        opts.companyId,
        opts.variationId || undefined,
        bid
      );
      const fullRows = filterVariation(raw || []);
      const scoped = inDateRange(fullRows);
      const withBal = withRunningBalance(scoped);
      const movements = withBal
        .map((r) => ({
          ...r,
          category: categorizeStockMovement(r),
          branch_id: (r as any).branch_id || bid,
        }))
        .sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
      // Current System Stock = Full Ledger running balance (sum of all movements)
      const system_qty = ledgerRunningBalanceFromMovements(fullRows);
      return {
        branch_id: bid,
        system_qty,
        movements,
        totals: sumHistoryByCategory(scoped),
        scoped,
        fullRows,
      };
    };

    const parts = await Promise.all(multi.map(loadOne));
    const allMovements = parts
      .flatMap((p) => p.movements)
      .sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
    const allScoped = parts.flatMap((p) => p.scoped);
    const allFull = parts.flatMap((p) => p.fullRows);
    const system_qty = parts.reduce((s, p) => s + (Number(p.system_qty) || 0), 0);

    return {
      movements: allMovements,
      totals: sumHistoryByCategory(allScoped),
      system_qty,
      ledgerSummary: summarizeStockMovements(allScoped),
      outstandingRentSummary: summarizeStockMovements(allFull),
      countBaseline: opts.countBaseline ?? null,
      movementsSinceBaseline: movementsAfterBaseline(allFull, opts.baselineAt),
      byBranch:
        multi.length > 1
          ? parts.map((p) => ({
              branch_id: p.branch_id,
              system_qty: p.system_qty,
              movements: p.movements,
              totals: p.totals,
            }))
          : undefined,
    };
  },
};

/** Alias matching web `stockCountService` name — same RPC engine. */
export const stockCountService = stockCountApi;
