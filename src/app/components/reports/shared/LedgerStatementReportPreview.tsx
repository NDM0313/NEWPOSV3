import React, { useMemo } from 'react';

import type { CompanyBrand } from '@/app/services/companyBrandService';
import type { PageMargins } from '@/app/types/printingSettings';

import type { ReportHeaderFieldVisibility, ReportPrintOrientation } from './reportPrintConfig';

import { REPORT_DEFAULT_FONT_SIZE } from './reportPrintConfig';

import { ReportBrandHeader } from './ReportBrandHeader';

import { ReportBrandFooter } from './ReportBrandFooter';

import {
  DEFAULT_LEDGER_PRINT_COLUMN_KEYS,
  resolveLedgerColumnLayout,
  type LedgerColumnKey,
  type ResolvedLedgerColumn,
} from './ledgerColumnLayout';

export interface LedgerStatementReportRow {
  date: string;
  referenceNo: string;
  transactionType: string;
  description: string;
  branch?: string;
  debit: number;
  credit: number;
  runningBalance: number;
  paymentMethod?: string;
  createdBy?: string;
}

export interface LedgerStatementReportPreviewProps {
  brand: CompanyBrand;
  title: string;
  partyName: string;
  periodLabel: string;
  branchScopeLabel?: string;
  generatedAt: string;
  openingBalance: number;
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
  rows: LedgerStatementReportRow[];
  formatCurrency: (n: number) => string;
  formatDate: (iso: string) => string;
  fieldVisibility?: ReportHeaderFieldVisibility;
  showHeader?: boolean;
  showFooter?: boolean;
  orientation?: ReportPrintOrientation;
  fontSize?: number;
  fontFamily?: string;
  margins?: PageMargins;
  /** Resolved print columns (order + width). Defaults to standard 8-column layout. */
  columns?: ResolvedLedgerColumn[];
}

const TH_STYLE: React.CSSProperties = {
  padding: '5px 4px',
  textAlign: 'left',
  fontWeight: 700,
  fontSize: 9,
  background: '#f0f0f0',
  color: '#111',
  border: '1px solid #333',
};

function cellValueForKey(
  row: LedgerStatementReportRow,
  key: LedgerColumnKey,
  formatCurrency: (n: number) => string,
  formatDate: (iso: string) => string,
): React.ReactNode {
  switch (key) {
    case 'date':
      return row.date ? formatDate(row.date) : '—';
    case 'reference':
      return row.referenceNo;
    case 'type':
      return row.transactionType;
    case 'description':
      return row.description || '—';
    case 'branch':
      return row.branch || '—';
    case 'debit':
      return row.debit ? formatCurrency(row.debit) : '—';
    case 'credit':
      return row.credit ? formatCurrency(row.credit) : '—';
    case 'balance':
      return formatCurrency(row.runningBalance);
    case 'payment':
      return row.paymentMethod || '—';
    case 'createdBy':
      return row.createdBy || '—';
    default:
      return '—';
  }
}

/**
 * A4 ledger statement PDF — configurable column layout (Tier A).
 */
export function LedgerStatementReportPreview({
  brand,
  title,
  partyName,
  periodLabel,
  branchScopeLabel = 'All branches (GL scope)',
  generatedAt,
  openingBalance,
  closingBalance,
  totalDebit,
  totalCredit,
  rows,
  formatCurrency,
  formatDate,
  fieldVisibility,
  showHeader = true,
  showFooter = true,
  orientation = 'portrait',
  fontSize = REPORT_DEFAULT_FONT_SIZE,
  fontFamily = 'Arial, Helvetica, sans-serif',
  margins,
  columns: columnsProp,
}: LedgerStatementReportPreviewProps) {
  const columns = useMemo(
    () =>
      columnsProp ??
      resolveLedgerColumnLayout(null, { useShortLabels: true }).filter((c) =>
        (DEFAULT_LEDGER_PRINT_COLUMN_KEYS as string[]).includes(c.key),
      ),
    [columnsProp],
  );

  const colKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const colCount = columns.length;
  const isDenseLayout = colCount >= 9;
  const balanceIdx = colKeys.indexOf('balance');
  const firstAmountIdx = colKeys.findIndex((k) => k === 'debit' || k === 'credit' || k === 'balance');

  const landscapeClass = orientation === 'landscape' ? 'pdf-document-landscape' : '';
  const compactClass = isDenseLayout ? 'pdf-document-compact' : '';
  const rootClass = ['pdf-document', 'ledger-report-print', landscapeClass, compactClass, 'bg-white text-black'].filter(Boolean).join(' ');
  const tableFont = Math.max(8, fontSize - 1 - (isDenseLayout ? 1 : 0));
  const metaSubtitle = `${periodLabel} · ${branchScopeLabel}`;

  const marginStyle: React.CSSProperties | undefined = margins
    ? {
        paddingTop: margins.top,
        paddingBottom: margins.bottom,
        paddingLeft: margins.left,
        paddingRight: margins.right,
      }
    : undefined;

  const tdStyle = (col: ResolvedLedgerColumn, extra?: React.CSSProperties): React.CSSProperties => {
    const wrapKeys: LedgerColumnKey[] = ['description', 'type', 'branch', 'payment', 'createdBy'];
    return {
      padding: '3px 4px',
      textAlign: col.align,
      width: `${col.widthPct}%`,
      ...(isDenseLayout && wrapKeys.includes(col.key) ? { overflowWrap: 'break-word', wordBreak: 'break-word' } : {}),
      ...extra,
    };
  };

  return (
    <div
      className={rootClass}
      data-print-format="a4"
      style={{
        fontFamily,
        fontSize: tableFont,
        color: '#111',
        ...marginStyle,
      }}
    >
      {showHeader ? (
        <div className="report-first-page-block">
          <ReportBrandHeader
            brand={brand}
            title={title}
            subtitle={partyName}
            metaRows={[
              { label: 'Period', value: metaSubtitle },
              { label: 'Generated', value: generatedAt },
            ]}
            fieldVisibility={fieldVisibility}
          />

          <table
            role="presentation"
            className="report-summary"
            cellPadding={0}
            cellSpacing={0}
            style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}
          >
            <tbody>
              <tr>
                {[
                  { label: 'Opening', value: formatCurrency(openingBalance) },
                  { label: 'Closing', value: formatCurrency(closingBalance) },
                  { label: 'Total debit', value: formatCurrency(totalDebit) },
                  { label: 'Total credit', value: formatCurrency(totalCredit) },
                ].map((s) => (
                  <td
                    key={s.label}
                    style={{
                      border: '1px solid #ccc',
                      padding: '5px 6px',
                      textAlign: 'center',
                      fontSize: 9,
                      width: '25%',
                      color: '#111',
                      background: '#fff',
                    }}
                  >
                    <div style={{ color: '#666', fontSize: 8, marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontWeight: 700, color: '#111' }}>{s.value}</div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="report-first-page-block">
          <div className="report-title-block" style={{ marginBottom: 14, borderBottom: '2px solid #111', paddingBottom: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 700, textTransform: 'uppercase', color: '#111' }}>{title}</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4, color: '#111' }}>{partyName}</div>
            <div style={{ fontSize: 10, marginTop: 4, color: '#444' }}>
              {metaSubtitle} · Generated: {generatedAt}
            </div>
          </div>

          <table
            role="presentation"
            className="report-summary"
            cellPadding={0}
            cellSpacing={0}
            style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}
          >
            <tbody>
              <tr>
                {[
                  { label: 'Opening', value: formatCurrency(openingBalance) },
                  { label: 'Closing', value: formatCurrency(closingBalance) },
                  { label: 'Total debit', value: formatCurrency(totalDebit) },
                  { label: 'Total credit', value: formatCurrency(totalCredit) },
                ].map((s) => (
                  <td
                    key={s.label}
                    style={{
                      border: '1px solid #ccc',
                      padding: '5px 6px',
                      textAlign: 'center',
                      fontSize: 9,
                      width: '25%',
                      color: '#111',
                      background: '#fff',
                    }}
                  >
                    <div style={{ color: '#666', fontSize: 8, marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontWeight: 700, color: '#111' }}>{s.value}</div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <table className="report-table pdf-ledger-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: tableFont, tableLayout: 'fixed' }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  ...TH_STYLE,
                  textAlign: col.align,
                  width: `${col.widthPct}%`,
                }}
              >
                {col.shortLabel}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr style={{ background: '#f3f4f6', fontWeight: 600 }}>
            {balanceIdx >= 0 ? (
              <>
                <td colSpan={balanceIdx} style={{ padding: '4px 5px', color: '#111' }}>
                  Opening balance
                </td>
                <td style={{ padding: '4px 5px', textAlign: 'right', color: '#111' }}>
                  {formatCurrency(openingBalance)}
                </td>
                {balanceIdx < colCount - 1 ? (
                  <td colSpan={colCount - balanceIdx - 1} style={{ padding: '4px 5px' }} />
                ) : null}
              </>
            ) : (
              <>
                <td colSpan={colCount - 1} style={{ padding: '4px 5px', color: '#111' }}>
                  Opening balance
                </td>
                <td style={{ padding: '4px 5px', textAlign: 'right', color: '#111' }}>
                  {formatCurrency(openingBalance)}
                </td>
              </>
            )}
          </tr>
          {rows.map((row, i) => (
            <tr key={`${row.referenceNo}-${i}`} style={{ borderBottom: '1px solid #ddd' }}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={tdStyle(col, {
                    fontFamily: col.key === 'reference' ? 'monospace' : undefined,
                    fontSize: col.key === 'reference' || col.key === 'type' || col.key === 'branch' ? 9 : undefined,
                    fontWeight: col.key === 'balance' ? 600 : undefined,
                    whiteSpace: col.key === 'date' ? 'nowrap' : undefined,
                  })}
                >
                  {cellValueForKey(row, col.key, formatCurrency, formatDate)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f3f4f6', fontWeight: 700 }}>
            {firstAmountIdx >= 0 ? (
              <>
                <td colSpan={firstAmountIdx} style={{ padding: '5px 4px', textAlign: 'right', color: '#111' }}>
                  Totals / Closing balance
                </td>
                {columns.slice(firstAmountIdx).map((col) => (
                  <td key={col.key} style={{ ...tdStyle(col), fontWeight: 700 }}>
                    {col.key === 'debit'
                      ? formatCurrency(totalDebit)
                      : col.key === 'credit'
                        ? formatCurrency(totalCredit)
                        : col.key === 'balance'
                          ? formatCurrency(closingBalance)
                          : ''}
                  </td>
                ))}
              </>
            ) : (
              <td colSpan={colCount} style={{ padding: '5px 4px', textAlign: 'right', color: '#111' }}>
                Closing: {formatCurrency(closingBalance)}
              </td>
            )}
          </tr>
        </tfoot>
      </table>

      {showFooter ? <ReportBrandFooter currentPage={1} totalPages={1} /> : null}
    </div>
  );
}
