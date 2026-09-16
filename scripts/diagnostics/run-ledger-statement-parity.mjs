#!/usr/bin/env node
/**
 * Read-only JALIL ledger statement parity diagnostic (production DB via VPS SSH).
 * No mutations. Prints period closing balances and request parity hints.
 *
 * Usage: node scripts/diagnostics/run-ledger-statement-parity.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTACT_ID = 'fe7ec33d-fd6d-4aa6-8d21-416e383b4c93';
const COMPANY_ID = '30bd8592-3384-4f34-899a-f3907e336485';

function runRemoteSql(filename) {
  const local = join(__dirname, filename);
  const remote = `/tmp/${filename}`;
  execSync(`scp "${local}" dincouture-vps:${remote}`, { stdio: 'inherit' });
  const out = execSync(
    `ssh dincouture-vps "docker cp ${remote} supabase-db:/tmp/${filename}; docker exec supabase-db psql -U postgres -d postgres -f /tmp/${filename}"`,
    { encoding: 'utf8' },
  );
  return out;
}

console.log('JALIL ledger statement parity — read-only diagnostic\n');
console.log(`contact_id: ${CONTACT_ID}`);
console.log(`company_id: ${COMPANY_ID}\n`);

try {
  console.log(runRemoteSql('jalil_period_closing.sql'));
  console.log('\n--- GL party balance (life-to-date) ---\n');
  const glBal = execSync(
    `ssh dincouture-vps "docker exec supabase-db psql -U postgres -d postgres -t -A -c \\"SELECT gl_ar_receivable FROM get_contact_party_gl_balances('${COMPANY_ID}'::uuid, NULL, CURRENT_DATE) WHERE contact_id = '${CONTACT_ID}'\\""`,
    { encoding: 'utf8' },
  ).trim();
  console.log(`gl_ar_receivable: ${glBal}`);
  console.log('\nIf Standard V2 used global header end date ~2025-12-19, closing ≈ 1,216,300.');
  console.log('If Advanced tab To date is full range through 2026-04-27, closing ≈ 216,300.');
  console.log('Align both screens to the same From/To on Account Statements tab.');
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}
