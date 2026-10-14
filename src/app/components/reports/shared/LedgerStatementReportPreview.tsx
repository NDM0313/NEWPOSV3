import React, { useMemo } from 'react';

import type { CompanyBrand } from '@/app/services/companyBrandService';
import type { PageMargins } from '@/app/types/printingSettings';

import type { ReportHeaderFieldVisibility, ReportPrintOrientation } from './reportPrintConfig';

import { REPORT_DEFAULT_FONT_SIZE, formatReportMoneyDisplay } from './reportPrintConfig';

import { ReportBrandHeader } from './ReportBrandHeader';

import { ReportBrandFooter } from './ReportBrandFooter';

import { LEDGER_EXPORT_COLUMNS } from './ledgerExportColumns';
import { resolveLedgerColumnWidths } from './resolveLedgerPrintOptions';

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
  dataListFontSize?: number;
  tableHeaderFontSize?: number;
  summaryFontSize?: number;
  columnPaddingPx?: number;
  showCurrencySymbol?: boolean;
  /** Per-column width % or 'auto'. */
  columnWidths?: Record<string, number | 'auto'>;
  fontFamily?: string;
  margins?: PageMargins;
  /** Show payment method + created-by columns (default: landscape). Ignored when visibleColumns is set. */
  showOptionalColumns?: boolean;
  /** Same keys as LEDGER_EXPORT_COLUMNS / Columns picker. When set, drives which columns print. */
  visibleColumns?: Record<string, boolean>;
}

const MONEY_KEYS = new Set(['debit', 'credit', 'balance']);
const OPTIONAL_KEYS = new Set(['payment', 'createdBy']);

type PreviewCol = { key: string; label: string; align: 'left' | 'right' };

const PREVIEW_COLUMNS: PreviewCol[] = LEDGER_EXPORT_COLUMNS.map((c) => ({
  key: c.key,
  label: c.key === 'reference' ? 'Ref' : c.key === 'payment' ? 'Payment' : c.key === 'createdBy' ? 'Created By' : c.label,
  align: c.align === 'right' ? 'right' : 'left',
}));

/**
 * A4 ledger statement PDF — column set follows Columns picker when visibleColumns is passed.
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
  dataListFontSize,
  tableHeaderFontSize,
  summaryFontSize,
  columnPaddingPx = 4,
  showCurrencySymbol = true,
  columnWidths,
  fontFamily = 'Arial, Helvetica, sans-serif',
  margins,
  showOptionalColumns,
  visibleColumns,
}: LedgerStatementReportPreviewProps) {
  const includeOptionalLegacy = showOptionalColumns ?? orientation === 'landscape';

  const visibleCols = useMemo(() => {
    return PREVIEW_COLUMNS.filter((col) => {
      if (visibleColumns) {
        return visibleColumns[col.key] !== false;
      }
      if (OPTIONAL_KEYS.has(col.key)) return includeOptionalLegacy;
      return true;
    });
  }, [visibleColumns, includeOptionalLegacy]);

  const colCount = visibleCols.length;
  const beforeMoneyIdx = visibleCols.findIndex((c) => MONEY_KEYS.has(c.key));
  const beforeMoneyCount = beforeMoneyIdx >= 0 ? beforeMoneyIdx : colCount;

  const landscapeClass = orientation === 'landscape' ? 'pdf-document-landscape' : '';
  const rootClass = ['pdf-document', landscapeClass, 'bg-white text-black'].filter(Boolean).join(' ');
  const listFont = dataListFontSize ?? Math.max(9, fontSize - 1);
  const headerFont = tableHeaderFontSize ?? Math.max(8, listFont - 1);
  const bandFont = summaryFontSize ?? Math.max(8, listFont - 1);
  const footerFont = Math.max(9, Math.round(listFont * 1.15));
  const hPad = Math.max(2, Math.min(10, columnPaddingPx));
  const resolvedColumnWidths = columnWidths ?? resolveLedgerColumnWidths();
  const metaSubtitle = `${periodLabel} · ${branchScopeLabel}`;

  const money = (n: number) => formatReportMoneyDisplay(formatCurrency(n), showCurrencySymbol);

  const footerLabelStyle: React.CSSProperties = {
    padding: `5px ${hPad}px`,
    textAlign: 'center',
    color: '#111',
    border: '1px solid #d4d4d4',
    fontSize: footerFont,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  };

  const footerMoneyStyle: React.CSSProperties = {
    padding: `5px ${hPad}px`,
    textAlign: 'right',
    color: '#111',
    border: '1px solid #d4d4d4',
    fontSize: footerFont,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
    overflow: 'hidden',
  };

  const marginStyle: React.CSSProperties | undefined = margins
    ? {
        paddingTop: margins.top,
        paddingBottom: margins.bottom,
        paddingLeft: margins.left,
        paddingRight: margins.right,
      }
    : undefined;

  const thStyle: React.CSSProperties = {
    padding: `5px ${hPad}px`,
    textAlign: 'left',
    fontWeight: 600,
    fontSize: headerFont,
    background: '#f7f7f7',
    color: '#111',
    border: '1px solid #d4d4d4',
  };

  const cellValue = (row: LedgerStatementReportRow, key: string): React.ReactNode => {
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
        return row.debit ? money(row.debit) : '—';
      case 'credit':
        return row.credit ? money(row.credit) : '—';
      case 'balance':
        return money(row.runningBalance);
      case 'payment':
        return row.paymentMethod || '—';
      case 'createdBy':
        return row.createdBy || '—';
      default:
        return '—';
    }
  };

  const cellStyle = (key: string, align: 'left' | 'right'): React.CSSProperties => {
    const isDesc = key === 'description';
    const isMoney = MONEY_KEYS.has(key);
    return {
      padding: `3px ${hPad}px`,
      textAlign: align,
      border: '1px solid #d4d4d4',
      whiteSpace: isDesc ? 'normal' : 'nowrap',
      wordBreak: isDesc ? 'break-word' : undefined,
      overflowWrap: isDesc ? 'anywhere' : undefined,
      overflow: isDesc ? undefined : 'hidden',
      textOverflow: isDesc ? undefined : 'ellipsis',
      fontFamily: key === 'reference' ? 'monospace' : undefined,
      fontSize:
        key === 'reference' || key === 'type' || key === 'branch' || OPTIONAL_KEYS.has(key)
          ? Math.max(8, listFont - 1)
          : listFont,
      fontWeight: key === 'balance' ? 600 : undefined,
      ...(isMoney ? { whiteSpace: 'nowrap' as const } : null),
    };
  };

  return (
    <div
      className={rootClass}
      data-print-format="a4"
      style={{
        fontFamily,
        fontSize: listFont,
        color: '#111',
        ...marginStyle,
      }}
    >
      {showHeader ? (
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
      ) : (
        <div style={{ marginBottom: 14, borderBottom: '2px solid #111', paddingBottom: 10 }}>
          <div style={{ fontSize: Math.max(14, fontSize + 5), fontWeight: 700, textTransform: 'uppercase', color: '#111' }}>{title}</div>
          <div style={{ fontSize: Math.max(11, fontSize + 1), fontWeight: 600, marginTop: 4, color: '#111' }}>{partyName}</div>
          <div style={{ fontSize: Math.max(9, fontSize - 1), marginTop: 4, color: '#444' }}>
            {metaSubtitle} · Generated: {generatedAt}
          </div>
        </div>
      )}

      <table
        role="presentation"
        cellPadding={0}
        cellSpacing={0}
        style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}
      >
        <tbody>
          <tr>
            {[
              { label: 'Opening', value: money(openingBalance) },
              { label: 'Closing', value: money(closingBalance) },
              { label: 'Total debit', value: money(totalDebit) },
              { label: 'Total credit', value: money(totalCredit) },
            ].map((s) => (
              <td
                key={s.label}
                style={{
                  border: '1px solid #d4d4d4',
                  padding: `5px ${hPad}px`,
                  textAlign: 'center',
                  fontSize: bandFont,
                  width: '25%',
                  color: '#111',
                  background: '#fafafa',
                }}
              >
                <div style={{ color: '#666', fontSize: Math.max(7, bandFont - 1), marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontWeight: 700, color: '#111' }}>{s.value}</div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {colCount > 0 ? (
        <>
        <table
          className="pdf-ledger-table"
          style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: listFont }}
        >
          <colgroup>
            {visibleCols.map((col) => {
              const w = resolvedColumnWidths[col.key];
              const isAuto = w === 'auto' || w == null;
              return (
                <col
                  key={col.key}
                  style={isAuto ? undefined : { width: `${w}%` }}
                />
              );
            })}
          </colgroup>
          <thead>
            <tr>
              {visibleCols.map((col) => (
                <th key={col.key} style={{ ...thStyle, textAlign: col.align }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: '#f7f7f7', fontWeight: 600 }}>
              {colCount <= 1 ? (
                <td style={{ padding: `4px ${hPad}px`, color: '#111', border: '1px solid #d4d4d4' }}>
                  Opening balance {money(openingBalance)}
                </td>
              ) : (
                <>
                  <td colSpan={colCount - 1} style={{ padding: `4px ${hPad}px`, color: '#111', border: '1px solid #d4d4d4' }}>
                    Opening balance
                  </td>
                  <td style={{ padding: `4px ${hPad}px`, textAlign: 'right', color: '#111', border: '1px solid #d4d4d4' }}>
                    {money(openingBalance)}
                  </td>
                </>
              )}
            </tr>
            {rows.map((row, i) => (
              <tr key={`${row.referenceNo}-${i}`}>
                {visibleCols.map((col) => (
                  <td key={col.key} style={cellStyle(col.key, col.align)}>
                    {cellValue(row, col.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <table
          style={{
            width: '100%',
            tableLayout: 'fixed',
            borderCollapse: 'collapse',
            marginTop: -1,
            fontSize: footerFont,
          }}
        >
          <colgroup>
            {visibleCols.map((col) => {
              const w = resolvedColumnWidths[col.key];
              const isAuto = w === 'auto' || w == null;
              return (
                <col
                  key={col.key}
                  style={isAuto ? undefined : { width: `${w}%` }}
                />
              );
            })}
          </colgroup>
          <tbody>
            <tr style={{ background: '#f7f7f7' }}>
              {beforeMoneyCount > 0 ? (
                <td colSpan={beforeMoneyCount} style={footerLabelStyle}>
                  Totals / Closing balance
                </td>
              ) : null}
              {visibleCols.slice(beforeMoneyCount).map((col) => (
                <td key={col.key} style={footerMoneyStyle}>
                  {col.key === 'debit'
                    ? money(totalDebit)
                    : col.key === 'credit'
                      ? money(totalCredit)
                      : col.key === 'balance'
                        ? money(closingBalance)
                        : null}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </>
      ) : null}

      {showFooter ? <ReportBrandFooter currentPage={1} totalPages={1} /> : null}
    </div>
  );
}
