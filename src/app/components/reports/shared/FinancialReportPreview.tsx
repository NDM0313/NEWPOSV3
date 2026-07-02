import React from 'react';

import type { CompanyBrand } from '@/app/services/companyBrandService';
import type { PageMargins } from '@/app/types/printingSettings';

import {
  FinancialReportDataTable,
  FinancialReportPrintLayout,
} from '@/app/components/reports/FinancialReportPrintLayout';
import type { ReportHeaderFieldVisibility, ReportPrintOrientation } from './reportPrintConfig';

export interface FinancialReportPreviewProps {
  brand: CompanyBrand;
  title: string;
  periodLabel: string;
  branchLabel?: string;
  generatedAt: string;
  headers: string[];
  rows: (string | number)[][];
  fieldVisibility?: ReportHeaderFieldVisibility;
  showHeader?: boolean;
  showFooter?: boolean;
  orientation?: ReportPrintOrientation;
  fontSize?: number;
  fontFamily?: string;
  margins?: PageMargins;
}

export function FinancialReportPreview({
  brand,
  title,
  periodLabel,
  branchLabel,
  generatedAt,
  headers,
  rows,
  fieldVisibility,
  showHeader = true,
  showFooter = true,
  orientation = 'portrait',
  fontSize,
  fontFamily,
  margins,
}: FinancialReportPreviewProps) {
  return (
    <FinancialReportPrintLayout
      title={title}
      periodLabel={periodLabel}
      branchLabel={branchLabel}
      brand={brand}
      generatedAt={generatedAt}
      fieldVisibility={fieldVisibility}
      showHeader={showHeader}
      showFooter={showFooter}
      orientation={orientation}
      fontSize={fontSize}
      fontFamily={fontFamily}
      margins={margins}
    >
      <FinancialReportDataTable headers={headers} rows={rows} />
    </FinancialReportPrintLayout>
  );
}
