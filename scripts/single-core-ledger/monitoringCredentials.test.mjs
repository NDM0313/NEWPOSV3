import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveProfileEmail,
  resolveProfilePassword,
  resolveThreeCompanyProfileCredentials,
  validateThreeCompanyCredentials,
  resolveSingleProfileMonitoringCredentials,
  isGenericFallbackAllowed,
  goldenPartyCredentialBindingHint,
  assertNoPasswordInText,
  redactSecrets,
} from './monitoringCredentials.mjs';

const PROFILES = JSON.parse(
  fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'monitoring-company-profiles.json'),
    'utf8',
  ),
);

test('resolveProfileEmail prefers per-company over generic QA_BROWSER_EMAIL', () => {
  const env = { QA_BROWSER_EMAIL: 'wrong@example.com', QA_BROWSER_EMAIL_BRIDAL: 'bridal@example.com' };
  assert.equal(resolveProfileEmail('din-bridal', PROFILES, env).email, 'bridal@example.com');
  assert.equal(resolveProfileEmail('din-bridal', PROFILES, env).source, 'per-company');
  assert.equal(resolveProfileEmail('din-couture', PROFILES, { QA_BROWSER_EMAIL: 'wrong@example.com' }).email, 'zhd@dincouture.pk');
  assert.equal(resolveProfileEmail('din-china', PROFILES, { QA_BROWSER_EMAIL: 'wrong@example.com' }).email, 'din@yahoo.com');
});

test('generic password fallback blocked by default in three-company runner', () => {
  const env = { QA_BROWSER_PASSWORD: 'secret123' };
  const r = resolveProfilePassword('din-bridal', env, { allowGenericFallback: false });
  assert.equal(r.ok, false);
  assert.match(r.message, /QA_BROWSER_PASSWORD_BRIDAL/);
});

test('generic password fallback allowed only with explicit flag', () => {
  const env = { QA_BROWSER_PASSWORD: 'secret123', ALLOW_GENERIC_MONITORING_CREDENTIAL_FALLBACK: 'true' };
  assert.equal(isGenericFallbackAllowed(env), true);
  const r = resolveProfilePassword('din-bridal', env, { allowGenericFallback: true });
  assert.equal(r.ok, true);
  assert.equal(r.source, 'generic-fallback-explicit');
});

test('validateThreeCompanyCredentials fails with clear missing list', () => {
  const v = validateThreeCompanyCredentials(PROFILES, {});
  assert.equal(v.ok, false);
  assert.equal(v.missing.length, 3);
});

test('single profile run allows generic QA_BROWSER_EMAIL and PASSWORD', () => {
  const env = {
    QA_BROWSER_EMAIL: 'ops@example.com',
    QA_BROWSER_PASSWORD: 'pw',
    MONITORING_PROFILE: 'din-bridal',
  };
  const r = resolveSingleProfileMonitoringCredentials('din-bridal', env, PROFILES);
  assert.equal(r.ok, true);
  assert.equal(r.email, 'ops@example.com');
  assert.equal(r.emailSource, 'generic-single-profile');
  assert.equal(r.passwordSource, 'generic-single-profile');
});

test('goldenPartyCredentialBindingHint mentions credential binding', () => {
  const hint = goldenPartyCredentialBindingHint('din-bridal', 'MR REHAN ALI', 'din@yahoo.com');
  assert.match(hint, /credential/i);
  assert.match(hint, /QA_BROWSER_EMAIL_BRIDAL/);
  assert.match(hint, /not an accounting regression/);
});

test('passwords are not logged in redacted output', () => {
  const text = redactSecrets('login failed with secret123', 'secret123');
  assert.equal(text, 'login failed with ***');
  assert.equal(assertNoPasswordInText('safe log line', { QA_BROWSER_PASSWORD: 'secret123' }), true);
  assert.equal(assertNoPasswordInText('leaked secret123', { QA_BROWSER_PASSWORD: 'secret123' }), false);
});
