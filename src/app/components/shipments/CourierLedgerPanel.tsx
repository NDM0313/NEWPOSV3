import React, { useEffect, useState } from 'react';
import { shipmentAccountingService } from '@/app/services/shipmentAccountingService';
import { courierService } from '@/app/services/courierService';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { Truck, AlertCircle, RefreshCw } from 'lucide-react';

interface CourierBalance {
  courier_id: string | null;
  courier_name: string;
  total_payable: number;
  total_paid: number;
  balance: number;
}

interface CourierLedgerPanelProps {
  companyId: string;
}

/** Merge master couriers with balance data so all company couriers show (newly added with 0 balance). */
function mergeCourierBalances(
  masterCouriers: { id: string; name: string; contact_id?: string | null }[],
  balanceRows: CourierBalance[]
): CourierBalance[] {
  const balanceByContactId = new Map<string, CourierBalance>();
  const balanceByName = new Map<string, CourierBalance>();
  balanceRows.forEach((b) => {
    if (b.courier_id) balanceByContactId.set(b.courier_id, b);
    balanceByName.set(b.courier_name.trim().toLowerCase(), b);
  });
  const result: CourierBalance[] = [];
  const namesAdded = new Set<string>();
  for (const c of masterCouriers) {
    const contactKey = c.contact_id ?? null;
    const row =
      (contactKey ? balanceByContactId.get(contactKey) : undefined) ??
      balanceByName.get(c.name.trim().toLowerCase());
    result.push(
      row ?? {
        courier_id: contactKey ?? c.id,
        courier_name: c.name,
        total_payable: 0,
        total_paid: 0,
        balance: 0,
      }
    );
    namesAdded.add(c.name.trim().toLowerCase());
  }
  for (const b of balanceRows) {
    const key = b.courier_name.trim().toLowerCase();
    if (namesAdded.has(key)) continue;
    result.push(b);
    namesAdded.add(key);
  }
  result.sort((a, b) => a.courier_name.localeCompare(b.courier_name));
  return result;
}

export default function CourierLedgerPanel({ companyId }: CourierLedgerPanelProps) {
  const { formatCurrency } = useFormatCurrency();
  const [balances, setBalances] = useState<CourierBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      courierService.getByCompanyId(companyId, false),
      shipmentAccountingService.getCourierBalances(companyId),
    ])
      .then(([master, balanceRows]) => {
        const merged = mergeCourierBalances(
          master.map((c) => ({ id: c.id, name: c.name, contact_id: c.contact_id })),
          balanceRows
        );
        setBalances(merged);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [companyId]);

  const totalPayable = balances.reduce((s, b) => s + b.total_payable, 0);
  const totalPaid = balances.reduce((s, b) => s + b.total_paid, 0);
  const totalBalance = balances.reduce((s, b) => s + b.balance, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Truck size={18} className="text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Courier Balances</h3>
        </div>
        <button
          type="button"
          onClick={load}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {!loading && !error && balances.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">
              Total Payable
            </div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">
              {formatCurrency(totalPayable)}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">
              Paid
            </div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-[var(--erp-money-positive)]">
              {formatCurrency(totalPaid)}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">
              Balance Due
            </div>
            <div
              className={`mt-1 text-lg font-semibold tabular-nums ${
                totalBalance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--erp-money-positive)]'
              }`}
            >
              {formatCurrency(totalBalance)}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
          <RefreshCw size={14} className="animate-spin" />
          Loading balances…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive py-2">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {!loading && !error && balances.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-4">No courier balances yet.</div>
      )}

      {!loading && !error && balances.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-muted-foreground border-b border-border text-xs uppercase tracking-wide">
                <th className="text-left px-3 py-2.5 font-medium">Courier</th>
                <th className="text-right px-3 py-2.5 font-medium">Payable</th>
                <th className="text-right px-3 py-2.5 font-medium">Paid</th>
                <th className="text-right px-3 py-2.5 font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr
                  key={b.courier_id ?? b.courier_name}
                  className="border-b border-border hover:bg-accent/50 transition-colors"
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <Truck size={14} className="text-muted-foreground shrink-0" />
                      <span className="text-foreground font-medium truncate">{b.courier_name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                    {formatCurrency(b.total_payable)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[var(--erp-money-positive)]">
                    {formatCurrency(b.total_paid)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <span
                      className={
                        b.balance > 0
                          ? 'text-amber-600 dark:text-amber-400 font-semibold'
                          : 'text-[var(--erp-money-positive)]'
                      }
                    >
                      {formatCurrency(b.balance)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
