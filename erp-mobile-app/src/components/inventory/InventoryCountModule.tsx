/**
 * Physical Stock Count — Capacitor UI over the same stock_count_* RPCs as web.
 * Does not duplicate posting math; uses stockCountApi + shared pure libs.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ClipboardList,
  History,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  Search,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import type { User, Branch } from '../../types';
import { usePermissions } from '../../context/PermissionContext';
import { getBranches } from '../../api/branches';
import {
  stockCountApi,
  type StockCountLine,
  type StockCountSearchHit,
  type StockCountSession,
} from '../../api/stockCount';
import { formatQty } from '../../utils/quantity';
import { ProductImage } from '../products/ProductImage';
import { canPostInventoryCount } from '../../utils/permissionModules';
import { itemKindLabel } from '@/app/lib/stockCountDisplay';
import { groupLinesByProductVariation } from '@/app/lib/stockCountGrouping';
import {
  createPreviewStore,
  STOCK_COUNT_PREVIEW_BANNER,
  type PreviewStore,
} from '@/app/lib/stockCountPreviewStore';
import { countRowPresentation } from '@/app/lib/stockCountRowPresentation';

const ALL_BRANCHES_SCOPE = '__all_branches__';
const TOUCH = 'min-h-11 touch-manipulation';

interface InventoryCountModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branch: Branch | null;
}

type LineFilter = 'all' | 'counted' | 'uncounted' | 'variance';

export function InventoryCountModule({
  onBack,
  companyId,
  branch,
}: InventoryCountModuleProps) {
  const { hasPermission, branchIds, isAdminOrOwner } = usePermissions();
  const canPost = canPostInventoryCount(hasPermission);

  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedBranchId, setSelectedBranchId] = useState(branch?.id || '');
  const [session, setSession] = useState<StockCountSession | null>(null);
  const [lines, setLines] = useState<StockCountLine[]>([]);
  const [sessions, setSessions] = useState<StockCountSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [hits, setHits] = useState<StockCountSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [filter, setFilter] = useState<LineFilter>('all');
  const [setQtyDraft, setSetQtyDraft] = useState<Record<string, string>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [historyText, setHistoryText] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewStore, setPreviewStore] = useState<PreviewStore | null>(null);
  const [postConfirm, setPostConfirm] = useState(false);

  const accessibleBranchIds = useMemo(() => {
    if (isAdminOrOwner || !branchIds.length) return branches.map((b) => b.id);
    return branches.map((b) => b.id).filter((id) => branchIds.includes(id));
  }, [branches, branchIds, isAdminOrOwner]);

  const isAllBranches =
    selectedBranchId === ALL_BRANCHES_SCOPE ||
    stockCountApi.isAllBranchesSession(session);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    void getBranches(companyId).then(({ data }) => {
      if (cancelled) return;
      const list = (data || [])
        .filter((b) => b?.id && b.id !== 'all')
        .map((b) => ({ id: b.id, name: b.name || b.id }));
      setBranches(list);
      setSelectedBranchId((prev: string) => prev || branch?.id || list[0]?.id || '');
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, branch?.id]);

  const refreshSessions = useCallback(async () => {
    if (!companyId || previewMode) return;
    try {
      const list = await stockCountApi.listSessions({
        branchId: selectedBranchId === ALL_BRANCHES_SCOPE ? null : selectedBranchId || null,
      });
      setSessions(
        selectedBranchId === ALL_BRANCHES_SCOPE
          ? list.filter((s) => stockCountApi.isAllBranchesSession(s))
          : list.filter((s) => !stockCountApi.isAllBranchesSession(s))
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to list sessions');
    }
  }, [companyId, selectedBranchId, previewMode]);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  const openSession = async (sessionId: string) => {
    setLoading(true);
    setError(null);
    try {
      const payload = await stockCountApi.getSession(sessionId);
      setSession(payload.session);
      setLines(payload.lines);
      setPreviewMode(false);
      setPreviewStore(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to open session');
    } finally {
      setLoading(false);
    }
  };

  const startNew = async () => {
    if (!companyId) return;
    setBusy(true);
    setError(null);
    try {
      const all = selectedBranchId === ALL_BRANCHES_SCOPE;
      const created = await stockCountApi.createSession(
        all ? null : selectedBranchId,
        undefined,
        all
      );
      await openSession(created.id);
      await refreshSessions();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create session');
    } finally {
      setBusy(false);
    }
  };

  const mapPreviewLines = (store: PreviewStore): StockCountLine[] =>
    store.lines.map((l) => ({
      id: l.id,
      company_id: companyId || '',
      session_id: store.session.id,
      branch_id: l.branch_id,
      product_id: l.product_id,
      variation_id: l.variation_id,
      system_qty_baseline: l.system_qty_baseline,
      baseline_at: l.baseline_at,
      current_system_qty: l.current_system_qty,
      physical_qty: l.physical_qty,
      active_pass_number: l.active_pass_number,
      variance: l.difference,
      count_status: l.count_status,
      difference: l.difference,
      product_name: l.product_name,
      product_sku: l.product_sku,
      variation_sku: l.variation_sku,
      variation_label: l.variation_label,
      item_kind: l.item_kind,
      image_url: l.image_url,
      baseline_drifted:
        Math.abs(Number(l.current_system_qty) - Number(l.system_qty_baseline)) > 0.0000001,
      movement_since_baseline: Number(l.current_system_qty) - Number(l.system_qty_baseline),
    }));

  const startPreview = () => {
    const store = createPreviewStore('baseline3_current8');
    setPreviewMode(true);
    setPreviewStore(store);
    setSession({
      id: store.session.id,
      company_id: companyId || '',
      branch_id: store.session.branch_id,
      scope_type: store.session.scope_type,
      status: store.session.status,
      notes: store.session.notes,
    });
    setLines(mapPreviewLines(store));
    setError(null);
  };

  const syncPreviewLines = (store: PreviewStore) => {
    setPreviewStore(store);
    setLines(mapPreviewLines(store));
  };

  const runSearch = async () => {
    if (!companyId || !search.trim()) {
      setHits([]);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const scopeIds =
        isAllBranches || selectedBranchId === ALL_BRANCHES_SCOPE
          ? accessibleBranchIds
          : [session?.branch_id || selectedBranchId].filter(Boolean);
      const results = await stockCountApi.searchCatalog(
        companyId,
        scopeIds[0] || null,
        search.trim(),
        25,
        {
          allBranches: isAllBranches || selectedBranchId === ALL_BRANCHES_SCOPE,
          branchIds: scopeIds,
        }
      );
      setHits(results);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Search failed');
      setHits([]);
    } finally {
      setSearching(false);
    }
  };

  const addHit = async (hit: StockCountSearchHit) => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      if (previewMode) {
        setError('Preview uses the fixture line only — exit preview to add catalog products.');
        return;
      }
      await stockCountApi.addLine(session.id, hit.product_id, hit.variation_id);
      const refreshed = await stockCountApi.getSession(session.id);
      setLines(refreshed.lines);
      setSession(refreshed.session);
      setHits([]);
      setSearch('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add line');
    } finally {
      setBusy(false);
    }
  };

  const applyEvent = async (
    line: StockCountLine,
    eventType: 'increment' | 'decrement' | 'set' | 'confirm_zero' | 'start_recount',
    value?: number | null
  ) => {
    setBusy(true);
    setError(null);
    try {
      if (previewMode && previewStore) {
        previewStore.applyEvent(line.id, eventType, value ?? undefined);
        syncPreviewLines(previewStore);
      } else {
        await stockCountApi.applyEvent(line.id, eventType, value ?? null);
        const refreshed = await stockCountApi.getSession(session!.id);
        setLines(refreshed.lines);
        setSession(refreshed.session);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const showHistory = async (line: StockCountLine) => {
    if (!companyId) return;
    if (previewMode) {
      setHistoryText(
        'Preview history: baseline 3 → purchases +5 → current 8. No live stock_movements.'
      );
      return;
    }
    setBusy(true);
    try {
      const hist = await stockCountApi.getLineHistory({
        companyId,
        branchId: line.branch_id || session?.branch_id,
        branchIds: isAllBranches ? accessibleBranchIds : undefined,
        productId: line.product_id,
        variationId: line.variation_id,
        baselineAt: line.baseline_at,
        countBaseline: line.system_qty_baseline,
      });
      const parts = [
        `Current Stock: ${formatQty(hist.system_qty)}`,
        `Count Baseline: ${formatQty(line.system_qty_baseline)}`,
        `Movements shown: ${hist.movements.length}`,
        `Since baseline: ${hist.movementsSinceBaseline.length}`,
      ];
      setHistoryText(parts.join('\n'));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'History failed');
    } finally {
      setBusy(false);
    }
  };

  const doPost = async () => {
    if (!session || (!canPost && !previewMode)) return;
    setBusy(true);
    setError(null);
    try {
      if (previewMode) {
        setHistoryText('Preview post blocked — no stock movements created.');
        setPostConfirm(false);
        return;
      }
      await stockCountApi.completeSession(session.id, true);
      const result = await stockCountApi.postSession(session.id, crypto.randomUUID(), true);
      setSession(result.session);
      setPostConfirm(false);
      setHistoryText(
        `Posted ${result.posted_movements} movement(s). Zero-variance: ${result.zero_variance}.`
      );
      const refreshed = await stockCountApi.getSession(session.id);
      setLines(refreshed.lines);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Post failed');
    } finally {
      setBusy(false);
    }
  };

  const partition = stockCountApi.partitionLines(lines);
  const filtered = useMemo(() => {
    if (filter === 'counted') return partition.counted;
    if (filter === 'uncounted') return partition.uncounted;
    if (filter === 'variance') return partition.variance;
    return lines;
  }, [filter, lines, partition.counted, partition.uncounted, partition.variance]);

  const grouped = useMemo(
    () => (isAllBranches ? groupLinesByProductVariation(filtered) : null),
    [filtered, isAllBranches]
  );

  const locked = session?.status === 'posted' || session?.status === 'cancelled';

  const renderLineCard = (line: StockCountLine, nested = false) => {
    const pres = countRowPresentation({
      physicalQty: line.physical_qty,
      countStatus: line.count_status,
      baselineDrifted: line.baseline_drifted,
      currentSystemQty: line.current_system_qty,
      systemQtyBaseline: line.system_qty_baseline,
    });
    const branchName =
      branches.find((b) => b.id === line.branch_id)?.name || line.branch_id || '';
    return (
      <div
        key={line.id}
        className={`bg-[#1F2937] border border-[#374151] rounded-2xl p-4 ${nested ? 'ml-2' : ''}`}
      >
        <div className="flex gap-3">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#111827] shrink-0">
            <ProductImage src={line.image_url} alt="" variant="thumb" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-white font-medium truncate">{line.product_name || 'Product'}</p>
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-500/25 text-slate-300">
                {itemKindLabel(line.item_kind || (line.variation_id ? 'variation' : 'product'))}
              </span>
              {pres.showStockChangedBadge && (
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                  {pres.stockChangedBadgeLabel}
                </span>
              )}
            </div>
            <p className="text-xs text-[#9CA3AF] truncate">
              {line.variation_label || line.variation_sku || line.product_sku || '—'}
              {isAllBranches && branchName ? ` · ${branchName}` : ''}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] text-[#9CA3AF]">{pres.currentStockLabel}</p>
                <p className="text-sm font-semibold text-white">
                  {formatQty(line.current_system_qty ?? line.system_qty_baseline)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[#9CA3AF]">{pres.physicalLabel}</p>
                <p className="text-sm font-semibold text-[#14B8A6]">
                  {pres.physicalDisplayIsBlank ? '—' : formatQty(line.physical_qty)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[#9CA3AF]">{pres.differenceLabel}</p>
                <p className="text-sm font-semibold text-white">
                  {pres.showDifference ? formatQty(line.difference) : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
        {!locked && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void applyEvent(line, 'decrement')}
              className={`${TOUCH} w-11 rounded-xl bg-[#374151] text-white flex items-center justify-center`}
              aria-label="Minus one"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void applyEvent(line, 'increment')}
              className={`${TOUCH} w-11 rounded-xl bg-[#14B8A6] text-white flex items-center justify-center`}
              aria-label="Plus one"
            >
              <Plus className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1 flex-1 min-w-[8rem]">
              <input
                type="number"
                inputMode="decimal"
                className={`${TOUCH} flex-1 rounded-xl bg-[#111827] border border-[#374151] px-3 text-white text-sm`}
                placeholder="Set qty"
                value={setQtyDraft[line.id] ?? ''}
                onChange={(e) =>
                  setSetQtyDraft((d) => ({ ...d, [line.id]: e.target.value }))
                }
              />
              <button
                type="button"
                disabled={busy}
                className={`${TOUCH} px-3 rounded-xl bg-[#3B82F6] text-white text-sm font-medium`}
                onClick={() => {
                  const n = Number(setQtyDraft[line.id]);
                  if (!Number.isFinite(n) || n < 0) {
                    setError('Enter a non-negative quantity');
                    return;
                  }
                  void applyEvent(line, 'set', n);
                }}
              >
                Set
              </button>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void applyEvent(line, 'confirm_zero')}
              className={`${TOUCH} px-3 rounded-xl bg-[#374151] text-white text-sm`}
            >
              Count 0
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void applyEvent(line, 'start_recount')}
              className={`${TOUCH} w-11 rounded-xl bg-[#374151] text-white flex items-center justify-center`}
              aria-label="Recount"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void showHistory(line)}
              className={`${TOUCH} w-11 rounded-xl bg-[#374151] text-white flex items-center justify-center`}
              aria-label="History"
            >
              <History className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#111827] pb-36">
      <div className="flow-screen-header px-4 pb-3 border-b border-[#374151] bg-[#1F2937] sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className={`${TOUCH} w-11 rounded-xl bg-[#374151] flex items-center justify-center text-white`}
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-white flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-[#14B8A6]" />
              Stock Count
            </h1>
            <p className="text-xs text-[#9CA3AF] truncate">
              {previewMode
                ? 'Preview / Test'
                : session
                  ? `${session.status} · ${isAllBranches ? 'All Branches' : branches.find((b) => b.id === (session.branch_id || selectedBranchId))?.name || '—'}`
                  : 'Physical count & reconciliation'}
            </p>
          </div>
        </div>
      </div>

      {previewMode && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-900/40 border border-amber-500/40 text-amber-100 text-xs">
          {STOCK_COUNT_PREVIEW_BANNER}
        </div>
      )}

      {error && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-900/40 border border-rose-500/40 text-rose-100 text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!session && (
        <div className="p-4 space-y-4">
          <label className="block text-sm text-[#9CA3AF]">
            Count scope
            <select
              className={`${TOUCH} mt-1 w-full rounded-xl bg-[#1F2937] border border-[#374151] px-3 text-white`}
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
              <option value={ALL_BRANCHES_SCOPE}>All Branches</option>
            </select>
          </label>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={busy || !selectedBranchId}
              onClick={() => void startNew()}
              className={`${TOUCH} w-full rounded-xl bg-[#14B8A6] text-white font-semibold`}
            >
              {busy ? 'Starting…' : 'Start new count'}
            </button>
            <button
              type="button"
              onClick={startPreview}
              className={`${TOUCH} w-full rounded-xl bg-[#374151] text-white`}
            >
              Preview / Test (no stock write)
            </button>
          </div>
          <div>
            <h2 className="text-sm font-medium text-[#9CA3AF] mb-2">Recent sessions</h2>
            <div className="space-y-2">
              {sessions.length === 0 && (
                <p className="text-sm text-[#6B7280]">No sessions for this scope yet.</p>
              )}
              {sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => void openSession(s.id)}
                  className="w-full text-left p-3 rounded-xl bg-[#1F2937] border border-[#374151] text-white"
                >
                  <span className="text-sm font-medium capitalize">{s.status}</span>
                  <span className="text-xs text-[#9CA3AF] block">
                    {stockCountApi.isAllBranchesSession(s) ? 'All Branches' : s.branch_id}
                    {s.created_at ? ` · ${new Date(s.created_at).toLocaleString()}` : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {session && (
        <>
          <div className="p-4 space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-3.5 text-[#9CA3AF]" />
                <input
                  className={`${TOUCH} w-full pl-9 pr-3 rounded-xl bg-[#1F2937] border border-[#374151] text-white text-sm`}
                  placeholder="Search SKU, barcode, name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void runSearch();
                  }}
                  disabled={locked || previewMode}
                />
              </div>
              <button
                type="button"
                disabled={searching || locked || previewMode}
                onClick={() => void runSearch()}
                className={`${TOUCH} px-4 rounded-xl bg-[#3B82F6] text-white text-sm font-medium`}
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
              </button>
            </div>

            {hits.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {hits.map((h) => (
                  <button
                    key={`${h.product_id}-${h.variation_id || ''}`}
                    type="button"
                    disabled={busy}
                    onClick={() => void addHit(h)}
                    className="w-full text-left p-3 rounded-xl bg-[#111827] border border-[#374151] text-white"
                  >
                    <p className="text-sm font-medium truncate">{h.name}</p>
                    <p className="text-xs text-[#9CA3AF]">
                      {h.variation_label || h.variation_sku || h.sku || '—'} · Current{' '}
                      {formatQty(h.system_qty)}
                    </p>
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 overflow-x-auto pb-1">
              {(['all', 'uncounted', 'counted', 'variance'] as LineFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`${TOUCH} px-3 rounded-full text-xs font-medium shrink-0 ${
                    filter === f
                      ? 'bg-[#14B8A6] text-white'
                      : 'bg-[#1F2937] text-[#9CA3AF] border border-[#374151]'
                  }`}
                >
                  {f} (
                  {f === 'all'
                    ? lines.length
                    : f === 'uncounted'
                      ? partition.uncounted.length
                      : f === 'counted'
                        ? partition.counted.length
                        : partition.variance.length}
                  )
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#14B8A6]" />
              </div>
            ) : (
              <div className="space-y-3">
                {grouped
                  ? grouped.map((g) => {
                      const open = expandedGroups[g.key] ?? true;
                      const phys = g.physical;
                      const diff =
                        phys.partial || phys.confirmedCount === 0
                          ? null
                          : Number(phys.total) - Number(g.systemTotal);
                      return (
                        <div key={g.key} className="space-y-2">
                          <button
                            type="button"
                            className="w-full flex items-center justify-between p-3 rounded-xl bg-[#111827] border border-[#374151] text-white"
                            onClick={() =>
                              setExpandedGroups((m) => ({ ...m, [g.key]: !open }))
                            }
                          >
                            <span className="text-sm font-medium truncate">
                              {g.lines[0]?.product_name || g.product_id}
                            </span>
                            <span className="text-xs text-[#9CA3AF]">
                              Diff {diff == null ? '—' : formatQty(diff)} · {open ? '▾' : '▸'}
                            </span>
                          </button>
                          {open && g.lines.map((l) => renderLineCard(l, true))}
                        </div>
                      );
                    })
                  : filtered.map((l) => renderLineCard(l))}
                {filtered.length === 0 && (
                  <p className="text-center text-sm text-[#6B7280] py-8">
                    No lines yet — search and add products to count.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="fixed left-0 right-0 bottom-0 z-40 bg-[#1F2937] border-t border-[#374151] p-4 safe-area-bottom">
            <div className="flex items-center gap-3">
              <div className="flex-1 text-xs text-[#9CA3AF]">
                <p>
                  Counted {partition.counted.length}/{lines.length}
                </p>
                <p>Variance {partition.variance.length}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSession(null);
                  setLines([]);
                  setPreviewMode(false);
                  setPreviewStore(null);
                  void refreshSessions();
                }}
                className={`${TOUCH} px-3 rounded-xl bg-[#374151] text-white text-sm`}
              >
                Close
              </button>
              {(canPost || previewMode) && !locked && (
                <button
                  type="button"
                  disabled={busy || lines.length === 0}
                  onClick={() => setPostConfirm(true)}
                  className={`${TOUCH} px-4 rounded-xl bg-[#14B8A6] text-white font-semibold text-sm flex items-center gap-2`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Review & post
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {postConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#1F2937] rounded-2xl w-full max-w-md p-5 border border-[#374151]">
            <h3 className="text-white font-semibold text-lg mb-2">Confirm post</h3>
            <p className="text-sm text-[#9CA3AF] mb-4">
              {previewMode
                ? 'Preview mode never writes stock_movements.'
                : 'Posts variance adjustments only (physical − count baseline). Current Stock remains the live ledger.'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className={`${TOUCH} flex-1 rounded-xl bg-[#374151] text-white`}
                onClick={() => setPostConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                className={`${TOUCH} flex-1 rounded-xl bg-[#14B8A6] text-white font-semibold`}
                onClick={() => void doPost()}
              >
                {busy ? 'Posting…' : previewMode ? 'Simulate' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {historyText && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#1F2937] rounded-2xl w-full max-w-md p-5 border border-[#374151]">
            <h3 className="text-white font-semibold mb-2">History</h3>
            <pre className="text-sm text-[#D1D5DB] whitespace-pre-wrap mb-4">{historyText}</pre>
            <button
              type="button"
              className={`${TOUCH} w-full rounded-xl bg-[#374151] text-white`}
              onClick={() => setHistoryText(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
