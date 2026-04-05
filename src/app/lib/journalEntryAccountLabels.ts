/**
 * Resolve embedded PostgREST `account` on journal_entry_lines (object or single-element array).
 */
export function journalLineEmbeddedAccount(line: {
  account?: { name?: string; code?: string } | { name?: string; code?: string }[] | null;
  account_name?: string | null;
}): { name: string; code?: string } | null {
  const raw = line?.account as { name?: string; code?: string } | { name?: string; code?: string }[] | null | undefined;
  const obj = Array.isArray(raw) ? raw[0] : raw;
  const name = (line?.account_name && String(line.account_name).trim()) || (obj?.name && String(obj.name).trim()) || '';
  if (!name) return null;
  const code = obj?.code != null && String(obj.code).trim() !== '' ? String(obj.code).trim() : undefined;
  return { name, code };
}

/** Leaf label for one line: prefer "Name (code)" when code present. */
export function journalLineAccountLabel(line: {
  account?: { name?: string; code?: string } | { name?: string; code?: string }[] | null;
  account_name?: string | null;
}): string {
  const a = journalLineEmbeddedAccount(line);
  if (!a) return 'Unknown account';
  return a.code ? `${a.name} (${a.code})` : a.name;
}

function accountLooksLikeAp(name: string, code?: string): boolean {
  const c = String(code || '').trim();
  if (c === '2000') return true;
  const n = name.toLowerCase();
  return n.includes('payable') && !n.includes('receivable') && !n.includes('worker');
}

function accountLooksLikeAr(name: string, code?: string): boolean {
  const c = String(code || '').trim();
  if (c === '1100') return true;
  const n = name.toLowerCase();
  return (n.includes('receivable') || n.includes('a/r')) && !n.includes('payable');
}

/**
 * Party suffix for control-account lines when payment contact is known (supplier/customer name).
 */
export function withPartyContextForLine(
  line: { account?: unknown; account_name?: string | null },
  partyName: string | null | undefined
): string {
  const base = journalLineAccountLabel(line as Parameters<typeof journalLineAccountLabel>[0]);
  const p = partyName && String(partyName).trim();
  if (!p) return base;
  const a = journalLineEmbeddedAccount(line as Parameters<typeof journalLineEmbeddedAccount>[0]);
  if (!a) return base;
  if (accountLooksLikeAp(a.name, a.code) || accountLooksLikeAr(a.name, a.code)) {
    return `${base} — ${p}`;
  }
  return base;
}

/**
 * Build compact multi-line summary for grouped journal rows (audit / expanded).
 */
export function summarizeJournalLinesAccountPairs(lines: unknown[] | undefined, paymentPartyName?: string | null): {
  debitLabel: string;
  creditLabel: string;
} {
  const raw = (lines || []) as Array<{
    debit?: number;
    credit?: number;
    account?: unknown;
    account_name?: string;
  }>;
  const drLines = raw.filter((l) => Number(l.debit || 0) > 0);
  const crLines = raw.filter((l) => Number(l.credit || 0) > 0);
  const uniq = (labels: string[]) => [...new Set(labels.filter(Boolean))];
  const drLabs = uniq(drLines.map((l) => withPartyContextForLine(l, paymentPartyName)));
  const crLabs = uniq(crLines.map((l) => withPartyContextForLine(l, paymentPartyName)));
  const fmt = (arr: string[], side: 'Dr' | 'Cr') => {
    if (arr.length === 0) return '—';
    if (arr.length <= 2) return arr.join(' · ');
    return `${arr.slice(0, 2).join(' · ')} +${arr.length - 2} ${side}`;
  };
  return { debitLabel: fmt(drLabs, 'Dr'), creditLabel: fmt(crLabs, 'Cr') };
}
