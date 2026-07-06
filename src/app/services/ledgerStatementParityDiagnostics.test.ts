import { describe, expect, it } from 'vitest';
import {
  accountStatementAndLedgerV2RequestsMatch,
  buildAccountStatementCustomerRequest,
  buildLedgerV2CustomerRequest,
  countOpeningRows,
  deriveClosingBalanceFromEntries,
  deriveClosingFromDebitCreditMovements,
  diffLedgerStatementRows,
  partyStatementBasisFromFlags,
  type ParityLedgerEntry,
} from './ledgerStatementParityDiagnostics';

function row(partial: Partial<ParityLedgerEntry>): ParityLedgerEntry {
  return {
    date: '2026-01-01',
    reference_number: 'RCV-1',
    description: 'Payment',
    debit: 0,
    credit: 100,
    running_balance: 900,
    journal_entry_id: 'je-1',
    ...partial,
  };
}

describe('ledgerStatementParityDiagnostics', () => {
  it('maps same params to equivalent service requests', () => {
    const a = buildAccountStatementCustomerRequest({
      contactId: 'c1',
      companyId: 'co1',
      startDate: '2025-01-01',
      endDate: '2026-06-14',
    });
    const b = buildLedgerV2CustomerRequest({
      contactId: 'c1',
      companyId: 'co1',
      fromDate: '2025-01-01',
      toDate: '2026-06-14',
    });
    expect(accountStatementAndLedgerV2RequestsMatch(a, b)).toBe(true);
    expect(a.loader).toBe('accountingService.getCustomerLedger');
    expect(b.loader).toBe('accountingService.getCustomerLedger');
    expect(a.branchId).toBeUndefined();
    expect(b.branchId).toBeUndefined();
  });

  it('detects date range mismatch in request parity', () => {
    const a = buildAccountStatementCustomerRequest({
      contactId: 'c1',
      companyId: 'co1',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
    });
    const b = buildLedgerV2CustomerRequest({
      contactId: 'c1',
      companyId: 'co1',
      fromDate: '2025-01-01',
      toDate: '2026-06-14',
    });
    expect(accountStatementAndLedgerV2RequestsMatch(a, b)).toBe(false);
  });

  it('party basis defaults to audit when adjustments enabled', () => {
    expect(partyStatementBasisFromFlags(true, false)).toBe('audit_full');
    expect(partyStatementBasisFromFlags(false, false)).toBe('effective_party');
  });

  it('diff detects rows only in one set', () => {
    const base = [
      row({ date: '2026-01-01', reference_number: 'SAL-1', debit: 1000, credit: 0, running_balance: 1000, journal_entry_id: 'je-s' }),
      row({ date: '2026-01-02', reference_number: 'RCV-1', debit: 0, credit: 200, running_balance: 800 }),
    ];
    const extra = [...base, row({ date: '2026-04-27', reference_number: 'RCV-2', debit: 0, credit: 100, running_balance: 700 })];
    const diff = diffLedgerStatementRows(base, extra);
    expect(diff.onlyInB).toHaveLength(1);
    expect(diff.balanceA).toBe(800);
    expect(diff.balanceB).toBe(700);
    expect(diff.difference).toBe(100);
  });

  it('opening row is not counted as duplicate when single opening present', () => {
    const withOpening = [
      row({
        date: '2025-01-01',
        reference_number: '-',
        description: 'Opening Balance',
        document_type: 'Opening Balance',
        debit: 0,
        credit: 0,
        running_balance: 0,
        journal_entry_id: '',
      }),
      row({ running_balance: 500, debit: 500, credit: 0 }),
    ];
    expect(countOpeningRows(withOpening)).toBe(1);
    expect(deriveClosingBalanceFromEntries(withOpening)).toBe(500);
  });

  it('flags synthetic rows without journal_entry_id', () => {
    const rows = [
      row({ journal_entry_id: '', reference_number: 'SAL-X', debit: 100, credit: 0, running_balance: 100 }),
    ];
    const diff = diffLedgerStatementRows(rows, rows);
    expect(diff.syntheticRowsA).toHaveLength(1);
    expect(diff.onlyInA).toHaveLength(0);
    expect(diff.difference).toBe(0);
  });

  it('account ledger after liquidity cancel includes voided original + reversal and nets to opening', () => {
    const movements = [
      { debit: 500000, credit: 0 },
      { debit: 500000, credit: 0 },
      { debit: 0, credit: 500000 },
    ];
    expect(deriveClosingFromDebitCreditMovements(0, movements)).toBe(500000);
  });
});
