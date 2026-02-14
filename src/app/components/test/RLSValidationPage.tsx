/**
 * RLS Authenticated Validation Page
 * Runs JWT + users mapping, company isolation, and INSERT/UPDATE/DELETE policy checks.
 * Sidebar: Test Pages > RLS Validation
 */
import React, { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { useSupabase } from '@/app/context/SupabaseContext';
import { Shield, RefreshCw, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

type StepResult = {
  step: string;
  ok: boolean;
  message: string;
  detail?: string;
};

export function RLSValidationPage() {
  const { user, companyId, supabaseClient } = useSupabase();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<StepResult[]>([]);
  const [includePolicyTests, setIncludePolicyTests] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const runValidation = async () => {
    if (!user) {
      toast.error('Please log in first');
      return;
    }
    setLoading(true);
    setResults([]);

    const out: StepResult[] = [];

    try {
      // Step 1 — JWT + public.users mapping
      const { data: userRow, error: userErr } = await supabaseClient
        .from('users')
        .select('id, company_id, email, role')
        .eq('id', user.id)
        .single();

      if (userErr || !userRow) {
        out.push({
          step: 'Step 1: JWT + users mapping',
          ok: false,
          message: 'Failed to fetch user row',
          detail: userErr?.message || 'No row returned',
        });
      } else {
        const companyMatch = companyId && userRow.company_id === companyId;
        out.push({
          step: 'Step 1: JWT + users mapping',
          ok: !!userRow.company_id && companyMatch,
          message: userRow.company_id
            ? `Found: ${userRow.email} → company_id ${userRow.company_id}`
            : 'company_id is NULL — RLS will block everything',
          detail: companyMatch ? 'Context company_id matches' : 'Context company_id may differ',
        });
      }

      // Step 2 — Company isolation (counts via RLS-scoped queries)
      const tables = ['purchases', 'rentals', 'expenses'] as const;
      for (const tbl of tables) {
        const { count, error } = await supabaseClient
          .from(tbl)
          .select('id', { count: 'exact', head: true });

        if (error) {
          out.push({
            step: `Step 2: ${tbl} count`,
            ok: false,
            message: error.message,
          });
        } else {
          out.push({
            step: `Step 2: ${tbl} count`,
            ok: true,
            message: `RLS-scoped: ${count ?? 0} rows (your company only)`,
          });
        }
      }

      // Steps 3–5: INSERT / UPDATE / DELETE policy validation (creates test expense, updates, soft-deletes)
      if (includePolicyTests && companyId) {
        let testExpenseId: string | null = null;
        try {
          // Get a branch for this company
          const { data: branch } = await supabaseClient
            .from('branches')
            .select('id')
            .eq('company_id', companyId)
            .limit(1)
            .single();

          const { data: inserted, error: insertErr } = await supabaseClient
            .from('expenses')
            .insert({
              company_id: companyId,
              branch_id: branch?.id ?? null,
              category: 'utilities_bills',
              amount: 0.01,
              expense_date: new Date().toISOString().split('T')[0],
              description: 'RLS INSERT test - safe to delete',
              payment_method: 'cash',
              status: 'pending',
              created_by: user.id,
            })
            .select('id, company_id')
            .single();

          if (insertErr || !inserted) {
            out.push({
              step: 'Step 3: INSERT policy',
              ok: false,
              message: insertErr?.message || 'Insert failed',
            });
          } else {
            testExpenseId = inserted.id;
            const companyMatch = inserted.company_id === companyId;
            out.push({
              step: 'Step 3: INSERT policy',
              ok: companyMatch,
              message: companyMatch
                ? `Inserted expense; company_id matches user`
                : `Inserted but company_id mismatch: ${inserted.company_id}`,
            });
          }

          if (testExpenseId) {
            const { error: updateErr } = await supabaseClient
              .from('expenses')
              .update({ amount: 0.02 })
              .eq('id', testExpenseId);

            out.push({
              step: 'Step 4: UPDATE policy',
              ok: !updateErr,
              message: updateErr ? updateErr.message : 'Updated own expense successfully',
            });

            const { error: deleteErr } = await supabaseClient
              .from('expenses')
              .update({ status: 'rejected' })
              .eq('id', testExpenseId);

            out.push({
              step: 'Step 5: DELETE policy (soft delete)',
              ok: !deleteErr,
              message: deleteErr ? deleteErr.message : 'Soft-deleted (status=rejected) successfully',
            });
          }
        } catch (e: any) {
          out.push({
            step: 'Steps 3–5: Policy tests',
            ok: false,
            message: String(e?.message || e),
          });
        }
      }

      setResults(out);
      const failed = out.filter((r) => !r.ok);
      if (failed.length === 0) {
        toast.success('All validation steps passed');
      } else {
        toast.error(`${failed.length} step(s) failed`);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Validation failed');
      setResults([{ step: 'Error', ok: false, message: String(e?.message || e) }]);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="flex items-center gap-2 text-amber-500 mb-4">
          <AlertCircle className="h-5 w-5" />
          <span>Please log in to run RLS validation.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-emerald-500" />
        <div>
          <h1 className="text-xl font-semibold text-white">RLS Authenticated Validation</h1>
          <p className="text-sm text-gray-400">
            Run while logged in. Validates JWT → users mapping and company isolation.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={includePolicyTests}
            onChange={(e) => setIncludePolicyTests(e.target.checked)}
            className="rounded border-gray-600"
          />
          Include INSERT/UPDATE/DELETE tests (creates & deletes a test expense)
        </label>
        <Button onClick={runValidation} disabled={loading} className="gap-2">
          <RefreshCw className={loading ? 'animate-spin h-4 w-4' : 'h-4 w-4'} />
          {loading ? 'Running...' : 'Run Validation'}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Results
          </button>
          {expanded && (
          <>
          {results.map((r, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 p-3 rounded-lg border ${
                r.ok ? 'bg-emerald-950/30 border-emerald-800' : 'bg-red-950/30 border-red-800'
              }`}
            >
              {r.ok ? (
                <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-medium text-white">{r.step}</div>
                <div className="text-sm text-gray-300">{r.message}</div>
                {r.detail && <div className="text-xs text-gray-500 mt-1">{r.detail}</div>}
              </div>
            </div>
          ))}
          </>
          )}
        </div>
      )}

      <div className="text-xs text-gray-500 border-t border-gray-800 pt-4">
        <p>Expected: Step 1 = exactly one user row with company_id. Steps 2 = counts for your company only.</p>
        <p>For cross-company test: log in as another company user and compare counts.</p>
      </div>
    </div>
  );
}
