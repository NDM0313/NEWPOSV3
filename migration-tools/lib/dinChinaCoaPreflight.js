/** COA preflight for DIN CHINA legacy import — mirrors saleAccountingService account resolution. */

import { supabaseRead } from './supabaseReadRetry.js';

const PARENT_HEADER_CODES = new Set(['1050', '1060', '1070', '4050', '2090', '3090', '6090', '1090']);

export const SALE_JOURNAL_STRATEGY = 'createSaleJournalEntry';

function trimCode(a) {
  return String(a?.code ?? '').trim();
}

function isGroupAccount(a) {
  return a?.is_group === true;
}

function isPostingDetailAccount(a) {
  if (!a) return false;
  if (isGroupAccount(a)) return false;
  if (PARENT_HEADER_CODES.has(trimCode(a))) return false;
  return true;
}

function nameMatchesSalesRevenue(name) {
  const n = String(name || '').toLowerCase();
  return n.includes('sales revenue') || n.includes('sales income');
}

/**
 * Mirror saleAccountingService.ensureRevenueAccount without auto-create.
 */
export function resolveSalesRevenueAccount(accounts) {
  const list = accounts || [];

  const by4100 = list.find((a) => trimCode(a) === '4100' && isPostingDetailAccount(a));
  if (by4100) {
    return {
      found: true,
      account: by4100,
      resolvedBy: 'code_4100',
      postingCode: trimCode(by4100),
      postingName: by4100.name,
    };
  }

  const by4000 = list.find((a) => trimCode(a) === '4000' && isPostingDetailAccount(a));
  if (by4000) {
    return {
      found: true,
      account: by4000,
      resolvedBy: 'code_4000',
      postingCode: trimCode(by4000),
      postingName: by4000.name,
    };
  }

  const bySubtype = list.find(
    (a) =>
      String(a.subtype || '').toLowerCase() === 'sales_revenue' && isPostingDetailAccount(a),
  );
  if (bySubtype) {
    return {
      found: true,
      account: bySubtype,
      resolvedBy: 'subtype_sales_revenue',
      postingCode: trimCode(bySubtype),
      postingName: bySubtype.name,
    };
  }

  const byName = list.find(
    (a) => nameMatchesSalesRevenue(a.name) && isPostingDetailAccount(a),
  );
  if (byName) {
    return {
      found: true,
      account: byName,
      resolvedBy: 'name_sales_revenue',
      postingCode: trimCode(byName),
      postingName: byName.name,
    };
  }

  return {
    found: false,
    account: null,
    resolvedBy: null,
    postingCode: null,
    postingName: null,
  };
}

export function resolveArAccount(accounts) {
  const list = accounts || [];

  const by1100 = list.find((a) => trimCode(a) === '1100' && isPostingDetailAccount(a));
  if (by1100) {
    return { found: true, account: by1100, resolvedBy: 'code_1100' };
  }

  const bySubtype = list.find(
    (a) =>
      String(a.subtype || '').toLowerCase() === 'accounts_receivable' &&
      isPostingDetailAccount(a),
  );
  if (bySubtype) {
    return { found: true, account: bySubtype, resolvedBy: 'subtype_accounts_receivable' };
  }

  const byType = list.find(
    (a) => String(a.type || '').toLowerCase() === 'receivable' && isPostingDetailAccount(a),
  );
  if (byType) {
    return { found: true, account: byType, resolvedBy: 'type_receivable' };
  }

  return { found: false, account: null, resolvedBy: null };
}

/**
 * record_sale RPC uses _ensure_system_account(..., '4000', ...) which INSERTs 4000 if missing.
 */
export function checkRecordSaleRpc4000Risk(accounts, saleJournalStrategy) {
  const list = accounts || [];
  const has4000 = list.some((a) => trimCode(a) === '4000');
  const has4100 = list.some((a) => trimCode(a) === '4100');

  if (has4100 && !has4000) {
    const risk = {
      blocker: true,
      reason:
        'record_sale RPC _ensure_system_account(4000) would auto-create duplicate code 4000 while Sales Revenue 4100 exists',
      has4100,
      has4000,
    };
    if (saleJournalStrategy === SALE_JOURNAL_STRATEGY) {
      return {
        ...risk,
        blocker: false,
        mitigated: true,
        mitigation: `Import uses ${SALE_JOURNAL_STRATEGY} (ensureRevenueAccount name/code fallback), not record_sale RPC`,
      };
    }
    return risk;
  }

  return { blocker: false, has4100, has4000, reason: null };
}

export function validatePaymentAccountTargets(accountPlan, dbAccounts) {
  const dbById = new Map((dbAccounts || []).map((a) => [a.id, a]));
  const issues = [];
  const validated = [];

  for (const row of accountPlan) {
    if (row.action === 'missing_config') {
      issues.push(`Legacy account ${row.legacyAccountId}: missing config mapping`);
      validated.push({ ...row, valid: false, isGroup: null });
      continue;
    }

    if (row.action === 'blocked_parent') {
      issues.push(
        `Legacy account ${row.legacyAccountId}: matched parent/group account ${row.code} ${row.name} — not valid for payments`,
      );
      validated.push({ ...row, valid: false, isGroup: true });
      continue;
    }

    if (row.action === 'create') {
      if (PARENT_HEADER_CODES.has(String(row.code || '').trim())) {
        issues.push(
          `Legacy account ${row.legacyAccountId}: planned create uses parent header code ${row.code}`,
        );
        validated.push({ ...row, valid: false, isGroup: true });
        continue;
      }
      validated.push({
        legacyAccountId: row.legacyAccountId,
        action: row.action,
        newAccountId: row.newAccountId,
        code: row.code,
        name: row.name,
        type: row.type,
        isGroup: false,
        valid: true,
      });
      continue;
    }

    if (row.action === 'reuse') {
      const db = dbById.get(row.newAccountId);
      const code = db ? trimCode(db) : row.code;
      const group = db ? isGroupAccount(db) : false;
      const parentHeader = PARENT_HEADER_CODES.has(code);
      if (group || parentHeader) {
        issues.push(
          `Legacy account ${row.legacyAccountId}: reuse target ${code} ${row.name} is parent/group — payments must use detail accounts`,
        );
        validated.push({
          legacyAccountId: row.legacyAccountId,
          action: row.action,
          newAccountId: row.newAccountId,
          code,
          name: row.name,
          isGroup: true,
          valid: false,
        });
        continue;
      }
      validated.push({
        legacyAccountId: row.legacyAccountId,
        action: row.action,
        newAccountId: row.newAccountId,
        code,
        name: row.name,
        type: row.type,
        isGroup: false,
        valid: true,
      });
    }
  }

  return { valid: issues.length === 0, issues, paymentAccounts: validated };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function runCoaPreflight(supabase, companyId, accountPlan, options = {}) {
  const saleJournalStrategy = options.saleJournalStrategy ?? SALE_JOURNAL_STRATEGY;

  const { data: accounts, error } = await supabaseRead('accounts_coa_preflight', () =>
    supabase
      .from('accounts')
      .select('id, company_id, code, name, type, subtype, is_group, parent_id, is_active')
      .eq('company_id', companyId));

  if (error) {
    return {
      ok: false,
      error: error.message,
      revenueAccountFound: false,
      blockingIssues: [`Account load failed: ${error.message}`],
    };
  }

  const list = accounts || [];
  const revenue = resolveSalesRevenueAccount(list);
  const ar = resolveArAccount(list);
  const rpcRisk = checkRecordSaleRpc4000Risk(list, saleJournalStrategy);
  const paymentValidation = validatePaymentAccountTargets(accountPlan, list);

  const blockingIssues = [];
  const warnings = [];

  if (!revenue.found) {
    blockingIssues.push(
      'No detail Sales Revenue account found (expected code 4100 or name "Sales Revenue"; parent 4050 is not for posting)',
    );
  }

  if (!ar.found) {
    blockingIssues.push('No Accounts Receivable account found (expected code 1100 or subtype accounts_receivable)');
  }

  if (rpcRisk.blocker) {
    blockingIssues.push(rpcRisk.reason);
  } else if (rpcRisk.mitigated) {
    warnings.push(rpcRisk.mitigation);
  }

  if (!paymentValidation.valid) {
    blockingIssues.push(...paymentValidation.issues);
  }

  const revenue4050 = list.find((a) => trimCode(a) === '4050');
  if (revenue4050?.is_group) {
    warnings.push('Revenue 4050 confirmed as parent/group — posting will use detail child 4100, not 4050');
  }

  return {
    ok: blockingIssues.length === 0,
    revenueAccountFound: revenue.found,
    revenuePostingAccount: revenue.found
      ? { id: revenue.account.id, code: revenue.postingCode, name: revenue.postingName }
      : null,
    revenueResolvedBy: revenue.resolvedBy,
    arAccount: ar.found ? { id: ar.account.id, code: trimCode(ar.account), name: ar.account.name } : null,
    arResolvedBy: ar.resolvedBy,
    saleJournalStrategy,
    rpc4000AutoCreateRisk: rpcRisk,
    paymentAccounts: paymentValidation.paymentAccounts,
    paymentAccountsValid: paymentValidation.valid,
    parentHeaderCodesExcluded: [...PARENT_HEADER_CODES],
    blockingIssues,
    warnings,
    accountCount: list.length,
  };
}
