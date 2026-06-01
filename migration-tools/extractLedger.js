#!/usr/bin/env node
/**
 * Phase 13 Track A — Extract full ledger history (NO date cut-off).
 *
 * Sources:
 *   - accounting_accounts_transactions (GL lines → journal entries)
 *   - accounting_acc_trans_mappings (transfer / journal headers)
 *   - transaction_payments (payment vouchers, business_id filter)
 *   - account_transactions (cashbook; only rows whose payment links to GL payments)
 *
 * Uses account_id_map.json from extractAccounts.js.
 *
 * Usage:
 *   node migration-tools/extractLedger.js [62547.sql] [--config mapping.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseSqlInsertRows } from './lib/parseSqlInsert.js';
import { legacyToUuid } from './lib/legacyId.js';
import {
  ledgerGroupKey,
  mapReferenceType,
  toEntryDate,
  lineDebitCredit,
} from './lib/groupLedger.js';
import { loadConfig, resolveDumpPath, resolveOutputDir, TOOLS_ROOT } from './lib/resolvePaths.js';

function normalizePaymentMethod(method) {
  const m = String(method || 'cash').trim().toLowerCase();
  if (m === 'bank' || m === 'bank_transfer') return 'bank';
  if (m === 'card') return 'card';
  if (m === 'cheque' || m === 'check') return 'other';
  return 'cash';
}

function inferPaymentType(paymentRow, lines) {
  const pt = String(paymentRow?.payment_type || '').trim().toLowerCase();
  if (pt === 'credit' || pt === 'received') return 'received';
  if (pt === 'debit' || pt === 'paid') return 'paid';
  const sub = lines.map((l) => String(l.sub_type || '').toLowerCase());
  if (sub.some((s) => s.includes('purchase_payment'))) return 'paid';
  if (sub.some((s) => s.includes('sell') || s.includes('sale'))) return 'received';
  return null;
}

function buildEntryNo(group, mapping, payment, lines) {
  if (mapping?.ref_no) return String(mapping.ref_no);
  if (payment?.payment_ref_no) return String(payment.payment_ref_no);
  const note = lines.map((l) => l.note).find((n) => n && String(n).trim());
  if (note && /^(EP|PP|SP|RCV|PAY|JE|202\d)/i.test(String(note))) return String(note).trim();
  if (group.kind === 'mapping') return `LEG-JE-M${group.mapId}`;
  if (group.kind === 'payment') return `LEG-PAY-${group.payId}`;
  if (group.kind === 'transaction') return `LEG-TXN-${group.txnId}`;
  return `LEG-LINE-${group.lineId}`;
}

function main() {
  const args = process.argv.slice(2);
  const configFlag = args.indexOf('--config');
  const configPath =
    configFlag >= 0 && args[configFlag + 1]
      ? path.resolve(args[configFlag + 1])
      : path.join(TOOLS_ROOT, 'config', 'mapping.example.json');

  const config = fs.existsSync(configPath) ? loadConfig(configPath) : { legacyBusinessId: 2 };
  const businessId = Number(config.legacyBusinessId ?? 2);
  const companyId = String(config.targetCompanyId || '00000000-0000-4000-8000-000000000001');
  const dumpPath = resolveDumpPath(args, config);
  const outDir = resolveOutputDir(config);
  const mapPath = path.join(outDir, 'account_id_map.json');

  if (!fs.existsSync(dumpPath)) {
    console.error(`Dump not found: ${dumpPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(mapPath)) {
    console.error(`Run extractAccounts.js first — missing ${mapPath}`);
    process.exit(1);
  }

  const accountIdMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

  console.log(`Reading dump: ${dumpPath}`);
  const sql = fs.readFileSync(dumpPath, 'utf8');

  const glLines = parseSqlInsertRows(sql, 'accounting_accounts_transactions');
  const mappings = parseSqlInsertRows(sql, 'accounting_acc_trans_mappings');
  const payments = parseSqlInsertRows(sql, 'transaction_payments');
  const accountTxns = parseSqlInsertRows(sql, 'account_transactions');

  const mappingById = new Map(
    mappings
      .filter((m) => Number(m.business_id) === businessId)
      .map((m) => [Number(m.id), m]),
  );

  const paymentById = new Map(
    payments
      .filter((p) => Number(p.business_id) === businessId)
      .map((p) => [Number(p.id), p]),
  );

  const stats = {
    legacyGlLines: glLines.length,
    legacyMappings: mappingById.size,
    legacyPaymentsBusiness: paymentById.size,
    legacyAccountTransactions: accountTxns.length,
    skippedZeroAccount: 0,
    skippedUnmappedAccount: 0,
    skippedDeletedCashbook: 0,
    journalEntries: 0,
    journalLines: 0,
    dateFilterApplied: false,
    dateRange: { min: null, max: null },
  };

  const buckets = new Map();

  for (const row of glLines) {
    const legacyAccountId = Number(row.accounting_account_id);
    if (!legacyAccountId) {
      stats.skippedZeroAccount++;
      continue;
    }
    const mapped = accountIdMap[String(legacyAccountId)];
    if (!mapped?.uuid) {
      stats.skippedUnmappedAccount++;
      continue;
    }

    const group = ledgerGroupKey(row);
    if (!buckets.has(group.key)) {
      buckets.set(group.key, { group, lines: [] });
    }
    buckets.get(group.key).lines.push({ row, mapped });
  }

  const ledgers = [];

  for (const { group, lines: bucketLines } of buckets.values()) {
    const rawLines = bucketLines.map((x) => x.row);
    const mapping =
      group.kind === 'mapping' ? mappingById.get(group.mapId) : null;
    const payment =
      group.kind === 'payment'
        ? paymentById.get(group.payId)
        : rawLines[0]?.transaction_payment_id
          ? paymentById.get(Number(rawLines[0].transaction_payment_id))
          : null;

    const entryDate =
      toEntryDate(mapping?.operation_date) ||
      toEntryDate(payment?.paid_on) ||
      toEntryDate(rawLines[0]?.operation_date) ||
      '';

    if (entryDate) {
      if (!stats.dateRange.min || entryDate < stats.dateRange.min) stats.dateRange.min = entryDate;
      if (!stats.dateRange.max || entryDate > stats.dateRange.max) stats.dateRange.max = entryDate;
    }

    const subType = rawLines[0]?.sub_type;
    const referenceType = mapping
      ? mapReferenceType(mapping.type, null)
      : mapReferenceType(subType, rawLines[0]?.map_type);

    const jeLines = bucketLines.map(({ row, mapped }) => {
      const { debit, credit } = lineDebitCredit(row);
      return {
        account_id: mapped.uuid,
        debit,
        credit,
        description: row.note != null ? String(row.note) : null,
        account: { name: mapped.name, code: mapped.code },
        legacyLineId: Number(row.id),
        legacyAccountId: Number(row.accounting_account_id),
      };
    });

    const totalDebit = jeLines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = jeLines.reduce((s, l) => s + l.credit, 0);

    const legacyPaymentId =
      group.kind === 'payment'
        ? group.payId
        : rawLines[0]?.transaction_payment_id
          ? Number(rawLines[0].transaction_payment_id)
          : null;

    const paymentUuid =
      legacyPaymentId && legacyPaymentId > 0
        ? legacyToUuid('transaction_payments', legacyPaymentId)
        : null;

    const entryNo = buildEntryNo(group, mapping, payment, rawLines);
    const description =
      (mapping?.note && String(mapping.note).trim()) ||
      (payment?.note && String(payment.note).trim()) ||
      rawLines.map((l) => l.note).find((n) => n && String(n).trim()) ||
      entryNo;

    const jeId =
      group.kind === 'mapping'
        ? legacyToUuid('accounting_acc_trans_mappings', group.mapId)
        : group.kind === 'payment'
          ? legacyToUuid('journal_payment', group.payId)
          : group.kind === 'transaction'
            ? legacyToUuid('journal_txn', `${group.txnId}:${referenceType}:${entryDate}`)
            : legacyToUuid('accounting_accounts_transactions', group.lineId);

    const legacyTxnId =
      rawLines[0]?.transaction_id != null && Number(rawLines[0].transaction_id) > 0
        ? Number(rawLines[0].transaction_id)
        : null;

    ledgers.push({
      id: jeId,
      entry_no: entryNo,
      entry_date: entryDate,
      description: String(description),
      reference_type: referenceType,
      reference_id:
        legacyTxnId != null ? legacyToUuid('transactions', legacyTxnId) : null,
      payment_id: paymentUuid,
      payment_reference_number:
        payment?.payment_ref_no != null ? String(payment.payment_ref_no) : null,
      payment_notes: payment?.note != null ? String(payment.note) : null,
      payment_type: payment ? inferPaymentType(payment, rawLines) : null,
      payment_method: payment ? normalizePaymentMethod(payment.method) : null,
      total_debit: totalDebit,
      total_credit: totalCredit,
      posted_at: rawLines[0]?.created_at ? String(rawLines[0].created_at) : null,
      created_at: rawLines[0]?.created_at ? String(rawLines[0].created_at) : null,
      lines: jeLines,
      companyId,
      legacyGroupKey: group.key,
      legacyMappingId: group.kind === 'mapping' ? group.mapId : null,
      legacyPaymentId: legacyPaymentId || null,
      legacyTransactionId: legacyTxnId,
    });
  }

  ledgers.sort((a, b) => {
    const d = (a.entry_date || '').localeCompare(b.entry_date || '');
    if (d !== 0) return d;
    return (a.created_at || '').localeCompare(b.created_at || '');
  });

  stats.journalEntries = ledgers.length;
  stats.journalLines = ledgers.reduce((s, e) => s + e.lines.length, 0);

  const paymentIdsInGl = new Set(
    glLines
      .map((r) => (r.transaction_payment_id != null ? Number(r.transaction_payment_id) : 0))
      .filter((id) => id > 0),
  );

  const cashbookSupplement = [];
  for (const at of accountTxns) {
    if (at.deleted_at) {
      stats.skippedDeletedCashbook++;
      continue;
    }
    const payId =
      at.transaction_payment_id != null ? Number(at.transaction_payment_id) : 0;
    if (!payId || !paymentIdsInGl.has(payId)) continue;

    const pay = paymentById.get(payId);
    if (!pay) continue;

    cashbookSupplement.push({
      legacyAccountTransactionId: Number(at.id),
      legacyAccountsTableAccountId: Number(at.account_id),
      transaction_payment_id: payId,
      type: String(at.type),
      sub_type: at.sub_type != null ? String(at.sub_type) : null,
      amount: Number(at.amount) || 0,
      operation_date: String(at.operation_date || ''),
      note: at.note != null ? String(at.note) : null,
      payment_ref_no: pay.payment_ref_no != null ? String(pay.payment_ref_no) : null,
      _note:
        'Legacy cashbook row (accounts table id). Not mapped via account_id_map — GL lines use accounting_accounts.',
    });
  }

  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'ledgers.json');
  const payload = {
    meta: {
      track: 'A',
      companyId,
      legacyBusinessId: businessId,
      extractedAt: new Date().toISOString(),
      dateFilterApplied: false,
      stats,
      cashbookSupplementCount: cashbookSupplement.length,
    },
    entries: ledgers,
    cashbookSupplement,
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`Wrote ${stats.journalEntries} journal entries (${stats.journalLines} lines) → ${outPath}`);
  console.log(`Legacy GL lines: ${stats.legacyGlLines} | skipped unmapped account: ${stats.skippedUnmappedAccount} | zero account: ${stats.skippedZeroAccount}`);
  console.log(`Date range (no filter): ${stats.dateRange.min} → ${stats.dateRange.max}`);
  console.log(`Cashbook supplement rows (payment-linked): ${cashbookSupplement.length}`);
}

main();
