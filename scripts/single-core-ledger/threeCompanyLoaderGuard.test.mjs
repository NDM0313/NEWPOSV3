import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseThreeCompanyLoaderGuardRows,
  evaluateThreeCompanyLoaderGuard,
} from './threeCompanyLoaderGuard.mjs';
import { assertNoPasswordInText } from './monitoringCredentials.mjs';

test('parseThreeCompanyLoaderGuardRows parses pipe output', () => {
  const raw = 'DIN BRIDAL|8\nDIN CHINA|8\nDIN COUTURE|8\n';
  const rows = parseThreeCompanyLoaderGuardRows(raw);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], { name: 'DIN BRIDAL', loaders_on: 8 });
});

test('evaluateThreeCompanyLoaderGuard passes for three approved companies only', () => {
  const rows = [
    { name: 'DIN CHINA', loaders_on: 8 },
    { name: 'DIN BRIDAL', loaders_on: 8 },
    { name: 'DIN COUTURE', loaders_on: 8 },
  ];
  const result = evaluateThreeCompanyLoaderGuard(rows);
  assert.equal(result.ok, true);
  assert.equal(result.unexpected.length, 0);
});

test('evaluateThreeCompanyLoaderGuard fails on fourth company loaders', () => {
  const rows = [
    { name: 'DIN CHINA', loaders_on: 8 },
    { name: 'DIN BRIDAL', loaders_on: 8 },
    { name: 'DIN COUTURE', loaders_on: 8 },
    { name: 'QA TEST BUSINESS', loaders_on: 2 },
  ];
  const result = evaluateThreeCompanyLoaderGuard(rows);
  assert.equal(result.ok, false);
  assert.equal(result.unexpected[0].name, 'QA TEST BUSINESS');
});

test('evaluateThreeCompanyLoaderGuard fails when fewer than three approved companies', () => {
  const rows = [
    { name: 'DIN CHINA', loaders_on: 8 },
    { name: 'DIN BRIDAL', loaders_on: 8 },
  ];
  assert.equal(evaluateThreeCompanyLoaderGuard(rows).ok, false);
});

test('guard tests do not embed password values', () => {
  assert.equal(assertNoPasswordInText('DIN CHINA|8', { QA_BROWSER_PASSWORD: 'secret123' }), true);
});
