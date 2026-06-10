import React from 'react';
import { LedgerStatementReportPreview } from '@/app/components/reports/shared/LedgerStatementReportPreview';
import type { LedgerPrintOptions } from '@/app/components/reports/shared/resolveLedgerPrintOptions';
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
  /** When omitted, uses sample brand. Pass company brand for A4 Documents live preview. */
  brand?: CompanyBrand | null;
  /** Full resolved ledger print options from settings. */
  ledgerOptions: LedgerPrintOptions;
  /** @deprecated Prefer ledgerOptions.orientation */
  ledgerOrientation?: LedgerPrintOptions['orientation'];
}

const MOCK_ROWS = [
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

function marginPadding(m: PageMargins): React.CSSProperties {
  return {
    paddingTop: Math.max(8, m.top * 0.5),
    paddingBottom: Math.max(8, m.bottom * 0.5),
    paddingLeft: Math.max(8, m.left * 0.5),
    paddingRight: Math.max(8, m.right * 0.5),
  };
}

/** Ledger statement preview for Settings (matches Ledger Center V2 PDF). */
export function ReportExportPreviewPanel({
  brand,
  ledgerOptions,
  ledgerOrientation,
}: ReportExportPreviewPanelProps) {
  const {
    orientation,
    fieldVisibility,
    showHeader,
    showFooter,
    fontSize,
    fontFamily,
    margins,
  } = ledgerOptions;

  const formatCurrency = (n: number) =>
    `Rs ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const formatDate = (iso: string) => {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const resolvedOrientation = ledgerOrientation ?? orientation;
  const previewBrand = brand ?? MOCK_BRAND;
  const isLandscape = resolvedOrientation === 'landscape';

  return (
    <div className="border border-gray-700 rounded-xl overflow-hidden bg-gray-950 p-3">
      <p className="text-xs text-gray-400 mb-2 font-medium">Ledger report preview (sample)</p>
      <div className="overflow-auto max-h-[520px] flex justify-center">
        <div
          className="bg-white shadow-xl rounded-sm overflow-hidden shrink-0"
          style={{
            width: isLandscape ? 'min(100%, 700px)' : 'min(100%, 520px)',
            aspectRatio: isLandscape ? '297/210' : '210/297',
            maxHeight: '85vh',
          }}
        >
          <div style={marginPadding(margins)}>
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
              rows={MOCK_ROWS}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              fieldVisibility={fieldVisibility}
              showHeader={showHeader}
              showFooter={showFooter}
              orientation={resolvedOrientation}
              fontSize={fontSize}
              fontFamily={fontFamily}
              margins={margins}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
