/**
 * MM User Branch Access Deep Fix (self-hosted Supabase via REST + service role).
 * Target:
 * - company: 375fa03b-8e1e-46d3-9cfe-1cc20c02b473
 * - user: mm@yahoo.com
 */
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const COMPANY_ID = '375fa03b-8e1e-46d3-9cfe-1cc20c02b473';
const USER_EMAIL = 'mm@yahoo.com';

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      const hashIdx = val.indexOf('#');
      if (hashIdx > 0 && !val.startsWith('"')) val = val.slice(0, hashIdx).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

function api(method, endpoint, body, extraHeaders = {}) {
  const base = String(process.env.VITE_SUPABASE_URL || '').trim().replace(/[\r\n]/g, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim().replace(/[\r\n]/g, '');
  if (!base || !key) throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  const url = new URL(`${base}/rest/v1/${endpoint}`);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method,
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: method === 'POST' ? 'return=representation' : 'return=minimal',
          ...extraHeaders,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            return reject(new Error(`HTTP ${res.statusCode}: ${data || 'request failed'}`));
          }
          try {
            resolve(data ? JSON.parse(data) : []);
          } catch {
            resolve([]);
          }
        });
      }
    );
    req.on('error', reject);
    if (body != null) req.write(JSON.stringify(body));
    req.end();
  });
}

const q = (obj) =>
  Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

async function run() {
  loadEnv();

  const [company] = await api(
    'GET',
    `companies?${q({ select: 'id,name,email', id: `eq.${COMPANY_ID}`, limit: '1' })}`
  );
  if (!company) throw new Error(`Company not found: ${COMPANY_ID}`);

  const [user] = await api(
    'GET',
    `users?${q({
      select: 'id,auth_user_id,email,role,is_active,company_id',
      company_id: `eq.${COMPANY_ID}`,
      email: `ilike.${USER_EMAIL}`,
      limit: '1',
    })}`
  );
  if (!user) throw new Error(`User not found in company: ${USER_EMAIL}`);

  const branches = await api(
    'GET',
    `branches?${q({
      select: 'id,name,code,is_active,created_at',
      company_id: `eq.${COMPANY_ID}`,
      is_active: 'eq.true',
      order: 'created_at.asc',
    })}`
  );
  const activeBranchIds = new Set((branches || []).map((b) => b.id));

  const userIdsForFetch = [user.id];
  if (user.auth_user_id) userIdsForFetch.push(user.auth_user_id);
  const rows = await api(
    'GET',
    `user_branches?${q({
      select: 'user_id,branch_id',
      user_id: `in.(${userIdsForFetch.join(',')})`,
    })}`
  );

  const publicIdRows = rows.filter((r) => r.user_id === user.id);
  const authIdRows = user.auth_user_id ? rows.filter((r) => r.user_id === user.auth_user_id) : [];

  if (!user.auth_user_id) {
    console.log('[WARN] users.auth_user_id is null. Auth linkage cannot be auto-repaired via REST.');
  } else {
    // Migrate accidental rows saved under public.users.id.
    for (const r of publicIdRows) {
      try {
        await api('POST', 'user_branches', [{ user_id: user.auth_user_id, branch_id: r.branch_id }], { Prefer: 'resolution=merge-duplicates,return=minimal' });
      } catch (e) {
        const msg = String(e?.message || e);
        if (!msg.includes('23505')) throw e;
      }
    }
    if (publicIdRows.length > 0) {
      for (const r of publicIdRows) {
        await api('DELETE', `user_branches?${q({ user_id: `eq.${user.id}`, branch_id: `eq.${r.branch_id}` })}`);
      }
    }

    // Remove invalid branch assignments.
    const mergedRows = await api(
      'GET',
      `user_branches?${q({ select: 'user_id,branch_id', user_id: `eq.${user.auth_user_id}` })}`
    );
    for (const r of mergedRows) {
      if (!activeBranchIds.has(r.branch_id)) {
        await api('DELETE', `user_branches?${q({ user_id: `eq.${user.auth_user_id}`, branch_id: `eq.${r.branch_id}` })}`);
      }
    }

    // Multi-branch fallback: ensure at least one explicit assignment exists.
    const afterRows = await api(
      'GET',
      `user_branches?${q({ select: 'branch_id', user_id: `eq.${user.auth_user_id}` })}`
    );
    if (branches.length > 1 && afterRows.length === 0 && branches[0]) {
      try {
        await api('POST', 'user_branches', [{ user_id: user.auth_user_id, branch_id: branches[0].id }], { Prefer: 'resolution=merge-duplicates,return=minimal' });
      } catch (e) {
        const msg = String(e?.message || e);
        if (!msg.includes('23505')) throw e;
      }
    }
  }

  const finalRows = user.auth_user_id
    ? await api('GET', `user_branches?${q({ select: 'branch_id', user_id: `eq.${user.auth_user_id}` })}`)
    : [];

  console.log('--- MM BRANCH FIX REPORT ---');
  console.log('Company:', company.name, company.id);
  console.log('User:', user.email, `role=${user.role}`, `active=${user.is_active}`);
  console.log('auth_user_id:', user.auth_user_id || '(missing)');
  console.log('Active company branches:', branches.length);
  console.log('Assigned branches (auth user):', finalRows.length);
  console.log('Branch IDs:', finalRows.map((r) => r.branch_id).join(', ') || '(none)');
}

run().catch((e) => {
  console.error('[MM BRANCH FIX] failed:', e?.message || e);
  process.exit(1);
});
