/**
 * Import FX Case workspace — guided UA shell (Arrange 1–5 + W3 money stages).
 * Cases/Context in drawers; stage-scoped CTAs. Path 21 Agent FX remains separate.
 * W4+ remain blocked. No journals from ARRANGEMENT confirm.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, Loader2, List, PanelRight, Plus, RefreshCw, X } from 'lucide-react';import { toast } from 'sonner';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { SearchableSelect } from '@/app/components/ui/searchable-select';
import { Textarea } from '@/app/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/app/components/ui/sheet';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useSettings } from '@/app/context/SettingsContext';
import {
  normalizeImportDocCurrency,
  resolveActiveImportCurrencies,
  type ImportDocCurrency,
} from '@/app/lib/importFxHelpers';
import {
  INDICATIVE_RATE_HELPER_COPY,
  fetchIndicativeRates,
  formatIndicativeRateLabel,
  pickIndicativeFieldsToApply,
  rateToInputString,
  type IndicativeRateBundle,
} from '@/app/lib/importFxIndicativeRates';
import {
  PLANNED_CURRENCY_NO_CONVERT_COPY,
  PLANNED_CURRENCY_PURCHASE_COPY,
  PLANNED_CURRENCY_SETTLE_COPY,
  pickSyncedAmountsToApply,
  syncPlannedAmounts,
  type PlannedAmountDriver,
} from '@/app/lib/importFxPlannedAmountSync';
import { formatImportFxServerError } from '@/app/lib/importFxServerGate';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import {
  canEditArrangementType,
  isMoneyStageBlockedInW2,
  isW2ConfirmableStage,
  W2_MONEY_STAGE_BLOCKED_COPY,
  type ImportFxFundingMode,
} from '@/app/lib/importFxCaseHelpers';
import { isW3MoneyStage } from '@/app/lib/importFxCaseW3Helpers';
import { ImportFxCaseW3MoneyPanel } from '@/app/features/import-fx-case/ImportFxCaseW3MoneyPanel';
import { ImportFxW3DemoEntryLink } from '@/app/features/import-fx-case/ImportFxW3DemoPage';
import { useAccounting } from '@/app/context/AccountingContext';
import {
  ARRANGEMENT_GUIDED_STEPS,
  SCHEDULE_FIELD_CHIPS,
  SCHEDULE_QUICK_PLANS,
  W2_ACTION_BAR_CLASS,
  W2_FUNDING_INTENTION_OPTIONS,
  W2_GUIDED_BODY_CLASS,
  W2_GUIDED_FOOTER_CLASS,
  W2_GUIDED_MAIN_CLASS,
  W2_WORKSPACE_PANEL_CLASS,
  W2_WORKSPACE_SHELL_CLASS,
  applyScheduleQuickPlan,
  cascadeFromArrangementChange,
  clampArrangementStep,
  createExclusiveBusyGuard,
  formatAccountingStatusLabel,
  formatArrangementStatusLabel,
  formatMoneyExchangeOption,
  formatPurchasePlanningOption,
  guidedProgressItems,
  guidedTaskCopy,
  isArrangementLocked,
  matchesPlanningSearch,
  resolveScheduleFieldChip,
  resolveWorkspaceMode,
  thirdPartyOptionsExcludingAgent,
  validateArrangementGuidedStep,
  validateArrangementPlanning,
  workspaceActions,
  type ArrangementGuidedStep,
  type ScheduleFieldKey,
  type ScheduleQuickPlanId,
  type W2BusyAction,
} from '@/app/lib/importFxCaseWorkspaceView';
import {
  W21_HISTORICAL_MISSING_AGENT_WARNING,
  W21_PATH_CLARITY_AGENT_FX_COPY,
  W21_PATH_CLARITY_CASE_COPY,
  W21_PATH_CLARITY_LEAVE_WARNING,
  W21_PLANNING_NOT_POSTED_BADGE,
  W21_RATE_LABEL_CNY_PER_USD,
  W21_WALLET_SOURCE_GUIDANCE,
  buildFundingSummaryView,
  isHistoricalConfirmedMissingAgent,
  normalizeAdvanceForFundingMode,
} from '@/app/lib/importFxCaseW21Helpers';
import { contactService } from '@/app/services/contactService';
import { supabase } from '@/lib/supabase';
import {
  cancelImportFxCaseUnposted,
  confirmImportFxCaseStage,
  createImportFxCase,
  getImportFxCase,
  linkImportFxCaseTarget,
  listImportFxCases,
  registerImportFxCaseAttachmentMetadata,
  updateImportFxCaseDraft,
  type ImportFxArrangementType,
  type ImportFxCase,
  type ImportFxCaseAttachmentMeta,
  type ImportFxCaseEvent,
  type ImportFxCaseLink,
  type ImportFxCaseStage,
  type ImportFxStageCode,
} from '@/app/services/importFxCaseService';
import { cn } from '@/app/components/ui/utils';
import {
  ArrangementSectionCard,
} from './ImportFxCaseArrangementPanels';
import { ImportFxCaseAssignmentPanel } from './ImportFxCaseAssignmentPanel';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type AgentOption = ReturnType<typeof formatMoneyExchangeOption>;
type PurchaseOption = ReturnType<typeof formatPurchasePlanningOption>;
type ContactOption = { id: string; name: string };

function numOrNull(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function ImportFxCaseWorkspace({ open, onOpenChange }: Props) {
  const { companyId, branchId, user } = useSupabase();
  const { accountingSettings } = useSettings();
  const { accounts } = useAccounting();
  const { currency: companyBaseCurrency } = useFormatCurrency();
  const multiCurrencyEnabled = accountingSettings?.multiCurrencyEnabled === true;
  const readOnly = !multiCurrencyEnabled;
  const activeCurrencies = useMemo(
    () => resolveActiveImportCurrencies(accountingSettings),
    [accountingSettings]
  );

  const [loadingList, setLoadingList] = useState(false);
  const [cases, setCases] = useState<ImportFxCase[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'DRAFT' | 'ARRANGED'>('all');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [caseRow, setCaseRow] = useState<ImportFxCase | null>(null);
  const [stages, setStages] = useState<ImportFxCaseStage[]>([]);
  const [events, setEvents] = useState<ImportFxCaseEvent[]>([]);
  const [links, setLinks] = useState<ImportFxCaseLink[]>([]);
  const [attachments, setAttachments] = useState<ImportFxCaseAttachmentMeta[]>([]);
  const [activeStage, setActiveStage] = useState<ImportFxStageCode>('ARRANGEMENT');
  const [arrangementStep, setArrangementStep] = useState<ArrangementGuidedStep>(1);
  const [casesDrawerOpen, setCasesDrawerOpen] = useState(false);
  const [contextDrawerOpen, setContextDrawerOpen] = useState(false);
  const [pathClarityOpen, setPathClarityOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<W2BusyAction>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const busyGuardRef = useRef(createExclusiveBusyGuard());

  const [agentOptions, setAgentOptions] = useState<AgentOption[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<ContactOption[]>([]);
  const [purchaseRows, setPurchaseRows] = useState<
    Array<{
      id: string;
      purchase_number?: string | null;
      invoice_number?: string | null;
      supplier_id?: string | null;
      document_currency?: string | null;
    }>
  >([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [purchasesLoading, setPurchasesLoading] = useState(false);

  const [agentId, setAgentId] = useState('');
  const [thirdPartyId, setThirdPartyId] = useState('');
  const [arrangementType, setArrangementType] =
    useState<ImportFxArrangementType>('POOLED_USD_CNY');
  const [fundingMode, setFundingMode] = useState<ImportFxFundingMode | ''>('CREDIT');
  const [plannedCurrency, setPlannedCurrency] = useState<ImportDocCurrency | string>('USD');
  const [plannedSettlementCurrency, setPlannedSettlementCurrency] = useState<string>('CNY');
  const [plannedUsd, setPlannedUsd] = useState('');
  const [expectedPkrPerUsd, setExpectedPkrPerUsd] = useState('');
  const [expectedCnyPerUsd, setExpectedCnyPerUsd] = useState('');
  const [indicativeBasePerCny, setIndicativeBasePerCny] = useState('');
  const [expectedCny, setExpectedCny] = useState('');
  const [expectedFees, setExpectedFees] = useState('');
  const [expectedArrangementDate, setExpectedArrangementDate] = useState('');
  const [expectedAdvanceDate, setExpectedAdvanceDate] = useState('');
  const [expectedUsdDate, setExpectedUsdDate] = useState('');
  const [expectedAdvanceAmountPkr, setExpectedAdvanceAmountPkr] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [scheduleCascadeActive, setScheduleCascadeActive] = useState(false);
  const [activeSchedulePlan, setActiveSchedulePlan] = useState<ScheduleQuickPlanId | null>(null);
  const [agentReference, setAgentReference] = useState('');
  const [notes, setNotes] = useState('');

  const [linkSupplierId, setLinkSupplierId] = useState('');
  const [linkPurchaseId, setLinkPurchaseId] = useState('');
  const [attachmentFileName, setAttachmentFileName] = useState('');

  const [rateDirtyPkrPerUsd, setRateDirtyPkrPerUsd] = useState(false);
  const [rateDirtyCnyPerUsd, setRateDirtyCnyPerUsd] = useState(false);
  const [rateDirtyBasePerCny, setRateDirtyBasePerCny] = useState(false);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [lastIndicativeQuote, setLastIndicativeQuote] = useState<IndicativeRateBundle | null>(
    null
  );
  const [amountDriver, setAmountDriver] = useState<PlannedAmountDriver>('usd');
  const [amountDirtyUsd, setAmountDirtyUsd] = useState(false);
  const [amountDirtyCny, setAmountDirtyCny] = useState(false);
  const [amountDirtyPkr, setAmountDirtyPkr] = useState(false);

  const createClientOpRef = useRef<string | null>(null);
  const confirmClientOpRef = useRef<string | null>(null);
  const attachmentClientOpRef = useRef<string | null>(null);
  const ratesFetchGenRef = useRef(0);

  const thirdPartyOptions = useMemo(
    () => thirdPartyOptionsExcludingAgent(agentOptions, agentId),
    [agentOptions, agentId]
  );

  const purchaseOptions: PurchaseOption[] = useMemo(
    () =>
      purchaseRows.map((p) =>
        formatPurchasePlanningOption({
          id: p.id,
          purchaseNumber: p.purchase_number,
          invoiceNumber: p.invoice_number,
          supplierName: supplierOptions.find((s) => s.id === p.supplier_id)?.name || null,
          documentCurrency: p.document_currency,
        })
      ),
    [purchaseRows, supplierOptions]
  );

  const arrangementStageStatus = useMemo(
    () => stages.find((s) => s.stage_code === 'ARRANGEMENT')?.stage_status ?? null,
    [stages]
  );

  const arrangementLocked = isArrangementLocked({
    arrangementConfirmedAt: caseRow?.arrangement_confirmed_at ?? null,
    arrangementStageStatus,
    operationalStatus: caseRow?.operational_status ?? null,
  });

  const workspaceMode = resolveWorkspaceMode({
    multiCurrencyEnabled,
    selectedCaseId,
    arrangementLocked: selectedCaseId ? arrangementLocked : false,
  });

  const actions = workspaceActions({
    mode: workspaceMode,
    busy,
    busyAction,
    accountingStatus: caseRow?.accounting_status ?? 'NOT_POSTED',
    operationalStatus: caseRow?.operational_status ?? (selectedCaseId ? 'DRAFT' : null),
    activeStage,
    arrangementStep,
  });

  const progressItems = useMemo(
    () =>
      guidedProgressItems({
        activeStage,
        arrangementLocked: selectedCaseId ? arrangementLocked : false,
      }),
    [activeStage, arrangementLocked, selectedCaseId]
  );

  const taskCopy = useMemo(
    () =>
      guidedTaskCopy({
        activeStage,
        arrangementStep,
        arrangementLocked: selectedCaseId ? arrangementLocked : false,
      }),
    [activeStage, arrangementStep, arrangementLocked, selectedCaseId]
  );

  const arrangementTypeEditable = canEditArrangementType({
    operationalStatus: caseRow?.operational_status ?? 'DRAFT',
    arrangementStageStatus,
    arrangementConfirmedAt: caseRow?.arrangement_confirmed_at ?? null,
  });

  const fieldsLocked = actions.fieldsLocked;
  const agentName =
    agentOptions.find((a) => a.id === (agentId || caseRow?.agent_contact_id || ''))?.name || null;

  const fundingSummary = buildFundingSummaryView({
    fundingMode,
    plannedUsd: numOrNull(plannedUsd),
    pkrPerUsd: numOrNull(expectedPkrPerUsd),
    feesPkr: numOrNull(expectedFees),
    advancePkr: numOrNull(expectedAdvanceAmountPkr),
  });

  const missingAgentWarning = isHistoricalConfirmedMissingAgent({
    arrangementConfirmedAt: caseRow?.arrangement_confirmed_at,
    arrangementStageStatus,
    operationalStatus: caseRow?.operational_status,
    agentContactId: caseRow?.agent_contact_id ?? agentId,
    arrangementType: caseRow?.arrangement_type ?? arrangementType,
  });

  const pkrPerUsdLabel =
    companyBaseCurrency === 'PKR'
      ? formatIndicativeRateLabel(companyBaseCurrency, 'USD')
      : 'Indicative PKR per 1 USD';
  const basePerCnyLabel = formatIndicativeRateLabel(companyBaseCurrency, 'CNY');
  const showBasePerCnyField = companyBaseCurrency !== 'CNY';
  const purchaseLeg: 'USD' | 'CNY' =
    normalizeImportDocCurrency(String(plannedCurrency)) === 'CNY' ? 'CNY' : 'USD';
  const settlementNorm = normalizeImportDocCurrency(String(plannedSettlementCurrency));
  const settleSameAsPurchase = settlementNorm === purchaseLeg;

  const runAmountSync = useCallback(
    (opts: {
      driver: PlannedAmountDriver;
      forceReplace: boolean;
      plannedUsd?: string;
      expectedCny?: string;
      advancePkr?: string;
      pkrPerUsd?: string;
      cnyPerUsd?: string;
      pkrPerCny?: string;
      sourceCurrency?: string;
      settlementCurrency?: string;
    }) => {
      const sync = syncPlannedAmounts({
        sourceCurrency: opts.sourceCurrency ?? String(plannedCurrency),
        settlementCurrency: opts.settlementCurrency ?? String(plannedSettlementCurrency),
        driver: opts.driver,
        plannedUsd: numOrNull(opts.plannedUsd ?? plannedUsd),
        expectedCny: numOrNull(opts.expectedCny ?? expectedCny),
        advancePkr: numOrNull(opts.advancePkr ?? expectedAdvanceAmountPkr),
        pkrPerUsd: numOrNull(opts.pkrPerUsd ?? expectedPkrPerUsd),
        cnyPerUsd: numOrNull(opts.cnyPerUsd ?? expectedCnyPerUsd),
        pkrPerCny: numOrNull(opts.pkrPerCny ?? indicativeBasePerCny),
      });
      const picked = pickSyncedAmountsToApply({
        sync,
        driver: opts.driver,
        dirtyUsd: amountDirtyUsd,
        dirtyCny: amountDirtyCny,
        dirtyPkr: amountDirtyPkr,
        forceReplace: opts.forceReplace,
      });
      if (picked.plannedUsd != null) {
        setPlannedUsd(picked.plannedUsd);
        if (opts.forceReplace) setAmountDirtyUsd(false);
      }
      if (picked.expectedCny != null) {
        setExpectedCny(picked.expectedCny);
        if (opts.forceReplace) setAmountDirtyCny(false);
      }
      if (picked.advancePkr != null) {
        setExpectedAdvanceAmountPkr(picked.advancePkr);
        if (opts.forceReplace) setAmountDirtyPkr(false);
      }
    },
    [
      amountDirtyCny,
      amountDirtyPkr,
      amountDirtyUsd,
      expectedAdvanceAmountPkr,
      expectedCny,
      expectedCnyPerUsd,
      expectedPkrPerUsd,
      indicativeBasePerCny,
      plannedCurrency,
      plannedSettlementCurrency,
      plannedUsd,
    ]
  );

  const applyIndicativeBundle = useCallback(
    (bundle: IndicativeRateBundle, forceReplace: boolean) => {
      const picked = pickIndicativeFieldsToApply({
        bundle,
        dirtyPkrPerUsd: rateDirtyPkrPerUsd,
        dirtyCnyPerUsd: rateDirtyCnyPerUsd,
        dirtyBasePerCny: rateDirtyBasePerCny,
        forceReplace,
        currentPkrPerUsd: expectedPkrPerUsd,
        currentCnyPerUsd: expectedCnyPerUsd,
        currentBasePerCny: indicativeBasePerCny,
      });
      const nextPkr = picked.pkrPerUsd ?? expectedPkrPerUsd;
      const nextCny = picked.cnyPerUsd ?? expectedCnyPerUsd;
      const nextBase =
        picked.basePerCny != null && showBasePerCnyField
          ? picked.basePerCny
          : indicativeBasePerCny;
      if (picked.pkrPerUsd != null) {
        setExpectedPkrPerUsd(picked.pkrPerUsd);
        if (forceReplace) setRateDirtyPkrPerUsd(false);
      }
      if (picked.cnyPerUsd != null) {
        setExpectedCnyPerUsd(picked.cnyPerUsd);
        if (forceReplace) setRateDirtyCnyPerUsd(false);
      }
      if (picked.basePerCny != null && showBasePerCnyField) {
        setIndicativeBasePerCny(picked.basePerCny);
        if (forceReplace) setRateDirtyBasePerCny(false);
      }
      setLastIndicativeQuote(bundle);
      runAmountSync({
        driver: amountDriver,
        forceReplace,
        pkrPerUsd: nextPkr,
        cnyPerUsd: nextCny,
        pkrPerCny: nextBase,
      });
    },
    [
      amountDriver,
      expectedCnyPerUsd,
      expectedPkrPerUsd,
      indicativeBasePerCny,
      rateDirtyBasePerCny,
      rateDirtyCnyPerUsd,
      rateDirtyPkrPerUsd,
      runAmountSync,
      showBasePerCnyField,
    ]
  );

  const refreshIndicativeRates = useCallback(
    async (opts?: { forceReplace?: boolean; silent?: boolean }) => {
      if (fieldsLocked || readOnly) return;
      const forceReplace = opts?.forceReplace === true;
      const silent = opts?.silent === true;
      const gen = ++ratesFetchGenRef.current;
      setRatesLoading(true);
      try {
        const bundle = await fetchIndicativeRates({
          baseCurrency: companyBaseCurrency || 'PKR',
          symbols: [String(plannedCurrency), String(plannedSettlementCurrency), 'USD', 'CNY'],
        });
        if (gen !== ratesFetchGenRef.current) return;
        applyIndicativeBundle(bundle, forceReplace);
        if (!silent) {
          toast.success('Indicative rates updated — not financially posted');
        }
      } catch (e) {
        if (gen !== ratesFetchGenRef.current) return;
        const msg = e instanceof Error ? e.message : 'Indicative rate request failed';
        if (!silent) toast.error(msg);
      } finally {
        if (gen === ratesFetchGenRef.current) setRatesLoading(false);
      }
    },
    [
      applyIndicativeBundle,
      companyBaseCurrency,
      fieldsLocked,
      plannedCurrency,
      plannedSettlementCurrency,
      readOnly,
    ]
  );

  useEffect(() => {
    if (!open || fieldsLocked || readOnly) return;
    const needsSoftFill =
      !String(expectedPkrPerUsd).trim() ||
      !String(expectedCnyPerUsd).trim() ||
      (showBasePerCnyField && !String(indicativeBasePerCny).trim());
    if (!needsSoftFill) return;
    void refreshIndicativeRates({ forceReplace: false, silent: true });
    // Soft-fill once when currencies / workspace open with empty rate fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: currency keys + open/lock only
  }, [
    open,
    fieldsLocked,
    readOnly,
    companyBaseCurrency,
    plannedCurrency,
    plannedSettlementCurrency,
  ]);

  const loadContacts = useCallback(async () => {
    if (!companyId) return;
    setContactsLoading(true);
    try {
      const contacts = await contactService.getContacts(companyId);
      const list = contacts || [];
      const agents = list
        .filter((c: { type?: string }) => String(c.type || '').toLowerCase() === 'money_exchange')
        .map((c: { id: string; name?: string; code?: string; phone?: string; mobile?: string }) =>
          formatMoneyExchangeOption(c)
        );
      const suppliers = list
        .filter((c: { type?: string }) => {
          const t = String(c.type || '').toLowerCase();
          return t === 'supplier' || t === 'both';
        })
        .map((c: { id: string; name?: string; code?: string }) => ({
          id: c.id,
          name: `${c.name || 'Supplier'}${c.code ? ` (${c.code})` : ''}`,
        }));
      setAgentOptions(agents);
      setSupplierOptions(suppliers);
    } catch {
      setAgentOptions([]);
      setSupplierOptions([]);
    } finally {
      setContactsLoading(false);
    }
  }, [companyId]);

  const loadPurchases = useCallback(async () => {
    if (!companyId) return;
    setPurchasesLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchases')
        .select('id, purchase_number, invoice_number, supplier_id, document_currency, total')
        .eq('company_id', companyId)
        .limit(50);
      if (error) throw error;
      setPurchaseRows(data || []);
    } catch {
      try {
        const { data } = await supabase
          .from('purchases')
          .select('id, notes, supplier_id')
          .eq('company_id', companyId)
          .limit(50);
        setPurchaseRows(
          (data || []).map((p: { id: string; notes?: string | null; supplier_id?: string | null }) => ({
            id: p.id,
            purchase_number: p.notes,
            supplier_id: p.supplier_id,
          }))
        );
      } catch {
        setPurchaseRows([]);
      }
    } finally {
      setPurchasesLoading(false);
    }
  }, [companyId]);

  const refreshList = useCallback(async () => {
    if (!companyId) return;
    setLoadingList(true);
    try {
      const { rows } = await listImportFxCases({
        companyId,
        branchId: branchId ?? null,
        search: search.trim() || null,
        operationalStatus: statusFilter === 'all' ? null : statusFilter,
        limit: 50,
      });
      setCases(rows);
    } catch (e) {
      toast.error(formatImportFxServerError(e));
    } finally {
      setLoadingList(false);
    }
  }, [companyId, branchId, search, statusFilter]);

  const applyCaseToForm = (detailCase: ImportFxCase) => {
    setAgentId(detailCase.agent_contact_id || '');
    setThirdPartyId(detailCase.third_party_contact_id || '');
    setArrangementType(detailCase.arrangement_type || 'POOLED_USD_CNY');
    setFundingMode(detailCase.funding_mode || '');
    setPlannedCurrency(detailCase.planned_source_currency || 'USD');
    setPlannedSettlementCurrency(detailCase.planned_settlement_currency || 'CNY');
    setPlannedUsd(
      detailCase.planned_usd_amount != null ? String(detailCase.planned_usd_amount) : ''
    );
    setExpectedPkrPerUsd(
      detailCase.expected_pkr_per_usd != null ? String(detailCase.expected_pkr_per_usd) : ''
    );
    setExpectedCnyPerUsd(
      detailCase.expected_cny_per_usd != null ? String(detailCase.expected_cny_per_usd) : ''
    );
    setIndicativeBasePerCny('');
    setExpectedCny(
      detailCase.expected_cny_amount != null ? String(detailCase.expected_cny_amount) : ''
    );
    setExpectedFees(
      detailCase.expected_fees_pkr != null ? String(detailCase.expected_fees_pkr) : ''
    );
    setExpectedArrangementDate(detailCase.expected_arrangement_date || '');
    setExpectedAdvanceDate(detailCase.expected_advance_date || '');
    setExpectedUsdDate(detailCase.expected_usd_acquisition_date || '');
    setExpectedAdvanceAmountPkr(
      detailCase.expected_advance_amount_pkr != null
        ? String(detailCase.expected_advance_amount_pkr)
        : ''
    );
    setExpectedDate(detailCase.expected_completion_date || '');
    setAgentReference(detailCase.agent_reference || '');
    setNotes(detailCase.notes || '');
    setRateDirtyPkrPerUsd(false);
    setRateDirtyCnyPerUsd(false);
    setRateDirtyBasePerCny(false);
    setLastIndicativeQuote(null);
    setAmountDriver(
      normalizeImportDocCurrency(detailCase.planned_source_currency || 'USD') === 'CNY'
        ? 'cny'
        : 'usd'
    );
    setAmountDirtyUsd(false);
    setAmountDirtyCny(false);
    setAmountDirtyPkr(false);
    setFormErrors([]);
  };

  const resetNewDraftForm = () => {
    setSelectedCaseId(null);
    setCaseRow(null);
    setStages([]);
    setEvents([]);
    setLinks([]);
    setAttachments([]);
    setActiveStage('ARRANGEMENT');
    setArrangementStep(1);
    setAgentId('');
    setThirdPartyId('');
    setArrangementType('POOLED_USD_CNY');
    setFundingMode('CREDIT');
    setPlannedCurrency('USD');
    setPlannedSettlementCurrency('CNY');
    setPlannedUsd('');
    setExpectedPkrPerUsd('');
    setExpectedCnyPerUsd('');
    setIndicativeBasePerCny('');
    setExpectedCny('');
    setExpectedFees('');
    setExpectedArrangementDate('');
    setExpectedAdvanceDate('');
    setExpectedUsdDate('');
    setExpectedAdvanceAmountPkr('');
    setExpectedDate('');
    setScheduleCascadeActive(false);
    setActiveSchedulePlan(null);
    setAgentReference('');
    setNotes('');
    setLinkSupplierId('');
    setLinkPurchaseId('');
    setAttachmentFileName('');
    setRateDirtyPkrPerUsd(false);
    setRateDirtyCnyPerUsd(false);
    setRateDirtyBasePerCny(false);
    setLastIndicativeQuote(null);
    setAmountDriver('usd');
    setAmountDirtyUsd(false);
    setAmountDirtyCny(false);
    setAmountDirtyPkr(false);
    setFormErrors([]);
    createClientOpRef.current = null;
    confirmClientOpRef.current = null;
    attachmentClientOpRef.current = null;
  };

  const loadDetail = useCallback(
    async (caseId: string) => {
      if (!companyId) return;
      setDetailLoading(true);
      try {
        const detail = await getImportFxCase(companyId, caseId);
        setCaseRow(detail.case);
        setStages(detail.stages);
        setEvents(detail.events);
        setLinks(detail.links || []);
        setAttachments(detail.attachments || []);
        applyCaseToForm(detail.case);
        confirmClientOpRef.current = null;
        attachmentClientOpRef.current = null;
        setActiveStage('ARRANGEMENT');
        const locked = isArrangementLocked({
          arrangementConfirmedAt: detail.case.arrangement_confirmed_at ?? null,
          arrangementStageStatus:
            detail.stages.find((s) => s.stage_code === 'ARRANGEMENT')?.stage_status ?? null,
          operationalStatus: detail.case.operational_status ?? null,
        });
        setArrangementStep(locked ? 5 : 1);
      } catch (e) {
        toast.error(formatImportFxServerError(e));
      } finally {
        setDetailLoading(false);
      }
    },
    [companyId]
  );

  useEffect(() => {
    if (!open || !companyId) return;
    if (multiCurrencyEnabled) {
      void loadContacts();
      void loadPurchases();
    }
    void refreshList();
  }, [open, companyId, multiCurrencyEnabled, loadContacts, loadPurchases, refreshList]);

  useEffect(() => {
    if (!open || !selectedCaseId) return;
    void loadDetail(selectedCaseId);
  }, [open, selectedCaseId, loadDetail]);

  const draftPayload = () => ({
    agentContactId: agentId || null,
    thirdPartyContactId: thirdPartyId || null,
    plannedSourceCurrency: plannedCurrency || null,
    plannedUsdAmount: numOrNull(plannedUsd),
    expectedPkrPerUsd: numOrNull(expectedPkrPerUsd),
    expectedCnyPerUsd: numOrNull(expectedCnyPerUsd),
    expectedCnyAmount: numOrNull(expectedCny),
    expectedFeesPkr: numOrNull(expectedFees),
    expectedCompletionDate: expectedDate || null,
    notes: notes || null,
    fundingMode: fundingMode || null,
    plannedSettlementCurrency: plannedSettlementCurrency || null,
    agentReference: agentReference || null,
    expectedArrangementDate: expectedArrangementDate || null,
    expectedAdvanceDate: expectedAdvanceDate || null,
    expectedUsdAcquisitionDate: expectedUsdDate || null,
    expectedAdvanceAmountPkr: normalizeAdvanceForFundingMode(
      fundingMode,
      numOrNull(expectedAdvanceAmountPkr)
    ),
  });

  const collectValidation = (opts?: { requireAgent?: boolean }): boolean => {
    const errors = validateArrangementPlanning({
      agentId,
      thirdPartyId,
      plannedUsd,
      expectedCny,
      expectedPkrPerUsd,
      expectedCnyPerUsd,
      expectedFeesPkr: expectedFees,
      expectedAdvanceAmountPkr:
        fundingMode === 'CREDIT' ? '' : expectedAdvanceAmountPkr,
      arrangementType,
      fundingMode,
      requireAgentIfNeeded: opts?.requireAgent === true,
    });
    setFormErrors(errors);
    if (errors.length) {
      toast.error(errors[0]);
      return false;
    }
    return true;
  };

  const runBusy = async (action: W2BusyAction, fn: () => Promise<void>) => {
    if (!busyGuardRef.current.tryStart()) return;
    setBusy(true);
    setBusyAction(action);
    try {
      await fn();
    } finally {
      busyGuardRef.current.end();
      setBusy(false);
      setBusyAction(null);
    }
  };

  const handleCreate = async () => {
    if (!companyId || readOnly) return;
    if (!collectValidation()) return;
    await runBusy('create', async () => {
      if (!createClientOpRef.current) {
        createClientOpRef.current = crypto.randomUUID();
      }
      try {
        const created = await createImportFxCase({
          companyId,
          branchId: branchId ?? null,
          arrangementType,
          ...draftPayload(),
          createdBy: user?.id ?? null,
          clientOperationId: createClientOpRef.current,
        });
        createClientOpRef.current = null;
        toast.success(
          created.idempotentReplay
            ? `Case ${created.caseNo} already created (retry)`
            : `Case ${created.caseNo} created as a draft — not financially posted`
        );
        setSelectedCaseId(created.caseId);
        await refreshList();
      } catch (e) {
        toast.error(formatImportFxServerError(e));
      }
    });
  };

  const handleSaveDraft = async () => {
    if (!companyId || !selectedCaseId || readOnly || fieldsLocked) return;
    if (!collectValidation()) return;
    await runBusy('save', async () => {
      try {
        await updateImportFxCaseDraft({
          companyId,
          caseId: selectedCaseId,
          ...draftPayload(),
          updatedBy: user?.id ?? null,
          clearAgent: !agentId,
          clearThirdParty: !thirdPartyId,
          clearFundingMode: !fundingMode,
          clearSettlementCurrency: !plannedSettlementCurrency,
          clearAgentReference: !agentReference,
          arrangementType: arrangementTypeEditable ? arrangementType : null,
        });
        toast.success('Draft saved — not financially posted');
        await loadDetail(selectedCaseId);
        await refreshList();
      } catch (e) {
        toast.error(formatImportFxServerError(e));
      }
    });
  };

  const handleConfirmArrangement = async () => {
    if (!companyId || !selectedCaseId || readOnly || fieldsLocked) return;
    if (!isW2ConfirmableStage(activeStage) && activeStage !== 'ARRANGEMENT') {
      toast.error(W2_MONEY_STAGE_BLOCKED_COPY);
      return;
    }
    if (!collectValidation({ requireAgent: true })) return;
    await runBusy('confirm', async () => {
      if (!confirmClientOpRef.current) {
        confirmClientOpRef.current = crypto.randomUUID();
      }
      try {
        await updateImportFxCaseDraft({
          companyId,
          caseId: selectedCaseId,
          ...draftPayload(),
          updatedBy: user?.id ?? null,
          arrangementType: arrangementTypeEditable ? arrangementType : null,
        });
        const result = await confirmImportFxCaseStage({
          companyId,
          caseId: selectedCaseId,
          stageCode: 'ARRANGEMENT',
          notes: notes || null,
          createdBy: user?.id ?? null,
          clientOperationId: confirmClientOpRef.current,
        });
        confirmClientOpRef.current = null;
        toast.success(
          result.idempotentReplay
            ? 'Arrangement already confirmed — not financially posted'
            : 'Arrangement confirmed — not financially posted. Next: Advance or Buy USD.'
        );
        await loadDetail(selectedCaseId);
        setArrangementStep(5);
        setActiveStage('ADVANCE');
        await refreshList();
      } catch (e) {
        toast.error(formatImportFxServerError(e));
      }
    });
  };

  const handleCancel = async () => {
    if (!companyId || !selectedCaseId || readOnly) return;
    await runBusy('cancel', async () => {
      try {
        await cancelImportFxCaseUnposted({
          companyId,
          caseId: selectedCaseId,
          notes: notes || 'Cancelled unposted case',
          updatedBy: user?.id ?? null,
        });
        toast.success('Unposted case cancelled — no accounting entry posted');
        await loadDetail(selectedCaseId);
        await refreshList();
      } catch (e) {
        toast.error(formatImportFxServerError(e));
      }
    });
  };

  const handleLinkSupplier = async () => {
    if (!companyId || !selectedCaseId || !linkSupplierId || readOnly || fieldsLocked) return;
    await runBusy('link', async () => {
      try {
        await linkImportFxCaseTarget({
          companyId,
          caseId: selectedCaseId,
          linkType: 'SUPPLIER',
          linkId: linkSupplierId,
          notes: 'Planning link — intention only',
        });
        toast.success('Supplier planning link added — not financially posted');
        setLinkSupplierId('');
        await loadDetail(selectedCaseId);
      } catch (e) {
        toast.error(formatImportFxServerError(e));
      }
    });
  };

  const handleLinkPurchase = async () => {
    if (!companyId || !selectedCaseId || !linkPurchaseId || readOnly || fieldsLocked) return;
    await runBusy('link', async () => {
      try {
        await linkImportFxCaseTarget({
          companyId,
          caseId: selectedCaseId,
          linkType: 'PURCHASE',
          linkId: linkPurchaseId,
          notes: 'Planning link — intention only',
        });
        toast.success('Purchase planning link added — not financially posted');
        setLinkPurchaseId('');
        await loadDetail(selectedCaseId);
      } catch (e) {
        toast.error(formatImportFxServerError(e));
      }
    });
  };

  const handleRegisterAttachment = async () => {
    if (!companyId || !selectedCaseId || readOnly || fieldsLocked) return;
    const name = attachmentFileName.trim();
    if (!name) {
      toast.error('Enter a file name or reference for metadata only');
      return;
    }
    await runBusy('attach', async () => {
      if (!attachmentClientOpRef.current) {
        attachmentClientOpRef.current = crypto.randomUUID();
      }
      try {
        const result = await registerImportFxCaseAttachmentMetadata({
          companyId,
          caseId: selectedCaseId,
          fileName: name,
          createdBy: user?.id ?? null,
          clientOperationId: attachmentClientOpRef.current,
          notes: 'Metadata only — no file upload',
        });
        attachmentClientOpRef.current = null;
        toast.success(
          result.idempotentReplay
            ? 'Attachment reference already registered'
            : 'Attachment reference registered (metadata only — no file uploaded)'
        );
        setAttachmentFileName('');
        await loadDetail(selectedCaseId);
      } catch (e) {
        toast.error(formatImportFxServerError(e));
      }
    });
  };

  /** Money stages: arrangement may be locked; still allow metadata attachment references. */
  const handleRegisterMoneyAttachment = async (fileName: string) => {
    if (!companyId || !selectedCaseId || readOnly) return;
    const name = fileName.trim();
    if (!name) {
      toast.error('Enter a file name or reference for metadata only');
      return;
    }
    await runBusy('attach', async () => {
      if (!attachmentClientOpRef.current) {
        attachmentClientOpRef.current = crypto.randomUUID();
      }
      try {
        const result = await registerImportFxCaseAttachmentMetadata({
          companyId,
          caseId: selectedCaseId,
          fileName: name,
          createdBy: user?.id ?? null,
          clientOperationId: attachmentClientOpRef.current,
          notes: 'Metadata only — no file upload (money stage)',
        });
        attachmentClientOpRef.current = null;
        toast.success(
          result.idempotentReplay
            ? 'Attachment reference already registered'
            : 'Attachment reference registered (metadata only — no file uploaded)'
        );
        await loadDetail(selectedCaseId);
      } catch (e) {
        toast.error(formatImportFxServerError(e));
      }
    });
  };

  const linkLabel = (link: ImportFxCaseLink): string => {
    if (link.link_type === 'SUPPLIER') {
      return supplierOptions.find((s) => s.id === link.link_id)?.name || link.link_id.slice(0, 8);
    }
    if (link.link_type === 'PURCHASE') {
      return purchaseOptions.find((p) => p.id === link.link_id)?.name || link.link_id.slice(0, 8);
    }
    return `${link.link_type}: ${link.link_id.slice(0, 8)}`;
  };

  const goArrangementNext = () => {
    const errs = validateArrangementGuidedStep(arrangementStep, {
      agentId,
      thirdPartyId,
      fundingMode,
      plannedUsd,
      expectedCny,
      expectedPkrPerUsd,
      expectedCnyPerUsd,
      expectedFeesPkr: expectedFees,
      expectedAdvanceAmountPkr,
    });
    if (errs.length) {
      setFormErrors(errs);
      return;
    }
    setFormErrors([]);
    setArrangementStep(clampArrangementStep(arrangementStep + 1));
  };

  const goArrangementBack = () => {
    setFormErrors([]);
    setArrangementStep(clampArrangementStep(arrangementStep - 1));
  };

  const applyScheduleDates = (dates: {
    arrangement: string;
    advance: string;
    usd: string;
    completion: string;
  }) => {
    setExpectedArrangementDate(dates.arrangement);
    setExpectedAdvanceDate(dates.advance);
    setExpectedUsdDate(dates.usd);
    setExpectedDate(dates.completion);
  };

  const handleScheduleQuickPlan = (planId: ScheduleQuickPlanId) => {
    if (fieldsLocked) return;
    const filled = applyScheduleQuickPlan(planId);
    if (!filled) return;
    applyScheduleDates(filled);
    setActiveSchedulePlan(planId);
    setScheduleCascadeActive(planId !== 'clear');
  };

  const handleArrangementDateChange = (value: string) => {
    setActiveSchedulePlan(null);
    if (!value.trim()) {
      setExpectedArrangementDate('');
      return;
    }
    const next = cascadeFromArrangementChange({
      arrangeIso: value,
      current: {
        arrangement: value,
        advance: expectedAdvanceDate,
        usd: expectedUsdDate,
        completion: expectedDate,
      },
      forceCascade: scheduleCascadeActive,
    });
    applyScheduleDates(next);
  };

  const handleScheduleFieldManual = (field: ScheduleFieldKey, value: string) => {
    setActiveSchedulePlan(null);
    if (field === 'arrangement') {
      handleArrangementDateChange(value);
      return;
    }
    setScheduleCascadeActive(false);
    if (field === 'advance') setExpectedAdvanceDate(value);
    if (field === 'usd') setExpectedUsdDate(value);
    if (field === 'completion') setExpectedDate(value);
  };

  const handleScheduleFieldChip = (
    field: ScheduleFieldKey,
    chipId: (typeof SCHEDULE_FIELD_CHIPS)[number]['id']
  ) => {
    if (fieldsLocked) return;
    const value = resolveScheduleFieldChip({
      chipId,
      field,
      arrangeIso: expectedArrangementDate,
    });
    if (field === 'arrangement') {
      setScheduleCascadeActive(true);
      handleArrangementDateChange(value);
      return;
    }
    setActiveSchedulePlan(null);
    setScheduleCascadeActive(false);
    if (field === 'advance') setExpectedAdvanceDate(value);
    if (field === 'usd') setExpectedUsdDate(value);
    if (field === 'completion') setExpectedDate(value);
  };

  const selectProgressStage = (code: (typeof progressItems)[number]['code']) => {
    if (code === 'LATER') {
      setActiveStage('CHINA_USD_TRANSFER');
      return;
    }
    if (code === 'ADVANCE' || code === 'USD_ACQUISITION') {
      if (!(selectedCaseId && arrangementLocked)) {
        toast.message('Confirm arrangement first, then continue to money stages.');
        setActiveStage('ARRANGEMENT');
        setArrangementStep(5);
        return;
      }
      setActiveStage(code);
      return;
    }
    setActiveStage('ARRANGEMENT');
  };

  if (!open) return null;

  const caseLabel = caseRow?.case_no || (selectedCaseId ? 'Draft' : 'New draft');
  const opsLabel = formatArrangementStatusLabel(
    caseRow?.operational_status || (selectedCaseId ? 'DRAFT' : null)
  );
  const acctLabel = formatAccountingStatusLabel(caseRow?.accounting_status || 'NOT_POSTED');

  return (
    <div className={W2_WORKSPACE_SHELL_CLASS}>
      <div className={W2_WORKSPACE_PANEL_CLASS}>
        <div className="shrink-0 min-w-0">
          <div className="flex items-center justify-between gap-3 p-5 border-b border-border bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                <Banknote className="w-5 h-5 text-blue-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-foreground truncate">Import FX Case</h2>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {caseLabel} · {taskCopy.why}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 hover:bg-muted rounded-lg shrink-0"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <div className="px-5 pt-3 pb-3 space-y-2.5 border-b border-border/80 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="rounded-md border border-border/80 px-1.5 py-0.5 text-foreground bg-muted/40">
                {opsLabel}
              </span>
              <span className="rounded-md border border-blue-500/40 text-blue-300 bg-blue-500/10 px-1.5 py-0.5">
                {acctLabel}
              </span>
              <button
                type="button"
                className="text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => setPathClarityOpen((v) => !v)}
              >
                {pathClarityOpen ? 'Hide path help' : 'Path vs Agent FX'}
              </button>
              <ImportFxW3DemoEntryLink />
            </div>

            {pathClarityOpen && (
              <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs space-y-1.5">
                <p className="font-medium text-foreground">Import FX Case</p>
                <p className="text-muted-foreground">{W21_PATH_CLARITY_CASE_COPY}</p>
                <p className="font-medium text-foreground pt-1">Agent FX / Path 21</p>
                <p className="text-muted-foreground">{W21_PATH_CLARITY_AGENT_FX_COPY}</p>
                <p className="text-muted-foreground">{W21_PATH_CLARITY_LEAVE_WARNING}</p>
              </div>
            )}

            <div className="flex gap-1.5 overflow-x-auto pb-0.5 min-w-0" role="tablist" aria-label="Case progress">
              {progressItems.map((item) => {
                const locked = item.state === 'locked';
                const current = item.state === 'current';
                return (
                  <button
                    key={item.code}
                    type="button"
                    role="tab"
                    aria-selected={current}
                    onClick={() => selectProgressStage(item.code)}
                    className={cn(
                      'shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                      current &&
                        'border-blue-500 bg-blue-500/15 text-foreground ring-1 ring-blue-500/30',
                      item.state === 'done' &&
                        'border-emerald-600/40 bg-emerald-500/10 text-foreground',
                      item.state === 'upcoming' &&
                        'border-border/80 text-muted-foreground hover:bg-muted/50',
                      locked && 'opacity-60'
                    )}
                  >
                    {item.shortLabel}
                    {item.state === 'done' ? ' ✓' : ''}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground truncate">{taskCopy.nextAction}</p>
          </div>
        </div>

        <div className={W2_GUIDED_BODY_CLASS}>
          <main className={W2_GUIDED_MAIN_CLASS}>
            {missingAgentWarning && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                {W21_HISTORICAL_MISSING_AGENT_WARNING}
              </div>
            )}

            {detailLoading && selectedCaseId ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading case…
              </div>
            ) : (
              <>
                <div className="space-y-1 min-w-0">
                  <h3 className="text-lg font-semibold text-foreground tracking-tight">{taskCopy.title}</h3>
                  <p className="text-sm text-muted-foreground">{taskCopy.why}</p>
                  {activeStage === 'ARRANGEMENT' && (
                    <p className="text-[11px] text-muted-foreground">
                      Arrange step {arrangementStep} of {ARRANGEMENT_GUIDED_STEPS.length}
                    </p>
                  )}
                </div>

                {isW3MoneyStage(activeStage) ? (
                  <div className="rounded-xl border border-border bg-card p-1 sm:p-2 min-w-0">
                    <ImportFxCaseW3MoneyPanel
                      mode={activeStage === 'ADVANCE' ? 'ADVANCE' : 'USD_ACQUISITION'}
                      companyId={companyId || ''}
                      branchId={branchId}
                      caseId={selectedCaseId || ''}
                      caseNo={caseRow?.case_no}
                      agentName={agentName}
                      plannedAdvancePkr={
                        expectedAdvanceAmountPkr ? Number(expectedAdvanceAmountPkr) : null
                      }
                      plannedUsd={plannedUsd ? Number(plannedUsd) : null}
                      plannedPkrPerUsd={expectedPkrPerUsd ? Number(expectedPkrPerUsd) : null}
                      clearingAccountId={accountingSettings.agentFxAdvanceClearingAccountId || null}
                      accounts={(accounts || []).map((a: any) => ({
                        id: a.id,
                        code: a.code,
                        name: a.name,
                        type: a.type,
                        is_group: a.is_group,
                        is_active: a.is_active,
                      }))}
                      userId={user?.id || null}
                      readOnly={
                        readOnly ||
                        !companyId ||
                        !selectedCaseId ||
                        caseRow?.operational_status === 'DRAFT' ||
                        !caseRow?.arrangement_confirmed_at
                      }
                      attachments={attachments}
                      attachmentBusy={busyAction === 'attach'}
                      onRegisterAttachment={(fileName) => handleRegisterMoneyAttachment(fileName)}
                      onPosted={() => {
                        if (selectedCaseId) void loadDetail(selectedCaseId);
                      }}
                    />
                  </div>
                ) : isMoneyStageBlockedInW2(activeStage) ? (
                  <div className="rounded-xl border border-amber-600/40 bg-amber-500/10 p-4 text-sm text-amber-950 dark:text-amber-100 space-y-2">
                    <p className="font-medium">{W2_MONEY_STAGE_BLOCKED_COPY}</p>
                    <p className="text-xs opacity-90">
                      Later waves will unlock transfer, conversion, pool, and allocation. Use Path 21
                      Agent FX only for same-session agent credit.
                    </p>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setActiveStage('ARRANGEMENT')}>
                      Back to Arrange
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {workspaceMode === 'confirmed' && arrangementStep === 5 && (
                      <div className="rounded-xl border border-emerald-600/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-950 dark:text-emerald-100">
                        Arrangement completed at{' '}
                        {caseRow?.arrangement_confirmed_at
                          ? new Date(caseRow.arrangement_confirmed_at).toLocaleString()
                          : '—'}
                        . Accounting status remains Not Posted.
                      </div>
                    )}

                    {formErrors.length > 0 && (
                      <ul className="rounded-lg border border-red-600/40 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200 space-y-1">
                        {formErrors.map((err) => (
                          <li key={err}>{err}</li>
                        ))}
                      </ul>
                    )}

                    {arrangementStep === 1 && (
                      <ArrangementSectionCard
                                            title="1. Parties"
                                            hint="Money-exchange contacts only. Agent and third party cannot be the same person."
                                          >
                                            <div className="space-y-1">
                                              <Label>Arrangement type (intention)</Label>
                                              <Select
                                                value={arrangementType}
                                                onValueChange={(v) => setArrangementType(v as ImportFxArrangementType)}
                                                disabled={fieldsLocked || (!!selectedCaseId && !arrangementTypeEditable)}
                                              >
                                                <SelectTrigger>
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="POOLED_USD_CNY">Pooled USD → CNY (planned)</SelectItem>
                                                  <SelectItem value="PATH_21_AGENT_DUAL_CREDIT">
                                                    Path 21 agent dual credit (planned)
                                                  </SelectItem>
                                                  <SelectItem value="AGENT_PREPAID">Agent prepaid (planned)</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>
                                            <div className="space-y-1">
                                              <Label>Money Exchange Agent</Label>
                                              <div className="flex gap-2 min-w-0">
                                                <div className="flex-1 min-w-0">
                                                  <SearchableSelect
                                                    options={agentOptions}
                                                    value={agentId}
                                                    onValueChange={(v) => {
                                                      setAgentId(v);
                                                      if (thirdPartyId === v) setThirdPartyId('');
                                                    }}
                                                    placeholder="Search agent by name, code, or phone…"
                                                    searchPlaceholder="Name, code, or phone…"
                                                    emptyText="No money-exchange agents found."
                                                    loading={contactsLoading}
                                                    disabled={fieldsLocked}
                                                    filterFn={matchesPlanningSearch}
                                                  />
                                                </div>
                                                {agentId && !fieldsLocked && (
                                                  <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    aria-label="Clear agent"
                                                    onClick={() => setAgentId('')}
                                                  >
                                                    <X className="h-4 w-4" />
                                                  </Button>
                                                )}
                                              </div>
                                            </div>
                                            <div className="space-y-1">
                                              <Label>Third party (optional)</Label>
                                              <div className="flex gap-2 min-w-0">
                                                <div className="flex-1 min-w-0">
                                                  <SearchableSelect
                                                    options={thirdPartyOptions}
                                                    value={thirdPartyId}
                                                    onValueChange={setThirdPartyId}
                                                    placeholder="Search another money-exchange contact…"
                                                    searchPlaceholder="Name, code, or phone…"
                                                    emptyText="No other money-exchange contacts found."
                                                    loading={contactsLoading}
                                                    disabled={fieldsLocked}
                                                    filterFn={matchesPlanningSearch}
                                                  />
                                                </div>
                                                {thirdPartyId && !fieldsLocked && (
                                                  <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    aria-label="Clear third party"
                                                    onClick={() => setThirdPartyId('')}
                                                  >
                                                    <X className="h-4 w-4" />
                                                  </Button>
                                                )}
                                              </div>
                                            </div>
                                          </ArrangementSectionCard>
                    )}

                    {arrangementStep === 2 && (
                      <ArrangementSectionCard
                                            title="2. Funding Intention"
                                            hint="This records how you expect to fund later. It does not post a payment."
                                          >
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                              {W2_FUNDING_INTENTION_OPTIONS.map((opt) => (
                                                <button
                                                  key={opt.value}
                                                  type="button"
                                                  disabled={fieldsLocked}
                                                  onClick={() => {
                                                    setFundingMode(opt.value);
                                                    // Canonical W2.1: CREDIT clears planned advance in the draft form.
                                                    if (opt.value === 'CREDIT') {
                                                      setExpectedAdvanceAmountPkr('');
                                                      setAmountDirtyPkr(false);
                                                    }
                                                  }}
                                                  className={cn(
                                                    'rounded-lg border px-3 py-2.5 text-left min-w-0',
                                                    fundingMode === opt.value
                                                      ? 'border-blue-500 bg-blue-500/15 ring-1 ring-blue-500/30'
                                                      : 'border-border bg-background'
                                                  )}
                                                >
                                                  <div className="text-sm font-medium">{opt.label}</div>
                                                  <div className="text-[11px] text-muted-foreground">{opt.hint}</div>
                                                </button>
                                              ))}
                                            </div>
                                          </ArrangementSectionCard>
                    )}

                    {arrangementStep === 3 && (
                      <ArrangementSectionCard
                                            title="3. Planned Currency"
                                            hint="Expected amounts and indicative rates. Not financially posted."
                                          >
                                            <div className="space-y-4">
                                              <div className="space-y-2">
                                                <p className="text-xs text-muted-foreground">
                                                  {PLANNED_CURRENCY_PURCHASE_COPY}
                                                </p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                  {(
                                                    [
                                                      {
                                                        code: 'USD' as const,
                                                        label: 'US Dollar',
                                                        hint: 'Purchasing USD (planning)',
                                                      },
                                                      {
                                                        code: 'CNY' as const,
                                                        label: 'RMB (CNY)',
                                                        hint: 'Purchasing RMB (planning)',
                                                      },
                                                    ] as const
                                                  ).map((opt) => (
                                                    <button
                                                      key={opt.code}
                                                      type="button"
                                                      disabled={fieldsLocked}
                                                      onClick={() => {
                                                        const prevPurchase = purchaseLeg;
                                                        setPlannedCurrency(opt.code);
                                                        setAmountDriver(opt.code === 'CNY' ? 'cny' : 'usd');
                                                        if (settlementNorm === prevPurchase) {
                                                          setPlannedSettlementCurrency(opt.code);
                                                        }
                                                      }}
                                                      className={cn(
                                                        'rounded-lg border px-3 py-2.5 text-left min-w-0',
                                                        purchaseLeg === opt.code
                                                          ? 'border-blue-500 bg-blue-500/15 ring-1 ring-blue-500/30'
                                                          : 'border-border bg-background'
                                                      )}
                                                    >
                                                      <div className="text-sm font-medium">{opt.label}</div>
                                                      <div className="text-[11px] text-muted-foreground">{opt.hint}</div>
                                                    </button>
                                                  ))}
                                                </div>
                                              </div>

                                              <div className="space-y-1 min-w-0">
                                                <Label>
                                                  {purchaseLeg === 'CNY' ? 'Expected CNY amount' : 'Expected USD amount'}
                                                </Label>
                                                <Input
                                                  value={purchaseLeg === 'CNY' ? expectedCny : plannedUsd}
                                                  onChange={(e) => {
                                                    const v = e.target.value;
                                                    if (purchaseLeg === 'CNY') {
                                                      setExpectedCny(v);
                                                      setAmountDirtyCny(true);
                                                      setAmountDriver('cny');
                                                      runAmountSync({
                                                        driver: 'cny',
                                                        forceReplace: false,
                                                        expectedCny: v,
                                                        sourceCurrency: 'CNY',
                                                      });
                                                    } else {
                                                      setPlannedUsd(v);
                                                      setAmountDirtyUsd(true);
                                                      setAmountDriver('usd');
                                                      runAmountSync({
                                                        driver: 'usd',
                                                        forceReplace: false,
                                                        plannedUsd: v,
                                                        sourceCurrency: 'USD',
                                                      });
                                                    }
                                                  }}
                                                  disabled={fieldsLocked}
                                                  readOnly={fieldsLocked}
                                                  inputMode="decimal"
                                                />
                                              </div>

                                              <div className="space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                  <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={fieldsLocked || ratesLoading || readOnly}
                                                    onClick={() => void refreshIndicativeRates({ forceReplace: true })}
                                                  >
                                                    {ratesLoading ? (
                                                      <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                      <RefreshCw className="h-4 w-4" />
                                                    )}
                                                    Refresh indicative rates
                                                  </Button>
                                                  <p className="text-[11px] text-muted-foreground">
                                                    {INDICATIVE_RATE_HELPER_COPY} Quoted vs company base{' '}
                                                    {companyBaseCurrency || 'PKR'}.
                                                  </p>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                  <div className="space-y-1 min-w-0">
                                                    <Label>{pkrPerUsdLabel}</Label>
                                                    <Input
                                                      value={expectedPkrPerUsd}
                                                      onChange={(e) => {
                                                        const v = e.target.value;
                                                        setExpectedPkrPerUsd(v);
                                                        setRateDirtyPkrPerUsd(true);
                                                        runAmountSync({
                                                          driver: amountDriver,
                                                          forceReplace: false,
                                                          pkrPerUsd: v,
                                                        });
                                                      }}
                                                      disabled={fieldsLocked}
                                                      readOnly={fieldsLocked}
                                                      inputMode="decimal"
                                                    />
                                                    <p className="text-[11px] text-muted-foreground">
                                                      {INDICATIVE_RATE_HELPER_COPY}
                                                    </p>
                                                  </div>
                                                  {showBasePerCnyField && (
                                                    <div className="space-y-1 min-w-0">
                                                      <Label>{basePerCnyLabel}</Label>
                                                      <Input
                                                        value={indicativeBasePerCny}
                                                        onChange={(e) => {
                                                          const v = e.target.value;
                                                          setIndicativeBasePerCny(v);
                                                          setRateDirtyBasePerCny(true);
                                                          runAmountSync({
                                                            driver: amountDriver,
                                                            forceReplace: false,
                                                            pkrPerCny: v,
                                                          });
                                                        }}
                                                        disabled={fieldsLocked}
                                                        readOnly={fieldsLocked}
                                                        inputMode="decimal"
                                                      />
                                                      <p className="text-[11px] text-muted-foreground">
                                                        Display only for planning — not stored separately from W2 rate
                                                        columns.
                                                      </p>
                                                    </div>
                                                  )}
                                                  <div className="space-y-1 min-w-0">
                                                    <Label>{W21_RATE_LABEL_CNY_PER_USD}</Label>
                                                    <Input
                                                      value={expectedCnyPerUsd}
                                                      onChange={(e) => {
                                                        const v = e.target.value;
                                                        setExpectedCnyPerUsd(v);
                                                        setRateDirtyCnyPerUsd(true);
                                                        runAmountSync({
                                                          driver: amountDriver,
                                                          forceReplace: false,
                                                          cnyPerUsd: v,
                                                        });
                                                      }}
                                                      disabled={fieldsLocked}
                                                      readOnly={fieldsLocked}
                                                      inputMode="decimal"
                                                    />
                                                    <p className="text-[11px] text-muted-foreground">
                                                      {INDICATIVE_RATE_HELPER_COPY}
                                                    </p>
                                                  </div>
                                                </div>
                                                {lastIndicativeQuote && (
                                                  <div className="text-[11px] text-muted-foreground">
                                                    Last online quote ({lastIndicativeQuote.baseCurrency}):{' '}
                                                    {rateToInputString(lastIndicativeQuote.basePerUsd) || '—'} per USD
                                                    {lastIndicativeQuote.basePerCny != null
                                                      ? ` · ${rateToInputString(lastIndicativeQuote.basePerCny)} per CNY`
                                                      : ''}
                                                    {lastIndicativeQuote.cnyPerUsd != null
                                                      ? ` · ${rateToInputString(lastIndicativeQuote.cnyPerUsd)} CNY/USD`
                                                      : ''}
                                                  </div>
                                                )}
                                              </div>

                                              <div className="space-y-2">
                                                <p className="text-xs text-muted-foreground">
                                                  {PLANNED_CURRENCY_SETTLE_COPY}
                                                </p>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                  <button
                                                    type="button"
                                                    disabled={fieldsLocked}
                                                    onClick={() => setPlannedSettlementCurrency(purchaseLeg)}
                                                    className={cn(
                                                      'rounded-lg border px-3 py-2.5 text-left min-w-0',
                                                      settleSameAsPurchase
                                                        ? 'border-blue-500 bg-blue-500/15 ring-1 ring-blue-500/30'
                                                        : 'border-border bg-background'
                                                    )}
                                                  >
                                                    <div className="text-sm font-medium">Keep in {purchaseLeg}</div>
                                                    <div className="text-[11px] text-muted-foreground">
                                                      {PLANNED_CURRENCY_NO_CONVERT_COPY}
                                                    </div>
                                                  </button>
                                                  {(['USD', 'CNY'] as const)
                                                    .filter((code) => code !== purchaseLeg)
                                                    .map((code) => {
                                                      const meta = activeCurrencies.find((c) => c.code === code);
                                                      const label =
                                                        code === 'CNY'
                                                          ? meta?.label || 'RMB (CNY)'
                                                          : meta?.label || 'US Dollar';
                                                      return (
                                                        <button
                                                          key={code}
                                                          type="button"
                                                          disabled={fieldsLocked}
                                                          onClick={() => {
                                                            setPlannedSettlementCurrency(code);
                                                            runAmountSync({
                                                              driver: amountDriver,
                                                              forceReplace: false,
                                                              settlementCurrency: code,
                                                            });
                                                          }}
                                                          className={cn(
                                                            'rounded-lg border px-3 py-2.5 text-left min-w-0',
                                                            settlementNorm === code
                                                              ? 'border-blue-500 bg-blue-500/15 ring-1 ring-blue-500/30'
                                                              : 'border-border bg-background'
                                                          )}
                                                        >
                                                          <div className="text-sm font-medium">{label}</div>
                                                          <div className="text-[11px] text-muted-foreground">
                                                            Convert / settle (planning)
                                                          </div>
                                                        </button>
                                                      );
                                                    })}
                                                </div>
                                              </div>

                                              {settleSameAsPurchase ? (
                                                <p className="text-xs text-muted-foreground">
                                                  {PLANNED_CURRENCY_NO_CONVERT_COPY}
                                                </p>
                                              ) : (
                                                <div className="space-y-1 min-w-0">
                                                  <Label>
                                                    {settlementNorm === 'CNY'
                                                      ? 'Expected CNY amount'
                                                      : 'Expected USD amount'}
                                                  </Label>
                                                  <Input
                                                    value={settlementNorm === 'CNY' ? expectedCny : plannedUsd}
                                                    onChange={(e) => {
                                                      const v = e.target.value;
                                                      if (settlementNorm === 'CNY') {
                                                        setExpectedCny(v);
                                                        setAmountDirtyCny(true);
                                                        setAmountDriver('cny');
                                                        runAmountSync({
                                                          driver: 'cny',
                                                          forceReplace: false,
                                                          expectedCny: v,
                                                          settlementCurrency: 'CNY',
                                                        });
                                                      } else {
                                                        setPlannedUsd(v);
                                                        setAmountDirtyUsd(true);
                                                        setAmountDriver('usd');
                                                        runAmountSync({
                                                          driver: 'usd',
                                                          forceReplace: false,
                                                          plannedUsd: v,
                                                          settlementCurrency: settlementNorm || 'USD',
                                                        });
                                                      }
                                                    }}
                                                    disabled={fieldsLocked}
                                                    readOnly={fieldsLocked}
                                                    inputMode="decimal"
                                                  />
                                                  <p className="text-[11px] text-muted-foreground">
                                                    Auto-filled from purchase amount × indicative rates. You can change
                                                    it.
                                                  </p>
                                                </div>
                                              )}

                                              <div className="grid grid-cols-1 gap-3">
                                                <div className="space-y-1 min-w-0">
                                                  <Label>Expected fees (PKR) — {W21_PLANNING_NOT_POSTED_BADGE}</Label>
                                                  <Input
                                                    value={expectedFees}
                                                    onChange={(e) => setExpectedFees(e.target.value)}
                                                    disabled={fieldsLocked}
                                                    readOnly={fieldsLocked}
                                                    inputMode="decimal"
                                                  />
                                                </div>
                                                {fundingSummary.showPlannedAdvance && (
                                                  <div className="space-y-1 min-w-0">
                                                    <Label>
                                                      Planned advance amount (PKR) — {W21_PLANNING_NOT_POSTED_BADGE}
                                                    </Label>
                                                    <Input
                                                      value={expectedAdvanceAmountPkr}
                                                      onChange={(e) => {
                                                        const v = e.target.value;
                                                        setExpectedAdvanceAmountPkr(v);
                                                        setAmountDirtyPkr(true);
                                                        setAmountDriver('pkr');
                                                        runAmountSync({
                                                          driver: 'pkr',
                                                          forceReplace: false,
                                                          advancePkr: v,
                                                        });
                                                      }}
                                                      disabled={fieldsLocked}
                                                      readOnly={fieldsLocked}
                                                      inputMode="decimal"
                                                    />
                                                    <p className="text-[11px] text-muted-foreground">
                                                      Enter PKR outlay to reverse-calc USD/CNY from indicative rates.
                                                    </p>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </ArrangementSectionCard>
                    )}

                    {arrangementStep === 4 && (
                      <>
                        <ArrangementSectionCard
                                              title="4. Expected Schedule"
                                              hint="Dates are expectations only. They do not complete Advance or USD acquisition. Use a quick plan or chips — calendars stay optional."
                                            >
                                              <div className="flex flex-wrap gap-1.5 min-w-0">
                                                {SCHEDULE_QUICK_PLANS.map((plan) => (
                                                  <button
                                                    key={plan.id}
                                                    type="button"
                                                    disabled={fieldsLocked}
                                                    onClick={() => handleScheduleQuickPlan(plan.id)}
                                                    className={cn(
                                                      'rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                                                      activeSchedulePlan === plan.id
                                                        ? 'border-blue-500 bg-blue-500/15 text-foreground ring-1 ring-blue-500/30'
                                                        : 'border-border/80 text-muted-foreground hover:bg-muted/50',
                                                      fieldsLocked && 'opacity-60'
                                                    )}
                                                  >
                                                    {plan.label}
                                                  </button>
                                                ))}
                                              </div>
                                              <p className="text-[11px] text-muted-foreground">
                                                Today fills arrange → +3d advance → +7d USD → +14d completion. Change
                                                arrangement date to refresh the rest while cascade is on.
                                              </p>
                                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {(
                                                  [
                                                    {
                                                      field: 'arrangement' as const,
                                                      label: 'Expected arrangement date',
                                                      value: expectedArrangementDate,
                                                    },
                                                    {
                                                      field: 'advance' as const,
                                                      label: 'Expected advance date',
                                                      value: expectedAdvanceDate,
                                                    },
                                                    {
                                                      field: 'usd' as const,
                                                      label: 'Expected USD acquisition date',
                                                      value: expectedUsdDate,
                                                    },
                                                    {
                                                      field: 'completion' as const,
                                                      label: 'Expected completion date',
                                                      value: expectedDate,
                                                    },
                                                  ] as const
                                                ).map((row) => (
                                                  <div key={row.field} className="space-y-1.5 min-w-0">
                                                    <Label>{row.label}</Label>
                                                    <Input
                                                      type="date"
                                                      value={row.value}
                                                      onChange={(e) =>
                                                        handleScheduleFieldManual(row.field, e.target.value)
                                                      }
                                                      disabled={fieldsLocked}
                                                      readOnly={fieldsLocked}
                                                    />
                                                    <div className="flex flex-wrap gap-1">
                                                      {SCHEDULE_FIELD_CHIPS.filter(
                                                        (c) =>
                                                          !(
                                                            row.field === 'arrangement' &&
                                                            c.id === 'same_arrange'
                                                          )
                                                      ).map((chip) => (
                                                          <button
                                                            key={chip.id}
                                                            type="button"
                                                            disabled={fieldsLocked}
                                                            onClick={() =>
                                                              handleScheduleFieldChip(row.field, chip.id)
                                                            }
                                                            className={cn(
                                                              'rounded-full border border-border/80 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors',
                                                              fieldsLocked && 'opacity-60'
                                                            )}
                                                          >
                                                            {chip.label}
                                                          </button>
                                                        ))}
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </ArrangementSectionCard>
                        <ArrangementSectionCard
                                              title="5. References"
                                              hint="Agent reference, notes, planning links, and attachment metadata only."
                                            >
                                              <div className="space-y-1">
                                                <Label>Agent / quote reference</Label>
                                                <Input
                                                  value={agentReference}
                                                  onChange={(e) => setAgentReference(e.target.value)}
                                                  disabled={fieldsLocked}
                                                  readOnly={fieldsLocked}
                                                />
                                              </div>
                                              <div className="space-y-1">
                                                <Label>Notes</Label>
                                                <Textarea
                                                  value={notes}
                                                  onChange={(e) => setNotes(e.target.value)}
                                                  disabled={fieldsLocked}
                                                  readOnly={fieldsLocked}
                                                  className="min-h-[72px]"
                                                />
                                              </div>

                                              {selectedCaseId && (
                                                <div className="space-y-3 pt-2 border-t border-border">
                                                  <p className="text-xs text-muted-foreground">
                                                    Planning links are context only. They do not create a supplier settlement.
                                                  </p>
                                                  <div className="space-y-1">
                                                    <Label>Link supplier (planning)</Label>
                                                    <div className="flex gap-2 min-w-0">
                                                      <div className="flex-1 min-w-0">
                                                        <SearchableSelect
                                                          options={supplierOptions}
                                                          value={linkSupplierId}
                                                          onValueChange={setLinkSupplierId}
                                                          placeholder="Search supplier name…"
                                                          searchPlaceholder="Supplier name…"
                                                          emptyText="No suppliers found."
                                                          loading={contactsLoading}
                                                          disabled={fieldsLocked}
                                                        />
                                                      </div>
                                                      {linkSupplierId && !fieldsLocked && (
                                                        <Button
                                                          type="button"
                                                          variant="outline"
                                                          size="icon"
                                                          aria-label="Clear supplier"
                                                          onClick={() => setLinkSupplierId('')}
                                                        >
                                                          <X className="h-4 w-4" />
                                                        </Button>
                                                      )}
                                                      {!fieldsLocked && (
                                                        <Button
                                                          variant="secondary"
                                                          disabled={actions.actionsDisabled || !linkSupplierId}
                                                          onClick={() => void handleLinkSupplier()}
                                                        >
                                                          Link
                                                        </Button>
                                                      )}
                                                    </div>
                                                  </div>
                                                  <div className="space-y-1">
                                                    <Label>Link purchase (planning)</Label>
                                                    <div className="flex gap-2 min-w-0">
                                                      <div className="flex-1 min-w-0">
                                                        <SearchableSelect
                                                          options={purchaseOptions}
                                                          value={linkPurchaseId}
                                                          onValueChange={setLinkPurchaseId}
                                                          placeholder="Search purchase, invoice, or supplier…"
                                                          searchPlaceholder="Purchase, invoice, or supplier…"
                                                          emptyText="No purchases found."
                                                          loading={purchasesLoading}
                                                          disabled={fieldsLocked}
                                                          filterFn={matchesPlanningSearch}
                                                        />
                                                      </div>
                                                      {linkPurchaseId && !fieldsLocked && (
                                                        <Button
                                                          type="button"
                                                          variant="outline"
                                                          size="icon"
                                                          aria-label="Clear purchase"
                                                          onClick={() => setLinkPurchaseId('')}
                                                        >
                                                          <X className="h-4 w-4" />
                                                        </Button>
                                                      )}
                                                      {!fieldsLocked && (
                                                        <Button
                                                          variant="secondary"
                                                          disabled={actions.actionsDisabled || !linkPurchaseId}
                                                          onClick={() => void handleLinkPurchase()}
                                                        >
                                                          Link
                                                        </Button>
                                                      )}
                                                    </div>
                                                  </div>
                                                  {links.length > 0 && (
                                                    <ul className="space-y-1 text-xs text-muted-foreground">
                                                      {links.map((l) => (
                                                        <li key={l.id} className="border-b border-border/50 pb-1">
                                                          <span className="text-foreground">{l.link_type}</span> · {linkLabel(l)}
                                                        </li>
                                                      ))}
                                                    </ul>
                                                  )}
                                                  <div className="space-y-1 pt-2 border-t border-border">
                                                    <Label>Attachment reference (metadata only — no file uploaded)</Label>
                                                    <div className="flex flex-col sm:flex-row gap-2 min-w-0">
                                                      <Input
                                                        value={attachmentFileName}
                                                        onChange={(e) => setAttachmentFileName(e.target.value)}
                                                        placeholder="e.g. quote-scan.pdf"
                                                        disabled={fieldsLocked}
                                                        readOnly={fieldsLocked}
                                                        className="min-w-0"
                                                      />
                                                      {!fieldsLocked && (
                                                        <Button
                                                          variant="secondary"
                                                          disabled={actions.actionsDisabled || !attachmentFileName.trim()}
                                                          onClick={() => void handleRegisterAttachment()}
                                                        >
                                                          Register reference
                                                        </Button>
                                                      )}
                                                    </div>
                                                    {attachments.length > 0 && (
                                                      <ul className="space-y-1 text-xs text-muted-foreground mt-2">
                                                        {attachments.map((a) => (
                                                          <li key={a.id} className="border-b border-border/50 pb-1">
                                                            <span className="text-foreground">{a.file_name || 'unnamed'}</span>
                                                            {a.is_metadata_only !== false
                                                              ? ' · metadata only (no file uploaded)'
                                                              : ''}
                                                          </li>
                                                        ))}
                                                      </ul>
                                                    )}
                                                  </div>
                                                </div>
                                              )}
                                            </ArrangementSectionCard>
                      </>
                    )}

                    {arrangementStep === 5 && (
                      <ArrangementSectionCard
                        title="Review plan"
                        hint="Nothing here posts journals. Confirm arrangement only locks the plan."
                      >
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <div>
                            <dt className="text-xs text-muted-foreground">Agent</dt>
                            <dd className="font-medium">{agentName || '—'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">Funding</dt>
                            <dd className="font-medium">{fundingMode || '—'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">Purchase currency</dt>
                            <dd className="font-medium">{String(plannedCurrency || '—')}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">Settlement</dt>
                            <dd className="font-medium">{String(plannedSettlementCurrency || '—')}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">Expected USD</dt>
                            <dd className="font-medium">{plannedUsd || '—'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">Expected CNY</dt>
                            <dd className="font-medium">{expectedCny || '—'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">Expected total PKR</dt>
                            <dd className="font-medium">
                              {fundingSummary.expectedTotalPkr != null
                                ? Math.round(fundingSummary.expectedTotalPkr).toLocaleString()
                                : '—'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">Accounting</dt>
                            <dd className="font-medium">{formatAccountingStatusLabel(caseRow?.accounting_status)}</dd>
                          </div>
                        </dl>
                        <p className="text-xs text-muted-foreground pt-2">
                          Step {arrangementStep} of 5 — use Confirm Arrangement when the plan looks right.
                        </p>
                      </ArrangementSectionCard>
                    )}
                  </div>
                )}

                {activeStage === 'ARRANGEMENT' && (
                  <div className={cn(W2_ACTION_BAR_CLASS, 'pt-2 border-t border-border')}>
                    {arrangementStep > 1 && (
                      <Button type="button" variant="outline" onClick={goArrangementBack} disabled={busy}>
                        Back
                      </Button>
                    )}
                    {arrangementStep < 5 && workspaceMode !== 'confirmed' && (
                      <Button type="button" onClick={goArrangementNext} disabled={busy || readOnly}>
                        Next
                      </Button>
                    )}
                    {arrangementStep < 5 && workspaceMode === 'confirmed' && (
                      <Button type="button" variant="secondary" onClick={() => setArrangementStep(5)}>
                        Skip to review
                      </Button>
                    )}
                    {actions.showCreateDraft && (
                      <Button onClick={() => void handleCreate()} disabled={actions.actionsDisabled}>
                        {busyAction === 'create' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Save Draft
                      </Button>
                    )}
                    {actions.showSaveDraft && (
                      <Button
                        variant="secondary"
                        onClick={() => void handleSaveDraft()}
                        disabled={actions.actionsDisabled}
                      >
                        {actions.saveDraftBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Save Draft
                      </Button>
                    )}
                    {actions.showConfirmArrangement && (
                      <Button onClick={() => void handleConfirmArrangement()} disabled={actions.actionsDisabled}>
                        {actions.confirmBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Confirm Arrangement
                      </Button>
                    )}
                    {actions.showCancelUnposted && (
                      <Button
                        variant="destructive"
                        onClick={() => void handleCancel()}
                        disabled={actions.actionsDisabled}
                      >
                        {busyAction === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Cancel Unposted Case
                      </Button>
                    )}
                    {readOnly && (
                      <p className="text-xs text-muted-foreground self-center">
                        Multi Currency is off. History is read-only.
                      </p>
                    )}
                  </div>
                )}

                {isW3MoneyStage(activeStage) && (
                  <div className={cn(W2_ACTION_BAR_CLASS, 'pt-2 border-t border-border')}>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setActiveStage('ARRANGEMENT');
                        setArrangementStep(5);
                      }}
                    >
                      Edit arrangement
                    </Button>
                    {activeStage === 'ADVANCE' && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setActiveStage('USD_ACQUISITION')}
                        disabled={!selectedCaseId || !arrangementLocked}
                      >
                        Continue to Buy USD
                      </Button>
                    )}
                    {activeStage === 'USD_ACQUISITION' && (
                      <Button type="button" variant="secondary" onClick={() => setActiveStage('ADVANCE')}>
                        Back to Advance
                      </Button>
                    )}
                    {selectedCaseId &&
                      !readOnly &&
                      caseRow?.operational_status !== 'CANCELLED' &&
                      (!caseRow?.accounting_status || caseRow.accounting_status === 'NOT_POSTED') && (
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => void handleCancel()}
                          disabled={busy}
                        >
                          {busyAction === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Cancel Unposted Case
                        </Button>
                      )}
                    <p className="text-[11px] text-muted-foreground w-full basis-full self-center">
                      Confirmed plan is locked. To change parties/amounts: Cancel Unposted Case and create a new
                      draft.
                    </p>
                  </div>
                )}
              </>
            )}
          </main>

          <div className={W2_GUIDED_FOOTER_CLASS}>
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setCasesDrawerOpen(true)}>
              <List className="h-4 w-4" /> Cases
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setContextDrawerOpen(true)}
            >
              <PanelRight className="h-4 w-4" /> Context
            </Button>
            {!readOnly && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1 ml-auto"
                onClick={() => {
                  resetNewDraftForm();
                  setCasesDrawerOpen(false);
                }}
              >
                <Plus className="h-4 w-4" /> New draft
              </Button>
            )}
          </div>
        </div>
      </div>

      <Sheet open={casesDrawerOpen} onOpenChange={setCasesDrawerOpen}>
        <SheetContent
          side="left"
          className="z-[80] w-full sm:max-w-sm p-0 flex flex-col"
          overlayClassName="z-[70]"
        >
          <SheetHeader className="border-b border-border">
            <SheetTitle>Cases</SheetTitle>
            <SheetDescription>Pick a case to resume, or start a new draft.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-w-0">
<div className="flex gap-2 min-w-0">
              <Input
                placeholder="Search case number…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 min-w-0"
              />
              <Button variant="outline" size="icon" onClick={() => void refreshList()} disabled={loadingList}>
                {loadingList ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as 'all' | 'DRAFT' | 'ARRANGED')}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="ARRANGED">Arranged</SelectItem>
              </SelectContent>
            </Select>
            {!readOnly && (
              <Button className="w-full h-9 gap-1" variant="secondary" onClick={resetNewDraftForm}>
                <Plus className="h-4 w-4" /> New draft
              </Button>
            )}
            <div className="space-y-1">
              {cases.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setSelectedCaseId(c.id); setCasesDrawerOpen(false); }}
                  className={cn(
                    'w-full text-left rounded-md border px-2 py-2 text-sm transition-colors min-w-0',
                    selectedCaseId === c.id
                      ? 'border-blue-500 bg-blue-500/15 ring-1 ring-blue-500/30'
                      : 'border-border hover:bg-muted/50'
                  )}
                >
                  <div className="font-medium text-foreground truncate">{c.case_no}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.operational_status === 'DRAFT' ? 'Resume / edit draft' : c.operational_status} · Not Posted
                  </div>
                </button>
              ))}
              {!loadingList && cases.length === 0 && (
                <p className="text-xs text-muted-foreground px-1">No cases yet.</p>
              )}
            </div>
          
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={contextDrawerOpen} onOpenChange={setContextDrawerOpen}>
        <SheetContent
          side="right"
          className="z-[80] w-full sm:max-w-md p-0 flex flex-col"
          overlayClassName="z-[70]"
        >
          <SheetHeader className="border-b border-border">
            <SheetTitle>Context</SheetTitle>
            <SheetDescription>Summary, assignment, and audit for this case.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm min-w-0">
<p className="text-xs font-medium text-muted-foreground">Summary</p>
            <div className="space-y-1 text-muted-foreground">
              <div>Funding intention: {fundingMode || '—'}</div>
              <div>Expected USD: {plannedUsd || '—'}</div>
              <div>Expected CNY: {expectedCny || '—'}</div>
              <div>
                {pkrPerUsdLabel}: {expectedPkrPerUsd || '—'}
              </div>
              {showBasePerCnyField && (
                <div>
                  {basePerCnyLabel}: {indicativeBasePerCny || '—'}
                </div>
              )}
              <div>
                {W21_RATE_LABEL_CNY_PER_USD}: {expectedCnyPerUsd || '—'}
              </div>
              <div>
                Expected total PKR cost:{' '}
                {fundingSummary.expectedTotalPkr != null
                  ? Math.round(fundingSummary.expectedTotalPkr).toLocaleString()
                  : '—'}{' '}
                <span className="text-[10px]">({W21_PLANNING_NOT_POSTED_BADGE})</span>
              </div>
              {fundingSummary.showPlannedAdvance && (
                <div>
                  Planned advance PKR: {expectedAdvanceAmountPkr || '—'}{' '}
                  <span className="text-[10px]">({W21_PLANNING_NOT_POSTED_BADGE})</span>
                </div>
              )}
              {fundingSummary.showExpectedAgentCredit && (
                <div>
                  Expected agent credit PKR:{' '}
                  {fundingSummary.expectedAgentCreditPkr != null
                    ? Math.round(fundingSummary.expectedAgentCreditPkr).toLocaleString()
                    : '—'}{' '}
                  <span className="text-[10px]">({W21_PLANNING_NOT_POSTED_BADGE})</span>
                </div>
              )}
              <div className="pt-2 text-xs">
                Journal preview: <span className="text-foreground">none (not financially posted)</span>
              </div>
              <div className="text-xs">Accounting: Not Posted</div>
              <div className="text-xs">posts_journal: false</div>
            </div>

            <ImportFxCaseAssignmentPanel
              companyId={companyId || ''}
              caseRow={caseRow}
              events={events}
              readOnly={readOnly || !companyId}
              currentUserId={user?.id ?? null}
              onUpdated={async () => {
                if (selectedCaseId) await loadDetail(selectedCaseId);
              }}
            />

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Timeline / audit</p>
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {events.slice(0, 12).map((e) => (
                  <li key={e.id} className="text-[11px] text-muted-foreground border-b border-border/50 pb-1">
                    <span className="text-foreground">{e.event_type}</span>
                    {e.posts_journal ? ' · journal claimed' : ' · not financially posted'}
                  </li>
                ))}
                {events.length === 0 && (
                  <li className="text-[11px] text-muted-foreground">No events yet</li>
                )}
              </ul>
            </div>

          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
