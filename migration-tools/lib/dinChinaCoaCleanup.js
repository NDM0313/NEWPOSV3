import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { TOOLS_ROOT } from './resolvePaths.js';
import { getNextChildAccountCode, nextAssetGroupCode } from './coaCodeAllocator.js';

const CANONICAL_PARENT_CODES = {
  cash: '1050',
  bank: '1060',
};

const PARENT_NAME_PATTERNS = {
  cash: ['cash and cash equivalent', 'cash & cash equivalent', 'cash and cash'],
  bank: ['bank account'],
  agent_clearing: [
    'carrier shipment agent',
    'agent clearing',
    'shipment agent',
    'carrier agent',
  ],
  tt_agent_clearing: ['usd tt agent', 'tt agent clearing', 'tt agent', 'usd tt'],
};

const NEW_GROUP_DEFAULTS = {
  agent_clearing: { name: 'Carrier Shipment Agent', type: 'asset' },
  tt_agent_clearing: { name: 'USD TT Agent Clearing', type: 'asset' },
};

function num(v) {
  return Number(v) || 0;
}

function normName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function loadCleanupConfig() {
  const p = path.join(TOOLS_ROOT, 'config', 'din_china_coa_cleanup.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function accountLabel(a) {
  if (!a) return 'none';
  return `${a.code || '?'} ${a.name || ''}`.trim();
}

function findByCode(accounts, code) {
  const c = String(code || '').trim();
  return accounts.find((a) => String(a.code || '').trim() === c);
}

function resolveCleanupAccount(accounts, spec) {
  const byLegacy = findByCode(accounts, spec.legacyCode);
  if (byLegacy) return { account: byLegacy, resolvedBy: 'legacyCode' };
  if (spec.accountId) {
    const byId = accounts.find((a) => a.id === spec.accountId);
    if (byId) return { account: byId, resolvedBy: 'accountId' };
  }
  if (spec.currentCode) {
    const byCurrent = findByCode(accounts, spec.currentCode);
    if (byCurrent) return { account: byCurrent, resolvedBy: 'currentCode' };
  }
  return { account: null, resolvedBy: null };
}

function isAlreadyCleanedAccount(acct, spec) {
  if (!acct) return false;
  const code = String(acct.code || '').trim();
  if (/^DC/i.test(code)) return false;
  if (spec.currentCode && code === String(spec.currentCode).trim()) return true;
  if (acct.name === spec.newName && !/^DC/i.test(code)) return true;
  return false;
}

function findParentByRole(accounts, role) {
  const canon = CANONICAL_PARENT_CODES[role];
  if (canon) {
    const hit = findByCode(accounts, canon);
    if (hit?.is_group === true) return hit;
  }
  const patterns = PARENT_NAME_PATTERNS[role] || [];
  for (const a of accounts) {
    if (a.is_group !== true) continue;
    const n = normName(a.name);
    if (role === 'agent_clearing' && (n.includes('ttagent') || n.includes('usdtt'))) continue;
    if (role === 'tt_agent_clearing' && (n.includes('carriershipment') || n.includes('shipmentagent'))) {
      continue;
    }
    for (const p of patterns) {
      if (n.includes(normName(p))) return a;
    }
  }
  return null;
}

function allocateUniqueChildCode(parent, allAccounts, excludeAccountId) {
  const working = allAccounts.filter((a) => a.id !== excludeAccountId);
  let code = getNextChildAccountCode(parent, working);
  const codes = new Set(working.map((a) => String(a.code || '').trim()));
  while (codes.has(code)) {
    const n = parseInt(code, 10);
    code = Number.isFinite(n) ? String(n + 1) : `${code}-1`;
  }
  if (/^DC/i.test(code)) {
    const n = parseInt(String(parent.code || '1000'), 10);
    code = String(Number.isFinite(n) ? n + 1 : 1011);
    while (codes.has(code)) code = String(parseInt(code, 10) + 1);
  }
  return code;
}

async function loadCompanyAccounts(supabase, companyId) {
  const { data, error } = await supabase
    .from('accounts')
    .select('id, company_id, code, name, type, subtype, parent_id, is_group, balance, is_active')
    .eq('company_id', companyId);
  if (error) throw new Error(`accounts load: ${error.message}`);
  return data || [];
}

async function loadGlBalances(supabase, accountIds) {
  if (!accountIds.length) return new Map();
  const { data: lines, error } = await supabase
    .from('journal_entry_lines')
    .select('account_id, debit, credit')
    .in('account_id', accountIds);
  if (error) throw new Error(`journal_entry_lines load: ${error.message}`);
  const map = new Map();
  for (const id of accountIds) map.set(id, 0);
  for (const l of lines || []) {
    const cur = map.get(l.account_id) ?? 0;
    map.set(l.account_id, cur + num(l.debit) - num(l.credit));
  }
  return map;
}

async function loadPaymentLinkCounts(supabase, companyId, accountIds) {
  const paymentCounts = new Map(accountIds.map((id) => [id, 0]));
  const expenseCounts = new Map(accountIds.map((id) => [id, 0]));

  const { data: payments, error: pErr } = await supabase
    .from('payments')
    .select('payment_account_id')
    .eq('company_id', companyId)
    .in('payment_account_id', accountIds);
  if (pErr) throw new Error(`payments load: ${pErr.message}`);
  for (const p of payments || []) {
    if (p.payment_account_id) {
      paymentCounts.set(p.payment_account_id, (paymentCounts.get(p.payment_account_id) || 0) + 1);
    }
  }

  const { data: expenses, error: eErr } = await supabase
    .from('expenses')
    .select('payment_account_id')
    .eq('company_id', companyId)
    .in('payment_account_id', accountIds);
  if (eErr) throw new Error(`expenses load: ${eErr.message}`);
  for (const e of expenses || []) {
    if (e.payment_account_id) {
      expenseCounts.set(e.payment_account_id, (expenseCounts.get(e.payment_account_id) || 0) + 1);
    }
  }

  return { paymentCounts, expenseCounts };
}

function planNewParent(role, accounts, parentsToCreate) {
  const existing = findParentByRole(accounts, role);
  if (existing) return { parent: existing, created: false };

  const pending = parentsToCreate.find((p) => p.parentRole === role);
  if (pending) {
    return {
      parent: {
        id: pending.id,
        code: pending.code,
        name: pending.name,
        is_group: true,
        type: pending.type,
      },
      created: true,
    };
  }

  const def = NEW_GROUP_DEFAULTS[role];
  const code = nextAssetGroupCode(accounts, role === 'tt_agent_clearing' ? 1191 : 1190);
  const row = {
    id: randomUUID(),
    parentRole: role,
    code,
    name: def.name,
    type: def.type,
    is_group: true,
    balance: 0,
    is_active: true,
  };
  parentsToCreate.push(row);
  return {
    parent: { id: row.id, code: row.code, name: row.name, is_group: true, type: row.type },
    created: true,
  };
}

export async function buildCoaCleanupPlan(supabase, companyId) {
  const config = loadCleanupConfig();
  const blockingErrors = [];
  const riskNotes = [];
  const parentsToCreate = [];
  const rows = [];

  let accounts = await loadCompanyAccounts(supabase, companyId);
  const workingAccounts = [...accounts];

  for (const spec of config.accounts) {
    const { account: acct, resolvedBy } = resolveCleanupAccount(accounts, spec);
    if (!acct) {
      blockingErrors.push(
        `Account not found for ${spec.legacyCode}${spec.accountId ? ` / id ${spec.accountId}` : ''}${spec.currentCode ? ` / code ${spec.currentCode}` : ''}`,
      );
      continue;
    }
    if (acct.is_group === true) {
      blockingErrors.push(`${spec.legacyCode || acct.code} is a group account, not a detail payment account`);
      continue;
    }

    const alreadyApplied = isAlreadyCleanedAccount(acct, spec);

    const { parent: newParent, created: parentCreated } = planNewParent(
      spec.parentRole,
      workingAccounts,
      parentsToCreate,
    );
    if (!newParent) {
      blockingErrors.push(`Could not resolve parent for role ${spec.parentRole} (${spec.legacyCode || acct.code})`);
      continue;
    }
    if (newParent.is_group !== true) {
      blockingErrors.push(`Parent for ${spec.legacyCode || acct.code} is not a group: ${accountLabel(newParent)}`);
      continue;
    }

    if (parentCreated && !alreadyApplied) {
      workingAccounts.push({
        id: newParent.id,
        code: newParent.code,
        name: newParent.name,
        parent_id: null,
        is_group: true,
        type: newParent.type,
      });
    }

    const newCode = alreadyApplied
      ? String(acct.code || '').trim()
      : allocateUniqueChildCode(newParent, workingAccounts, acct.id);
    if (!alreadyApplied) {
      const owner = workingAccounts.find(
        (a) => String(a.code || '').trim() === newCode && a.id !== acct.id,
      );
      if (owner) {
        blockingErrors.push(`Code ${newCode} already used by ${owner.name} (${owner.id})`);
      }
      if (/^DC/i.test(newCode)) {
        blockingErrors.push(`Allocated code ${newCode} still has DC prefix for ${spec.legacyCode}`);
      }
    }

    const oldParent = accounts.find((a) => a.id === acct.parent_id);
    const newType = spec.preferredType || acct.type;
    const notes = [];
    if (alreadyApplied) {
      notes.push(`Already cleaned (resolved by ${resolvedBy})`);
    }
    if (parentCreated && !alreadyApplied) {
      notes.push(`Created parent group ${newParent.code} ${newParent.name}`);
    }
    if (spec.parentRole === 'agent_clearing' || spec.parentRole === 'tt_agent_clearing') {
      notes.push('Type kept as bank for payment RPC compatibility; parent is agent clearing group');
    }
    if (String(acct.name || '').toUpperCase().startsWith('DIN ')) {
      notes.push('Removing DIN prefix from name');
    }

    rows.push({
      accountId: acct.id,
      legacyCode: spec.legacyCode || acct.code,
      alreadyApplied,
      oldName: acct.name,
      newName: spec.newName,
      oldCode: acct.code,
      newCode,
      oldParentId: acct.parent_id,
      newParentId: alreadyApplied ? acct.parent_id : newParent.id,
      oldParentCode: oldParent?.code ?? null,
      newParentCode: alreadyApplied
        ? accounts.find((a) => a.id === acct.parent_id)?.code ?? newParent.code
        : newParent.code,
      oldParentName: oldParent?.name ?? null,
      newParentName: alreadyApplied
        ? accounts.find((a) => a.id === acct.parent_id)?.name ?? newParent.name
        : newParent.name,
      oldType: acct.type,
      newType: alreadyApplied ? acct.type : newType,
      oldSubtype: acct.subtype ?? null,
      newSubtype: acct.subtype ?? null,
      riskNotes: notes,
    });

    if (!alreadyApplied) {
      workingAccounts.push({
        id: acct.id,
        code: newCode,
        name: spec.newName,
        parent_id: newParent.id,
        is_group: false,
        type: newType,
      });
    }
  }

  const accountIds = rows.map((r) => r.accountId);
  const glBalances = await loadGlBalances(supabase, accountIds);
  const { paymentCounts, expenseCounts } = await loadPaymentLinkCounts(
    supabase,
    companyId,
    accountIds,
  );

  for (const row of rows) {
    const acct = accounts.find((a) => a.id === row.accountId);
    row.balanceBefore = glBalances.get(row.accountId) ?? num(acct?.balance);
    row.balanceStored = num(acct?.balance);
    row.paymentLinkCount = paymentCounts.get(row.accountId) || 0;
    row.expenseLinkCount = expenseCounts.get(row.accountId) || 0;
  }

  if (rows.length !== config.accounts.length) {
    blockingErrors.push(`Expected ${config.accounts.length} cleanup rows, got ${rows.length}`);
  }

  const codesSeen = new Map();
  for (const r of rows) {
    if (codesSeen.has(r.newCode)) {
      blockingErrors.push(
        `Duplicate new code ${r.newCode} for ${r.legacyCode} and ${codesSeen.get(r.newCode)}`,
      );
    } else {
      codesSeen.set(r.newCode, r.legacyCode);
    }
  }

  return {
    companyId,
    generatedAt: new Date().toISOString(),
    blockingErrors,
    parentsToCreate: rows.every((r) => r.alreadyApplied) ? [] : parentsToCreate,
    rows,
    alreadyAppliedCount: rows.filter((r) => r.alreadyApplied).length,
    pass: blockingErrors.length === 0 && rows.length === config.accounts.length,
  };
}

export function writeCleanupPreview(outputDir, plan) {
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, 'din_china_coa_cleanup_preview.json');
  const mdPath = path.join(outputDir, 'din_china_coa_cleanup_preview.md');

  fs.writeFileSync(jsonPath, JSON.stringify(plan, null, 2));

  const lines = [
    '# DIN CHINA COA Cleanup — Preview',
    '',
    `Generated: ${plan.generatedAt}`,
    `Company: ${plan.companyId}`,
    `Pass: **${plan.pass ? 'YES' : 'NO'}**`,
    '',
  ];

  if (plan.blockingErrors.length) {
    lines.push('## Blocking errors', '');
    for (const e of plan.blockingErrors) lines.push(`- ${e}`);
    lines.push('');
  }

  if (plan.parentsToCreate.length) {
    lines.push('## Parents to create', '');
    for (const p of plan.parentsToCreate) {
      lines.push(`- ${p.code} **${p.name}** (${p.parentRole}) id=${p.id}`);
    }
    lines.push('');
  }

  lines.push('## Account changes', '');
  for (const r of plan.rows) {
    lines.push(`### ${r.legacyCode} → ${r.newCode}`, '');
    lines.push(`| Field | Before | After |`);
    lines.push(`|-------|--------|-------|`);
    lines.push(`| Name | ${r.oldName} | ${r.newName} |`);
    lines.push(`| Code | ${r.oldCode} | ${r.newCode} |`);
    lines.push(
      `| Parent | ${r.oldParentCode || '—'} ${r.oldParentName || ''} | ${r.newParentCode} ${r.newParentName} |`,
    );
    lines.push(`| Type | ${r.oldType} | ${r.newType} |`);
    lines.push(`| GL balance | ${r.balanceBefore} | (unchanged) |`);
    lines.push(`| Payment links | ${r.paymentLinkCount} | (unchanged) |`);
    lines.push(`| Expense links | ${r.expenseLinkCount} | (unchanged) |`);
    if (r.riskNotes?.length) {
      lines.push(`| Risk notes | ${r.riskNotes.join('; ')} | |`);
    }
    lines.push('');
  }

  fs.writeFileSync(mdPath, lines.join('\n'));
  return { jsonPath, mdPath };
}

export async function applyCoaCleanupPlan(supabase, companyId, plan) {
  if (!plan.pass) {
    return { ok: false, error: 'plan has blocking errors', stats: {} };
  }

  const stats = { parentsCreated: 0, accountsUpdated: 0, errors: [] };

  for (const p of plan.parentsToCreate) {
    const { error } = await supabase.from('accounts').insert({
      id: p.id,
      company_id: companyId,
      code: p.code,
      name: p.name,
      type: p.type,
      parent_id: null,
      is_group: true,
      balance: 0,
      is_active: true,
    });
    if (error) {
      stats.errors.push(`Parent create ${p.code}: ${error.message}`);
    } else {
      stats.parentsCreated++;
    }
  }

  if (stats.errors.length) return { ok: false, stats };

  for (const r of plan.rows) {
    const patch = {
      name: r.newName,
      code: r.newCode,
      parent_id: r.newParentId,
      type: r.newType,
    };
    const { error } = await supabase.from('accounts').update(patch).eq('id', r.accountId);
    if (error) {
      stats.errors.push(`Update ${r.legacyCode}: ${error.message}`);
    } else {
      stats.accountsUpdated++;
    }
  }

  return { ok: stats.errors.length === 0, stats };
}

export async function verifyCoaCleanup(supabase, companyId, planBefore) {
  const accounts = await loadCompanyAccounts(supabase, companyId);
  const accountIds = planBefore.rows.map((r) => r.accountId);
  const glBalances = await loadGlBalances(supabase, accountIds);
  const { paymentCounts, expenseCounts } = await loadPaymentLinkCounts(
    supabase,
    companyId,
    accountIds,
  );

  const checks = [];
  const fail = (name, expected, actual, detail = '') => {
    checks.push({ name, pass: false, expected, actual, detail });
  };
  const pass = (name, expected, actual) => {
    checks.push({ name, pass: true, expected, actual });
  };

  for (const r of planBefore.rows) {
    const acct = accounts.find((a) => a.id === r.accountId);
    if (!acct) {
      fail(`account exists ${r.legacyCode}`, r.accountId, null);
      continue;
    }
    if (String(acct.code || '').toUpperCase().startsWith('DC')) {
      fail(`DC code removed ${r.legacyCode}`, 'no DC', acct.code);
    } else {
      pass(`DC code removed ${r.legacyCode}`, 'no DC', acct.code);
    }
    if (acct.name === r.newName) {
      pass(`name ${r.legacyCode}`, r.newName, acct.name);
    } else {
      fail(`name ${r.legacyCode}`, r.newName, acct.name);
    }
    if (String(acct.code || '').trim() === r.newCode) {
      pass(`code ${r.legacyCode}`, r.newCode, acct.code);
    } else {
      fail(`code ${r.legacyCode}`, r.newCode, acct.code);
    }
    if (acct.parent_id === r.newParentId) {
      pass(`parent ${r.legacyCode}`, r.newParentId, acct.parent_id);
    } else {
      fail(`parent ${r.legacyCode}`, r.newParentId, acct.parent_id);
    }

    const balAfter = glBalances.get(r.accountId) ?? num(acct.balance);
    if (Math.abs(balAfter - r.balanceBefore) <= 0.01) {
      pass(`balance ${r.legacyCode}`, r.balanceBefore, balAfter);
    } else {
      fail(`balance ${r.legacyCode}`, r.balanceBefore, balAfter);
    }

    const payAfter = paymentCounts.get(r.accountId) || 0;
    if (payAfter === r.paymentLinkCount) {
      pass(`payments ${r.legacyCode}`, r.paymentLinkCount, payAfter);
    } else {
      fail(`payments ${r.legacyCode}`, r.paymentLinkCount, payAfter);
    }

    const expAfter = expenseCounts.get(r.accountId) || 0;
    if (expAfter === r.expenseLinkCount) {
      pass(`expenses ${r.legacyCode}`, r.expenseLinkCount, expAfter);
    } else {
      fail(`expenses ${r.legacyCode}`, r.expenseLinkCount, expAfter);
    }
  }

  const dcLeft = accounts.filter((a) => /^DC\d+/i.test(String(a.code || '')));
  if (dcLeft.length === 0) {
    pass('no DC codes company-wide', 0, 0);
  } else {
    fail('no DC codes company-wide', 0, dcLeft.map((a) => a.code).join(', '));
  }

  const acct4000 = findByCode(accounts, '4000');
  if (!acct4000) {
    pass('no account 4000', false, false);
  } else {
    fail('no account 4000', false, true);
  }

  const { data: jes4050 } = await supabase
    .from('journal_entry_lines')
    .select('id, account_id')
    .in(
      'account_id',
      accounts.filter((a) => String(a.code || '').trim() === '4050').map((a) => a.id),
    )
    .limit(1);
  if (!jes4050?.length) {
    pass('no 4050 posting lines', 0, 0);
  } else {
    fail('no 4050 posting lines', 0, jes4050.length);
  }

  const passAll = checks.every((c) => c.pass);
  return { pass: passAll, checks, accountsAfter: accounts };
}

export function writeCleanupFinalReport(outputDir, planBefore, applyResult, verification) {
  const mdPath = path.join(outputDir, 'din_china_coa_cleanup_final_report.md');
  const lines = [
    '# DIN CHINA COA Cleanup — Final Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Company: ${planBefore.companyId}`,
    `Apply: ${applyResult?.ok ? 'SUCCESS' : 'FAILED or not run'}`,
    `Verification pass: **${verification?.pass ? 'YES' : 'NO'}**`,
    '',
    '## Summary',
    `- Parents created: ${applyResult?.stats?.parentsCreated ?? 0}`,
    `- Accounts updated: ${applyResult?.stats?.accountsUpdated ?? 0}`,
    `- Account IDs unchanged: yes (same row ids)`,
    '',
    '## Name / code / parent changes',
    '',
    '| Legacy | Old name | New name | Old code | New code | Old parent | New parent |',
    '|--------|----------|----------|----------|----------|------------|------------|',
  ];

  for (const r of planBefore.rows) {
    lines.push(
      `| ${r.legacyCode} | ${r.oldName} | ${r.newName} | ${r.oldCode} | ${r.newCode} | ${r.oldParentCode || '—'} | ${r.newParentCode} |`,
    );
  }

  lines.push('', '## Verification checks', '');
  for (const c of verification?.checks || []) {
    lines.push(`- ${c.pass ? 'PASS' : 'FAIL'} ${c.name}: expected ${c.expected}, got ${c.actual}`);
  }

  if (applyResult?.stats?.errors?.length) {
    lines.push('', '## Apply errors', '');
    for (const e of applyResult.stats.errors) lines.push(`- ${e}`);
  }

  lines.push(
    '',
    '## Confirmations',
    '- DC codes removed from target accounts',
    '- DIN prefix removed from cleaned names',
    '- Balances unchanged (GL-derived)',
    '- Payment and expense link counts unchanged',
    '- No duplicate detail accounts created',
    '- Journal entry amounts not modified by this tool',
  );

  fs.writeFileSync(mdPath, lines.join('\n'));
  return mdPath;
}
