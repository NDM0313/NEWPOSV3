import React, { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { toast } from 'sonner';
import { defaultAuditLogDateRange } from '@/app/lib/developerCenterAuditLog';
import {
  loadDeveloperCenterAuditLog,
  type DeveloperCenterAuditLogSnapshot,
} from '@/app/services/accountingDeveloperCenterService';

interface Props {
  companyId: string;
}

export function AuditLogTab({ companyId }: Props) {
  const defaults = defaultAuditLogDateRange();
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<DeveloperCenterAuditLogSnapshot | null>(null);

  const run = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      setSnapshot(await loadDeveloperCenterAuditLog(companyId, dateFrom, dateTo));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Audit log load failed');
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, dateFrom, dateTo]);

  useEffect(() => {
    if (companyId) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">From</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="mt-1 bg-input-background border-border w-[150px]"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">To</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="mt-1 bg-input-background border-border w-[150px]"
          />
        </div>
        <Button type="button" size="sm" onClick={run} disabled={loading}>
          <Search className={`w-4 h-4 mr-1 ${loading ? 'animate-pulse' : ''}`} />
          Load audit log
        </Button>
        <span className="text-xs text-violet-400/90 ml-auto">Read-only — Phase E</span>
      </div>

      {snapshot && (
        <Card className="border-border bg-card/40">
          <CardHeader>
            <CardTitle className="text-base">Audit log ({snapshot.rows.length})</CardTitle>
            <CardDescription>
              {snapshot.dateFrom} → {snapshot.dateTo} · party_repair_audit + developer_repair_audit + resolved integrity issues
            </CardDescription>
            {snapshot.truncationWarning && <p className="text-xs text-amber-400">{snapshot.truncationWarning}</p>}
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {snapshot.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No audit rows in range.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-2">Time</th>
                    <th className="py-2 pr-2">Action</th>
                    <th className="py-2 pr-2">Source</th>
                    <th className="py-2 pr-2">Entity</th>
                    <th className="py-2 pr-2">Before</th>
                    <th className="py-2 pr-2">After</th>
                    <th className="py-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.rows.map((row) => (
                    <tr key={row.id} className="border-b border-border/60 align-top">
                      <td className="py-2 pr-2 text-muted-foreground whitespace-nowrap">
                        {row.timestamp.slice(0, 19).replace('T', ' ')}
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">{row.action}</td>
                      <td className="py-2 pr-2 font-mono text-muted-foreground">{row.source}</td>
                      <td className="py-2 pr-2 text-muted-foreground">
                        {row.entityType}
                        <span className="block font-mono text-[10px] text-muted-foreground">{row.entityId.slice(0, 8)}…</span>
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground max-w-[120px] truncate">{row.before}</td>
                      <td className="py-2 pr-2 text-muted-foreground max-w-[120px] truncate">{row.after}</td>
                      <td className="py-2 text-muted-foreground max-w-xs">{row.reasonCode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
