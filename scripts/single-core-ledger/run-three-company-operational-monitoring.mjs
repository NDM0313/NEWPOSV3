#!/usr/bin/env node
/**
 * Run read-only production monitoring for all three approved unified-ledger companies.
 * Does not mutate flags, GL, or accounting data. Requires QA_BROWSER_PASSWORD in env.
 *
 * Usage:
 *   QA_BROWSER_PASSWORD=*** node scripts/single-core-ledger/run-three-company-operational-monitoring.mjs
 *
 * Optional per-company login overrides (never logged):
 *   QA_BROWSER_EMAIL_CHINA, QA_BROWSER_EMAIL_BRIDAL, QA_BROWSER_EMAIL_COUTURE
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROFILES_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'monitoring-company-profiles.json');
const MONITOR_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'run-unified-ledger-monitoring-verify.mjs');
const FLAG_GUARD_SQL = path.join(path.dirname(fileURLToPath(import.meta.url)), 'three-company-loader-guard-pipe.sql');
const OUT_DIR = path.join(ROOT, 'reports/single-core-ledger/operational-monitoring');

const PROFILE_ORDER = ['din-china', 'din-bridal', 'din-couture'];

const DEFAULT_EMAILS = {
  'din-china': 'din@yahoo.com',
  'din-bridal': 'ndm313@yahoo.com',
  'din-couture': 'zhd@dincouture.pk',
};

const EMAIL_ENV_KEYS = {
  'din-china': 'QA_BROWSER_EMAIL_CHINA',
  'din-bridal': 'QA_BROWSER_EMAIL_BRIDAL',
  'din-couture': 'QA_BROWSER_EMAIL_COUTURE',
};

export function resolveProfileEmail(profileId, profilesRaw, env = process.env) {
  const envKey = EMAIL_ENV_KEYS[profileId];
  if (envKey && env[envKey]) return env[envKey];
  const fromProfile = profilesRaw.profiles[profileId]?.login_email_default;
  if (fromProfile && fromProfile !== 'PENDING_OPERATOR') return fromProfile;
  return DEFAULT_EMAILS[profileId];
}

export function buildTimestampSlug(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

export function parseMonitoringOutput(text) {
  const lines = text.split('\n').filter(Boolean);
  const checks = [];
  let phaseResult = null;
  for (const line of lines) {
    const m = line.match(/^\[(PASS|FAIL|WAIVED)\] (.+?)(?: — (.+))?$/);
    if (m) checks.push({ result: m[1], check: m[2], notes: m[3] || '' });
    const phase = line.match(/Phase 2\.16 monitoring: (PASS|FAIL)/);
    if (phase) phaseResult = phase[1];
  }
  return { checks, phaseResult };
}

function redactSecrets(text, password) {
  if (!password) return text;
  return text.split(password).join('***');
}

function runReadOnlyFlagGuard() {
  if (!fs.existsSync(FLAG_GUARD_SQL)) {
    return { ok: false, error: 'missing three-company-loader-guard-pipe.sql' };
  }
  try {
    const raw = execSync(
      `Get-Content "${FLAG_GUARD_SQL}" | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -t -A"`,
      { encoding: 'utf8', shell: 'powershell.exe', maxBuffer: 1024 * 1024 },
    );
    const rows = raw.trim().split('\n').filter(Boolean).map((line) => {
      const [name, count] = line.split('|');
      return { name, loaders_on: Number(count) };
    });
    const allowed = new Set(['DIN CHINA', 'DIN BRIDAL', 'DIN COUTURE']);
    const unexpected = rows.filter((r) => !allowed.has(r.name));
    return {
      ok: unexpected.length === 0 && rows.length === 3,
      rows,
      unexpected,
      other_company_loaders_on: unexpected.reduce((n, r) => n + r.loaders_on, 0),
    };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

function runProfile(profileId, email, password) {
  const env = {
    ...process.env,
    MONITORING_PROFILE: profileId,
    QA_BROWSER_EMAIL: email,
    QA_BROWSER_PASSWORD: password,
  };
  const result = spawnSync(process.execPath, [MONITOR_SCRIPT], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  const stdout = redactSecrets(result.stdout || '', password);
  const stderr = redactSecrets(result.stderr || '', password);
  const parsed = parseMonitoringOutput(stdout);
  const pass = result.status === 0 && parsed.phaseResult === 'PASS';
  return {
    profileId,
    email,
    exitCode: result.status ?? 1,
    pass,
    ...parsed,
    stdout,
    stderr,
  };
}

function main() {
  const password = process.env.QA_BROWSER_PASSWORD || '';
  if (!password) {
    console.error('Set QA_BROWSER_PASSWORD before running three-company operational monitoring.');
    process.exit(1);
  }

  const profilesRaw = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8'));
  const timestamp = buildTimestampSlug();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('=== Three-company operational monitoring (read-only) ===');
  const flagGuard = runReadOnlyFlagGuard();
  console.log(`[${flagGuard.ok ? 'PASS' : 'FAIL'}] read-only loader guard`);

  const profileResults = [];
  for (const profileId of PROFILE_ORDER) {
    const email = resolveProfileEmail(profileId, profilesRaw);
    console.log(`\n--- Running profile: ${profileId} (${email}) ---`);
    const r = runProfile(profileId, email, password);
    profileResults.push(r);
    console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${profileId} Phase 2.16`);
    if (!r.pass) {
      console.error(r.stderr || r.stdout.split('\n').slice(-5).join('\n'));
    }
  }

  const allPass = flagGuard.ok && profileResults.every((r) => r.pass);
  const payload = {
    run: 'THREE_COMPANY_OPERATIONAL_MONITORING',
    generated_at: new Date().toISOString(),
    timestamp_slug: timestamp,
    overall: allPass ? 'PASS' : 'FAIL',
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
    '',
    '## Read-only flag guard',
    '',
    flagGuard.ok
      ? '- PASS — only DIN CHINA, DIN BRIDAL, DIN COUTURE have loaders ON (5 each)'
      : `- FAIL — ${flagGuard.error || JSON.stringify(flagGuard.unexpected)}`,
    '',
    '## Profile results',
    '',
    ...profileResults.map((r) => [
      `### ${r.profileId}`,
      '',
      `- **Result:** ${r.pass ? 'PASS' : 'FAIL'}`,
      `- **Login email:** ${r.email}`,
      `- **Checks:** ${r.checks.filter((c) => c.result === 'PASS').length}/${r.checks.length} PASS`,
      '',
    ].join('\n')),
    '',
    `**JSON:** \`${path.relative(ROOT, jsonPath).replace(/\\/g, '/')}\``,
  ].join('\n');
  fs.writeFileSync(mdPath, md);

  console.log(`\nWrote ${path.relative(ROOT, mdPath)}`);
  console.log(`Three-company monitoring: ${allPass ? 'PASS' : 'FAIL'}`);
  process.exit(allPass ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
