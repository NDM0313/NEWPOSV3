import React from 'react';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import type { IntegrityLabSummary } from '@/app/services/arApReconciliationCenterService';

type Props = {
  summary: IntegrityLabSummary;
  formatCurrency: (n: number) => string;
  defaultOpen?: boolean;
};

export function PayablesVarianceExplainerPanel({ summary, formatCurrency, defaultOpen = true }: Props) {
  const [open, setOpen] = React.useState(defaultOpen);

  const operational = summary.operational_payables_full;
  const partySigned = summary.party_gl_payables_signed;
  const controlRaw = summary.gl_ap_net_credit;
  const partyVsControl = summary.party_gl_vs_control_variance;
  const opVsControl = summary.variance_payables;

  return (
    <div id="payables-variance-explainer" className="rounded-xl border border-red-500/25 bg-red-950/10 scroll-mt-4">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-red-950/20"
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <h3 className="text-sm font-semibold text-red-100">Payables — three bases explained</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Operational document due vs party GL vs AP control ledger (same branch / as-of)
          </p>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open ? (
        <div className="px-4 pb-4 space-y-3 border-t border-red-500/15">
          <div className="rounded-lg border border-blue-600/35 bg-primary/5 p-3 text-xs text-primary dark:text-blue-100 flex gap-2">
            <Info className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
            <p>
              <strong>Operational payables</strong> = open purchase due from documents (
              <code className="text-blue-700 dark:text-blue-300/80">getContactBalancesSummary</code>).{' '}
              <strong>Party GL payables</strong> = supplier sub-ledger sum (
              <code className="text-blue-700 dark:text-blue-300/80">get_contact_party_gl_balances</code>) — same as Contacts green/red
              cards. <strong>Control GL</strong> = AP 2000 net Cr−Dr on the control account. Comparing operational to
              control directly often looks wrong; use party GL for apples-to-apples with Contacts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
            <StatBox
              label="Operational (document due)"
              value={formatCurrency(operational)}
              note="Purchase due — not party GL"
            />
            <StatBox
              label="Party GL payables (signed)"
              value={partySigned != null ? formatCurrency(partySigned) : '—'}
              note="get_contact_party_gl_balances"
              highlight
            />
            <StatBox
              label="Control AP (raw Cr−Dr)"
              value={controlRaw != null ? formatCurrency(controlRaw) : '—'}
              note="Integrity lab / AP 2000"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <StatBox
              label="Party GL vs control AP"
              value={partyVsControl != null ? formatCurrency(partyVsControl) : '—'}
              note="Supplier sub-ledger vs AP 2000 control"
            />
            <StatBox
              label="Operational vs control (legacy card)"
              value={opVsControl != null ? formatCurrency(opVsControl) : '—'}
              note="Often misleading — mixed bases"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatBox({
  label,
  value,
  note,
  highlight,
}: {
  label: string;
  value: string;
  note: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded border p-3 bg-muted/40',
        highlight ? 'border-emerald-700/40' : 'border-border'
      )}
    >
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn('tabular-nums text-sm font-medium mt-1', highlight ? 'text-emerald-200' : 'text-gray-200')}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground mt-1">{note}</p>
    </div>
  );
}
