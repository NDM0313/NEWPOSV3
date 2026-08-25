#!/usr/bin/env node
/**
 * Read-only Supabase gateway health check for DIN CHINA import.
 * Usage: node migration-tools/checkDinChinaGatewayHealth.js --company-id <uuid>
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadMigrationEnv } from './lib/loadMigrationEnv.js';
import {
  isGatewayReadError,
  isTransientReadError,
  supabaseRead,
  formatReadError,
} from './lib/supabaseReadRetry.js';

const MAX_ROUNDS = 3;
const WAIT_MS = 3 * 60 * 1000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function probe(label, fn) {
  try {
    const res = await supabaseRead(label, fn);
    if (res?.error) {
      return { label, ok: false, error: res.error.message, transient: isTransientReadError(res.error) };
    }
    return { label, ok: true };
  } catch (err) {
    return {
      label,
      ok: false,
      error: err?.message || String(err),
      transient: isGatewayReadError(err) || isTransientReadError(err),
    };
  }
}

async function runRound(supabase, companyId, round) {
  const probes = await Promise.all([
    probe('health_companies', () =>
      supabase.from('companies').select('id, name').eq('id', companyId).maybeSingle()),
    probe('health_branches', () =>
      supabase.from('branches').select('id, name, code').eq('company_id', companyId).limit(5)),
    probe('health_accounts', () =>
      supabase.from('accounts').select('id, code, name').eq('company_id', companyId).limit(5)),
  ]);
  const stable = probes.every((p) => p.ok);
  return { round, timestamp: new Date().toISOString(), stable, probes };
}

async function main() {
  const argv = process.argv.slice(2);
  argv.push('--dry-run', '--require-supabase');
  const env = loadMigrationEnv(argv);
  const companyId = env.targetCompanyId;

  const host = (() => {
    try {
      return new URL(env.supabaseUrl).hostname;
    } catch {
      return 'invalid-url';
    }
  })();

  console.log(`Gateway health check — host: ${host}, company: ${companyId}`);

  const rounds = [];
  let stable = false;

  for (let r = 1; r <= MAX_ROUNDS; r++) {
    console.log(`Round ${r}/${MAX_ROUNDS}...`);
    const result = await runRound(
      createClient(env.supabaseUrl, env.serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
      companyId,
      r,
    );
    rounds.push(result);
    if (result.stable) {
      stable = true;
      console.log(`Round ${r}: STABLE`);
      break;
    }
    console.log(`Round ${r}: UNSTABLE`);
    for (const p of result.probes) {
      if (!p.ok) console.log(`  - ${p.label}: ${p.error}`);
    }
    if (r < MAX_ROUNDS) {
      console.log(`Waiting ${WAIT_MS / 1000}s before retry...`);
      await sleep(WAIT_MS);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    companyId,
    supabaseHost: host,
    stable,
    rounds,
  };

  const lines = [
    '# DIN CHINA Gateway Health Check',
    '',
    `Generated: ${report.generatedAt}`,
    `Host: ${host}`,
    `Company: ${companyId}`,
    `Stable: **${stable ? 'YES' : 'NO'}**`,
    '',
  ];
  for (const round of rounds) {
    lines.push(`## Round ${round.round} (${round.timestamp})`);
    lines.push(`Stable: ${round.stable}`);
    for (const p of round.probes) {
      lines.push(`- ${p.label}: ${p.ok ? 'OK' : `FAIL — ${p.error}`}`);
    }
    lines.push('');
  }
  if (!stable) {
    lines.push('**Do not run live apply until gateway is stable.**');
  }

  fs.mkdirSync(env.outputDir, { recursive: true });
  const mdPath = path.join(env.outputDir, 'din_china_gateway_health_check.md');
  const jsonPath = path.join(env.outputDir, 'din_china_gateway_health_check.json');
  fs.writeFileSync(mdPath, lines.join('\n'), 'utf8');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`Report: ${mdPath}`);
  process.exit(stable ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
