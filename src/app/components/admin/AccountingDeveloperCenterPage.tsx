import React, { useMemo } from 'react';
import { Shield, BookOpen, Lock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { useSupabase } from '@/app/context/SupabaseContext';
import { canAccessAccountingDeveloperCenter } from '@/app/lib/accountingDeveloperCenterAccess';
import { CoaHealthTab } from '@/app/components/admin/developer-center/CoaHealthTab';
import { TransactionTraceTab } from '@/app/components/admin/developer-center/TransactionTraceTab';

const PLACEHOLDER_TABS = [
  'Journal Integrity',
  'Payment Trace',
  'Roznamcha Trace',
  'Statement Trace',
  'Day Book',
  'Opening Balance',
  'Repair Queue',
  'Audit Log',
] as const;

function useInitialTab(): 'coa' | 'trace' {
  if (typeof window === 'undefined') return 'coa';
  const p = new URLSearchParams(window.location.search);
  return p.get('tab') === 'trace' ? 'trace' : 'coa';
}

function useInitialQuery(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('q') || '';
}

export default function AccountingDeveloperCenterPage() {
  const { companyId, userRole } = useSupabase();
  const allowed = canAccessAccountingDeveloperCenter(userRole);
  const defaultTab = useMemo(() => useInitialTab(), []);
  const initialQuery = useMemo(() => useInitialQuery(), []);

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
            Read-only COA health and transaction trace. Phase B — no repairs.
          </p>
        </div>
        <span className="text-xs text-gray-500 flex items-center gap-1" title="docs/accounting/coa-developer-center/">
          <BookOpen className="w-3 h-3" />
          docs/accounting/coa-developer-center/
        </span>
      </div>

      <div className="rounded-lg border border-violet-900/40 bg-violet-950/20 px-3 py-2 text-xs text-violet-200/90">
        Read-only mode. Repair queue, void, sync, and OB tools are disabled until Phase C–E.
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList className="bg-gray-900 border border-gray-800 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="coa">COA Health</TabsTrigger>
          <TabsTrigger value="trace">Transaction Trace</TabsTrigger>
          {PLACEHOLDER_TABS.map((label) => (
            <span
              key={label}
              className="inline-flex items-center px-3 py-1.5 text-xs text-gray-600 opacity-50 cursor-not-allowed rounded-md"
              title="Coming in Phase C"
            >
              {label}
            </span>
          ))}
        </TabsList>

        <TabsContent value="coa">
          <CoaHealthTab companyId={companyId} />
        </TabsContent>

        <TabsContent value="trace">
          <TransactionTraceTab companyId={companyId} initialQuery={initialQuery} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
