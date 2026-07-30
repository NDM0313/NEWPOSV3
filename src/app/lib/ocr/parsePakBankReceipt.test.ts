import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parsePakBankReceipt,
  parseDateFromReceiptText,
  parseTimeFromReceiptText,
  enrichDraftFromRaw,
  buildReceiptNotes,
  normalizeOcrText,
} from './parsePakBankReceipt';
import { emptyReceiptOcrDraft } from './receiptOcrTypes';

const MEEZAN_SAMPLE = `
Transaction Successful
PKR 200,000
Jul 13, 2026 | 6:20 PM
Reference Number: 569823
From Account:
NADEEM DIN MOHAMMAD/SALEEM KHAN
0819xxx2478
To Account:
NAVEED EMBROIDERY
0147xxx3863
FAROOQ BNRS
`;

test('parsePakBankReceipt extracts Meezan-style amount date time ref and parties', () => {
  const d = parsePakBankReceipt(MEEZAN_SAMPLE);
  assert.equal(d.amount, 200000);
  assert.equal(d.date, '2026-07-13');
  assert.equal(d.time, '18:20');
  assert.equal(d.reference, '569823');
  assert.ok(d.notes?.includes('NADEEM DIN MOHAMMAD'));
  assert.ok(d.notes?.includes('NAVEED EMBROIDERY'));
  assert.ok(d.confidence > 0.8);
});

test('parsePakBankReceipt handles Rs. amount', () => {
  const d = parsePakBankReceipt('Payment Rs. 1,250.50 Ref No: ABC-99');
  assert.equal(d.amount, 1250.5);
  assert.equal(d.reference, 'ABC-99');
});

test('parsePakBankReceipt empty text', () => {
  const d = parsePakBankReceipt('');
  assert.equal(d.amount, null);
  assert.equal(d.date, null);
});

test('parseDateFromReceiptText handles day-month and dotted formats', () => {
  assert.equal(parseDateFromReceiptText('13 Jul 2026'), '2026-07-13');
  assert.equal(parseDateFromReceiptText('13.07.2026'), '2026-07-13');
  assert.equal(parseDateFromReceiptText('Jul-13-2026'), '2026-07-13');
});

test('parseDateFromReceiptText handles OCR Ju1 typo', () => {
  assert.equal(parseDateFromReceiptText('Ju1 13, 2026 | 6:20 PM'), '2026-07-13');
});

test('parseDateFromReceiptText handles Unicode lookalike Jul', () => {
  // Cyrillic Je (Ј) + Latin ul — common Tesseract confusable for "Jul"
  const lookalike = '\u0408ul 13, 2026 | 6:21 PM';
  assert.equal(parseDateFromReceiptText(lookalike), '2026-07-13');
});

test('parseDateFromReceiptText handles no-space and Unicode commas', () => {
  assert.equal(parseDateFromReceiptText('Jul 13,2026 | 6:21 PM'), '2026-07-13');
  assert.equal(parseDateFromReceiptText('Jul 13\uFF0C2026'), '2026-07-13'); // fullwidth comma
  assert.equal(parseDateFromReceiptText('Jul 13\u060C 2026'), '2026-07-13'); // Arabic comma
});

test('parseTimeFromReceiptText AM/PM', () => {
  assert.equal(parseTimeFromReceiptText('6:20 PM'), '18:20');
  assert.equal(parseTimeFromReceiptText('12:05 AM'), '00:05');
});

test('notes fallback when From/To missing', () => {
  const d = parsePakBankReceipt('PKR 500\nSome bank memo line\nAnother detail');
  assert.ok(d.notes && d.notes.includes('Some bank memo'));
});

test('garbled From does not block To and trailing lines in notes', () => {
  const raw = `
Transaction Successful
PKR 100,000
Jul 13, 2026 | 6:21 PM
Reference Number: 434570
From Account:
dh) NADEEM DIN MOHAMMAD/SALEEM KHAN
To Account:
SKAD
FAHAD LACE
`;
  const notes = buildReceiptNotes(raw);
  assert.ok(notes, 'notes should be built');
  assert.ok(!notes!.includes('dh)'), 'should strip leading OCR junk from From');
  assert.ok(notes!.includes('NADEEM DIN MOHAMMAD'), 'clean From name');
  assert.ok(notes!.includes('SKAD') || notes!.includes('To:'), 'To party');
  assert.ok(notes!.includes('FAHAD LACE'), 'trailing line kept');

  const d = parsePakBankReceipt(raw);
  assert.equal(d.date, '2026-07-13');
  assert.equal(d.time, '18:21');
  assert.ok(d.notes?.includes('FAHAD LACE'));
});

test('enrichDraftFromRaw fills date when missing but raw has Jul date', () => {
  const draft = emptyReceiptOcrDraft(`
PKR 100,000
Jul 13, 2026 | 6:21 PM
Reference Number: 434570
From Account:
dh) NAME ONLY
To Account:
SKAD
FAHAD LACE
`);
  draft.amount = 100000;
  draft.reference = '434570';
  draft.date = null;
  draft.time = null;
  draft.notes = 'From: dh) NAME ONLY';

  const enriched = enrichDraftFromRaw(draft);
  assert.equal(enriched.date, '2026-07-13');
  assert.equal(enriched.time, '18:21');
  assert.ok(enriched.notes?.includes('FAHAD LACE'));
  assert.ok(enriched.notes?.includes('SKAD') || enriched.notes?.includes('To:'));
  assert.ok(!enriched.notes?.match(/^From:\s*dh\)/i));
});

test('Meezan overlay FAHAD LACE stays in notes; To is SAAD not swallowed', () => {
  const raw = `
Transaction Successful
PKR 100,000
Jul 13, 2026 | 6:21 PM
Reference Number: 434570
From Account:
NADEEM DIN MOHAMMAD/SALEEM KHAN
0819xxx2478
To Account:
SAAD
0180xxx9151
FAHAD LACE
`;
  const notes = buildReceiptNotes(raw);
  assert.ok(notes?.includes('FAHAD LACE'));
  assert.ok(notes?.includes('To: SAAD'));
  assert.ok(!notes?.includes('0180xxx9151'), 'account mask should not crowd notes');
  assert.ok(!/^To:.*FAHAD/im.test(notes || ''), 'FAHAD must not be inside To line');

  const d = parsePakBankReceipt(raw);
  assert.ok(d.notes?.includes('FAHAD LACE'));
  assert.match(d.notes || '', /To:\s*SAAD/);
});

test('enrich merges FAHAD LACE even when From/To notes already look good', () => {
  const raw = `
Transaction Successful
PKR 100,000
Jul 13, 2026 | 6:21 PM
Reference Number: 434570
From Account:
NADEEM DIN MOHAMMAD/SALEEM KHAN
To Account:
SAAD
0180xxx9151
FAHAD LACE
`;
  const draft = emptyReceiptOcrDraft(raw);
  draft.amount = 100000;
  draft.date = '2026-07-13';
  draft.time = '18:21';
  draft.reference = '434570';
  draft.notes = 'From: NADEEM DIN MOHAMMAD/SALEEM KHAN\nTo: SAAD';

  const enriched = enrichDraftFromRaw(draft);
  assert.ok(enriched.notes?.includes('FAHAD LACE'), 'overlay must be appended');
  assert.ok(enriched.notes?.includes('To: SAAD'));
});

const MEEZAN_STAN_RMB = `
Transaction Successful
Meezan Bank
PKR 299,600
Jul 17, 2026 | 11:25 PM
Reference Number (STAN): 648910
From Account:
NADEEM DIN MOHAMMAD/SALEEM KHAN
0819xxx2478
To Account:
ASAL DIN KHAN
0147xxx3863
RMB 7000x42.8
`;

test('Meezan STAN ref + RMB calc overlay; full To name', () => {
  const d = parsePakBankReceipt(MEEZAN_STAN_RMB);
  assert.equal(d.amount, 299600);
  assert.equal(d.date, '2026-07-17');
  assert.equal(d.time, '23:25');
  assert.equal(d.reference, '648910');
  assert.ok(d.notes?.includes('ASAL DIN KHAN'), 'To must be full name');
  assert.ok(!/^To:\s*ASAL$/im.test(d.notes || ''), 'To must not be clipped to ASAL');
  assert.ok(d.notes?.includes('RMB 7000x42.8'), 'calc overlay in notes');
  assert.ok(d.notes?.includes('NADEEM DIN MOHAMMAD'));
});

const FAYSAL_TXN = `
Faysal Bank
Transaction Successful
PKR 40,000
Date: 16/07/2026
Time: 15:59:36
Transaction ID: 868613
From
Current Account
NADEEM DIN MOHAMMAD
08***********00
To
Bank Alfalah
MUHAMMAD SATTAR
PK**FAYS*************3721
Comment: SATTAR KG
Transaction Type: MBL-to-MBL
`;

test('Faysal Transaction ID + full From/To + comment', () => {
  const d = parsePakBankReceipt(FAYSAL_TXN);
  assert.equal(d.amount, 40000);
  assert.equal(d.date, '2026-07-16');
  assert.equal(d.time, '15:59');
  assert.equal(d.reference, '868613');
  assert.ok(d.notes?.includes('NADEEM DIN MOHAMMAD'), 'full From');
  assert.ok(!/^From:\s*NADEEM$/im.test(d.notes || ''), 'From not clipped to NADEEM');
  assert.ok(d.notes?.includes('MUHAMMAD SATTAR'), 'full To');
  assert.ok(d.notes?.includes('SATTAR KG'), 'comment in notes');
  assert.ok(!d.notes?.includes('Current Account'), 'skip Faysal chrome');
  assert.ok(!d.notes?.includes('Bank Alfalah'), 'skip bank chrome');
  assert.ok(!d.notes?.includes('PK**FAYS'), 'skip masked IBAN');
});

// --- Shared screenshot fixtures (canonical OCR dumps) ---

const MEEZAN_SCREENSHOT = `
Transaction Successful
Meezan Bank
PKR 100,000
Jul 28, 2026 | 2:39 PM
Reference Number (STAN): \u0645\u06CC\u0645 186293 \u0644\u0627\u0645
From Account:
ZARPOSH COLLECTION
To Account:
MUHAMMAD DANISH ATTARI
`;

test('screenshot Meezan: amount date time STAN from/to; strips Urdu watermark', () => {
  const d = parsePakBankReceipt(MEEZAN_SCREENSHOT);
  assert.equal(d.amount, 100000);
  assert.equal(d.date, '2026-07-28');
  assert.equal(d.time, '14:39');
  assert.equal(d.reference, '186293');
  assert.ok(d.notes?.includes('ZARPOSH COLLECTION'));
  assert.ok(d.notes?.includes('MUHAMMAD DANISH ATTARI'));
  assert.ok(!/[\u0600-\u06FF]/.test(normalizeOcrText(d.rawText)));
});

const UBL_SCREENSHOT = `
UBL Digital
Transaction Successful
Status Paid
27 July, 2026 | 12:35 PM
Amount Debited
Rs. 150,000
From
Saleem Khan
To
Zarposh Collection
Bank: MEEZAN
`;

test('screenshot UBL: Amount Debited, parties; soft/null reference', () => {
  const d = parsePakBankReceipt(UBL_SCREENSHOT);
  assert.equal(d.amount, 150000);
  assert.equal(d.date, '2026-07-27');
  assert.equal(d.time, '12:35');
  assert.equal(d.reference, null);
  assert.ok(d.notes?.includes('Saleem Khan'));
  assert.ok(d.notes?.includes('Zarposh Collection'));
});

const FAYSAL_SCREENSHOT = `
Faysal Bank
Transaction Successful
PKR 40,000
26/07/2026 | 17:49:17
Transaction ID: 845652
From
Current Account
NADEEM DIN MOHAMMAD
To
MUHAMMAD SIKANDER
Comment: transfer
Transaction Type: MBL-to-MBL
`;

test('screenshot Faysal: DD/MM/YYYY HH:mm:ss + Transaction ID', () => {
  const d = parsePakBankReceipt(FAYSAL_SCREENSHOT);
  assert.equal(d.amount, 40000);
  assert.equal(d.date, '2026-07-26');
  assert.equal(d.time, '17:49');
  assert.equal(d.reference, '845652');
  assert.ok(d.notes?.includes('NADEEM DIN MOHAMMAD'));
  assert.ok(d.notes?.includes('MUHAMMAD SIKANDER'));
});

const EASYPAISA_SCREENSHOT = `
easypaisa
Money has been sent.
ID#53290658417
27 July, 2026 | 12:55 PM
Total Amount
Rs. 3,800
Sent to
HAMZA HAMZA
03122339083
Sent by
Nadeem Deen Muhammad
Funding Source
Fee / Charge
Free
`;

test('screenshot Easypaisa: ID# Total Amount Sent to/by', () => {
  const d = parsePakBankReceipt(EASYPAISA_SCREENSHOT);
  assert.equal(d.amount, 3800);
  assert.equal(d.date, '2026-07-27');
  assert.equal(d.time, '12:55');
  assert.equal(d.reference, '53290658417');
  assert.ok(d.notes?.includes('Nadeem Deen Muhammad'));
  assert.ok(d.notes?.includes('HAMZA HAMZA'));
  assert.ok(d.notes?.includes('03122339083'));
});

test('normalizeOcrText strips Arabic/Urdu script blocks', () => {
  const cleaned = normalizeOcrText('PKR 100 \u0645\u06CC\u0645 STAN 186293 \u0644\u0627\u0645');
  assert.ok(!/[\u0600-\u06FF]/.test(cleaned));
  assert.ok(cleaned.includes('STAN'));
  assert.ok(cleaned.includes('186293'));
});

const MEEZAN_CLEAN_COMMETTE = `
Transaction Successful
PKR 200,000
May 31, 2026 | 8:52 PM
Reference Number: 219651
From Account:
NADEEM DIN MOHAMMAD/SALEEM KHAN
0819xxx2478
To Account:
NOOR KHAN EMBROIDERY
0801 xxx6237
COMMETTE 07
`;

test('clean Meezan: amount date ref From/To + COMMETTE; skip spaced account mask', () => {
  const d = parsePakBankReceipt(MEEZAN_CLEAN_COMMETTE);
  assert.equal(d.amount, 200000);
  assert.equal(d.date, '2026-05-31');
  assert.equal(d.time, '20:52');
  assert.equal(d.reference, '219651');
  assert.ok(d.notes?.includes('NADEEM DIN MOHAMMAD/SALEEM KHAN'));
  assert.ok(d.notes?.includes('NOOR KHAN EMBROIDERY'));
  assert.ok(d.notes?.includes('COMMETTE 07'));
  assert.ok(!d.notes?.includes('0819xxx'), 'account mask must not enter notes');
  assert.ok(!d.notes?.includes('0801'), 'spaced account mask must not enter notes');
});

const MEEZAN_NOISY_OCR = `
Transaction Successful
PKR 500,000
Jun 01, 2026 | 3:50 PM
Reference Number: 092144
rR From Account:
GY' NADEEM DIN MOHAMMAD/SALEEM KHAN
Lan 0819xxx2478
To Account:
(da) MUHAMMAD ULLAH
CaN 0814xxx1423
COMMETTE 02
`;

test('noisy Meezan OCR: strip label/party junk and Lan/CaN account crumbs', () => {
  const d = parsePakBankReceipt(MEEZAN_NOISY_OCR);
  assert.equal(d.amount, 500000);
  assert.equal(d.date, '2026-06-01');
  assert.equal(d.time, '15:50');
  assert.equal(d.reference, '092144');
  assert.ok(d.notes?.includes('From: NADEEM DIN MOHAMMAD/SALEEM KHAN'));
  assert.ok(d.notes?.includes('To: MUHAMMAD ULLAH'));
  assert.ok(d.notes?.includes('COMMETTE 02'));
  assert.ok(!/\(da\)/i.test(d.notes || ''));
  assert.ok(!/GY'/i.test(d.notes || ''));
  assert.ok(!/\bLan\b/i.test(d.notes || ''));
  assert.ok(!/\bCaN\b/i.test(d.notes || ''));
  assert.ok(!d.notes?.includes('0819xxx'));
  assert.ok(!d.notes?.includes('0814xxx'));
});
