import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapPartyRepairAuditRow, mapDeveloperRepairAuditRow } from './developerCenterAuditLog';

test('mapPartyRepairAuditRow maps party repair audit fields', () => {
  const row = mapPartyRepairAuditRow({
    id: 'a1',
    created_at: '2026-06-01T10:00:00Z',
    table_name: 'payments',
    row_id: 'pay-1',
    column_name: 'contact_id',
    old_value: null,
    new_value: 'contact-1',
    reason_code: 'BACKFILL_SALE_CUSTOMER',
    applied_by: 'user-1',
  });
  assert.equal(row.action, 'repair_contact_id');
  assert.equal(row.source, 'party_repair_audit');
  assert.equal(row.reasonCode, 'BACKFILL_SALE_CUSTOMER');
});

test('mapDeveloperRepairAuditRow maps Phase F repair audit fields', () => {
  const row = mapDeveloperRepairAuditRow({
    id: 'dr-1',
    created_at: '2026-06-06T12:00:00Z',
    action_id: 'coa.rename_account',
    target_table: 'accounts',
    target_id: 'acc-1',
    before_json: { name: 'Old' },
    after_json: { name: 'New' },
    status: 'success',
    user_id: 'user-1',
    confirm_phrase: 'RENAME-ACCOUNT-5100',
    error_message: null,
  });
  assert.equal(row.source, 'developer_repair');
  assert.equal(row.action, 'coa.rename_account');
  assert.match(row.before, /Old/);
});
