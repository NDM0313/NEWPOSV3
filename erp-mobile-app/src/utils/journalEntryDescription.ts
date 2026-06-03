/** Auto-composed journal entry descriptions (mobile Transfer + General Entry). */

export function formatMoneyRs(amount: number): string {
  const n = Number(amount) || 0;
  return `Rs. ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function accountLabel(name: string, code?: string | null): string {
  const n = String(name || '').trim() || 'Account';
  const c = String(code ?? '').trim();
  return c ? `${n} (${c})` : n;
}

export function buildTransferAutoDescription(params: {
  amount: number;
  fromName: string;
  fromCode?: string | null;
  toName: string;
  toCode?: string | null;
  date: string;
  addedByName?: string | null;
}): string {
  const parts = [
    `Fund transfer ${formatMoneyRs(params.amount)}`,
    `From ${accountLabel(params.fromName, params.fromCode)} → ${accountLabel(params.toName, params.toCode)}`,
    params.date ? `Date ${params.date}` : null,
    params.addedByName?.trim() ? `By ${params.addedByName.trim()}` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

export function buildGeneralJournalAutoDescription(params: {
  debitName: string;
  debitCode?: string | null;
  creditName: string;
  creditCode?: string | null;
  addedByName?: string | null;
}): string {
  const parts = [
    'Journal entry',
    `From-Dr ${accountLabel(params.debitName, params.debitCode)}`,
    `To-Cr ${accountLabel(params.creditName, params.creditCode)}`,
    params.addedByName?.trim() ? `By ${params.addedByName.trim()}` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

export function composeJournalEntryDescription(params: {
  auto: string;
  userNotes?: string | null;
  reference?: string | null;
}): string {
  const auto = String(params.auto ?? '').trim();
  const notes = String(params.userNotes ?? '').trim();
  const ref = String(params.reference ?? '').trim();
  const refPart = ref ? (ref.startsWith('Ref:') || ref.startsWith('Reference') ? ref : `Ref: ${ref}`) : '';
  const chunks = [auto, notes, refPart].filter(Boolean);
  return chunks.join(' | ') || 'Journal entry';
}
