/**
 * Settings → Numbering Maintenance – Sequence Sync Tool
 * Analyze DB max vs sequence last_number; Fix out-of-sync.
 * Phase B: unified PAY counter; legacy SUPPLIER_PAYMENT / WORKER_PAYMENT read-only.
 */

import React, { useState, useCallback } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import {
  numberingMaintenanceService,
  type NumberingAnalysisRow,
  type NumberingLegacyRow,
} from '@/app/services/numberingMaintenanceService';
import { Button } from '@/app/components/ui/button';
import { Loader2, Search, Wrench, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';

export function NumberingMaintenanceTable() {
  const { companyId } = useSupabase();
  const [rows, setRows] = useState<NumberingAnalysisRow[]>([]);
  const [legacyRows, setLegacyRows] = useState<NumberingLegacyRow[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [fixing, setFixing] = useState<string | 'all' | null>(null);
  const [merging, setMerging] = useState(false);

  const analyze = useCallback(async () => {
    if (!companyId) return;
    setAnalyzing(true);
    try {
      const { rows: data, legacyRows: legacy } = await numberingMaintenanceService.analyze(companyId);
      setRows(data);
      setLegacyRows(legacy);
      const outOfSync = data.filter((r) => r.status === 'out_of_sync').length;
      if (outOfSync > 0) {
        toast.info(`${outOfSync} sequence(s) out of sync. Click Fix to repair.`);
      } else {
        toast.success('All sequences in sync.');
      }
    } catch (e) {
      console.error('[NumberingMaintenance] analyze error:', e);
      toast.error('Failed to analyze numbering');
      setRows([]);
      setLegacyRows([]);
    } finally {
      setAnalyzing(false);
    }
  }, [companyId]);

  const mergeLegacy = useCallback(async () => {
    if (!companyId) return;
    setMerging(true);
    try {
      const result = await numberingMaintenanceService.mergeLegacyPaySequences(companyId);
      if (!result.success) {
        toast.error(result.error || 'Failed to merge PAY counter');
        return;
      }
      if (result.updated) {
        toast.success(
          result.mergedLastNumber != null
            ? `PAY counter merged. Next PAY will be ${result.mergedLastNumber + 1}.`
            : 'PAY counter merged with legacy supplier sequence.',
        );
      } else {
        toast.info(result.message || 'PAY counter already aligned.');
      }
      await analyze();
    } catch (e) {
      console.error('[NumberingMaintenance] merge error:', e);
      toast.error('Failed to merge PAY counter');
    } finally {
      setMerging(false);
    }
  }, [companyId, analyze]);

  const fixOne = useCallback(
    async (documentType: string) => {
      if (!companyId) return;
      const row = rows.find((r) => r.document_type === documentType);
      if (!row || row.status !== 'out_of_sync') return;
      setFixing(documentType);
      try {
        await numberingMaintenanceService.fixSequence(companyId, documentType, row.effective_max);
        toast.success(`${row.label} synced to effective max ${row.effective_max}. Next number will be ${row.effective_max + 1}.`);
        await analyze();
      } catch (e) {
        console.error('[NumberingMaintenance] fix error:', e);
        toast.error('Failed to fix sequence');
      } finally {
        setFixing(null);
      }
    },
    [companyId, rows, analyze],
  );

  const fixAll = useCallback(async () => {
    if (!companyId) return;
    const toFix = rows.filter((r) => r.status === 'out_of_sync');
    if (toFix.length === 0) {
      toast.success('No sequences to fix.');
      return;
    }
    setFixing('all');
    try {
      for (const row of toFix) {
        await numberingMaintenanceService.fixSequence(companyId, row.document_type, row.effective_max);
      }
      toast.success(`Fixed ${toFix.length} sequence(s).`);
      await analyze();
    } catch (e) {
      console.error('[NumberingMaintenance] fix all error:', e);
      toast.error('Failed to fix some sequences');
    } finally {
      setFixing(null);
    }
  }, [companyId, rows, analyze]);

  const payRow = rows.find((r) => r.document_type === 'PAYMENT');

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-cyan-500/25 bg-cyan-950/20 px-4 py-3 flex gap-3">
        <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div className="text-sm text-gray-300 space-y-1">
          <p>
            <strong className="text-white">Phase B — unified PAY:</strong> Purchase, supplier, worker, and courier
            outgoing payments share one <span className="font-mono text-cyan-300">PAY-</span> counter. Customer receipts
            stay <span className="font-mono text-cyan-300">RCV-</span>; expense cash stays <span className="font-mono text-cyan-300">EXP-</span>.
          </p>
          <p className="text-gray-500 text-xs">
            Purane WPY vouchers historical hain — naye worker payments ab PAY use karte hain. Legacy counters neeche
            sirf read-only dikhte hain.
          </p>
        </div>
      </div>

      <p className="text-sm text-gray-400">
        Effective max uses all prefix variants (RCV-0008 and HQ-RCV-0008 share one numeric sequence). Counter rows
        include sentinel + branch rows. Fix advances all rows to the effective max — never decreases.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={analyze}
          disabled={analyzing || !companyId}
          variant="outline"
          className="border-gray-600 text-gray-300 hover:bg-gray-800 gap-2"
        >
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Analyze Numbers
        </Button>
        <Button
          onClick={mergeLegacy}
          disabled={merging || !companyId || analyzing}
          variant="outline"
          className="border-cyan-600/50 text-cyan-300 hover:bg-cyan-900/30 gap-2"
        >
          {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
          Sync PAY counter (merge legacy)
        </Button>
        <Button
          onClick={fixAll}
          disabled={rows.filter((r) => r.status === 'out_of_sync').length === 0 || fixing !== null}
          className="bg-amber-600 hover:bg-amber-500 text-white gap-2"
        >
          {fixing === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
          Fix All Sequences
        </Button>
      </div>
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/80 text-gray-400 border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 text-left font-medium min-w-[200px]">Document Type</th>
                <th className="px-4 py-3 text-right font-medium w-28">Counter Max</th>
                <th className="px-4 py-3 text-right font-medium w-28">Voucher Max</th>
                <th className="px-4 py-3 text-right font-medium w-28">Effective Max</th>
                <th className="px-4 py-3 text-left font-medium w-28">Status</th>
                <th className="px-4 py-3 text-left font-medium w-24">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {rows.length === 0 && !analyzing && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Click &quot;Analyze Numbers&quot; to scan the database.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.document_type} className="hover:bg-gray-800/30 bg-gray-950/30">
                  <td className="px-4 py-3 text-white font-medium">
                    <div>{r.label}</div>
                    {r.document_type === 'PAYMENT' && (
                      <p className="text-xs text-gray-500 font-normal mt-1 font-sans">
                        Database max uses PAY-* vouchers only; old WPY-* vouchers are historical.
                        {r.legacy_wpy_max != null && r.legacy_wpy_max > 0
                          ? ` (max WPY in DB: ${r.legacy_wpy_max})`
                          : null}
                      </p>
                    )}
                    {r.sequence_payment_only != null && r.sequence_payment_only < r.sequence_last && (
                      <p className="text-xs text-amber-500/90 font-normal mt-0.5 font-sans">
                        PAYMENT row was {r.sequence_payment_only}; effective last includes legacy supplier counter (
                        {r.sequence_last}).
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">
                    {r.sequence_last}
                    {r.sequence_min_row != null && r.sequence_min_row < r.sequence_last && (
                      <span className="block text-xs text-amber-500/80">min row {r.sequence_min_row}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">{r.database_max}</td>
                  <td className="px-4 py-3 text-right font-mono text-cyan-300">{r.effective_max}</td>
                  <td className="px-4 py-3">
                    {r.status === 'ok' ? (
                      <span className="inline-flex items-center gap-1 text-green-400">
                        <CheckCircle className="w-4 h-4" /> OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-400">
                        <AlertTriangle className="w-4 h-4" /> Out of sync
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === 'out_of_sync' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-amber-600 text-amber-400 hover:bg-amber-900/30"
                        onClick={() => fixOne(r.document_type)}
                        disabled={fixing !== null}
                      >
                        {fixing === r.document_type ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Fix'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {legacyRows.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-400">Deprecated legacy counters (read-only)</h4>
          <div className="rounded-xl border border-gray-800/80 overflow-hidden opacity-90">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-900/60 text-gray-500 border-b border-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Counter</th>
                    <th className="px-4 py-2 text-right font-medium w-28">Last number</th>
                    <th className="px-4 py-2 text-left font-medium w-28">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/80">
                  {legacyRows.map((lr) => (
                    <tr key={lr.document_type} className="bg-gray-950/20">
                      <td className="px-4 py-2 text-gray-400">{lr.label}</td>
                      <td className="px-4 py-2 text-right font-mono text-gray-500">{lr.sequence_last}</td>
                      <td className="px-4 py-2">
                        <span className="text-xs uppercase tracking-wide text-gray-500 border border-gray-700 rounded px-2 py-0.5">
                          Deprecated
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {payRow && legacyRows.some((l) => l.document_type === 'SUPPLIER_PAYMENT') && (
            <p className="text-xs text-gray-500">
              Use &quot;Sync PAY counter (merge legacy)&quot; to fold the supplier legacy counter into PAY without changing
              old voucher numbers.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
