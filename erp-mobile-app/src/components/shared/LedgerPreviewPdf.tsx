import type { ReactNode } from 'react';
import { ReportBrandHeader } from './ReportBrandHeader';
import type { CompanyBrand } from '../../api/reports';

export interface LedgerPreviewRow {
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface LedgerPreviewPdfProps {
  brand: CompanyBrand;
  title: string;
  subtitle?: string;
  partyName?: string;
  partyMeta?: string;
  openingBalance?: number;
  closingBalance?: number;
  totals: { debit: number; credit: number };
  rows: LedgerPreviewRow[];
  generatedBy: string;
  generatedAt: string;
  /** Optional footer / additional content */
  footer?: ReactNode;
}

const fmt = (n: number): string =>
  (Math.abs(n) < 0.005 ? 0 : n).toLocaleString('en-PK', { maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** HTML ledger for PdfPreviewModal. Matches the ledger-style PDF produced by generateLedgerPDF but in DOM. */
export function LedgerPreviewPdf({
  brand,
  title,
  subtitle,
  partyName,
  partyMeta,
  openingBalance = 0,
  closingBalance,
  totals,
  rows,
  generatedBy,
  generatedAt,
  footer,
}: LedgerPreviewPdfProps) {
  const runningClose = closingBalance ?? openingBalance + totals.debit - totals.credit;
  return (
    <div>
      <ReportBrandHeader
        brand={brand}
        title={title}
        subtitle={subtitle}
        metaRows={[
          { label: 'Generated', value: generatedAt },
          { label: 'By', value: generatedBy },
        ]}
      />
      {partyName && (
        <div style={{ marginBottom: 10, padding: '8px 10px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{partyName}</div>
          {partyMeta && <div style={{ fontSize: 10, color: '#333' }}>{partyMeta}</div>}
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th style={{ width: 80 }}>Date</th>
            <th style={{ width: 90 }}>Reference</th>
            <th>Description</th>
            <th style={{ width: 70, textAlign: 'right' }}>Debit</th>
            <th style={{ width: 70, textAlign: 'right' }}>Credit</th>
            <th style={{ width: 80, textAlign: 'right' }}>Balance</th>
          </tr>
        </thead>
        <tbody>
          {openingBalance !== 0 && (
            <tr>
              <td colSpan={5} style={{ fontWeight: 600 }}>Opening Balance</td>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(openingBalance)}</td>
            </tr>
          )}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', color: '#666', padding: 14 }}>
                No transactions in this period.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i}>
                <td style={{ width: 80 }}>{r.date}</td>
                <td style={{ width: 90 }}>{r.reference}</td>
                <td>{r.description}</td>
                <td style={{ textAlign: 'right' }}>{r.debit ? fmt(r.debit) : '—'}</td>
                <td style={{ textAlign: 'right' }}>{r.credit ? fmt(r.credit) : '—'}</td>
                <td style={{ textAlign: 'right' }}>{fmt(r.balance)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>Totals</td>
            <td style={{ textAlign: 'right' }}>{fmt(totals.debit)}</td>
            <td style={{ textAlign: 'right' }}>{fmt(totals.credit)}</td>
            <td style={{ textAlign: 'right' }}>{fmt(runningClose)}</td>
          </tr>
        </tfoot>
      </table>
      {footer}
      <div style={{ marginTop: 20, fontSize: 9, color: '#555', textAlign: 'center', borderTop: '1px solid #e5e7eb', paddingTop: 8 }}>
        This is a computer-generated document — no signature required.
      </div>
    </div>
  );
}
