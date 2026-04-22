import { ReportBrandHeader } from './ReportBrandHeader';
import type { CompanyBrand } from '../../api/reports';

export interface AgingPreviewBucket {
  label: string;
  count: number;
  amount: number;
}

export interface AgingPreviewParty {
  name: string;
  meta?: string;
  buckets: number[];
  total: number;
}

export interface AgingPreviewPdfProps {
  brand: CompanyBrand;
  title: string;
  subtitle?: string;
  bucketLabels: string[];
  totals: AgingPreviewBucket[];
  grandTotal: number;
  parties: AgingPreviewParty[];
  generatedBy: string;
  generatedAt: string;
}

const fmt = (n: number): string =>
  (Math.abs(n) < 0.005 ? 0 : n).toLocaleString('en-PK', { maximumFractionDigits: 2, minimumFractionDigits: 0 });

export function AgingPreviewPdf({
  brand,
  title,
  subtitle,
  bucketLabels,
  totals,
  grandTotal,
  parties,
  generatedBy,
  generatedAt,
}: AgingPreviewPdfProps) {
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
            <th>Bucket</th>
            <th style={{ textAlign: 'right' }}>Parties</th>
            <th style={{ textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {totals.map((b) => (
            <tr key={b.label}>
              <td>{b.label}</td>
              <td style={{ textAlign: 'right' }}>{b.count}</td>
              <td style={{ textAlign: 'right' }}>{fmt(b.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>Grand Total</td>
            <td style={{ textAlign: 'right' }}>{fmt(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>

      <table>
        <thead>
          <tr>
            <th>Party</th>
            {bucketLabels.map((l) => (
              <th key={l} style={{ textAlign: 'right' }}>{l}</th>
            ))}
            <th style={{ textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {parties.length === 0 ? (
            <tr>
              <td colSpan={bucketLabels.length + 2} style={{ textAlign: 'center', color: '#666', padding: 14 }}>
                No outstanding balances.
              </td>
            </tr>
          ) : (
            parties.map((p, i) => (
              <tr key={i}>
                <td>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  {p.meta && <div style={{ fontSize: 9, color: '#555' }}>{p.meta}</div>}
                </td>
                {p.buckets.map((v, j) => (
                  <td key={j} style={{ textAlign: 'right' }}>{v ? fmt(v) : '—'}</td>
                ))}
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(p.total)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div style={{ marginTop: 20, fontSize: 9, color: '#555', textAlign: 'center', borderTop: '1px solid #e5e7eb', paddingTop: 8 }}>
        Computer-generated report.
      </div>
    </div>
  );
}
