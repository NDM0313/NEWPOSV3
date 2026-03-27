'use client';

import React, { useMemo, useState } from 'react';
import { Card } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { useExpenses } from '@/app/context/ExpenseContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import {
  buildExpenseCanonicalComparisonRows,
  buildExpenseEditDiff,
  classifyPaidExpenseEdit,
  explainExpenseEditOutcome,
  type EditAccountingKind,
  type PaidExpenseSnapshot,
} from '@/app/lib/accountingEditClassification';
import { getExpenseEditTraceLog, clearExpenseEditTraceLog } from '@/app/lib/expenseEditTrace';

type CaseDef = {
  key: string;
  title: string;
  expected: EditAccountingKind;
  patch: (base: PaidExpenseSnapshot) => Record<string, unknown>;
};

const CASES: CaseDef[] = [
  {
    key: 'notes',
    title: 'Notes only',
    expected: 'NO_POSTING_CHANGE',
    patch: () => ({ notes: `trace-notes-${Date.now()}` }),
  },
  {
    key: 'date_same_month',
    title: 'Same-month date only',
    expected: 'HEADER_ONLY_CHANGE',
    patch: (b) => {
      const d = new Date(b.date);
      d.setDate(Math.min(28, Math.max(1, d.getDate() === 1 ? 2 : d.getDate() - 1)));
      return { date: d.toISOString().slice(0, 10) };
    },
  },
  {
    key: 'date_same_month_slug',
    title: 'Same-month date + redundant utilities slug',
    expected: 'HEADER_ONLY_CHANGE',
    patch: (b) => {
      const d = new Date(b.date);
      d.setDate(Math.min(28, Math.max(1, d.getDate() === 1 ? 2 : d.getDate() - 1)));
      return { date: d.toISOString().slice(0, 10), category: 'utilities' };
    },
  },
  {
    key: 'date_cross_month',
    title: 'Cross-month date only',
    expected: 'HEADER_ONLY_CHANGE',
    patch: (b) => {
      const d = new Date(b.date);
      d.setMonth(d.getMonth() - 1);
      return { date: d.toISOString().slice(0, 10) };
    },
  },
  {
    key: 'account_only',
    title: 'Payment account only',
    expected: 'DELTA_ADJUSTMENT',
    patch: (b) => ({ paymentAccountId: `${b.paymentAccountId || 'acc'}-changed` }),
  },
  {
    key: 'amount_only',
    title: 'Amount only',
    expected: 'DELTA_ADJUSTMENT',
    patch: (b) => ({ amount: Number(b.amount) + 1 }),
  },
  {
    key: 'category_real_change',
    title: 'Category Utilities → marketing',
    expected: 'DELTA_ADJUSTMENT',
    patch: () => ({ category: 'marketing' }),
  },
  {
    key: 'date_notes',
    title: 'Date + notes only',
    expected: 'HEADER_ONLY_CHANGE',
    patch: (b) => {
      const d = new Date(b.date);
      d.setDate(Math.min(28, Math.max(1, d.getDate() === 1 ? 2 : d.getDate() - 1)));
      return { date: d.toISOString().slice(0, 10), notes: `trace-note-${Date.now()}` };
    },
  },
];

function expenseToSnapshot(e: {
  status: string;
  amount: number;
  paymentMethod: string;
  date: string;
  location: string;
  paymentAccountId?: string;
  category: string;
  description: string;
  notes?: string | null;
  payeeName?: string | null;
}): PaidExpenseSnapshot {
  return {
    status: e.status,
    amount: Number(e.amount) || 0,
    paymentMethod: e.paymentMethod || '',
    date: e.date || '',
    location: e.location || '',
    paymentAccountId: e.paymentAccountId,
    category: String(e.category || ''),
    description: e.description || '',
    notes: e.notes ?? null,
    payeeName: e.payeeName ?? null,
  };
}

export const ExpenseEditTraceTestPage: React.FC = () => {
  const { expenses } = useExpenses();
  const { companyId } = useSupabase();
  const [searchId, setSearchId] = useState('');
  const [updatesJson, setUpdatesJson] = useState(
    '{\n  "date": "2026-03-15",\n  "category": "utilities"\n}'
  );

  const paid = useMemo(() => expenses.find((e) => String(e.status).toLowerCase() === 'paid'), [expenses]);
  const base: PaidExpenseSnapshot | null = useMemo(() => {
    if (!paid) return null;
    return expenseToSnapshot({
      status: paid.status,
      amount: Number(paid.amount) || 0,
      paymentMethod: paid.paymentMethod || '',
      date: paid.date || '',
      location: paid.location || '',
      paymentAccountId: paid.paymentAccountId,
      category: String(paid.category || ''),
      description: paid.description || '',
      notes: paid.notes ?? null,
      payeeName: paid.payeeName ?? null,
    });
  }, [paid]);

  const selectedBySearch = useMemo(() => {
    const q = searchId.trim().toLowerCase();
    if (!q) return null;
    return expenses.find((e) => e.id.toLowerCase() === q || (e.expenseNo || '').toLowerCase() === q) || null;
  }, [searchId, expenses]);

  const inspectorSnap: PaidExpenseSnapshot | null = useMemo(() => {
    if (selectedBySearch) {
      return expenseToSnapshot({
        status: selectedBySearch.status,
        amount: Number(selectedBySearch.amount) || 0,
        paymentMethod: selectedBySearch.paymentMethod || '',
        date: selectedBySearch.date || '',
        location: selectedBySearch.location || '',
        paymentAccountId: selectedBySearch.paymentAccountId,
        category: String(selectedBySearch.category || ''),
        description: selectedBySearch.description || '',
        notes: selectedBySearch.notes ?? null,
        payeeName: selectedBySearch.payeeName ?? null,
      });
    }
    return base;
  }, [selectedBySearch, base]);

  const parsedUpdates = useMemo(() => {
    try {
      const u = JSON.parse(updatesJson) as Record<string, unknown>;
      return { ok: true as const, u };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [updatesJson]);

  const liveInspect = useMemo(() => {
    if (!inspectorSnap || !companyId || !parsedUpdates.ok) return null;
    const updates = parsedUpdates.u as any;
    const diff = buildExpenseEditDiff(inspectorSnap, updates);
    const classification = classifyPaidExpenseEdit(inspectorSnap, updates, companyId);
    const canon = buildExpenseCanonicalComparisonRows(inspectorSnap, updates);
    const explain = explainExpenseEditOutcome(inspectorSnap, updates, classification);
    const wouldReversal =
      classification.kind === 'DELTA_ADJUSTMENT' || classification.kind === 'FULL_REVERSE_REPOST';
    return { diff, classification, canon, explain, wouldReversal };
  }, [inspectorSnap, companyId, parsedUpdates]);

  const rows = useMemo(() => {
    if (!base || !companyId) return [];
    return CASES.map((c) => {
      const updates = c.patch(base);
      const actual = classifyPaidExpenseEdit(base, updates as any, companyId);
      const reverseFired = actual.kind === 'FULL_REVERSE_REPOST';
      const repostFired = actual.kind === 'FULL_REVERSE_REPOST';
      const deltaFired = actual.kind === 'DELTA_ADJUSTMENT';
      const pass = actual.kind === c.expected;
      return { c, actual, reverseFired, repostFired, deltaFired, pass };
    });
  }, [base, companyId]);

  const traceRows = getExpenseEditTraceLog().slice(-20).reverse();
  const exportTrace = () => {
    const all = getExpenseEditTraceLog();
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense-edit-trace-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full w-full bg-[#0B0F19] text-white p-6 space-y-6 overflow-auto">
      <Card className="bg-gray-900 border-gray-800 p-5">
        <h2 className="text-lg font-semibold">Expense Edit Trace + Real Transaction Inspector</h2>
        <p className="text-sm text-gray-400 mt-2">
          Route: <code>/test/expense-edit-trace</code>. Classifier uses canonical category / nullable text
          comparison — slug vs label must not trigger DELTA alone.
        </p>
        <div className="mt-2 text-sm text-gray-300">
          Paid expense for matrix:{' '}
          {paid ? `${paid.expenseNo || paid.id} · category display: "${paid.category}"` : 'None loaded'}
        </div>
      </Card>

      <Card className="bg-gray-900 border-gray-800 p-5 space-y-4">
        <h3 className="font-medium">Real transaction inspector</h3>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-gray-500 block mb-1">Expense id or EXP-… (optional — defaults to first paid)</label>
            <input
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="UUID or EXP-0001"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-gray-600"
            onClick={() => paid && setSearchId(paid.id)}
          >
            Use first paid
          </Button>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Updates JSON (simulated save payload)</label>
          <textarea
            value={updatesJson}
            onChange={(e) => setUpdatesJson(e.target.value)}
            rows={6}
            className="w-full font-mono text-xs bg-gray-950 border border-gray-700 rounded-lg p-3 text-gray-200"
          />
        </div>
        {!parsedUpdates.ok && <p className="text-sm text-red-400">JSON error: {parsedUpdates.error}</p>}
        {liveInspect && inspectorSnap && (
          <div className="space-y-3 text-sm border border-gray-800 rounded-lg p-4 bg-gray-950/50">
            <div>
              <span className="text-gray-500">Before snapshot</span>
              <pre className="text-xs mt-1 overflow-auto max-h-40">{JSON.stringify(inspectorSnap, null, 2)}</pre>
            </div>
            <div>
              <span className="text-gray-500">Raw diff fields</span>
              <div className="text-xs text-gray-300 mt-1">
                changed: {liveInspect.diff.changedFields.join(', ') || '—'} · posting:{' '}
                {liveInspect.diff.postingChangedFields.join(', ') || '—'}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Canonical comparison</span>
              <pre className="text-xs mt-1 overflow-auto max-h-36">{JSON.stringify(liveInspect.canon, null, 2)}</pre>
            </div>
            <div>
              <span className="text-gray-500">Classifier</span>
              <pre className="text-xs mt-1 overflow-auto max-h-48">{JSON.stringify(liveInspect.classification, null, 2)}</pre>
            </div>
            <div>
              <span className="text-gray-500">Side effect map (predicted from kind — not executing save)</span>
              <ul className="text-xs text-gray-300 mt-1 list-disc pl-5 space-y-1">
                <li>Header / DB row update: {liveInspect.classification.kind !== 'BLOCKED_CLOSED_PERIOD' ? 'likely YES' : 'NO'}</li>
                <li>Accounting reversal + repost: {liveInspect.wouldReversal ? 'YES (DELTA path)' : 'NO'}</li>
                <li>Inventory: NO (expenses)</li>
                <li>Payments linkage: NO</li>
              </ul>
            </div>
            <div>
              <span className="text-gray-500">Explanation</span>
              <ul className="text-xs text-amber-200/90 mt-1 list-disc pl-5">
                {liveInspect.explain.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {!inspectorSnap && <p className="text-sm text-gray-500">Load expenses and select a paid row to inspect.</p>}
      </Card>

      <Card className="bg-gray-900 border-gray-800 p-5">
        <h3 className="font-medium mb-3">Synthetic scenario matrix (first paid expense)</h3>
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.c.key} className="grid grid-cols-12 gap-2 text-sm border-b border-gray-800 pb-2">
              <div className="col-span-3 text-gray-200">{r.c.title}</div>
              <div className="col-span-2 text-gray-400">Expected: {r.c.expected}</div>
              <div className="col-span-2 text-gray-400">Actual: {r.actual.kind}</div>
              <div className="col-span-1 text-gray-400">Δ: {r.deltaFired ? 'y' : 'n'}</div>
              <div className="col-span-1 text-gray-400">Rev: {r.reverseFired ? 'y' : 'n'}</div>
              <div className="col-span-1 text-gray-400">Re: {r.repostFired ? 'y' : 'n'}</div>
              <div className="col-span-2">
                <Badge className={r.pass ? 'bg-emerald-700' : 'bg-red-700'}>{r.pass ? 'PASS' : 'FAIL'}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="bg-gray-900 border-gray-800 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Recent Trace Log (local)</h3>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="border-gray-700 text-gray-200" onClick={exportTrace}>
              Export JSON
            </Button>
            <Button
              variant="outline"
              className="border-gray-700 text-gray-200"
              onClick={() => {
                clearExpenseEditTraceLog();
                window.location.reload();
              }}
            >
              Clear
            </Button>
          </div>
        </div>
        <pre className="text-xs text-gray-300 mt-3 max-h-72 overflow-auto whitespace-pre-wrap">
          {JSON.stringify(traceRows, null, 2)}
        </pre>
      </Card>
    </div>
  );
};

export default ExpenseEditTraceTestPage;
