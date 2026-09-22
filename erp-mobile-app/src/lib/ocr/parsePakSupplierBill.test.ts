import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  detectDocumentKind,
  parsePakSupplierBill,
  parseSupplierBillAmount,
  parseSupplierBillDate,
  parseSupplierBillReference,
  fuzzyMatchSuppliers,
  parseReceiptOcrText,
} from './parsePakSupplierBill';
import { parsePakBankReceipt } from './parsePakBankReceipt';

const MEEZAN_BANK = `
Transaction Successful
PKR 100,000
Jul 13, 2026 | 6:21 PM
Reference Number: 434570
From Account:
NADEEM DIN MOHAMMAD
To Account:
SKAD
`;

const ZARISHAM_BILL = `
Zarisham SILK, COTTON & MORE
No. 02484
Date: 01/07/26
DIN collection
Organza 281.5 x 550 = 154825
Sheesha Silk 150.5 x 680 = 102340
Total 257,165
O.K 4.7.26
`;

const NISAR_BILL = `
HAND Nisar & Sons
Precious Banarsi Varieties
No. 1236
Date: 02/07/26
DIN COLLECTION
(SALEEM BHAI)
66820
+ 15234
Total Bal. 82054
O.K. 5-7-26
`;

const MARYAM_BILL = `
MARYAM SILKS
Sr. No. 4686
Date: 11/6/26
Name: Zhaid Deen
Tissue Silk 97.5 320 31200
T/C Silk 65 245 15925
Smack silk 70 425 29750
76875
`;

const IBRAHIM_BILL = `
M. Ibrahim Silk
نمبر 7201
تاریخ 20-06-24
میسرز دین کلیکشن
122,035
دستخط
`;

const BAQAYA_BILL = `
S. No. 96
Date: 22/06/2026
IRF 3347
452621/-
508024/-
ٹوٹل 5,08,024/-
سابقہ بقایا + 67,02,408/-
72,10,432/-
- 6,00,000/-
66,10,432/-
`;

test('detectDocumentKind distinguishes bank vs supplier bill', () => {
  assert.equal(detectDocumentKind(MEEZAN_BANK), 'bank');
  assert.equal(detectDocumentKind(ZARISHAM_BILL), 'supplier_bill');
  assert.equal(detectDocumentKind(BAQAYA_BILL), 'supplier_bill');
});

test('parseSupplierBillReference from No / Sr / S.No', () => {
  assert.equal(parseSupplierBillReference(ZARISHAM_BILL), '02484');
  assert.equal(parseSupplierBillReference(NISAR_BILL), '1236');
  assert.equal(parseSupplierBillReference(MARYAM_BILL), '4686');
  assert.equal(parseSupplierBillReference(IBRAHIM_BILL), '7201');
  assert.equal(parseSupplierBillReference(BAQAYA_BILL), '96');
});

test('parseSupplierBillDate handles DD/MM/YY', () => {
  assert.equal(parseSupplierBillDate(ZARISHAM_BILL), '2026-07-01');
  assert.equal(parseSupplierBillDate(MARYAM_BILL), '2026-06-11');
  assert.equal(parseSupplierBillDate(IBRAHIM_BILL), '2024-06-20');
  assert.equal(parseSupplierBillDate(BAQAYA_BILL), '2026-06-22');
});

test('parseSupplierBillAmount uses this-bill total not closing baqaya', () => {
  const { amount } = parseSupplierBillAmount(BAQAYA_BILL);
  assert.equal(amount, 508024);
  assert.notEqual(amount, 6610432);
  assert.notEqual(amount, 7201432);

  assert.equal(parseSupplierBillAmount(ZARISHAM_BILL).amount, 257165);
  assert.equal(parseSupplierBillAmount(NISAR_BILL).amount, 82054);
  assert.equal(parseSupplierBillAmount(MARYAM_BILL).amount, 76875);
});

test('parsePakSupplierBill fills draft fields', () => {
  const d = parsePakSupplierBill(ZARISHAM_BILL);
  assert.equal(d.documentKind, 'supplier_bill');
  assert.equal(d.reference, '02484');
  assert.equal(d.date, '2026-07-01');
  assert.equal(d.amount, 257165);
  assert.ok(d.supplierHint?.toLowerCase().includes('zarisham') || d.notes?.toLowerCase().includes('zarisham'));
});

test('parseReceiptOcrText routes bank to bank parser', () => {
  const d = parseReceiptOcrText(MEEZAN_BANK);
  assert.equal(d.documentKind, 'bank');
  assert.equal(d.amount, 100000);
  assert.equal(d.date, '2026-07-13');
  assert.equal(d.reference, '434570');
});

test('bank parser regression still works', () => {
  const d = parsePakBankReceipt(MEEZAN_BANK);
  assert.equal(d.amount, 100000);
  assert.equal(d.date, '2026-07-13');
});

test('fuzzyMatchSuppliers suggests by hint', () => {
  const list = [
    { id: '1', name: 'Aleemullah' },
    { id: '2', name: 'Mohsin Altaf' },
    { id: '3', name: 'Saleem Bhai Embroidery' },
  ];
  const hits = fuzzyMatchSuppliers('Mohsin altaf', list);
  assert.ok(hits.length >= 1);
  assert.equal(hits[0].id, '2');
  const saleem = fuzzyMatchSuppliers('SALEEM BHAI', list);
  assert.ok(saleem.some((s) => s.id === '3'));
});
