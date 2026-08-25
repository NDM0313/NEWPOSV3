/**
 * Direct Postgres RPC calls for VPS clone validation (no Supabase HTTP API).
 */
import pg from 'pg';
import { pgClientOptions } from './staging-env-guard.mjs';

export async function withPgClient(connectionString, fn) {
  const client = new pg.Client(pgClientOptions(connectionString));
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function pgRpcJson(client, sql, params = []) {
  const { rows } = await client.query(sql, params);
  return rows[0]?.data ?? rows[0]?.payload ?? null;
}

export async function fetchCompaniesPg(client, pilotIds) {
  const { rows } = await client.query(
    `SELECT id, name FROM companies WHERE COALESCE(is_active, true) = true ORDER BY name`
  );
  const list = rows || [];
  if (pilotIds?.length) return list.filter((c) => pilotIds.includes(c.id));
  return list;
}

export async function fetchBranchesPg(client, companyId) {
  const { rows } = await client.query(
    `SELECT id, name, code FROM branches WHERE company_id = $1 AND COALESCE(is_active, true) = true ORDER BY code`,
    [companyId]
  );
  return rows || [];
}

export async function fetchContactsForPatternsPg(client, companyId, patterns) {
  const out = [];
  for (const p of patterns || []) {
    let rows;
    if (p.code) {
      ({ rows } = await client.query(
        `SELECT id, name, code, type FROM contacts WHERE company_id = $1 AND code = $2 LIMIT 3`,
        [companyId, p.code]
      ));
    } else if (p.namePattern) {
      ({ rows } = await client.query(
        `SELECT id, name, code, type FROM contacts WHERE company_id = $1 AND name ILIKE $2 LIMIT 3`,
        [companyId, `%${p.namePattern}%`]
      ));
    } else continue;
    for (const c of rows || []) {
      out.push({
        contactId: c.id,
        contactName: c.name,
        contactCode: c.code,
        partyType: p.partyType || (c.type === 'supplier' ? 'supplier' : 'customer'),
        patternLabel: p.label,
      });
    }
  }
  return out;
}

export async function legacyGlBalancePg(client, companyId, partyType, contactId, branchId) {
  const rpcName =
    partyType === 'customer'
      ? 'get_customer_ar_gl_ledger_for_contact'
      : partyType === 'supplier'
        ? 'get_supplier_ap_gl_ledger_for_contact'
        : 'get_worker_party_gl_ledger_for_contact';
  const paramName = partyType === 'worker' ? 'p_worker_id' : partyType === 'supplier' ? 'p_supplier_id' : 'p_customer_id';
  try {
    const data = await pgRpcJson(
      client,
      `SELECT public.${rpcName}($1::uuid, $2::uuid, $3::uuid, NULL::date, NULL::date) AS data`,
      [companyId, contactId, branchId]
    );
    const rows = Array.isArray(data) ? data : data?.rows || [];
    const balance =
      rows.length > 0
        ? Math.round((Number(rows[rows.length - 1].running_balance ?? rows[rows.length - 1].balance) || 0) * 100) / 100
        : 0;
    return { balance, rowCount: rows.length };
  } catch (e) {
    return { error: e.message, balance: 0, rowCount: 0 };
  }
}

export async function unifiedBalancePg(client, companyId, partyType, contactId, branchId, basis) {
  try {
    const data = await pgRpcJson(
      client,
      `SELECT public.get_unified_party_ledger($1::uuid, $2::text, $3::uuid, $4::uuid, NULL::date, NULL::date, $5::text) AS data`,
      [companyId, partyType, contactId, branchId, basis]
    );
    const rows = data?.rows || [];
    const balance =
      rows.length > 0
        ? Math.round((Number(rows[rows.length - 1].running_balance) || 0) * 100) / 100
        : Math.round((Number(data?.period_opening_balance) || 0) * 100) / 100;
    return { balance, rowCount: Number(data?.row_count) || rows.length };
  } catch (e) {
    return { error: e.message, balance: 0, rowCount: 0 };
  }
}

export async function pilotRpcChecksPg(client, companyId, branchId) {
  const tb = await pgRpcJson(
    client,
    `SELECT public.get_unified_trial_balance($1::uuid, $2::uuid, NULL::date, $3::text) AS data`,
    [companyId, branchId, 'official_gl']
  );
  const cash = await pgRpcJson(
    client,
    `SELECT public.get_unified_cash_bank_ledger($1::uuid, $2::uuid, NULL::date, NULL::date, $3::text, $4::text) AS data`,
    [companyId, branchId, 'official_gl', 'all']
  );
  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  return {
    trial_balance: tb
      ? {
          total_debit: round2(tb.total_debit),
          total_credit: round2(tb.total_credit),
          difference: round2(tb.difference),
          account_count: Number(tb.account_count) || 0,
          balanced: Math.abs(Number(tb.difference) || 0) <= 0.01,
        }
      : { error: 'no data' },
    cash_bank: cash
      ? {
          row_count: Number(cash.row_count) || 0,
          liquidity_account_count: Number(cash.liquidity_account_count) || 0,
          period_opening_balance: round2(cash.period_opening_balance),
        }
      : { error: 'no data' },
  };
}
