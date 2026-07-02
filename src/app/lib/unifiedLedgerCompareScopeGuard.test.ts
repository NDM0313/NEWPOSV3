import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../../..');

function readRepo(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), 'utf8');
}

test('pilot batch compare defaults hybrid old engine ON', () => {
  const service = readRepo('src/app/services/unifiedLedgerPilotBatchCompareService.ts');
  assert.match(service, /useHybridOldEngine:\s*params\?\.useHybridOldEngine\s*\?\?\s*true/);
  const tab = readRepo('src/app/components/admin/unified-ledger-compare/PilotBatchCompareTab.tsx');
  assert.match(tab, /useHybridOldEngine:\s*true/);
});

test('compare services use shadowForce and do not write feature flags', () => {
  const tieOut = readRepo('src/app/services/unifiedLedgerTieOutService.ts');
  assert.match(tieOut, /shadowForce:\s*true/);
  assert.doesNotMatch(tieOut, /feature_flags|upsert|setUnifiedLedgerLocalOverride/);

  const account = readRepo('src/app/services/unifiedLedgerAccountCompareService.ts');
  assert.match(account, /shadowForce:\s*true/);
  assert.doesNotMatch(account, /feature_flags|upsert/);
});

test('production ledger loaders unchanged — Ledger V2 still uses getLedgerStatementV2', () => {
  const ledgerV2 = readRepo('src/app/features/ledger-statement-center-v2/LedgerStatementCenterV2Page.tsx');
  assert.match(ledgerV2, /getLedgerStatementV2/);
  assert.doesNotMatch(ledgerV2, /comparePartyLedgerTieOut|compareAccountLedgerTieOut/);
});

test('hybrid customer ledger matcher includes party_discount by contact reference_id', () => {
  const accounting = readRepo('src/app/services/accountingService.ts');
  assert.match(accounting, /isPartyDiscountJournalForContact/);
  const matchLib = readRepo('src/app/lib/partyLedgerLegacyJournalMatch.ts');
  assert.match(matchLib, /party_discount/);
});
