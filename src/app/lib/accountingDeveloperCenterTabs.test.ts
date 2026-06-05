import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildDeveloperCenterSearch,
  buildDeveloperCenterUrl,
  parseDeveloperCenterQuery,
  parseDeveloperCenterTab,
  tabAcceptsQueryParam,
} from './accountingDeveloperCenterTabs';

test('parseDeveloperCenterTab maps roznamcha and trace slugs', () => {
  assert.equal(parseDeveloperCenterTab('?tab=roznamcha'), 'roznamcha');
  assert.equal(parseDeveloperCenterTab('tab=trace'), 'trace');
  assert.equal(parseDeveloperCenterTab(''), 'coa');
  assert.equal(parseDeveloperCenterTab('?tab=unknown'), 'coa');
});

test('parseDeveloperCenterQuery reads q param', () => {
  assert.equal(parseDeveloperCenterQuery('?tab=roznamcha&q=HQ-RCV-0006'), 'HQ-RCV-0006');
  assert.equal(parseDeveloperCenterQuery('?tab=coa'), '');
});

test('buildDeveloperCenterSearch preserves tab and q for shell tabs', () => {
  assert.equal(
    buildDeveloperCenterSearch('roznamcha', 'HQ-RCV-0006'),
    '?tab=roznamcha&q=HQ-RCV-0006'
  );
  assert.equal(buildDeveloperCenterSearch('coa'), '');
  assert.equal(buildDeveloperCenterSearch('trace', 'JE-0012'), '?tab=trace&q=JE-0012');
});

test('buildDeveloperCenterUrl uses pathname', () => {
  assert.equal(
    buildDeveloperCenterUrl('/admin/accounting-developer-center', 'roznamcha', 'HQ-RCV-0006'),
    '/admin/accounting-developer-center?tab=roznamcha&q=HQ-RCV-0006'
  );
});

test('tabAcceptsQueryParam includes trace and phase C shells', () => {
  assert.equal(tabAcceptsQueryParam('trace'), true);
  assert.equal(tabAcceptsQueryParam('roznamcha'), true);
  assert.equal(tabAcceptsQueryParam('coa'), false);
});
