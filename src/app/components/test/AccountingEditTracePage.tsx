'use client';

import React, { useMemo, useState } from 'react';
import { Card } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { useExpenses } from '@/app/context/ExpenseContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import {
  classifyPaidExpenseEdit,
  classifySalesEdit,
  classifyPurchaseEdit,
  classifyPaymentEdit,
  classifyInventoryEdit,
  evaluateEditSafetyViolations,
  isAccountingEditSafetyTestMode,
  setAccountingEditSafetyTestMode,
  type GenericEditClassification,
} from '@/app/lib/accountingEditClassification';
import {
  ACCOUNTING_EDIT_SCENARIOS,
  type AccountingEditModuleKey,
  type ScenarioDomainExpectation,
} from '@/app/lib/accountingEditScenarioMatrix';
import {
  getAccountingEditTraceLog,
  clearAccountingEditTraceLog,
  exportAccountingEditTraceLog,
} from '@/app/lib/accountingEditTrace';

type Classified = GenericEditClassification;

function matchScenario(actual: Classified, exp: ScenarioDomainExpectation): { pass: boolean; errors: string[] } {
  const errors: string[] = [];
  const dom = new Set(actual.affectedDomains);
  for (const d of exp.mustIncludeDomains) {
    if (!dom.has(d)) errors.push(`missing domain: ${d}`);
  }
  for (const d of exp.mustExcludeDomains || []) {
    if (dom.has(d)) errors.push(`unexpected domain: ${d}`);
  }
  const ap = actual.actionPlan;
  const want = exp.actionPlan;
  (['updateHeader', 'adjustAccounting', 'adjustInventory', 'touchPayments'] as const).forEach((k) => {
    if (want[k] !== undefined && ap[k] !== want[k]) {
      errors.push(`actionPlan.${k}: expected ${want[k]}, got ${ap[k]}`);
    }
  });
  if (exp.forbidFullReverse && actual.kind === 'FULL_REVERSE_REPOST') {
    errors.push('forbidden: FULL_REVERSE_REPOST for this scenario');
  }
  errors.push(...evaluateEditSafetyViolations(actual));
  return { pass: errors.length === 0, errors };
}

type ScenarioResult = {
  key: string;
  title: string;
  module: AccountingEditModuleKey;
  expected: ScenarioDomainExpectation;
  pass: boolean;
  errors: string[];
  actual: Classified;
  reversalAttempted: boolean;
  before: Record<string, unknown>;
  updates: Record<string, unknown>;
};

const MODULES: AccountingEditModuleKey[] = [
  'sales',
  'purchases',
  'customer_payments',
  'supplier_payments',
  'expenses',
  'inventory',
];

export const AccountingEditTracePage: React.FC = () => {
  const { companyId } = useSupabase();
  const { expenses } = useExpenses();
  const [moduleFilter, setModuleFilter] = useState<AccountingEditModuleKey | 'all'>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [safetyTestMode, setSafetyTestModeState] = useState(() => isAccountingEditSafetyTestMode());

  const paidExpense = useMemo(
    () => expenses.find((e) => String(e.status).toLowerCase() === 'paid'),
    [expenses]
  );

  const baseByModule = useMemo<Record<AccountingEditModuleKey, Record<string, unknown>>>(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      sales: {
        notes: 'old',
        referenceNo: 'SL-0001',
        date: today,
        customerId: 'cust-a',
        itemQtyTotal: 2,
        itemRateTotal: 500,
        discount: 0,
        shipping: 0,
        paymentAccountId: 'acc-cash',
        branchId: 'br-1',
        paymentStatus: 'paid',
        saleType: 'cash',
      },
      purchases: {
        notes: 'old',
        supplierRef: 'PUR-0001',
        date: today,
        supplierId: 'sup-a',
        itemQtyTotal: 2,
        itemCostTotal: 450,
        discount: 0,
        freight: 0,
        tax: 0,
        payableAccountId: 'acc-ap',
        branchId: 'br-1',
        stockImpactQty: 2,
      },
      customer_payments: {
        notes: 'old',
        date: today,
        contactId: 'cust-a',
        amount: 1000,
        accountId: 'acc-cash',
        allocationRef: 'SL-0001',
        branchId: 'br-1',
      },
      supplier_payments: {
        notes: 'old',
        date: today,
        contactId: 'sup-a',
        amount: 1000,
        accountId: 'acc-bank',
        allocationRef: 'PUR-0001',
        branchId: 'br-1',
      },
      expenses: {
        status: String(paidExpense?.status || 'paid').toLowerCase(),
        amount: Number(paidExpense?.amount || 100),
        paymentMethod: paidExpense?.paymentMethod || 'other',
        date: paidExpense?.date || today,
        location: paidExpense?.location || 'br-1',
        paymentAccountId: paidExpense?.paymentAccountId || 'acc-wallet',
        /** Display-style label so slug noise scenarios match live ERP behavior */
        category: 'Utilities',
        description: paidExpense?.description || 'Expense',
        notes: null as string | null,
        payeeName: null as string | null,
      },
      inventory: {
        notes: 'old',
        date: today,
        qty: 10,
        valuation: 1000,
        accountId: 'acc-inv',
        branchId: 'br-1',
      },
    };
  }, [paidExpense]);

  const results = useMemo<ScenarioResult[]>(() => {
    if (!companyId) return [];
    return ACCOUNTING_EDIT_SCENARIOS.map((s) => {
      const before = baseByModule[s.module];
      const updates = s.patch(before);
      let actual: Classified;
      if (s.module === 'sales') actual = classifySalesEdit({ oldSnap: before, newSnap: { ...before, ...updates } });
      else if (s.module === 'purchases')
        actual = classifyPurchaseEdit({ oldSnap: before, newSnap: { ...before, ...updates } });
      else if (s.module === 'customer_payments')
        actual = classifyPaymentEdit({ oldSnap: before, newSnap: { ...before, ...updates }, side: 'customer' });
      else if (s.module === 'supplier_payments')
        actual = classifyPaymentEdit({ oldSnap: before, newSnap: { ...before, ...updates }, side: 'supplier' });
      else if (s.module === 'inventory')
        actual = classifyInventoryEdit({ oldSnap: before, newSnap: { ...before, ...updates } });
      else actual = classifyPaidExpenseEdit(before as any, updates as any, companyId) as Classified;

      const { pass, errors } = matchScenario(actual, s.expected);
      const reversalAttempted = actual.kind === 'FULL_REVERSE_REPOST';

      return {
        key: s.key,
        title: s.title,
        module: s.module,
        expected: s.expected,
        pass,
        errors,
        actual,
        reversalAttempted,
        before,
        updates,
      };
    });
  }, [companyId, baseByModule]);

  const filtered = results.filter((r) => moduleFilter === 'all' || r.module === moduleFilter);
  const selectedRow = filtered.find((r) => r.key === selected) || filtered[0] || null;

  const summary = useMemo(() => {
    const total = filtered.length;
    const passed = filtered.filter((r) => r.pass).length;
    const failed = total - passed;
    const fullReverse = filtered.filter((r) => r.actual.kind === 'FULL_REVERSE_REPOST').length;
    const modulesWithFailures = new Set(filtered.filter((r) => !r.pass).map((r) => r.module)).size;
    return { total, passed, failed, fullReverse, modulesWithFailures };
  }, [filtered]);

  const traces = getAccountingEditTraceLog().slice(-80).reverse();
  const failingKeys = filtered.filter((r) => !r.pass).map((r) => `${r.key}: ${r.errors.join('; ')}`).join('\n');

  return (
    <div className="h-full w-full bg-[#0B0F19] text-white p-6 space-y-6 overflow-auto">
      <Card className="bg-gray-900 border-gray-800 p-5">
        <h2 className="text-lg font-semibold">Unified Accounting Edit Trace Bench</h2>
        <p className="text-sm text-gray-400 mt-2">
          Route: <code>/test/accounting-edit-trace</code>. Classifier output: <code>affectedDomains</code>, field buckets,{' '}
          <code>actionPlan</code>, and safety rules (no blanket full reverse for header-only edits).
        </p>
        <div className="flex items-center gap-3 mt-3">
          <Button
            variant={safetyTestMode ? 'default' : 'outline'}
            className="border-gray-700"
            onClick={() => {
              const next = !safetyTestMode;
              setAccountingEditSafetyTestMode(next);
              setSafetyTestModeState(next);
            }}
          >
            Safety test mode (throw on violations): {safetyTestMode ? 'ON' : 'OFF'}
          </Button>
          <span className="text-xs text-gray-500">Uses localStorage key accounting_edit_safety_test_mode=1</span>
        </div>
      </Card>

      <div className="grid grid-cols-5 gap-3">
        <Card className="bg-gray-900 border-gray-800 p-3">
          <div className="text-xs text-gray-400">Total</div>
          <div className="text-xl">{summary.total}</div>
        </Card>
        <Card className="bg-gray-900 border-gray-800 p-3">
          <div className="text-xs text-gray-400">Passed</div>
          <div className="text-xl text-emerald-400">{summary.passed}</div>
        </Card>
        <Card className="bg-gray-900 border-gray-800 p-3">
          <div className="text-xs text-gray-400">Failed</div>
          <div className="text-xl text-red-400">{summary.failed}</div>
        </Card>
        <Card className="bg-gray-900 border-gray-800 p-3">
          <div className="text-xs text-gray-400">FULL_REVERSE_REPOST</div>
          <div className="text-xl text-amber-300">{summary.fullReverse}</div>
        </Card>
        <Card className="bg-gray-900 border-gray-800 p-3">
          <div className="text-xs text-gray-400">Modules with failures</div>
          <div className="text-xl">{summary.modulesWithFailures}</div>
        </Card>
      </div>

      <Card className="bg-gray-900 border-gray-800 p-4">
        <div className="flex flex-wrap gap-2">
          <Button variant={moduleFilter === 'all' ? 'default' : 'outline'} onClick={() => setModuleFilter('all')}>
            All
          </Button>
          {MODULES.map((m) => (
            <Button key={m} variant={moduleFilter === m ? 'default' : 'outline'} onClick={() => setModuleFilter(m)}>
              {m}
            </Button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-12 gap-4">
        <Card className="bg-gray-900 border-gray-800 p-4 col-span-7">
          <h3 className="font-medium mb-3">Scenarios</h3>
          <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
            {filtered.map((r) => (
              <button
                key={r.key}
                onClick={() => setSelected(r.key)}
                className={`w-full text-left border rounded-lg p-3 ${selectedRow?.key === r.key ? 'border-blue-500 bg-blue-500/10' : 'border-gray-800 bg-gray-950/40'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-gray-200">{r.title}</div>
                  <Badge className={r.pass ? 'bg-emerald-700' : 'bg-red-700'}>{r.pass ? 'PASS' : 'FAIL'}</Badge>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  kind: {r.actual.kind} · domains: {r.actual.affectedDomains.join(', ') || '—'} · full reverse:{' '}
                  {r.reversalAttempted ? 'yes' : 'no'}
                </div>
                {!r.pass && r.errors.length > 0 && (
                  <div className="text-xs text-red-300 mt-1">{r.errors.join(' · ')}</div>
                )}
              </button>
            ))}
          </div>
        </Card>

        <Card className="bg-gray-900 border-gray-800 p-4 col-span-5">
          <h3 className="font-medium mb-3">Detail</h3>
          {!selectedRow ? (
            <p className="text-sm text-gray-400">No scenario selected.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-400">Scenario:</span> {selectedRow.title}
              </div>
              <div>
                <span className="text-gray-400">Kind:</span> {selectedRow.actual.kind}
              </div>
              <div>
                <span className="text-gray-400">affectedDomains:</span>{' '}
                <code className="text-xs">{JSON.stringify(selectedRow.actual.affectedDomains)}</code>
              </div>
              <div>
                <span className="text-gray-400">actionPlan:</span>
                <pre className="text-xs text-gray-300 bg-gray-950 border border-gray-800 rounded p-2 mt-1 overflow-auto">
                  {JSON.stringify(selectedRow.actual.actionPlan, null, 2)}
                </pre>
              </div>
              <div className="text-xs text-gray-300">
                <span className="text-gray-400">changedFields:</span> {selectedRow.actual.changedFields.join(', ') || '—'}
              </div>
              <div className="text-xs text-gray-300">
                <span className="text-gray-400">headerChangedFields:</span>{' '}
                {selectedRow.actual.headerChangedFields.join(', ') || '—'}
              </div>
              <div className="text-xs text-gray-300">
                <span className="text-gray-400">accountingChangedFields:</span>{' '}
                {selectedRow.actual.accountingChangedFields.join(', ') || '—'}
              </div>
              <div className="text-xs text-gray-300">
                <span className="text-gray-400">inventoryChangedFields:</span>{' '}
                {selectedRow.actual.inventoryChangedFields.join(', ') || '—'}
              </div>
              <div className="text-xs text-gray-300">
                <span className="text-gray-400">reasons:</span> {selectedRow.actual.reasons.join(', ') || '—'}
              </div>
              {!selectedRow.pass && (
                <div className="text-xs text-red-300">
                  <span className="text-gray-400">expect errors:</span> {selectedRow.errors.join('; ')}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <pre className="bg-gray-950 border border-gray-800 rounded p-2 overflow-auto max-h-56 text-[11px]">
                  {JSON.stringify(selectedRow.before, null, 2)}
                </pre>
                <pre className="bg-gray-950 border border-gray-800 rounded p-2 overflow-auto max-h-56 text-[11px]">
                  {JSON.stringify(selectedRow.updates, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card className="bg-gray-900 border-gray-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Button variant="outline" className="border-gray-700" onClick={exportAccountingEditTraceLog}>
            Export all traces JSON
          </Button>
          <Button
            variant="outline"
            className="border-gray-700"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(failingKeys || 'No failing scenarios');
              } catch {
                // noop
              }
            }}
          >
            Copy failing scenarios
          </Button>
          <Button
            variant="outline"
            className="border-gray-700"
            onClick={() => {
              clearAccountingEditTraceLog();
              window.location.reload();
            }}
          >
            Clear local trace log
          </Button>
        </div>
        <pre className="text-xs text-gray-300 bg-gray-950 border border-gray-800 rounded p-3 max-h-72 overflow-auto whitespace-pre-wrap">
          {JSON.stringify(traces, null, 2)}
        </pre>
      </Card>
    </div>
  );
};

export default AccountingEditTracePage;
