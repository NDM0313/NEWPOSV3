/**
 * Shared Playwright helpers for unified ledger production QA (Phase 2.16).
 * Parsing only — no business logic changes.
 */

export const MR_JALIL_GOLDEN = 216_299;
export const TB_GOLDEN = 332_721_352.77;
export const ROZNAMCHA_GOLDEN = {
  cashIn: 59_762_230,
  cashOut: 60_225_317,
  closing: -463_087,
};
export const DEFAULT_TOL = 0.01;

/** Parse first numeric token from PKR display text (handles Rs., commas, negatives). */
export function parsePkr(text) {
  const raw = String(text ?? '').replace(/\u00a0/g, ' ').replace(/,/g, '');
  const m = raw.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : NaN;
}

/**
 * Read a stat card value by exact label (Ledger V2 / Admin Compare summary cards).
 * Scoped to `.rounded-lg.border` cards — avoids body-wide regex false positives.
 */
export async function readStatCardValue(root, label) {
  const cards = root
    .locator('div.rounded-lg.border')
    .filter({ has: root.getByText(label, { exact: true }) });
  const count = await cards.count().catch(() => 0);
  let best = NaN;
  for (let i = 0; i < count; i += 1) {
    const card = cards.nth(i);
    if (!(await card.isVisible({ timeout: 2000 }).catch(() => false))) continue;
    const valueText = await card
      .locator('.text-lg.font-mono, .text-lg.font-semibold, .text-base.font-semibold, .tabular-nums')
      .first()
      .textContent({ timeout: 5000 })
      .catch(() => null);
    const n = parsePkr(valueText || '');
    if (Number.isFinite(n) && (Number.isNaN(best) || Math.abs(n) > Math.abs(best))) best = n;
  }
  return best;
}

const CLOSING_LABELS = ['Closing balance', 'Closing Balance', 'Current Receivable'];

/** Read closing from stat cards, trying multiple label variants + body fallback. */
export async function readClosingBalance(page, options = {}) {
  const labels = options.labels ?? CLOSING_LABELS;
  for (const label of labels) {
    const v = await readStatCardValue(page, label);
    if (Number.isFinite(v)) return v;
  }
  const body = await page.innerText('body');
  for (const label of labels) {
    const re = new RegExp(`${label.replace(/\s+/g, '[\\s\\n\\r]+')}[\\s\\n\\r]+(?:Rs\\.?\\s*)?([\\d,]+\\.?\\d*)`, 'i');
    const m = body.match(re);
    if (m) {
      const n = parsePkr(m[1]);
      if (Number.isFinite(n)) return n;
    }
  }
  return NaN;
}

/** Ledger V2 uses lowercase "Closing balance" on summary cards. */
export async function readLedgerV2MrJalilClosing(page) {
  await page.getByText('Closing balance', { exact: true }).first().waitFor({ timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(1500);
  let closing = await readStatCardValue(page, 'Closing balance');
  if (!Number.isFinite(closing)) closing = await readClosingBalance(page, { labels: ['Closing balance'] });
  return closing;
}

/** Wait until pilot batch run finishes (Compared=9 and Pass+Fail settled). */
export async function waitForPilotBatchStats(page, expectedCompared = 9) {
  await page.waitForFunction(
    (expected) => {
      const labels = [...document.querySelectorAll('.text-xs.text-gray-500')];
      const comparedLabel = labels.find((el) => el.textContent?.trim() === 'Compared');
      const passLabel = labels.find((el) => el.textContent?.trim() === 'Pass');
      const failLabel = labels.find((el) => el.textContent?.trim() === 'Fail');
      if (!comparedLabel || !passLabel || !failLabel) return false;
      const compared = Number(String(comparedLabel.parentElement?.querySelector('.text-lg.font-mono')?.textContent || '').replace(/,/g, ''));
      const passCount = Number(String(passLabel.parentElement?.querySelector('.text-lg.font-mono')?.textContent || '').replace(/,/g, ''));
      const failCount = Number(String(failLabel.parentElement?.querySelector('.text-lg.font-mono')?.textContent || '').replace(/,/g, ''));
      return Number.isFinite(compared) && compared >= expected
        && Number.isFinite(passCount) && Number.isFinite(failCount)
        && passCount + failCount >= expected;
    },
    expectedCompared,
    { timeout: 300000 },
  ).catch(() => {});
  await page.waitForTimeout(1000);
}

/** Read pilot batch Compared / Pass / Fail from stat cards (not body regex). */
export async function readPilotBatchSummary(page) {
  const compared = await readStatCardValue(page, 'Compared');
  const passCount = await readStatCardValue(page, 'Pass');
  const failCount = await readStatCardValue(page, 'Fail');
  return { compared, passCount, failCount };
}

export function withinTol(actual, expected, tol = DEFAULT_TOL) {
  return Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
}

/** Wait until Trial Balance footer totals are rendered with numeric values. */
export async function waitForTrialBalanceTotals(page, timeout = 180000) {
  await page.waitForFunction(() => {
    const t = document.body.innerText;
    return /Total Debit:\s*(?:Rs\.?\s*)?[\d,]+/i.test(t) && /Total Credit:\s*(?:Rs\.?\s*)?[\d,]+/i.test(t);
  }, { timeout });
  await page.waitForTimeout(2000);
}

export async function readTrialBalanceTotals(page) {
  const body = await page.innerText('body');
  const debitM = body.match(/Total Debit:\s*(?:Rs\.?\s*)?([\d,]+\.?\d*)/i);
  const creditM = body.match(/Total Credit:\s*(?:Rs\.?\s*)?([\d,]+\.?\d*)/i);
  return {
    debit: debitM ? parsePkr(debitM[1]) : NaN,
    credit: creditM ? parsePkr(creditM[1]) : NaN,
  };
}

/** Read main-loader attr from the last visible marker (avoids stale loading shell). */
export async function readVisibleMainLoaderAttr(page, attrName) {
  const locator = page.locator(`[${attrName}]`).last();
  await locator.waitFor({ state: 'attached', timeout: 180000 });
  return locator.getAttribute(attrName);
}
