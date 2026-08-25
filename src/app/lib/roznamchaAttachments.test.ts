import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  resolveRowAttachmentsFromMaps,
  roznamchaRowHasAttachments,
  type AttachmentEnrichmentMaps,
} from './roznamchaAttachmentResolve';

function emptyMaps(): AttachmentEnrichmentMaps {
  return {
    jeAttachmentsById: new Map(),
    jeMetaById: new Map(),
    paymentAttachmentsById: new Map(),
    paymentMetaById: new Map(),
    expenseReceiptById: new Map(),
    saleAttachmentsById: new Map(),
    purchaseAttachmentsById: new Map(),
  };
}

test('roznamchaRowHasAttachments is true only when attachments exist', () => {
  assert.equal(roznamchaRowHasAttachments({}), false);
  assert.equal(roznamchaRowHasAttachments({ attachments: [] }), false);
  assert.equal(
    roznamchaRowHasAttachments({ attachments: [{ url: 'https://x/a.jpg', name: 'a' }] }),
    true,
  );
});

test('payment row with payment attachments resolves', () => {
  const maps = emptyMaps();
  maps.paymentAttachmentsById.set('pay-1', [{ url: 'https://cdn/pay.jpg', name: 'receipt' }]);
  maps.paymentMetaById.set('pay-1', { reference_type: 'manual_payment', reference_id: 'contact-1' });

  const att = resolveRowAttachmentsFromMaps(
    { sourcePaymentId: 'pay-1', referenceType: 'manual_payment' },
    maps,
  );
  assert.equal(att.length, 1);
  assert.equal(att[0]?.url, 'https://cdn/pay.jpg');
});

test('expense payment with receipt_url only resolves', () => {
  const maps = emptyMaps();
  maps.paymentMetaById.set('pay-2', { reference_type: 'expense', reference_id: 'exp-1' });
  maps.expenseReceiptById.set('exp-1', 'https://cdn/expense-receipt.jpg');

  const att = resolveRowAttachmentsFromMaps({ sourcePaymentId: 'pay-2' }, maps);
  assert.equal(att.length, 1);
  assert.equal(att[0]?.name, 'receipt');
});

test('JE-only general entry with JE attachments resolves', () => {
  const maps = emptyMaps();
  maps.jeAttachmentsById.set('je-1', [{ url: 'https://cdn/je.pdf', name: 'voucher' }]);
  maps.jeMetaById.set('je-1', {
    reference_type: 'manual_journal',
    reference_id: null,
    payment_id: null,
  });

  const att = resolveRowAttachmentsFromMaps({ sourceJournalEntryId: 'je-1' }, maps);
  assert.equal(att.length, 1);
  assert.equal(att[0]?.url, 'https://cdn/je.pdf');
});

test('sale settlement payment does not inherit sale invoice attachments', () => {
  const maps = emptyMaps();
  maps.paymentAttachmentsById.set('pay-3', [{ url: 'https://cdn/settlement.jpg', name: 'pay' }]);
  maps.paymentMetaById.set('pay-3', { reference_type: 'sale', reference_id: 'sale-1' });
  maps.saleAttachmentsById.set('sale-1', [{ url: 'https://cdn/invoice.jpg', name: 'invoice' }]);

  const att = resolveRowAttachmentsFromMaps({ sourcePaymentId: 'pay-3', referenceType: 'sale', referenceId: 'sale-1' }, maps);
  assert.equal(att.length, 1);
  assert.equal(att[0]?.url, 'https://cdn/settlement.jpg');
});

test('sale document JE inherits sale attachments when no payment', () => {
  const maps = emptyMaps();
  maps.jeMetaById.set('je-sale', {
    reference_type: 'sale',
    reference_id: 'sale-2',
    payment_id: null,
  });
  maps.saleAttachmentsById.set('sale-2', [{ url: 'https://cdn/inv2.jpg', name: 'invoice' }]);

  const att = resolveRowAttachmentsFromMaps(
    { sourceJournalEntryId: 'je-sale', referenceType: 'sale', referenceId: 'sale-2' },
    maps,
  );
  assert.equal(att.length, 1);
  assert.equal(att[0]?.url, 'https://cdn/inv2.jpg');
});
