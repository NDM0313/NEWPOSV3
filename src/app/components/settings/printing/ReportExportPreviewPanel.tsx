import React, { useState } from 'react';
import { LedgerStatementReportPreview } from '@/app/components/reports/shared/LedgerStatementReportPreview';
import { CashBookReportPreview } from '@/app/components/reports/shared/CashBookReportPreview';
import { ROZNAMCHA_PRINT_COLUMNS } from '@/app/components/reports/shared/buildRoznamchaPrintPreview';
import type { LedgerPrintOptions } from '@/app/components/reports/shared/resolveLedgerPrintOptions';
import type { AccountingReportPrintOptions } from '@/app/components/reports/shared/resolveAccountingReportPrintOptions';
import type { CompanyBrand } from '@/app/services/companyBrandService';
import type { PageMargins } from '@/app/types/printingSettings';

const MOCK_BRAND: CompanyBrand = {
  name: 'Your Company',
  address: '123 Main Street',
  phone: '+92 300 0000000',
  email: 'info@company.com',
  website: null,
  taxNumber: null,
  logoUrl: null,
  city: 'Lahore',
  country: 'Pakistan',
};

interface ReportExportPreviewPanelProps {
  brand?: CompanyBrand | null;
  ledgerOptions: LedgerPrintOptions;
  roznamchaOptions?: AccountingReportPrintOptions;
  ledgerOrientation?: LedgerPrintOptions['orientation'];
}

const MOCK_LEDGER_ROWS = [
  {
    date: '2026-04-01',
    referenceNo: 'INV-1042',
    transactionType: 'Sale Invoice',
    description: 'Silk bridal set',
    branch: 'Main Branch',
    debit: 45000,
    credit: 0,
    runningBalance: 45000,
  },
  {
    date: '2026-04-05',
    referenceNo: 'PAY-0891',
    transactionType: 'Payment',
    description: 'Bank transfer',
    branch: 'Main Branch',
    debit: 0,
    credit: 20000,
    runningBalance: 25000,
  },
];

const MOCK_CASH_BOOK_ROWS: (string | number)[][] = [
  ['01 Apr 2026 10:30', 'RCV-0042', 'Customer receipt — Invoice SL-0027', 'HBL Main', 25000, '', 125000],
  ['02 Apr 2026 14:00', 'EXP-0110 / JE-0456', 'Shop expense — utilities', 'Cash in hand', '', 8500, 116500],
];

function marginPadding(m: PageMargins): React.CSSProperties {
  return {
    paddingTop: Math.max(8, m.top * 0.5),
    paddingBottom: Math.max(8, m.bottom * 0.5),
    paddingLeft: Math.max(8, m.left * 0.5),
    paddingRight: Math.max(8, m.right * 0.5),
  };
}

/** Settings preview for tabular / cash-book report exports. */
export function ReportExportPreviewPanel({
  brand,
  ledgerOptions,
  roznamchaOptions,
  ledgerOrientation,
}: ReportExportPreviewPanelProps) {
  const [tab, setTab] = useState<'ledger' | 'cashbook'>('ledger');
  const previewBrand = brand ?? MOCK_BRAND;
  const cashOpts = roznamchaOptions ?? ledgerOptions;
  const formatCurrency = (n: number) =>
    `Rs ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const formatDate = (iso: string) => {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const resolvedOrientation =
    tab === 'cashbook'
      ? cashOpts.orientation
      : (ledgerOrientation ?? ledgerOptions.orientation);
  const isLandscape = resolvedOrientation === 'landscape';

  return (
    <div className="border border-gray-700 rounded-xl overflow-hidden bg-gray-950 p-3">
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => setTab('ledger')}
          className={`text-xs px-2 py-1 rounded ${tab === 'ledger' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
        >
          Ledger statement
        </button>
        <button
          type="button"
          onClick={() => setTab('cashbook')}
          className={`text-xs px-2 py-1 rounded ${tab === 'cashbook' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
        >
          Roznamcha / Cash book
        </button>
      </div>
      <div className="overflow-auto max-h-[520px] flex justify-center">
        <div
          className="bg-white shadow-xl rounded-sm overflow-hidden shrink-0"
          style={{
            width: isLandscape ? 'min(100%, 700px)' : 'min(100%, 520px)',
            aspectRatio: isLandscape ? '297/210' : '210/297',
            maxHeight: '85vh',
          }}
        >
          <div style={marginPadding(tab === 'cashbook' ? cashOpts.margins : ledgerOptions.margins)}>
            {tab === 'ledger' ? (
              <LedgerStatementReportPreview
                brand={previewBrand}
                title="Customer Ledger"
                partyName="Sample Customer"
                periodLabel="01 Apr 2026 → 10 Jun 2026"
                branchScopeLabel="All branches (GL scope)"
                generatedAt={new Date().toLocaleString('en-GB')}
                openingBalance={12000}
                closingBalance={25000}
                totalDebit={45000}
                totalCredit={20000}
                rows={MOCK_LEDGER_ROWS}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
                fieldVisibility={ledgerOptions.fieldVisibility}
                showHeader={ledgerOptions.showHeader}
                showFooter={ledgerOptions.showFooter}
                orientation={resolvedOrientation}
                fontSize={ledgerOptions.fontSize}
                fontFamily={ledgerOptions.fontFamily}
                margins={ledgerOptions.margins}
              />
            ) : (
              <CashBookReportPreview
                brand={previewBrand}
                title="Roznamcha (Daily Cash Book)"
                periodLabel="01 Apr 2026 → 10 Jun 2026"
                branchScopeLabel="All branches"
                generatedAt={new Date().toLocaleString('en-GB')}
                columns={ROZNAMCHA_PRINT_COLUMNS}
                rows={MOCK_CASH_BOOK_ROWS}
                summaryStats={[
                  { label: 'Opening', value: formatCurrency(100000) },
                  { label: 'Cash In', value: formatCurrency(25000) },
                  { label: 'Cash Out', value: formatCurrency(8500) },
                  { label: 'Closing', value: formatCurrency(116500) },
                ]}
                openingBalance={formatCurrency(100000)}
                closingBalance={formatCurrency(116500)}
                fieldVisibility={cashOpts.fieldVisibility}
                showHeader={cashOpts.showHeader}
                showFooter={cashOpts.showFooter}
                orientation={resolvedOrientation}
                fontSize={cashOpts.fontSize}
                fontFamily={cashOpts.fontFamily}
                margins={cashOpts.margins}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
