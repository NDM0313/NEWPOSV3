import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
  loadDeveloperRepairSystemStatus,
  type DeveloperRepairSystemStatus,
} from '@/app/services/developerRepairSystemStatusService';

interface Props {
  companyId: string;
  userRole: string | null | undefined;
  refreshToken?: number;
  onStatusLoaded?: (status: DeveloperRepairSystemStatus) => void;
}

function overallBadgeClass(state: DeveloperRepairSystemStatus['overallState']): string {
  switch (state) {
    case 'ready_for_apply':
      return 'bg-emerald-900/40 text-emerald-300 border-emerald-800';
    case 'ready_for_dry_run':
      return 'bg-sky-900/40 text-sky-300 border-sky-800';
    case 'blocked_missing_migration':
      return 'bg-red-900/40 text-red-300 border-red-800';
    case 'blocked_view_only':
      return 'bg-amber-900/40 text-amber-300 border-amber-800';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function RepairSystemStatusPanel({
  companyId,
  userRole,
  refreshToken = 0,
  onStatusLoaded,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<DeveloperRepairSystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await loadDeveloperRepairSystemStatus(companyId, userRole);
      setStatus(next);
      onStatusLoaded?.(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Status check failed');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, userRole, onStatusLoaded]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  return (
    <Card className="border-gray-800 bg-gray-900/50">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-violet-400" />
              Repair System Status
            </CardTitle>
            <CardDescription className="mt-1">
              Read-only infrastructure checks — no audit insert or repair apply
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {status && (
              <Badge className={overallBadgeClass(status.overallState)}>{status.overallLabel}</Badge>
            )}
            <Button type="button" size="sm" variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        {error && <p className="text-red-400">{error}</p>}
        {!status && !error && loading && <p className="text-gray-500">Checking repair system…</p>}
        {status && (
          <ul className="space-y-1.5">
            {status.checklist.map((row) => (
              <li key={row.id} className="flex items-start gap-2">
                {row.ok ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="text-gray-300 font-medium">{row.label}</span>
                  <span className="text-gray-500 ml-2">{row.detail}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export type { DeveloperRepairSystemStatus };
