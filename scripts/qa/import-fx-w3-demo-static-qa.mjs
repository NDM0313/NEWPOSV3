/**
 * Static QA for Import FX W3 Local UI Demo Mode (no DB, no network).
 * Usage: node scripts/qa/import-fx-w3-demo-static-qa.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let pass = 0;
let fail = 0;

function check(name, ok, detail = '') {
  if (ok) {
    pass += 1;
    console.log(`PASS ${name}`);
  } else {
    fail += 1;
    console.log(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const gate = read('src/app/lib/importFxW3DemoGate.ts');
const store = read('src/app/lib/importFxW3DemoStore.ts');
const page = read('src/app/features/import-fx-case/ImportFxW3DemoPage.tsx');
const app = read('src/app/App.tsx');
const pkg = read('package.json');
const qa = read('docs/accounting/IMPORT_FX_CASE_W3_IMPLEMENTATION_AND_QA.md');

check('gate:flag_key', gate.includes('VITE_IMPORT_FX_W3_DEMO'));
check('gate:localhost_only', gate.includes('localhost') && gate.includes('127.0.0.1'));
check('gate:rejects_dincouture', gate.includes('dincouture'));
check('store:no_rpc_call', !store.includes('.rpc('));
check('store:no_supabase_import', !/from ['"].*supabase/i.test(store));
check('page:badge', page.includes('DEMO — NOT POSTED'));
check('page:header', page.includes('W3 DEMO MODE — Nothing on this screen is saved or financially posted.'));
check('page:simulate_label', page.includes('Simulate Post — No Accounting'));
check('page:no_w3_service', !page.includes('importFxCaseW3Service'));
check('page:w4_disabled', page.includes('W4 (disabled)'));
const demoIdx = app.indexOf("/demo/import-fx-w3");
const demoChunk = app.slice(demoIdx, demoIdx + 800);
check('app:demo_route', demoIdx >= 0);
check(
  'app:no_auth_on_demo',
  demoChunk.includes('<ImportFxW3DemoPage') && !demoChunk.includes('ProtectedRoute')
);
check('pkg:dev_w3_demo', pkg.includes('dev:w3-demo'));
check('pkg:test_import_fx_w3', pkg.includes('test:import-fx-w3'));
check('doc:local_ui_demo_section', qa.includes('## 7b. Local UI Demo Mode'));
check('demo_case_no', store.includes('DEMO-IMPORT-FX-0001'));

console.log(`\nW3 demo static QA: PASS=${pass} FAIL=${fail}`);
process.exit(fail ? 1 : 0);
