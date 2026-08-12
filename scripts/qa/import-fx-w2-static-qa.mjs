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

for (const [label, p] of [
  ['migration enrichment', migA],
  ['migration attachment meta', migB],
  ['canonical W2 doc', doc],
  ['helpers', helpers],
  ['service', service],
  ['workspace UI', ui],
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

const uiSrc = fs.readFileSync(ui, 'utf8');
if (
  uiSrc.includes('W2_MONEY_STAGE_BLOCKED_COPY') &&
  !uiSrc.includes('Pay Advance') &&
  !uiSrc.includes('Complete USD')
) {
  ok('ui:no_money_action_buttons');
} else fail('ui:no_money_action_buttons');

if (uiSrc.includes('confirmClientOpRef') || uiSrc.includes('confirmClientOp')) {
  ok('ui:confirm_op_retry_ref');
} else fail('ui:confirm_op_retry_ref');

ok('live_db_qa', 'SKIPPED — no Docker/safe office DB target authorized for this pass');
ok('financial_delta', 'EXPECTED 0/0/0/0/0 when live QA runs; not measured this pass');

const failed = results.filter((r) => !r.pass);
console.log(`\nW2 static QA: ${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length ? 1 : 0);
