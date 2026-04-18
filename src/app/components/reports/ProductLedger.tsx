import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  ArrowUpRight,
  ArrowDownRight,
  CornerUpLeft,
  RefreshCw,
  Loader2,
  Package,
} from 'lucide-react';
import { Input } from "../ui/input";
import { CalendarDateRangePicker } from "../ui/CalendarDateRangePicker";
import { ReportActions } from './ReportActions';
import { cn } from "../ui/utils";
import { useSupabase } from '@/app/context/SupabaseContext';
import { useGlobalFilterOptional } from '@/app/context/GlobalFilterContext';
import { supabase } from '@/lib/supabase';

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  category?: string;
  cost_price?: number;
  retail_price?: number;
  has_variations?: boolean;
  /** Space-separated active variation SKUs — parent `products.sku` is often empty when using variations */
  variationSkusForSearch?: string;
}

interface VariationOption {
  id: string;
  sku: string;
  attributes: any;
  label: string;
}

interface LedgerRow {
  id: string;
  date: string;
  type: 'Purchase' | 'Sale' | 'Sale Return' | 'Purchase Return' | 'Adjustment' | 'Opening';
  party: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  profit: number;
  balance: number;
  reference: string;
}

interface ProductSummary {
  currentStock: number;
  avgPurchaseCost: number;
  avgSalePrice: number;
  totalPurchaseQty: number;
  totalPurchaseAmount: number;
  totalSaleQty: number;
  totalSaleAmount: number;
  totalProfit: number;
}

/** First calendar day in YYYY-MM-DD from ISO or date-only strings (for DB / string compare). */
function toYyyyMmDd(isoOrDate: string | undefined | null): string {
  if (!isoOrDate) return '';
  const m = String(isoOrDate).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

function isSubsequence(haystack: string, needle: string): boolean {
  let from = 0;
  for (const ch of needle) {
    const idx = haystack.indexOf(ch, from);
    if (idx === -1) return false;
    from = idx + 1;
  }
  return true;
}

/** Unify fancy hyphens/spaces so "PRD‑0365" (unicode) still matches typed ASCII. */
function normalizeSearchText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Match name + parent SKU + variation SKUs; token-AND; fuzzy subsequence as last resort. */
function productMatchesSearch(
  name: string,
  sku: string,
  variationSkus: string,
  rawQuery: string
): boolean {
  const q = normalizeSearchText(rawQuery);
  if (!q) return true;
  const hay = normalizeSearchText(`${name} ${sku} ${variationSkus}`);
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((tok) => hay.includes(tok) || isSubsequence(hay, tok));
}

/** Higher = better match — used so exact SKUs are not pushed out by .slice(50) on loose subsequence hits. */
function productSearchRank(p: ProductOption, rawQuery: string): number {
  const q = normalizeSearchText(rawQuery);
  if (!q) return 0;
  const name = normalizeSearchText(p.name || '');
  const sku = normalizeSearchText(p.sku || '');
  const vsk = normalizeSearchText(p.variationSkusForSearch || '');
  const hay = `${name} ${sku} ${vsk}`;
  const tokens = q.split(/\s+/).filter(Boolean);

  let r = 0;
  if (sku === q) r = Math.max(r, 10_000);
  const eachVar = vsk.split(' ').filter(Boolean);
  if (eachVar.some((s) => s === q)) r = Math.max(r, 9_900);
  if (sku.startsWith(q)) r = Math.max(r, 8_000 + Math.min(q.length, 20));
  if (eachVar.some((s) => s.startsWith(q))) r = Math.max(r, 7_900 + Math.min(q.length, 20));
  if (sku.includes(q)) r = Math.max(r, 7_000);
  if (vsk.includes(q)) r = Math.max(r, 6_800);
  if (name.includes(q)) r = Math.max(r, 5_000);
  if (tokens.every((tok) => hay.includes(tok))) r = Math.max(r, 3_000);
  if (tokens.every((tok) => hay.includes(tok) || isSubsequence(hay, tok))) r = Math.max(r, 500);
  return r;
}

export const ProductLedger = () => {
  const { companyId } = useSupabase();
  const globalFilter = useGlobalFilterOptional();

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [variations, setVariations] = useState<VariationOption[]>([]);
  const [selectedVariationId, setSelectedVariationId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]);
  const [summary, setSummary] = useState<ProductSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [standaloneStartYmd, setStandaloneStartYmd] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [standaloneEndYmd, setStandaloneEndYmd] = useState(() => new Date().toISOString().slice(0, 10));

  const rangeStartYmd = useMemo(() => {
    if (globalFilter?.startDate) return toYyyyMmDd(globalFilter.startDate) || standaloneStartYmd;
    return standaloneStartYmd;
  }, [globalFilter?.startDate, standaloneStartYmd]);

  const rangeEndYmd = useMemo(() => {
    if (globalFilter?.endDate) return toYyyyMmDd(globalFilter.endDate) || standaloneEndYmd;
    return standaloneEndYmd;
  }, [globalFilter?.endDate, standaloneEndYmd]);

  const calendarRangeValue = useMemo(() => {
    if (globalFilter?.startDateObj && globalFilter?.endDateObj) {
      return { from: globalFilter.startDateObj, to: globalFilter.endDateObj };
    }
    const from = new Date(`${standaloneStartYmd}T12:00:00`);
    const to = new Date(`${standaloneEndYmd}T12:00:00`);
    return { from, to };
  }, [
    globalFilter?.startDateObj,
    globalFilter?.endDateObj,
    standaloneStartYmd,
    standaloneEndYmd,
  ]);

  const dateRangeButtonLabel = useMemo(() => {
    const fmt = (ymd: string) => {
      const d = new Date(`${ymd}T12:00:00`);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    return `${fmt(rangeStartYmd)} — ${fmt(rangeEndYmd)}`;
  }, [rangeStartYmd, rangeEndYmd]);

  // Load products + variation SKUs (many catalogs store SKU only on product_variations)
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setProductsLoading(true);

    (async () => {
      const selectWithCategory =
        'id, name, sku, category_id, cost_price, retail_price, has_variations, category:product_categories(name)';
      const selectMinimal =
        'id, name, sku, category_id, cost_price, retail_price, has_variations';

      let raw: any[] | null = null;
      let err = null as { message?: string } | null;

      const q1 = await supabase
        .from('products')
        .select(selectWithCategory)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');

      if (q1.error) {
        const q2 = await supabase
          .from('products')
          .select(selectMinimal)
          .eq('company_id', companyId)
          .eq('is_active', true)
          .order('name');
        raw = q2.data as any[] | null;
        err = q2.error;
      } else {
        raw = q1.data as any[] | null;
      }

      if (cancelled) return;
      if (err) {
        console.error('[ProductLedger] products load:', err);
        setProducts([]);
        setProductsLoading(false);
        return;
      }

      const base: ProductOption[] = (raw || []).map((row: any) => ({
        id: String(row.id),
        name: row.name ?? '',
        sku: row.sku ?? '',
        category: typeof row.category === 'object' && row.category?.name ? String(row.category.name) : '',
        cost_price: row.cost_price,
        retail_price: row.retail_price,
        has_variations: !!row.has_variations,
      }));
      // All product ids: SKUs often live on product_variations even if has_variations is wrong/missing
      const allProductIds = base.map((p) => p.id);
      const skuByProduct = new Map<string, string[]>();

      const chunk = 120;
      for (let i = 0; i < allProductIds.length; i += chunk) {
        const slice = allProductIds.slice(i, i + chunk);
        if (slice.length === 0) continue;

        let res = await supabase
          .from('product_variations')
          .select('product_id, sku')
          .in('product_id', slice)
          .eq('is_active', true);

        if (res.error) {
          res = await supabase.from('product_variations').select('product_id, sku').in('product_id', slice);
        }

        if (res.error) {
          console.warn('[ProductLedger] variation SKUs batch:', res.error);
          continue;
        }

        for (const row of res.data || []) {
          const pid = String((row as any).product_id);
          const s = String((row as any).sku || '').trim();
          if (!s) continue;
          const arr = skuByProduct.get(pid) || [];
          arr.push(s);
          skuByProduct.set(pid, arr);
        }
      }

      if (cancelled) return;

      const enriched: ProductOption[] = base.map((p) => {
        const extra = skuByProduct.get(p.id);
        return {
          ...p,
          variationSkusForSearch: extra?.length ? extra.join(' ') : '',
        };
      });

      setProducts(enriched);
      setProductsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  // Load variations when product selected
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
        const vars = (data || []).map((v: any) => ({
          id: v.id,
          sku: v.sku || '',
          attributes: v.attributes,
          label: v.attributes
            ? Object.values(v.attributes).join(' / ')
            : v.sku || v.id.slice(0, 8),
        }));
        setVariations(vars);
      });
  }, [selectedProductId, products]);

  // Load ledger data
  const loadLedger = useCallback(async () => {
    if (!companyId || !selectedProductId) return;
    setLoading(true);

    try {
      const rows: LedgerRow[] = [];

      // 1. Fetch purchases for this product
      const { data: purchaseItems } = await supabase
        .from('purchase_items')
        .select('purchase_id, quantity, unit_price, total, variation_id')
        .eq('product_id', selectedProductId);
      const purchaseIds = [...new Set((purchaseItems || []).map((pi: any) => pi.purchase_id))];

      let purchaseMap = new Map<string, any>();
      if (purchaseIds.length > 0) {
        const { data: purchases } = await supabase
          .from('purchases')
          .select('id, po_no, po_date, supplier_name, status')
          .eq('company_id', companyId)
          .in('id', purchaseIds)
          .in('status', ['final', 'received', 'ordered']);
        for (const p of (purchases || []) as any[]) purchaseMap.set(p.id, p);
      }

      for (const pi of (purchaseItems || []) as any[]) {
        if (selectedVariationId && pi.variation_id !== selectedVariationId) continue;
        const pur = purchaseMap.get(pi.purchase_id);
        if (!pur) continue;
        const purDate = pur.po_date || '';
        if (purDate < rangeStartYmd || purDate > rangeEndYmd) continue;
        rows.push({
          id: `pur-${pi.purchase_id}-${pi.variation_id || 'main'}`,
          date: purDate,
          type: 'Purchase',
          party: pur.supplier_name || 'Supplier',
          qty: Number(pi.quantity) || 0,
          unitPrice: Number(pi.unit_price) || 0,
          lineTotal: Number(pi.total) || (Number(pi.quantity) * Number(pi.unit_price)),
          profit: 0,
          balance: 0,
          reference: pur.po_no || '',
        });
      }

      // 2. Fetch sales for this product
      const { data: saleItems } = await supabase
        .from('sales_items')
        .select('sale_id, quantity, unit_price, total, variation_id')
        .eq('product_id', selectedProductId);
      const saleIds = [...new Set((saleItems || []).map((si: any) => si.sale_id))];

      let saleMap = new Map<string, any>();
      if (saleIds.length > 0) {
        const { data: sales } = await supabase
          .from('sales')
          .select('id, invoice_no, invoice_date, customer_name, status')
          .eq('company_id', companyId)
          .in('id', saleIds)
          .eq('status', 'final');
        for (const s of (sales || []) as any[]) saleMap.set(s.id, s);
      }

      // Get avg purchase cost for profit calculation
      let avgCost = 0;
      const purchaseRows = rows.filter(r => r.type === 'Purchase');
      if (purchaseRows.length > 0) {
        const totalPurQty = purchaseRows.reduce((s, r) => s + r.qty, 0);
        const totalPurAmt = purchaseRows.reduce((s, r) => s + r.lineTotal, 0);
        avgCost = totalPurQty > 0 ? totalPurAmt / totalPurQty : 0;
      }
      // Fallback to product cost_price
      if (avgCost === 0) {
        const prod = products.find(p => p.id === selectedProductId);
        avgCost = prod?.cost_price || 0;
      }

      for (const si of (saleItems || []) as any[]) {
        if (selectedVariationId && si.variation_id !== selectedVariationId) continue;
        const sale = saleMap.get(si.sale_id);
        if (!sale) continue;
        const saleDate = sale.invoice_date || '';
        if (saleDate < rangeStartYmd || saleDate > rangeEndYmd) continue;
        const qty = Number(si.quantity) || 0;
        const saleUnitPrice = Number(si.unit_price) || 0;
        const saleTotal = Number(si.total) || (qty * saleUnitPrice);
        const costForQty = qty * avgCost;
        rows.push({
          id: `sale-${si.sale_id}-${si.variation_id || 'main'}`,
          date: saleDate,
          type: 'Sale',
          party: sale.customer_name || 'Walk-in',
          qty: -qty,
          unitPrice: saleUnitPrice,
          lineTotal: saleTotal,
          profit: Math.round((saleTotal - costForQty) * 100) / 100,
          balance: 0,
          reference: sale.invoice_no || '',
        });
      }

      // 3. Fetch sale returns
      const { data: saleReturnItems } = await supabase
        .from('sale_return_items')
        .select('sale_return_id, quantity, unit_price, total, variation_id, product_id')
        .eq('product_id', selectedProductId);
      if (saleReturnItems && saleReturnItems.length > 0) {
        const returnIds = [...new Set(saleReturnItems.map((ri: any) => ri.sale_return_id))];
        const { data: returns } = await supabase
          .from('sale_returns')
          .select('id, return_no, return_date, status, original_sale_id')
          .in('id', returnIds)
          .eq('company_id', companyId)
          .eq('status', 'final');
        const returnMap = new Map<string, any>();
        for (const r of (returns || []) as any[]) returnMap.set(r.id, r);

        for (const ri of (saleReturnItems || []) as any[]) {
          if (selectedVariationId && ri.variation_id !== selectedVariationId) continue;
          const ret = returnMap.get(ri.sale_return_id);
          if (!ret) continue;
          const retDate = ret.return_date || '';
          if (retDate < rangeStartYmd || retDate > rangeEndYmd) continue;
          const qty = Number(ri.quantity) || 0;
          rows.push({
            id: `sret-${ri.sale_return_id}-${ri.variation_id || 'main'}`,
            date: retDate,
            type: 'Sale Return',
            party: ret.return_no || 'Return',
            qty: qty,
            unitPrice: Number(ri.unit_price) || 0,
            lineTotal: Number(ri.total) || 0,
            profit: -(qty * avgCost),
            balance: 0,
            reference: ret.return_no || '',
          });
        }
      }

      // 4. Fetch stock adjustments (non-sale, non-purchase movements)
      let movQuery = supabase
        .from('stock_movements')
        .select('id, quantity, unit_cost, total_cost, movement_type, reference_type, notes, created_at')
        .eq('company_id', companyId)
        .eq('product_id', selectedProductId)
        .in('movement_type', ['adjustment', 'opening_stock', 'transfer']);
      if (selectedVariationId) movQuery = movQuery.eq('variation_id', selectedVariationId);
      const { data: adjMovements } = await movQuery;

      for (const m of (adjMovements || []) as any[]) {
        const mDate = (m.created_at || '').slice(0, 10);
        if (mDate < rangeStartYmd || mDate > rangeEndYmd) continue;
        const mType = m.movement_type === 'opening_stock' ? 'Opening' : 'Adjustment';
        rows.push({
          id: `mov-${m.id}`,
          date: mDate,
          type: mType as any,
          party: m.notes || m.movement_type,
          qty: Number(m.quantity) || 0,
          unitPrice: Number(m.unit_cost) || 0,
          lineTotal: Number(m.total_cost) || 0,
          profit: 0,
          balance: 0,
          reference: m.reference_type || '',
        });
      }

      // Sort by date
      rows.sort((a, b) => a.date.localeCompare(b.date));

      // Calculate running balance
      let runningBalance = 0;
      for (const row of rows) {
        runningBalance += row.qty;
        row.balance = runningBalance;
      }

      // Calculate summary
      const purchaseTxns = rows.filter(r => r.type === 'Purchase');
      const saleTxns = rows.filter(r => r.type === 'Sale');
      const totalPurchaseQty = purchaseTxns.reduce((s, r) => s + r.qty, 0);
      const totalPurchaseAmount = purchaseTxns.reduce((s, r) => s + r.lineTotal, 0);
      const totalSaleQty = Math.abs(saleTxns.reduce((s, r) => s + r.qty, 0));
      const totalSaleAmount = saleTxns.reduce((s, r) => s + r.lineTotal, 0);
      const totalProfit = saleTxns.reduce((s, r) => s + r.profit, 0);

      setSummary({
        currentStock: runningBalance,
        avgPurchaseCost: totalPurchaseQty > 0 ? Math.round(totalPurchaseAmount / totalPurchaseQty) : 0,
        avgSalePrice: totalSaleQty > 0 ? Math.round(totalSaleAmount / totalSaleQty) : 0,
        totalPurchaseQty,
        totalPurchaseAmount: Math.round(totalPurchaseAmount),
        totalSaleQty,
        totalSaleAmount: Math.round(totalSaleAmount),
        totalProfit: Math.round(totalProfit),
      });

      setLedgerRows(rows);
    } catch (err: any) {
      console.error('[ProductLedger] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedProductId, selectedVariationId, rangeStartYmd, rangeEndYmd, products]);

  useEffect(() => {
    if (selectedProductId) loadLedger();
  }, [selectedProductId, selectedVariationId, loadLedger]);

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const selectedVariation = variations.find(v => v.id === selectedVariationId);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products.slice(0, 50);
    const q = searchQuery.trim();
    const ranked = products
      .map((p) => ({ p, rank: productSearchRank(p, q) }))
      .filter(({ rank }) => rank > 0)
      .sort((a, b) => b.rank - a.rank)
      .map(({ p }) => p);
    if (ranked.length > 0) return ranked.slice(0, 80);
    return products
      .filter((p) =>
        productMatchesSearch(p.name, p.sku || '', p.variationSkusForSearch || '', q)
      )
      .slice(0, 80);
  }, [products, searchQuery]);

  const clearProductSelection = useCallback(() => {
    setSelectedProductId('');
    setSearchQuery('');
    setLedgerRows([]);
    setSummary(null);
    setShowDropdown(true);
  }, []);

  const onDateRangeChange = useCallback(
    (range: { from?: Date; to?: Date }) => {
      const from = range.from;
      const to = range.to;
      if (!from || !to) return;
      if (globalFilter) {
        globalFilter.setCustomDateRange(from, to);
      } else {
        setStandaloneStartYmd(toYyyyMmDd(from.toISOString()) || standaloneStartYmd);
        setStandaloneEndYmd(toYyyyMmDd(to.toISOString()) || standaloneEndYmd);
      }
    },
    [globalFilter, standaloneStartYmd, standaloneEndYmd]
  );

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'Purchase':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20"><ArrowDownRight size={12} /> Purchase</span>;
      case 'Sale':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20"><ArrowUpRight size={12} /> Sale</span>;
      case 'Sale Return':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20"><CornerUpLeft size={12} /> Return</span>;
      case 'Adjustment':
      case 'Opening':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20"><RefreshCw size={12} /> {type}</span>;
      default:
        return <span className="text-gray-400">{type}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
      <ReportActions title="Product Ledger (Item History)" />

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-gray-900/50 p-4 rounded-xl border border-gray-800">
        <div className="flex-1 relative">
          <label className="text-xs text-gray-500 mb-1 block">Select Product</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              placeholder={
                productsLoading
                  ? 'Loading products...'
                  : selectedProduct
                    ? 'Search another product by name or SKU...'
                    : 'Search product by name or SKU...'
              }
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (selectedProductId) {
                  setSelectedProductId('');
                  setLedgerRows([]);
                  setSummary(null);
                }
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              className={cn('pl-10 bg-gray-950 border-gray-700 text-white h-10', selectedProductId && 'pr-16')}
            />
            {selectedProductId && (
              <button
                type="button"
                onClick={clearProductSelection}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs"
              >
                Clear
              </button>
            )}
          </div>
          {selectedProduct && !searchQuery.trim() && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-400">
              <span className="text-gray-500">Selected:</span>
              <span className="text-white font-medium">{selectedProduct.name}</span>
              <span className="font-mono text-gray-500">{selectedProduct.sku}</span>
            </div>
          )}
          {showDropdown && !selectedProductId && (
            <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-gray-900 border border-gray-700 rounded-lg shadow-xl">
              {filteredProducts.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500">
                  {searchQuery.trim() ? 'No products match your search' : 'No products'}
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const varParts = (p.variationSkusForSearch || '').trim().split(/\s+/).filter(Boolean);
                  const skuPreview =
                    (p.sku || '').trim() ||
                    (varParts.length
                      ? `${varParts.slice(0, 2).join(' · ')}${varParts.length > 2 ? ' · …' : ''}`
                      : '—');
                  return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedProductId(p.id);
                      setSearchQuery('');
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-800 transition-colors flex items-center gap-3"
                  >
                    <Package className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    <div>
                      <div className="text-sm text-white">{p.name}</div>
                      <div className="text-xs text-gray-500 font-mono">
                        {skuPreview}
                        {p.category ? ` • ${p.category}` : ''}
                      </div>
                    </div>
                  </button>
                )})
              )}
            </div>
          )}
        </div>

        {/* Variation filter */}
        {variations.length > 0 && (
          <div className="w-full md:w-[220px]">
            <label className="text-xs text-gray-500 mb-1 block">Variation</label>
            <select
              value={selectedVariationId}
              onChange={e => setSelectedVariationId(e.target.value)}
              className="w-full h-10 bg-gray-950 border border-gray-700 rounded-md text-white text-sm px-3"
            >
              <option value="">All Variations</option>
              {variations.map(v => (
                <option key={v.id} value={v.id}>{v.label} ({v.sku})</option>
              ))}
            </select>
          </div>
        )}

        <div className="w-full md:w-[280px]">
          <label className="text-xs text-gray-500 mb-1 block">Date Range</label>
          <CalendarDateRangePicker
            key={`${rangeStartYmd}-${rangeEndYmd}`}
            value={calendarRangeValue}
            onChange={onDateRangeChange}
            placeholder={dateRangeButtonLabel}
          />
        </div>
      </div>

      {!selectedProductId && (
        <div className="text-center py-16 text-gray-500">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg">Product select karein ledger dekhne ke liye</p>
          <p className="text-sm mt-1">Search box mein product ka naam ya SKU type karein</p>
        </div>
      )}

      {loading && (
        <div className="text-center py-16">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-400" />
          <p className="text-gray-500 mt-2">Loading product ledger...</p>
        </div>
      )}

      {selectedProduct && summary && !loading && (
        <>
          {/* Header Card */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 border border-gray-700 p-6 rounded-xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white">{selectedProduct.name}</h2>
                <p className="text-gray-400 font-mono text-sm mt-1">
                  {selectedProduct.sku}
                  {selectedProduct.category ? ` • ${selectedProduct.category}` : ''}
                  {selectedVariation ? ` • ${selectedVariation.label}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-6 flex-wrap">
                <div className="text-right">
                  <p className="text-gray-400 text-xs uppercase tracking-wider">Current Stock</p>
                  <p className="text-3xl font-bold text-white">{summary.currentStock}</p>
                </div>
                <div className="h-10 w-px bg-gray-700 hidden md:block" />
                <div className="text-right">
                  <p className="text-gray-400 text-xs uppercase tracking-wider">Avg Cost</p>
                  <p className="text-xl font-bold text-white">Rs {summary.avgPurchaseCost.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-xs uppercase tracking-wider">Avg Sale</p>
                  <p className="text-xl font-bold text-green-400">Rs {summary.avgSalePrice.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 pt-4 border-t border-gray-700">
              <div className="bg-gray-950/50 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase">Purchase Qty</p>
                <p className="text-lg font-bold text-green-400">{summary.totalPurchaseQty}</p>
              </div>
              <div className="bg-gray-950/50 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase">Purchase Amount</p>
                <p className="text-lg font-bold text-green-400">Rs {summary.totalPurchaseAmount.toLocaleString()}</p>
              </div>
              <div className="bg-gray-950/50 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase">Sale Qty</p>
                <p className="text-lg font-bold text-red-400">{summary.totalSaleQty}</p>
              </div>
              <div className="bg-gray-950/50 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase">Sale Amount</p>
                <p className="text-lg font-bold text-red-400">Rs {summary.totalSaleAmount.toLocaleString()}</p>
              </div>
              <div className="bg-gray-950/50 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase">Total Profit</p>
                <p className={cn("text-lg font-bold", summary.totalProfit >= 0 ? "text-emerald-400" : "text-red-400")}>
                  Rs {summary.totalProfit.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-950/80 text-gray-400 font-medium border-b border-gray-800">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Party / Reference</th>
                    <th className="px-4 py-3 text-center">Qty</th>
                    <th className="px-4 py-3 text-right">Unit Price</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Profit</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {ledgerRows.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-gray-500">No transactions found in this date range</td></tr>
                  )}
                  {ledgerRows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap text-xs">{row.date}</td>
                      <td className="px-4 py-3">{getTypeBadge(row.type)}</td>
                      <td className="px-4 py-3">
                        <div className="text-white font-medium text-sm">{row.party}</div>
                        {row.reference && <div className="text-[10px] text-gray-500 font-mono">{row.reference}</div>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn("font-mono font-bold", row.qty > 0 ? "text-green-500" : "text-red-500")}>
                          {row.qty > 0 ? '+' : ''}{row.qty}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300 font-mono text-xs">
                        Rs {row.unitPrice.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-white font-mono text-xs">
                        Rs {row.lineTotal.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {row.profit !== 0 ? (
                          <span className={row.profit > 0 ? "text-green-500 font-bold" : "text-red-400 font-bold"}>
                            {row.profit > 0 ? '+' : ''}Rs {Math.abs(row.profit).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-white font-bold font-mono bg-gray-900/30">
                        {row.balance}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {ledgerRows.length > 0 && (
              <div className="px-4 py-2 border-t border-gray-800 text-xs text-gray-500">
                {ledgerRows.length} transactions • {rangeStartYmd} to {rangeEndYmd}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
