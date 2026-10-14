/**
 * W3.1 custody / routing fields for Buy USD (real UI).
 */

import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Button } from '@/app/components/ui/button';
import {
  W31_HOLDING_NOT_AP_COPY,
  W31_PURPOSE_LABELS,
  W31_REQUIRES_W5_COPY,
  W31_ROUTING_LABELS,
  W31_ROUTING_QUESTION,
  purposeRequiresWave,
  sumDistributionUsd,
  supplierAsIntermediaryWarning,
  type ImportFxW31DistributionPurpose,
  type ImportFxW31RoutingMode,
  type W31DistributionDraftRow,
} from '@/app/lib/importFxCaseW31Helpers';

export type ContactOpt = { id: string; name?: string | null; type?: string | null };

type AccountOpt = { id: string; code?: string | null; name?: string | null };

type Props = {
  routingMode: ImportFxW31RoutingMode;
  onRoutingModeChange: (m: ImportFxW31RoutingMode) => void;
  wallets: AccountOpt[];
  walletId: string;
  onWalletIdChange: (id: string) => void;
  contacts: ContactOpt[];
  holderContactId: string;
  onHolderContactIdChange: (id: string) => void;
  agentContactId?: string | null;
  agentName?: string | null;
  retainedUsd: string;
  onRetainedUsdChange: (v: string) => void;
  acquiredUsd: number;
  distributionRows: W31DistributionDraftRow[];
  onDistributionRowsChange: (rows: W31DistributionDraftRow[]) => void;
  custodyControlConfigured: boolean;
};

const ROUTING_OPTIONS: ImportFxW31RoutingMode[] = [
  'COMPANY_WALLET',
  'AGENT_CUSTODY',
  'THIRD_PARTY_CUSTODY',
  'DIRECT_DISTRIBUTION',
  'SPLIT_HOLD_AND_DISTRIBUTE',
];

const PURPOSES = Object.keys(W31_PURPOSE_LABELS) as ImportFxW31DistributionPurpose[];

export function ImportFxCaseW31RoutingFields(props: Props) {
  const distributed = sumDistributionUsd(props.distributionRows);
  const retainedN = Number(props.retainedUsd) || 0;
  const unallocated = Math.round((props.acquiredUsd - retainedN - distributed) * 1e6) / 1e6;

  const addRow = () => {
    props.onDistributionRowsChange([
      ...props.distributionRows,
      {
        recipient_contact_id: '',
        purpose: 'THIRD_PARTY_CUSTODY',
        usd_qty: 0,
      },
    ]);
  };

  const updateRow = (idx: number, patch: Partial<W31DistributionDraftRow>) => {
    props.onDistributionRowsChange(
      props.distributionRows.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    );
  };

  const needsControl =
    props.routingMode !== 'COMPANY_WALLET' ||
    (props.routingMode === 'SPLIT_HOLD_AND_DISTRIBUTE' && !props.walletId);

  return (
    <div className="space-y-3 rounded-lg border border-border p-3 bg-muted/20">
      <div>
        <Label className="text-sm font-medium">{W31_ROUTING_QUESTION}</Label>
        <select
          className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={props.routingMode}
          onChange={(e) => props.onRoutingModeChange(e.target.value as ImportFxW31RoutingMode)}
        >
          {ROUTING_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {W31_ROUTING_LABELS[m]}
            </option>
          ))}
        </select>
      </div>

      {needsControl && !props.custodyControlConfigured && props.routingMode !== 'COMPANY_WALLET' && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Blocked until Settings → Import FX USD Custody Control is configured (fail-closed; never invent CoA).
        </p>
      )}

      {props.routingMode === 'COMPANY_WALLET' && (
        <div>
          <Label>Company USD/TT Wallet</Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={props.walletId}
            onChange={(e) => props.onWalletIdChange(e.target.value)}
          >
            <option value="">Select wallet…</option>
            {props.wallets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {props.routingMode === 'AGENT_CUSTODY' && (
        <p className="text-xs text-muted-foreground">
          Agent <strong>{props.agentName || 'case agent'}</strong> will hold USD under company instructions. No company
          bank account required. Operational custody ≠ Agent AP ledger.
        </p>
      )}

      {(props.routingMode === 'THIRD_PARTY_CUSTODY' ||
        props.routingMode === 'SPLIT_HOLD_AND_DISTRIBUTE') && (
        <div>
          <Label>
            {props.routingMode === 'THIRD_PARTY_CUSTODY'
              ? 'Third-party / custodian holder'
              : 'Holder for retained balance'}
          </Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={props.holderContactId}
            onChange={(e) => props.onHolderContactIdChange(e.target.value)}
          >
            <option value="">
              {props.routingMode === 'SPLIT_HOLD_AND_DISTRIBUTE' ? 'FX Agent (default)' : 'Select contact…'}
            </option>
            {props.contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type || 'contact'})
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground mt-1">{W31_HOLDING_NOT_AP_COPY}</p>
        </div>
      )}

      {props.routingMode === 'SPLIT_HOLD_AND_DISTRIBUTE' && (
        <div>
          <Label>Retained USD</Label>
          <Input value={props.retainedUsd} onChange={(e) => props.onRetainedUsdChange(e.target.value)} />
          <p className="text-[11px] text-muted-foreground mt-1">
            Optional: retain in company wallet instead of agent/third party
          </p>
          <select
            className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={props.walletId}
            onChange={(e) => props.onWalletIdChange(e.target.value)}
          >
            <option value="">Hold with selected holder (not company wallet)</option>
            {props.wallets.map((a) => (
              <option key={a.id} value={a.id}>
                Retain in {a.code} — {a.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {(props.routingMode === 'DIRECT_DISTRIBUTION' ||
        props.routingMode === 'SPLIT_HOLD_AND_DISTRIBUTE') && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Distribution instructions</Label>
            <Button type="button" size="sm" variant="outline" onClick={addRow}>
              Add recipient
            </Button>
          </div>
          <div className="text-[11px] text-muted-foreground grid grid-cols-2 sm:grid-cols-4 gap-1">
            <span>Acquired: {props.acquiredUsd}</span>
            <span>Distributed: {distributed}</span>
            <span>Retained: {retainedN}</span>
            <span className={unallocated !== 0 ? 'text-amber-600' : ''}>Unallocated: {unallocated}</span>
          </div>
          {props.distributionRows.map((row, idx) => {
            const contact = props.contacts.find((c) => c.id === row.recipient_contact_id);
            const isSupplier =
              String(contact?.type || '').toLowerCase() === 'supplier' ||
              String(contact?.type || '').toLowerCase() === 'both';
            const warn = supplierAsIntermediaryWarning({
              recipientIsSupplier: isSupplier,
              purpose: row.purpose,
            });
            const wave = purposeRequiresWave(row.purpose);
            return (
              <div key={idx} className="rounded border border-border p-2 space-y-2 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label>Recipient</Label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={row.recipient_contact_id}
                      onChange={(e) => updateRow(idx, { recipient_contact_id: e.target.value })}
                    >
                      <option value="">Select…</option>
                      {props.contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.type || 'contact'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Purpose</Label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={row.purpose}
                      onChange={(e) =>
                        updateRow(idx, { purpose: e.target.value as ImportFxW31DistributionPurpose })
                      }
                    >
                      {PURPOSES.map((p) => (
                        <option key={p} value={p}>
                          {W31_PURPOSE_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>USD qty</Label>
                    <Input
                      value={String(row.usd_qty || '')}
                      onChange={(e) => updateRow(idx, { usd_qty: Number(e.target.value) || 0 })}
                    />
                  </div>
                  {row.purpose === 'SUPPLIER_INVOICE_SETTLEMENT' && (
                    <div>
                      <Label>Linked purchase id</Label>
                      <Input
                        value={row.linked_purchase_id || ''}
                        onChange={(e) => updateRow(idx, { linked_purchase_id: e.target.value || null })}
                        placeholder="Required for W5 — instruction stays blocked"
                      />
                    </div>
                  )}
                </div>
                {warn && <p className="text-[11px] text-amber-700 dark:text-amber-300">{warn}</p>}
                {wave && (
                  <p className="text-[11px] text-muted-foreground">
                    {wave === 'W5' ? W31_REQUIRES_W5_COPY : `Requires ${wave} — execution blocked in W3.1`}
                  </p>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    props.onDistributionRowsChange(props.distributionRows.filter((_, i) => i !== idx))
                  }
                >
                  Remove
                </Button>
              </div>
            );
          })}
          <p className="text-[11px] text-muted-foreground">
            Instructions are planned only. Do not claim “supplier paid” until W5 settles a linked open item.
          </p>
        </div>
      )}
    </div>
  );
}
