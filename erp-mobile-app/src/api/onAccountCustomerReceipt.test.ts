import assert from 'node:assert/strict';
import test from 'node:test';
import { composeCustomerPaymentNotesForRpc } from '../utils/saleNotesComposition.ts';
import { onAccountCustomerReceiptPostRpcPatches } from './sales.ts';

test('onAccountCustomerReceiptPostRpcPatches sets manual_receipt and JE description', () => {
  const composedNotes = composeCustomerPaymentNotesForRpc({
    partyName: 'MR HAJI MUTABAR',
    paymentAccountName: 'FHD MZ',
    combinedNotes: 'IMRAN',
  });
  const { paymentPatch, jePatch } = onAccountCustomerReceiptPostRpcPatches({
    contactId: 'contact-uuid',
    contactName: 'MR HAJI MUTABAR',
    composedNotes,
    createdBy: 'user-1',
  });

  assert.equal(paymentPatch.reference_type, 'manual_receipt');
  assert.equal(paymentPatch.reference_id, null);
  assert.equal(paymentPatch.contact_id, 'contact-uuid');
  assert.equal(paymentPatch.contact_name, 'MR HAJI MUTABAR');
  assert.equal(jePatch.reference_type, 'manual_receipt');
  assert.equal(jePatch.reference_id, 'contact-uuid');
  assert.match(String(jePatch.description), /Customer receipt from MR HAJI MUTABAR/i);
  assert.match(String(jePatch.description), /Account: FHD MZ/);
  assert.match(String(jePatch.description), /IMRAN/);
});

test('onAccountCustomerReceiptPostRpcPatches includes attachments when provided', () => {
  const attachments = [{ url: 'path/file.pdf', name: 'receipt.pdf' }];
  const { paymentPatch } = onAccountCustomerReceiptPostRpcPatches({
    contactId: 'c1',
    contactName: 'Customer',
    composedNotes: 'Customer receipt from Customer.',
    attachments,
  });
  assert.deepEqual(paymentPatch.attachments, attachments);
});
