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
import { useSupabase } from '@/app/context/SupabaseContext';
import { useSettings } from '@/app/context/SettingsContext';
import {
  resolveActiveImportCurrencies,
  type ImportDocCurrency,
} from '@/app/lib/importFxHelpers';
import { formatImportFxServerError } from '@/app/lib/importFxServerGate';
import {
  canEditArrangementType,
  IMPORT_FX_FUNDING_MODES,
  IMPORT_FX_STAGE_ORDER,
  isMoneyStageBlockedInW2,
  isW2ConfirmableStage,
  stageLabel,
  stageStatusTone,
  W2_MONEY_STAGE_BLOCKED_COPY,
  type ImportFxFundingMode,
} from '@/app/lib/importFxCaseHelpers';
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ContactOption = { id: string; name: string };
type PurchaseOption = { id: string; name: string };

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
  const submittingRef = useRef(false);

  const [agentOptions, setAgentOptions] = useState<ContactOption[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<ContactOption[]>([]);
  const [purchaseOptions, setPurchaseOptions] = useState<PurchaseOption[]>([]);

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
    () => agentOptions.filter((a) => a.id !== agentId),
    [agentOptions, agentId]
  );

  const arrangementStageStatus = useMemo(
    () => stages.find((s) => s.stage_code === 'ARRANGEMENT')?.stage_status ?? null,
    [stages]
  );

  const arrangementTypeEditable = canEditArrangementType({
    operationalStatus: caseRow?.operational_status ?? 'DRAFT',
    arrangementStageStatus,
    arrangementConfirmedAt: caseRow?.arrangement_confirmed_at ?? null,
  });

  const loadContacts = useCallback(async () => {
    if (!companyId) return;
    try {
      const contacts = await contactService.getContacts(companyId);
      const list = contacts || [];
      const agents = list
        .filter((c: { type?: string }) => String(c.type || '').toLowerCase() === 'money_exchange')
        .map((c: { id: string; name?: string; code?: string }) => ({
          id: c.id,
          name: `${c.name || 'Agent'}${c.code ? ` (${c.code})` : ''}`,
        }));
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
    }
  }, [companyId]);

  const loadPurchases = useCallback(async () => {
    if (!companyId) return;
    try {
      const { data, error } = await supabase
        .from('purchases')
        .select('id, purchase_number, invoice_number, supplier_id, document_currency, total')
        .eq('company_id', companyId)
        .limit(50);
      if (error) throw error;
      const rows = (data || []) as Array<{
        id: string;
        purchase_number?: string | null;
        invoice_number?: string | null;
        total?: number | null;
        document_currency?: string | null;
      }>;
      setPurchaseOptions(
        rows.map((p) => ({
          id: p.id,
          name: [
            p.purchase_number || p.invoice_number || p.id.slice(0, 8),
            p.document_currency,
            p.total != null ? String(p.total) : null,
          ]
            .filter(Boolean)
            .join(' · '),
        }))
      );
    } catch {
      try {
        const { data } = await supabase
          .from('purchases')
          .select('id, notes')
          .eq('company_id', companyId)
          .limit(50);
        setPurchaseOptions(
          (data || []).map((p: { id: string; notes?: string | null }) => ({
            id: p.id,
            name: p.notes?.trim() || p.id.slice(0, 8),
          }))
        );
      } catch {
        setPurchaseOptions([]);
      }
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
        const firstOpen =
          detail.stages.find((s) => s.stage_status !== 'COMPLETED' && s.stage_status !== 'CANCELLED')
            ?.stage_code || 'ARRANGEMENT';
        setActiveStage(firstOpen);
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

  const activeStageRow = useMemo(
    () => stages.find((s) => s.stage_code === activeStage) || null,
    [stages, activeStage]
  );

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

  const runBusy = async (fn: () => Promise<void>) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (!companyId || readOnly) return;
    await runBusy(async () => {
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
            : `Case ${created.caseNo} created (draft — not financially posted)`
        );
        setSelectedCaseId(created.caseId);
        await refreshList();
      } catch (e) {
        toast.error(formatImportFxServerError(e));
      }
    });
  };

  const handleSaveDraft = async () => {
    if (!companyId || !selectedCaseId || readOnly) return;
    await runBusy(async () => {
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
        toast.success('Draft saved — no journal posted');
        await loadDetail(selectedCaseId);
        await refreshList();
      } catch (e) {
        toast.error(formatImportFxServerError(e));
      }
    });
  };

  const handleConfirmArrangement = async () => {
    if (!companyId || !selectedCaseId || readOnly) return;
    if (!isW2ConfirmableStage(activeStage)) {
      toast.error(W2_MONEY_STAGE_BLOCKED_COPY);
      return;
    }
    await runBusy(async () => {
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
            ? 'Arrangement already confirmed (no journal)'
            : `Arrangement confirmed → ${result.operationalStatus} (not financially posted)`
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
    await runBusy(async () => {
      try {
        await cancelImportFxCaseUnposted({
          companyId,
          caseId: selectedCaseId,
          notes: notes || 'Cancelled unposted case',
          updatedBy: user?.id ?? null,
        });
        toast.success('Unposted case cancelled');
        await loadDetail(selectedCaseId);
        await refreshList();
      } catch (e) {
        toast.error(formatImportFxServerError(e));
      }
    });
  };

  const handleLinkSupplier = async () => {
    if (!companyId || !selectedCaseId || !linkSupplierId || readOnly) return;
    await runBusy(async () => {
      try {
        await linkImportFxCaseTarget({
          companyId,
          caseId: selectedCaseId,
          linkType: 'SUPPLIER',
          linkId: linkSupplierId,
          notes: 'Planning link — intention only',
        });
        toast.success('Supplier planning link added');
        setLinkSupplierId('');
        await loadDetail(selectedCaseId);
      } catch (e) {
        toast.error(formatImportFxServerError(e));
      }
    });
  };

  const handleLinkPurchase = async () => {
    if (!companyId || !selectedCaseId || !linkPurchaseId || readOnly) return;
    await runBusy(async () => {
      try {
        await linkImportFxCaseTarget({
          companyId,
          caseId: selectedCaseId,
          linkType: 'PURCHASE',
          linkId: linkPurchaseId,
          notes: 'Planning link — intention only',
        });
        toast.success('Purchase planning link added');
        setLinkPurchaseId('');
        await loadDetail(selectedCaseId);
      } catch (e) {
        toast.error(formatImportFxServerError(e));
      }
    });
  };

  const handleRegisterAttachment = async () => {
    if (!companyId || !selectedCaseId || readOnly) return;
    const name = attachmentFileName.trim();
    if (!name) {
      toast.error('Enter a file name for metadata registration');
      return;
    }
    await runBusy(async () => {
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
            ? 'Attachment metadata already registered'
            : 'Attachment metadata registered (no upload)'
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-2 md:p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {readOnly ? 'Import FX Cases — Read Only' : 'Import FX Cases'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {readOnly
                ? 'Historical Import FX cases only. Enable Multi Currency to create or continue workflows.'
                : 'Wave W2 — ARRANGEMENT enrichment (planned / expected / intention only). No money journals. Path 21 Agent FX stays separate.'}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {readOnly && (
          <div className="mx-4 mt-3 rounded-lg border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
            Multi Currency is currently disabled. Historical Import FX cases are available in
            read-only mode. Enable Multi Currency to create or continue operational workflows.
          </div>
        )}

        <div className="mx-4 mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          No accounting posted — planning events keep <span className="text-foreground">posts_journal = false</span>.
          Fields below are Planned / Expected / Intention only — not financially posted.
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12">
          <aside className="md:col-span-3 border-r border-border p-3 space-y-2 overflow-y-auto">
            <div className="flex gap-2">
              <Input
                placeholder="Search case no…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9"
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
                <SelectItem value="DRAFT">DRAFT</SelectItem>
                <SelectItem value="ARRANGED">ARRANGED</SelectItem>
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
                    'w-full text-left rounded-md border px-2 py-2 text-sm transition-colors',
                    selectedCaseId === c.id
                      ? 'border-orange-600 bg-orange-500/10'
                      : 'border-border hover:bg-muted/50'
                  )}
                >
                  <div className="font-medium text-foreground">{c.case_no}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.operational_status} · {c.accounting_status}
                  </div>
                </button>
              ))}
              {!loadingList && cases.length === 0 && (
                <p className="text-xs text-muted-foreground px-1">No cases yet.</p>
              )}
            </div>
          </aside>

          <nav className="md:col-span-3 border-r border-border p-3 overflow-y-auto space-y-1">
            <p className="text-xs font-medium text-muted-foreground mb-2">Timeline</p>
            {IMPORT_FX_STAGE_ORDER.map((s) => {
              const row = stages.find((x) => x.stage_code === s.code);
              const status = (row?.stage_status || 'NOT_STARTED') as ImportFxCaseStage['stage_status'];
              const blocked = isMoneyStageBlockedInW2(s.code);
              return (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => setActiveStage(s.code)}
                  className={cn(
                    'w-full text-left rounded-md border px-2 py-2 text-sm',
                    activeStage === s.code ? 'ring-1 ring-orange-600' : '',
                    toneClass(stageStatusTone(status))
                  )}
                >
                  <div className="font-medium">{s.label}</div>
                  <div className="text-[11px] opacity-80">
                    {status}
                    {blocked ? ' · W3+' : ''}
                  </div>
                </button>
              );
            })}
          </nav>

          <main className="md:col-span-4 p-4 overflow-y-auto space-y-4">
            {detailLoading && selectedCaseId ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading case…
              </div>
            ) : (
              <>
                <div>
                  <h3 className="font-semibold text-foreground">{stageLabel(activeStage)}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {caseRow
                      ? `${caseRow.case_no} · ops ${caseRow.operational_status} · acct ${caseRow.accounting_status}`
                      : 'New case — Save creates a draft with no journal.'}
                  </p>
                  {activeStageRow && (
                    <p className="text-xs mt-1 text-muted-foreground">
                      Stage status: {activeStageRow.stage_status}
                    </p>
                  )}
                </div>

                {isMoneyStageBlockedInW2(activeStage) ? (
                  <div className="rounded-lg border border-amber-600/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
                    {W2_MONEY_STAGE_BLOCKED_COPY}. Use Path 21 <strong>Agent FX</strong> for
                    same-session credit settle until W3+ money stages ship. No advance or USD money
                    actions in this workspace.
                  </div>
                ) : (
                  <div className={cn('space-y-3', readOnly && 'pointer-events-none opacity-90')}>
                    <div className="space-y-1">
                      <Label>Arrangement type (intention)</Label>
                      <Select
                        value={arrangementType}
                        onValueChange={(v) => setArrangementType(v as ImportFxArrangementType)}
                        disabled={readOnly || (!!selectedCaseId && !arrangementTypeEditable)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="POOLED_USD_CNY">Pooled USD → CNY</SelectItem>
                          <SelectItem value="PATH_21_AGENT_DUAL_CREDIT">
                            Path 21 Agent Dual Credit
                          </SelectItem>
                          <SelectItem value="AGENT_PREPAID">Agent prepaid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label>Funding mode (intention — not paid)</Label>
                      <Select
                        value={fundingMode || undefined}
                        onValueChange={(v) => setFundingMode(v as ImportFxFundingMode)}
                        disabled={readOnly}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select funding intention…" />
                        </SelectTrigger>
                        <SelectContent>
                          {IMPORT_FX_FUNDING_MODES.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label>Agent (money_exchange)</Label>
                      <SearchableSelect
                        options={agentOptions}
                        value={agentId}
                        onValueChange={(v) => {
                          setAgentId(v);
                          if (thirdPartyId === v) setThirdPartyId('');
                        }}
                        placeholder="Select agent…"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Third party (money_exchange, optional)</Label>
                      <SearchableSelect
                        options={thirdPartyOptions}
                        value={thirdPartyId}
                        onValueChange={setThirdPartyId}
                        placeholder="Converter / custodian…"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label>Planned source currency</Label>
                        <Select
                          value={String(plannedCurrency)}
                          onValueChange={setPlannedCurrency}
                          disabled={readOnly}
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
                      <div className="space-y-1">
                        <Label>Planned settlement currency</Label>
                        <Select
                          value={String(plannedSettlementCurrency)}
                          onValueChange={setPlannedSettlementCurrency}
                          disabled={readOnly}
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
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label>Planned USD</Label>
                        <Input
                          value={plannedUsd}
                          onChange={(e) => setPlannedUsd(e.target.value)}
                          disabled={readOnly}
                          readOnly={readOnly}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Expected CNY</Label>
                        <Input
                          value={expectedCny}
                          onChange={(e) => setExpectedCny(e.target.value)}
                          disabled={readOnly}
                          readOnly={readOnly}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Expected PKR / USD</Label>
                        <Input
                          value={expectedPkrPerUsd}
                          onChange={(e) => setExpectedPkrPerUsd(e.target.value)}
                          disabled={readOnly}
                          readOnly={readOnly}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Expected CNY / USD</Label>
                        <Input
                          value={expectedCnyPerUsd}
                          onChange={(e) => setExpectedCnyPerUsd(e.target.value)}
                          disabled={readOnly}
                          readOnly={readOnly}
                        />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <Label>Expected fees (PKR) — not financially posted</Label>
                        <Input
                          value={expectedFees}
                          onChange={(e) => setExpectedFees(e.target.value)}
                          disabled={readOnly}
                          readOnly={readOnly}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label>Expected arrangement date</Label>
                        <Input
                          type="date"
                          value={expectedArrangementDate}
                          onChange={(e) => setExpectedArrangementDate(e.target.value)}
                          disabled={readOnly}
                          readOnly={readOnly}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Expected advance date (not paid)</Label>
                        <Input
                          type="date"
                          value={expectedAdvanceDate}
                          onChange={(e) => setExpectedAdvanceDate(e.target.value)}
                          disabled={readOnly}
                          readOnly={readOnly}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Expected USD date (not purchased)</Label>
                        <Input
                          type="date"
                          value={expectedUsdDate}
                          onChange={(e) => setExpectedUsdDate(e.target.value)}
                          disabled={readOnly}
                          readOnly={readOnly}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Expected completion</Label>
                        <Input
                          type="date"
                          value={expectedDate}
                          onChange={(e) => setExpectedDate(e.target.value)}
                          disabled={readOnly}
                          readOnly={readOnly}
                        />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <Label>Expected advance amount (PKR) — not paid</Label>
                        <Input
                          value={expectedAdvanceAmountPkr}
                          onChange={(e) => setExpectedAdvanceAmountPkr(e.target.value)}
                          disabled={readOnly}
                          readOnly={readOnly}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label>Agent reference (quote / intention)</Label>
                      <Input
                        value={agentReference}
                        onChange={(e) => setAgentReference(e.target.value)}
                        disabled={readOnly}
                        readOnly={readOnly}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Notes</Label>
                      <Input
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={readOnly}
                        readOnly={readOnly}
                      />
                    </div>

                    {selectedCaseId && (
                      <div className="space-y-3 pt-3 border-t border-border">
                        <div className="rounded-lg border border-amber-600/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
                          Planning links only — do not create supplier payments
                        </div>

                        <div className="space-y-1">
                          <Label>Link supplier (planning)</Label>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <SearchableSelect
                                options={supplierOptions}
                                value={linkSupplierId}
                                onValueChange={setLinkSupplierId}
                                placeholder="Select supplier…"
                              />
                            </div>
                            {!readOnly && (
                              <Button
                                variant="secondary"
                                disabled={busy || !linkSupplierId}
                                onClick={() => void handleLinkSupplier()}
                              >
                                Link
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label>Link purchase (planning)</Label>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <SearchableSelect
                                options={purchaseOptions}
                                value={linkPurchaseId}
                                onValueChange={setLinkPurchaseId}
                                placeholder="Select purchase…"
                              />
                            </div>
                            {!readOnly && (
                              <Button
                                variant="secondary"
                                disabled={busy || !linkPurchaseId}
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
                          <Label>Attachment file name (metadata only — no upload)</Label>
                          <div className="flex gap-2">
                            <Input
                              value={attachmentFileName}
                              onChange={(e) => setAttachmentFileName(e.target.value)}
                              placeholder="e.g. quote-scan.pdf"
                              disabled={readOnly}
                              readOnly={readOnly}
                            />
                            {!readOnly && (
                              <Button
                                variant="secondary"
                                disabled={busy || !attachmentFileName.trim()}
                                onClick={() => void handleRegisterAttachment()}
                              >
                                Register metadata
                              </Button>
                            )}
                          </div>
                          {attachments.length > 0 && (
                            <ul className="space-y-1 text-xs text-muted-foreground mt-2">
                              {attachments.map((a) => (
                                <li key={a.id} className="border-b border-border/50 pb-1">
                                  <span className="text-foreground">{a.file_name || 'unnamed'}</span>
                                  {a.is_metadata_only !== false
                                    ? ' · metadata only (no file stored)'
                                    : ''}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!readOnly && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                    {!selectedCaseId ? (
                      <Button onClick={() => void handleCreate()} disabled={busy}>
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Create Draft Case
                      </Button>
                    ) : (
                      <>
                        <Button variant="secondary" onClick={() => void handleSaveDraft()} disabled={busy}>
                          Save Draft
                        </Button>
                        {isW2ConfirmableStage(activeStage) && (
                          <Button onClick={() => void handleConfirmArrangement()} disabled={busy}>
                            Confirm Arrangement
                          </Button>
                        )}
                        {caseRow?.accounting_status === 'NOT_POSTED' &&
                          caseRow.operational_status !== 'CANCELLED' && (
                            <Button variant="destructive" onClick={() => void handleCancel()} disabled={busy}>
                              Cancel Unposted
                            </Button>
                          )}
                      </>
                    )}
                  </div>
                )}
                {readOnly && selectedCaseId && (
                  <p className="pt-2 border-t border-border text-xs text-muted-foreground">
                    Read-only history — mutation actions are unavailable while Multi Currency is off.
                  </p>
                )}
              </>
            )}
          </main>

          <aside className="md:col-span-2 border-l border-border p-3 overflow-y-auto space-y-3 text-sm">
            <p className="text-xs font-medium text-muted-foreground">Live summary</p>
            <div className="space-y-1 text-muted-foreground">
              <div>Funding intention: {fundingMode || '—'}</div>
              <div>Planned USD: {plannedUsd || '—'}</div>
              <div>Expected CNY: {expectedCny || '—'}</div>
              <div>Expected PKR/USD: {expectedPkrPerUsd || '—'}</div>
              <div>Expected advance PKR: {expectedAdvanceAmountPkr || '—'}</div>
              <div>Expected fees PKR: {expectedFees || '—'}</div>
              <div className="pt-2 text-xs">
                Journal preview: <span className="text-foreground">none (W2 planning)</span>
              </div>
              <div className="text-xs">Accounting: {caseRow?.accounting_status || 'NOT_POSTED'}</div>
              <div className="text-xs">posts_journal: false</div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Recent events</p>
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {events.slice(0, 12).map((e) => (
                  <li key={e.id} className="text-[11px] text-muted-foreground border-b border-border/50 pb-1">
                    <span className="text-foreground">{e.event_type}</span>
                    {e.posts_journal ? ' · JE!' : ' · no JE'}
                  </li>
                ))}
                {events.length === 0 && <li className="text-[11px] text-muted-foreground">No events</li>}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
