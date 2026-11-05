import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeAllCompanyTieOut } from '@/app/lib/unifiedLedgerTieOutSummary.ts';

test('summarizeAllCompanyTieOut counts pass/fail and unresolved', () => {
  const rows = [
    {
      companyId: 'c1',
      companyName: 'Co A',
      branchId: null,
      branchLabel: null,
      contactId: 'x1',
      contactName: 'Alice',
      contactCode: 'CUS-1',
      partyType: 'customer' as const,
      basis: 'official_gl' as const,
      legacyEngine: 'legacy_gl_rpc' as const,
      oldBalance: 100,
      newBalance: 100,
      difference: 0,
      oldRowCount: 2,
      newRowCount: 2,
      pass: true,
      oldEngineName: 'GL',
      newEngineName: 'unified',
    },
    {
      companyId: 'c1',
      companyName: 'Co A',
      branchId: 'b1',
      branchLabel: 'HQ',
      contactId: 'x2',
      contactName: 'Bob',
      contactCode: 'CUS-2',
      partyType: 'customer' as const,
      basis: 'official_gl' as const,
      legacyEngine: 'legacy_gl_rpc' as const,
      oldBalance: 50,
      newBalance: 48,
      difference: 2,
      oldRowCount: 3,
      newRowCount: 3,
      pass: false,
      oldEngineName: 'GL',
      newEngineName: 'unified',
    },
  ];

  const s = summarizeAllCompanyTieOut(rows);
  assert.equal(s.companiesScanned, 1);
  assert.equal(s.contactsCompared, 2);
  assert.equal(s.passCount, 1);
  assert.equal(s.failCount, 1);
  assert.equal(s.unresolved.length, 1);
  assert.equal(s.maxAbsDifference, 2);
});
