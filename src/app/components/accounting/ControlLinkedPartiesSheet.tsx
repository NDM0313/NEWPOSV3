import React, { useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/app/components/ui/sheet';
import { Badge } from '@/app/components/ui/badge';
import type { Account } from '@/app/context/AccountingContext';
import type { ContactPartyGlBalancesSlice } from '@/app/services/contactService';
import {
  nearestPartyControlAncestorId,
  officialPartyControlTitle,
} from '@/app/lib/partyControlAccounts';

const SHEET_CONTROL_CODES = new Set(['1100', '2000', '2010', '1180']);

function partyRoleLabel(type: string | null | undefined): string {
  const t = String(type || '').toLowerCase();
  if (t === 'customer') return 'Customer';
  if (t === 'supplier') return 'Supplier';
  if (t === 'both') return 'Customer · Supplier';
  if (t === 'worker') return 'Worker';
  return 'Party';
}

function balanceForControl(
  code: string,
  slice: ContactPartyGlBalancesSlice | undefined
): number {
  if (!slice) return 0;
  if (code === '1100') return slice.glArReceivable;
  if (code === '2000') return slice.glApPayable;
  if (code === '2010' || code === '1180') return slice.glWorkerPayable;
  return 0;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  control: (Account & { code?: string; name?: string }) | null;
  allAccounts: Array<
    Account & {
      linked_contact_id?: string | null;
      linked_contact_name?: string | null;
      linked_contact_party_type?: string | null;
    }
  >;
  partyGlByContactId: Map<string, ContactPartyGlBalancesSlice> | null;
  formatCurrency: (n: number) => string;
};

export function ControlLinkedPartiesSheet({
  open,
  onOpenChange,
  control,
  allAccounts,
  partyGlByContactId,
  formatCurrency,
}: Props) {
  const rows = useMemo(() => {
    if (!control?.id) return [];
    const code = String(control.code || '').trim();
    if (!SHEET_CONTROL_CODES.has(code)) return [];
    const accountsById = new Map(allAccounts.map((a) => [a.id, a]));
    const seen = new Set<string>();
    const out: {
      contactId: string;
      name: string;
      partyType: string;
      balance: number;
    }[] = [];

    for (const a of allAccounts) {
      const cid = String(a.linked_contact_id || '').trim();
      if (!cid || seen.has(cid)) continue;
      const anc = nearestPartyControlAncestorId(a, accountsById);
      if (anc !== control.id) continue;
      seen.add(cid);
      const slice = partyGlByContactId?.get(cid);
      out.push({
        contactId: cid,
        name: String(a.linked_contact_name || a.name || 'Contact'),
        partyType: partyRoleLabel(a.linked_contact_party_type),
        balance: balanceForControl(code, slice),
      });
    }

    // Legacy COA: purchase AP posts resolve to supplier in get_contact_party_gl_balances, but no sub-account row
    // may have linked_contact_id — still show the party line so the sheet matches supplier ledger / purchases due.
    if (partyGlByContactId?.size) {
      partyGlByContactId.forEach((slice, contactId) => {
        if (!contactId || seen.has(contactId)) return;
        const bal = balanceForControl(code, slice);
        if (Math.abs(bal) < 1e-6) return;
        seen.add(contactId);
        const linkedAcc = allAccounts.find((x) => String(x.linked_contact_id || '').trim() === contactId);
        const name =
          String(linkedAcc?.linked_contact_name || linkedAcc?.name || '').trim() ||
          `Contact ${contactId.slice(0, 8)}…`;
        const partyType =
          code === '1100'
            ? 'Customer'
            : code === '2000'
              ? 'Supplier'
              : partyRoleLabel(linkedAcc?.linked_contact_party_type);
        out.push({ contactId, name, partyType, balance: bal });
      });
    }

    out.sort((x, y) => x.name.localeCompare(y.name));
    return out;
  }, [control, allAccounts, partyGlByContactId]);

  const code = String(control?.code || '').trim();
  const title = control ? `${code} · ${officialPartyControlTitle(code)}` : 'Linked parties';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="bg-gray-950 border-gray-800 text-gray-100 w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-white pr-8">{title}</SheetTitle>
          <SheetDescription className="text-gray-400 text-sm">
            GL sub-ledger lines linked to this control. Amounts match the Accounts list and Contacts GL.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6 overflow-y-auto flex-1 min-h-0">
          {rows.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">No linked parties found for this control.</p>
          ) : (
            <ul className="divide-y divide-gray-800/90 border border-gray-800 rounded-lg overflow-hidden">
              {rows.map((r) => (
                <li key={r.contactId} className="px-3 py-3 bg-gray-900/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-white text-sm truncate">{r.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge className="border-violet-500/35 bg-violet-500/15 text-[10px] text-violet-200">
                          {r.partyType}
                        </Badge>
                        <span className="text-[10px] text-gray-500">
                          Linked to {officialPartyControlTitle(code)} ({code})
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-semibold tabular-nums text-emerald-400">
                        {formatCurrency(r.balance)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
