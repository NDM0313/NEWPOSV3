#!/usr/bin/env node
/**
 * Run read-only production monitoring for all three approved unified-ledger companies.
 * Does not mutate flags, GL, or accounting data.
 *
 * Per-company credentials (preferred):
 *   QA_BROWSER_EMAIL_CHINA / QA_BROWSER_PASSWORD_CHINA
 *   QA_BROWSER_EMAIL_BRIDAL / QA_BROWSER_PASSWORD_BRIDAL
 *   QA_BROWSER_EMAIL_COUTURE / QA_BROWSER_PASSWORD_COUTURE
 *
 * Generic QA_BROWSER_PASSWORD is NOT reused across profiles unless:
 *   ALLOW_GENERIC_MONITORING_CREDENTIAL_FALLBACK=true
 *
 * Generic QA_BROWSER_EMAIL is never used for multi-profile runs.
 *
 * Loads project-root .env.local when present (passwords never logged).
 */
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envLocal = path.join(ROOT, '.env.local');
if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
}
import {
  validateThreeCompanyCredentials,
  formatCredentialSourceLog,
  redactSecrets,
  isGenericFallbackAllowed,
  EMAIL_ENV_KEYS,
  PASSWORD_ENV_KEYS,
} from './monitoringCredentials.mjs';
import { buildTimestampSlug, parseMonitoringOutput } from './monitoringRunnerHelpers.mjs';
import { runReadOnlyFlagGuard } from './threeCompanyLoaderGuard.mjs';

export { resolveProfileEmail } from './monitoringCredentials.mjs';
export { buildTimestampSlug, parseMonitoringOutput } from './monitoringRunnerHelpers.mjs';

const PROFILES_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'monitoring-company-profiles.json');
const MONITOR_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'run-unified-ledger-monitoring-verify.mjs');
const OUT_DIR = path.join(ROOT, 'reports/single-core-ledger/operational-monitoring');
const LATEST_MD = path.join(OUT_DIR, 'latest-three-company-monitoring.md');
const LATEST_JSON = path.join(OUT_DIR, 'latest-three-company-monitoring.json');

function runProfile(creds) {
  const emailKey = EMAIL_ENV_KEYS[creds.profileId];
  const passwordKey = PASSWORD_ENV_KEYS[creds.profileId];
  const env = {
    ...process.env,
    MONITORING_PROFILE: creds.profileId,
    [emailKey]: creds.email,
    [passwordKey]: creds.password,
  };
  delete env.QA_BROWSER_EMAIL;
  const result = spawnSync(process.execPath, [MONITOR_SCRIPT], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  const stdout = redactSecrets(result.stdout || '', creds.password);
  const stderr = redactSecrets(result.stderr || '', creds.password);
  const parsed = parseMonitoringOutput(stdout);
  const pass = result.status === 0 && parsed.phaseResult === 'PASS';
  return {
    profileId: creds.profileId,
    email: creds.email,
    emailSource: creds.emailSource,
    passwordSource: creds.passwordSource,
    exitCode: result.status ?? 1,
    pass,
    ...parsed,
    stdout,
    stderr,
  };
}

function writeLatest(payload, mdPath, jsonPath) {
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
  fs.writeFileSync(LATEST_JSON, JSON.stringify(payload, null, 2));
  const md = fs.readFileSync(mdPath, 'utf8');
  fs.writeFileSync(LATEST_MD, md);
}

function main() {
  const profilesRaw = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8'));
  const validation = validateThreeCompanyCredentials(profilesRaw);
  if (!validation.ok) {
    console.error('Three-company monitoring credential validation failed:');
    for (const m of validation.missing) {
      console.error(`  - ${m.profileId}: ${m.message}`);
    }
    console.error(validation.hint);
    process.exit(1);
  }

  const timestamp = buildTimestampSlug();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('=== Three-company operational monitoring (read-only) ===');
  if (isGenericFallbackAllowed()) {
    console.log('[INFO] ALLOW_GENERIC_MONITORING_CREDENTIAL_FALLBACK=true — shared QA_BROWSER_PASSWORD permitted');
  }

  const flagGuard = runReadOnlyFlagGuard();
  console.log(`[${flagGuard.ok ? 'PASS' : 'FAIL'}] read-only loader guard`);

  const profileResults = [];
  for (const creds of validation.profiles) {
    console.log(`\n--- Running profile: ${creds.profileId} (${creds.email}) — ${formatCredentialSourceLog(creds)} ---`);
    const r = runProfile(creds);
    profileResults.push(r);
    console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${creds.profileId} Phase 2.16`);
    if (!r.pass) {
      console.error(r.stderr || r.stdout.split('\n').slice(-8).join('\n'));
    }
  }

  const allPass = flagGuard.ok && profileResults.every((r) => r.pass);
  const payload = {
    run: 'THREE_COMPANY_OPERATIONAL_MONITORING',
    generated_at: new Date().toISOString(),
    timestamp_slug: timestamp,
    overall: allPass ? 'PASS' : 'FAIL',
    credential_policy: 'per-company-preferred',
    generic_fallback_allowed: isGenericFallbackAllowed(),
    flag_guard: flagGuard,
    profiles: profileResults.map(({ stdout, stderr, ...rest }) => rest),
    migrations_run: false,
    gl_mutations: false,
  };

  const jsonPath = path.join(OUT_DIR, `three-company-monitoring-${timestamp}.json`);
  const mdPath = path.join(OUT_DIR, `three-company-monitoring-${timestamp}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));

  const md = [
    '# Three-company operational monitoring',
    '',
    `**Generated:** ${payload.generated_at}`,
    `**Overall:** ${payload.overall}`,
    `**Credential policy:** per-company preferred; generic fallback=${payload.generic_fallback_allowed}`,
    '',
    '## Read-only flag guard',
    '',
    flagGuard.ok
      ? '- PASS — only DIN CHINA, DIN BRIDAL, DIN COUTURE have loaders ON'
      : `- FAIL — ${flagGuard.error || JSON.stringify(flagGuard.unexpected)}`,
    '',
    '## Profile results',
    '',
    ...profileResults.map((r) => [
      `### ${r.profileId}`,
      '',
      `- **Result:** ${r.pass ? 'PASS' : 'FAIL'}`,
      `- **Login email:** ${r.email}`,
      `- **Email source:** ${r.emailSource}`,
      `- **Password source:** ${r.passwordSource}`,
      `- **Checks:** ${r.checks.filter((c) => c.result === 'PASS').length}/${r.checks.length} PASS`,
      '',
    ].join('\n')),
    '',
    `**JSON:** \`${path.relative(ROOT, jsonPath).replace(/\\/g, '/')}\``,
  ].join('\n');
  fs.writeFileSync(mdPath, md);
  writeLatest(payload, mdPath, jsonPath);

  console.log(`\nWrote ${path.relative(ROOT, mdPath)}`);
  console.log(`Three-company monitoring: ${allPass ? 'PASS' : 'FAIL'}`);
  process.exit(allPass ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
