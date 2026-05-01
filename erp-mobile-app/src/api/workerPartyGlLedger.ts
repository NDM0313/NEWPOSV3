/**
 * Worker party GL (2010 / 1180) — same logic as web `accountingService.getWorkerPartyGlJournalLedger`.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { LedgerLine } from './reports';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeWorkerBranchId(branchId: string | null | undefined): string | null {
  if (branchId == null || branchId === '' || branchId === 'all' || branchId === 'default') return null;
  const t = String(branchId).trim();
  return UUID_RE.test(t) ? t : null;
}

function mergeLedgerLineDescription(
  _referenceType: string | null | undefined,
  entryDescription: string | null | undefined,
  lineDescription: string | null | undefined,
): string {
  const ed = String(entryDescription || '').trim();
  const ld = String(lineDescription || '').trim();
  if (!ed && !ld) return '—';
  if (!ld) return ed || '—';
  if (!ed) return ld;
  if (ld.toLowerCase() === ed.toLowerCase() || ed.toLowerCase().includes(ld.toLowerCase())) return ed;
  return `${ed} — ${ld}`;
}

function workerGlLineMatchesWorker(
  line: { journal_entry?: Record<string, unknown> | null },
  workerId: string,
  workerPaymentIds: Set<string>,
): boolean {
  const entry = line.journal_entry;
  if (!entry) return false;
  const rt = String(entry.reference_type || '').toLowerCase();
  const rid = entry.reference_id;
  if ((rt === 'worker_payment' || rt === 'worker_advance_settlement') && rid && String(rid) === String(workerId)) {
    return true;
  }
  if (rt === 'opening_balance_contact_worker' && rid && String(rid) === String(workerId)) {
    return true;
  }
  const pid = entry.payment_id;
  if (pid && workerPaymentIds.has(String(pid))) return true;
  return false;
}

export async function getWorkerPartyGlLedgerLines(
  companyId: string,
  workerId: string,
  branchId: string | null | undefined,
  startDate?: string,
  endDate?: string,
): Promise<{ openingBalance: number; lines: LedgerLine[]; error: string | null }> {
  if (!isSupabaseConfigured) return { openingBalance: 0, lines: [], error: 'App not configured.' };

  const startStr = startDate ? startDate.slice(0, 10) : null;
  const endStr = endDate ? endDate.slice(0, 10) : null;
  const branchUuid = safeWorkerBranchId(branchId);

  try {
    const { data: accts } = await supabase
      .from('accounts')
      .select('id, code, name')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .or('code.eq.2010,code.eq.1180,name.ilike.%Worker Payable%,name.ilike.%Worker Advance%');

    const wpWa = (accts || []).filter((a: { code?: string }) => {
      const c = String(a.code || '').trim();
      return c === '2010' || c === '1180';
    });
    if (wpWa.length === 0) return { openingBalance: 0, lines: [], error: null };

    const accountIds = wpWa.map((a: { id: string }) => a.id);
    const codeById = new Map(wpWa.map((a: { id: string; code?: string }) => [a.id, String(a.code || '').trim()]));
    const nameById = new Map(wpWa.map((a: { id: string; name?: string }) => [a.id, String(a.name || '')]));

    const { data: lines, error } = await supabase
      .from('journal_entry_lines')
      .select(
        `
        id, debit, credit, description, account_id,
        account:accounts(id, name, code),
        journal_entry:journal_entries(
          id, entry_no, entry_date, description, reference_type, reference_id, payment_id,
          branch_id, created_by, created_at, is_void,
          branch:branches(id, name, code)
        )
      `,
      )
      .in('account_id', accountIds)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('[workerPartyGlLedger]', error.message);
      return { openingBalance: 0, lines: [], error: error.message };
    }

    // Supabase types nest `journal_entry` incorrectly as an array; mirror web and use runtime shape.
    const linesToUse = ((lines || []) as unknown as { journal_entry?: Record<string, unknown> | null }[]).filter(
      (l) => l.journal_entry && (l.journal_entry as { is_void?: boolean }).is_void !== true,
    ) as { journal_entry?: Record<string, unknown> | null; [k: string]: unknown }[];

    const { data: workerPayments } = await supabase
      .from('payments')
      .select('id')
      .eq('company_id', companyId)
      .eq('contact_id', workerId);
    const workerPaymentIds = new Set((workerPayments || []).map((p: { id: string }) => p.id));

    const workerLines = linesToUse.filter((line) => {
      const entry = line.journal_entry;
      if (!entry) return false;
      const rt = String(entry.reference_type || '').toLowerCase();
      if (rt === 'correction_reversal' && entry.reference_id) {
        const origId = String(entry.reference_id);
        return linesToUse.some((ol) => {
          const oe = ol.journal_entry;
          if (!oe || String((oe as { id?: string }).id) !== origId) return false;
          return workerGlLineMatchesWorker(ol, workerId, workerPaymentIds);
        });
      }
      return workerGlLineMatchesWorker(line, workerId, workerPaymentIds);
    });

    const branchFiltered = branchUuid
      ? workerLines.filter((line) => {
          const bid = line.journal_entry?.branch_id;
          return bid == null || bid === '' || String(bid) === branchUuid;
        })
      : workerLines;

    let openWp = 0;
    let openWa = 0;
    if (startStr) {
      branchFiltered.forEach((line) => {
        const entry = line.journal_entry;
        if (!entry || !entry.entry_date || String(entry.entry_date).slice(0, 10) >= startStr) return;
        const code = codeById.get(String(line.account_id ?? '')) || '';
        const debit = Number(line.debit || 0);
        const credit = Number(line.credit || 0);
        if (code === '2010') openWp += credit - debit;
        else if (code === '1180') openWa += debit - credit;
      });
    }
    const openingNet = openWp - openWa;

    const rangeLines = branchFiltered.filter((line) => {
      const entry = line.journal_entry;
      if (!entry?.entry_date) return false;
      const entryDate = String(entry.entry_date).slice(0, 10);
      if (startStr && entryDate < startStr) return false;
      if (endStr && entryDate > endStr) return false;
      return true;
    });

    rangeLines.sort((a, b) => {
      const dateA = String(a.journal_entry?.entry_date || '');
      const dateB = String(b.journal_entry?.entry_date || '');
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const createdA = String(a.journal_entry?.created_at || '');
      const createdB = String(b.journal_entry?.created_at || '');
      return createdA.localeCompare(createdB);
    });

    let wpRun = openWp;
    let waRun = openWa;
    let runningBalance = openingNet;

    const ledgerLines: LedgerLine[] = rangeLines.map((line) => {
      const entry = line.journal_entry as Record<string, unknown> | undefined;
      const debit = Number(line.debit || 0);
      const credit = Number(line.credit || 0);
      const aid = String(line.account_id ?? '');
      const code = codeById.get(aid) || String((line.account as { code?: string })?.code || '').trim();
      if (code === '2010') wpRun += credit - debit;
      else if (code === '1180') waRun += debit - credit;
      runningBalance = wpRun - waRun;

      const entryNo = entry?.entry_no != null ? String(entry.entry_no) : '';
      const jeId = entry?.id != null ? String(entry.id) : '';
      const descBase = mergeLedgerLineDescription(
        entry?.reference_type as string,
        entry?.description as string,
        line.description as string,
      );
      const description = `${nameById.get(aid) || (line.account as { name?: string })?.name || code} — ${descBase}`;

      return {
        id: String(line.id ?? jeId),
        journalEntryId: jeId,
        sourceReferenceId: entry?.reference_id != null ? String(entry.reference_id) : null,
        date: entry?.entry_date ? String(entry.entry_date).slice(0, 10) : '',
        createdAt: entry?.created_at != null ? String(entry.created_at) : '',
        entryNo,
        description,
        reference: entryNo || jeId.slice(0, 8) || '—',
        referenceType: String(entry?.reference_type ?? ''),
        debit,
        credit,
        runningBalance,
      };
    });

    return { openingBalance: openingNet, lines: ledgerLines, error: null };
  } catch (e) {
    console.error('[workerPartyGlLedger]', e);
    return {
      openingBalance: 0,
      lines: [],
      error: e instanceof Error ? e.message : 'Worker GL load failed',
    };
  }
}
