/**
 * Product Stock Card / Product Ledger Report
 * Shows complete A-to-Z history for a single product:
 * purchases, sales, returns, adjustments, transfers, production — with running balance & profit.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  ArrowDownRight,
  ArrowUpRight,
  CornerUpLeft,
  CornerDownRight,
  RefreshCw,
  Loader2,
  Package,
  Filter,
  Printer,
  AlertTriangle,
  TrendingUp,
  GitBranch,
  FileText,
  Home,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useGlobalFilterOptional } from '@/app/context/GlobalFilterContext';
import { supabase } from '@/lib/supabase';
import { branchService } from '@/app/services/branchService';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';

// ─── Types ───────────────────────────────────────────────────

/** One stock event (pickup / return) for this product on a rental */
interface ProductRentalHistoryRow {
  id: string;
  rentalId: string;
  rentalNo: string;
  customerName: string;
  eventDate: string;
  movementType: 'rental_out' | 'rental_in';
  qty: number;
  itemLineTotal: number;
  rentalBookingTotal: number;
  pickupOrStart: string | null;
  expectedReturn: string | null;
  actualReturn: string | null;
  rentalStatus: string;
  damageCharges: number;
  penaltyPaid: boolean;
  damageNotes: string | null;
  conditionType: string | null;
  branchLabel: string;
}

/** All-time rental pipeline for this SKU (same branch filter as movements when applied). */
interface RentalLifecycleStats {
  totalBookings: number;
  completedFullCycles: number;
  withCustomerPendingReturn: number;
  awaitingPickupNotOut: number;
  cancelled: number;
  other: number;
}

type TxnType =
  | 'Purchase'
  | 'Purchase Return'
  | 'Sale'
  | 'Sale Return'
  | 'Adjustment'
  | 'Opening Stock'
  | 'Production'
  | 'Transfer';

interface LedgerRow {
  id: string;
  date: string;
  voucherNo: string;
  type: TxnType;
  partyName: string;
  variationId?: string;
  variationLabel?: string;
  qtyIn: number;
  qtyOut: number;
  purchaseRate: number;
  saleRate: number;
  amount: number;
  discount: number;
  netAmount: number;
  runningQty: number;
  runningValue: number;
  grossProfit: number;
  remarks: string;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  category?: string;
  cost_price?: number;
  retail_price?: number;
  has_variations?: boolean;
}

interface VariationOption {
  id: string;
  sku: string;
  label: string;
}

interface BranchOption {
  id: string;
  name: string;
}

const ALL_TXN_TYPES: TxnType[] = [
  'Purchase', 'Purchase Return', 'Sale', 'Sale Return',
  'Adjustment', 'Opening Stock', 'Production', 'Transfer',
];

/** Local calendar YYYY-MM-DD from an ISO timestamp (matches global filter local midnight range). */
function localCalendarDayFromIso(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** SQL DATE / date string → local noon timestamp for range checks. */
function parseSqlDateOnlyToLocalNoon(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const day = String(dateStr).slice(0, 10);
  const parts = day.split('-').map(Number);
  if (parts.length < 3 || !parts[0]) return null;
  const [y, mo, da] = parts;
  return new Date(y, mo - 1, da, 12, 0, 0, 0).getTime();
}

function localCalendarDayFromTs(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Component ───────────────────────────────────────────────

export const ProductLedger = () => {
  const { companyId, branchId: contextBranchId } = useSupabase();
  const globalFilter = useGlobalFilterOptional();
  const { formatCurrency } = useFormatCurrency();

  // Filters
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [variations, setVariations] = useState<VariationOption[]>([]);
  const [selectedVariationId, setSelectedVariationId] = useState('');
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [enabledTypes, setEnabledTypes] = useState<Set<TxnType>>(new Set(ALL_TXN_TYPES));
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showTypeFilter, setShowTypeFilter] = useState(false);

  // Data
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'stock-card' | 'profit-analysis' | 'source-trace' | 'rental-history'>('stock-card');
  const [redFlags, setRedFlags] = useState<string[]>([]);
  const [allProductsSummary, setAllProductsSummary] = useState<{
    productId: string; name: string; sku: string; category?: string;
    stock: number; purchaseQty: number; purchaseValue: number; saleQty: number; saleValue: number; stockValue: number;
    saleReturnQty: number; purchaseReturnQty: number; adjustmentQty: number;
  }[]>([]);
  const [allSummaryLoading, setAllSummaryLoading] = useState(false);
  const [rentalHistoryRows, setRentalHistoryRows] = useState<ProductRentalHistoryRow[]>([]);
  const [rentalHistoryLoading, setRentalHistoryLoading] = useState(false);
  const [rentalLifecycleStats, setRentalLifecycleStats] = useState<RentalLifecycleStats | null>(null);

  const startDate = globalFilter?.startDate || (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); })();
  const endDate = globalFilter?.endDate || new Date().toISOString().slice(0, 10);

  /** Inclusive filter window for rental movement timestamps (fixes ISO string vs YYYY-MM-DD lexicographic bugs). */
  const rentalTimeRange = useMemo(() => {
    if (globalFilter?.startDateObj && globalFilter?.endDateObj) {
      return { start: globalFilter.startDateObj, end: globalFilter.endDateObj };
    }
    const sd = startDate.slice(0, 10);
    const ed = endDate.slice(0, 10);
    const [ys, ms, ds] = sd.split('-').map(Number);
    const [ye, me, de] = ed.split('-').map(Number);
    return {
      start: new Date(ys, ms - 1, ds, 0, 0, 0, 0),
      end: new Date(ye, me - 1, de, 23, 59, 59, 999),
    };
  }, [globalFilter?.startDateObj?.getTime(), globalFilter?.endDateObj?.getTime(), startDate, endDate]);

  const rentalRangeLabel = useMemo(() => {
    const a = rentalTimeRange.start.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const b = rentalTimeRange.end.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    return `${a} → ${b}`;
  }, [rentalTimeRange.start.getTime(), rentalTimeRange.end.getTime()]);

  // ─── Load products & branches ──────────────────────────────

  useEffect(() => {
    if (!companyId) return;
    setProductsLoading(true);
    supabase
      .from('products')
      .select('id, name, sku, cost_price, retail_price, has_variations, rental_count, depreciation_per_rental, category:product_categories(name)')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name')
      .then(({ data, error }) => {
        if (error) {
          console.error('[ProductLedger] products load:', error);
          setProducts([]);
        } else {
          const rows = (data || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            category: typeof p.category?.name === 'string' ? p.category.name : undefined,
            cost_price: p.cost_price,
            retail_price: p.retail_price,
            has_variations: p.has_variations,
            rental_count: p.rental_count,
            depreciation_per_rental: p.depreciation_per_rental,
          })) as ProductOption[];
          setProducts(rows);
        }
        setProductsLoading(false);
      });

    branchService.getBranchesCached(companyId).then(b => setBranches((b || []).map((br: any) => ({ id: br.id, name: br.name }))));
  }, [companyId]);

  // Load all-products summary (stock + purchase/sale aggregates from stock_movements)
  useEffect(() => {
    if (!companyId || products.length === 0) return;
    setAllSummaryLoading(true);
    (async () => {
      try {
        const { data: movements } = await supabase
          .from('stock_movements')
          .select('product_id, movement_type, quantity, unit_cost, total_cost')
          .eq('company_id', companyId);

        type AggRow = { stock: number; purQty: number; purVal: number; saleQty: number; saleVal: number; saleRetQty: number; purRetQty: number; adjQty: number };
        const agg = new Map<string, AggRow>();
        for (const m of (movements || []) as any[]) {
          const pid = m.product_id;
          const a = agg.get(pid) || { stock: 0, purQty: 0, purVal: 0, saleQty: 0, saleVal: 0, saleRetQty: 0, purRetQty: 0, adjQty: 0 };
          const qty = Number(m.quantity) || 0;
          const cost = Math.abs(Number(m.total_cost) || qty * (Number(m.unit_cost) || 0));
          const mt = String(m.movement_type || '');
          a.stock += qty;
          if (mt === 'purchase' || mt === 'opening_stock') { a.purQty += Math.abs(qty); a.purVal += cost; }
          if (mt === 'sale') { a.saleQty += Math.abs(qty); a.saleVal += cost; }
          if (mt === 'sale_return') a.saleRetQty += Math.abs(qty);
          if (mt === 'purchase_return') a.purRetQty += Math.abs(qty);
          if (mt === 'adjustment') a.adjQty += qty;
          agg.set(pid, a);
        }

        const rows = products.map(p => {
          const a = agg.get(p.id) || { stock: 0, purQty: 0, purVal: 0, saleQty: 0, saleVal: 0, saleRetQty: 0, purRetQty: 0, adjQty: 0 };
          const avgCost = a.purQty > 0 ? a.purVal / a.purQty : (p.cost_price || 0);
          return {
            productId: p.id, name: p.name, sku: p.sku, category: p.category,
            stock: Math.round(a.stock * 1000) / 1000,
            purchaseQty: a.purQty, purchaseValue: Math.round(a.purVal),
            saleQty: a.saleQty, saleValue: Math.round(a.saleVal),
            stockValue: Math.round(a.stock * avgCost),
            saleReturnQty: a.saleRetQty, purchaseReturnQty: a.purRetQty, adjustmentQty: a.adjQty,
          };
        }).filter(r => r.stock !== 0 || r.purchaseQty > 0 || r.saleQty > 0)
          .sort((a, b) => b.saleValue - a.saleValue);

        setAllProductsSummary(rows);
      } catch (err) {
        console.error('[ProductLedger] All products summary:', err);
      }
      setAllSummaryLoading(false);
    })();
  }, [companyId, products]);

  useEffect(() => {
    if (!selectedProductId) { setVariations([]); setSelectedVariationId(''); return; }
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod?.has_variations) { setVariations([]); setSelectedVariationId(''); return; }
    supabase
      .from('product_variations')
      .select('id, sku, attributes')
      .eq('product_id', selectedProductId)
      .eq('is_active', true)
      .then(({ data }) => {
        setVariations((data || []).map((v: any) => ({
          id: v.id,
          sku: v.sku || '',
          label: v.attributes ? Object.values(v.attributes).join(' / ') : v.sku || v.id.slice(0, 8),
        })));
      });
  }, [selectedProductId, products]);

  // ─── Load ledger ───────────────────────────────────────────

  const loadLedger = useCallback(async () => {
    if (!companyId || !selectedProductId) return;
    setLoading(true);
    try {
      const allRows: LedgerRow[] = [];
      const branchFilter = selectedBranchId || (contextBranchId === 'all' ? '' : contextBranchId || '');

      // ── 1. Purchases ──
      if (enabledTypes.has('Purchase')) {
        let q = supabase
          .from('purchase_items')
          .select('purchase_id, quantity, unit_price, discount_amount, total, variation_id')
          .eq('product_id', selectedProductId);
        if (selectedVariationId) q = q.eq('variation_id', selectedVariationId);
        const { data: pItems } = await q;
        const pIds = [...new Set((pItems || []).map((r: any) => r.purchase_id))];
        if (pIds.length > 0) {
          let pq = supabase.from('purchases').select('id, po_no, po_date, supplier_name, status, branch_id').eq('company_id', companyId).in('id', pIds).in('status', ['final', 'received', 'ordered']);
          if (branchFilter) pq = pq.eq('branch_id', branchFilter);
          const { data: purs } = await pq;
          const purMap = new Map((purs || []).map((p: any) => [p.id, p]));
          for (const pi of (pItems || []) as any[]) {
            const pur = purMap.get(pi.purchase_id);
            if (!pur) continue;
            const d = (pur.po_date || '').slice(0, 10);
            if (d < startDate || d > endDate) continue;
            const qty = Number(pi.quantity) || 0;
            const rate = Number(pi.unit_price) || 0;
            const disc = Number(pi.discount_amount) || 0;
            const total = Number(pi.total) || qty * rate;
            allRows.push({
              id: `pur-${pi.purchase_id}-${pi.variation_id || ''}`, date: d,
              voucherNo: pur.po_no || '', type: 'Purchase', partyName: pur.supplier_name || '',
              variationId: pi.variation_id || undefined,
              qtyIn: qty, qtyOut: 0, purchaseRate: rate, saleRate: 0,
              amount: qty * rate, discount: disc, netAmount: total,
              runningQty: 0, runningValue: 0, grossProfit: 0, remarks: '',
            });
          }
        }
      }

      // ── 2. Purchase Returns ──
      if (enabledTypes.has('Purchase Return')) {
        let q = supabase.from('purchase_return_items').select('purchase_return_id, quantity, unit_price, total, variation_id, product_id').eq('product_id', selectedProductId);
        if (selectedVariationId) q = q.eq('variation_id', selectedVariationId);
        const { data: prItems } = await q;
        const prIds = [...new Set((prItems || []).map((r: any) => r.purchase_return_id))];
        if (prIds.length > 0) {
          let prq = supabase.from('purchase_returns').select('id, return_no, return_date, supplier_name, status, branch_id').eq('company_id', companyId).in('id', prIds).eq('status', 'final');
          if (branchFilter) prq = prq.eq('branch_id', branchFilter);
          const { data: prets } = await prq;
          const pretMap = new Map((prets || []).map((r: any) => [r.id, r]));
          for (const ri of (prItems || []) as any[]) {
            const ret = pretMap.get(ri.purchase_return_id);
            if (!ret) continue;
            const d = (ret.return_date || '').slice(0, 10);
            if (d < startDate || d > endDate) continue;
            const qty = Number(ri.quantity) || 0;
            const rate = Number(ri.unit_price) || 0;
            allRows.push({
              id: `pret-${ri.purchase_return_id}-${ri.variation_id || ''}`, date: d,
              voucherNo: ret.return_no || '', type: 'Purchase Return', partyName: ret.supplier_name || '',
              variationId: ri.variation_id || undefined,
              qtyIn: 0, qtyOut: qty, purchaseRate: rate, saleRate: 0,
              amount: qty * rate, discount: 0, netAmount: Number(ri.total) || qty * rate,
              runningQty: 0, runningValue: 0, grossProfit: 0, remarks: 'Return to supplier',
            });
          }
        }
      }

      // ── 3. Sales ──
      if (enabledTypes.has('Sale')) {
        let q = supabase.from('sales_items').select('sale_id, quantity, unit_price, discount_amount, total, variation_id').eq('product_id', selectedProductId);
        if (selectedVariationId) q = q.eq('variation_id', selectedVariationId);
        const { data: sItems, error: sErr } = await q;
        // Fallback to legacy table
        let finalSaleItems = sItems;
        if (sErr?.code === '42P01' || sErr?.message?.includes('does not exist')) {
          const { data: legacyItems } = await supabase.from('sale_items').select('sale_id, quantity, unit_price, discount_amount, total, variation_id').eq('product_id', selectedProductId);
          finalSaleItems = legacyItems;
        }
        const sIds = [...new Set((finalSaleItems || []).map((r: any) => r.sale_id))];
        if (sIds.length > 0) {
          let sq = supabase.from('sales').select('id, invoice_no, invoice_date, customer_name, status, branch_id').eq('company_id', companyId).in('id', sIds).eq('status', 'final');
          if (branchFilter) sq = sq.eq('branch_id', branchFilter);
          const { data: sales } = await sq;
          const saleMap = new Map((sales || []).map((s: any) => [s.id, s]));
          for (const si of (finalSaleItems || []) as any[]) {
            const sale = saleMap.get(si.sale_id);
            if (!sale) continue;
            const d = (sale.invoice_date || '').slice(0, 10);
            if (d < startDate || d > endDate) continue;
            const qty = Number(si.quantity) || 0;
            const saleRate = Number(si.unit_price) || 0;
            const disc = Number(si.discount_amount) || 0;
            const total = Number(si.total) || qty * saleRate;
            allRows.push({
              id: `sale-${si.sale_id}-${si.variation_id || ''}`, date: d,
              voucherNo: sale.invoice_no || '', type: 'Sale', partyName: sale.customer_name || 'Walk-in',
              variationId: si.variation_id || undefined,
              qtyIn: 0, qtyOut: qty, purchaseRate: 0, saleRate,
              amount: qty * saleRate, discount: disc, netAmount: total,
              runningQty: 0, runningValue: 0, grossProfit: 0, remarks: '',
            });
          }
        }
      }

      // ── 4. Sale Returns ──
      if (enabledTypes.has('Sale Return')) {
        let q = supabase.from('sale_return_items').select('sale_return_id, quantity, unit_price, total, variation_id, product_id').eq('product_id', selectedProductId);
        if (selectedVariationId) q = q.eq('variation_id', selectedVariationId);
        const { data: srItems } = await q;
        const srIds = [...new Set((srItems || []).map((r: any) => r.sale_return_id))];
        if (srIds.length > 0) {
          let srq = supabase.from('sale_returns').select('id, return_no, return_date, status, branch_id').eq('company_id', companyId).in('id', srIds).eq('status', 'final');
          if (branchFilter) srq = srq.eq('branch_id', branchFilter);
          const { data: srets } = await srq;
          const sretMap = new Map((srets || []).map((r: any) => [r.id, r]));
          for (const ri of (srItems || []) as any[]) {
            const ret = sretMap.get(ri.sale_return_id);
            if (!ret) continue;
            const d = (ret.return_date || '').slice(0, 10);
            if (d < startDate || d > endDate) continue;
            const qty = Number(ri.quantity) || 0;
            allRows.push({
              id: `sret-${ri.sale_return_id}-${ri.variation_id || ''}`, date: d,
              voucherNo: ret.return_no || '', type: 'Sale Return', partyName: 'Customer Return',
              variationId: ri.variation_id || undefined,
              qtyIn: qty, qtyOut: 0, purchaseRate: 0, saleRate: Number(ri.unit_price) || 0,
              amount: Number(ri.total) || 0, discount: 0, netAmount: Number(ri.total) || 0,
              runningQty: 0, runningValue: 0, grossProfit: 0, remarks: '',
            });
          }
        }
      }

      // ── 5. Stock Movements (Adjustment, Opening, Production, Transfer) ──
      const movTypes: string[] = [];
      if (enabledTypes.has('Adjustment')) movTypes.push('adjustment');
      if (enabledTypes.has('Opening Stock')) movTypes.push('opening_stock');
      if (enabledTypes.has('Production')) movTypes.push('production');
      if (enabledTypes.has('Transfer')) movTypes.push('transfer', 'transfer_in', 'transfer_out');

      if (movTypes.length > 0) {
        let mq = supabase
          .from('stock_movements')
          .select('id, quantity, unit_cost, total_cost, movement_type, reference_type, reference_id, notes, created_at, branch_id')
          .eq('company_id', companyId)
          .eq('product_id', selectedProductId)
          .in('movement_type', movTypes);
        if (selectedVariationId) mq = mq.eq('variation_id', selectedVariationId);
        if (branchFilter) mq = mq.eq('branch_id', branchFilter);
        const { data: movs } = await mq;

        for (const m of (movs || []) as any[]) {
          const d = (m.created_at || '').slice(0, 10);
          if (d < startDate || d > endDate) continue;
          const qty = Number(m.quantity) || 0;
          const cost = Number(m.unit_cost) || 0;

          let txnType: TxnType = 'Adjustment';
          const mt = String(m.movement_type || '');
          if (mt === 'opening_stock') txnType = 'Opening Stock';
          else if (mt === 'production') txnType = 'Production';
          else if (mt.includes('transfer')) txnType = 'Transfer';

          if (!enabledTypes.has(txnType)) continue;

          allRows.push({
            id: `mov-${m.id}`, date: d,
            voucherNo: m.reference_id ? `${m.reference_type || ''}-${String(m.reference_id).slice(0, 8)}` : '',
            type: txnType, partyName: m.notes || mt,
            qtyIn: qty > 0 ? qty : 0,
            qtyOut: qty < 0 ? Math.abs(qty) : 0,
            purchaseRate: cost, saleRate: 0,
            amount: Math.abs(Number(m.total_cost) || qty * cost),
            discount: 0, netAmount: Math.abs(Number(m.total_cost) || qty * cost),
            runningQty: 0, runningValue: 0, grossProfit: 0,
            remarks: m.notes || '',
          });
        }
      }

      // ── Sort by date ──
      allRows.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

      // ── Resolve variation labels ──
      const varIds = [...new Set(allRows.filter(r => r.variationId).map(r => r.variationId!))];
      if (varIds.length > 0) {
        const { data: vars } = await supabase.from('product_variations').select('id, sku, attributes').in('id', varIds);
        const varMap = new Map((vars || []).map((v: any) => [v.id, v.attributes ? Object.values(v.attributes).join(' / ') : v.sku || v.id.slice(0, 8)]));
        for (const row of allRows) {
          if (row.variationId) row.variationLabel = varMap.get(row.variationId) || row.variationId.slice(0, 8);
        }
      }

      // ── Calculate WAC + running balance ──
      // Single global WAC across all variations (consistent stock valuation).
      // Profit uses the actual purchase cost for that specific sale's items where available.
      let runQty = 0;
      let runValue = 0;
      let avgCost = 0;

      for (const row of allRows) {
        if (row.qtyIn > 0) {
          const incomingCost = row.purchaseRate > 0 ? row.purchaseRate : avgCost;
          const incomingValue = row.qtyIn * incomingCost;
          runValue += incomingValue;
          runQty += row.qtyIn;
          avgCost = runQty > 0 ? runValue / runQty : 0;
          if (row.purchaseRate === 0) row.purchaseRate = Math.round(incomingCost * 100) / 100;
        }
        if (row.qtyOut > 0) {
          // For profit: use the actual cost rate if this row has one, else WAC
          const deductCost = avgCost;
          const deductValue = row.qtyOut * deductCost;
          runValue -= deductValue;
          runQty -= row.qtyOut;
          if (row.purchaseRate === 0) row.purchaseRate = Math.round(deductCost * 100) / 100;
          if (row.type === 'Sale') {
            row.grossProfit = Math.round((row.netAmount - row.qtyOut * deductCost) * 100) / 100;
          }
        }

        row.runningQty = Math.round(runQty * 1000) / 1000;
        row.runningValue = Math.round(Math.max(runValue, 0) * 100) / 100;
      }

      setRows(allRows);

      // ── Red Flags / Audit Warnings ──
      const flags: string[] = [];
      // 1. Negative stock at any point
      const negRows = allRows.filter(r => r.runningQty < -0.001);
      if (negRows.length > 0) flags.push(`warn:Negative stock detected at ${negRows.length} point(s). Earliest: ${negRows[0].date} (Balance: ${negRows[0].runningQty})`);
      // 2. Sale without cost (WAC = 0)
      const zeroCostSales = allRows.filter(r => r.type === 'Sale' && r.purchaseRate === 0);
      if (zeroCostSales.length > 0) flags.push(`warn:${zeroCostSales.length} sale(s) have zero cost price — profit calculation unreliable`);
      // 3. Duplicate stock movements for same reference
      try {
        let dmq = supabase.from('stock_movements').select('reference_type, reference_id, quantity, notes').eq('company_id', companyId).eq('product_id', selectedProductId).in('movement_type', ['purchase', 'sale']);
        if (selectedVariationId) dmq = dmq.eq('variation_id', selectedVariationId);
        const { data: movCheck } = await dmq;
        const refCounts = new Map<string, number>();
        for (const m of (movCheck || []) as any[]) {
          if (!m.reference_id) continue;
          const key = `${m.reference_type}:${m.reference_id}`;
          refCounts.set(key, (refCounts.get(key) || 0) + 1);
        }
        const dups = [...refCounts.entries()].filter(([, c]) => c > 3);
        if (dups.length > 0) flags.push(`warn:${dups.length} document(s) have suspicious duplicate stock movements (>3 entries per document)`);
      } catch {}
      setRedFlags(flags);
    } catch (err: any) {
      console.error('[ProductLedger] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedProductId, selectedVariationId, selectedBranchId, contextBranchId, startDate, endDate, enabledTypes]);

  useEffect(() => { if (selectedProductId) loadLedger(); }, [selectedProductId, loadLedger]);

  const loadRentalHistory = useCallback(async () => {
    if (!companyId || !selectedProductId) {
      setRentalHistoryRows([]);
      setRentalLifecycleStats(null);
      return;
    }
    setRentalHistoryLoading(true);
    try {
      const branchFilter = selectedBranchId || (contextBranchId === 'all' ? '' : contextBranchId || '');
      const rangeStartMs = rentalTimeRange.start.getTime();
      const rangeEndMs = rentalTimeRange.end.getTime();
      const inRangeTs = (t: number) => t >= rangeStartMs && t <= rangeEndMs;

      const { data: ri, error: riErr } = await supabase
        .from('rental_items')
        .select('rental_id, quantity, rate, total')
        .eq('product_id', selectedProductId);
      if (riErr) throw riErr;
      const rentalIds = [...new Set((ri || []).map((x: any) => x.rental_id).filter(Boolean))] as string[];
      const itemByRental = new Map((ri || []).map((x: any) => [x.rental_id, x]));

      if (rentalIds.length === 0) {
        setRentalHistoryRows([]);
        setRentalLifecycleStats({
          totalBookings: 0,
          completedFullCycles: 0,
          withCustomerPendingReturn: 0,
          awaitingPickupNotOut: 0,
          cancelled: 0,
          other: 0,
        });
        return;
      }

      let rq = supabase
        .from('rentals')
        .select(
          'id, rental_no, booking_no, customer_name, start_date, pickup_date, expected_return_date, return_date, actual_return_date, status, total_amount, damage_charges, penalty_paid, damage_notes, condition_type, branch_id, booking_date'
        )
        .eq('company_id', companyId)
        .in('id', rentalIds);
      if (branchFilter) rq = rq.eq('branch_id', branchFilter);
      const { data: rents, error: rErr } = await rq;
      if (rErr) throw rErr;
      const rentMap = new Map((rents || []).map((r: any) => [r.id, r]));

      let mq = supabase
        .from('stock_movements')
        .select('id, reference_id, quantity, movement_type, created_at, branch_id, notes')
        .eq('company_id', companyId)
        .eq('product_id', selectedProductId)
        .eq('reference_type', 'rental')
        .in('movement_type', ['rental_out', 'rental_in']);
      if (branchFilter) mq = mq.eq('branch_id', branchFilter);
      const { data: movs, error: mErr } = await mq;
      if (mErr) throw mErr;
      const movList = (movs || []) as any[];

      const flagsByRental = new Map<string, { out: boolean; in: boolean }>();
      for (const m of movList) {
        const rid = m.reference_id as string;
        if (!rid) continue;
        const cur = flagsByRental.get(rid) || { out: false, in: false };
        if (m.movement_type === 'rental_out') cur.out = true;
        if (m.movement_type === 'rental_in') cur.in = true;
        flagsByRental.set(rid, cur);
      }

      let completedFullCycles = 0;
      let withCustomerPendingReturn = 0;
      let awaitingPickupNotOut = 0;
      let cancelled = 0;
      let other = 0;

      const visibleRentalIds = rentalIds.filter(id => rentMap.has(id));

      for (const rid of visibleRentalIds) {
        const rental = rentMap.get(rid)!;
        const f = flagsByRental.get(rid) || { out: false, in: false };
        const st = String(rental.status || '').toLowerCase();
        if (st === 'cancelled') {
          cancelled++;
          continue;
        }
        if (f.out && f.in) {
          completedFullCycles++;
        } else if (f.out && !f.in && ['returned', 'closed'].includes(st)) {
          completedFullCycles++;
        } else if (f.out && !f.in && ['active', 'rented', 'picked_up', 'overdue'].includes(st)) {
          withCustomerPendingReturn++;
        } else if (!f.out && ['draft', 'booked'].includes(st)) {
          awaitingPickupNotOut++;
        } else {
          other++;
        }
      }

      setRentalLifecycleStats({
        totalBookings: visibleRentalIds.length,
        completedFullCycles,
        withCustomerPendingReturn,
        awaitingPickupNotOut,
        cancelled,
        other,
      });

      const rows: ProductRentalHistoryRow[] = [];
      const pushRow = (
        id: string,
        rid: string,
        rental: any,
        item: any,
        eventDate: string,
        movementType: 'rental_out' | 'rental_in',
        qty: number
      ) => {
        const branchLabel = branches.find(b => b.id === rental.branch_id)?.name || rental.branch_id || '—';
        rows.push({
          id,
          rentalId: rid,
          rentalNo: String(rental.rental_no || rental.booking_no || rid.slice(0, 8)),
          customerName: String(rental.customer_name || '—'),
          eventDate,
          movementType,
          qty,
          itemLineTotal: Number(item?.total ?? 0) || (Number(item?.quantity) || 0) * (Number(item?.rate) || 0),
          rentalBookingTotal: Number(rental.total_amount ?? 0) || 0,
          pickupOrStart: rental.pickup_date || rental.start_date || rental.booking_date || null,
          expectedReturn: rental.expected_return_date || rental.return_date || null,
          actualReturn: rental.actual_return_date ?? null,
          rentalStatus: String(rental.status || ''),
          damageCharges: Number(rental.damage_charges ?? 0) || 0,
          penaltyPaid: rental.penalty_paid === true,
          damageNotes: rental.damage_notes ?? null,
          conditionType: rental.condition_type ?? null,
          branchLabel,
        });
      };

      for (const m of movList) {
        const rid = m.reference_id as string;
        const rental = rentMap.get(rid);
        if (!rental) continue;
        const t = new Date(m.created_at).getTime();
        if (!inRangeTs(t)) continue;
        const item = itemByRental.get(rid);
        const qty = Math.abs(Number(m.quantity) || 0);
        const mt = m.movement_type === 'rental_in' ? 'rental_in' : 'rental_out';
        const day = localCalendarDayFromIso(m.created_at);
        pushRow(String(m.id), rid, rental, item, day, mt, qty);
      }

      // Fallback: bookings with no stock_movements OR movements filtered out by date range
      if (rows.length === 0) {
        for (const rid of rentalIds) {
          const rental = rentMap.get(rid);
          if (!rental) continue;
          const item = itemByRental.get(rid);
          const startMs = parseSqlDateOnlyToLocalNoon(rental.pickup_date || rental.start_date || rental.booking_date);
          const retMs = parseSqlDateOnlyToLocalNoon(rental.actual_return_date);
          const qty = Math.abs(Number(item?.quantity) || 0);
          if (startMs != null && inRangeTs(startMs)) {
            pushRow(`fb-out-${rid}`, rid, rental, item, localCalendarDayFromTs(startMs), 'rental_out', qty);
          }
          if (retMs != null && inRangeTs(retMs)) {
            pushRow(`fb-in-${rid}`, rid, rental, item, localCalendarDayFromTs(retMs), 'rental_in', qty);
          }
        }
      }

      rows.sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.rentalNo.localeCompare(b.rentalNo));
      setRentalHistoryRows(rows);
    } catch (e) {
      console.error('[ProductLedger] rental history:', e);
      setRentalHistoryRows([]);
      setRentalLifecycleStats(null);
    } finally {
      setRentalHistoryLoading(false);
    }
  }, [companyId, selectedProductId, selectedBranchId, contextBranchId, branches, rentalTimeRange.start.getTime(), rentalTimeRange.end.getTime()]);

  useEffect(() => {
    if (selectedProductId && activeTab === 'rental-history') loadRentalHistory();
  }, [selectedProductId, activeTab, loadRentalHistory]);

  // ─── Derived ───────────────────────────────────────────────

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products.slice(0, 60);
    const q = searchQuery.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)).slice(0, 60);
  }, [products, searchQuery]);

  // Filter all-products summary table by search query
  const filteredAllSummary = useMemo(() => {
    if (!searchQuery) return allProductsSummary;
    const q = searchQuery.toLowerCase();
    return allProductsSummary.filter(p => p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
  }, [allProductsSummary, searchQuery]);

  /** Grand totals for the All Products summary table (sums visible rows after search filter). */
  const allProductsGrandTotals = useMemo(() => {
    const t = {
      stock: 0, purchaseQty: 0, purchaseValue: 0, saleQty: 0, saleValue: 0, stockValue: 0,
      saleReturnQty: 0, purchaseReturnQty: 0, adjustmentQty: 0,
    };
    for (const p of filteredAllSummary) {
      t.stock += Number(p.stock) || 0;
      t.purchaseQty += Number(p.purchaseQty) || 0;
      t.purchaseValue += Number(p.purchaseValue) || 0;
      t.saleQty += Number(p.saleQty) || 0;
      t.saleValue += Number(p.saleValue) || 0;
      t.stockValue += Number(p.stockValue) || 0;
      t.saleReturnQty += Number(p.saleReturnQty) || 0;
      t.purchaseReturnQty += Number(p.purchaseReturnQty) || 0;
      t.adjustmentQty += Number(p.adjustmentQty) || 0;
    }
    return t;
  }, [filteredAllSummary]);

  const totals = useMemo(() => {
    const t = { qtyIn: 0, qtyOut: 0, amount: 0, discount: 0, netAmount: 0, grossProfit: 0 };
    for (const r of rows) {
      t.qtyIn += r.qtyIn; t.qtyOut += r.qtyOut;
      t.amount += r.amount; t.discount += r.discount;
      t.netAmount += r.netAmount; t.grossProfit += r.grossProfit;
    }
    return t;
  }, [rows]);

  // ─── 11 Summary Metrics ─────────────────────────────────────
  const summary = useMemo(() => {
    const purchases = rows.filter(r => r.type === 'Purchase');
    const sales = rows.filter(r => r.type === 'Sale');
    const saleReturns = rows.filter(r => r.type === 'Sale Return');
    const purchaseReturns = rows.filter(r => r.type === 'Purchase Return');
    const adjustments = rows.filter(r => r.type === 'Adjustment' || r.type === 'Opening Stock');
    const lastPurchase = [...purchases].reverse()[0];
    const lastSale = [...sales].reverse()[0];
    const closingQty = rows.length > 0 ? rows[rows.length - 1].runningQty : 0;
    const closingValue = rows.length > 0 ? rows[rows.length - 1].runningValue : 0;
    return {
      totalPurchaseQty: purchases.reduce((s, r) => s + r.qtyIn, 0),
      totalPurchaseValue: Math.round(purchases.reduce((s, r) => s + r.netAmount, 0)),
      totalSaleQty: sales.reduce((s, r) => s + r.qtyOut, 0),
      totalSaleValue: Math.round(sales.reduce((s, r) => s + r.netAmount, 0)),
      totalReturnedQty: saleReturns.reduce((s, r) => s + r.qtyIn, 0) + purchaseReturns.reduce((s, r) => s + r.qtyOut, 0),
      saleReturnQty: saleReturns.reduce((s, r) => s + r.qtyIn, 0),
      purchaseReturnQty: purchaseReturns.reduce((s, r) => s + r.qtyOut, 0),
      adjustmentQty: adjustments.reduce((s, r) => s + r.qtyIn - r.qtyOut, 0),
      closingStock: closingQty,
      closingValue,
      grossProfit: Math.round(sales.reduce((s, r) => s + r.grossProfit, 0)),
      avgCost: closingQty > 0 ? Math.round(closingValue / closingQty) : 0,
      lastPurchasePrice: lastPurchase?.purchaseRate || 0,
      lastSalePrice: lastSale?.saleRate || 0,
    };
  }, [rows]);

  // ─── Tab 2: Profit Analysis derived data ───────────────────
  const profitAnalysis = useMemo(() => {
    const sales = rows.filter(r => r.type === 'Sale');
    const totalCost = sales.reduce((s, r) => s + r.qtyOut * r.purchaseRate, 0);
    const totalRevenue = sales.reduce((s, r) => s + r.netAmount, 0);
    const totalProfit = sales.reduce((s, r) => s + r.grossProfit, 0);
    const marginPct = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Customer-wise grouping
    const byCustomer = new Map<string, { qty: number; revenue: number; cost: number; profit: number }>();
    for (const s of sales) {
      const c = byCustomer.get(s.partyName) || { qty: 0, revenue: 0, cost: 0, profit: 0 };
      c.qty += s.qtyOut; c.revenue += s.netAmount; c.cost += s.qtyOut * s.purchaseRate; c.profit += s.grossProfit;
      byCustomer.set(s.partyName, c);
    }
    const customerRows = [...byCustomer.entries()].map(([name, d]) => ({
      name, ...d, marginPct: d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0,
    })).sort((a, b) => b.revenue - a.revenue);

    // Month-wise grouping
    const byMonth = new Map<string, { qty: number; revenue: number; cost: number; profit: number }>();
    for (const s of sales) {
      const month = s.date.slice(0, 7);
      const m = byMonth.get(month) || { qty: 0, revenue: 0, cost: 0, profit: 0 };
      m.qty += s.qtyOut; m.revenue += s.netAmount; m.cost += s.qtyOut * s.purchaseRate; m.profit += s.grossProfit;
      byMonth.set(month, m);
    }
    const monthRows = [...byMonth.entries()].map(([month, d]) => ({
      month, ...d, marginPct: d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0,
    })).sort((a, b) => a.month.localeCompare(b.month));

    return { totalCost: Math.round(totalCost), totalRevenue: Math.round(totalRevenue), totalProfit: Math.round(totalProfit), marginPct, customerRows, monthRows };
  }, [rows]);

  // ─── Tab 3: Source Trace derived data ──────────────────────
  const sourceTrace = useMemo(() => {
    const purchases = rows.filter(r => r.type === 'Purchase');
    const sales = rows.filter(r => r.type === 'Sale');
    const returns = rows.filter(r => r.type === 'Sale Return' || r.type === 'Purchase Return');

    // Supplier grouping
    const bySupplier = new Map<string, { qty: number; amount: number; vouchers: string[] }>();
    for (const p of purchases) {
      const s = bySupplier.get(p.partyName) || { qty: 0, amount: 0, vouchers: [] };
      s.qty += p.qtyIn; s.amount += p.netAmount;
      if (p.voucherNo && !s.vouchers.includes(p.voucherNo)) s.vouchers.push(p.voucherNo);
      bySupplier.set(p.partyName, s);
    }
    const supplierRows = [...bySupplier.entries()].map(([name, d]) => ({
      name, ...d, avgRate: d.qty > 0 ? Math.round(d.amount / d.qty) : 0,
    })).sort((a, b) => b.amount - a.amount);

    // Customer grouping
    const byCustomer = new Map<string, { qty: number; amount: number; vouchers: string[] }>();
    for (const s of sales) {
      const c = byCustomer.get(s.partyName) || { qty: 0, amount: 0, vouchers: [] };
      c.qty += s.qtyOut; c.amount += s.netAmount;
      if (s.voucherNo && !c.vouchers.includes(s.voucherNo)) c.vouchers.push(s.voucherNo);
      byCustomer.set(s.partyName, c);
    }
    const customerRows = [...byCustomer.entries()].map(([name, d]) => ({
      name, ...d, avgRate: d.qty > 0 ? Math.round(d.amount / d.qty) : 0,
    })).sort((a, b) => b.amount - a.amount);

    return { supplierRows, customerRows, returns };
  }, [rows]);

  const toggleType = (t: TxnType) => {
    setEnabledTypes(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  };

  // ─── Badge helper ──────────────────────────────────────────
  const typeBadge = (type: TxnType) => {
    const map: Record<TxnType, { icon: typeof ArrowDownRight; color: string }> = {
      'Purchase':        { icon: ArrowDownRight,  color: 'bg-green-500/10 text-green-400 border-green-500/20' },
      'Purchase Return': { icon: CornerUpLeft,    color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
      'Sale':            { icon: ArrowUpRight,    color: 'bg-red-500/10 text-red-400 border-red-500/20' },
      'Sale Return':     { icon: CornerDownRight, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
      'Adjustment':      { icon: RefreshCw,       color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
      'Opening Stock':   { icon: Package,         color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
      'Production':      { icon: Package,         color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
      'Transfer':        { icon: RefreshCw,       color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
    };
    const cfg = map[type] || map['Adjustment'];
    const Icon = cfg.icon;
    return <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap', cfg.color)}><Icon size={10} />{type}</span>;
  };

  const fmt = (n: number) => n ? n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '';
  const fmtRs = (n: number) => n ? `Rs ${fmt(n)}` : '—';

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">Product Stock Card</h3>
        {rows.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => window.print()} className="border-gray-700 text-gray-300">
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
        <div className={cn('grid grid-cols-1 gap-3', branches.length > 1 ? 'md:grid-cols-4' : 'md:grid-cols-3')}>
          {/* Product */}
          <div className={cn('relative', branches.length > 1 ? 'md:col-span-2' : 'md:col-span-2')}>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Product</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder={productsLoading ? 'Loading...' : 'All Products — type to search...'}
                value={selectedProduct ? `${selectedProduct.name} (${selectedProduct.sku})` : searchQuery}
                onChange={e => { setSearchQuery(e.target.value); if (selectedProductId) { setSelectedProductId(''); setRows([]); setRedFlags([]); } setShowDropdown(false); }}
                onFocus={() => { if (selectedProductId) setShowDropdown(true); }}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                className="pl-10 bg-gray-950 border-gray-700 text-white h-9 text-sm"
              />
              {selectedProductId && <button onClick={() => { setSelectedProductId(''); setSearchQuery(''); setRows([]); setRedFlags([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs">×</button>}
            </div>
            {showDropdown && !selectedProductId && filteredProducts.length > 0 && (
              <div className="absolute z-50 w-full mt-1 max-h-56 overflow-y-auto bg-gray-900 border border-gray-700 rounded-lg shadow-xl">
                {filteredProducts.map(p => (
                  <button key={p.id} onClick={() => { setSelectedProductId(p.id); setSearchQuery(''); setShowDropdown(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-800 flex items-center gap-2 text-sm">
                    <Package className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                    <span className="text-white">{p.name}</span>
                    <span className="text-gray-500 font-mono text-xs ml-auto">{p.sku}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Variation */}
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Variation</label>
            <select value={selectedVariationId} onChange={e => setSelectedVariationId(e.target.value)} className="w-full h-9 bg-gray-950 border border-gray-700 rounded-md text-white text-sm px-2" disabled={variations.length === 0}>
              <option value="">{variations.length > 0 ? 'All Variations' : 'N/A'}</option>
              {variations.map(v => <option key={v.id} value={v.id}>{v.label} ({v.sku})</option>)}
            </select>
          </div>

          {/* Branch — only show if multiple branches exist */}
          {branches.length > 1 && (
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Branch</label>
              <select value={selectedBranchId} onChange={e => setSelectedBranchId(e.target.value)} className="w-full h-9 bg-gray-950 border border-gray-700 rounded-md text-white text-sm px-2">
                <option value="">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Type filter */}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowTypeFilter(!showTypeFilter)} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
            <Filter className="h-3 w-3" /> Transaction Types
          </button>
          {showTypeFilter && ALL_TXN_TYPES.map(t => (
            <button key={t} onClick={() => toggleType(t)} className={cn('px-2 py-0.5 rounded text-[10px] font-medium border transition-colors', enabledTypes.has(t) ? 'bg-blue-600/20 text-blue-300 border-blue-500/30' : 'bg-gray-800 text-gray-500 border-gray-700')}>
              {t}
            </button>
          ))}
          {showTypeFilter && (
            <button onClick={() => setEnabledTypes(new Set(ALL_TXN_TYPES))} className="text-[10px] text-gray-500 hover:text-white underline ml-2">All</button>
          )}
        </div>

        {/* Date range indicator */}
        <div className="text-[10px] text-gray-500">Period: {startDate} — {endDate}</div>
      </div>

      {/* ── All Products Summary (default view) ── */}
      {!selectedProductId && !loading && (
        <>
          {allSummaryLoading && (
            <div className="text-center py-16">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-400" />
              <p className="text-gray-500 text-sm mt-2">Loading all products...</p>
            </div>
          )}
          {!allSummaryLoading && filteredAllSummary.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
              {/* Grand totals header with transaction breakdown */}
              <div className="px-4 py-3 border-b border-gray-800 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="text-sm font-medium text-gray-300">All Products — {filteredAllSummary.length} items{searchQuery ? ` (filtered)` : ''}</span>
                  <span className="text-[10px] text-gray-600 hidden sm:inline">Click a row for full ledger</span>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  <div className="bg-gray-950/60 rounded-lg px-3 py-2">
                    <p className="text-[8px] text-gray-500 uppercase">Total Stock</p>
                    <p className="text-sm font-bold text-white font-mono">{fmt(allProductsGrandTotals.stock)}</p>
                  </div>
                  <div className="bg-gray-950/60 rounded-lg px-3 py-2">
                    <p className="text-[8px] text-gray-500 uppercase">Stock Value</p>
                    <p className="text-sm font-bold text-emerald-400 font-mono">{fmtRs(allProductsGrandTotals.stockValue)}</p>
                  </div>
                  <div className="bg-gray-950/60 rounded-lg px-3 py-2">
                    <p className="text-[8px] text-green-600 uppercase">Purchases</p>
                    <p className="text-sm font-bold text-green-400 font-mono">{fmt(allProductsGrandTotals.purchaseQty)} <span className="text-[10px] text-gray-500">({fmtRs(allProductsGrandTotals.purchaseValue)})</span></p>
                  </div>
                  <div className="bg-gray-950/60 rounded-lg px-3 py-2">
                    <p className="text-[8px] text-red-600 uppercase">Sales</p>
                    <p className="text-sm font-bold text-red-400 font-mono">{fmt(allProductsGrandTotals.saleQty)} <span className="text-[10px] text-gray-500">({fmtRs(allProductsGrandTotals.saleValue)})</span></p>
                  </div>
                  <div className="bg-gray-950/60 rounded-lg px-3 py-2">
                    <p className="text-[8px] text-amber-600 uppercase">Returns</p>
                    <p className="text-xs font-bold text-amber-400 font-mono">
                      SR: {fmt(allProductsGrandTotals.saleReturnQty)} | PR: {fmt(allProductsGrandTotals.purchaseReturnQty)}
                    </p>
                  </div>
                  <div className="bg-gray-950/60 rounded-lg px-3 py-2">
                    <p className="text-[8px] text-blue-600 uppercase">Adjustments</p>
                    <p className="text-sm font-bold text-blue-400 font-mono">{fmt(allProductsGrandTotals.adjustmentQty)}</p>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[65vh]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-950/80 text-gray-400 font-medium border-b border-gray-800 sticky top-0">
                    <tr>
                      <th className="px-3 py-2.5">Product</th>
                      <th className="px-3 py-2.5">SKU</th>
                      <th className="px-3 py-2.5">Category</th>
                      <th className="px-3 py-2.5 text-right">Current Stock</th>
                      <th className="px-3 py-2.5 text-right">Purchase Qty</th>
                      <th className="px-3 py-2.5 text-right">Purchase Value</th>
                      <th className="px-3 py-2.5 text-right">Sale Qty</th>
                      <th className="px-3 py-2.5 text-right">Sale Value</th>
                      <th className="px-3 py-2.5 text-right">Stock Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {filteredAllSummary.map(p => (
                      <tr key={p.productId}
                        onClick={() => { setSelectedProductId(p.productId); setSearchQuery(''); setShowDropdown(false); }}
                        className="hover:bg-blue-900/20 cursor-pointer transition-colors">
                        <td className="px-3 py-2 text-white font-medium">{p.name}</td>
                        <td className="px-3 py-2 font-mono text-gray-400">{p.sku}</td>
                        <td className="px-3 py-2 text-gray-500">{p.category || '—'}</td>
                        <td className={cn('px-3 py-2 text-right font-mono font-bold', p.stock < 0 ? 'text-red-400' : 'text-white')}>{fmt(p.stock)}</td>
                        <td className="px-3 py-2 text-right font-mono text-green-400">{p.purchaseQty > 0 ? fmt(p.purchaseQty) : '—'}</td>
                        <td className="px-3 py-2 text-right font-mono text-green-400">{p.purchaseValue > 0 ? fmtRs(p.purchaseValue) : '—'}</td>
                        <td className="px-3 py-2 text-right font-mono text-red-400">{p.saleQty > 0 ? fmt(p.saleQty) : '—'}</td>
                        <td className="px-3 py-2 text-right font-mono text-red-400">{p.saleValue > 0 ? fmtRs(p.saleValue) : '—'}</td>
                        <td className="px-3 py-2 text-right font-mono text-white">{p.stockValue > 0 ? fmtRs(p.stockValue) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-950 border-t-2 border-gray-700 text-xs font-semibold sticky bottom-0">
                    <tr className="text-gray-300">
                      <td colSpan={3} className="px-3 py-2.5 text-gray-400 uppercase tracking-wide">
                        Total ({filteredAllSummary.length} {filteredAllSummary.length === 1 ? 'product' : 'products'})
                      </td>
                      <td className={cn('px-3 py-2.5 text-right font-mono text-white', allProductsGrandTotals.stock < 0 && 'text-red-400')}>
                        {fmt(allProductsGrandTotals.stock)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-green-400">
                        {allProductsGrandTotals.purchaseQty > 0 ? fmt(allProductsGrandTotals.purchaseQty) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-green-400">
                        {allProductsGrandTotals.purchaseValue > 0 ? fmtRs(allProductsGrandTotals.purchaseValue) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-red-400">
                        {allProductsGrandTotals.saleQty > 0 ? fmt(allProductsGrandTotals.saleQty) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-red-400">
                        {allProductsGrandTotals.saleValue > 0 ? fmtRs(allProductsGrandTotals.saleValue) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-emerald-300">
                        {allProductsGrandTotals.stockValue !== 0 ? fmtRs(allProductsGrandTotals.stockValue) : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
          {!allSummaryLoading && allProductsSummary.length === 0 && products.length > 0 && (
            <div className="text-center py-16 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No product movements found</p>
            </div>
          )}
        </>
      )}

      {loading && (
        <div className="text-center py-16">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-400" />
          <p className="text-gray-500 text-sm mt-2">Loading stock card...</p>
        </div>
      )}

      {/* ── Summary header — 11 metrics ── */}
      {selectedProduct && rows.length > 0 && !loading && (
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 border border-gray-700 p-5 rounded-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-3">
            <div>
              <h2 className="text-xl font-bold text-white">{selectedProduct.name}</h2>
              <p className="text-gray-400 font-mono text-xs">{selectedProduct.sku}{selectedProduct.category ? ` • ${selectedProduct.category}` : ''}</p>
            </div>
            <div className="flex items-center gap-5">
              <div className="text-right">
                <p className="text-gray-500 text-[10px] uppercase">Current Stock</p>
                <p className="text-2xl font-bold text-white">{fmt(summary.closingStock)}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-500 text-[10px] uppercase">Stock Value</p>
                <p className="text-lg font-bold text-white">{fmtRs(summary.closingValue)}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-500 text-[10px] uppercase">Gross Profit</p>
                <p className={cn('text-lg font-bold', summary.grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400')}>{fmtRs(summary.grossProfit)}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-2">
            {([
              { label: 'Purchase Qty', value: fmt(summary.totalPurchaseQty), color: 'text-green-400' },
              { label: 'Purchase Value', value: fmtRs(summary.totalPurchaseValue), color: 'text-green-400' },
              { label: 'Sale Qty', value: fmt(summary.totalSaleQty), color: 'text-red-400' },
              { label: 'Sale Value', value: fmtRs(summary.totalSaleValue), color: 'text-red-400' },
              { label: 'Sale Return', value: fmt(summary.saleReturnQty), color: 'text-orange-400' },
              { label: 'Purchase Return', value: fmt(summary.purchaseReturnQty), color: 'text-orange-400' },
              { label: 'Adjustments', value: fmt(summary.adjustmentQty), color: 'text-blue-400' },
              { label: 'Avg Cost (WAC)', value: fmtRs(summary.avgCost), color: 'text-white' },
              { label: 'Last Purchase', value: fmtRs(summary.lastPurchasePrice), color: 'text-blue-400' },
              { label: 'Last Sale', value: fmtRs(summary.lastSalePrice), color: 'text-cyan-400' },
            ] as { label: string; value: string; color: string }[]).map(s => (
              <div key={s.label} className="bg-gray-950/50 rounded-lg px-2.5 py-2">
                <p className="text-[8px] text-gray-500 uppercase leading-tight">{s.label}</p>
                <p className={cn('text-xs font-bold mt-0.5', s.color)}>{s.value || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab Navigation ── */}
      {selectedProduct && !loading && (
        <div className="flex items-center gap-2 bg-gray-900/60 border border-gray-800 rounded-lg p-1">
          {([
            { key: 'stock-card' as const, label: 'Stock Card', icon: FileText },
            { key: 'profit-analysis' as const, label: 'Profit Analysis', icon: TrendingUp },
            { key: 'source-trace' as const, label: 'Source Trace', icon: GitBranch },
            { key: 'rental-history' as const, label: 'Rental History', icon: Home },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={cn('px-4 py-2 text-sm font-medium flex items-center gap-1.5 rounded-md transition-colors',
                activeTab === tab.key
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white')}>
              <tab.icon size={14} />{tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── TAB 1: Stock Card ── */}
      {selectedProduct && !loading && activeTab === 'stock-card' && (rows.length === 0 ? (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
          Is date range mein is product ki koi stock movement nahi mili. Agar sirf rental history dekhni hai to &quot;Rental History&quot; tab use karein.
        </div>
      ) : (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden print:bg-white print:text-black">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-950/80 text-gray-400 font-medium border-b border-gray-800 sticky top-0">
                <tr>
                  <th className="px-2 py-2.5 whitespace-nowrap">Date</th>
                  <th className="px-2 py-2.5 whitespace-nowrap">Voucher #</th>
                  <th className="px-2 py-2.5 whitespace-nowrap">Type</th>
                  {selectedProduct?.has_variations && <th className="px-2 py-2.5 whitespace-nowrap">Variation</th>}
                  <th className="px-2 py-2.5 whitespace-nowrap">Party Name</th>
                  <th className="px-2 py-2.5 text-right whitespace-nowrap">Qty In</th>
                  <th className="px-2 py-2.5 text-right whitespace-nowrap">Qty Out</th>
                  <th className="px-2 py-2.5 text-right whitespace-nowrap">Cost Rate</th>
                  <th className="px-2 py-2.5 text-right whitespace-nowrap">Sale Rate</th>
                  <th className="px-2 py-2.5 text-right whitespace-nowrap">Amount</th>
                  <th className="px-2 py-2.5 text-right whitespace-nowrap">Discount</th>
                  <th className="px-2 py-2.5 text-right whitespace-nowrap">Net Amount</th>
                  <th className="px-2 py-2.5 text-right whitespace-nowrap bg-gray-900/60">Balance Qty</th>
                  <th className="px-2 py-2.5 text-right whitespace-nowrap bg-gray-900/60">Stock Value</th>
                  <th className="px-2 py-2.5 text-right whitespace-nowrap">Profit</th>
                  <th className="px-2 py-2.5 whitespace-nowrap">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {rows.map(row => (
                  <tr key={row.id} className="hover:bg-gray-800/20 transition-colors">
                    <td className="px-2 py-2 text-gray-300 whitespace-nowrap">{row.date}</td>
                    <td className="px-2 py-2 text-blue-400 font-mono whitespace-nowrap">{row.voucherNo || '—'}</td>
                    <td className="px-2 py-2">{typeBadge(row.type)}</td>
                    {selectedProduct?.has_variations && <td className="px-2 py-2 text-cyan-400 text-[10px] max-w-[100px] truncate">{row.variationLabel || '—'}</td>}
                    <td className="px-2 py-2 text-white font-medium max-w-[160px] truncate">{row.partyName}</td>
                    <td className="px-2 py-2 text-right font-mono text-green-400">{row.qtyIn > 0 ? `+${fmt(row.qtyIn)}` : ''}</td>
                    <td className="px-2 py-2 text-right font-mono text-red-400">{row.qtyOut > 0 ? `-${fmt(row.qtyOut)}` : ''}</td>
                    <td className="px-2 py-2 text-right font-mono text-gray-400">{row.purchaseRate > 0 ? fmt(row.purchaseRate) : ''}</td>
                    <td className="px-2 py-2 text-right font-mono text-gray-400">{row.saleRate > 0 ? fmt(row.saleRate) : ''}</td>
                    <td className={cn('px-2 py-2 text-right font-mono', row.qtyOut > 0 ? 'text-red-400' : 'text-gray-300')}>{row.amount > 0 ? (row.qtyOut > 0 ? `-${fmt(row.amount)}` : fmt(row.amount)) : ''}</td>
                    <td className="px-2 py-2 text-right font-mono text-amber-400">{row.discount > 0 ? fmt(row.discount) : ''}</td>
                    <td className={cn('px-2 py-2 text-right font-mono', row.qtyOut > 0 ? 'text-red-400' : 'text-white')}>{row.netAmount > 0 ? (row.qtyOut > 0 ? `-${fmt(row.netAmount)}` : fmt(row.netAmount)) : ''}</td>
                    <td className={cn('px-2 py-2 text-right font-mono font-bold bg-gray-900/30', row.runningQty < 0 ? 'text-red-400' : 'text-white')}>{fmt(row.runningQty)}</td>
                    <td className={cn('px-2 py-2 text-right font-mono bg-gray-900/30', row.runningValue < 0 ? 'text-red-400' : 'text-gray-300')}>{fmtRs(row.runningValue)}</td>
                    <td className="px-2 py-2 text-right font-mono">
                      {row.grossProfit !== 0
                        ? <span className={row.grossProfit > 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{row.grossProfit > 0 ? '+' : ''}{fmt(row.grossProfit)}</span>
                        : ''}
                    </td>
                    <td className="px-2 py-2 text-gray-500 max-w-[120px] truncate text-[10px]">{row.remarks}</td>
                  </tr>
                ))}
              </tbody>
              {/* Totals row */}
              <tfoot className="bg-gray-950 border-t-2 border-gray-700 font-bold text-xs">
                <tr>
                  <td colSpan={selectedProduct?.has_variations ? 5 : 4} className="px-2 py-2.5 text-gray-400 uppercase text-[10px]">Totals</td>
                  <td className="px-2 py-2.5 text-right font-mono text-green-400">{fmt(totals.qtyIn)}</td>
                  <td className="px-2 py-2.5 text-right font-mono text-red-400">{fmt(totals.qtyOut)}</td>
                  <td colSpan={2}></td>
                  <td className="px-2 py-2.5 text-right font-mono text-gray-300">{fmt(totals.amount)}</td>
                  <td className="px-2 py-2.5 text-right font-mono text-amber-400">{fmt(totals.discount)}</td>
                  <td className="px-2 py-2.5 text-right font-mono text-white">{fmt(totals.netAmount)}</td>
                  <td className="px-2 py-2.5 text-right font-mono text-white bg-gray-900/30">{fmt(rows[rows.length - 1]?.runningQty ?? 0)}</td>
                  <td className="px-2 py-2.5 text-right font-mono text-gray-300 bg-gray-900/30">{fmtRs(rows[rows.length - 1]?.runningValue ?? 0)}</td>
                  <td className="px-2 py-2.5 text-right font-mono">
                    <span className={totals.grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmt(totals.grossProfit)}</span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="px-3 py-2 border-t border-gray-800 text-[10px] text-gray-500 flex justify-between">
            <span>{rows.length} transactions</span>
            <span>Period: {startDate} to {endDate}</span>
          </div>
        </div>
      ))}

      {/* ── TAB 2: Profit Analysis ── */}
      {selectedProduct && !loading && activeTab === 'profit-analysis' && (rows.length === 0 ? (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
          Profit analysis ke liye is range mein kam az kam ek stock movement honi chahiye.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Sale summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {([
              { label: 'Total Sale Qty', value: fmt(summary.totalSaleQty), color: 'text-white' },
              { label: 'Total Sale Amount', value: fmtRs(profitAnalysis.totalRevenue), color: 'text-white' },
              { label: 'Total Cost', value: fmtRs(profitAnalysis.totalCost), color: 'text-red-400' },
              { label: 'Gross Profit', value: fmtRs(profitAnalysis.totalProfit), color: profitAnalysis.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400' },
              { label: 'Profit Margin', value: `${profitAnalysis.marginPct.toFixed(1)}%`, color: profitAnalysis.marginPct >= 0 ? 'text-emerald-400' : 'text-red-400' },
            ] as { label: string; value: string; color: string }[]).map(s => (
              <div key={s.label} className="bg-gray-900/60 border border-gray-800 rounded-lg px-4 py-3">
                <p className="text-[10px] text-gray-500 uppercase">{s.label}</p>
                <p className={cn('text-lg font-bold', s.color)}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Customer-wise sale table */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-800 text-sm font-medium text-gray-300">Customer-wise Sale Breakdown</div>
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-950/80 text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2 text-right">Qty Sold</th>
                  <th className="px-4 py-2 text-right">Sale Amount</th>
                  <th className="px-4 py-2 text-right">Cost</th>
                  <th className="px-4 py-2 text-right">Profit</th>
                  <th className="px-4 py-2 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {profitAnalysis.customerRows.map(c => (
                  <tr key={c.name} className="hover:bg-gray-800/20">
                    <td className="px-4 py-2 text-white font-medium">{c.name}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(c.qty)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtRs(c.revenue)}</td>
                    <td className="px-4 py-2 text-right font-mono text-red-400">{fmtRs(Math.round(c.cost))}</td>
                    <td className="px-4 py-2 text-right font-mono"><span className={c.profit >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{fmtRs(Math.round(c.profit))}</span></td>
                    <td className="px-4 py-2 text-right font-mono text-gray-400">{c.marginPct.toFixed(1)}%</td>
                  </tr>
                ))}
                {profitAnalysis.customerRows.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">No sales in this period</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Month-wise sale table */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-800 text-sm font-medium text-gray-300">Month-wise Sale Breakdown</div>
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-950/80 text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="px-4 py-2">Month</th>
                  <th className="px-4 py-2 text-right">Qty Sold</th>
                  <th className="px-4 py-2 text-right">Sale Amount</th>
                  <th className="px-4 py-2 text-right">Cost</th>
                  <th className="px-4 py-2 text-right">Profit</th>
                  <th className="px-4 py-2 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {profitAnalysis.monthRows.map(m => (
                  <tr key={m.month} className="hover:bg-gray-800/20">
                    <td className="px-4 py-2 text-white font-medium font-mono">{m.month}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(m.qty)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtRs(m.revenue)}</td>
                    <td className="px-4 py-2 text-right font-mono text-red-400">{fmtRs(Math.round(m.cost))}</td>
                    <td className="px-4 py-2 text-right font-mono"><span className={m.profit >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{fmtRs(Math.round(m.profit))}</span></td>
                    <td className="px-4 py-2 text-right font-mono text-gray-400">{m.marginPct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* ── TAB 3: Source Trace ── */}
      {selectedProduct && !loading && activeTab === 'source-trace' && (rows.length === 0 ? (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
          Source trace ke liye is range mein purchase / sale movements honi chahiye.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Supplier-wise purchases */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-800 text-sm font-medium text-green-400">Supplier Purchase Trace</div>
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-950/80 text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="px-4 py-2">Supplier</th>
                  <th className="px-4 py-2 text-right">Qty Purchased</th>
                  <th className="px-4 py-2 text-right">Total Amount</th>
                  <th className="px-4 py-2 text-right">Avg Rate</th>
                  <th className="px-4 py-2">Invoice(s)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {sourceTrace.supplierRows.map(s => (
                  <tr key={s.name} className="hover:bg-gray-800/20">
                    <td className="px-4 py-2 text-white font-medium">{s.name}</td>
                    <td className="px-4 py-2 text-right font-mono text-green-400">+{fmt(s.qty)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtRs(Math.round(s.amount))}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-400">{fmtRs(s.avgRate)}</td>
                    <td className="px-4 py-2 text-blue-400 font-mono text-[10px]">{s.vouchers.join(', ') || '—'}</td>
                  </tr>
                ))}
                {sourceTrace.supplierRows.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No purchases in this period</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Customer-wise sales */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-800 text-sm font-medium text-red-400">Customer Sale Trace</div>
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-950/80 text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2 text-right">Qty Sold</th>
                  <th className="px-4 py-2 text-right">Total Amount</th>
                  <th className="px-4 py-2 text-right">Avg Rate</th>
                  <th className="px-4 py-2">Invoice(s)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {sourceTrace.customerRows.map(c => (
                  <tr key={c.name} className="hover:bg-gray-800/20">
                    <td className="px-4 py-2 text-white font-medium">{c.name}</td>
                    <td className="px-4 py-2 text-right font-mono text-red-400">-{fmt(c.qty)}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtRs(Math.round(c.amount))}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-400">{fmtRs(c.avgRate)}</td>
                    <td className="px-4 py-2 text-blue-400 font-mono text-[10px]">{c.vouchers.join(', ') || '—'}</td>
                  </tr>
                ))}
                {sourceTrace.customerRows.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No sales in this period</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Return trace */}
          {sourceTrace.returns.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-800 text-sm font-medium text-amber-400">Return Trace</div>
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-950/80 text-gray-400 border-b border-gray-800">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Party</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2">Voucher #</th>
                    <th className="px-4 py-2">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {sourceTrace.returns.map(r => (
                    <tr key={r.id} className="hover:bg-gray-800/20">
                      <td className="px-4 py-2 text-gray-300">{r.date}</td>
                      <td className="px-4 py-2">{typeBadge(r.type)}</td>
                      <td className="px-4 py-2 text-white">{r.partyName}</td>
                      <td className="px-4 py-2 text-right font-mono">{r.qtyIn > 0 ? `+${fmt(r.qtyIn)}` : `-${fmt(r.qtyOut)}`}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmtRs(r.netAmount)}</td>
                      <td className="px-4 py-2 text-blue-400 font-mono">{r.voucherNo || '—'}</td>
                      <td className="px-4 py-2 text-gray-500 text-[10px]">{r.remarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {/* ── Red Flags / Audit Warnings ── */}
      {selectedProduct && rows.length > 0 && !loading && redFlags.length > 0 && (
        <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl p-4">
          <h4 className="text-sm font-bold text-amber-400 flex items-center gap-1.5 mb-2">
            <AlertTriangle size={14} /> Audit Warnings ({redFlags.length})
          </h4>
          <ul className="space-y-1">
            {redFlags.map((f, i) => {
              const isWarn = f.startsWith('warn:');
              const text = isWarn ? f.slice(5) : f;
              return (
                <li key={i} className={cn('text-xs flex items-start gap-2', isWarn ? 'text-amber-300/80' : 'text-gray-400')}>
                  <span className={cn('mt-0.5', isWarn ? 'text-amber-500' : 'text-gray-500')}>{isWarn ? '⚠' : 'ℹ'}</span> {text}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ── TAB 4: Rental History (stock_movements rental_out / rental_in + rentals) ── */}
      {selectedProduct && !loading && activeTab === 'rental-history' && (() => {
        const productData = (selectedProduct as any);
        const rentalCountLife = Number(productData?.rental_count) || 0;
        const depPerRental = Number(productData?.depreciation_per_rental) || 25;
        const costPrice = Number(productData?.cost_price) || 0;
        const residualPct = Math.max(0, 100 - (rentalCountLife * depPerRental));
        const residualValue = Math.round(costPrice * residualPct / 100);
        const pickupsInPeriod = rentalHistoryRows.filter(r => r.movementType === 'rental_out').length;
        const returnsInPeriod = rentalHistoryRows.filter(r => r.movementType === 'rental_in').length;
        const uniqRentals = new Set(rentalHistoryRows.map(r => r.rentalId)).size;
        const lineOnReturns = rentalHistoryRows
          .filter(r => r.movementType === 'rental_in')
          .reduce((s, r) => s + r.itemLineTotal, 0);
        const damageByRental = new Map<string, number>();
        for (const r of rentalHistoryRows) {
          if (r.movementType === 'rental_in' && r.damageCharges > 0) damageByRental.set(r.rentalId, r.damageCharges);
        }
        const totalDamage = [...damageByRental.values()].reduce((a, b) => a + b, 0);
        const penaltyReturns = rentalHistoryRows.filter(r => r.movementType === 'rental_in' && r.penaltyPaid).length;

        const life = rentalLifecycleStats;

        return (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-800 bg-gray-950/40 px-3 py-2 text-xs text-gray-400 space-y-1">
              <p>
                <span className="text-gray-300 font-medium">Filter window: </span>
                {rentalRangeLabel}
                {globalFilter?.getDateRangeLabel ? (
                  <span className="text-gray-500"> ({globalFilter.getDateRangeLabel()})</span>
                ) : null}
              </p>
              <p className="text-[11px] leading-relaxed text-gray-500">
                Neeche wali table sirf is window ke andar <strong className="text-gray-400">pickup / return timestamps</strong> par filter hai.
                Upar wale boxes poori rental pipeline dikhate hain (book → pickup → return), branch filter ke mutabiq.
              </p>
            </div>

            {life && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-300">Rental pipeline (poori history — is product par kitni dafa kya hua)</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { label: 'کل بکنگز / Total bookings', sub: 'Is SKU par alag rental orders', value: String(life.totalBookings), color: 'text-blue-300' },
                    { label: 'مکمل واپسی / Full cycles', sub: 'Stock out + stock wapas (return)', value: String(life.completedFullCycles), color: 'text-emerald-300' },
                    { label: 'کسٹمر کے پاس / Out', sub: 'Pickup ho chuka, return abhi pending', value: String(life.withCustomerPendingReturn), color: 'text-amber-300' },
                    { label: 'بک، پک اپ بقیہ / Booked', sub: 'Abhi stock out nahi hua', value: String(life.awaitingPickupNotOut), color: 'text-cyan-300' },
                    { label: 'Cancelled', sub: 'Manzookh', value: String(life.cancelled), color: 'text-gray-500' },
                    { label: 'Other', sub: 'Unknown / mixed state', value: String(life.other), color: 'text-gray-500' },
                  ].map((c, i) => (
                    <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                      <p className="text-[10px] text-gray-400 uppercase leading-tight">{c.label}</p>
                      <p className="text-[9px] text-gray-600 mt-0.5 leading-tight">{c.sub}</p>
                      <p className={cn('text-xl font-bold mt-1', c.color)}>{c.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Product rental_count (DB)', value: String(rentalCountLife), color: 'text-blue-400' },
                { label: 'Pickups (is window)', value: String(pickupsInPeriod), color: 'text-amber-300' },
                { label: 'Returns (is window)', value: String(returnsInPeriod), color: 'text-emerald-300' },
                { label: 'Rentals touched (window)', value: String(uniqRentals), color: 'text-white' },
                { label: 'Line total (returns in window)', value: formatCurrency(lineOnReturns), color: 'text-green-400' },
                { label: 'Damage (returns in window)', value: formatCurrency(totalDamage), color: totalDamage > 0 ? 'text-red-400' : 'text-gray-400' },
              ].map((c, i) => (
                <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                  <p className="text-[10px] text-gray-500 uppercase leading-tight">{c.label}</p>
                  <p className={cn('text-base font-bold mt-0.5', c.color)}>{c.value}</p>
                </div>
              ))}
            </div>
            {penaltyReturns > 0 && (
              <p className="text-xs text-amber-400/90">
                {penaltyReturns} return event(s) par penalty mark paid / recorded.
              </p>
            )}

            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-gray-400 mb-2">Product Health (depreciation)</h4>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div
                  className={cn('h-3 rounded-full transition-all', residualPct > 50 ? 'bg-emerald-500' : residualPct > 25 ? 'bg-amber-500' : residualPct > 0 ? 'bg-orange-500' : 'bg-red-500')}
                  style={{ width: `${Math.min(100, residualPct)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-gray-500">
                <span>{residualPct}% value remaining</span>
                <span>{rentalCountLife} rentals logged · {depPerRental}% / rental</span>
              </div>
              {residualPct <= 0 && rentalCountLife > 0 && (
                <p className="mt-2 text-sm text-red-400 font-medium">This product has fully depreciated — consider retiring from rental stock</p>
              )}
            </div>

            <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
              {rentalHistoryLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-gray-400 text-sm">
                  <Loader2 className="animate-spin" size={18} /> Rental history load ho rahi hai…
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[960px]">
                    <thead className="bg-gray-950/80 text-gray-500 uppercase border-b border-gray-800">
                      <tr>
                        <th className="px-3 py-2 whitespace-nowrap">Event date</th>
                        <th className="px-3 py-2 whitespace-nowrap">Event</th>
                        <th className="px-3 py-2 whitespace-nowrap">Rental #</th>
                        <th className="px-3 py-2 whitespace-nowrap">Customer</th>
                        <th className="px-3 py-2 whitespace-nowrap">Branch</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">Qty</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">Line</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">Booking total</th>
                        <th className="px-3 py-2 whitespace-nowrap">Start</th>
                        <th className="px-3 py-2 whitespace-nowrap">Due return</th>
                        <th className="px-3 py-2 whitespace-nowrap">Actual return</th>
                        <th className="px-3 py-2 whitespace-nowrap">Status</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">Damage</th>
                        <th className="px-3 py-2 whitespace-nowrap">Penalty</th>
                        <th className="px-3 py-2 whitespace-nowrap">Condition</th>
                        <th className="px-3 py-2 min-w-[140px]">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                      {rentalHistoryRows.length === 0 && (
                        <tr>
                          <td colSpan={16} className="text-center text-gray-500">
                            <div className="space-y-2 py-10 px-4">
                              <p className="font-medium text-gray-400">Is time window mein koi pickup/return movement match nahi hui.</p>
                              <p className="text-[11px] max-w-lg mx-auto leading-relaxed">
                                Upar Rental pipeline wale boxes poori history se aate hain — agar wahan complete cycles dikhen lekin yahan table khali ho to filter window chhoti hai; header se date range barha kar dubara check karein.
                                Agar purane data par stock movements hi na hon to fallback sirf tab chalti hai jab DB mein koi rental movement record na ho.
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                      {rentalHistoryRows.map(r => (
                        <tr key={r.id} className="hover:bg-gray-800/20">
                          <td className="px-3 py-2 text-gray-300 whitespace-nowrap font-mono">{r.eventDate}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className={cn(
                              'px-1.5 py-0.5 rounded text-[10px] font-medium',
                              r.movementType === 'rental_out' ? 'bg-amber-900/50 text-amber-200' : 'bg-emerald-900/50 text-emerald-200'
                            )}>
                              {r.movementType === 'rental_out' ? 'Stock out (pickup)' : 'Stock in (return)'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-blue-400 font-mono whitespace-nowrap">{r.rentalNo}</td>
                          <td className="px-3 py-2 text-white max-w-[140px] truncate">{r.customerName}</td>
                          <td className="px-3 py-2 text-gray-400 max-w-[100px] truncate">{r.branchLabel}</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-200">{r.movementType === 'rental_out' ? `-${fmt(r.qty)}` : `+${fmt(r.qty)}`}</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-300">{formatCurrency(r.itemLineTotal)}</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-400">{formatCurrency(r.rentalBookingTotal)}</td>
                          <td className="px-3 py-2 text-gray-400 whitespace-nowrap font-mono text-[10px]">{r.pickupOrStart || '—'}</td>
                          <td className="px-3 py-2 text-gray-400 whitespace-nowrap font-mono text-[10px]">{r.expectedReturn || '—'}</td>
                          <td className="px-3 py-2 text-gray-400 whitespace-nowrap font-mono text-[10px]">{r.actualReturn || '—'}</td>
                          <td className="px-3 py-2 text-gray-500 capitalize">{r.rentalStatus || '—'}</td>
                          <td className="px-3 py-2 text-right font-mono text-red-400/90">{r.damageCharges > 0 ? formatCurrency(r.damageCharges) : '—'}</td>
                          <td className="px-3 py-2 text-gray-400">{r.penaltyPaid ? 'Paid / yes' : '—'}</td>
                          <td className="px-3 py-2 text-gray-500 max-w-[100px] truncate text-[10px]">{r.conditionType || '—'}</td>
                          <td className="px-3 py-2 text-gray-500 text-[10px] max-w-[200px]">{r.damageNotes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {selectedProduct && rows.length === 0 && !loading && activeTab !== 'rental-history' && (
        <div className="text-center py-12 text-gray-500">
          <p>Is product ki koi transaction nahi mili is date range mein</p>
        </div>
      )}
    </div>
  );
};
