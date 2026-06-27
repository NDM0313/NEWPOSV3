import test from 'node:test';
import assert from 'node:assert/strict';
import { loadMonitoringProfile } from './loadMonitoringProfile.mjs';

test('loadMonitoringProfile din-china defaults', () => {
  const p = loadMonitoringProfile('din-china');
  assert.equal(p.company, 'DIN CHINA');
  assert.equal(p.companyId, '30bd8592-3384-4f34-899a-f3907e336485');
  assert.equal(p.golden.mrJalilClosing, 216_300);
  assert.equal(p.golden.trialBalanceTotal, 407_957_271.02);
  assert.equal(p.golden.roznamcha.cashIn, 136_158_012);
  assert.equal(p.expectedUnifiedFlagsOn.length, 12);
  assert.equal(p.pilotBatchExpected, 9);
});

test('loadMonitoringProfile rejects unknown profile', () => {
  assert.throws(() => loadMonitoringProfile('no-such-company'), /Unknown monitoring profile/);
});

test('loadMonitoringProfile _template requires finance gate for non-default use', () => {
  assert.throws(() => loadMonitoringProfile('_template'), /requires finance sign-off/);
});

test('loadMonitoringProfile din-bridal requires finance sign-off', () => {
  assert.throws(() => loadMonitoringProfile('din-bridal'), /requires finance sign-off/);
});

test('loadMonitoringProfile din-couture requires finance sign-off', () => {
  assert.throws(() => loadMonitoringProfile('din-couture'), /requires finance sign-off/);
});
