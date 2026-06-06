import assert from 'node:assert/strict';
import { test } from 'node:test';

/**
 * Phase F registry catalog — node:test cannot import the full registry barrel because
 * action modules pull in Supabase at load time (import.meta.env is unset in tsx test).
 */
const PHASE_F_REPAIR_ACTION_IDS = [
  'numbering.sync_sequence_to_effective_max',
  'coa.rename_account',
  'coa.update_description',
  'coa.toggle_active_if_safe',
  'payment.relink_payment_to_journal',
  'payment.fill_payment_account_from_je',
  'payment.sync_branch_from_document',
  'rental.relink_rental_payment_to_journal',
  'opening.create_missing_je',
  'opening.create_adjustment_je',
  'opening.orphan_je_review',
  'roznamcha.report_duplicate_source',
] as const;

test('Phase F repair action ids are unique', () => {
  assert.equal(PHASE_F_REPAIR_ACTION_IDS.length, new Set(PHASE_F_REPAIR_ACTION_IDS).size);
  assert.equal(PHASE_F_REPAIR_ACTION_IDS.length, 12);
});

test('sequence sync action id is registered in catalog', () => {
  assert.ok(PHASE_F_REPAIR_ACTION_IDS.includes('numbering.sync_sequence_to_effective_max'));
});

test('COA safe edit actions in catalog', () => {
  assert.ok(PHASE_F_REPAIR_ACTION_IDS.includes('coa.rename_account'));
  assert.ok(PHASE_F_REPAIR_ACTION_IDS.includes('coa.update_description'));
  assert.ok(PHASE_F_REPAIR_ACTION_IDS.includes('coa.toggle_active_if_safe'));
  assert.equal(
    (PHASE_F_REPAIR_ACTION_IDS as readonly string[]).includes('coa.update_reporting_group'),
    false
  );
});

test('payment metadata repair actions in catalog', () => {
  assert.ok(PHASE_F_REPAIR_ACTION_IDS.includes('payment.relink_payment_to_journal'));
  assert.ok(PHASE_F_REPAIR_ACTION_IDS.includes('payment.fill_payment_account_from_je'));
  assert.ok(PHASE_F_REPAIR_ACTION_IDS.includes('payment.sync_branch_from_document'));
  assert.ok(PHASE_F_REPAIR_ACTION_IDS.includes('rental.relink_rental_payment_to_journal'));
});
