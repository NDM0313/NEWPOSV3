import { Fragment } from 'react';
import { ReportBrandHeader } from './ReportBrandHeader';
import type { CompanyBrand } from '../../api/reports';

export type FinancialStatementPdfSection = {
  label: string;
  items: { name: string; amount: number; code?: string }[];
  total: number;
  subgroups?: { groupLabel: string; items: { name: string; amount: number; code?: string }[]; subtotal: number }[];
};

export type FinancialStatementPdfFooterRow = {
  label: string;
  value: string;
  emphasize?: boolean;
};

const fmt = (n: number): string =>
  (Math.abs(n) < 0.005 ? 0 : n).toLocaleString('en-PK', { maximumFractionDigits: 2, minimumFractionDigits: 0 });

export interface FinancialStatementPreviewPdfProps {
  brand: CompanyBrand;
  title: string;
  periodLabel: string;
  sections: FinancialStatementPdfSection[];
  footerRows?: FinancialStatementPdfFooterRow[];
  generatedBy: string;
  generatedAt: string;
}

function renderLineRows(items: { name: string; amount: number; code?: string }[]) {
  return items.map((item, i) => (
    <tr key={`${item.code || item.name}-${i}`}>
      <td style={{ fontFamily: 'monospace', fontSize: 9, color: '#666', width: 56 }}>{item.code || '—'}</td>
      <td>{item.name}</td>
      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(item.amount)}</td>
    </tr>
  ));
}

export function FinancialStatementPreviewPdf({
  brand,
  title,
  periodLabel,
  sections,
  footerRows,
  generatedBy,
  generatedAt,
}: FinancialStatementPreviewPdfProps) {
  return (
    <div>
      <ReportBrandHeader
        brand={brand}
        title={title}
        subtitle={periodLabel}
        metaRows={[
          { label: 'Generated', value: generatedAt },
          { label: 'By', value: generatedBy },
        ]}
      />
      {sections.map((section) => (
        <div key={section.label} style={{ marginBottom: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 4 }}>
            <tbody>
              <tr>
                <td colSpan={3} style={{ fontWeight: 700, fontSize: 12, padding: '6px 0', borderBottom: '1px solid #111' }}>
                  {section.label}
                </td>
              </tr>
            </tbody>
          </table>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', width: 56, borderBottom: '1px solid #ddd', padding: '4px 0' }}>Code</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '4px 0' }}>Account</th>
                <th style={{ textAlign: 'right', width: 90, borderBottom: '1px solid #ddd', padding: '4px 0' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {section.subgroups
                ? section.subgroups.map((group) => (
                    <Fragment key={`${section.label}-${group.groupLabel}`}>
                      <tr>
                        <td colSpan={3} style={{ fontWeight: 600, fontSize: 9, color: '#444', paddingTop: 8 }}>
                          {group.groupLabel}
                        </td>
                      </tr>
                      {renderLineRows(group.items)}
                      <tr>
                        <td colSpan={2} style={{ fontSize: 9, color: '#666', paddingBottom: 4 }}>
                          Subtotal — {group.groupLabel}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 9, paddingBottom: 4 }}>
                          {fmt(group.subtotal)}
                        </td>
                      </tr>
                    </Fragment>
                  ))
                : renderLineRows(section.items)}
              <tr>
                <td colSpan={2} style={{ fontWeight: 700, borderTop: '1px solid #111', paddingTop: 6 }}>
                  Total {section.label}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', borderTop: '1px solid #111', paddingTop: 6 }}>
                  {fmt(section.total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
      {footerRows && footerRows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, fontSize: 11 }}>
          <tbody>
            {footerRows.map((row) => (
              <tr key={row.label}>
                <td style={{ fontWeight: row.emphasize ? 700 : 500, padding: '4px 0' }}>{row.label}</td>
                <td style={{ textAlign: 'right', fontWeight: row.emphasize ? 700 : 500, fontFamily: 'monospace' }}>
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
