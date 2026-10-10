/**
 * Import FX W2 static/contract QA (no Docker, no VPS, no production).
 * Live DB suites are SKIPPED when no safe localhost target is configured.
 *
 * Usage: node scripts/qa/import-fx-w2-static-qa.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const results = [];
function ok(name, detail = '') {
  results.push({ name, pass: true, detail });
  console.log('PASS', name, detail);
}
function fail(name, detail = '') {
  results.push({ name, pass: false, detail });
  console.error('FAIL', name, detail);
}

const migA = path.join(ROOT, 'migrations/20260812140000_import_fx_case_arrangement_enrichment_w2.sql');
const migB = path.join(ROOT, 'migrations/20260812140100_import_fx_case_attachment_metadata_rpc_w2.sql');
const doc = path.join(ROOT, 'docs/accounting/IMPORT_FX_CASE_W2_ARRANGEMENT_ENRICHMENT.md');
const helpers = path.join(ROOT, 'src/app/lib/importFxCaseHelpers.ts');
const service = path.join(ROOT, 'src/app/services/importFxCaseService.ts');
const ui = path.join(ROOT, 'src/app/features/import-fx-case/ImportFxCaseWorkspace.tsx');
const panels = path.join(ROOT, 'src/app/features/import-fx-case/ImportFxCaseArrangementPanels.tsx');
const view = path.join(ROOT, 'src/app/lib/importFxCaseWorkspaceView.ts');
const viewTest = path.join(ROOT, 'src/app/lib/importFxCaseWorkspaceView.test.ts');

for (const [label, p] of [
  ['migration enrichment', migA],
  ['migration attachment meta', migB],
  ['canonical W2 doc', doc],
  ['helpers', helpers],
  ['service', service],
  ['workspace UI', ui],
  ['arrangement panels', panels],
  ['workspace view-model', view],
  ['workspace view tests', viewTest],
]) {
  if (fs.existsSync(p)) ok(`file:${label}`, path.relative(ROOT, p));
  else fail(`file:${label}`, `missing ${p}`);
}

const sqlA = fs.readFileSync(migA, 'utf8');
const sqlB = fs.readFileSync(migB, 'utf8');

if (sqlA.includes('funding_mode') && sqlA.includes('IMPORT_FX_CASE_STAGE_W2_ARRANGEMENT_ONLY')) {
  ok('sql:funding_mode+W2_block_code');
} else fail('sql:funding_mode+W2_block_code');

if (sqlA.includes('posts_journal') && sqlA.includes('false')) ok('sql:posts_journal_false');
else fail('sql:posts_journal_false');

if (!/UPDATE\s+public\.import_fx_case_stages[\s\S]*stage_code\s*=\s*'ADVANCE'/.test(sqlA)) {
  ok('sql:no_advance_stage_status_bump');
} else fail('sql:no_advance_stage_status_bump', 'must not set ADVANCE stage from W2');

if (sqlB.includes('is_metadata_only') && sqlB.includes('file_uploaded') && !sqlB.includes('create bucket')) {
  ok('sql:attachment_metadata_only');
} else fail('sql:attachment_metadata_only');

if (sqlB.includes('storage_path') && sqlB.includes('metadata-only://w2/')) {
  ok('sql:opaque_metadata_path');
} else fail('sql:opaque_metadata_path');

const uiSrc = fs.readFileSync(ui, 'utf8') + fs.readFileSync(panels, 'utf8');
const viewSrc = fs.readFileSync(view, 'utf8');
if (
  uiSrc.includes('W2_MONEY_STAGE_BLOCKED_COPY') &&
  !uiSrc.includes('Pay Advance') &&
  !uiSrc.includes('Buy USD') &&
  !uiSrc.includes('Convert Currency') &&
  !uiSrc.includes('Settle Supplier') &&
  !uiSrc.includes('Complete USD')
) {
  ok('ui:no_money_action_buttons');
} else fail('ui:no_money_action_buttons');

if (viewSrc.includes('Planning only — no payment or accounting entry has been posted.')) {
  ok('ui:planning_only_notice');
} else fail('ui:planning_only_notice');

if (
  uiSrc.includes('1. Parties') &&
  uiSrc.includes('2. Funding Intention') &&
  uiSrc.includes('3. Planned Currency') &&
  uiSrc.includes('4. Expected Schedule') &&
  uiSrc.includes('5. References')
) {
  ok('ui:five_arrangement_sections');
} else fail('ui:five_arrangement_sections');

if (
  uiSrc.includes('Refresh indicative rates') &&
  uiSrc.includes('fetchIndicativeRates') &&
  uiSrc.includes('INDICATIVE_RATE_HELPER_COPY')
) {
  ok('ui:indicative_rate_autofill');
} else fail('ui:indicative_rate_autofill');

if (
  uiSrc.includes('PLANNED_CURRENCY_PURCHASE_COPY') &&
  uiSrc.includes('syncPlannedAmounts') &&
  uiSrc.includes('Keep in') &&
  uiSrc.includes('Convert / settle')
) {
  ok('ui:planned_currency_cascade');
} else fail('ui:planned_currency_cascade');

const rateHelper = path.join(ROOT, 'src/app/lib/importFxIndicativeRates.ts');
if (
  fs.existsSync(rateHelper) &&
  fs
    .readFileSync(rateHelper, 'utf8')
    .includes('Online indicative rate — not financially posted. You can change it.')
) {
  ok('file:importFxIndicativeRates_helper');
} else fail('file:importFxIndicativeRates_helper');

const amountSync = path.join(ROOT, 'src/app/lib/importFxPlannedAmountSync.ts');
if (
  fs.existsSync(amountSync) &&
  fs.readFileSync(amountSync, 'utf8').includes('What are you purchasing?')
) {
  ok('file:importFxPlannedAmountSync_helper');
} else fail('file:importFxPlannedAmountSync_helper');

if (uiSrc.includes('confirmClientOpRef') || uiSrc.includes('confirmClientOp')) {
  ok('ui:confirm_op_retry_ref');
} else fail('ui:confirm_op_retry_ref');

if (uiSrc.includes('createExclusiveBusyGuard') && uiSrc.includes('Save Draft')) {
  ok('ui:busy_guard_and_save_draft');
} else fail('ui:busy_guard_and_save_draft');

const applyRunner = path.join(ROOT, 'scripts/qa/apply-import-fx-w2-local.mjs');
const liveRunner = path.join(ROOT, 'scripts/qa/import-fx-w2-live-rpc-qa.mjs');
if (fs.existsSync(applyRunner) && fs.existsSync(liveRunner)) ok('file:w2_apply_and_live_runners');
else fail('file:w2_apply_and_live_runners');

const w1Live = fs.readFileSync(path.join(ROOT, 'scripts/qa/import-fx-w1-live-rpc-qa.mjs'), 'utf8');
const w1Mut = fs.readFileSync(path.join(ROOT, 'scripts/qa/import-fx-w1-mutation-security-qa.mjs'), 'utf8');
if (w1Live.includes('W2_ARRANGEMENT_ONLY') && w1Mut.includes('W2_ARRANGEMENT_ONLY')) {
  ok('w1_suites_accept_w2_block_code');
} else fail('w1_suites_accept_w2_block_code');

results.push({
  name: 'live_db_qa',
  pass: true,
  skipped: true,
  detail: 'live DB apply/QA deferred — not required for W2 code/UI completion',
});
console.log('SKIPPED live_db_qa static suite does not connect to Postgres');
results.push({
  name: 'financial_delta',
  pass: true,
  skipped: true,
  detail: 'measured only by live RPC QA on confirmed localhost',
});
console.log('SKIPPED financial_delta measured only by live RPC QA');

const failed = results.filter((r) => !r.pass);
const skipped = results.filter((r) => r.skipped);
const passed = results.filter((r) => r.pass && !r.skipped);
console.log(`\nW2 static QA: PASS=${passed.length} FAIL=${failed.length} SKIPPED=${skipped.length}`);
process.exit(failed.length ? 1 : 0);
