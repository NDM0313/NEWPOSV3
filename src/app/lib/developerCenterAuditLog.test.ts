import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapPartyRepairAuditRow } from './developerCenterAuditLog';

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
