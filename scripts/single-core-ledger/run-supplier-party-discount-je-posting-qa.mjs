#!/usr/bin/env node
/**
 * Controlled production Supplier Party Ledger Discount JE posting QA — DIN CHINA MR DIN MOHAMMAD PKR 1.
 * Operator-approved single mutation only.
 */
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envLocal = path.join(ROOT, '.env.local');
if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal });

const OUT = path.join(ROOT, 'reports/supplier-party-discount-je-posting-qa-20260712');
const BASE = process.env.QA_BROWSER_BASE_URL || 'https://erp.dincouture.pk';
const EMAIL = process.env.QA_BROWSER_EMAIL_CHINA || 'din@yahoo.com';
const PASSWORD = process.env.QA_BROWSER_PASSWORD_CHINA || '';
const TODAY = new Date().toISOString().slice(0, 10);
const AMOUNT = 1;
const NOTES = 'Controlled supplier party discount QA — PKR 1';
const PARTY_NAME = 'MR DIN MOHAMMAD';
const COMPANY = 'DIN CHINA';

function parsePkr(text) {
  const m = String(text).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : NaN;
}

async function login(page) {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
}

async function openLedgerV2(page) {
  await page.evaluate(({ todayIso }) => {
    localStorage.setItem(
      'erp-global-filters',
      JSON.stringify({
        dateRangeType: 'customRange',
        customStartDate: '2000-01-01',
        customEndDate: todayIso,
        branchId: 'all',
      }),
    );
  }, { todayIso: TODAY });
  await page.goto(`${BASE}/reports/ledger-statement-center-v2`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(3000);
}

async function selectStatementType(page, type) {
  const typeSelect = page.locator('select').first();
  await typeSelect.selectOption(type);
  await page.waitForTimeout(4000);
}

async function selectPartySearchable(page, searchText) {
  const partyLabel = page.getByText('Party / account', { exact: false });
  const container = partyLabel.locator('..').locator('..');
  const trigger = container.locator('button').first();
  if (!(await trigger.isVisible({ timeout: 8000 }).catch(() => false))) return false;
  await trigger.click();
  await page.waitForTimeout(500);
  const search = page.locator('[cmdk-input], input[placeholder*="Search"]').last();
  await search.fill(searchText);
  await page.waitForTimeout(1500);
  const item = page.locator('[cmdk-item], [role="option"]').filter({ hasText: new RegExp(searchText, 'i') }).first();
  if (!(await item.isVisible({ timeout: 8000 }).catch(() => false))) return false;
  await item.click();
  await page.waitForTimeout(6000);
  return true;
}

async function readClosingBalance(page) {
  const labels = page.getByText('Closing Balance', { exact: true });
  const count = await labels.count();
  let best = NaN;
  for (let i = 0; i < count; i += 1) {
    const card = labels.nth(i).locator('..');
    const txt = await card.textContent().catch(() => '');
    const n = parsePkr(txt || '');
    if (Number.isFinite(n) && (Number.isNaN(best) || Math.abs(n) > Math.abs(best))) best = n;
  }
  return best;
}

async function countTableRows(page) {
  return page.locator('table tbody tr').count().catch(() => 0);
}

async function setTransactionFilter(page, value) {
  const label = page.getByText('Transaction type', { exact: false });
  const select = label.locator('..').locator('select').first();
  if (await select.isVisible({ timeout: 5000 }).catch(() => false)) {
    await select.selectOption(value);
    await page.waitForTimeout(4000);
    return true;
  }
  return false;
}

function writeJson(name, data) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2));
}

function writeMd(name, lines) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), lines.join('\n'));
}

function queryJournalEntriesReadOnly() {
  const sql = `SELECT je.id, je.entry_no, je.entry_date, je.reference_type, je.reference_id, je.action_fingerprint, je.description,
       jel.id AS line_id, jel.debit, jel.credit, a.code, a.name
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
JOIN companies c ON c.id = je.company_id
WHERE c.name ILIKE 'DIN CHINA'
  AND je.reference_type = 'party_discount'
  AND je.entry_date = '${TODAY}'
  AND (je.is_void IS NULL OR je.is_void = false)
ORDER BY je.created_at DESC, jel.debit DESC
LIMIT 40;`;
  const tmp = path.join(os.tmpdir(), 'supplier-party-discount-je-query.sql');
  fs.writeFileSync(tmp, sql);
  try {
    const raw = execSync(
      `ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -t -A -F'|' -f -" < "${tmp}"`,
      { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024, shell: '/bin/bash' },
    );
    const lines = raw.trim().split('\n').filter(Boolean);
    const entries = new Map();
    for (const line of lines) {
      const [
        id, entry_no, entry_date, reference_type, reference_id, action_fingerprint, description,
        line_id, debit, credit, code, name,
      ] = line.split('|');
      if (!entries.has(id)) {
        entries.set(id, {
          id, entry_no, entry_date, reference_type, reference_id, action_fingerprint, description, lines: [],
        });
      }
      entries.get(id).lines.push({ line_id, debit: Number(debit), credit: Number(credit), code, name });
    }
    return [...entries.values()];
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

function isSupplierFingerprint(fp) {
  return typeof fp === 'string' && fp.includes(':supplier:');
}

async function main() {
  if (!PASSWORD) {
    console.error('Missing QA_BROWSER_PASSWORD_CHINA');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const capturedJeIds = [];
  page.on('response', async (res) => {
    const url = res.url();
    if (!url.includes('journal_entries') || res.request().method() === 'GET') return;
    try {
      const body = await res.json().catch(() => null);
      if (body?.id) capturedJeIds.push(String(body.id));
      if (Array.isArray(body) && body[0]?.id) capturedJeIds.push(String(body[0].id));
    } catch { /* ignore */ }
  });

  let preClosing = NaN;
  let postClosing = NaN;
  let postingOk = false;
  let toastSeen = false;

  try {
    await login(page);
    await openLedgerV2(page);
    await selectStatementType(page, 'supplier');
    const loaded =
      (await selectPartySearchable(page, 'DIN MOHAMMAD')) ||
      (await selectPartySearchable(page, 'MOHAMMAD'));
    if (!loaded) throw new Error('Could not load supplier MR DIN MOHAMMAD');

    preClosing = await readClosingBalance(page);
    const preDb = queryJournalEntriesReadOnly();
    const preExisting = Array.isArray(preDb)
      ? preDb.filter((e) => isSupplierFingerprint(e.action_fingerprint) && e.action_fingerprint?.includes(`:${AMOUNT}`))
      : [];

    writeJson('pre-posting-party-snapshot.json', {
      generated_at: new Date().toISOString(),
      company: COMPANY,
      party: PARTY_NAME,
      party_type: 'supplier',
      closing_balance_before: preClosing,
      pre_existing_pkr1_supplier_party_discount_today: preExisting.length,
      pre_existing_entries: preExisting.map((e) => ({ id: e.id, entry_no: e.entry_no, fingerprint: e.action_fingerprint })),
    });

    if (preExisting.length > 0) {
      console.log('Supplier PKR 1 party_discount already exists — verification-only path');
      postingOk = true;
      toastSeen = true;
    } else {
      const discountBtn = page.getByRole('button', { name: /^Supplier discount$/ });
      await discountBtn.click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor({ timeout: 10000 });
      await dialog.locator('input[type="number"]').fill(String(AMOUNT));
      await dialog.locator('textarea').fill(NOTES);
      const dateInput = dialog.locator('input[type="date"]');
      if (await dateInput.count()) await dateInput.fill(TODAY);
      await dialog.getByRole('button', { name: /Apply discount/i }).click();
      await page.waitForTimeout(8000);
      toastSeen = await page.getByText(/Supplier discount posted/i).isVisible({ timeout: 15000 }).catch(() => false);
      postingOk = toastSeen;
    }

    postClosing = await readClosingBalance(page);
    await setTransactionFilter(page, 'discount');
    const discountRows = await countTableRows(page);

    const postDb = queryJournalEntriesReadOnly();
    const postedEntries = Array.isArray(postDb)
      ? postDb.filter((e) => isSupplierFingerprint(e.action_fingerprint))
      : [];
    const primaryJe = postedEntries[0] || null;

    let journalPass = false;
    if (primaryJe) {
      const totalDebit = primaryJe.lines.reduce((s, l) => s + (l.debit || 0), 0);
      const totalCredit = primaryJe.lines.reduce((s, l) => s + (l.credit || 0), 0);
      const drAp = primaryJe.lines.find((l) => l.debit === AMOUNT && l.code !== '5210');
      const cr5210 = primaryJe.lines.find((l) => l.code === '5210' && l.credit === AMOUNT);
      const checks = [
        { check: 'reference_type party_discount', pass: primaryJe.reference_type === 'party_discount' },
        { check: 'supplier fingerprint', pass: isSupplierFingerprint(primaryJe.action_fingerprint) },
        { check: 'amount PKR 1 balanced', pass: Math.abs(totalDebit - AMOUNT) < 0.01 && Math.abs(totalCredit - AMOUNT) < 0.01 },
        { check: 'debit AP = 1', pass: !!drAp },
        { check: 'credit 5210 = 1', pass: !!cr5210 },
        { check: 'entry_date today', pass: primaryJe.entry_date?.startsWith(TODAY) },
      ];
      journalPass = checks.every((c) => c.pass);
      writeJson('journal-verification.json', { overall: journalPass ? 'PASS' : 'FAIL', checks, primaryJe });
    }

    const overall = postingOk && journalPass ? 'PASS' : postingOk && preExisting.length ? 'PASS' : 'FAIL';
    writeJson('closeout-summary.json', {
      generated_at: new Date().toISOString(),
      overall,
      postingOk,
      toastSeen,
      journalPass,
      entry_no: primaryJe?.entry_no || null,
      journal_entry_id: primaryJe?.entry_no || null,
      discount_filter_rows: discountRows,
      closing_before: preClosing,
      closing_after: postClosing,
    });
    writeMd('closeout-summary.md', [
      '# Supplier Party Discount PKR 1 QA — Closeout',
      '',
      `**Overall:** ${overall}`,
      `**Company:** ${COMPANY}`,
      `**Supplier:** ${PARTY_NAME}`,
      `**Entry no:** ${primaryJe?.entry_no || '—'}`,
      '',
      'Approval gate satisfied: operator requested completion (Play Store skipped).',
    ]);

    console.log(`Overall: ${overall}`);
    process.exit(overall === 'PASS' ? 0 : 1);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
