import path from 'node:path';
import { loadAllCsvData } from './dinChinaCsv.js';
import { archivedCsvDir } from './dinChinaPaths.js';

export const DIN_CHINA_BRANCH_ID = '92f4184e-ee9b-4b6c-8e76-10ee1d166f55';
export const DIN_CHINA_BRANCH_CODE = 'BL0002';
export const DIN_CHINA_BRANCH_NAME = 'DIN CHINA';

export function num(v) {
  return Number(v) || 0;
}

export function roundMoney(v) {
  return Math.round(num(v) * 100) / 100;
}

export function withinTolerance(a, b, tol = 0.01) {
  return Math.abs(num(a) - num(b)) <= tol;
}

export function parseLegacyTxnIdFromNotes(notes) {
  const m = String(notes || '').match(/legacy_transaction_id=(\d+)/);
  return m ? Number(m[1]) : null;
}

export function loadAuditCsvBundle() {
  return loadAllCsvData(archivedCsvDir());
}

function findAccountByCode(list, code) {
  const c = String(code).trim();
  const hit = list.find((a) => String(a.code || '').trim() === c);
  return hit || null;
}

function findAccountByNameHints(list, hints) {
  for (const a of list) {
    if (a.is_group === true) continue;
    const n = String(a.name || '').toLowerCase();
    for (const h of hints) {
      if (n.includes(h)) return a;
    }
  }
  return null;
}

export async function loadCompanyAccounts(supabase, companyId) {
  const { data, error } = await supabase
    .from('accounts')
    .select('id, code, name, type, balance, is_group, parent_id')
    .eq('company_id', companyId);
  if (error) throw new Error(`accounts load: ${error.message}`);
  const list = data || [];

  const revenueAcct = findAccountByCode(list, '4100');
  const arAcct = findAccountByCode(list, '1100');
  const invAcct = findAccountByCode(list, '1200');
  const cogsAcct = findAccountByCode(list, '5010');
  const discountAcct = findAccountByCode(list, '5200');
  const apAcct =
    findAccountByCode(list, '2100') ||
    findAccountByNameHints(list, ['accounts payable', 'trade payable']);

  return {
    list,
    revenue: { found: !!revenueAcct, account: revenueAcct },
    ar: { found: !!arAcct, account: arAcct },
    inventory: { found: !!invAcct, account: invAcct },
    cogs: { found: !!cogsAcct, account: cogsAcct },
    discount: { found: !!discountAcct, account: discountAcct },
    ap: { found: !!apAcct, account: apAcct },
  };
}

export async function loadBranchGuard(supabase, companyId) {
  const { data, error } = await supabase
    .from('branches')
    .select('id, code, name, company_id')
    .eq('id', DIN_CHINA_BRANCH_ID)
    .maybeSingle();
  if (error) throw new Error(`branch load: ${error.message}`);
  const issues = [];
  if (!data) issues.push(`Branch ${DIN_CHINA_BRANCH_ID} not found`);
  else if (String(data.company_id) !== String(companyId)) {
    issues.push(`Branch ${DIN_CHINA_BRANCH_ID} belongs to another company`);
  }
  return { ok: issues.length === 0, branch: data, issues };
}

export async function loadLegacyFinalSales(supabase, companyId) {
  const { data, error } = await supabase
    .from('sales')
    .select(
      'id, invoice_no, total, discount_amount, paid_amount, due_amount, status, branch_id, notes, source, cancelled_at',
    )
    .eq('company_id', companyId)
    .eq('status', 'final');
  if (error) throw new Error(`sales load: ${error.message}`);
  return (data || []).filter((s) => {
    if (s.cancelled_at) return false;
    if (String(s.source || '') === 'legacy_din_china') return true;
    return String(s.notes || '').includes('legacy_din_china');
  });
}

export async function sumGlLines(supabase, companyId, accountId, side = 'credit') {
  if (!accountId) return 0;
  const { data: lines, error } = await supabase
    .from('journal_entry_lines')
    .select('debit, credit, journal_entry_id')
    .eq('account_id', accountId);
  if (error) throw new Error(`je lines: ${error.message}`);
  const jeIds = [...new Set((lines || []).map((l) => l.journal_entry_id))];
  if (!jeIds.length) return 0;

  const { data: jes } = await supabase
    .from('journal_entries')
    .select('id, is_void')
    .eq('company_id', companyId)
    .in('id', jeIds);
  const active = new Set(
    (jes || []).filter((j) => j.is_void !== true).map((j) => j.id),
  );

  let sum = 0;
  for (const l of lines || []) {
    if (!active.has(l.journal_entry_id)) continue;
    sum += side === 'credit' ? num(l.credit) : num(l.debit);
  }
  return roundMoney(sum);
}
