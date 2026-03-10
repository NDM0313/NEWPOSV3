/**
 * Ensures ERP Chart of Accounts (2000, 4000, 5000, 2010) for all companies.
 * Calls Supabase RPC ensure_erp_accounts_all_companies() (SECURITY DEFINER).
 * Run after migrations so the RPC exists. Usage: node scripts/ensure-accounting-accounts.js
 * Env: .env.local — VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (or SUPABASE_URL, SUPABASE_ANON_KEY).
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEnvLocal() {
  const envPath = path.join(root, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/\\"/g, '"');
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1).replace(/\\'/g, "'");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('[ensure-accounting] No VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY in .env.local — skip.');
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('ensure_erp_accounts_all_companies');
  if (error) {
    console.error('[ensure-accounting] RPC error:', error.message);
    process.exit(1);
  }
  const result = data;
  if (result && result.ok) {
    console.log('[ensure-accounting] OK. Companies processed:', result.companies_processed ?? 0);
  } else {
    console.error('[ensure-accounting] RPC returned:', result?.error ?? result);
    process.exit(1);
  }
}

run();
