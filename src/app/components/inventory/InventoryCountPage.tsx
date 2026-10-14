/**
 * Physical Stock Count & Reconciliation (web).
 * Draft counts never change live stock; posting requires inventory.adjust / post_count.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClipboardList,
  History,
  Loader2,
  Minus,
  MoreHorizontal,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSupabase } from '../../context/SupabaseContext';
import { useSettings } from '../../context/SettingsContext';
import { branchService } from '../../services/branchService';
import {
  stockCountService,
  type StockCountLine,
  type StockCountSearchHit,
  type StockCountSession,
  type StockCountUnmatchedIssue,
} from '../../services/stockCountService';
import { permissionEngine } from '../../services/permissionEngine';
import { formatQty } from '@/app/utils/quantity';
import { itemKindLabel } from '@/app/lib/stockCountDisplay';
import {
  branchDifference,
  groupLinesByProductVariation,
} from '@/app/lib/stockCountGrouping';
import {
  createBaseline3Current8Fixture,
  createPreviewStore,
  STOCK_COUNT_PREVIEW_BANNER,
  type PreviewLine,
  type PreviewStore,
} from '@/app/lib/stockCountPreviewStore';
import { summarizeStockMovements } from '@/app/lib/stockLedgerSummary';
import { categorizeStockMovement, withRunningBalance } from '@/app/lib/stockCountDisplay';
import { countRowPresentation } from '@/app/lib/stockCountRowPresentation';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  ErpPage,
  ErpPageDescription,
  ErpPageHeader,
  ErpPageTitle,
} from '../ui/erp-surfaces';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { StockCountThumb } from './StockCountThumb';
import { StockCountHistoryDrawer } from './StockCountHistoryDrawer';
import { cn } from '../ui/utils';

/** Touch-friendly control height (~44px) used across count actions. */
const TOUCH_BTN = 'min-h-11 h-11 touch-manipulation';
const TOUCH_ICON_BTN = 'min-h-11 h-11 w-11 shrink-0 touch-manipulation';

type LineFilter = 'all' | 'counted' | 'uncounted' | 'variance';

/** Sentinel for All Branches count scope (company accessible branches). */
const ALL_BRANCHES_SCOPE = '__all_branches__';

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: 'bg-slate-500/20 text-slate-300',
    in_progress: 'bg-sky-500/20 text-sky-300',
    pending_review: 'bg-amber-500/20 text-amber-300',
    posted: 'bg-emerald-500/20 text-emerald-300',
    cancelled: 'bg-rose-500/20 text-rose-300',
  };
  return map[status] || map.draft;
}

function KindBadge({ kind }: { kind: 'product' | 'variation' }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0 ${
        kind === 'variation'
          ? 'bg-violet-500/20 text-violet-300'
          : 'bg-slate-500/25 text-slate-300'
      }`}
    >
      {itemKindLabel(kind)}
    </span>
  );
}

/** Compact drift cue — details live in History / Review, not on the card. */
function StockChangedBadge({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200 shrink-0"
      title="Stock moved after count baseline. Open History for details. Posting still uses Physical − Baseline."
      aria-label="Stock changed since count baseline — open History for details"
    >
      <AlertTriangle className="h-3 w-3" aria-hidden />
      Stock changed
    </span>
  );
}

/** Card metrics: Current Stock + Physical + Difference (when counted). No baseline essay. */
function CountMetrics({
  current,
  physical,
  difference,
  countStatus,
  drifted,
  partialPhysical,
  compact,
}: {
  current: number | null | undefined;
  physical: number | null;
  difference: number | null;
  countStatus: string;
  drifted?: boolean;
  partialPhysical?: boolean;
  compact?: boolean;
}) {
  const pres = countRowPresentation({
    physicalQty: physical,
    countStatus,
    baselineDrifted: drifted,
  });
  return (
    <div
      className={cn(
        'grid shrink-0 text-center',
        compact ? 'grid-cols-3 gap-2 min-w-[11rem]' : 'grid-cols-3 gap-3 min-w-[13.5rem] sm:min-w-[15rem]'
      )}
    >
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">
          {pres.currentStockLabel}
        </div>
        <div
          className={cn('font-semibold tabular-nums', compact ? 'text-base' : 'text-lg')}
          aria-label="Current stock"
        >
          {current == null ? '—' : formatQty(current)}
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">
          {pres.physicalLabel}
        </div>
        <div
          className={cn(
            'font-semibold tabular-nums',
            compact ? 'text-base' : 'text-lg',
            pres.physicalDisplayIsBlank && 'text-muted-foreground'
          )}
          aria-label={
            pres.isConfirmedZero
              ? 'Physical count confirmed zero'
              : pres.physicalDisplayIsBlank
                ? 'Physical count not entered'
                : 'Physical count'
          }
        >
          {pres.physicalDisplayIsBlank ? '—' : formatQty(physical)}
        </div>
        {partialPhysical ? (
          <div className="text-[9px] font-normal text-amber-400">partial</div>
        ) : null}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">
          {pres.differenceLabel}
        </div>
        <div
          className={cn(
            'font-semibold tabular-nums',
            compact ? 'text-base' : 'text-lg',
            !pres.showDifference
              ? 'text-muted-foreground'
              : difference != null && difference < 0
                ? 'text-rose-400'
                : difference != null && difference > 0
                  ? 'text-emerald-400'
                  : ''
          )}
          aria-label="Difference versus count baseline"
        >
          {pres.showDifference && difference != null ? formatQty(difference) : '—'}
        </div>
      </div>
    </div>
  );
}

function ProductIdentityBlock({
  kind,
  name,
  productSku,
  variationSku,
  variationLabel,
  attributesIncomplete,
  imageUrl,
  statusLine,
  drifted,
}: {
  kind: 'product' | 'variation';
  name?: string | null;
  productSku?: string | null;
  variationSku?: string | null;
  variationLabel?: string | null;
  attributesIncomplete?: boolean;
  imageUrl?: string | null;
  statusLine?: string;
  drifted?: boolean;
}) {
  const skuLine = [
    productSku ? `SKU ${productSku}` : null,
    variationSku ? `Var ${variationSku}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const varLine =
    kind === 'variation'
      ? variationLabel || (attributesIncomplete ? 'Attributes incomplete' : 'Variation')
      : null;

  return (
    <div className="flex items-start gap-3 min-w-0 flex-1 basis-[16rem] max-w-full lg:max-w-[28rem]">
      <StockCountThumb src={imageUrl} alt={name || ''} size="md" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <KindBadge kind={kind} />
          <StockChangedBadge visible={!!drifted} />
        </div>
        <div
          className="font-semibold text-sm sm:text-base leading-snug truncate"
          title={name || undefined}
        >
          {name || 'Product'}
        </div>
        {skuLine ? (
          <div className="text-xs text-muted-foreground truncate" title={skuLine}>
            {skuLine}
          </div>
        ) : null}
        {varLine ? (
          <div className="text-xs text-foreground/85 truncate" title={varLine}>
            {varLine}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Single product</div>
        )}
        {statusLine ? (
          <div className="text-[11px] text-muted-foreground truncate">{statusLine}</div>
        ) : null}
      </div>
    </div>
  );
}

type CountRowActionsProps = {
  line: StockCountLine;
  locked: boolean;
  uncounted: boolean;
  directValue: string;
  onDirectChange: (value: string) => void;
  onHistory: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  onSetDirect: () => void;
  onConfirmZero: () => void;
  onRecount: () => void;
  historyLabel?: string;
};

/** Primary +1/−1/qty stay visible; Count 0 / Recount fold into More on narrow screens. */
function CountRowActions({
  line,
  locked,
  uncounted,
  directValue,
  onDirectChange,
  onHistory,
  onIncrement,
  onDecrement,
  onSetDirect,
  onConfirmZero,
  onRecount,
  historyLabel = 'History',
}: CountRowActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto xl:ml-auto xl:justify-end shrink-0">
      <Button
        type="button"
        variant="outline"
        className={cn(TOUCH_BTN, 'gap-1 px-3')}
        onClick={onHistory}
        title="Full stock movement history"
      >
        <History className="h-4 w-4" />
        {historyLabel}
      </Button>
      {!locked && (
        <>
          <Button
            type="button"
            className={cn(TOUCH_BTN, 'min-w-[3.25rem] text-base font-bold px-3')}
            onClick={onIncrement}
            aria-label="Plus one"
            title="+1"
          >
            +1
          </Button>
          <Button
            type="button"
            variant="outline"
            className={TOUCH_ICON_BTN}
            onClick={onDecrement}
            aria-label="Minus one"
            title="-1"
          >
            <Minus className="h-5 w-5" />
          </Button>
          <Input
            id={`shop-qty-${line.id}`}
            className={cn(TOUCH_BTN, 'w-[4.75rem] text-center text-base')}
            inputMode="decimal"
            enterKeyHint="done"
            placeholder="—"
            aria-label="Physical quantity"
            value={directValue}
            onChange={(e) => onDirectChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSetDirect();
              }
            }}
          />
          <Button
            type="button"
            className={cn(TOUCH_BTN, 'px-3')}
            variant="secondary"
            onClick={onSetDirect}
          >
            Set
          </Button>

          {/* Desktop / tablet: secondary actions inline */}
          <Button
            type="button"
            className={cn(TOUCH_BTN, 'hidden sm:inline-flex px-3')}
            variant="outline"
            onClick={onConfirmZero}
            title="Confirm zero pieces in shop"
          >
            Count 0
          </Button>
          <Button
            type="button"
            className={cn(TOUCH_BTN, 'hidden sm:inline-flex px-3')}
            variant="ghost"
            onClick={onRecount}
            title="Fresh recount (new pass)"
            aria-label="Recount"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="ml-1 text-xs">Recount</span>
          </Button>

          {/* Phone: secondary actions in menu so primary controls stay tappable */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn(TOUCH_ICON_BTN, 'sm:hidden')}
                aria-label="More count actions"
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[10rem]">
              <DropdownMenuItem
                className="min-h-11"
                onSelect={() => onConfirmZero()}
              >
                Count 0
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-11" onSelect={() => onRecount()}>
                Recount
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}

function CountProgressSummary({
  total,
  counted,
  uncounted,
  variance,
  lineFilter,
  onFilter,
}: {
  total: number;
  counted: number;
  uncounted: number;
  variance: number;
  lineFilter: LineFilter;
  onFilter: (f: LineFilter) => void;
}) {
  const chips: Array<{ key: LineFilter; label: string; value: number }> = [
    { key: 'all', label: 'All', value: total },
    { key: 'counted', label: 'Counted', value: counted },
    { key: 'uncounted', label: 'Uncounted', value: uncounted },
    { key: 'variance', label: 'Variance', value: variance },
  ];
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-4 gap-2"
      role="group"
      aria-label="Count progress summary"
    >
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onFilter(c.key)}
          className={cn(
            'rounded-lg border px-3 py-2.5 text-left min-h-11 touch-manipulation transition-colors',
            lineFilter === c.key
              ? 'border-primary bg-primary/15 text-foreground'
              : 'border-border bg-card/40 text-muted-foreground hover:bg-muted/40'
          )}
          aria-pressed={lineFilter === c.key}
        >
          <div className="text-[10px] uppercase tracking-wide">{c.label}</div>
          <div className="text-lg font-semibold tabular-nums text-foreground">{c.value}</div>
        </button>
      ))}
    </div>
  );
}

export const InventoryCountPage = () => {
  const { companyId, branchId } = useSupabase();
  const { branches: settingsBranches } = useSettings();
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [sessions, setSessions] = useState<StockCountSession[]>([]);
  const [session, setSession] = useState<StockCountSession | null>(null);
  const [lines, setLines] = useState<StockCountLine[]>([]);
  const [issues, setIssues] = useState<StockCountUnmatchedIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchHits, setSearchHits] = useState<StockCountSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [lineFilter, setLineFilter] = useState<LineFilter>('all');
  const [directQtyDraft, setDirectQtyDraft] = useState<Record<string, string>>({});
  const [unmatchedOpen, setUnmatchedOpen] = useState(false);
  const [unmatchedDesc, setUnmatchedDesc] = useState('');
  const [unmatchedNotes, setUnmatchedNotes] = useState('');
  const [postConfirmOpen, setPostConfirmOpen] = useState(false);
  const [historyLine, setHistoryLine] = useState<StockCountLine | null>(null);
  const [historyProductGroup, setHistoryProductGroup] = useState<{
    product_id: string;
    variation_id: string | null;
    lines: StockCountLine[];
  } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [previewMode, setPreviewMode] = useState(false);
  const [previewStore, setPreviewStore] = useState<PreviewStore | null>(null);
  const [driftAckIds, setDriftAckIds] = useState<Set<string>>(new Set());
  const [previewHistory, setPreviewHistory] = useState<ReturnType<
    typeof createBaseline3Current8Fixture
  > | null>(null);

  const canCount =
    permissionEngine.has('inventory', 'count') ||
    permissionEngine.has('inventory', 'view') ||
    permissionEngine.has('inventory', 'adjust');
  const canPost =
    permissionEngine.has('inventory', 'post_count') ||
    permissionEngine.has('inventory', 'adjust');

  const locked = session?.status === 'posted' || session?.status === 'cancelled';
  const isAllBranchesSession =
    stockCountService.isAllBranchesSession(session) ||
    selectedBranchId === ALL_BRANCHES_SCOPE;

  const countScopeLabel = useMemo(() => {
    if (session && stockCountService.isAllBranchesSession(session)) {
      return `All Branches (${branches.length} accessible)`;
    }
    if (selectedBranchId === ALL_BRANCHES_SCOPE) {
      return `All Branches (${branches.length} accessible)`;
    }
    const id = session?.branch_id || selectedBranchId;
    return branches.find((b) => b.id === id)?.name || id || '—';
  }, [branches, session, selectedBranchId]);

  const globalBranchLabel =
    !branchId || branchId === 'all' ? 'All Branches' : branches.find((b) => b.id === branchId)?.name || branchId;

  const branchNameById = useCallback(
    (id?: string | null) => {
      if (!id) return '—';
      return branches.find((b) => b.id === id)?.name || id;
    },
    [branches]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!companyId) return;
      try {
        let active: Array<{ id: string; name: string }> = [];
        if (settingsBranches?.length) {
          active = settingsBranches
            .filter((b) => b?.id && b.isActive !== false)
            .map((b) => ({ id: b.id, name: b.branchName || b.branchCode || b.id }));
        } else {
          const list = await branchService.getBranchesCached(companyId);
          active = (list || [])
            .filter((b: any) => b?.id && b.id !== 'all')
            .map((b: any) => ({ id: b.id, name: b.name || b.id }));
        }
        if (cancelled) return;
        setBranches(active);
        const preferred =
          branchId && branchId !== 'all' ? branchId : active[0]?.id || '';
        setSelectedBranchId((prev) => prev || preferred);
      } catch (e: any) {
        toast.error(e?.message || 'Failed to load branches');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, branchId, settingsBranches]);

  const refreshSessions = useCallback(async () => {
    if (!companyId) return;
    try {
      const list = await stockCountService.listSessions({
        // All-branches list filter: null branchId returns company sessions including all_branches
        branchId:
          selectedBranchId === ALL_BRANCHES_SCOPE ? null : selectedBranchId || null,
      });
      setSessions(
        selectedBranchId === ALL_BRANCHES_SCOPE
          ? list.filter((s) => stockCountService.isAllBranchesSession(s))
          : list.filter((s) => !stockCountService.isAllBranchesSession(s))
      );
    } catch (e: any) {
      toast.error(e?.message || 'Failed to list count sessions');
    }
  }, [companyId, selectedBranchId]);

  const loadSession = useCallback(async (sessionId: string) => {
    setBusy(true);
    try {
      const detail = await stockCountService.getSession(sessionId);
      setSession(detail.session);
      setLines(detail.lines);
      setIssues(detail.unmatched_issues);
      if (stockCountService.isAllBranchesSession(detail.session)) {
        setSelectedBranchId(ALL_BRANCHES_SCOPE);
      } else if (detail.session.branch_id) {
        setSelectedBranchId(detail.session.branch_id);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load session');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refreshSessions();
      setLoading(false);
    })();
  }, [refreshSessions]);

  useEffect(() => {
    if (previewMode) {
      setSearchHits([]);
      return;
    }
    if (!companyId || !selectedBranchId || !searchTerm.trim() || !session || locked) {
      setSearchHits([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      setSearching(true);
      try {
        const allBr = stockCountService.isAllBranchesSession(session);
        const hits = await stockCountService.searchCatalog(
          companyId,
          allBr ? null : selectedBranchId === ALL_BRANCHES_SCOPE ? null : selectedBranchId,
          searchTerm,
          20,
          allBr
            ? { allBranches: true, branchIds: branches.map((b) => b.id) }
            : undefined
        );
        setSearchHits(hits);
      } catch (e: any) {
        console.warn('[InventoryCount] search', e);
        setSearchHits([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [companyId, selectedBranchId, searchTerm, session, locked, branches]);

  const filteredLines = useMemo(() => {
    const parts = stockCountService.partitionLines(lines);
    if (lineFilter === 'counted') return parts.counted;
    if (lineFilter === 'uncounted') return parts.uncounted;
    if (lineFilter === 'variance') return parts.variance;
    return lines;
  }, [lines, lineFilter]);

  const counts = useMemo(() => stockCountService.partitionLines(lines), [lines]);

  const groupedProducts = useMemo(
    () => groupLinesByProductVariation(filteredLines),
    [filteredLines]
  );

  const createSession = async () => {
    const allBr = selectedBranchId === ALL_BRANCHES_SCOPE;
    if (!selectedBranchId || selectedBranchId === 'all') {
      toast.error('Select a physical branch or All Branches');
      return;
    }
    if (!allBr && !selectedBranchId) {
      toast.error('Select a physical branch or All Branches');
      return;
    }
    if (!canCount) {
      toast.error('No permission to start a stock count');
      return;
    }
    setBusy(true);
    try {
      const created = await stockCountService.createSession(
        allBr ? null : selectedBranchId,
        undefined,
        allBr
      );
      toast.success(allBr ? 'All-branches count session created' : 'Count session created');
      await refreshSessions();
      await loadSession(created.id);
    } catch (e: any) {
      toast.error(e?.message || 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const addHit = async (hit: StockCountSearchHit) => {
    if (!session || locked) return;
    if (hit.has_variations && !hit.variation_id) {
      toast.error('Select an exact variation — parent totals are not counted');
      return;
    }
    setBusy(true);
    try {
      await stockCountService.addLine(session.id, hit.product_id, hit.variation_id);
      setSearchTerm('');
      setSearchHits([]);
      await loadSession(session.id);
      toast.success('Added to count');
    } catch (e: any) {
      toast.error(e?.message || 'Add failed');
    } finally {
      setBusy(false);
    }
  };

  const previewLineToStock = (p: PreviewLine): StockCountLine => ({
    id: p.id,
    company_id: companyId || 'preview',
    session_id: 'preview-session',
    branch_id: p.branch_id,
    product_id: p.product_id,
    variation_id: p.variation_id,
    system_qty_baseline: p.system_qty_baseline,
    baseline_at: p.baseline_at,
    current_system_qty: p.current_system_qty,
    movement_since_baseline: p.current_system_qty - p.system_qty_baseline,
    baseline_drifted: Math.abs(p.current_system_qty - p.system_qty_baseline) > 0.0000001,
    physical_qty: p.physical_qty,
    active_pass_number: p.active_pass_number,
    variance: p.difference,
    count_status: p.count_status,
    notes: null,
    reason: null,
    stock_movement_id: null,
    posted_at: null,
    reconciled_at: null,
    difference: p.difference,
    product_name: p.product_name,
    product_sku: p.product_sku,
    variation_sku: p.variation_sku,
    variation_label: p.variation_label,
    attributes_incomplete: false,
    item_kind: p.item_kind,
    image_url: p.image_url,
  });

  const syncPreviewLines = (store: PreviewStore) => {
    setLines(store.lines.map(previewLineToStock));
    setSession({
      id: store.session.id,
      company_id: companyId || 'preview',
      branch_id: store.session.branch_id,
      scope_type: store.session.scope_type,
      status: store.session.status,
      notes: store.session.notes,
    });
  };

  const enterPreviewMode = (seed: 'baseline3_current8' | 'all_branches' = 'baseline3_current8') => {
    const store = createPreviewStore(seed);
    const fixture = createBaseline3Current8Fixture();
    setPreviewMode(true);
    setPreviewStore(store);
    setPreviewHistory(fixture);
    setDriftAckIds(new Set());
    setIssues([]);
    syncPreviewLines(store);
    toast.message('Preview / Test mode — no database writes');
  };

  const exitPreviewMode = () => {
    setPreviewMode(false);
    setPreviewStore(null);
    setPreviewHistory(null);
    setSession(null);
    setLines([]);
    setDriftAckIds(new Set());
    refreshSessions();
  };

  const patchLineLocal = (updated: StockCountLine) => {
    setLines((prev) =>
      prev.map((l) =>
        l.id === updated.id
          ? {
              ...l,
              ...updated,
              difference:
                updated.physical_qty == null
                  ? null
                  : Number(updated.physical_qty) - Number(updated.system_qty_baseline),
              product_name: updated.product_name || l.product_name,
              product_sku: updated.product_sku || l.product_sku,
              variation_sku: updated.variation_sku ?? l.variation_sku,
              variation_label: updated.variation_label ?? l.variation_label,
              attributes_incomplete: updated.attributes_incomplete ?? l.attributes_incomplete,
              item_kind: updated.item_kind || l.item_kind,
              image_url: updated.image_url ?? l.image_url,
              current_system_qty: updated.current_system_qty ?? l.current_system_qty,
              movement_since_baseline:
                updated.movement_since_baseline ?? l.movement_since_baseline,
              baseline_drifted: updated.baseline_drifted ?? l.baseline_drifted,
            }
          : l
      )
    );
  };

  const onIncrement = async (line: StockCountLine) => {
    if (locked) return;
    try {
      if (previewMode && previewStore) {
        const updated = previewStore.applyEvent(line.id, 'increment');
        syncPreviewLines(previewStore);
        void updated;
        return;
      }
      const updated = await stockCountService.applyEvent(line.id, 'increment', 1);
      patchLineLocal(updated);
    } catch (e: any) {
      toast.error(e?.message || '+1 failed');
    }
  };

  const onDecrement = async (line: StockCountLine) => {
    if (locked) return;
    try {
      if (previewMode && previewStore) {
        previewStore.applyEvent(line.id, 'decrement');
        syncPreviewLines(previewStore);
        return;
      }
      const updated = await stockCountService.applyEvent(line.id, 'decrement', 1);
      patchLineLocal(updated);
    } catch (e: any) {
      toast.error(e?.message || '-1 failed');
    }
  };

  const onConfirmZero = async (line: StockCountLine) => {
    if (locked) return;
    try {
      if (previewMode && previewStore) {
        previewStore.applyEvent(line.id, 'confirm_zero');
        syncPreviewLines(previewStore);
        return;
      }
      const updated = await stockCountService.applyEvent(line.id, 'confirm_zero');
      patchLineLocal(updated);
    } catch (e: any) {
      toast.error(e?.message || 'Confirm zero failed');
    }
  };

  const onSetDirect = async (line: StockCountLine) => {
    if (locked) return;
    const raw = directQtyDraft[line.id];
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      toast.error('Enter a valid non-negative physical count');
      return;
    }
    try {
      if (previewMode && previewStore) {
        previewStore.applyEvent(line.id, 'set', n);
        syncPreviewLines(previewStore);
        setDirectQtyDraft((d) => {
          const next = { ...d };
          delete next[line.id];
          return next;
        });
        return;
      }
      const updated = await stockCountService.applyEvent(line.id, 'set', n);
      patchLineLocal(updated);
      setDirectQtyDraft((d) => {
        const next = { ...d };
        delete next[line.id];
        return next;
      });
    } catch (e: any) {
      toast.error(e?.message || 'Set quantity failed');
    }
  };

  const onRecount = async (line: StockCountLine) => {
    if (locked) return;
    if (
      !window.confirm(
        'Start a fresh recount? Physical count clears. Count baseline refreshes to Current System Stock. Earlier pass stays in audit history.'
      )
    ) {
      return;
    }
    try {
      if (previewMode && previewStore) {
        previewStore.applyEvent(line.id, 'start_recount');
        syncPreviewLines(previewStore);
        toast.message('Preview recount — baseline refreshed to current stock');
        return;
      }
      const updated = await stockCountService.applyEvent(line.id, 'start_recount');
      patchLineLocal(updated);
      toast.message('Fresh recount — baseline refreshed to current system stock');
    } catch (e: any) {
      toast.error(e?.message || 'Recount failed');
    }
  };

  const onComplete = async () => {
    if (!session || locked) return;
    setBusy(true);
    try {
      const allowPartial = counts.uncounted.length > 0 && canPost;
      if (counts.uncounted.length > 0 && !allowPartial) {
        toast.error(
          `${counts.uncounted.length} uncounted line(s) — count them or ask a reviewer`
        );
        return;
      }
      await stockCountService.completeSession(
        session.id,
        allowPartial && counts.uncounted.length > 0
      );
      toast.success('Session ready for review');
      await loadSession(session.id);
      await refreshSessions();
    } catch (e: any) {
      toast.error(e?.message || 'Complete failed');
    } finally {
      setBusy(false);
    }
  };

  const driftBlocked = useMemo(
    () => stockCountService.linesBlockingPostForDrift(lines, driftAckIds),
    [lines, driftAckIds]
  );

  const onPost = async () => {
    if (!session || (!canPost && !previewMode)) return;

    if (previewMode && previewStore) {
      const result = previewStore.previewPost({
        acknowledgeDriftLineIds: [...driftAckIds],
      });
      if (!result.ok) {
        toast.error(
          `${result.blocked.length} line(s) blocked: stock moved after baseline. Recount or acknowledge.`
        );
        return;
      }
      toast.success(
        `Preview post: would create ${result.wouldCreateMovements} movement(s). Actual stock movements written: ${result.stockMovementsCreated}`
      );
      setPostConfirmOpen(false);
      return;
    }

    if (driftBlocked.length > 0) {
      toast.error(
        `${driftBlocked.length} line(s) have stock movement after baseline. Recount or acknowledge drift before posting.`
      );
      return;
    }

    setBusy(true);
    try {
      const result = await stockCountService.postSession(
        session.id,
        undefined,
        counts.uncounted.length > 0
      );
      toast.success(
        result.idempotent
          ? 'Already posted (idempotent)'
          : `Posted: ${result.posted_movements} movement(s), ${result.zero_variance} zero-variance`
      );
      setPostConfirmOpen(false);
      await loadSession(session.id);
      await refreshSessions();
    } catch (e: any) {
      toast.error(e?.message || 'Post failed');
    } finally {
      setBusy(false);
    }
  };

  const saveUnmatched = async () => {
    if (!session) return;
    if (!unmatchedDesc.trim()) {
      toast.error('Describe the unmatched item');
      return;
    }
    setBusy(true);
    try {
      await stockCountService.recordUnmatched(session.id, unmatchedDesc, unmatchedNotes);
      toast.success('Unmatched issue recorded (no product created)');
      setUnmatchedOpen(false);
      setUnmatchedDesc('');
      setUnmatchedNotes('');
      await loadSession(session.id);
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  if (!companyId) {
    return (
      <ErpPage>
        <ErpPageHeader>
          <ErpPageTitle>Inventory Count</ErpPageTitle>
          <ErpPageDescription>Sign in to count stock.</ErpPageDescription>
        </ErpPageHeader>
      </ErpPage>
    );
  }

  const showReviewPost =
    !!session &&
    (canPost || previewMode) &&
    session.status !== 'posted' &&
    session.status !== 'cancelled';

  return (
    <ErpPage className="overflow-x-hidden max-w-full relative">
      <ErpPageHeader className="px-4 py-3 md:px-6 md:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between w-full">
          <div className="min-w-0">
            <ErpPageTitle className="flex items-center gap-2 text-xl sm:text-2xl">
              <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
              Inventory Count
            </ErpPageTitle>
            <ErpPageDescription className="hidden sm:block">
              Physical count is draft until posted. Live stock stays on stock movements only.
              Difference posts as Physical − Count Baseline (later movements stay intact).
            </ErpPageDescription>
            {previewMode ? (
              <div
                className="mt-2 rounded-md border border-fuchsia-500/60 bg-fuchsia-500/15 px-3 py-2 text-sm max-w-xl"
                role="status"
              >
                <div className="font-semibold text-fuchsia-200">{STOCK_COUNT_PREVIEW_BANNER}</div>
              </div>
            ) : null}
            <div
              className={`mt-2 rounded-md border px-3 py-2 text-sm max-w-xl ${
                isAllBranchesSession
                  ? 'border-violet-500/50 bg-violet-500/10'
                  : 'border-amber-500/40 bg-amber-500/10'
              }`}
            >
              <div
                className={`font-semibold ${
                  isAllBranchesSession ? 'text-violet-200' : 'text-amber-200'
                }`}
              >
                Count scope: {countScopeLabel}
                {isAllBranchesSession ? ' · multi-branch session' : ' · single branch'}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {isAllBranchesSession ? (
                  <>
                    Search, System Qty, History, and post use{' '}
                    <strong className="text-foreground">every accessible branch</strong> of this
                    company. Physical counts are entered <em>per branch</em> — never one aggregate
                    input. Post creates per-branch movements only.
                  </>
                ) : (
                  <>
                    This session (search, System Qty, History, and post) uses{' '}
                    <strong className="text-foreground">{countScopeLabel}</strong> only.
                  </>
                )}
                {globalBranchLabel === 'All Branches' || branchId === 'all' ? (
                  <>
                    {' '}
                    App header filter is <em>All Branches</em>
                    {!isAllBranchesSession
                      ? ' — that does not make this an all-branch count.'
                      : ' (matches this session scope for the selected company).'}
                  </>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex flex-col xs:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <select
              className={cn(
                TOUCH_BTN,
                'rounded-md border border-border bg-background px-3 text-sm w-full sm:w-auto sm:min-w-[200px]'
              )}
              value={selectedBranchId}
              disabled={!!session && !locked}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                setSession(null);
                setLines([]);
              }}
              aria-label="Count session branch scope"
            >
              <option value="">Select scope…</option>
              <option value={ALL_BRANCHES_SCOPE}>All Branches (this company)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            {!session && !previewMode && (
              <div className="flex flex-wrap gap-2">
                <Button
                  className={cn(TOUCH_BTN, 'flex-1 sm:flex-none')}
                  onClick={createSession}
                  disabled={busy || !canCount || !selectedBranchId}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'New count session'}
                </Button>
                <Button
                  variant="secondary"
                  className={cn(TOUCH_BTN, 'flex-1 sm:flex-none')}
                  onClick={() => enterPreviewMode('baseline3_current8')}
                  title="Safe local fixtures — no DB writes"
                >
                  Preview / Test
                </Button>
              </div>
            )}
            {session && (
              <Button
                variant="outline"
                className={cn(TOUCH_BTN, 'w-full sm:w-auto')}
                onClick={() => {
                  if (previewMode) {
                    exitPreviewMode();
                    return;
                  }
                  setSession(null);
                  setLines([]);
                  setIssues([]);
                  refreshSessions();
                }}
              >
                {previewMode ? 'Exit preview' : 'Back to list'}
              </Button>
            )}
          </div>
        </div>
      </ErpPageHeader>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !session ? (
        <div className="space-y-3 px-4 md:px-0">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Sessions · {countScopeLabel || 'selected scope'}
          </h2>
          {sessions.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8">
              No count sessions yet. Select a physical branch or All Branches, then start a
              session.
            </p>
          ) : (
            <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
              {sessions.map((s) => {
                const allBr = stockCountService.isAllBranchesSession(s);
                return (
                  <button
                    key={s.id}
                    type="button"
                    className="w-full flex items-center justify-between gap-3 px-4 py-3.5 min-h-14 text-left hover:bg-muted/40 touch-manipulation"
                    onClick={() => loadSession(s.id)}
                  >
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                        {allBr ? (
                          <span className="text-violet-300">All Branches</span>
                        ) : (
                          branches.find((b) => b.id === s.branch_id)?.name || s.branch_id
                        )}
                        {allBr ? (
                          <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-violet-500/20 text-violet-300">
                            multi-branch
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {s.updated_at
                          ? new Date(s.updated_at).toLocaleString()
                          : s.id.slice(0, 8)}
                        {s.posted_at
                          ? ` · posted ${new Date(s.posted_at).toLocaleString()}`
                          : ''}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${statusBadge(s.status)}`}>
                      {s.status}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div
          className={cn(
            'space-y-4 px-4 md:px-0',
            /* Clear sticky review bar + BottomNav (md:hidden) + home indicator */
            showReviewPost &&
              'pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:pb-4'
          )}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className={`text-xs px-2 py-1 rounded shrink-0 ${statusBadge(session.status)}`}>
                {session.status}
              </span>
              <span className="text-sm text-muted-foreground truncate">
                Scope: <strong className="text-foreground">{countScopeLabel}</strong>
              </span>
            </div>
            {/* Desktop / tablet session actions — phone uses sticky Review bar */}
            <div className="hidden md:flex flex-wrap gap-2">
              <Button
                variant="outline"
                className={TOUCH_BTN}
                onClick={() => setUnmatchedOpen(true)}
                disabled={locked}
              >
                Unmatched item
              </Button>
              {!locked && session.status !== 'pending_review' && (
                <Button
                  variant="secondary"
                  className={TOUCH_BTN}
                  onClick={onComplete}
                  disabled={busy}
                >
                  Mark complete / review
                </Button>
              )}
              {showReviewPost && (
                <Button
                  className={TOUCH_BTN}
                  onClick={() => setPostConfirmOpen(true)}
                  disabled={busy}
                >
                  {previewMode ? 'Review preview post' : 'Review & post'}
                </Button>
              )}
            </div>
          </div>

          {driftBlocked.length > 0 && (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm space-y-2">
              <div className="font-medium flex items-center gap-2 text-amber-200">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {driftBlocked.length} line(s) marked Stock changed — open History for baseline
                details, then recount or acknowledge before post
              </div>
              <div className="flex flex-wrap gap-2">
                {driftBlocked.map((l) => (
                  <label
                    key={l.id}
                    className="flex items-center gap-2 text-xs border border-border rounded px-2 py-1 max-w-full"
                  >
                    <input
                      type="checkbox"
                      checked={driftAckIds.has(l.id)}
                      onChange={(e) => {
                        setDriftAckIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(l.id);
                          else next.delete(l.id);
                          return next;
                        });
                      }}
                    />
                    <span className="truncate">
                      Acknowledge {(l.product_name || l.id).slice(0, 40)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {!locked && !previewMode && (
            <div className="relative sticky top-0 z-10 -mx-4 px-4 py-2 bg-secondary/95 backdrop-blur-sm md:static md:mx-0 md:px-0 md:py-0 md:bg-transparent md:backdrop-blur-none">
              <Search className="absolute left-7 md:left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                className={cn(TOUCH_BTN, 'pl-9 text-base')}
                placeholder="Search SKU, name, variation…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search products to count"
                enterKeyHint="search"
                autoComplete="off"
              />
              {(searching || searchHits.length > 0 || searchTerm.trim()) && (
                <div className="absolute z-30 left-4 right-4 md:left-0 md:right-0 mt-1 rounded-md border border-border bg-background shadow-lg max-h-[min(20rem,50vh)] overflow-auto">
                  {searching && (
                    <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                    </div>
                  )}
                  {!searching && searchTerm.trim() && searchHits.length === 0 && (
                    <div className="p-3 text-sm text-muted-foreground flex items-center justify-between gap-2">
                      <span>No catalog match — do not invent a product.</span>
                      <Button size="sm" variant="outline" onClick={() => setUnmatchedOpen(true)}>
                        Record unmatched
                      </Button>
                    </div>
                  )}
                  {searchHits.map((hit) => (
                    <button
                      key={`${hit.product_id}:${hit.variation_id || ''}`}
                      type="button"
                      className="w-full flex items-center gap-3 px-3 py-3 min-h-14 text-left hover:bg-muted/50 border-b border-border/50 last:border-0 touch-manipulation"
                      onClick={() => addHit(hit)}
                    >
                      <StockCountThumb src={hit.image_url} alt={hit.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <KindBadge kind={hit.item_kind} />
                          <span className="font-medium truncate">{hit.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          Product SKU {hit.sku || '—'}
                          {hit.variation_sku ? ` · Var SKU ${hit.variation_sku}` : ''}
                          {hit.exact_match ? ' · exact' : ''}
                        </div>
                        {hit.item_kind === 'variation' ? (
                          <div className="text-xs text-foreground/90 truncate">
                            {hit.variation_label ||
                              (hit.attributes_incomplete
                                ? 'Attributes incomplete in catalog'
                                : 'Variation')}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">Single product</div>
                        )}
                      </div>
                      <div className="text-sm tabular-nums text-muted-foreground text-right">
                        <div className="text-[10px] uppercase leading-tight">
                          {isAllBranchesSession
                            ? 'Current System Stock (all)'
                            : 'Current System Stock'}
                        </div>
                        {formatQty(hit.system_qty)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <CountProgressSummary
            total={lines.length}
            counted={counts.counted.length}
            uncounted={counts.uncounted.length}
            variance={counts.variance.length}
            lineFilter={lineFilter}
            onFilter={setLineFilter}
          />

          {/* Phone-only secondary session actions */}
          <div className="flex md:hidden flex-wrap gap-2">
            <Button
              variant="outline"
              className={cn(TOUCH_BTN, 'flex-1')}
              onClick={() => setUnmatchedOpen(true)}
              disabled={locked}
            >
              Unmatched
            </Button>
            {!locked && session.status !== 'pending_review' && (
              <Button
                variant="secondary"
                className={cn(TOUCH_BTN, 'flex-1')}
                onClick={onComplete}
                disabled={busy}
              >
                Mark complete
              </Button>
            )}
          </div>

          {issues.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <div className="font-medium flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4" /> Unmatched issues ({issues.length})
              </div>
              <ul className="space-y-1 text-muted-foreground">
                {issues.map((i) => (
                  <li key={i.id}>
                    {i.description}
                    {i.notes ? ` — ${i.notes}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-3">
            {filteredLines.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No lines yet. Search and add the exact product or variation. Physical Count is
                never prefilled from Current Stock.
              </p>
            ) : isAllBranchesSession ? (
              groupedProducts.map((group) => {
                const sample = group.lines[0];
                const kind =
                  sample.item_kind || (sample.variation_id ? 'variation' : 'product');
                const phys = group.physical;
                const combinedDiff =
                  phys.total == null
                    ? null
                    : Math.round((phys.total - group.systemTotal) * 10000) / 10000;
                /* Collapsed by default — expand for per-branch counts (mobile-friendly). */
                const open = expandedGroups[group.key] ?? false;
                const anyDrift = group.lines.some((l) => l.baseline_drifted);
                const currentTotal = group.lines.reduce(
                  (s, l) => s + Number(l.current_system_qty ?? l.system_qty_baseline),
                  0
                );
                return (
                  <div
                    key={group.key}
                    className="rounded-lg border border-violet-500/30 overflow-hidden"
                  >
                    <div className="p-3 sm:p-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4 bg-violet-500/5">
                      <ProductIdentityBlock
                        kind={kind}
                        name={sample.product_name}
                        productSku={sample.product_sku}
                        variationSku={sample.variation_sku}
                        variationLabel={sample.variation_label}
                        attributesIncomplete={sample.attributes_incomplete}
                        imageUrl={sample.image_url}
                        drifted={anyDrift}
                        statusLine={`${group.lines.length} branches · open History for baseline details`}
                      />
                      <CountMetrics
                        current={currentTotal}
                        physical={phys.total}
                        difference={combinedDiff}
                        countStatus={
                          phys.total == null
                            ? 'uncounted'
                            : phys.total === 0
                              ? 'counted_zero'
                              : 'counted_qty'
                        }
                        drifted={anyDrift}
                        partialPhysical={phys.partial}
                      />
                      <div className="flex flex-wrap gap-2 xl:ml-auto shrink-0 w-full xl:w-auto">
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(TOUCH_BTN, 'flex-1 xl:flex-none gap-1')}
                          onClick={() =>
                            setExpandedGroups((m) => ({ ...m, [group.key]: !open }))
                          }
                          aria-expanded={open}
                        >
                          {open ? 'Hide branches' : 'Count by branch'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(TOUCH_BTN, 'flex-1 xl:flex-none gap-1')}
                          onClick={() => {
                            setHistoryLine(null);
                            setHistoryProductGroup({
                              product_id: group.product_id,
                              variation_id: group.variation_id,
                              lines: group.lines,
                            });
                          }}
                        >
                          <History className="h-4 w-4" />
                          History
                        </Button>
                      </div>
                    </div>
                    {open && (
                      <div className="divide-y divide-border border-t border-border">
                        {group.lines.map((line) => {
                          const uncounted = line.count_status === 'uncounted';
                          const bDiff = branchDifference(
                            line.physical_qty,
                            line.system_qty_baseline
                          );
                          return (
                            <div
                              key={line.id}
                              className="p-3 sm:pl-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4 bg-background/80"
                            >
                              <div className="min-w-[9rem] shrink-0 flex items-center gap-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">
                                    {branchNameById(line.branch_id)}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {uncounted
                                      ? 'Uncounted'
                                      : line.count_status === 'counted_zero'
                                        ? 'Counted 0'
                                        : 'Counted'}
                                    {' · '}pass {line.active_pass_number}
                                  </div>
                                </div>
                                <StockChangedBadge visible={!!line.baseline_drifted} />
                              </div>
                              <CountMetrics
                                compact
                                current={line.current_system_qty}
                                physical={uncounted ? null : line.physical_qty}
                                difference={bDiff}
                                countStatus={line.count_status}
                                drifted={!!line.baseline_drifted}
                              />
                              <CountRowActions
                                line={line}
                                locked={locked}
                                uncounted={uncounted}
                                directValue={
                                  directQtyDraft[line.id] ??
                                  (uncounted ? '' : String(line.physical_qty ?? ''))
                                }
                                onDirectChange={(value) =>
                                  setDirectQtyDraft((d) => ({ ...d, [line.id]: value }))
                                }
                                onHistory={() => {
                                  setHistoryProductGroup(null);
                                  setHistoryLine(line);
                                }}
                                onIncrement={() => onIncrement(line)}
                                onDecrement={() => onDecrement(line)}
                                onSetDirect={() => onSetDirect(line)}
                                onConfirmZero={() => onConfirmZero(line)}
                                onRecount={() => onRecount(line)}
                                historyLabel="History"
                              />
                            </div>
                          );
                        })}
                        {group.lines.some(
                          (l) =>
                            l.difference != null && Math.abs(Number(l.difference)) > 0.0000001
                        ) &&
                          combinedDiff === 0 && (
                            <div className="px-4 py-2 text-xs text-amber-300 bg-amber-500/10">
                              Combined totals match, but branch differences remain. Open History
                              for details — post still adjusts each branch (no auto-transfer).
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              filteredLines.map((line) => {
                const diff = line.difference;
                const uncounted = line.count_status === 'uncounted';
                const kind = line.item_kind || (line.variation_id ? 'variation' : 'product');
                const statusLine = [
                  uncounted
                    ? 'Not counted yet'
                    : line.count_status === 'counted_zero'
                      ? 'Counted 0'
                      : 'Counted',
                  `Pass ${line.active_pass_number}`,
                ].join(' · ');
                return (
                  <div
                    key={line.id}
                    className="rounded-lg border border-border p-3 sm:p-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4"
                  >
                    <ProductIdentityBlock
                      kind={kind}
                      name={line.product_name}
                      productSku={line.product_sku}
                      variationSku={line.variation_sku}
                      variationLabel={line.variation_label}
                      attributesIncomplete={line.attributes_incomplete}
                      imageUrl={line.image_url}
                      drifted={!!line.baseline_drifted}
                      statusLine={statusLine}
                    />

                    <CountMetrics
                      current={line.current_system_qty}
                      physical={uncounted ? null : line.physical_qty}
                      difference={diff}
                      countStatus={line.count_status}
                      drifted={!!line.baseline_drifted}
                    />

                    <CountRowActions
                      line={line}
                      locked={locked}
                      uncounted={uncounted}
                      directValue={
                        directQtyDraft[line.id] ??
                        (uncounted ? '' : String(line.physical_qty ?? ''))
                      }
                      onDirectChange={(value) =>
                        setDirectQtyDraft((d) => ({ ...d, [line.id]: value }))
                      }
                      onHistory={() => {
                        setHistoryProductGroup(null);
                        setHistoryLine(line);
                      }}
                      onIncrement={() => onIncrement(line)}
                      onDecrement={() => onDecrement(line)}
                      onSetDirect={() => onSetDirect(line)}
                      onConfirmZero={() => onConfirmZero(line)}
                      onRecount={() => onRecount(line)}
                    />
                  </div>
                );
              })
            )}
          </div>

          {session.status === 'posted' && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                Posted {session.posted_at ? new Date(session.posted_at).toLocaleString() : ''}.
                Non-zero variances created stock movements (
                <code className="text-xs">reference_type=stock_count</code>). Zero-variance lines
                reconciled without a movement.
              </div>
            </div>
          )}

          {/* Phone sticky Review & post — sits above BottomNav + safe area */}
          {showReviewPost && (
            <div
              className="md:hidden fixed inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm px-4 pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.25)]"
              style={{
                bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))',
                paddingBottom: '0.75rem',
              }}
            >
              <Button
                className={cn(TOUCH_BTN, 'w-full text-base font-semibold')}
                onClick={() => setPostConfirmOpen(true)}
                disabled={busy || driftBlocked.length > 0}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : previewMode ? (
                  'Review preview post'
                ) : (
                  `Review & post · ${counts.counted.length} counted`
                )}
              </Button>
              {driftBlocked.length > 0 ? (
                <p className="text-[11px] text-amber-300 mt-1.5 text-center">
                  Resolve Stock changed lines before posting
                </p>
              ) : null}
            </div>
          )}
        </div>
      )}

      <StockCountHistoryDrawer
        open={!!historyLine || !!historyProductGroup}
        onClose={() => {
          setHistoryLine(null);
          setHistoryProductGroup(null);
        }}
        companyId={companyId || 'preview'}
        branchId={
          historyLine?.branch_id ||
          session?.branch_id ||
          (selectedBranchId !== ALL_BRANCHES_SCOPE ? selectedBranchId : null)
        }
        branchIds={
          historyProductGroup
            ? historyProductGroup.lines
                .map((l) => l.branch_id)
                .filter((id): id is string => !!id)
            : isAllBranchesSession && !historyLine
              ? branches.map((b) => b.id)
              : undefined
        }
        branchName={
          historyLine?.branch_id
            ? branchNameById(historyLine.branch_id)
            : countScopeLabel
        }
        branchNames={Object.fromEntries(branches.map((b) => [b.id, b.name]))}
        allBranchesScope={!!historyProductGroup || (isAllBranchesSession && !historyLine)}
        previewMovements={
          previewMode && previewHistory && historyLine
            ? (() => {
                const withBal = withRunningBalance(previewHistory.movements);
                return {
                  movements: withBal.map((m) => ({
                    ...m,
                    category: categorizeStockMovement(m),
                    product_id: historyLine.product_id,
                    branch_id: historyLine.branch_id || undefined,
                    variation_id: historyLine.variation_id,
                    company_id: companyId || 'preview',
                  })) as any,
                  totals: {
                    opening: 0,
                    purchase: 8,
                    purchase_return: 0,
                    sale: 0,
                    sale_return: 0,
                    rental_out: 0,
                    rental_in: 0,
                    transfer_in: 0,
                    transfer_out: 0,
                    production_in: 0,
                    production_out: 0,
                    adjustment: 0,
                    other: 0,
                  },
                  system_qty: 8,
                  countBaseline: 3,
                  movementsSinceBaseline: previewHistory.movements.filter(
                    (m) => m.created_at > (historyLine.baseline_at || '')
                  ),
                  ledgerSummary: summarizeStockMovements(previewHistory.movements),
                  outstandingRentSummary: summarizeStockMovements(previewHistory.movements),
                };
              })()
            : null
        }
        line={
          historyLine ||
          (historyProductGroup
            ? {
                ...historyProductGroup.lines[0],
                id: historyProductGroup.lines[0]?.id || 'group',
                branch_id: null,
                system_qty_baseline: historyProductGroup.lines.reduce(
                  (s, l) => s + Number(l.system_qty_baseline || 0),
                  0
                ),
              }
            : null)
        }
      />

      <Dialog open={unmatchedOpen} onOpenChange={setUnmatchedOpen}>
        <DialogContent className="max-h-[min(90dvh,40rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record unmatched item</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Does not create a product or stock movement — review only.
          </p>
          <Input
            placeholder="What did you find?"
            value={unmatchedDesc}
            onChange={(e) => setUnmatchedDesc(e.target.value)}
          />
          <Input
            placeholder="Notes (optional)"
            value={unmatchedNotes}
            onChange={(e) => setUnmatchedNotes(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnmatchedOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveUnmatched} disabled={busy}>
              Save issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={postConfirmOpen} onOpenChange={setPostConfirmOpen}>
        <DialogContent className="max-h-[min(90dvh,40rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Post stock count?</DialogTitle>
          </DialogHeader>
          <div className="text-sm space-y-2 text-muted-foreground">
            <p>
              Posting formula:{' '}
              <strong className="text-foreground">
                adjustment = Physical Count − Count Baseline
              </strong>{' '}
              (not Current System Stock). Later movements after the baseline stay intact.
              Scope: <strong className="text-foreground">{countScopeLabel}</strong>.
              {isAllBranchesSession
                ? ' Each branch variance posts its own movement — never one company aggregate.'
                : null}
            </p>
            <p>
              Counted: {counts.counted.length} · Uncounted: {counts.uncounted.length} · Variance
              lines: {counts.variance.length}
            </p>
            {driftBlocked.length > 0 && (
              <p className="text-amber-400">
                {driftBlocked.length} drifted line(s) still need recount or acknowledge
                checkbox.
              </p>
            )}
            {previewMode && (
              <p className="text-fuchsia-300 font-medium">
                Preview mode — Confirm runs a dry-run only (0 stock movements).
              </p>
            )}
            {counts.uncounted.length > 0 && (
              <p className="text-amber-400">
                Uncounted lines will be skipped (partial post). Prefer counting them first.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPostConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={onPost}
              disabled={
                busy ||
                (!previewMode && !canPost) ||
                driftBlocked.length > 0
              }
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : previewMode ? (
                'Preview post (no writes)'
              ) : (
                'Confirm post'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ErpPage>
  );
};

export default InventoryCountPage;
