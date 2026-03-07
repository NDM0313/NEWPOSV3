/**
 * Settings → Numbering Maintenance – Sequence Sync Tool
 * Analyze DB max vs sequence last_number; Fix out-of-sync.
 */

import React, { useState, useCallback } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { numberingMaintenanceService, type NumberingAnalysisRow } from '@/app/services/numberingMaintenanceService';
import { Button } from '@/app/components/ui/button';
import { Loader2, Search, Wrench, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function NumberingMaintenanceTable() {
  const { companyId } = useSupabase();
  const [rows, setRows] = useState<NumberingAnalysisRow[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [fixing, setFixing] = useState<string | 'all' | null>(null);

  const analyze = useCallback(async () => {
    if (!companyId) return;
    setAnalyzing(true);
    try {
      const data = await numberingMaintenanceService.analyze(companyId);
      setRows(data);
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
    } finally {
      setAnalyzing(false);
    }
  }, [companyId]);

  const fixOne = useCallback(
    async (documentType: string) => {
      if (!companyId) return;
      const row = rows.find((r) => r.document_type === documentType);
      if (!row || row.status !== 'out_of_sync') return;
      setFixing(documentType);
      try {
        await numberingMaintenanceService.fixSequence(companyId, documentType, row.database_max);
        toast.success(`${row.label} sequence set to ${row.database_max}. Next number will be ${row.database_max + 1}.`);
        await analyze();
      } catch (e) {
        console.error('[NumberingMaintenance] fix error:', e);
        toast.error('Failed to fix sequence');
      } finally {
        setFixing(null);
      }
    },
    [companyId, rows, analyze]
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
        await numberingMaintenanceService.fixSequence(companyId, row.document_type, row.database_max);
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

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-400">
        Compare sequence last_number with the maximum document number in the database. Fix out-of-sync sequences so the next generated number does not duplicate.
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
                <th className="px-4 py-3 text-left font-medium w-32">Document Type</th>
                <th className="px-4 py-3 text-right font-medium w-28">Current Last</th>
                <th className="px-4 py-3 text-right font-medium w-28">Database Max</th>
                <th className="px-4 py-3 text-left font-medium w-28">Status</th>
                <th className="px-4 py-3 text-left font-medium w-24">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {rows.length === 0 && !analyzing && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Click &quot;Analyze Numbers&quot; to scan the database.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.document_type} className="hover:bg-gray-800/30 bg-gray-950/30">
                  <td className="px-4 py-3 text-white font-medium">{r.label}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">{r.sequence_last}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">{r.database_max}</td>
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
    </div>
  );
}
