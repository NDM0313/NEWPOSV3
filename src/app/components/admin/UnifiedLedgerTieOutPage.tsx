/**
 * Unified Ledger Compare Center — admin shadow compare (Phase 2.2).
 * Route: /admin/unified-ledger-tieout (backward compatible)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { canAccessAccountingDeveloperCenter } from '@/app/lib/accountingDeveloperCenterAccess';
import {
  getUnifiedLedgerLocalOverride,
  setUnifiedLedgerLocalOverride,
} from '@/app/lib/unifiedLedgerFeatureFlag';
import { unifiedBasisToReportBasis } from '@/app/lib/unifiedLedgerBasisUi';
import { UnifiedLedgerEngineBanner } from '@/app/components/accounting/UnifiedLedgerEngineBanner';
import { UnifiedLedgerPreviewBadge } from '@/app/components/accounting/UnifiedLedgerPreviewBadge';
import { ReportBasisBanner } from '@/app/components/accounting/ReportBasisBanner';
import { useUnifiedLedgerEngineState } from '@/app/hooks/useUnifiedLedgerEngineState';
import { unifiedBasisLabel } from '@/app/services/unifiedLedgerService';
import type { UnifiedLedgerBasis } from '@/app/services/unifiedLedgerService';
import type { UnifiedLedgerCompareTabId } from '@/app/lib/unifiedLedgerCompareTypes';
import { supabase } from '@/lib/supabase';
import { Button } from '@/app/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { BASIS_OPTIONS, type CompareFilterState } from '@/app/components/admin/unified-ledger-compare/compareFilters';
import { PartyLedgerCompareTab } from '@/app/components/admin/unified-ledger-compare/PartyLedgerCompareTab';
import { PilotBatchCompareTab } from '@/app/components/admin/unified-ledger-compare/PilotBatchCompareTab';
import { AccountLedgerCompareTab } from '@/app/components/admin/unified-ledger-compare/AccountLedgerCompareTab';
import { TrialBalanceCompareTab } from '@/app/components/admin/unified-ledger-compare/TrialBalanceCompareTab';
import { CashBankCompareTab } from '@/app/components/admin/unified-ledger-compare/CashBankCompareTab';

type ContactOption = { id: string; code: string; name: string; type: string };
type BranchOption = { id: string; name: string; code: string | null };

const TABS: { id: UnifiedLedgerCompareTabId; label: string }[] = [
  { id: 'party', label: 'Party' },
  { id: 'pilot_batch', label: 'Pilot Batch' },
  { id: 'account', label: 'Account' },
  { id: 'trial_balance', label: 'Trial Balance' },
  { id: 'cash_bank', label: 'Cash / Bank' },
];

export default function UnifiedLedgerTieOutPage() {
  const { companyId, userRole } = useSupabase();
  const canAccess = canAccessAccountingDeveloperCenter(userRole);

  const [activeTab, setActiveTab] = useState<UnifiedLedgerCompareTabId>('party');
  const [basis, setBasis] = useState<UnifiedLedgerBasis>('effective_party');
  const [branchId, setBranchId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [flagSync, setFlagSync] = useState(0);

  const localOverride = useMemo(() => getUnifiedLedgerLocalOverride(), [flagSync]);
  const { state: engineState, refresh: refreshEngineState } = useUnifiedLedgerEngineState(
    companyId,
    { adminTieOut: true, shadowForce: true }
  );

  const reportBasis = useMemo(() => unifiedBasisToReportBasis(basis), [basis]);

  const filters: CompareFilterState = useMemo(
    () => ({ branchId, basis, dateFrom, dateTo }),
    [branchId, basis, dateFrom, dateTo]
  );

  const loadBranches = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('branches')
      .select('id, name, code')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');
    setBranches((data || []) as BranchOption[]);
  }, [companyId]);

  const loadContacts = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('contacts')
      .select('id, code, name, type')
      .eq('company_id', companyId)
      .order('name');
    setContacts((data || []) as ContactOption[]);
  }, [companyId]);

  useEffect(() => {
    loadBranches();
    loadContacts();
  }, [loadBranches, loadContacts]);

  if (!canAccess) {
    return (
      <div className="p-8 text-foreground">
        <h1 className="text-xl font-semibold">Unified Ledger Compare</h1>
        <p className="text-muted-foreground mt-2">Developer / admin access required.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary text-foreground p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex flex-wrap items-center gap-2">
          Unified Ledger Compare Center
          <UnifiedLedgerPreviewBadge mode={engineState.mode} />
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Admin-only old-vs-new preview. Production statement screens unchanged.
          {localOverride !== null && (
            <span className="ml-2 text-xs text-amber-400">
              localStorage override: {String(localOverride)}
            </span>
          )}
        </p>
      </div>

      <div className="space-y-2">
        <UnifiedLedgerEngineBanner mode={engineState.mode} />
        <ReportBasisBanner basis={reportBasis} detail={`RPC lens: ${unifiedBasisLabel(basis)}`} />
      </div>

      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground grid md:grid-cols-3 gap-2">
        <span>Kill switch: {engineState.killSwitchActive ? 'ON' : 'OFF'}</span>
        <span>Company engine: {engineState.companyEngineEnabled ? 'ON' : 'OFF'}</span>
        <span>Pilot: {engineState.pilotEnabled ? 'ON' : 'OFF'}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setUnifiedLedgerLocalOverride(null);
            setFlagSync((n) => n + 1);
            refreshEngineState();
          }}
        >
          Clear flag override
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setUnifiedLedgerLocalOverride(true);
            setFlagSync((n) => n + 1);
            refreshEngineState();
          }}
        >
          Dev: force flag ON
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setUnifiedLedgerLocalOverride(false);
            setFlagSync((n) => n + 1);
            refreshEngineState();
          }}
        >
          Dev: force flag OFF
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 rounded-xl border border-border bg-card/40 p-4">
        <p className="text-xs text-muted-foreground lg:col-span-5">
          Leave <strong>From</strong> empty for lifetime golden compare (Phase 1.8 — both dates sent as null).
          Set From + To for period-scoped compare.
        </p>
        <label className="text-sm space-y-1">
          Basis
          <select
            className="w-full rounded bg-muted border border-border px-2 py-1.5"
            value={basis}
            onChange={(e) => setBasis(e.target.value as UnifiedLedgerBasis)}
          >
            {BASIS_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {unifiedBasisLabel(b)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm space-y-1">
          Branch
          <select
            className="w-full rounded bg-muted border border-border px-2 py-1.5"
            value={branchId ?? ''}
            onChange={(e) => setBranchId(e.target.value || null)}
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code || '—'})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm space-y-1">
          From
          <input
            type="date"
            className="w-full rounded bg-muted border border-border px-2 py-1.5"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </label>
        <label className="text-sm space-y-1">
          To
          <input
            type="date"
            className="w-full rounded bg-muted border border-border px-2 py-1.5"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </label>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as UnifiedLedgerCompareTabId)}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/60">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="text-xs sm:text-sm">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="party" className="mt-4">
          <PartyLedgerCompareTab
            companyId={companyId}
            contacts={contacts}
            filters={filters}
          />
        </TabsContent>
        <TabsContent value="pilot_batch" className="mt-4">
          <PilotBatchCompareTab filters={filters} />
        </TabsContent>
        <TabsContent value="account" className="mt-4">
          <AccountLedgerCompareTab companyId={companyId} filters={filters} />
        </TabsContent>
        <TabsContent value="trial_balance" className="mt-4">
          <TrialBalanceCompareTab companyId={companyId} filters={filters} />
        </TabsContent>
        <TabsContent value="cash_bank" className="mt-4">
          <CashBankCompareTab companyId={companyId} filters={filters} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
