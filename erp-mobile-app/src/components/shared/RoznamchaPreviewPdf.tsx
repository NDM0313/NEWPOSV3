import { ReportBrandHeader } from './ReportBrandHeader';
import type { CompanyBrand } from '../../api/reports';
import type { RoznamchaRowWithBalance, RoznamchaSummary } from '../../api/roznamcha';
import { formatRoznamchaRowDescription } from '../../lib/roznamchaRowDescription';

export interface RoznamchaPreviewPdfProps {
  brand: CompanyBrand;
  title: string;
  subtitle?: string;
  summary: RoznamchaSummary;
  rows: RoznamchaRowWithBalance[];
  generatedBy: string;
  generatedAt: string;
}

const fmt = (n: number): string =>
  (Math.abs(n) < 0.005 ? 0 : n).toLocaleString('en-PK', { maximumFractionDigits: 2, minimumFractionDigits: 0 });

function rowDateTimeLines(r: RoznamchaRowWithBalance): { date: string; time: string } {
  const t = r.time?.length === 5 ? `${r.time}:00` : r.time || '00:00:00';
  try {
    const d = new Date(`${r.date}T${t}`);
    return {
      date: d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }),
    };
  } catch {
    return { date: r.date, time: r.time || '' };
  }
}

function accountDisplay(r: RoznamchaRowWithBalance): string {
  return r.accountName?.trim() || r.accountLabel || '—';
}

/** HTML Roznamcha for PdfPreviewModal — In/Out/Balance (ledger-style cash book). */
export function RoznamchaPreviewPdf({
  brand,
  title,
  subtitle,
  summary,
  rows,
  generatedBy,
  generatedAt,
}: RoznamchaPreviewPdfProps) {
  const totalIn = summary.cashIn;
  const totalOut = summary.cashOut;

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

      <table style={{ marginBottom: 14, width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'right' }}>Opening</th>
            <th style={{ textAlign: 'right' }}>Cash In</th>
            <th style={{ textAlign: 'right' }}>Cash Out</th>
            <th style={{ textAlign: 'right' }}>Closing</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ textAlign: 'right' }}>{fmt(summary.openingBalance)}</td>
            <td style={{ textAlign: 'right' }}>{fmt(summary.cashIn)}</td>
            <td style={{ textAlign: 'right' }}>{fmt(summary.cashOut)}</td>
            <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(summary.closingBalance)}</td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', fontSize: 9 }}>
        <thead>
          <tr>
            <th style={{ width: 88 }}>Date &amp; Time</th>
            <th style={{ width: 72 }}>Ref</th>
            <th>Details</th>
            <th style={{ width: 72 }}>Account</th>
            <th style={{ width: 44, textAlign: 'right' }}>In</th>
            <th style={{ width: 44, textAlign: 'right' }}>Out</th>
            <th style={{ width: 56, textAlign: 'right' }}>Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={4} style={{ fontWeight: 600 }}>
              Opening Balance
            </td>
            <td style={{ textAlign: 'right' }}>—</td>
            <td style={{ textAlign: 'right' }}>—</td>
            <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(summary.openingBalance)}</td>
          </tr>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', color: '#666', padding: 14 }}>
                No transactions in this period.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => {
              const { date: dateLine, time: timeLine } = rowDateTimeLines(r);
              return (
              <tr key={r.id || i}>
                <td>
                  <div>{dateLine}</div>
                  {timeLine ? (
                    <div style={{ fontSize: 8, color: '#555', marginTop: 2 }}>{timeLine}</div>
                  ) : null}
                </td>
                <td>
                  {r.ref}
                  {r.journalEntryNo ? <div style={{ fontSize: 8, color: '#555' }}>{r.journalEntryNo}</div> : null}
                </td>
                <td style={{ whiteSpace: 'pre-wrap' }}>{formatRoznamchaRowDescription(r)}</td>
                <td>{accountDisplay(r)}</td>
                <td style={{ textAlign: 'right' }}>{r.cashIn ? fmt(r.cashIn) : '—'}</td>
                <td style={{ textAlign: 'right' }}>{r.cashOut ? fmt(r.cashOut) : '—'}</td>
                <td style={{ textAlign: 'right' }}>{fmt(r.runningBalance)}</td>
              </tr>
            );
            })
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} style={{ fontWeight: 600 }}>
              Totals
            </td>
            <td style={{ textAlign: 'right' }}>{fmt(totalIn)}</td>
            <td style={{ textAlign: 'right' }}>{fmt(totalOut)}</td>
            <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(summary.closingBalance)}</td>
          </tr>
        </tfoot>
      </table>

      <div
        style={{
          marginTop: 20,
          fontSize: 9,
          color: '#555',
          textAlign: 'center',
          borderTop: '1px solid #e5e7eb',
          paddingTop: 8,
        }}
      >
        This is a computer-generated document — no signature required.
      </div>
    </div>
  );
}
