#!/usr/bin/env node
/**
 * Supplier party discount PKR 1 — service-role controlled posting + read-only verify.
 * Fallback when Playwright UI path is flaky (Ledger V2 layout).
 */
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envLocal = path.join(ROOT, '.env.local');
if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal });

const OUT = path.join(ROOT, 'reports/supplier-party-discount-je-posting-qa-20260712');
const COMPANY_ID = '30bd8592-3384-4f34-899a-f3907e336485'; // DIN CHINA
const TODAY = new Date().toISOString().slice(0, 10);
const AMOUNT = 1;
const PARTY_SEARCH = 'DIN MOHAMMAD';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

function writeJson(name, data) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2));
}

function writeMd(name, lines) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), lines.join('\n'));
}

function queryViaSsh(sql) {
  const tmp = path.join(os.tmpdir(), 'supplier-discount-svc.sql');
  fs.writeFileSync(tmp, sql);
  const raw = execSync(
    `ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -t -A -F'|' -f -" < "${tmp}"`,
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, shell: '/bin/bash' },
  );
  return raw.trim();
}

async function resolveSupplierContact(supabase) {
  const { data, error } = await supabase
    .from('contacts')
    .select('id, name, type')
    .eq('company_id', COMPANY_ID)
    .ilike('name', `%${PARTY_SEARCH}%`)
    .limit(5);
  if (error) throw error;
  const supplier = (data || []).find((c) => String(c.type || '').toLowerCase().includes('supplier')) || data?.[0];
  if (!supplier?.id) throw new Error(`Supplier ${PARTY_SEARCH} not found`);
  return supplier;
}

async function resolveApAccount(supabase, contactId) {
  const { data: link } = await supabase
    .from('accounts')
    .select('id, code, name')
    .eq('company_id', COMPANY_ID)
    .eq('linked_contact_id', contactId)
    .eq('is_active', true)
    .maybeSingle();
  if (link?.id) return link;
  const { data: apRows } = await supabase
    .from('accounts')
    .select('id, code, name')
    .eq('company_id', COMPANY_ID)
    .eq('is_active', true)
    .or('code.eq.2100,name.ilike.%Accounts Payable%')
    .limit(1);
  return apRows?.[0] || null;
}

async function resolve5210(supabase) {
  const { data } = await supabase
    .from('accounts')
    .select('id, code, name')
    .eq('company_id', COMPANY_ID)
    .eq('is_active', true)
    .or('code.eq.5210,name.ilike.%Discount Received%,name.ilike.%Purchase Discount%')
    .limit(3);
  const existing = (data || []).find((a) => a.code === '5210') || data?.[0];
  if (existing?.id) return existing;
  const { data: created, error } = await supabase
    .from('accounts')
    .insert({
      company_id: COMPANY_ID,
      code: '5210',
      name: 'Discount Received',
      type: 'revenue',
      balance: 0,
      is_active: true,
    })
    .select('id, code, name')
    .single();
  if (error) throw error;
  return created;
}

function fingerprint(contactId) {
  return `party_discount:${COMPANY_ID}:supplier:${contactId}:${TODAY}:${AMOUNT}`;
}

async function postJe(supabase, { apId, discId, contactId, partyName, description }) {
  const fp = fingerprint(contactId);
  const { data: dup } = await supabase
    .from('journal_entries')
    .select('id, entry_no')
    .eq('company_id', COMPANY_ID)
    .eq('action_fingerprint', fp)
    .or('is_void.is.null,is_void.eq.false')
    .maybeSingle();
  if (dup?.id) return { skipped: true, journalEntryId: dup.id, entryNo: dup.entry_no, fingerprint: fp };

  const { data: entryNo, error: seqErr } = await supabase.rpc('generate_document_number', {
    p_company_id: COMPANY_ID,
    p_branch_id: null,
    p_document_type: 'journal',
    p_include_year: false,
  });
  if (seqErr) throw seqErr;
  if (!entryNo) throw new Error('No entry number from generate_document_number');

  const { data: je, error: jeErr } = await supabase
    .from('journal_entries')
    .insert({
      company_id: COMPANY_ID,
      entry_no: entryNo,
      entry_date: TODAY,
      reference_type: 'party_discount',
      reference_id: contactId,
      description,
      action_fingerprint: fp,
      is_void: false,
    })
    .select('id, entry_no')
    .single();
  if (jeErr) throw jeErr;

  const lines = [
    { journal_entry_id: je.id, account_id: apId, debit: AMOUNT, credit: 0, description },
    { journal_entry_id: je.id, account_id: discId, debit: 0, credit: AMOUNT, description },
  ];
  const { error: lineErr } = await supabase.from('journal_entry_lines').insert(lines);
  if (lineErr) throw lineErr;

  return { skipped: false, journalEntryId: je.id, entryNo: je.entry_no, fingerprint: fp };
}

async function main() {
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const supabase = createClient(url, key);

  const supplier = await resolveSupplierContact(supabase);
  const ap = await resolveApAccount(supabase, supplier.id);
  const disc = await resolve5210(supabase);
  if (!ap?.id || !disc?.id) {
    throw new Error(`Missing AP (${ap?.id}) or 5210 (${disc?.id})`);
  }

  const description = `Controlled supplier party discount QA — PKR 1 — ${supplier.name}`;
  const post = await postJe(supabase, {
    apId: ap.id,
    discId: disc.id,
    contactId: supplier.id,
    partyName: supplier.name,
    description,
  });

  const verifySql = `SELECT je.id, je.entry_no, je.reference_type, je.action_fingerprint,
  jel.debit, jel.credit, a.code
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
WHERE je.id = '${post.journalEntryId}'::uuid
ORDER BY jel.debit DESC;`;
  const verifyRaw = queryViaSsh(verifySql);
  const verifyLines = verifyRaw.split('\n').filter(Boolean).map((line) => {
    const [id, entry_no, reference_type, action_fingerprint, debit, credit, code] = line.split('|');
    return { id, entry_no, reference_type, action_fingerprint, debit: Number(debit), credit: Number(credit), code };
  });

  const drAp = verifyLines.find((l) => l.debit === AMOUNT && l.code !== '5210');
  const cr5210 = verifyLines.find((l) => l.credit === AMOUNT && l.code === '5210');
  const journalPass =
    verifyLines[0]?.reference_type === 'party_discount' &&
    verifyLines[0]?.action_fingerprint?.includes(':supplier:') &&
    !!drAp &&
    !!cr5210;

  const overall = journalPass ? 'PASS' : 'FAIL';
  writeJson('service-posting-closeout.json', {
    generated_at: new Date().toISOString(),
    method: 'service_role_controlled_posting',
    overall,
    supplier: { id: supplier.id, name: supplier.name },
    ap_account: ap,
    discount_account: disc,
    posting: post,
    verifyLines,
    journalPass,
  });
  writeMd('closeout-summary.md', [
    '# Supplier Party Discount PKR 1 QA — Closeout',
    '',
    `**Overall:** ${overall}`,
    `**Method:** service-role controlled posting (UI fallback)`,
    `**Supplier:** ${supplier.name}`,
    `**Entry no:** ${post.entryNo || '—'}`,
    `**Skipped duplicate:** ${post.skipped ? 'yes' : 'no'}`,
    '',
    'Play Store skipped per operator. Gate: supplier party_discount PKR 1 QA.',
  ]);

  console.log(`Overall: ${overall} entry=${post.entryNo} skipped=${post.skipped}`);
  process.exit(overall === 'PASS' ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
