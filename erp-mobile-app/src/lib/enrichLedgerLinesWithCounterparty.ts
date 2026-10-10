import { supabase, isSupabaseConfigured } from './supabase';
import type { LedgerLine } from '../api/reports';

const LIQUIDITY_ACCOUNT_TYPES = new Set(['cash', 'bank', 'wallet', 'mobile_wallet']);

const CONTROL_ACCOUNT_CODES = new Set(['1100', '1200', '2100', '2000']);

type CounterAccountLine = {
  lineId: string;
  journalEntryId: string;
  accountId: string;
  name: string;
  code: string;
  type: string;
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function formatAccountLabel(name: string): string {
  return String(name || '').trim();
}

function pickCounterAccountLabel(
  lines: CounterAccountLine[],
  excludeLineId?: string | null,
  excludeAccountIds?: Set<string>,
): { name: string; code: string | null; type: string | null } | null {
  const candidates = lines.filter((line) => {
    if (excludeLineId && line.lineId === excludeLineId) return false;
    if (excludeAccountIds?.has(line.accountId)) return false;
    const code = String(line.code || '').trim();
    if (code && CONTROL_ACCOUNT_CODES.has(code)) return false;
    return Boolean(String(line.name || '').trim());
  });
  if (!candidates.length) return null;

  const liquidity = candidates.filter((line) =>
    LIQUIDITY_ACCOUNT_TYPES.has(String(line.type || '').toLowerCase()),
  );
  const pick = liquidity.length ? liquidity : candidates;
  const first = pick[0];
  if (!first) return null;
  return { name: formatAccountLabel(first.name), code: first.code || null, type: first.type || null };
}

async function fetchCounterLinesByJe(
  jeIds: string[],
): Promise<Map<string, CounterAccountLine[]>> {
  const map = new Map<string, CounterAccountLine[]>();
  if (!jeIds.length) return map;

  for (const batch of chunk(jeIds, 50)) {
    const { data, error } = await supabase
      .from('journal_entry_lines')
      .select('id, journal_entry_id, account_id, account:accounts(name, code, type)')
      .in('journal_entry_id', batch);
    if (error) continue;
    for (const row of data || []) {
      const r = row as Record<string, unknown>;
      const jeId = String(r.journal_entry_id ?? '');
      if (!jeId) continue;
      const acc = r.account as { name?: string; code?: string; type?: string } | { name?: string; code?: string; type?: string }[] | null;
      const account = Array.isArray(acc) ? acc[0] : acc;
      const line: CounterAccountLine = {
        lineId: String(r.id ?? ''),
        journalEntryId: jeId,
        accountId: String(r.account_id ?? ''),
        name: String(account?.name ?? ''),
        code: String(account?.code ?? ''),
        type: String(account?.type ?? ''),
      };
      const list = map.get(jeId) ?? [];
      list.push(line);
      map.set(jeId, list);
    }
  }
  return map;
}

async function fetchJournalEntryHeadersById(
  jeIds: string[],
): Promise<Map<string, { referenceType: string; referenceId: string | null; description: string }>> {
  const map = new Map<string, { referenceType: string; referenceId: string | null; description: string }>();
  if (!jeIds.length || !isSupabaseConfigured) return map;

  for (const batch of chunk(jeIds, 50)) {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('id, reference_type, reference_id, description')
      .in('id', batch);
    if (error) continue;
    for (const row of data || []) {
      const r = row as {
        id?: string;
        reference_type?: string;
        reference_id?: string | null;
        description?: string;
      };
      const id = String(r.id ?? '');
      if (!id) continue;
      const refId = r.reference_id != null && String(r.reference_id).trim() !== ''
        ? String(r.reference_id).trim()
        : null;
      map.set(id, {
        referenceType: String(r.reference_type ?? '').trim(),
        referenceId: refId,
        description: String(r.description ?? '').trim(),
      });
    }
  }
  return map;
}

async function fetchPartyNamesByPaymentId(
  paymentIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!paymentIds.length || !isSupabaseConfigured) return map;

  for (const batch of chunk(paymentIds, 50)) {
    const { data: payments } = await supabase
      .from('payments')
      .select('id, reference_type, reference_id, contact_id')
      .in('id', batch);
    if (!payments?.length) continue;

    const contactIds = new Set<string>();
    const saleIds = new Set<string>();
    const purchaseIds = new Set<string>();

    for (const p of payments as Array<Record<string, unknown>>) {
      const pid = String(p.contact_id ?? '').trim();
      if (pid) contactIds.add(pid);
      const rt = String(p.reference_type || '').toLowerCase();
      const rid = String(p.reference_id ?? '').trim();
      if (rt === 'sale' && rid) saleIds.add(rid);
      if (rt === 'purchase' && rid) purchaseIds.add(rid);
      if (rt === 'worker_payment' && rid) contactIds.add(rid);
    }

    const contactsById = new Map<string, string>();
    if (contactIds.size) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name')
        .in('id', Array.from(contactIds));
      for (const c of contacts || []) {
        const row = c as { id?: string; name?: string };
        if (row.id && row.name) contactsById.set(String(row.id), String(row.name));
      }
    }

    const saleCustomerById = new Map<string, string>();
    if (saleIds.size) {
      const { data: sales } = await supabase
        .from('sales')
        .select('id, customer_name, customer_id')
        .in('id', Array.from(saleIds));
      for (const s of sales || []) {
        const row = s as { id?: string; customer_name?: string; customer_id?: string };
        if (row.id) {
          const name = String(row.customer_name || '').trim();
          if (name) saleCustomerById.set(String(row.id), name);
          else if (row.customer_id && contactsById.has(String(row.customer_id))) {
            saleCustomerById.set(String(row.id), contactsById.get(String(row.customer_id))!);
          }
        }
      }
    }

    const purchaseSupplierById = new Map<string, string>();
    if (purchaseIds.size) {
      const { data: purchases } = await supabase
        .from('purchases')
        .select('id, supplier_name, supplier_id')
        .in('id', Array.from(purchaseIds));
      for (const p of purchases || []) {
        const row = p as { id?: string; supplier_name?: string; supplier_id?: string };
        if (row.id) {
          const name = String(row.supplier_name || '').trim();
          if (name) purchaseSupplierById.set(String(row.id), name);
          else if (row.supplier_id && contactsById.has(String(row.supplier_id))) {
            purchaseSupplierById.set(String(row.id), contactsById.get(String(row.supplier_id))!);
          }
        }
      }
    }

    for (const p of payments as Array<Record<string, unknown>>) {
      const payId = String(p.id ?? '');
      if (!payId) continue;
      const partyId = String(p.contact_id ?? '').trim();
      if (partyId && contactsById.has(partyId)) {
        map.set(payId, contactsById.get(partyId)!);
        continue;
      }
      const rt = String(p.reference_type || '').toLowerCase();
      const rid = String(p.reference_id ?? '').trim();
      if (rt === 'sale' && rid && saleCustomerById.has(rid)) {
        map.set(payId, saleCustomerById.get(rid)!);
      } else if (rt === 'purchase' && rid && purchaseSupplierById.has(rid)) {
        map.set(payId, purchaseSupplierById.get(rid)!);
      }
    }
  }
  return map;
}

export type EnrichLedgerLinesOpts = {
  viewedAccountId?: string | null;
};

/** Batch-enrich ledger lines with counter GL account + payment party names. */
export async function enrichLedgerLinesWithCounterparty(
  lines: LedgerLine[],
  opts: EnrichLedgerLinesOpts = {},
): Promise<LedgerLine[]> {
  if (!lines.length || !isSupabaseConfigured) return lines;

  const jeIds = Array.from(new Set(lines.map((l) => l.journalEntryId).filter(Boolean)));
  const paymentIds = Array.from(
    new Set(lines.map((l) => l.paymentId).filter((id): id is string => Boolean(id))),
  );

  const [counterByJe, partyByPayment, jeHeadersById] = await Promise.all([
    fetchCounterLinesByJe(jeIds),
    fetchPartyNamesByPaymentId(paymentIds),
    fetchJournalEntryHeadersById(jeIds),
  ]);

  const excludeAccountIds = opts.viewedAccountId
    ? new Set([opts.viewedAccountId])
    : undefined;

  return lines.map((line) => {
    const counterLines = counterByJe.get(line.journalEntryId) ?? [];
    const counter = pickCounterAccountLabel(counterLines, line.id, excludeAccountIds);
    const partyName = line.paymentId ? partyByPayment.get(line.paymentId) ?? null : null;
    const jeHeader = jeHeadersById.get(line.journalEntryId);
    const referenceType =
      String(line.referenceType || '').trim() || jeHeader?.referenceType || '';
    const sourceReferenceId =
      (line.sourceReferenceId != null && String(line.sourceReferenceId).trim() !== ''
        ? String(line.sourceReferenceId).trim()
        : null) ??
      jeHeader?.referenceId ??
      null;
    const entryDescription = jeHeader?.description || line.entryDescription || null;
    const lineDesc = String(line.description || '').trim();
    const entryDesc = String(entryDescription || '').trim();
    let description = lineDesc || entryDesc || '—';
    if (lineDesc && entryDesc && lineDesc.toLowerCase() !== entryDesc.toLowerCase()) {
      if (entryDesc.toLowerCase().includes(lineDesc.toLowerCase())) {
        description = entryDesc;
      } else if (!isWeakGlLineDescription(lineDesc)) {
        description = lineDesc;
      } else {
        description = entryDesc || lineDesc;
      }
    }

    return {
      ...line,
      referenceType,
      sourceReferenceId,
      description,
      entryDescription: entryDescription ?? line.entryDescription ?? null,
      counterAccountName: counter?.name ?? line.counterAccountName ?? null,
      counterAccountCode: counter?.code ?? line.counterAccountCode ?? null,
      counterAccountType: counter?.type ?? line.counterAccountType ?? null,
      partyName: partyName ?? line.partyName ?? null,
    };
  });
}

function isWeakGlLineDescription(text: string): boolean {
  const t = String(text || '').trim().toLowerCase();
  if (!t || t === '—') return true;
  return (
    /^sales revenue\b/.test(t) ||
    /^revenue\b/.test(t) ||
    /^accounts receivable\b/.test(t) ||
    /^accounts payable\b/.test(t) ||
    /^receivable\s*[-–]/.test(t) ||
    /^payable\s*[-–]/.test(t)
  );
}
