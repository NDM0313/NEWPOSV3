'use client';

import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/app/components/ui/sheet';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';
import {
  fetchControlAccountBreakdown,
  type ControlAccountBreakdownResult,
  type BreakdownMetricRow,
  type PartyGlRow,
} from '@/app/services/controlAccountBreakdownService';
import { setContactsPartyDrilldown } from '@/app/lib/contactsPartyDrilldown';
import { LoadingSpinner } from '@/app/components/shared/LoadingSpinner';

function sourceBadge(src: BreakdownMetricRow['source']) {
  const label =
    src === 'gl' ? 'GL' : src === 'operational' ? 'Operational' : src === 'reconciliation' ? 'Reconciliation' : 'Hybrid';
  const cls =
    src === 'gl'
      ? 'bg-violet-600/25 text-violet-100 border-violet-500/30'
      : src === 'operational'
        ? 'bg-sky-600/25 text-sky-100 border-sky-500/30'
        : src === 'reconciliation'
          ? 'bg-amber-600/25 text-amber-100 border-amber-500/30'
          : 'bg-gray-600/25 text-gray-100 border-gray-500/30';
  return (
    <Badge variant="outline" className={cn('text-[10px] shrink-0', cls)}>
      {label}
    </Badge>
  );
}

function statusLabel(s: BreakdownMetricRow['status']) {
  if (s === 'ok') return null;
  if (s === 'pending_mapping') return 'Pending mapping';
  return 'Unavailable';
}

export interface ControlAccountBreakdownDrawerProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  branchId: string | null | undefined;
  account: { id: string; code?: string; name?: string } | null;
  controlKind: ControlAccountBreakdownResult['controlKind'] | null;
  formatCurrency: (n: number) => string;
  onOpenGlLedger: (account: { id: string; name: string; code?: string; type: string }) => void;
  onNavigate: (view: 'contacts' | 'ar-ap-reconciliation-center') => void;
}

export function ControlAccountBreakdownDrawer({
  open,
  onClose,
  companyId,
  branchId,
  account,
  controlKind,
  formatCurrency,
  onOpenGlLedger,
  onNavigate,
}: ControlAccountBreakdownDrawerProps) {
  const [data, setData] = useState<ControlAccountBreakdownResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !account?.id || !controlKind || !companyId) {
      setData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchControlAccountBreakdown({
          companyId,
          branchId,
          accountId: account.id,
          accountCode: String(account.code || '').trim(),
          accountName: account.name || '',
          controlKind,
        });
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load breakdown');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, account?.id, account?.code, account?.name, controlKind, companyId, branchId]);

  const partyDrill = (row: PartyGlRow) => {
    const tabHint =
      row.kind === 'ar' ? 'customers' : row.kind === 'ap' ? 'suppliers' : 'workers';
    setContactsPartyDrilldown({ contactId: row.contactId, tabHint });
    onNavigate('contacts');
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg bg-[#0B0F19] border-gray-800 text-white overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-white text-left">Control account breakdown</SheetTitle>
          <SheetDescription className="text-gray-400 text-left space-y-1">
            <span className="block">
              {account?.name} {account?.code ? `(${account.code})` : ''} — each figure uses one engine:{' '}
              <strong className="text-gray-300">GL</strong> (journal),{' '}
              <strong className="text-gray-300">Operational</strong> (documents / RPC),{' '}
              <strong className="text-gray-300">Reconciliation</strong> (variance), or{' '}
              <strong className="text-gray-300">Pending mapping</strong> (not split — no fake precision).
            </span>
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        )}
        {error && <p className="text-sm text-red-300 mt-4">{error}</p>}

        {!loading && data && (
          <div className="mt-6 space-y-6 text-sm">
            <section>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">GL (journal)</h4>
              <div className="rounded-lg border border-gray-800 bg-[#0F1419] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-300">Trial balance balance (Dr − Cr)</span>
                  <Badge variant="outline" className="text-[10px] bg-violet-600/20 text-violet-100 border-violet-500/30">
                    GL
                  </Badge>
                </div>
                <p className="text-lg font-semibold tabular-nums text-white">
                  {data.glAccountBalance != null ? formatCurrency(data.glAccountBalance) : '—'}
                </p>
                {data.controlKind === 'ap' && data.glAccountBalance != null && (
                  <p className="text-[11px] text-gray-500">
                    AP liability view: credit − debit ≈ {formatCurrency(-data.glAccountBalance)} (compare to party
                    payables).
                  </p>
                )}
                {data.glBalanceNote && <p className="text-xs text-amber-200/90">{data.glBalanceNote}</p>}
              </div>
            </section>

            <section>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Subcategory breakdown
              </h4>
              <p className="text-[10px] text-gray-600 mb-2">
                Use the row badge for engine; &quot;Pending mapping&quot; means the bucket is intentionally not broken
                down further here.
              </p>
              <ul className="space-y-2">
                {data.subcategories.map((row, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-gray-800 bg-[#0F1419] p-3 flex flex-col gap-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-gray-200">{row.label}</span>
                      {sourceBadge(row.source)}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-base font-medium tabular-nums text-white">
                        {row.amount != null ? formatCurrency(row.amount) : '—'}
                      </span>
                      {row.status !== 'ok' && (
                        <Badge className="bg-gray-700 text-gray-200 text-[10px]">{statusLabel(row.status)}</Badge>
                      )}
                    </div>
                    {row.note && <p className="text-[11px] text-gray-500">{row.note}</p>}
                  </li>
                ))}
              </ul>
            </section>

            {data.partySectionNote && (
              <p className="text-[11px] text-gray-500 border border-gray-800 rounded-lg p-2">{data.partySectionNote}</p>
            )}

            {data.controlKind !== 'suspense' && (
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Party-wise (GL resolver)
                </h4>
                <p className="text-[11px] text-gray-500 mb-2">
                  Amounts from <code className="text-gray-400">get_contact_party_gl_balances</code> — GL slice, not
                  operational subledger.
                </p>
                {data.partyRows.length === 0 ? (
                  <p className="text-gray-500 text-xs">No non-zero party rows.</p>
                ) : (
                  <ul className="max-h-56 overflow-y-auto space-y-1 border border-gray-800 rounded-lg p-2 bg-[#0F1419]">
                    {data.partyRows.map((p) => (
                      <li key={p.contactId} className="flex items-center justify-between gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => partyDrill(p)}
                          className="text-left text-blue-300 hover:underline truncate flex-1"
                          title="Open party statement (Operational / GL / Reconciliation tabs)"
                        >
                          {p.name}
                        </button>
                        <span className="flex items-center gap-1.5 shrink-0">
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 bg-violet-600/20 text-violet-100 border-violet-500/30"
                          >
                            GL
                          </Badge>
                          <span className="tabular-nums text-gray-200">{formatCurrency(p.glAmount)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {data.unmappedNote && (
              <section className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-3">
                <h4 className="text-xs font-semibold text-amber-200/90 uppercase tracking-wide mb-1">
                  Unmapped / residual (GL)
                </h4>
                <p className="text-[11px] text-gray-400 mb-1">{data.unmappedNote}</p>
                {data.unmappedGlResidual != null && (
                  <p className="text-sm font-semibold text-amber-100 tabular-nums">
                    {formatCurrency(data.unmappedGlResidual)}
                  </p>
                )}
              </section>
            )}

            <section className="flex flex-col gap-2 pt-2 border-t border-gray-800">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Actions</span>
              <Button
                type="button"
                variant="outline"
                className="border-violet-600/50 text-violet-100 hover:bg-violet-950/40 justify-start"
                onClick={() => {
                  if (!account) return;
                  onOpenGlLedger({
                    id: account.id,
                    name: account.name || '',
                    code: account.code,
                    type: 'Asset',
                  });
                  onClose();
                }}
              >
                Open GL statement (account ledger)
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-sky-600/50 text-sky-100 hover:bg-sky-950/40 justify-start"
                onClick={() => {
                  onNavigate('contacts');
                  onClose();
                }}
              >
                Open operational statement (Contacts)
              </Button>
              <p className="text-[10px] text-gray-600 px-1">
                In Contacts, row menu → Party statement (Operational / GL / Reconciliation); pick Customers / Suppliers /
                Workers tab as needed.
              </p>
              <Button
                type="button"
                variant="outline"
                className="border-amber-600/50 text-amber-100 hover:bg-amber-950/40 justify-start"
                onClick={() => {
                  onNavigate('ar-ap-reconciliation-center');
                  onClose();
                }}
              >
                Open reconciliation (AR/AP center)
              </Button>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
