import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Shield, BookOpen, Lock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { useSupabase } from '@/app/context/SupabaseContext';
import { canAccessAccountingDeveloperCenter } from '@/app/lib/accountingDeveloperCenterAccess';
import {
  buildDeveloperCenterUrl,
  DISABLED_PLACEHOLDER_TABS,
  isDeveloperCenterTabId,
  parseDeveloperCenterQuery,
  parseDeveloperCenterTab,
  PHASE_C_SHELL_TABS,
  type DeveloperCenterTabId,
} from '@/app/lib/accountingDeveloperCenterTabs';
import { CoaHealthTab } from '@/app/components/admin/developer-center/CoaHealthTab';
import { TransactionTraceTab } from '@/app/components/admin/developer-center/TransactionTraceTab';
import { PhaseCTabShell } from '@/app/components/admin/developer-center/PhaseCTabShell';

function readUrlState(): { tab: DeveloperCenterTabId; query: string } {
  if (typeof window === 'undefined') return { tab: 'coa', query: '' };
  const search = window.location.search;
  return {
    tab: parseDeveloperCenterTab(search),
    query: parseDeveloperCenterQuery(search),
  };
}

export default function AccountingDeveloperCenterPage() {
  const { companyId, userRole } = useSupabase();
  const allowed = canAccessAccountingDeveloperCenter(userRole);
  const initial = useMemo(() => readUrlState(), []);
  const [activeTab, setActiveTab] = useState<DeveloperCenterTabId>(initial.tab);
  const [urlQuery, setUrlQuery] = useState(initial.query);

  const syncFromLocation = useCallback(() => {
    const next = readUrlState();
    setActiveTab(next.tab);
    setUrlQuery(next.query);
  }, []);

  useEffect(() => {
    window.addEventListener('popstate', syncFromLocation);
    return () => window.removeEventListener('popstate', syncFromLocation);
  }, [syncFromLocation]);

  const handleTabChange = useCallback(
    (value: string) => {
      if (!isDeveloperCenterTabId(value)) return;
      setActiveTab(value);
      const url = buildDeveloperCenterUrl(window.location.pathname, value, urlQuery);
      window.history.replaceState({}, '', url);
    },
    [urlQuery]
  );

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <Lock className="w-12 h-12 text-gray-600 mb-4" />
        <h1 className="text-xl font-semibold text-white mb-2">Access denied</h1>
        <p className="text-gray-400 max-w-md">
          Accounting Developer Center requires admin, super-admin, developer, or accounting_auditor role.
        </p>
        <p className="text-xs text-gray-600 mt-4">Your role: {userRole || 'unknown'}</p>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="p-8 text-gray-400 text-center">Select a company context to use Developer Center.</div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-7 h-7 text-violet-400" />
            Accounting Developer Center
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Read-only COA health, transaction trace, and Phase C tab shells (C1).
          </p>
        </div>
        <span className="text-xs text-gray-500 flex items-center gap-1" title="docs/accounting/coa-developer-center/">
          <BookOpen className="w-3 h-3" />
          docs/accounting/coa-developer-center/
        </span>
      </div>

      <div className="rounded-lg border border-violet-900/40 bg-violet-950/20 px-3 py-2 text-xs text-violet-200/90">
        Read-only mode. Repair queue, void, sync, and OB tools remain disabled. Phase C shells are navigable only.
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="bg-gray-900 border border-gray-800 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="coa">COA Health</TabsTrigger>
          <TabsTrigger value="trace">Transaction Trace</TabsTrigger>
          {PHASE_C_SHELL_TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
            </TabsTrigger>
          ))}
          {DISABLED_PLACEHOLDER_TABS.map((label) => (
            <span
              key={label}
              className="inline-flex items-center px-3 py-1.5 text-xs text-gray-600 opacity-50 cursor-not-allowed rounded-md"
              title="Permanently disabled in Developer Center"
            >
              {label}
            </span>
          ))}
        </TabsList>

        <TabsContent value="coa">
          <CoaHealthTab companyId={companyId} />
        </TabsContent>

        <TabsContent value="trace">
          <TransactionTraceTab companyId={companyId} initialQuery={urlQuery} />
        </TabsContent>

        {PHASE_C_SHELL_TABS.map((t) => (
          <TabsContent key={t.id} value={t.id}>
            <PhaseCTabShell
              title={t.label}
              phase={t.phase}
              blurb={t.blurb}
              initialQuery={urlQuery || undefined}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
