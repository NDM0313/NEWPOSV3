import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { Paperclip } from 'lucide-react';
import type { CompanyBrand } from '../../api/reports';
import type { CompanyPrintingSettings, PageMargins } from '../../types/printingSettings';
import { ReportBrandHeader } from './ReportBrandHeader';
import {
  DEFAULT_LEDGER_PRINT_COLUMN_KEYS,
  resolveLedgerColumnLayout,
  type LedgerColumnKey,
  type ResolvedLedgerColumn,
} from '../../lib/ledgerColumnLayout';
import { resolveLedgerPrintOptions } from '../../lib/resolveLedgerPrintOptions';
import type { ReportHeaderFieldVisibility, ReportPrintOrientation } from '../../lib/reportPrintConfig';
import { REPORT_DEFAULT_FONT_SIZE } from '../../lib/reportPrintConfig';

export interface MobileLedgerStatementRow {
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
  hasAttachment?: boolean;
}

export interface MobileLedgerStatementPdfProps {
  brand: CompanyBrand;
  printingSettings?: CompanyPrintingSettings | null;
  title: string;
  partyName: string;
  periodLabel: string;
  branchScopeLabel?: string;
  generatedAt: string;
  openingBalance: number;
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
  rows: MobileLedgerStatementRow[];
  formatCurrency: (n: number) => string;
  formatDate: (iso: string) => string;
  fieldVisibility?: ReportHeaderFieldVisibility;
  showHeader?: boolean;
  showFooter?: boolean;
  orientation?: ReportPrintOrientation;
  fontSize?: number;
  fontFamily?: string;
  margins?: PageMargins;
  columns?: ResolvedLedgerColumn[];
}

const TH_STYLE: CSSProperties = {
  padding: '5px 4px',
  textAlign: 'left',
  fontWeight: 700,
  fontSize: 9,
  background: '#f0f0f0',
  color: '#111',
  border: '1px solid #333',
};

function cellValueForKey(
  row: MobileLedgerStatementRow,
  key: LedgerColumnKey,
  formatCurrency: (n: number) => string,
  formatDate: (iso: string) => string,
): ReactNode {
  switch (key) {
    case 'date':
      return row.date ? formatDate(row.date) : '—';
    case 'reference':
      return row.referenceNo;
    case 'type':
      return row.transactionType;
    case 'description':
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {row.description || '—'}
          {row.hasAttachment ? (
            <span style={{ display: 'inline-flex', color: '#6b7280', flexShrink: 0 }} aria-label="Has attachments">
              <Paperclip size={12} strokeWidth={2} />
            </span>
          ) : null}
        </span>
      );
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

/** A4 ledger statement PDF — 8-column layout synced with web printing_settings.reportExport. */
export function MobileLedgerStatementPdf({
  brand,
  printingSettings,
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
  fieldVisibility: fieldVisibilityProp,
  showHeader: showHeaderProp,
  showFooter: showFooterProp,
  orientation: orientationProp,
  fontSize: fontSizeProp,
  fontFamily: fontFamilyProp,
  margins: marginsProp,
  columns: columnsProp,
}: MobileLedgerStatementPdfProps) {
  const resolved = useMemo(() => resolveLedgerPrintOptions(printingSettings), [printingSettings]);

  const fieldVisibility = fieldVisibilityProp ?? resolved.fieldVisibility;
  const showHeader = showHeaderProp ?? resolved.showHeader;
  const showFooter = showFooterProp ?? resolved.showFooter;
  const orientation = orientationProp ?? resolved.orientation;
  const fontSize = fontSizeProp ?? resolved.fontSize;
  const fontFamily = fontFamilyProp ?? resolved.fontFamily;
  const margins = marginsProp ?? resolved.margins;

  const columns = useMemo(
    () =>
      columnsProp ??
      resolveLedgerColumnLayout(printingSettings, { useShortLabels: true }).filter((c) =>
        (DEFAULT_LEDGER_PRINT_COLUMN_KEYS as string[]).includes(c.key),
      ),
    [columnsProp, printingSettings],
  );

  const colKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const colCount = columns.length;
  const isDenseLayout = colCount >= 9;
  const balanceIdx = colKeys.indexOf('balance');
  const firstAmountIdx = colKeys.findIndex((k) => k === 'debit' || k === 'credit' || k === 'balance');

  const metaSubtitle = `${periodLabel} · ${branchScopeLabel}`;
  const tableFont = Math.max(8, (fontSize ?? REPORT_DEFAULT_FONT_SIZE) - 1 - (isDenseLayout ? 1 : 0));

  const marginStyle: CSSProperties | undefined = margins
    ? {
        paddingTop: margins.top,
        paddingBottom: margins.bottom,
        paddingLeft: margins.left,
        paddingRight: margins.right,
      }
    : undefined;

  const tdStyle = (col: ResolvedLedgerColumn, extra?: CSSProperties): CSSProperties => {
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
      className={`ledger-report-print${orientation === 'landscape' ? ' pdf-document-landscape' : ''}`}
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
      ) : null}

      <table
        className="report-table pdf-ledger-table"
        style={{ width: '100%', borderCollapse: 'collapse', fontSize: tableFont, tableLayout: 'fixed' }}
      >
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
          {rows.length === 0 ? (
            <tr>
              <td colSpan={colCount} style={{ textAlign: 'center', color: '#666', padding: 14 }}>
                No transactions in this period.
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
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
            ))
          )}
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

      {showFooter ? (
        <div
          style={{
            marginTop: 16,
            fontSize: 9,
            color: '#555',
            textAlign: 'center',
            borderTop: '1px solid #e5e7eb',
            paddingTop: 8,
          }}
        >
          Page 1 of 1 · Computer-generated document
        </div>
      ) : null}
    </div>
  );
}
