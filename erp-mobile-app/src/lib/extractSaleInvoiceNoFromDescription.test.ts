import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSaleInvoiceNoFromDescription } from './extractSaleInvoiceNoFromDescription.ts';

test('parses Sale DC-0018 from JE description', () => {
  assert.equal(
    extractSaleInvoiceNoFromDescription(
      'Sale finalized – Sale DC-0018 - DIN COUTURE - Ref zhd [Edited 08/07/2026]',
    ),
    'DC-0018',
  );
});

test('parses bare DC- style tokens', () => {
  assert.equal(extractSaleInvoiceNoFromDescription('Invoice DC-0011 posted'), 'DC-0011');
});

test('returns null when no invoice token', () => {
  assert.equal(extractSaleInvoiceNoFromDescription('Payment received'), null);
});
