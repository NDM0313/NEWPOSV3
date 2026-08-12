/**
 * Import FX Case workspace (Wave W2).
 * ARRANGEMENT enrichment — draft / resume / confirm planning only.
 * Money stages blocked until W3+. Path 21 Agent FX remains separate.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
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
import { useSupabase } from '@/app/context/SupabaseContext';
import { useSettings } from '@/app/context/SettingsContext';
import {
  resolveActiveImportCurrencies,
  type ImportDocCurrency,
} from '@/app/lib/importFxHelpers';
import { formatImportFxServerError } from '@/app/lib/importFxServerGate';
import {
  canEditArrangementType,
  isMoneyStageBlockedInW2,
  isW2ConfirmableStage,
  stageStatusTone,
  W2_MONEY_STAGE_BLOCKED_COPY,
  type ImportFxFundingMode,
} from '@/app/lib/importFxCaseHelpers';
import {
  W2_ACTION_BAR_CLASS,
  W2_FUNDING_INTENTION_OPTIONS,
  W2_WORKSPACE_GRID_CLASS,
  W2_WORKSPACE_PANEL_CLASS,
  W2_WORKSPACE_SHELL_CLASS,
  createExclusiveBusyGuard,
  formatMoneyExchangeOption,
  formatPurchasePlanningOption,
  isArrangementLocked,
  matchesPlanningSearch,
  moneyStageTimelineItems,
  resolveWorkspaceMode,
  thirdPartyOptionsExcludingAgent,
  validateArrangementPlanning,
  workspaceActions,
  type W2BusyAction,
} from '@/app/lib/importFxCaseWorkspaceView';
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
  ImportFxCaseHeaderBar,
} from './ImportFxCaseArrangementPanels';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type AgentOption = ReturnType<typeof formatMoneyExchangeOption>;
type PurchaseOption = ReturnType<typeof formatPurchasePlanningOption>;
type ContactOption = { id: string; name: string };

function toneClass(tone: ReturnType<typeof stageStatusTone>): string {
  switch (tone) {
    case 'green':
      return 'border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'amber':
      return 'border-amber-600/40 bg-amber-500/10 text-amber-800 dark:text-amber-200';
    case 'red':
      return 'border-red-600/40 bg-red-500/10 text-red-700 dark:text-red-300';
    default:
      return 'border-border bg-muted/40 text-muted-foreground';
  }
}

function numOrNull(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function ImportFxCaseWorkspace({ open, onOpenChange }: Props) {
  const { companyId, branchId, user } = useSupabase();
  const { accountingSettings } = useSettings();
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
  const [expectedCny, setExpectedCny] = useState('');
  const [expectedFees, setExpectedFees] = useState('');
  const [expectedArrangementDate, setExpectedArrangementDate] = useState('');
  const [expectedAdvanceDate, setExpectedAdvanceDate] = useState('');
  const [expectedUsdDate, setExpectedUsdDate] = useState('');
  const [expectedAdvanceAmountPkr, setExpectedAdvanceAmountPkr] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [agentReference, setAgentReference] = useState('');
  const [notes, setNotes] = useState('');

  const [linkSupplierId, setLinkSupplierId] = useState('');
  const [linkPurchaseId, setLinkPurchaseId] = useState('');
  const [attachmentFileName, setAttachmentFileName] = useState('');

  const createClientOpRef = useRef<string | null>(null);
  const confirmClientOpRef = useRef<string | null>(null);
  const attachmentClientOpRef = useRef<string | null>(null);

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
  });

  const arrangementTypeEditable = canEditArrangementType({
    operationalStatus: caseRow?.operational_status ?? 'DRAFT',
    arrangementStageStatus,
    arrangementConfirmedAt: caseRow?.arrangement_confirmed_at ?? null,
  });

  const fieldsLocked = actions.fieldsLocked;
  const agentName =
    agentOptions.find((a) => a.id === (agentId || caseRow?.agent_contact_id || ''))?.name || null;

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
    setAgentId('');
    setThirdPartyId('');
    setArrangementType('POOLED_USD_CNY');
    setFundingMode('CREDIT');
    setPlannedCurrency('USD');
    setPlannedSettlementCurrency('CNY');
    setPlannedUsd('');
    setExpectedPkrPerUsd('');
    setExpectedCnyPerUsd('');
    setExpectedCny('');
    setExpectedFees('');
    setExpectedArrangementDate('');
    setExpectedAdvanceDate('');
    setExpectedUsdDate('');
    setExpectedAdvanceAmountPkr('');
    setExpectedDate('');
    setAgentReference('');
    setNotes('');
    setLinkSupplierId('');
    setLinkPurchaseId('');
    setAttachmentFileName('');
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
    expectedAdvanceAmountPkr: numOrNull(expectedAdvanceAmountPkr),
  });

  const collectValidation = (): boolean => {
    const errors = validateArrangementPlanning({
      agentId,
      thirdPartyId,
      plannedUsd,
      expectedCny,
      expectedPkrPerUsd,
      expectedCnyPerUsd,
      expectedFeesPkr: expectedFees,
      expectedAdvanceAmountPkr,
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
    if (!collectValidation()) return;
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
            : 'Arrangement confirmed — not financially posted'
        );
        await loadDetail(selectedCaseId);
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

  const linkLabel = (link: ImportFxCaseLink): string => {
    if (link.link_type === 'SUPPLIER') {
      return supplierOptions.find((s) => s.id === link.link_id)?.name || link.link_id.slice(0, 8);
    }
    if (link.link_type === 'PURCHASE') {
      return purchaseOptions.find((p) => p.id === link.link_id)?.name || link.link_id.slice(0, 8);
    }
    return `${link.link_type}: ${link.link_id.slice(0, 8)}`;
  };

  const timelineItems = moneyStageTimelineItems();

  if (!open) return null;

  return (
    <div className={W2_WORKSPACE_SHELL_CLASS}>
      <div className={W2_WORKSPACE_PANEL_CLASS}>
        <div className="flex items-start justify-between gap-3 px-3 sm:px-4 py-3 border-b border-border min-w-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">
              Import FX — Arrangement
            </h2>
            <p className="text-xs text-muted-foreground">
              Planned / expected / intention only. Path 21 Agent FX stays a separate screen.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className={W2_WORKSPACE_GRID_CLASS}>
          <aside className="lg:col-span-4 xl:col-span-3 border-b lg:border-b-0 lg:border-r border-border p-3 space-y-2 overflow-y-auto min-w-0">
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
                  onClick={() => setSelectedCaseId(c.id)}
                  className={cn(
                    'w-full text-left rounded-md border px-2 py-2 text-sm transition-colors min-w-0',
                    selectedCaseId === c.id
                      ? 'border-orange-600 bg-orange-500/10'
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
          </aside>

          <div className="lg:col-span-8 xl:col-span-9 min-h-0 min-w-0 grid grid-cols-1 xl:grid-cols-9 overflow-y-auto xl:overflow-hidden">
          <nav className="xl:col-span-2 border-b xl:border-b-0 xl:border-r border-border p-3 overflow-x-auto xl:overflow-y-auto min-w-0">
            <p className="text-xs font-medium text-muted-foreground mb-2">Timeline</p>
            <div className="flex xl:flex-col gap-2 min-w-0">
              {timelineItems.map((s) => {
                const row = stages.find((x) => x.stage_code === s.code);
                const status = (row?.stage_status || 'NOT_STARTED') as ImportFxCaseStage['stage_status'];
                return (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => setActiveStage(s.code)}
                    aria-disabled={s.disabled}
                    className={cn(
                      'text-left rounded-md border px-2 py-2 text-sm min-w-[10.5rem] xl:min-w-0 shrink-0',
                      activeStage === s.code ? 'ring-1 ring-orange-600' : '',
                      s.disabled ? 'opacity-80 cursor-default' : '',
                      toneClass(stageStatusTone(status))
                    )}
                  >
                    <div className="font-medium">{s.label}</div>
                    <div className="text-[11px] opacity-80">
                      {s.code === 'ARRANGEMENT' && status === 'COMPLETED' ? 'Completed' : status}
                    </div>
                    {s.helper ? (
                      <div className="text-[10px] mt-1 leading-snug opacity-90">{s.helper}</div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </nav>

          <main className="xl:col-span-5 p-3 sm:p-4 overflow-y-auto space-y-4 min-w-0">
            {detailLoading && selectedCaseId ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading case…
              </div>
            ) : (
              <>
                <ImportFxCaseHeaderBar
                  caseNo={caseRow?.case_no || null}
                  operationalStatus={caseRow?.operational_status || (selectedCaseId ? 'DRAFT' : 'DRAFT')}
                  accountingStatus={caseRow?.accounting_status || 'NOT_POSTED'}
                  agentName={agentName}
                  sourceCurrency={String(plannedCurrency || '')}
                  settlementCurrency={String(plannedSettlementCurrency || '')}
                  updatedAt={caseRow?.updated_at || null}
                  confirmedAt={caseRow?.arrangement_confirmed_at || null}
                  readOnly={readOnly}
                />

                {isMoneyStageBlockedInW2(activeStage) ? (
                  <div className="rounded-xl border border-amber-600/40 bg-amber-500/10 p-4 text-sm text-amber-950 dark:text-amber-100 space-y-2">
                    <p className="font-medium">{W2_MONEY_STAGE_BLOCKED_COPY}</p>
                    <p className="text-xs opacity-90">
                      This stage is shown for planning context only. Use Path 21 Agent FX for
                      same-session agent credit until later waves. No money buttons are available here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {workspaceMode === 'confirmed' && (
                      <div className="rounded-xl border border-emerald-600/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-950 dark:text-emerald-100">
                        Arrangement completed at {caseRow?.arrangement_confirmed_at
                          ? new Date(caseRow.arrangement_confirmed_at).toLocaleString()
                          : '—'}. Accounting status remains Not Posted.
                      </div>
                    )}

                    {formErrors.length > 0 && (
                      <ul className="rounded-lg border border-red-600/40 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200 space-y-1">
                        {formErrors.map((err) => (
                          <li key={err}>{err}</li>
                        ))}
                      </ul>
                    )}

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
                            onClick={() => setFundingMode(opt.value)}
                            className={cn(
                              'rounded-lg border px-3 py-2.5 text-left min-w-0',
                              fundingMode === opt.value
                                ? 'border-orange-600 bg-orange-500/10'
                                : 'border-border bg-background'
                            )}
                          >
                            <div className="text-sm font-medium">{opt.label}</div>
                            <div className="text-[11px] text-muted-foreground">{opt.hint}</div>
                          </button>
                        ))}
                      </div>
                    </ArrangementSectionCard>

                    <ArrangementSectionCard
                      title="3. Planned Currency"
                      hint="Expected amounts and indicative rates. Not financially posted."
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1 min-w-0">
                          <Label>Planned source currency</Label>
                          <Select
                            value={String(plannedCurrency)}
                            onValueChange={setPlannedCurrency}
                            disabled={fieldsLocked}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {activeCurrencies.map((c) => (
                                <SelectItem key={c.code} value={c.code}>
                                  {c.label || c.code}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1 min-w-0">
                          <Label>Planned settlement currency</Label>
                          <Select
                            value={String(plannedSettlementCurrency)}
                            onValueChange={setPlannedSettlementCurrency}
                            disabled={fieldsLocked}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {activeCurrencies.map((c) => (
                                <SelectItem key={c.code} value={c.code}>
                                  {c.label || c.code}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1 min-w-0">
                          <Label>Expected USD amount</Label>
                          <Input
                            value={plannedUsd}
                            onChange={(e) => setPlannedUsd(e.target.value)}
                            disabled={fieldsLocked}
                            readOnly={fieldsLocked}
                            inputMode="decimal"
                          />
                        </div>
                        <div className="space-y-1 min-w-0">
                          <Label>Expected CNY amount</Label>
                          <Input
                            value={expectedCny}
                            onChange={(e) => setExpectedCny(e.target.value)}
                            disabled={fieldsLocked}
                            readOnly={fieldsLocked}
                            inputMode="decimal"
                          />
                        </div>
                        <div className="space-y-1 min-w-0">
                          <Label>Indicative PKR per USD</Label>
                          <Input
                            value={expectedPkrPerUsd}
                            onChange={(e) => setExpectedPkrPerUsd(e.target.value)}
                            disabled={fieldsLocked}
                            readOnly={fieldsLocked}
                            inputMode="decimal"
                          />
                        </div>
                        <div className="space-y-1 min-w-0">
                          <Label>Indicative CNY per USD</Label>
                          <Input
                            value={expectedCnyPerUsd}
                            onChange={(e) => setExpectedCnyPerUsd(e.target.value)}
                            disabled={fieldsLocked}
                            readOnly={fieldsLocked}
                            inputMode="decimal"
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-2 min-w-0">
                          <Label>Expected fees (PKR) — not financially posted</Label>
                          <Input
                            value={expectedFees}
                            onChange={(e) => setExpectedFees(e.target.value)}
                            disabled={fieldsLocked}
                            readOnly={fieldsLocked}
                            inputMode="decimal"
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-2 min-w-0">
                          <Label>Planned advance amount (PKR) — not financially posted</Label>
                          <Input
                            value={expectedAdvanceAmountPkr}
                            onChange={(e) => setExpectedAdvanceAmountPkr(e.target.value)}
                            disabled={fieldsLocked}
                            readOnly={fieldsLocked}
                            inputMode="decimal"
                          />
                        </div>
                      </div>
                    </ArrangementSectionCard>

                    <ArrangementSectionCard
                      title="4. Expected Schedule"
                      hint="Dates are expectations only. They do not complete Advance or USD acquisition."
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1 min-w-0">
                          <Label>Expected arrangement date</Label>
                          <Input
                            type="date"
                            value={expectedArrangementDate}
                            onChange={(e) => setExpectedArrangementDate(e.target.value)}
                            disabled={fieldsLocked}
                            readOnly={fieldsLocked}
                          />
                        </div>
                        <div className="space-y-1 min-w-0">
                          <Label>Expected advance date</Label>
                          <Input
                            type="date"
                            value={expectedAdvanceDate}
                            onChange={(e) => setExpectedAdvanceDate(e.target.value)}
                            disabled={fieldsLocked}
                            readOnly={fieldsLocked}
                          />
                        </div>
                        <div className="space-y-1 min-w-0">
                          <Label>Expected USD acquisition date</Label>
                          <Input
                            type="date"
                            value={expectedUsdDate}
                            onChange={(e) => setExpectedUsdDate(e.target.value)}
                            disabled={fieldsLocked}
                            readOnly={fieldsLocked}
                          />
                        </div>
                        <div className="space-y-1 min-w-0">
                          <Label>Expected completion date</Label>
                          <Input
                            type="date"
                            value={expectedDate}
                            onChange={(e) => setExpectedDate(e.target.value)}
                            disabled={fieldsLocked}
                            readOnly={fieldsLocked}
                          />
                        </div>
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
                  </div>
                )}

                <div className={cn(W2_ACTION_BAR_CLASS, 'pt-2 border-t border-border')}>
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
                    <Button
                      onClick={() => void handleConfirmArrangement()}
                      disabled={actions.actionsDisabled}
                    >
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
              </>
            )}
          </main>

          <aside className="xl:col-span-2 border-t xl:border-t-0 xl:border-l border-border p-3 overflow-y-auto space-y-3 text-sm min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Summary</p>
            <div className="space-y-1 text-muted-foreground">
              <div>Funding intention: {fundingMode || '—'}</div>
              <div>Expected USD: {plannedUsd || '—'}</div>
              <div>Expected CNY: {expectedCny || '—'}</div>
              <div>Indicative PKR/USD: {expectedPkrPerUsd || '—'}</div>
              <div>Planned advance PKR: {expectedAdvanceAmountPkr || '—'}</div>
              <div className="pt-2 text-xs">
                Journal preview: <span className="text-foreground">none (not financially posted)</span>
              </div>
              <div className="text-xs">Accounting: Not Posted</div>
              <div className="text-xs">posts_journal: false</div>
            </div>
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
          </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
