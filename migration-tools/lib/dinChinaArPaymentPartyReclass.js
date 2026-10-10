/**
 * Phase 4 — Relink sale payment AR credits from control 1100 → customer party AR-* sub-ledger
 * when the sale document JE debited the party account (RAEES / AZIZ pattern).
 */

import { num, roundMoney, DIN_CHINA_BRANCH_ID } from './dinChinaFinancialAuditShared.js';

async function loadPartyAccountMap(supabase, companyId) {
  const { data, error } = await supabase
    .from('accounts')
    .select('id, code, linked_contact_id')
    .eq('company_id', companyId)
    .not('linked_contact_id', 'is', null);
  if (error) throw new Error(`party accounts: ${error.message}`);
  const byContact = new Map();
  for (const row of data || []) {
    const cid = String(row.linked_contact_id);
    if (!byContact.has(cid)) {
      byContact.set(cid, { accountId: row.id, code: String(row.code || '').trim() });
    }
  }
  return byContact;
}

async function resolveSaleArDebitAccountId(supabase, companyId, sale, partyAccountId, controlArId) {
  const saleId = sale.id;
  const invoiceNo = sale.invoice_no;
  let { data: jes } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('is_void', false)
    .eq('reference_type', 'sale')
    .eq('reference_id', saleId);

  if (!jes?.length && invoiceNo) {
    const res = await supabase
      .from('journal_entries')
      .select('id')
      .eq('company_id', companyId)
      .eq('is_void', false)
      .eq('reference_type', 'sale')
      .ilike('description', `%${invoiceNo}%`);
    jes = res.data;
  }

  let partyDr = 0;
  let controlDr = 0;
  for (const je of jes || []) {
    const { data: lines } = await supabase
      .from('journal_entry_lines')
      .select('debit, account_id')
      .eq('journal_entry_id', je.id);
    for (const l of lines || []) {
      const d = num(l.debit);
      if (d <= 0) continue;
      if (l.account_id === partyAccountId) partyDr += d;
      else if (l.account_id === controlArId) controlDr += d;
    }
  }

  if (partyDr > 0.01) return { accountId: partyAccountId, partyDr, controlDr };
  if (controlDr > 0.01) return { accountId: controlArId, partyDr, controlDr };
  return { accountId: null, partyDr: 0, controlDr: 0 };
}

async function partyGlNet(supabase, partyAccountId) {
  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select('debit, credit, journal_entries!inner(is_void)')
    .eq('account_id', partyAccountId)
    .eq('journal_entries.is_void', false);
  let dr = 0;
  let cr = 0;
  for (const l of lines || []) {
    dr += num(l.debit);
    cr += num(l.credit);
  }
  return roundMoney(dr - cr);
}

async function customerDueSum(supabase, companyId, customerId) {
  const { data: sales } = await supabase
    .from('sales')
    .select('due_amount, status, cancelled_at, branch_id')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .eq('status', 'final');
  return roundMoney(
    (sales || [])
      .filter((s) => !s.cancelled_at && String(s.branch_id) === DIN_CHINA_BRANCH_ID)
      .reduce((sum, s) => sum + num(s.due_amount), 0),
  );
}

/**
 * @returns {Promise<{
 *   eligibleCount: number,
 *   totalReclassAmount: number,
 *   repairs: Array<{
 *     lineId: string,
 *     paymentRef: string,
 *     invoiceNo: string | null,
 *     customerName: string,
 *     partyAccountCode: string,
 *     amount: number,
 *     fromAccountId: string,
 *     toAccountId: string,
 *     journalEntryNo: string | null,
 *   }>,
 *   customerProjections: Array<{
 *     contactId: string,
 *     customerName: string,
 *     partyAccountCode: string,
 *     glBefore: number,
 *     glAfter: number,
 *     operationalDue: number,
 *     gapBefore: number,
 *     gapAfter: number,
 *   }>,
 *   strategyNote: string,
 * }>}
 */
export async function buildArPaymentPartyReclassPlan(supabase, ctx) {
  const { companyId, accounts } = ctx;
  const controlArId = accounts.ar.account?.id;
  if (!controlArId) {
    return {
      eligibleCount: 0,
      totalReclassAmount: 0,
      repairs: [],
      customerProjections: [],
      strategyNote: 'Control AR 1100 not found — skip party reclass.',
    };
  }

  const partyByContact = await loadPartyAccountMap(supabase, companyId);

  const { data: sales, error: salesErr } = await supabase
    .from('sales')
    .select('id, invoice_no, customer_id, customer_name, branch_id, total')
    .eq('company_id', companyId)
    .eq('status', 'final')
    .eq('branch_id', DIN_CHINA_BRANCH_ID);
  if (salesErr) throw new Error(`sales load: ${salesErr.message}`);

  const saleById = new Map((sales || []).map((s) => [s.id, s]));
  const saleArPosting = new Map();

  for (const sale of sales || []) {
    const party = partyByContact.get(String(sale.customer_id));
    if (!party) continue;
    const posting = await resolveSaleArDebitAccountId(
      supabase,
      companyId,
      sale,
      party.accountId,
      controlArId,
    );
    saleArPosting.set(sale.id, { ...posting, party });
  }

  const { data: payments, error: payErr } = await supabase
    .from('payments')
    .select('id, amount, reference_number, reference_type, reference_id, contact_id')
    .eq('company_id', companyId)
    .eq('reference_type', 'sale')
    .is('voided_at', null);
  if (payErr) throw new Error(`payments load: ${payErr.message}`);

  const repairs = [];
  const reclassByContact = new Map();
  const headroomBySale = new Map();

  async function remainingPartyCreditHeadroom(sale, partyAccountId) {
    if (headroomBySale.has(sale.id)) return headroomBySale.get(sale.id);

    const { data: pays } = await supabase
      .from('payments')
      .select('id, amount')
      .eq('company_id', companyId)
      .eq('reference_type', 'sale')
      .eq('reference_id', sale.id)
      .is('voided_at', null);

    const paymentTotal = roundMoney((pays || []).reduce((s, p) => s + num(p.amount), 0));
    const targetPartyCredit = roundMoney(Math.min(num(sale.total), paymentTotal));

    let partyCredits = 0;
    for (const p of pays || []) {
      const { data: jes } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('company_id', companyId)
        .eq('payment_id', p.id)
        .eq('is_void', false);
      for (const je of jes || []) {
        const { data: lines } = await supabase
          .from('journal_entry_lines')
          .select('credit, account_id')
          .eq('journal_entry_id', je.id);
        for (const line of lines || []) {
          const credit = num(line.credit);
          if (credit <= 0) continue;
          if (line.account_id === partyAccountId) partyCredits += credit;
        }
      }
    }

    const headroom = roundMoney(Math.max(0, targetPartyCredit - partyCredits));
    headroomBySale.set(sale.id, headroom);
    return headroom;
  }

  const sortedPayments = [...(payments || [])].sort((a, b) =>
    String(a.reference_number || '').localeCompare(String(b.reference_number || '')),
  );

  for (const payment of sortedPayments) {
    const sale = saleById.get(payment.reference_id);
    if (!sale) continue;

    const posting = saleArPosting.get(sale.id);
    if (!posting?.accountId || posting.accountId !== posting.party.accountId) continue;

    let headroom = await remainingPartyCreditHeadroom(sale, posting.party.accountId);
    if (headroom <= 0.01) continue;

    const { data: jes } = await supabase
      .from('journal_entries')
      .select('id, entry_no')
      .eq('company_id', companyId)
      .eq('payment_id', payment.id)
      .eq('is_void', false);

    for (const je of jes || []) {
      const { data: lines } = await supabase
        .from('journal_entry_lines')
        .select('id, credit, account_id')
        .eq('journal_entry_id', je.id);
      for (const line of lines || []) {
        const credit = num(line.credit);
        if (credit <= 0.01) continue;
        if (line.account_id !== controlArId) continue;
        if (credit > headroom + 0.01) continue;
        if (headroom <= 0.01) break;

        const move = roundMoney(credit);
        headroom = roundMoney(headroom - move);
        headroomBySale.set(sale.id, headroom);

        repairs.push({
          lineId: line.id,
          paymentRef: payment.reference_number,
          invoiceNo: sale.invoice_no,
          customerName: sale.customer_name || sale.customer_id,
          partyAccountCode: posting.party.code,
          amount: move,
          fromAccountId: controlArId,
          toAccountId: posting.party.accountId,
          journalEntryNo: je.entry_no,
          contactId: String(sale.customer_id),
        });

        const cid = String(sale.customer_id);
        reclassByContact.set(cid, roundMoney((reclassByContact.get(cid) || 0) + move));
      }
    }
  }

  const customerProjections = [];
  const seenContacts = new Set(repairs.map((r) => r.contactId));

  for (const contactId of seenContacts) {
    const party = partyByContact.get(contactId);
    if (!party) continue;
    const glBefore = await partyGlNet(supabase, party.accountId);
    const move = reclassByContact.get(contactId) || 0;
    const glAfter = roundMoney(glBefore - move);
    const operationalDue = await customerDueSum(supabase, companyId, contactId);
    const { data: contact } = await supabase
      .from('contacts')
      .select('name')
      .eq('id', contactId)
      .maybeSingle();

    customerProjections.push({
      contactId,
      customerName: contact?.name || contactId,
      partyAccountCode: party.code,
      glBefore,
      glAfter,
      operationalDue,
      gapBefore: roundMoney(glBefore - operationalDue),
      gapAfter: roundMoney(glAfter - operationalDue),
    });
  }

  customerProjections.sort((a, b) => Math.abs(b.gapBefore) - Math.abs(a.gapBefore));

  const totalReclassAmount = roundMoney(repairs.reduce((s, r) => s + r.amount, 0));

  return {
    eligibleCount: repairs.length,
    totalReclassAmount,
    repairs,
    customerProjections,
    strategyNote:
      'UPDATE journal_entry_lines.account_id from control 1100 to party AR-* when the linked sale document JE debited the party sub-ledger. Matches RAEES LHR repair (2026-06-16).',
  };
}

export async function applyArPaymentPartyReclass(supabase, ctx, plan, options = {}) {
  const { positiveGapOnly = true } = options;
  let repairs = plan.repairs || [];

  if (positiveGapOnly && plan.customerProjections?.length) {
    const safeContacts = new Set(
      plan.customerProjections.filter((c) => c.gapBefore > 0.01).map((c) => c.contactId),
    );
    repairs = repairs.filter((r) => safeContacts.has(r.contactId));
  }

  const results = { updated: 0, skipped: 0, errors: [], rows: [], appliedCount: repairs.length };

  for (const repair of repairs) {
    const { data: line, error: readErr } = await supabase
      .from('journal_entry_lines')
      .select('id, account_id, credit')
      .eq('id', repair.lineId)
      .maybeSingle();

    if (readErr || !line) {
      results.skipped++;
      results.errors.push(`${repair.paymentRef}: line ${repair.lineId} not found`);
      continue;
    }

    if (line.account_id === repair.toAccountId) {
      results.skipped++;
      results.rows.push({ ...repair, status: 'already_correct' });
      continue;
    }

    if (line.account_id !== repair.fromAccountId) {
      results.skipped++;
      results.errors.push(
        `${repair.paymentRef}: line on unexpected account ${line.account_id} (expected ${repair.fromAccountId})`,
      );
      continue;
    }

    const { error: updErr } = await supabase
      .from('journal_entry_lines')
      .update({ account_id: repair.toAccountId })
      .eq('id', repair.lineId);

    if (updErr) {
      results.errors.push(`${repair.paymentRef}: ${updErr.message}`);
      continue;
    }

    results.updated++;
    results.rows.push({ ...repair, status: 'updated' });
  }

  results.ok = results.errors.length === 0;
  return results;
}
