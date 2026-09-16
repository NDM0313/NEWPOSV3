import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveProfileEmail } from './monitoringCredentials.mjs';
import { buildTimestampSlug, parseMonitoringOutput } from './monitoringRunnerHelpers.mjs';

const PROFILES = JSON.parse(
  fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'monitoring-company-profiles.json'),
    'utf8',
  ),
);

test('resolveProfileEmail uses built-in defaults and ignores generic QA_BROWSER_EMAIL', () => {
  assert.equal(resolveProfileEmail('din-china', PROFILES, {}).email, 'din@yahoo.com');
  assert.equal(resolveProfileEmail('din-bridal', PROFILES, { QA_BROWSER_EMAIL: 'din@yahoo.com' }).email, 'ndm313@yahoo.com');
  assert.equal(resolveProfileEmail('din-couture', PROFILES, {}).email, 'zhd@dincouture.pk');
});

test('resolveProfileEmail respects per-profile env overrides', () => {
  assert.equal(
    resolveProfileEmail('din-bridal', PROFILES, { QA_BROWSER_EMAIL_BRIDAL: 'ops@example.com' }).email,
    'ops@example.com',
  );
});

test('buildTimestampSlug is filesystem-safe', () => {
  const slug = buildTimestampSlug(new Date('2026-06-14T12:30:45.123Z'));
  assert.match(slug, /^2026-06-14T12-30-45-123Z$/);
});

test('parseMonitoringOutput extracts checks and phase result', () => {
  const sample = `[PASS] DIN CHINA expected flags ON — keys=12/12
[PASS] Trial Balance golden total — debit=216300
Phase 2.16 monitoring: PASS`;
  const parsed = parseMonitoringOutput(sample);
  assert.equal(parsed.phaseResult, 'PASS');
  assert.equal(parsed.checks.length, 2);
  assert.equal(parsed.checks[0].result, 'PASS');
});
