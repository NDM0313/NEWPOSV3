import test from 'node:test';
import assert from 'node:assert/strict';
import type { LedgerLine } from '../api/reports';
import {
  formatLedgerLinePresentation,
  ledgerDocumentTypeLabel,
  toLedgerPreviewRow,
} from './ledgerLinePresentation';

function baseLine(overrides: Partial<LedgerLine> = {}): LedgerLine {
  return {
    id: 'jel-1',
    journalEntryId: 'je-1',
    sourceReferenceId: null,
    date: '2026-04-01',
    createdAt: '2026-04-01T10:00:00Z',
    entryNo: 'JE-100',
    description: 'Payment received',
    reference: 'JE-100',
    referenceType: 'payment',
    debit: 0,
    credit: 5000,
    runningBalance: -5000,
    ...overrides,
  };
}

test('manual_payment + counter WALI T/T shows bank title with payment subline', () => {
  const line = baseLine({
    referenceType: 'manual_payment',
    description: 'Payment received',
    debit: 10000,
    credit: 0,
    counterAccountName: 'WALI T/T',
    counterAccountCode: '1012',
    counterAccountType: 'bank',
  });
  const pres = formatLedgerLinePresentation(line, { viewedAccountName: 'FHD MZ' });
  assert.equal(pres.title, 'WALI T/T');
  assert.equal(pres.subline, 'Payment received');
});

test('sale + counter Sales Revenue shows Sale title with invoice subline', () => {
  const line = baseLine({
    referenceType: 'sale',
    description: 'Sales Revenue',
    entryDescription: 'Sale INV-2042',
    debit: 277296,
    credit: 0,
    counterAccountName: 'Sales Revenue',
    counterAccountCode: '4000',
    counterAccountType: 'revenue',
  });
  const pres = formatLedgerLinePresentation(line, { viewedPartyName: 'HASSAN MARDAN' });
  assert.equal(pres.title, 'Sale');
  assert.equal(pres.subline, 'Sale INV-2042');
});

test('sale_return shows Sale Return title with return detail subline', () => {
  const line = baseLine({
    referenceType: 'sale_return',
    description: 'Sale return SR-0012',
    debit: 0,
    credit: 15000,
  });
  const pres = formatLedgerLinePresentation(line);
  assert.equal(pres.title, 'Sale Return');
  assert.equal(pres.subline, 'Sale return SR-0012');
});

test('party_discount shows Discount title', () => {
  const line = baseLine({
    referenceType: 'party_discount',
    description: 'Customer discount - INV-2042',
    debit: 0,
    credit: 500,
  });
  const pres = formatLedgerLinePresentation(line);
  assert.equal(pres.title, 'Discount');
  assert.equal(pres.subline, 'Customer discount - INV-2042');
});

test('payment with generic description shows Payment Received title and subline', () => {
  const line = baseLine({
    referenceType: 'payment',
    description: 'Payment received',
    partyName: 'HASSAN MARDAN',
    counterAccountName: 'WALI T/T',
    counterAccountType: 'bank',
  });
  const pres = formatLedgerLinePresentation(line);
  assert.equal(pres.title, 'Payment Received');
  assert.equal(pres.subline, 'Payment received');
});

test('infers sale from description when reference_type missing', () => {
  assert.equal(ledgerDocumentTypeLabel('', 'Sale #INV-88'), 'Sale');
});

test('toLedgerPreviewRow maps operational title and subline fields', () => {
  const line = baseLine({
    referenceType: 'sale',
    description: 'Sales Revenue',
    entryDescription: 'Sale INV-2042',
    debit: 12000,
    credit: 0,
    counterAccountName: 'Sales Revenue',
    counterAccountType: 'revenue',
  });
  const row = toLedgerPreviewRow(line, 'JE-0087', { viewedPartyName: 'HASSAN MARDAN' });
  assert.equal(row.description, 'Sale');
  assert.equal(row.descriptionSubline, 'Sale INV-2042');
  assert.equal(row.reference, 'JE-0087');
});

test('toLedgerPreviewRow maps liquidity transfer rows', () => {
  const line = baseLine({
    referenceType: 'manual_payment',
    counterAccountName: 'WALI T/T',
    counterAccountType: 'bank',
    description: 'Payment received',
    debit: 5000,
    credit: 0,
  });
  const row = toLedgerPreviewRow(line, 'JE-100', { viewedAccountName: 'FHD MZ' });
  assert.equal(row.description, 'WALI T/T');
  assert.equal(row.descriptionSubline, 'Payment received');
});
