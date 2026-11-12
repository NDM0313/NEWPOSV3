/**
 * Physical Stock Count — Capacitor UI over the same stock_count_* RPCs as web.
 * Does not duplicate posting math; uses stockCountApi + shared pure libs.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  X,
  ZoomIn,
  ZoomOut,
  Trash2,
  ListOrdered,
} from 'lucide-react';
import type { User, Branch } from '../../types';
import { usePermissions } from '../../context/PermissionContext';
import { getBranches } from '../../api/branches';
import {
  stockCountApi,
  type StockCountLine,
  type StockCountLineEvent,
  type StockCountSearchHit,
  type StockCountSession,
} from '../../api/stockCount';
import { formatQty } from '../../utils/quantity';
import { ProductImage } from '../products/ProductImage';
import { canPostInventoryCount } from '../../utils/permissionModules';
import { historyCategoryLabel, itemKindLabel } from '@/app/lib/stockCountDisplay';
import { groupLinesByProductVariation } from '@/app/lib/stockCountGrouping';
import {
  createPreviewStore,
  STOCK_COUNT_PREVIEW_BANNER,
  type PreviewStore,
} from '@/app/lib/stockCountPreviewStore';
import { countRowPresentation } from '@/app/lib/stockCountRowPresentation';
import {
  stockCountVarianceWarning,
  summarizeVarianceWarnings,
} from '@/app/lib/stockCountVarianceWarning';

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
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [hits, setHits] = useState<StockCountSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [pendingHit, setPendingHit] = useState<StockCountSearchHit | null>(null);
  const [dialogQty, setDialogQty] = useState(1);
  const [dialogQtyDraft, setDialogQtyDraft] = useState('1');
  const [imageZoomOpen, setImageZoomOpen] = useState(false);
  const [imageZoomScale, setImageZoomScale] = useState(1);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [filter, setFilter] = useState<LineFilter>('all');
  const [setQtyDraft, setSetQtyDraft] = useState<Record<string, string>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [countHistoryLine, setCountHistoryLine] = useState<StockCountLine | null>(null);
  const [countEvents, setCountEvents] = useState<StockCountLineEvent[]>([]);
  const [productHistoryLine, setProductHistoryLine] = useState<StockCountLine | null>(null);
  const [productHistoryRows, setProductHistoryRows] = useState<
    Array<{
      id?: string;
      created_at?: string;
      quantity?: number | null;
      category: string;
      running_balance: number;
      movement_type?: string | null;
      reference_type?: string | null;
    }>
  >([]);
  const [productHistorySystemQty, setProductHistorySystemQty] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewStore, setPreviewStore] = useState<PreviewStore | null>(null);
  const [postConfirm, setPostConfirm] = useState(false);
  const [approveConfirm, setApproveConfirm] = useState(false);
  const [cancelConfirmSession, setCancelConfirmSession] = useState<StockCountSession | null>(
    null
  );
  const [reverseConfirm, setReverseConfirm] = useState(false);
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  /** All-branches find: which branch line receives the increment. */
  const [findBranchId, setFindBranchId] = useState('');
  const [showArchivedSessions, setShowArchivedSessions] = useState(false);
  const [deleteConfirmLine, setDeleteConfirmLine] = useState<StockCountLine | null>(null);

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
        all,
        asOfDate || null
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

  const locked =
    session?.status === 'posted' ||
    session?.status === 'cancelled' ||
    session?.status === 'reversed' ||
    session?.status === 'awaiting_approval';
  const awaitingApproval = session?.status === 'awaiting_approval';

  /** Live type-ahead search — same 250ms debounce as web InventoryCountPage. */
  useEffect(() => {
    const q = search.trim();
    if (previewMode || locked || !session || !companyId || !q) {
      setHits([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const scopeIds =
            isAllBranches || selectedBranchId === ALL_BRANCHES_SCOPE
              ? accessibleBranchIds
              : [session.branch_id || selectedBranchId].filter(Boolean) as string[];
          if (scopeIds.length === 0) {
            if (!cancelled) setHits([]);
            return;
          }
          const results = await stockCountApi.searchCatalog(
            companyId,
            scopeIds[0] || null,
            q,
            25,
            {
              allBranches: isAllBranches || selectedBranchId === ALL_BRANCHES_SCOPE,
              branchIds: scopeIds,
            }
          );
          if (!cancelled) setHits(results);
        } catch (e: unknown) {
          if (!cancelled) {
            console.warn('[InventoryCount] search', e);
            setHits([]);
          }
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [
    search,
    companyId,
    session,
    locked,
    previewMode,
    isAllBranches,
    selectedBranchId,
    accessibleBranchIds,
  ]);

  /** Existing session lines for this catalog hit (same product/variation). */
  const existingLinesForHit = useMemo(() => {
    if (!pendingHit) return [] as StockCountLine[];
    return lines.filter(
      (l) =>
        l.product_id === pendingHit.product_id &&
        (l.variation_id ?? null) === (pendingHit.variation_id ?? null)
    );
  }, [lines, pendingHit]);

  const alreadyCountedTotal = useMemo(() => {
    const scoped =
      isAllBranches && findBranchId
        ? existingLinesForHit.filter((l) => l.branch_id === findBranchId)
        : existingLinesForHit;
    if (!scoped.length) return null as number | null;
    let sum = 0;
    let any = false;
    for (const l of scoped) {
      if (l.physical_qty != null && l.count_status !== 'uncounted') {
        sum += Number(l.physical_qty) || 0;
        any = true;
      }
    }
    return any ? sum : null;
  }, [existingLinesForHit, findBranchId, isAllBranches]);

  const openQtyDialog = (hit: StockCountSearchHit) => {
    if (previewMode) {
      setError('Preview uses the fixture line only — exit preview to add catalog products.');
      return;
    }
    setPendingHit(hit);
    setDialogQty(1);
    setDialogQtyDraft('1');
    setImageZoomOpen(false);
    setImageZoomScale(1);
    if (stockCountApi.isAllBranchesSession(session) || selectedBranchId === ALL_BRANCHES_SCOPE) {
      const existing = lines.find(
        (l) =>
          l.product_id === hit.product_id &&
          (l.variation_id ?? null) === (hit.variation_id ?? null) &&
          l.physical_qty != null
      );
      setFindBranchId(existing?.branch_id || accessibleBranchIds[0] || branches[0]?.id || '');
    } else {
      setFindBranchId(session?.branch_id || selectedBranchId || '');
    }
  };

  const closeQtyDialog = () => {
    setPendingHit(null);
    setFindBranchId('');
    setImageZoomOpen(false);
    setImageZoomScale(1);
  };

  const confirmAddWithQty = async () => {
    if (!session || !pendingHit) return;
    const fromDraft = Number(dialogQtyDraft);
    const qty = Number.isFinite(fromDraft) ? fromDraft : Number(dialogQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Enter how many pieces you found (greater than zero). Use Set with 0 on the row for confirmed zero.');
      return;
    }
    if (isAllBranches && !findBranchId) {
      setError('Select which branch this find belongs to.');
      return;
    }
    setDialogQty(qty);
    setBusy(true);
    setError(null);
    try {
      const added = await stockCountApi.addLine(
        session.id,
        pendingHit.product_id,
        pendingHit.variation_id
      );
      // All-branches: increment only the selected branch line (not every fan-out line).
      const target =
        isAllBranches
          ? added.find((l) => l.branch_id === findBranchId)
          : added[0];
      if (!target) {
        throw new Error('Could not find the count line for the selected branch.');
      }
      await stockCountApi.applyEvent(target.id, 'increment', qty);
      const refreshed = await stockCountApi.getSession(session.id);
      setLines(refreshed.lines);
      setSession(refreshed.session);
      setHits([]);
      setSearch('');
      closeQtyDialog();
      window.setTimeout(() => searchInputRef.current?.focus(), 50);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add line');
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteLine = async () => {
    if (!session || !deleteConfirmLine || locked) return;
    setBusy(true);
    setError(null);
    try {
      await stockCountApi.removeLine(deleteConfirmLine.id);
      const refreshed = await stockCountApi.getSession(session.id);
      setLines(refreshed.lines);
      setSession(refreshed.session);
      setDeleteConfirmLine(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to remove line');
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

  const formatCountEventWhen = (iso: string): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCountEventLabel = (ev: StockCountLineEvent): string => {
    const prior = ev.prior_qty;
    const next = ev.new_qty;
    if (ev.event_type === 'increment') {
      const delta =
        next != null ? next - (prior == null ? 0 : prior) : null;
      return delta != null ? `+${formatQty(delta)}` : 'Increment';
    }
    if (ev.event_type === 'decrement') {
      const delta =
        prior != null && next != null ? prior - next : null;
      return delta != null ? `−${formatQty(delta)}` : 'Decrement';
    }
    if (ev.event_type === 'confirm_zero') return 'Count 0';
    if (ev.event_type === 'set') return `Set ${formatQty(next)}`;
    if (ev.event_type === 'start_recount') return 'Recount (reset)';
    return ev.event_type;
  };

  const showCountHistory = async (line: StockCountLine) => {
    setBusy(true);
    setError(null);
    try {
      if (previewMode) {
        setCountHistoryLine(line);
        setCountEvents([
          {
            id: 'preview-1',
            event_type: 'increment',
            prior_qty: null,
            new_qty: 3,
            created_at: '2026-10-01T10:00:00.000Z',
            pass_number: 1,
            reason: null,
          },
          {
            id: 'preview-2',
            event_type: 'increment',
            prior_qty: 3,
            new_qty: 8,
            created_at: '2026-10-05T12:00:00.000Z',
            pass_number: 1,
            reason: null,
          },
        ]);
        return;
      }
      const events = await stockCountApi.listLineCountEvents(line.id);
      setCountHistoryLine(line);
      setCountEvents(events);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Count history failed');
    } finally {
      setBusy(false);
    }
  };

  /** Product stock ledger: sales, purchases, transfers, prior counts, etc. */
  const showProductHistory = async (line: StockCountLine) => {
    if (!companyId) return;
    setBusy(true);
    setError(null);
    try {
      if (previewMode) {
        setProductHistoryLine(line);
        setProductHistorySystemQty(8);
        setProductHistoryRows([
          {
            id: 'm1',
            created_at: '2026-09-01T00:00:00.000Z',
            quantity: 3,
            category: 'purchase',
            running_balance: 3,
            movement_type: 'purchase',
          },
          {
            id: 'm2',
            created_at: '2026-10-05T12:00:00.000Z',
            quantity: 5,
            category: 'purchase',
            running_balance: 8,
            movement_type: 'purchase',
          },
        ]);
        return;
      }
      const hist = await stockCountApi.getLineHistory({
        companyId,
        branchId: line.branch_id || session?.branch_id,
        branchIds: isAllBranches ? accessibleBranchIds : undefined,
        productId: line.product_id,
        variationId: line.variation_id,
        baselineAt: line.baseline_at,
        countBaseline: line.system_qty_baseline,
      });
      setProductHistoryLine(line);
      setProductHistorySystemQty(hist.system_qty);
      setProductHistoryRows(
        (hist.movements || []).slice(0, 80).map((m) => ({
          id: m.id,
          created_at: m.created_at,
          quantity: m.quantity,
          category: m.category,
          running_balance: m.running_balance,
          movement_type: m.movement_type,
          reference_type: m.reference_type,
        }))
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Product history failed');
    } finally {
      setBusy(false);
    }
  };

  const varianceSummary = useMemo(() => {
    const counted = lines.filter((l) => l.count_status !== 'uncounted');
    let overQty = 0;
    let shortQty = 0;
    let zero = 0;
    const rows = counted.map((l) => {
      const v = Number(
        l.variance ??
          (l.physical_qty == null ? 0 : Number(l.physical_qty) - Number(l.system_qty_baseline))
      );
      if (Math.abs(v) < 1e-9) zero += 1;
      else if (v > 0) overQty += v;
      else shortQty += Math.abs(v);
      return { line: l, variance: v, warn: stockCountVarianceWarning(l.physical_qty, l.system_qty_baseline) };
    });
    const warnSummary = summarizeVarianceWarnings(counted);
    return {
      counted: counted.length,
      over: overQty,
      short: shortQty,
      zero,
      rows,
      overLines: warnSummary.over,
      shortLines: warnSummary.short,
    };
  }, [lines]);

  /** Submit for approval — stock NOT updated yet. */
  const doSubmit = async () => {
    if (!session || (!canPost && !previewMode)) return;
    setBusy(true);
    setError(null);
    try {
      if (previewMode) {
        setError('Preview submit blocked — no stock movements created.');
        setPostConfirm(false);
        return;
      }
      await stockCountApi.completeSession(session.id, true);
      const result = await stockCountApi.postSession(session.id, crypto.randomUUID(), true);
      setSession(result.session);
      setPostConfirm(false);
      setNotice(
        `Submitted for approval. Over ${formatQty(result.qty_over ?? varianceSummary.over)} · Short ${formatQty(result.qty_short ?? varianceSummary.short)}. Stock not updated yet.`
      );
      const refreshed = await stockCountApi.getSession(session.id);
      setLines(refreshed.lines);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  };

  const doApprove = async () => {
    if (!session || (!canPost && !previewMode)) return;
    setBusy(true);
    setError(null);
    try {
      if (previewMode) {
        setError('Preview approve blocked — no stock movements created.');
        setApproveConfirm(false);
        return;
      }
      const result = await stockCountApi.approveSession(session.id, crypto.randomUUID());
      setSession(result.session);
      setApproveConfirm(false);
      setNotice(
        `Approved ${result.document_no || 'STK'} · ${result.posted_movements} movement(s). Stock updated as of ${result.session.as_of_date || '—'}.`
      );
      const refreshed = await stockCountApi.getSession(session.id);
      setLines(refreshed.lines);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setBusy(false);
    }
  };

  const doReject = async () => {
    if (!session || !canPost) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await stockCountApi.rejectSession(session.id);
      setSession(updated);
      setApproveConfirm(false);
      setNotice('Rejected — count reopened for edits.');
      const refreshed = await stockCountApi.getSession(session.id);
      setLines(refreshed.lines);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Reject failed');
    } finally {
      setBusy(false);
    }
  };

  const doCancelSession = async (target: StockCountSession) => {
    if (!stockCountApi.isCancellable(target)) return;
    setBusy(true);
    setError(null);
    try {
      await stockCountApi.cancelSession(target.id);
      setCancelConfirmSession(null);
      if (session?.id === target.id) {
        setSession(null);
        setLines([]);
      }
      setNotice('Session cancelled — removed from Recent (still in archive).');
      setShowArchivedSessions(false);
      await refreshSessions();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setBusy(false);
    }
  };

  const doReverseSession = async () => {
    if (!session || !stockCountApi.isReversible(session) || !canPost) return;
    setBusy(true);
    setError(null);
    try {
      const result = await stockCountApi.reverseSession(
        session.id,
        'Reversed from mobile stock count'
      );
      setSession(result.session);
      setReverseConfirm(false);
      setNotice(
        `Reversed ${result.document_no || 'STK'} · ${result.reversed_movements} opposite movement(s). Stock restored.`
      );
      await refreshSessions();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Reverse failed');
    } finally {
      setBusy(false);
    }
  };

  const printReview = () => {
    const asOf = session?.as_of_date || asOfDate || '—';
    const rowsHtml = varianceSummary.rows
      .map((r) => {
        const name = r.line.product_name || r.line.product_sku || r.line.product_id;
        const sku =
          r.line.variation_label || r.line.variation_sku || r.line.product_sku || '';
        return `<tr><td>${name}</td><td>${sku}</td><td>${formatQty(r.line.system_qty_baseline)}</td><td>${formatQty(r.line.physical_qty)}</td><td>${formatQty(r.variance)}</td></tr>`;
      })
      .join('');
    const w = window.open('', '_blank', 'noopener,noreferrer,width=800,height=900');
    if (!w) {
      setError('Allow pop-ups to print the count review.');
      return;
    }
    w.document.write(`<!doctype html><html><head><title>Stock Count Review</title>
      <style>body{font-family:sans-serif;padding:16px}table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #ccc;padding:6px;text-align:left}h1{font-size:18px}</style></head><body>
      <h1>Stock Count Review</h1>
      <p>As of: <b>${asOf}</b> · Status: ${session?.status || '—'} · Doc: ${session?.document_no || '(after approve)'}</p>
      <p>Counted ${varianceSummary.counted} · Over ${formatQty(varianceSummary.over)} · Short ${formatQty(varianceSummary.short)} · Zero ${varianceSummary.zero}</p>
      <table><thead><tr><th>Product</th><th>SKU</th><th>System (as-of)</th><th>Physical</th><th>Diff</th></tr></thead>
      <tbody>${rowsHtml}</tbody></table>
      <p style="margin-top:24px;font-size:11px;color:#666">Stock is updated only after final Approve.</p>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
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

  const renderLineCard = (line: StockCountLine, nested = false) => {
    const pres = countRowPresentation({
      physicalQty: line.physical_qty,
      countStatus: line.count_status,
      baselineDrifted: line.baseline_drifted,
      currentSystemQty: line.current_system_qty,
      systemQtyBaseline: line.system_qty_baseline,
      asOfDate: session?.as_of_date,
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
              {(() => {
                const vw = stockCountVarianceWarning(line.physical_qty, line.system_qty_baseline);
                if (!vw.badgeLabel) return null;
                return (
                  <span
                    className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${
                      vw.kind === 'over'
                        ? 'bg-amber-500/25 text-amber-200'
                        : 'bg-rose-500/25 text-rose-200'
                    }`}
                  >
                    {vw.badgeLabel}
                  </span>
                );
              })()}
            </div>
            <p className="text-xs text-[#9CA3AF] truncate">
              {line.variation_label || line.variation_sku || line.product_sku || '—'}
              {isAllBranches && branchName ? ` · ${branchName}` : ''}
            </p>
            <p className="text-[10px] text-[#6B7280] mt-1">
              {pres.systemAsOfLabel}: {formatQty(line.system_qty_baseline)}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] text-[#9CA3AF]">{pres.currentStockLabel}</p>
                <p className="text-sm font-semibold text-white">
                  {formatQty(line.current_system_qty ?? line.live_qty_at_capture ?? line.system_qty_baseline)}
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
                {(() => {
                  const vw = stockCountVarianceWarning(line.physical_qty, line.system_qty_baseline);
                  const tone =
                    !pres.showDifference
                      ? 'text-[#9CA3AF]'
                      : vw.diffTone === 'over'
                        ? 'text-amber-300'
                        : vw.diffTone === 'short'
                          ? 'text-rose-300'
                          : 'text-white';
                  return (
                    <p className={`text-sm font-semibold ${tone}`}>
                      {pres.showDifference ? formatQty(line.difference) : '—'}
                    </p>
                  );
                })()}
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
              onClick={() => void showCountHistory(line)}
              className={`${TOUCH} w-11 rounded-xl bg-[#374151] text-white flex items-center justify-center`}
              aria-label="Count history"
              title="Count history"
            >
              <ListOrdered className="w-4 h-4" />
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
              onClick={() => void showProductHistory(line)}
              className={`${TOUCH} w-11 rounded-xl bg-[#374151] text-white flex items-center justify-center`}
              aria-label="Product history"
              title="Product history (sale, purchase, stock)"
            >
              <History className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setDeleteConfirmLine(line)}
              className={`${TOUCH} w-11 rounded-xl bg-rose-900/50 text-rose-200 flex items-center justify-center`}
              aria-label="Delete from count"
            >
              <Trash2 className="w-4 h-4" />
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
                  ? `${session.status.replace(/_/g, ' ')}${session.document_no ? ` · ${session.document_no}` : ''} · as of ${session.as_of_date || '—'} · ${isAllBranches ? 'All Branches' : branches.find((b) => b.id === (session.branch_id || selectedBranchId))?.name || '—'}`
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
      {notice && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-emerald-900/40 border border-emerald-500/40 text-emerald-100 text-sm flex gap-2 justify-between">
          <span>{notice}</span>
          <button type="button" className="underline shrink-0" onClick={() => setNotice(null)}>
            Dismiss
          </button>
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
          <label className="block text-sm text-[#9CA3AF]">
            Count as-of date (closing)
            <input
              type="date"
              className={`${TOUCH} mt-1 w-full rounded-xl bg-[#1F2937] border border-[#374151] px-3 text-white`}
              value={asOfDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setAsOfDate(e.target.value)}
            />
            <span className="block text-xs text-[#6B7280] mt-1">
              System stock for variance = quantity on this date (e.g. month-end close).
            </span>
          </label>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={busy || !selectedBranchId || !asOfDate}
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
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="text-sm font-medium text-[#9CA3AF]">Recent sessions</h2>
              <button
                type="button"
                className="text-xs text-[#14B8A6] underline touch-manipulation min-h-11 px-1"
                onClick={() => setShowArchivedSessions((v) => !v)}
              >
                {showArchivedSessions ? 'Hide archived' : 'Show archived'}
              </button>
            </div>
            <div className="space-y-2">
              {(() => {
                const visible = sessions.filter((s) =>
                  showArchivedSessions
                    ? stockCountApi.isActiveInRecentList(s) || stockCountApi.isArchivedSession(s)
                    : stockCountApi.isActiveInRecentList(s)
                );
                if (visible.length === 0) {
                  return (
                    <p className="text-sm text-[#6B7280]">
                      {showArchivedSessions
                        ? 'No sessions for this scope yet.'
                        : 'No active sessions. Cancelled counts are in archive (Show archived).'}
                    </p>
                  );
                }
                return visible.map((s) => {
                  const muted = stockCountApi.isArchivedSession(s);
                  return (
                    <div
                      key={s.id}
                      className={`rounded-xl border border-[#374151] p-3 ${
                        muted ? 'bg-[#111827]/80 opacity-70' : 'bg-[#1F2937]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => void openSession(s.id)}
                        className="w-full text-left text-white"
                      >
                        <span className="text-sm font-medium capitalize">
                          {s.status.replace(/_/g, ' ')}
                          {s.document_no ? ` · ${s.document_no}` : ''}
                        </span>
                        <span className="text-xs text-[#9CA3AF] block">
                          {stockCountApi.isAllBranchesSession(s) ? 'All Branches' : s.branch_id}
                          {s.as_of_date ? ` · as of ${s.as_of_date}` : ''}
                          {s.created_at ? ` · ${new Date(s.created_at).toLocaleString()}` : ''}
                        </span>
                      </button>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {stockCountApi.isCancellable(s) && (
                          <button
                            type="button"
                            disabled={busy}
                            className={`${TOUCH} px-3 rounded-xl bg-rose-900/50 text-rose-100 text-xs`}
                            onClick={() => setCancelConfirmSession(s)}
                          >
                            Cancel
                          </button>
                        )}
                        {stockCountApi.isReversible(s) && canPost && (
                          <button
                            type="button"
                            disabled={busy}
                            className={`${TOUCH} px-3 rounded-xl bg-amber-900/50 text-amber-100 text-xs`}
                            onClick={() => {
                              void openSession(s.id).then(() => setReverseConfirm(true));
                            }}
                          >
                            Reverse
                          </button>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {session && (
        <>
          <div className="p-4 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3.5 text-[#9CA3AF] pointer-events-none" />
              <input
                ref={searchInputRef}
                className={`${TOUCH} w-full pl-9 pr-20 rounded-xl bg-[#1F2937] border border-[#374151] text-white text-sm`}
                placeholder="Search SKU, barcode, name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
                enterKeyHint="search"
                disabled={locked || previewMode}
                aria-label="Search products to count"
              />
              <div className="absolute right-2 top-2 flex items-center gap-1">
                {searching && <Loader2 className="w-5 h-5 animate-spin text-[#14B8A6]" />}
                {search.trim() && !searching && (
                  <button
                    type="button"
                    className={`${TOUCH} w-9 rounded-lg bg-[#374151] text-white flex items-center justify-center`}
                    aria-label="Clear search"
                    onClick={() => {
                      setSearch('');
                      setHits([]);
                      searchInputRef.current?.focus();
                    }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {!!search.trim() && !locked && !previewMode && (
              <div className="rounded-2xl border border-[#374151] bg-[#111827] max-h-56 overflow-y-auto">
                {searching && hits.length === 0 && (
                  <div className="p-3 text-sm text-[#9CA3AF] flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Searching…
                  </div>
                )}
                {!searching && hits.length === 0 && (
                  <div className="p-3 text-sm text-[#9CA3AF]">
                    No catalog match — do not invent a product.
                  </div>
                )}
                {hits.map((h) => (
                  <button
                    key={`${h.product_id}-${h.variation_id || ''}`}
                    type="button"
                    disabled={busy}
                    onClick={() => openQtyDialog(h)}
                    className="w-full flex items-center gap-3 px-3 py-3 text-left border-b border-[#374151]/60 last:border-0 hover:bg-[#1F2937] active:bg-[#1F2937] touch-manipulation"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#1F2937] shrink-0">
                      <ProductImage
                        src={h.image_url}
                        alt={h.name}
                        variant="thumb"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{h.name}</p>
                      <p className="text-xs text-[#9CA3AF] truncate">
                        {h.variation_label || h.variation_sku || h.sku || '—'}
                        {h.exact_match ? ' · exact' : ''}
                      </p>
                      <p className="text-xs text-[#14B8A6]">
                        {isAllBranches
                          ? `Current Stock (all branches) ${formatQty(h.system_qty)}`
                          : `Current Stock ${formatQty(h.system_qty)}`}
                      </p>
                    </div>
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
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 text-xs text-[#9CA3AF] min-w-[6rem]">
                <p>
                  Counted {partition.counted.length}/{lines.length}
                </p>
                <p>
                  Over {formatQty(varianceSummary.over)} · Short {formatQty(varianceSummary.short)}
                </p>
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
              {session && stockCountApi.isCancellable(session) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setCancelConfirmSession(session)}
                  className={`${TOUCH} px-3 rounded-xl bg-rose-900/50 text-rose-100 text-sm`}
                >
                  Cancel
                </button>
              )}
              {session && stockCountApi.isReversible(session) && canPost && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setReverseConfirm(true)}
                  className={`${TOUCH} px-3 rounded-xl bg-amber-900/50 text-amber-100 text-sm`}
                >
                  Reverse
                </button>
              )}
              {lines.length > 0 && (
                <button
                  type="button"
                  onClick={printReview}
                  className={`${TOUCH} px-3 rounded-xl bg-[#374151] text-white text-sm`}
                >
                  Print
                </button>
              )}
              {(canPost || previewMode) && !locked && (
                <button
                  type="button"
                  disabled={busy || lines.length === 0}
                  onClick={() => setPostConfirm(true)}
                  className={`${TOUCH} px-4 rounded-xl bg-[#14B8A6] text-white font-semibold text-sm flex items-center gap-2`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Review & submit
                </button>
              )}
              {(canPost || previewMode) && awaitingApproval && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setApproveConfirm(true)}
                  className={`${TOUCH} px-4 rounded-xl bg-emerald-600 text-white font-semibold text-sm flex items-center gap-2`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve stock
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {postConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#1F2937] rounded-2xl w-full max-w-md p-5 border border-[#374151] max-h-[85vh] overflow-y-auto">
            <h3 className="text-white font-semibold text-lg mb-2">Review & submit</h3>
            <p className="text-sm text-[#9CA3AF] mb-2">
              As of <span className="text-white">{session?.as_of_date || asOfDate}</span>. Stock
              will <span className="text-amber-200">not</span> change until Approve.
            </p>
            <div className="rounded-xl bg-[#111827] border border-[#374151] p-3 text-sm mb-3 space-y-1">
              <p className="text-white">
                Counted lines: <b>{varianceSummary.counted}</b>
              </p>
              <p className="text-amber-300">
                Over lines: {varianceSummary.overLines} · qty +{formatQty(varianceSummary.over)}
              </p>
              <p className="text-rose-300">
                Short lines: {varianceSummary.shortLines} · qty −{formatQty(varianceSummary.short)}
              </p>
              <p className="text-[#9CA3AF]">Zero variance: {varianceSummary.zero}</p>
            </div>
            {varianceSummary.overLines > 0 && (
              <div className="mb-3 p-3 rounded-xl bg-amber-900/30 border border-amber-500/40 text-amber-100 text-xs">
                {varianceSummary.overLines} item(s) counted higher than as-of system — recheck before
                submit. Overage is allowed after you verify.
              </div>
            )}
            <ul className="space-y-1 mb-4 max-h-40 overflow-y-auto text-xs">
              {varianceSummary.rows
                .filter((r) => Math.abs(r.variance) >= 1e-9)
                .slice(0, 40)
                .map((r) => (
                  <li
                    key={r.line.id}
                    className="flex justify-between gap-2 text-[#D1D5DB] border-b border-[#374151]/py-1"
                  >
                    <span className="truncate">
                      {r.line.product_name || r.line.product_sku || 'Item'}
                    </span>
                    <span
                      className={`tabular-nums shrink-0 ${
                        r.variance > 0 ? 'text-emerald-400' : 'text-rose-300'
                      }`}
                    >
                      {r.variance > 0 ? '+' : ''}
                      {formatQty(r.variance)}
                    </span>
                  </li>
                ))}
            </ul>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                className={`${TOUCH} flex-1 rounded-xl bg-[#374151] text-white`}
                onClick={printReview}
              >
                Print
              </button>
            </div>
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
                onClick={() => void doSubmit()}
              >
                {busy ? 'Submitting…' : previewMode ? 'Simulate' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {approveConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#1F2937] rounded-2xl w-full max-w-md p-5 border border-[#374151] max-h-[85vh] overflow-y-auto">
            <h3 className="text-white font-semibold text-lg mb-2">Approve & update stock</h3>
            <p className="text-sm text-[#9CA3AF] mb-3">
              Final OK. Writes adjustments dated{' '}
              <span className="text-white">{session?.as_of_date || '—'}</span>, assigns STK document
              number, and updates inventory (GL via existing adjustment path).
            </p>
            <div className="rounded-xl bg-[#111827] border border-[#374151] p-3 text-sm mb-4 space-y-1">
              <p className="text-amber-300">
                Over {formatQty(varianceSummary.over)} ({varianceSummary.overLines} lines)
              </p>
              <p className="text-rose-300">
                Short {formatQty(varianceSummary.short)} ({varianceSummary.shortLines} lines)
              </p>
              <p className="text-[#9CA3AF]">Zero variance lines: {varianceSummary.zero}</p>
            </div>
            {varianceSummary.overLines > 0 && (
              <div className="mb-3 p-3 rounded-xl bg-amber-900/30 border border-amber-500/40 text-amber-100 text-xs">
                Recheck overages before final approve — still allowed if count is correct.
              </div>
            )}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                className={`${TOUCH} w-full rounded-xl bg-emerald-600 text-white font-semibold`}
                onClick={() => void doApprove()}
              >
                {busy ? 'Approving…' : 'Approve — update stock'}
              </button>
              <button
                type="button"
                disabled={busy}
                className={`${TOUCH} w-full rounded-xl bg-rose-900/60 text-rose-100`}
                onClick={() => void doReject()}
              >
                Reject — reopen count
              </button>
              <button
                type="button"
                className={`${TOUCH} w-full rounded-xl bg-[#374151] text-white`}
                onClick={() => setApproveConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelConfirmSession && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#1F2937] rounded-2xl w-full max-w-md p-5 border border-[#374151]">
            <h3 className="text-white font-semibold text-lg mb-2">Cancel session?</h3>
            <p className="text-sm text-[#9CA3AF] mb-4">
              Soft-cancel this count ({cancelConfirmSession.status.replace(/_/g, ' ')}). It leaves
              Recent and stays in archive only — stock/GL are not touched. Posted counts cannot be
              cancelled — use Reverse.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className={`${TOUCH} flex-1 rounded-xl bg-[#374151] text-white`}
                onClick={() => setCancelConfirmSession(null)}
              >
                Keep
              </button>
              <button
                type="button"
                disabled={busy}
                className={`${TOUCH} flex-1 rounded-xl bg-rose-700 text-white font-semibold`}
                onClick={() => void doCancelSession(cancelConfirmSession)}
              >
                {busy ? 'Cancelling…' : 'Cancel session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {reverseConfirm && session && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#1F2937] rounded-2xl w-full max-w-md p-5 border border-[#374151]">
            <h3 className="text-white font-semibold text-lg mb-2">Reverse approved count?</h3>
            <p className="text-sm text-[#9CA3AF] mb-4">
              Creates opposite stock adjustments and journals for{' '}
              <span className="text-white">{session.document_no || 'this STK'}</span>. Document number
              is kept. This cannot be undone except by a new count.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                className={`${TOUCH} w-full rounded-xl bg-amber-600 text-white font-semibold`}
                onClick={() => void doReverseSession()}
              >
                {busy ? 'Reversing…' : 'Reverse stock update'}
              </button>
              <button
                type="button"
                className={`${TOUCH} w-full rounded-xl bg-[#374151] text-white`}
                onClick={() => setReverseConfirm(false)}
              >
                Keep posted
              </button>
            </div>
          </div>
        </div>
      )}

      {countHistoryLine && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#1F2937] rounded-2xl w-full max-w-md p-5 border border-[#374151] max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h3 className="text-white font-semibold text-lg">Count history</h3>
                <p className="text-sm text-white truncate">
                  {countHistoryLine.product_name || 'Product'}
                </p>
                <p className="text-xs text-[#9CA3AF] truncate">
                  {countHistoryLine.variation_label ||
                    countHistoryLine.variation_sku ||
                    countHistoryLine.product_sku ||
                    '—'}
                </p>
                <p className="text-sm text-[#14B8A6] mt-1">
                  Physical total {formatQty(countHistoryLine.physical_qty)} · {countEvents.length}{' '}
                  find{countEvents.length === 1 ? '' : 's'}
                </p>
              </div>
              <button
                type="button"
                className={`${TOUCH} w-11 rounded-xl bg-[#374151] text-white flex items-center justify-center shrink-0`}
                aria-label="Close"
                onClick={() => {
                  setCountHistoryLine(null);
                  setCountEvents([]);
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {countEvents.length === 0 ? (
              <p className="text-sm text-[#9CA3AF] py-4">
                No count entries yet. Add finds from search — each OK creates a dated entry here.
              </p>
            ) : (
              <ul className="space-y-2 mb-4">
                {countEvents.map((ev, idx) => (
                  <li
                    key={ev.id}
                    className="rounded-xl bg-[#111827] border border-[#374151] p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-[#9CA3AF]">Find #{idx + 1}</span>
                      <span className="text-xs text-[#D1D5DB] tabular-nums">
                        {formatCountEventWhen(ev.created_at)}
                      </span>
                    </div>
                    <p className="text-white font-semibold mt-1">{formatCountEventLabel(ev)}</p>
                    <p className="text-xs text-[#9CA3AF] mt-0.5">
                      {ev.prior_qty == null ? '—' : formatQty(ev.prior_qty)}
                      {' → '}
                      {ev.new_qty == null ? '—' : formatQty(ev.new_qty)}
                    </p>
                    <p className="text-xs text-[#D1D5DB] mt-1">
                      by {ev.created_by_name || 'Unknown user'}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              className={`${TOUCH} w-full rounded-xl bg-[#374151] text-white`}
              onClick={() => {
                setCountHistoryLine(null);
                setCountEvents([]);
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {productHistoryLine && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#1F2937] rounded-2xl w-full max-w-md p-5 border border-[#374151] max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h3 className="text-white font-semibold text-lg">Product history</h3>
                <p className="text-sm text-white truncate">
                  {productHistoryLine.product_name || 'Product'}
                </p>
                <p className="text-xs text-[#9CA3AF] truncate">
                  {productHistoryLine.variation_label ||
                    productHistoryLine.variation_sku ||
                    productHistoryLine.product_sku ||
                    '—'}
                </p>
                {productHistorySystemQty != null && (
                  <p className="text-sm text-[#14B8A6] mt-1">
                    System stock {formatQty(productHistorySystemQty)}
                  </p>
                )}
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  Sales, purchases, transfers, prior counts
                </p>
              </div>
              <button
                type="button"
                className={`${TOUCH} w-11 rounded-xl bg-[#374151] text-white flex items-center justify-center shrink-0`}
                aria-label="Close"
                onClick={() => {
                  setProductHistoryLine(null);
                  setProductHistoryRows([]);
                  setProductHistorySystemQty(null);
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {productHistoryRows.length === 0 ? (
              <p className="text-sm text-[#9CA3AF] py-4">No stock movements for this item yet.</p>
            ) : (
              <ul className="space-y-2 mb-4">
                {productHistoryRows.map((row, idx) => {
                  const qty = Number(row.quantity ?? 0);
                  const qtyLabel = `${qty > 0 ? '+' : ''}${formatQty(qty)}`;
                  return (
                    <li
                      key={row.id || `hist-${idx}`}
                      className="rounded-xl bg-[#111827] border border-[#374151] p-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-white font-medium truncate">
                          {historyCategoryLabel(row.category as Parameters<typeof historyCategoryLabel>[0])}
                        </span>
                        <span
                          className={`tabular-nums font-semibold shrink-0 ${
                            qty > 0 ? 'text-emerald-400' : qty < 0 ? 'text-rose-300' : 'text-[#9CA3AF]'
                          }`}
                        >
                          {qtyLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1 text-xs text-[#9CA3AF]">
                        <span className="tabular-nums">
                          {row.created_at ? formatCountEventWhen(row.created_at) : '—'}
                        </span>
                        <span className="tabular-nums">
                          Bal {formatQty(row.running_balance)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <button
              type="button"
              className={`${TOUCH} w-full rounded-xl bg-[#374151] text-white`}
              onClick={() => {
                setProductHistoryLine(null);
                setProductHistoryRows([]);
                setProductHistorySystemQty(null);
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {pendingHit && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#1F2937] rounded-2xl w-full max-w-md p-5 border border-[#374151] max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h3 className="text-white font-semibold text-lg truncate">{pendingHit.name}</h3>
                <p className="text-xs text-[#9CA3AF] truncate">
                  {pendingHit.variation_label || pendingHit.variation_sku || pendingHit.sku || '—'}
                </p>
                <p className="text-sm text-[#14B8A6] mt-1">
                  {isAllBranches
                    ? `Current Stock (all branches) ${formatQty(pendingHit.system_qty)}`
                    : `Current Stock ${formatQty(pendingHit.system_qty)}`}
                </p>
              </div>
              <button
                type="button"
                className={`${TOUCH} w-11 rounded-xl bg-[#374151] text-white flex items-center justify-center shrink-0`}
                aria-label="Close"
                onClick={closeQtyDialog}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <button
              type="button"
              className="w-full aspect-square max-h-56 rounded-2xl overflow-hidden bg-[#111827] border border-[#374151] mb-4 relative"
              onClick={() => {
                if (!pendingHit.image_url) return;
                setImageZoomScale(1);
                setImageZoomOpen(true);
              }}
              aria-label={pendingHit.image_url ? 'Zoom product photo' : 'No photo'}
            >
              <ProductImage
                src={pendingHit.image_url}
                alt={pendingHit.name}
                className="w-full h-full object-contain"
              />
              {pendingHit.image_url && (
                <span className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-black/60 text-xs text-white flex items-center gap-1">
                  <ZoomIn className="w-3.5 h-3.5" /> Tap to zoom
                </span>
              )}
            </button>

            {isAllBranches && (
              <label className="block text-sm text-[#9CA3AF] mb-3">
                Branch for this find
                <select
                  className={`${TOUCH} mt-1 w-full rounded-xl bg-[#111827] border border-[#374151] px-3 text-white`}
                  value={findBranchId}
                  onChange={(e) => setFindBranchId(e.target.value)}
                >
                  <option value="">Select branch…</option>
                  {branches
                    .filter((b) => accessibleBranchIds.includes(b.id))
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                </select>
                <span className="block text-xs text-amber-200/90 mt-1">
                  Qty is added only to this branch line — not every branch.
                </span>
              </label>
            )}

            <p className="text-sm text-[#D1D5DB] mb-2">
              How many pieces did you find this pass?
            </p>
            {alreadyCountedTotal != null ? (
              <div className="mb-3 p-3 rounded-xl bg-[#111827] border border-[#14B8A6]/40 text-sm text-[#D1D5DB]">
                Already counted: <span className="font-semibold text-white">{formatQty(alreadyCountedTotal)}</span>
                {' → '}
                after OK:{' '}
                <span className="font-semibold text-[#14B8A6]">
                  {formatQty(alreadyCountedTotal + Math.max(0, Number(dialogQtyDraft) || dialogQty || 0))}
                </span>
                <p className="text-xs text-[#9CA3AF] mt-1">
                  Re-finding the same item adds to the running total — it does not replace the earlier entry.
                </p>
              </div>
            ) : (
              <p className="text-xs text-[#9CA3AF] mb-3">
                First time for this item — OK will start the running physical count.
              </p>
            )}

            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                disabled={busy}
                className={`${TOUCH} w-14 rounded-xl bg-[#374151] text-white flex items-center justify-center`}
                aria-label="Minus one"
                onClick={() => {
                  const next = Math.max(0, dialogQty - 1);
                  setDialogQty(next);
                  setDialogQtyDraft(String(next));
                }}
              >
                <Minus className="w-5 h-5" />
              </button>
              <div className="flex-1 text-center">
                <p className="text-3xl font-bold text-white tabular-nums">{dialogQty}</p>
              </div>
              <button
                type="button"
                disabled={busy}
                className={`${TOUCH} w-14 rounded-xl bg-[#14B8A6] text-white flex items-center justify-center`}
                aria-label="Plus one"
                onClick={() => {
                  const next = dialogQty + 1;
                  setDialogQty(next);
                  setDialogQtyDraft(String(next));
                }}
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="number"
                inputMode="decimal"
                className={`${TOUCH} flex-1 rounded-xl bg-[#111827] border border-[#374151] px-3 text-white text-sm`}
                placeholder="Set qty"
                value={dialogQtyDraft}
                onChange={(e) => setDialogQtyDraft(e.target.value)}
              />
              <button
                type="button"
                disabled={busy}
                className={`${TOUCH} px-4 rounded-xl bg-[#3B82F6] text-white text-sm font-medium`}
                onClick={() => {
                  const n = Number(dialogQtyDraft);
                  if (!Number.isFinite(n) || n < 0) {
                    setError('Enter a non-negative quantity');
                    return;
                  }
                  setDialogQty(n);
                  setDialogQtyDraft(String(n));
                }}
              >
                Set
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className={`${TOUCH} flex-1 rounded-xl bg-[#374151] text-white`}
                onClick={closeQtyDialog}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                className={`${TOUCH} flex-1 rounded-xl bg-[#14B8A6] text-white font-semibold`}
                onClick={() => void confirmAddWithQty()}
              >
                {busy ? 'Adding…' : 'OK — add to count'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmLine && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#1F2937] rounded-2xl w-full max-w-md p-5 border border-[#374151]">
            <h3 className="text-white font-semibold text-lg mb-2">Remove from count?</h3>
            <p className="text-sm text-[#9CA3AF] mb-4">
              Removes{' '}
              <span className="text-white">{deleteConfirmLine.product_name || 'this item'}</span>
              {deleteConfirmLine.variation_label
                ? ` (${deleteConfirmLine.variation_label})`
                : ''}{' '}
              from this draft session. No stock movement is posted.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className={`${TOUCH} flex-1 rounded-xl bg-[#374151] text-white`}
                onClick={() => setDeleteConfirmLine(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                className={`${TOUCH} flex-1 rounded-xl bg-rose-600 text-white font-semibold`}
                onClick={() => void confirmDeleteLine()}
              >
                {busy ? 'Removing…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {imageZoomOpen && pendingHit?.image_url && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col">
          <div className="flow-screen-header px-4 pb-3 flex items-center justify-between gap-2">
            <p className="text-white text-sm truncate flex-1">{pendingHit.name}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`${TOUCH} w-11 rounded-xl bg-[#374151] text-white flex items-center justify-center`}
                aria-label="Zoom out"
                onClick={() => setImageZoomScale((s) => Math.max(0.5, Math.round((s - 0.25) * 100) / 100))}
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <button
                type="button"
                className={`${TOUCH} w-11 rounded-xl bg-[#374151] text-white flex items-center justify-center`}
                aria-label="Zoom in"
                onClick={() => setImageZoomScale((s) => Math.min(4, Math.round((s + 0.25) * 100) / 100))}
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button
                type="button"
                className={`${TOUCH} w-11 rounded-xl bg-[#374151] text-white flex items-center justify-center`}
                aria-label="Close zoom"
                onClick={() => setImageZoomOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            <div
              className="transition-transform origin-center"
              style={{ transform: `scale(${imageZoomScale})` }}
            >
              <ProductImage
                src={pendingHit.image_url}
                alt={pendingHit.name}
                className="max-w-[90vw] max-h-[70vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
