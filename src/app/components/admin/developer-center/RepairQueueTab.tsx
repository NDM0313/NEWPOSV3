import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { toast } from 'sonner';
import { useSupabase } from '@/app/context/SupabaseContext';
import { RepairActionPanel } from '@/app/components/admin/developer-center/RepairActionPanel';
import {
  RepairSystemStatusPanel,
  type DeveloperRepairSystemStatus,
} from '@/app/components/admin/developer-center/RepairSystemStatusPanel';
import { useRepairQueue } from '@/app/components/admin/developer-center/RepairQueueContext';
import {
  getDeveloperRepairAction,
  type RepairQueueItem,
} from '@/app/lib/developerRepairActions';
import {
  loadRepairQueueSnapshot,
  type RepairQueueSnapshot,
} from '@/app/services/accountingDeveloperCenterService';
import {
  DEFAULT_EXPENSE_REPAIR_SCAN_LIMIT,
  listExpensePaymentRepairCandidates,
  searchExpensePaymentRepairCandidates,
  type ExpensePaymentRepairCandidateRow,
  type ExpensePaymentRepairSearchFilters,
} from '@/app/services/expensePaymentSyncService';
import { expensePaymentCandidateToDryRunPreview } from '@/app/lib/repairQueueDryRun';
import {
  ActionableRepairCard,
  ActionableRepairStatusBadge,
} from '@/app/components/accounting/ar-ap-repair/ActionableRepairCard';
import { classifyExpensePaymentMismatch } from '@/app/lib/actionableRepairClassifier';

interface Props {
  companyId: string;
}

const EMPTY_SEARCH: ExpensePaymentRepairSearchFilters = {
  expenseNo: '',
  paymentRef: '',
  dateFrom: '',
  dateTo: '',
  branchId: '',
  minMismatchAmount: undefined,
};

export function RepairQueueTab({ companyId }: Props) {
  const { userRole } = useSupabase();
  const { items, sendToRepairQueue, removeFromQueue } = useRepairQueue();
  const [loading, setLoading] = useState(false);
  const [expenseSearching, setExpenseSearching] = useState(false);
  const [statusRefreshToken, setStatusRefreshToken] = useState(0);
  const [systemStatus, setSystemStatus] = useState<DeveloperRepairSystemStatus | null>(null);
  const [snapshot, setSnapshot] = useState<RepairQueueSnapshot | null>(null);
  const [expenseFilters, setExpenseFilters] = useState<ExpensePaymentRepairSearchFilters>({ ...EMPTY_SEARCH });
  const [expenseMismatches, setExpenseMismatches] = useState<ExpensePaymentRepairCandidateRow[]>([]);
  const [expenseScanNote, setExpenseScanNote] = useState<string>(
    'Click “Scan recent” for last paid expenses, or search by expense/payment no, date, branch, or mismatch amount.'
  );

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setStatusRefreshToken((t) => t + 1);
    try {
      setSnapshot(await loadRepairQueueSnapshot(companyId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Repair queue load failed');
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) void load();
  }, [companyId, load]);

  const runRecentExpenseScan = async () => {
    if (!companyId) return;
    setExpenseSearching(true);
    try {
      const rows = await listExpensePaymentRepairCandidates(companyId, DEFAULT_EXPENSE_REPAIR_SCAN_LIMIT);
      setExpenseMismatches(rows);
      setExpenseScanNote(
        `Recent scan: last ${DEFAULT_EXPENSE_REPAIR_SCAN_LIMIT} paid expenses · ${rows.length} mismatch(es). Use Search for older records.`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Expense scan failed');
    } finally {
      setExpenseSearching(false);
    }
  };

  const runExpenseSearch = async () => {
    if (!companyId) return;
    setExpenseSearching(true);
    try {
      const filters: ExpensePaymentRepairSearchFilters = {
        expenseNo: expenseFilters.expenseNo?.trim() || undefined,
        paymentRef: expenseFilters.paymentRef?.trim() || undefined,
        dateFrom: expenseFilters.dateFrom?.trim() || undefined,
        dateTo: expenseFilters.dateTo?.trim() || undefined,
        branchId: expenseFilters.branchId?.trim() || undefined,
        minMismatchAmount: expenseFilters.minMismatchAmount,
        limit: 200,
      };
      const rows = await searchExpensePaymentRepairCandidates(companyId, filters);
      setExpenseMismatches(rows);
      setExpenseScanNote(
        rows.length
          ? `Search found ${rows.length} mismatch(es). Dry-run before apply — GL unchanged unless separately approved.`
          : 'Search returned no mismatches for the given filters.'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Expense search failed');
    } finally {
      setExpenseSearching(false);
    }
  };

  const outOfSync = snapshot?.numberingRows.filter((r) => r.status === 'out_of_sync') ?? [];

  const queueExpensePaymentRepair = (row: ExpensePaymentRepairCandidateRow) => {
    sendToRepairQueue({
      actionId: 'expense.sync_linked_payment_amount',
      sourceTab: 'repair',
      params: { expenseId: row.expenseId, expenseNo: row.expenseNo },
      detectedReason: `Payment Rs ${(row.paymentAmount ?? 0).toLocaleString()} ≠ expense Rs ${row.expenseAmount.toLocaleString()}`,
      severity: row.canApplyRepair ? 'medium' : 'high',
      title: `Sync expense payment — ${row.expenseNo}`,
    });
    toast.success('Added to repair queue — run dry-run below');
  };

  const queueSequenceSync = (documentType: string, label: string) => {
    sendToRepairQueue({
      actionId: 'numbering.sync_sequence_to_effective_max',
      sourceTab: 'repair',
      params: { documentType },
      detectedReason: `${label} sequence out of sync`,
      severity: 'low',
      title: `Sync ${label} sequence`,
    });
    toast.success('Added to repair queue — run dry-run below');
  };

  return (
    <div className="space-y-4">
      <RepairSystemStatusPanel
        companyId={companyId}
        userRole={userRole}
        refreshToken={statusRefreshToken}
        onStatusLoaded={setSystemStatus}
      />

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh queue
        </Button>
        <span className="text-xs text-amber-400/90 flex items-center gap-1">
          <ShieldAlert className="w-3 h-3" />
          Phase F — dry-run required before every apply · audit logged
        </span>
      </div>

      {items.length > 0 && (
        <Card className="border-violet-900/40 bg-violet-950/10">
          <CardHeader>
            <CardTitle className="text-base">Repair queue ({items.length})</CardTitle>
            <CardDescription>Confirm-gated repairs from trace tabs and numbering analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item: RepairQueueItem) => (
              <RepairActionPanel
                key={item.queueId}
                companyId={companyId}
                item={item}
                systemStatus={systemStatus}
                onRemove={() => removeFromQueue(item.queueId)}
                onApplied={load}
              />
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="border-gray-800 bg-gray-900/40">
        <CardHeader>
          <CardTitle className="text-base">Expense payment mismatches</CardTitle>
          <CardDescription>
            Detect paid expense where expense.amount ≠ payments.amount. Repair allowed only when JE liquidity
            matches expense (updates payments.amount metadata — GL unchanged).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Expense no</Label>
              <Input
                value={expenseFilters.expenseNo || ''}
                onChange={(e) => setExpenseFilters((f) => ({ ...f, expenseNo: e.target.value }))}
                placeholder="EXP-0021"
                className="bg-gray-950 border-gray-700 h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Payment ref</Label>
              <Input
                value={expenseFilters.paymentRef || ''}
                onChange={(e) => setExpenseFilters((f) => ({ ...f, paymentRef: e.target.value }))}
                placeholder="PAY-…"
                className="bg-gray-950 border-gray-700 h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Branch ID</Label>
              <Input
                value={expenseFilters.branchId || ''}
                onChange={(e) => setExpenseFilters((f) => ({ ...f, branchId: e.target.value }))}
                placeholder="Optional branch UUID"
                className="bg-gray-950 border-gray-700 h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Date from</Label>
              <Input
                type="date"
                value={expenseFilters.dateFrom || ''}
                onChange={(e) => setExpenseFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                className="bg-gray-950 border-gray-700 h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Date to</Label>
              <Input
                type="date"
                value={expenseFilters.dateTo || ''}
                onChange={(e) => setExpenseFilters((f) => ({ ...f, dateTo: e.target.value }))}
                className="bg-gray-950 border-gray-700 h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Min mismatch (Rs)</Label>
              <Input
                type="number"
                min={0}
                value={expenseFilters.minMismatchAmount ?? ''}
                onChange={(e) =>
                  setExpenseFilters((f) => ({
                    ...f,
                    minMismatchAmount: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                placeholder="e.g. 100"
                className="bg-gray-950 border-gray-700 h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={expenseSearching} onClick={() => void runRecentExpenseScan()}>
              <RefreshCw className={`w-4 h-4 mr-1 ${expenseSearching ? 'animate-spin' : ''}`} />
              Scan recent ({DEFAULT_EXPENSE_REPAIR_SCAN_LIMIT})
            </Button>
            <Button type="button" size="sm" className="bg-blue-700 hover:bg-blue-600" disabled={expenseSearching} onClick={() => void runExpenseSearch()}>
              <Search className="w-4 h-4 mr-1" />
              Search
            </Button>
          </div>
          <p className="text-xs text-gray-500">{expenseScanNote}</p>
          <div className="overflow-x-auto">
            {expenseMismatches.length === 0 ? (
              <p className="text-sm text-gray-500">No results yet — run Scan recent or Search.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-800">
                    <th className="py-2 pr-2">Expense</th>
                    <th className="py-2 pr-2">Payment</th>
                    <th className="py-2 pr-2">Expense amt</th>
                    <th className="py-2 pr-2">Payment amt</th>
                    <th className="py-2 pr-2">JE liquidity</th>
                    <th className="py-2 pr-2">Issue</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2 pr-2">Risk</th>
                    <th className="py-2 pr-2">Can apply?</th>
                    <th className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseMismatches.map((row) => {
                    const preview = expensePaymentCandidateToDryRunPreview(row);
                    const repairCls = classifyExpensePaymentMismatch(row);
                    return (
                      <tr key={row.expenseId} className="border-b border-gray-800/60">
                        <td className="py-2 pr-2 text-gray-200 font-mono">{row.expenseNo}</td>
                        <td className="py-2 pr-2 text-gray-400">{row.paymentRef || '—'}</td>
                        <td className="py-2 pr-2">{row.expenseAmount.toLocaleString()}</td>
                        <td className="py-2 pr-2">{(row.paymentAmount ?? 0).toLocaleString()}</td>
                        <td className="py-2 pr-2">{row.jeLiquidityAmount.toLocaleString()}</td>
                        <td className="py-2 pr-2">{row.proposedAfterAmount.toLocaleString()}</td>
                        <td className="py-2 pr-2 text-gray-400 max-w-[120px] truncate" title={repairCls.issueType}>
                          {repairCls.issueType}
                        </td>
                        <td className="py-2 pr-2">
                          <ActionableRepairStatusBadge status={repairCls.status} />
                        </td>
                        <td className="py-2 pr-2">
                          <Badge variant="outline" className="text-[10px] border-gray-700">
                            {repairCls.riskLevel}
                          </Badge>
                        </td>
                        <td className="py-2 pr-2">
                          {row.canApplyRepair ? (
                            <Badge className="bg-emerald-900/40 text-emerald-300 border-emerald-800" title={preview.afterSummary}>
                              yes
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-900/40 text-amber-300 border-amber-800" title={row.blockReason}>
                              no
                            </Badge>
                          )}
                        </td>
                        <td className="py-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={!row.canApplyRepair}
                            title={row.canApplyRepair ? preview.afterSummary : row.blockReason}
                            onClick={() => queueExpensePaymentRepair(row)}
                          >
                            Sync Payment Amount
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      {snapshot && (
        <>
          <Card className="border-gray-800 bg-gray-900/40">
            <CardHeader>
              <CardTitle className="text-base">Integrity Lab issues ({snapshot.issues.length})</CardTitle>
              <CardDescription>Read-only previews — apply via Developer Integrity Lab unless queued below.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto max-h-64">
              {snapshot.issuePreviews.length === 0 ? (
                <p className="text-sm text-gray-500">No open issues.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-800">
                      <th className="py-2 pr-2">Rule</th>
                      <th className="py-2 pr-2">Before</th>
                      <th className="py-2">After (preview)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.issuePreviews.slice(0, 20).map((p, i) => (
                      <tr key={i} className="border-b border-gray-800/60">
                        <td className="py-2 pr-2 text-gray-300">{p.title}</td>
                        <td className="py-2 pr-2 text-gray-500 max-w-xs">{p.beforeSummary}</td>
                        <td className="py-2 text-gray-400 max-w-xs">{p.afterSummary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card className="border-gray-800 bg-gray-900/40">
            <CardHeader>
              <CardTitle className="text-base">Numbering dry-run ({outOfSync.length} out of sync)</CardTitle>
              <CardDescription>
                Click a row to send to repair queue. Action: {getDeveloperRepairAction('numbering.sync_sequence_to_effective_max')?.id}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-800">
                    <th className="py-2 pr-2">Type</th>
                    <th className="py-2 pr-2">Seq last</th>
                    <th className="py-2 pr-2">DB max</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.numberingRows.map((row) => (
                    <tr key={row.documentType} className="border-b border-gray-800/60">
                      <td className="py-2 pr-2 text-gray-200">{row.label}</td>
                      <td className="py-2 pr-2">{row.sequenceLast}</td>
                      <td className="py-2 pr-2">{row.databaseMax}</td>
                      <td className="py-2 pr-2">
                        {row.status === 'ok' ? (
                          <Badge className="bg-emerald-900/40 text-emerald-300 border-emerald-800">ok</Badge>
                        ) : (
                          <Badge className="bg-amber-900/40 text-amber-300 border-amber-800">out_of_sync</Badge>
                        )}
                      </td>
                      <td className="py-2">
                        {row.status === 'out_of_sync' ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => queueSequenceSync(row.documentType, row.label)}
                          >
                            Send to queue
                          </Button>
                        ) : (
                          <span className="text-gray-500">{row.previewAction}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      {items.length === 0 && (
        <p className="text-sm text-gray-500">
          Queue is empty. Send repairs from COA Health, trace tabs, expense search, or numbering table above.
        </p>
      )}
    </div>
  );
}
