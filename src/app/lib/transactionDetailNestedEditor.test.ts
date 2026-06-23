import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isTransactionDetailNestedEditorOpen,
  shouldAllowTransactionDetailClose,
} from './transactionDetailNestedEditor.ts';

describe('transactionDetailNestedEditor', () => {
  it('blocks parent close while payment editor is open', () => {
    assert.equal(
      shouldAllowTransactionDetailClose(false, { genericPaymentEditorOpen: true }),
      false
    );
  });

  it('blocks parent close while nested editor is pending (async open)', () => {
    assert.equal(
      shouldAllowTransactionDetailClose(false, { nestedEditorPending: true }),
      false
    );
  });

  it('allows parent close when no nested editor', () => {
    assert.equal(shouldAllowTransactionDetailClose(false, {}), true);
  });

  it('allows open requests always', () => {
    assert.equal(
      shouldAllowTransactionDetailClose(true, { genericPaymentEditorOpen: true }),
      true
    );
  });

  it('detects journal quick edit as nested', () => {
    assert.equal(
      isTransactionDetailNestedEditorOpen({ journalQuickEditOpen: true }),
      true
    );
  });
});
