import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Copy, AlertTriangle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { toast } from 'sonner';
import { RepairActionPanel } from '@/app/components/admin/developer-center/RepairActionPanel';
import { useRepairQueue } from '@/app/components/admin/developer-center/RepairQueueContext';
import type { RepairQueueItem } from '@/app/lib/developerRepairActions';
import {
  loadCoaHealthSnapshot,
  loadAccountUsage,
  type CoaHealthSnapshot,
  type AccountUsageDetail,
} from '@/app/services/accountingDeveloperCenterService';
import type { CoaHealthIssue } from '@/app/lib/coaHealthChecks';

interface Props {
  companyId: string;
}

function severityBadge(sev: CoaHealthIssue['severity']) {
  if (sev === 'error') return <Badge className="bg-red-900/40 text-red-300 border-red-800">error</Badge>;
  if (sev === 'warning') return <Badge className="bg-amber-900/40 text-amber-300 border-amber-800">warning</Badge>;
  return <Badge className="bg-slate-800 text-slate-300 border-slate-700">info</Badge>;
}

export function CoaHealthTab({ companyId }: Props) {
  const { sendToRepairQueue } = useRepairQueue();
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<CoaHealthSnapshot | null>(null);
  const [issuesOnly, setIssuesOnly] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [usage, setUsage] = useState<AccountUsageDetail | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [coaRepairItem, setCoaRepairItem] = useState<RepairQueueItem | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await loadCoaHealthSnapshot(companyId);
      setSnapshot(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load COA health');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleIssues = useMemo(() => {
    if (!snapshot) return [];
    if (!issuesOnly) return snapshot.issues;
    return snapshot.issues.filter((i) => i.severity !== 'info' || i.checkId === 'BALANCE_CACHE_VARIANCE');
  }, [snapshot, issuesOnly]);

  const openAccount = async (accountId?: string) => {
    if (!accountId || !companyId) return;
    setSelectedAccountId(accountId);
    setUsageLoading(true);
    try {
      const detail = await loadAccountUsage(companyId, accountId);
      setUsage(detail);
      setNewName(detail?.name || '');
      setNewDescription(detail?.description || '');
      setCoaRepairItem(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load account usage');
      setUsage(null);
    } finally {
      setUsageLoading(false);
    }
  };

  const copyJson = () => {
    if (!snapshot) return;
    void navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
    toast.success('COA health JSON copied');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={copyJson} disabled={!snapshot}>
          <Copy className="w-4 h-4 mr-1" />
          Copy JSON
        </Button>
        <label className="flex items-center gap-2 text-sm text-gray-400 ml-2">
          <input
            type="checkbox"
            checked={issuesOnly}
            onChange={(e) => setIssuesOnly(e.target.checked)}
            className="rounded border-gray-600"
          />
          Hide low-priority info
        </label>
        <span className="text-xs text-violet-400/90 ml-auto">Phase F — safe display-field repairs when eligible</span>
      </div>

      {snapshot && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Accounts', value: snapshot.scannedAccounts },
            { label: 'Errors', value: snapshot.summary.errors },
            { label: 'Warnings', value: snapshot.summary.warnings },
            { label: 'Inactive used', value: snapshot.summary.inactiveUsed },
            { label: 'Balance drift', value: snapshot.summary.balanceVariances },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border border-gray-800 bg-gray-900/60 p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-500">{c.label}</div>
              <div className="text-xl font-semibold text-white mt-1">{c.value}</div>
            </div>
          ))}
        </div>
      )}

      <Card className="border-gray-800 bg-gray-900/40">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            COA health issues
          </CardTitle>
          <CardDescription>Hierarchy, duplicates, inactive-used, balance cache variance. No repairs in Phase B.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-800">
                <th className="py-2 pr-2">Severity</th>
                <th className="py-2 pr-2">Check</th>
                <th className="py-2 pr-2">Code</th>
                <th className="py-2 pr-2">Name</th>
                <th className="py-2 pr-2">Detail</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleIssues.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-500">
                    {loading ? 'Loading…' : 'No issues in current filter.'}
                  </td>
                </tr>
              )}
              {visibleIssues.map((row, idx) => (
                <tr key={`${row.checkId}-${row.accountId || idx}`} className="border-b border-gray-800/60">
                  <td className="py-2 pr-2">{severityBadge(row.severity)}</td>
                  <td className="py-2 pr-2 font-mono text-gray-300">{row.checkId}</td>
                  <td className="py-2 pr-2 text-gray-200">{row.accountCode || '—'}</td>
                  <td className="py-2 pr-2 text-gray-300">{row.accountName || '—'}</td>
                  <td className="py-2 pr-2 text-gray-400 max-w-md">{row.detail}</td>
                  <td className="py-2">
                    {row.accountId ? (
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openAccount(row.accountId)}>
                        Usage
                      </Button>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {selectedAccountId && (
        <Card className="border-gray-800 bg-gray-900/40">
          <CardHeader>
            <CardTitle className="text-base">Account usage</CardTitle>
            <CardDescription>Journal-derived usage and controlled COA display edits</CardDescription>
          </CardHeader>
          <CardContent>
            {usageLoading && <p className="text-sm text-gray-500">Loading usage…</p>}
            {!usageLoading && usage && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">
                      <span className="text-white font-medium">{usage.code}</span> — {usage.name}
                    </p>
                    <p className="text-gray-500 mt-2 font-mono text-xs">ID: {usage.accountId}</p>
                    <p className="text-gray-500">Type: {usage.type} · Parent: {usage.parentId || '—'}</p>
                    <p className="text-gray-500">
                      Control: {usage.isControl ? 'yes' : 'no'} · Group header: {usage.isGroup ? 'yes' : 'no'}
                    </p>
                    <p className="text-gray-500 mt-2">Lines: {usage.lineCount}</p>
                    <p className="text-gray-500">Debit: {usage.totalDebit} · Credit: {usage.totalCredit}</p>
                    <p className="text-gray-500">
                      First: {usage.firstUsed || '—'} · Last: {usage.lastUsed || '—'}
                    </p>
                    <p className="text-gray-500">Modules: {usage.modules.join(', ') || '—'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Journal balance: {usage.journalBalance}</p>
                    <p className="text-gray-500">Stored balance: {usage.storedBalance}</p>
                    <p className="text-gray-500">Variance: {usage.balanceVariance}</p>
                    <p className="text-gray-400 mt-2">{usage.editSafety.reason}</p>
                    <p className="text-xs mt-1">
                      Safe to edit:{' '}
                      {usage.safeToEdit ? (
                        <Badge className="bg-emerald-900/40 text-emerald-300 border-emerald-800">yes</Badge>
                      ) : (
                        <Badge className="bg-red-900/40 text-red-300 border-red-800">no</Badge>
                      )}
                    </p>
                  </div>
                </div>

                {usage.editSafety.canEditName && (
                  <div className="flex flex-wrap gap-2 items-end border-t border-gray-800 pt-3">
                    <div className="flex-1 min-w-[200px]">
                      <label className="text-[10px] uppercase tracking-wider text-gray-500">New name</label>
                      <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="mt-1 bg-gray-950 border-gray-800 text-sm"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const item: Omit<RepairQueueItem, 'queueId'> = {
                          actionId: 'coa.rename_account',
                          sourceTab: 'coa',
                          params: {
                            accountId: usage.accountId,
                            accountCode: usage.code,
                            newName,
                          },
                          detectedReason: 'Safe display rename',
                          severity: 'low',
                          title: `Rename ${usage.code}`,
                        };
                        setCoaRepairItem({ ...item, queueId: 'inline-coa' });
                        sendToRepairQueue(item);
                        toast.success('Rename queued — run dry-run in Repair Queue or below');
                      }}
                    >
                      Queue rename
                    </Button>
                  </div>
                )}

                {!usage.editSafety.cannotTouch && (
                  <div className="flex flex-wrap gap-2 items-end border-t border-gray-800 pt-3">
                    <div className="flex-1 min-w-[200px]">
                      <label className="text-[10px] uppercase tracking-wider text-gray-500">Description</label>
                      <Input
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        className="mt-1 bg-gray-950 border-gray-800 text-sm"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const item: Omit<RepairQueueItem, 'queueId'> = {
                          actionId: 'coa.update_description',
                          sourceTab: 'coa',
                          params: {
                            accountId: usage.accountId,
                            accountCode: usage.code,
                            newDescription,
                          },
                          detectedReason: 'Safe description update',
                          severity: 'low',
                          title: `Update description ${usage.code}`,
                        };
                        setCoaRepairItem({ ...item, queueId: 'inline-coa-desc' });
                        sendToRepairQueue(item);
                      }}
                    >
                      Queue description update
                    </Button>
                  </div>
                )}

                {(usage.editSafety.canArchive || (usage.lineCount === 0 && !usage.editSafety.cannotTouch)) && (
                  <div className="border-t border-gray-800 pt-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const targetActive = !usage.editSafety.canArchive;
                        const item: Omit<RepairQueueItem, 'queueId'> = {
                          actionId: 'coa.toggle_active_if_safe',
                          sourceTab: 'coa',
                          params: {
                            accountId: usage.accountId,
                            accountCode: usage.code,
                            isActive: targetActive,
                          },
                          detectedReason: targetActive ? 'Activate account' : 'Deactivate when safe',
                          severity: 'low',
                          title: `Toggle active ${usage.code}`,
                        };
                        setCoaRepairItem({ ...item, queueId: 'inline-coa-active' });
                        sendToRepairQueue(item);
                      }}
                    >
                      Queue active toggle
                    </Button>
                  </div>
                )}

                {coaRepairItem && (
                  <RepairActionPanel
                    companyId={companyId}
                    item={coaRepairItem}
                    onApplied={() => openAccount(usage.accountId)}
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
