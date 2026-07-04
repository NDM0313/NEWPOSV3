import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  allowsEditAccounts,
  editAccountsBlockedReason,
  getStatementRowActions,
  getStatementRowEditLabel,
  getTransactionActions,
  statementRowEditDisabledReason,
} from './transactionActionsRegistry.ts';
import { HISTORICAL_PREFIX } from './paymentChainHistorical.ts';

describe('transactionActionsRegistry', () => {
  it('manual journal shows Edit Entry and Reverse Entry when allowed', () => {
    const actions = getTransactionActions(
      {
        reference_type: 'journal',
        reference_id: 'mj-1',
        is_void: false,
      },
      'detail_modal',
      { includeViewAction: false }
    );
    const ids = actions.map((a) => a.id);
    assert.ok(ids.includes('edit_entry'));
    assert.ok(ids.includes('reverse_entry'));
    const edit = actions.find((a) => a.id === 'edit_entry');
    assert.equal(edit?.label, 'Edit Entry');
    const rev = actions.find((a) => a.id === 'reverse_entry');
    assert.equal(rev?.label, 'Reverse Entry');
  });

  it('payment row shows Edit Payment and Cancel Payment where allowed', () => {
    const actions = getTransactionActions(
      {
        reference_type: 'sale',
        reference_id: 'sale-1',
        payment_id: 'pay-1',
        is_void: false,
      },
      'detail_modal',
      { includeViewAction: false }
    );
    const ids = actions.map((a) => a.id);
    assert.ok(ids.includes('edit_payment'));
    assert.ok(ids.includes('cancel_payment'));
    assert.equal(actions.find((a) => a.id === 'edit_payment')?.label, 'Edit Payment');
  });

  it('PF-14 historical payment chain member blocks edit and shows reason', () => {
    const historicalMsg =
      'This payment line is historical (a later edit or transfer exists). Use the latest journal row.';
    const entry = {
      journal_entry_id: 'je-old',
      je_reference_type: 'payment',
      payment_id: 'pay-1',
      je_action_fingerprint: HISTORICAL_PREFIX + historicalMsg,
    };
    assert.equal(getStatementRowEditLabel(entry), null);
    assert.equal(statementRowEditDisabledReason(entry), historicalMsg);
    const actions = getStatementRowActions(entry);
    const edit = actions.find((a) => a.id === 'edit_payment' || a.id === 'edit');
    assert.ok(!edit || edit.disabled === true);
  });

  it('source-controlled sale shows Open Source Document and blocks direct edit/reverse', () => {
    const actions = getTransactionActions(
      {
        reference_type: 'sale',
        reference_id: 'sale-1',
        payment_id: null,
        is_void: false,
      },
      'journal',
      { sourceOpenTarget: { kind: 'sale', id: 'sale-1' } }
    );
    const ids = actions.map((a) => a.id);
    assert.ok(ids.includes('open_source_document'));
    assert.ok(!ids.includes('edit') && !ids.includes('edit_entry'));
    assert.ok(!ids.includes('reverse_entry') && !ids.includes('cancel_entry'));
  });

  it('opening balance blocks Edit Accounts with source-controlled reason', () => {
    assert.ok(editAccountsBlockedReason('opening_balance')?.includes('source-controlled'));
    assert.equal(allowsEditAccounts({ reference_type: 'opening_balance', is_void: false }), false);
  });

  it('stock adjustment blocks Edit Accounts', () => {
    assert.ok(editAccountsBlockedReason('stock_adjustment')?.includes('source-controlled'));
    assert.equal(allowsEditAccounts({ reference_type: 'stock_adjustment', is_void: false }), false);
  });

  it('account statement synthetic row has no edit action', () => {
    assert.equal(getStatementRowEditLabel({ journal_entry_id: null }), null);
    assert.equal(getStatementRowActions({ journal_entry_id: null }).length, 0);
    assert.match(String(statementRowEditDisabledReason({})), /No journal entry/);
  });

  it('statement row with journal_entry_id includes View action', () => {
    const actions = getStatementRowActions({
      journal_entry_id: 'je-1',
      je_reference_type: 'journal',
    });
    assert.ok(actions.some((a) => a.id === 'view' && a.label === 'View'));
  });

  it('view action is always safe when reference exists on journal context', () => {
    const actions = getTransactionActions(
      {
        reference_type: 'journal',
        reference_id: 'mj-1',
        is_void: false,
      },
      'journal'
    );
    assert.ok(actions.some((a) => a.id === 'view'));
  });
});
