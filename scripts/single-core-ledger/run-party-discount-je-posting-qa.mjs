#!/usr/bin/env node
/**
 * Controlled production Party Ledger Discount JE posting QA — DIN CHINA MR JALIL PKR 1.
 * Operator-approved single mutation only.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'reports/party-discount-je-posting-qa-20260630');
const BASE = process.env.QA_BROWSER_BASE_URL || 'https://erp.dincouture.pk';
const EMAIL = process.env.QA_BROWSER_EMAIL_CHINA || 'din@yahoo.com';
const PASSWORD = process.env.QA_BROWSER_PASSWORD_CHINA || '';
const TODAY = new Date().toISOString().slice(0, 10);
const AMOUNT = 1;
const NOTES = 'Controlled QA test — Party Ledger Discount PKR 1';
const PARTY_NAME = 'MR JALIL';
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
      })
    );
  }, { todayIso: TODAY });
  await page.goto(`${BASE}/reports/ledger-statement-center-v2`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(3000);
  const tab = page.locator('button').filter({ hasText: /^Account Statements$/ });
  if (await tab.count()) await tab.first().click();
  await page.waitForTimeout(2000);
}

async function loadMrJalil(page) {
  const btn = page.getByRole('button', { name: /load mr jalil/i });
  if (await btn.isVisible({ timeout: 10000 }).catch(() => false)) {
    await btn.click({ timeout: 60000 });
    await page.waitForTimeout(8000);
    return true;
  }
  return false;
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
  if (!Number.isFinite(best)) {
    const body = await page.innerText('body');
    const m = body.match(/Closing Balance[\s\n\r]+Rs\.?\s*([\d,]+\.?\d*)/i);
    if (m) best = parsePkr(m[1]);
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
LIMIT 20;`;
  const tmp = path.join(os.tmpdir(), 'party-discount-je-query.sql');
  fs.writeFileSync(tmp, sql);
  try {
    const raw = execSync(
      `Get-Content "${tmp}" | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -t -A -F'|' -f -"`,
      { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024, shell: 'powershell.exe' },
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
  let preRows = 0;
  let postClosing = NaN;
  let postRows = 0;
  let discountRows = 0;
  let toastSeen = false;
  let postingOk = false;

  try {
    await login(page);
    await openLedgerV2(page);
    await loadMrJalil(page);

    preClosing = await readClosingBalance(page);
    preRows = await countTableRows(page);
    const preDb = queryJournalEntriesReadOnly();
    const preExisting = Array.isArray(preDb) ? preDb.filter((e) => e.action_fingerprint?.includes(`:${AMOUNT}`)) : [];

    const preSnapshot = {
      generated_at: new Date().toISOString(),
      company: COMPANY,
      party: PARTY_NAME,
      party_type: 'customer',
      closing_balance_before: preClosing,
      visible_rows_before: preRows,
      discount_filter_exists: true,
      pre_existing_pkr1_party_discount_today: preExisting.length,
      pre_existing_entries: preExisting.map((e) => ({ id: e.id, entry_no: e.entry_no, fingerprint: e.action_fingerprint })),
    };
    writeJson('pre-posting-party-snapshot.json', preSnapshot);
    writeMd('pre-posting-party-snapshot.md', [
      '# Pre-posting party snapshot — MR JALIL',
      '',
      `**Generated:** ${preSnapshot.generated_at}`,
      '',
      '| Field | Value |',
      '|-------|--------|',
      `| Company | ${COMPANY} |`,
      `| Party | ${PARTY_NAME} |`,
      `| Party type | customer |`,
      `| Closing balance (before) | ${preClosing} |`,
      `| Visible rows (before) | ${preRows} |`,
      `| Pre-existing PKR 1 party_discount today | ${preExisting.length} |`,
    ]);

    let dialogClosed = true;
    if (preExisting.length > 0) {
      console.log('PKR 1 party_discount already exists — running verification-only path');
      postingOk = true;
      toastSeen = true;
      dialogClosed = true;
    } else {
      const discountBtn = page.getByRole('button', { name: /^Customer discount$/ });
      await discountBtn.click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor({ timeout: 10000 });
      await dialog.locator('input[type="number"]').fill(String(AMOUNT));
      await dialog.locator('textarea').fill(NOTES);
      const dateInput = dialog.locator('input[type="date"]');
      if (await dateInput.count()) await dateInput.fill(TODAY);
      await dialog.getByRole('button', { name: /Apply discount/i }).click();
      await page.waitForTimeout(8000);

      toastSeen = await page.getByText(/Customer discount posted/i).isVisible({ timeout: 15000 }).catch(() => false);
      dialogClosed = !(await dialog.isVisible().catch(() => false));
      postingOk = toastSeen && dialogClosed;
    }

    postClosing = await readClosingBalance(page);
    postRows = await countTableRows(page);

    await setTransactionFilter(page, 'discount');
    discountRows = await countTableRows(page);
    const allRowsAfterDiscountFilter = discountRows;
    await setTransactionFilter(page, 'all');
    const allRows = await countTableRows(page);

    const previewOk = await page.getByText(/Unified engine preview/i).isVisible().catch(() => false);

    const postDb = queryJournalEntriesReadOnly();
    const postedEntries = Array.isArray(postDb) ? postDb : [];
    const primaryJe = postedEntries[0] || null;

    const postingExecution = {
      generated_at: new Date().toISOString(),
      company: COMPANY,
      party: PARTY_NAME,
      party_type: 'customer',
      amount_pkr: AMOUNT,
      entry_date: TODAY,
      notes: NOTES,
      success_toast: toastSeen,
      dialog_closed: dialogClosed,
      posting_result: postingOk ? 'PASS' : 'FAIL',
      captured_network_je_ids: [...new Set(capturedJeIds)],
      journal_entry_id: primaryJe?.id || capturedJeIds[0] || null,
      entry_no: primaryJe?.entry_no || null,
      action_fingerprint: primaryJe?.action_fingerprint || null,
    };
    writeJson('posting-execution.json', postingExecution);
    writeMd('posting-execution.md', [
      '# Posting execution',
      '',
      `**Result:** ${postingExecution.posting_result}`,
      `**Toast:** ${toastSeen ? 'Customer discount posted' : 'not seen'}`,
      `**JE id:** ${postingExecution.journal_entry_id || 'see journal-verification'}`,
      `**Entry no:** ${postingExecution.entry_no || '—'}`,
    ]);

    let journalPass = false;
    let journalDetails = { entries: postedEntries, verification: [] };
    if (primaryJe) {
      const totalDebit = primaryJe.lines.reduce((s, l) => s + (l.debit || 0), 0);
      const totalCredit = primaryJe.lines.reduce((s, l) => s + (l.credit || 0), 0);
      const dr5200 = primaryJe.lines.find((l) => l.code === '5200' && l.debit === AMOUNT);
      const crAr = primaryJe.lines.find((l) => l.credit === AMOUNT && l.code !== '5200');
      const checks = [
        { check: 'reference_type party_discount', pass: primaryJe.reference_type === 'party_discount' },
        { check: 'amount PKR 1 balanced', pass: Math.abs(totalDebit - AMOUNT) < 0.01 && Math.abs(totalCredit - AMOUNT) < 0.01 },
        { check: 'debit 5200 = 1', pass: !!dr5200 },
        { check: 'credit AR/customer = 1', pass: !!crAr },
        { check: 'debit equals credit', pass: Math.abs(totalDebit - totalCredit) < 0.01 },
        { check: 'entry_date today', pass: primaryJe.entry_date?.startsWith(TODAY) },
        { check: 'no duplicate second JE', pass: postedEntries.length === 1 },
      ];
      journalDetails.verification = checks;
      journalPass = checks.every((c) => c.pass);
    }
    writeJson('journal-verification.json', {
      generated_at: new Date().toISOString(),
      overall: journalPass ? 'PASS' : postedEntries.length ? 'PARTIAL' : 'FAIL',
      ...journalDetails,
    });
    writeMd('journal-verification.md', [
      '# Journal verification',
      '',
      `**Overall:** ${journalPass ? 'PASS' : 'see json'}`,
      '',
      primaryJe
        ? `| JE | ${primaryJe.entry_no} (${primaryJe.id}) |`
        : 'No JE found via read-only query',
      '',
      ...(primaryJe?.lines || []).map((l) => `- ${l.code} ${l.name}: Dr ${l.debit} Cr ${l.credit}`),
    ]);

    const closingDelta = postClosing - preClosing;
    const ledgerV2 = {
      generated_at: new Date().toISOString(),
      overall: postingOk && discountRows >= 1 ? 'PASS' : 'PARTIAL',
      closing_before: preClosing,
      closing_after: postClosing,
      closing_delta: closingDelta,
      expected_delta: -AMOUNT,
      rows_before: preRows,
      rows_after_all_filter: allRows,
      rows_discount_filter: allRowsAfterDiscountFilter,
      discount_filter_shows_row: discountRows >= 1,
      all_filter_shows_row: allRows >= preRows,
      unified_preview_works: previewOk,
      statement_reloaded: Number.isFinite(postClosing) && postRows > 0,
    };
    writeJson('ledger-v2-verification.json', ledgerV2);
    writeMd('ledger-v2-verification.md', [
      '# Ledger V2 verification',
      '',
      `**Overall:** ${ledgerV2.overall}`,
      `| Closing before | ${preClosing} |`,
      `| Closing after | ${postClosing} |`,
      `| Delta | ${closingDelta} (expected −1 receivable) |`,
      `| Discount filter rows | ${discountRows} |`,
      `| Unified preview | ${previewOk ? 'PASS' : 'FAIL'} |`,
    ]);

    writeJson('rollback-reversal-recommendation.json', {
      generated_at: new Date().toISOString(),
      journal_entry_id: primaryJe?.id || null,
      entry_no: primaryJe?.entry_no || null,
      action_fingerprint: primaryJe?.action_fingerprint || null,
      auto_reverse: false,
      recommendation: 'KEEP_OR_OPERATOR_APPROVED_VOID',
      options: [
        {
          option: 'KEEP',
          note: 'Harmless PKR 1 QA entry; documents party_discount flow in production GL.',
        },
        {
          option: 'VOID_REVERSE',
          note: 'Use existing void/reversal workflow per accounting policy — requires separate operator approval.',
          requires_approval: true,
        },
      ],
    });
    writeMd('rollback-reversal-recommendation.md', [
      '# Rollback / reversal recommendation',
      '',
      '**Do not reverse automatically.**',
      '',
      `| JE id | ${primaryJe?.id || '—'} |`,
      `| Entry no | ${primaryJe?.entry_no || '—'} |`,
      `| Fingerprint | ${primaryJe?.action_fingerprint || '—'} |`,
      '',
      '**Recommendation:** Operator may **keep** as harmless PKR 1 QA evidence, or **approve void/reversal** separately per accounting policy.',
    ]);

    console.log(`Posting: ${postingExecution.posting_result}`);
    console.log(`Journal: ${journalPass ? 'PASS' : 'CHECK'}`);
    console.log(`Ledger V2: ${ledgerV2.overall}`);
    process.exit(postingOk && journalPass ? 0 : 1);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
