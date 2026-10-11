import { ReportBrandHeader } from './ReportBrandHeader';
import type { CompanyBrand } from '../../api/reports';

export interface TimelinePreviewRow {
  time: string;
  party: string;
  reference: string;
  fromAccount?: string;
  toAccount?: string;
  amount: number;
  direction: 'in' | 'out';
  notes?: string;
}

export interface TimelinePreviewGroup {
  date: string;
  rows: TimelinePreviewRow[];
}

export interface TimelinePreviewPdfProps {
  brand: CompanyBrand;
  title: string;
  subtitle?: string;
  totals: { inAmount: number; outAmount: number; net: number; count: number };
  groups: TimelinePreviewGroup[];
  generatedBy: string;
  generatedAt: string;
}

const fmt = (n: number): string =>
  (Math.abs(n) < 0.005 ? 0 : n).toLocaleString('en-PK', { maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** HTML day-book / timeline render for PdfPreviewModal. */
export function TimelinePreviewPdf({ brand, title, subtitle, totals, groups, generatedBy, generatedAt }: TimelinePreviewPdfProps) {
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

      <table style={{ marginBottom: 14 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'right' }}>Received</th>
            <th style={{ textAlign: 'right' }}>Paid</th>
            <th style={{ textAlign: 'right' }}>Net</th>
            <th style={{ textAlign: 'right' }}>Count</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ textAlign: 'right' }}>{fmt(totals.inAmount)}</td>
            <td style={{ textAlign: 'right' }}>{fmt(totals.outAmount)}</td>
            <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(totals.net)}</td>
            <td style={{ textAlign: 'right' }}>{totals.count}</td>
          </tr>
        </tbody>
      </table>

      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#666', padding: 20 }}>No transactions in this period.</div>
      ) : (
        groups.map((g) => (
          <div key={g.date} style={{ marginBottom: 12 }}>
            <div
              style={{
                background: '#eef0f8',
                padding: '5px 10px',
                fontWeight: 700,
                fontSize: 11,
                borderBottom: '1px solid #9ca3af',
              }}
            >
              {g.date}
            </div>
            <table>
              <tbody>
                {g.rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ width: 40, fontWeight: 600, color: r.direction === 'in' ? '#14532d' : '#991b1b' }}>
                      {r.direction === 'in' ? 'IN' : 'OUT'}
                    </td>
                    <td style={{ width: 60 }}>{r.time}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.party}</div>
                      <div style={{ fontSize: 9, color: '#555' }}>
                        {r.reference}
                        {r.fromAccount ? ` · From: ${r.fromAccount}` : ''}
                        {r.toAccount ? ` · To: ${r.toAccount}` : ''}
                      </div>
                      {r.notes && <div style={{ fontSize: 9, color: '#555' }}>{r.notes}</div>}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      <div style={{ marginTop: 20, fontSize: 9, color: '#555', textAlign: 'center', borderTop: '1px solid #e5e7eb', paddingTop: 8 }}>
        Computer-generated report.
      </div>
    </div>
  );
}
