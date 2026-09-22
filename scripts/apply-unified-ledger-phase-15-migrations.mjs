#!/usr/bin/env node
/**
 * Apply Phase 1.5 unified ledger migrations only (staging clone).
 * Requires UNIFIED_LEDGER_STAGING=1 and staging DATABASE_URL.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import {
  loadEnvLocal,
  assertStagingTarget,
  printMaskedTarget,
  pgClientOptions,
} from './single-core-ledger/staging-env-guard.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const PHASE_15 = [
  '20260620140000_get_unified_party_ledger_shadow.sql',
  '20260621120000_single_core_ledger_systemwide_diagnostics.sql',
  '20260621150000_unified_ledger_phase_15_rpcs.sql',
  '20260621151000_unified_ledger_phase_15_indexes.sql',
];

loadEnvLocal(root);

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

async function main() {
  let summary;
  try {
    summary = assertStagingTarget();
  } catch (e) {
    fail(e.message);
  }
  printMaskedTarget(summary);

  const connectionString =
    process.env.DATABASE_ADMIN_URL ||
    process.env.DATABASE_URL ||
    process.env.DATABASE_POOLER_URL;
  if (!connectionString) fail('DATABASE_URL required for staging migrations.');

  const client = new pg.Client(pgClientOptions(connectionString));
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const { rows: applied } = await client.query('SELECT name FROM schema_migrations');
  const appliedSet = new Set(applied.map((r) => r.name));

  let runCount = 0;
  for (const file of PHASE_15) {
    if (appliedSet.has(file)) {
      console.log('[SKIP]', file);
      continue;
    }
    const filePath = path.join(root, 'migrations', file);
    if (!fs.existsSync(filePath)) fail(`Missing migration file: ${file}`);
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log('[RUN]', file);
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    appliedSet.add(file);
    console.log('[OK]', file);
    runCount += 1;
  }

  await client.end();
  console.log(`\nPhase 1.5 migrations complete. Applied ${runCount} new file(s).`);
}

main().catch((e) => fail(e.message));
