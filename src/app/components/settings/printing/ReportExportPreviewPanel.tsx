import React from 'react';
import { TabularReportPreview } from '@/app/components/reports/shared/TabularReportPreview';
import type { ReportHeaderFieldVisibility } from '@/app/components/reports/shared/reportPrintConfig';
import type { Orientation } from '@/app/types/printingSettings';
import type { CompanyBrand } from '@/app/services/companyBrandService';

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
  fieldVisibility: ReportHeaderFieldVisibility;
  stockOrientation: Orientation;
  showHeader?: boolean;
  showFooter?: boolean;
}

/** Mini tabular report preview for Settings → Reports & Export. */
export function ReportExportPreviewPanel({
  fieldVisibility,
  stockOrientation,
  showHeader = true,
  showFooter = true,
}: ReportExportPreviewPanelProps) {
  return (
    <div className="border border-gray-700 rounded-xl overflow-hidden bg-gray-950 p-3">
      <p className="text-xs text-gray-400 mb-2 font-medium">Report preview (sample)</p>
      <div className="overflow-auto max-h-[520px]">
        <TabularReportPreview
          brand={MOCK_BRAND}
          title="Stock Report"
          subtitle="3 product row(s) — sample"
          generatedAt={new Date().toLocaleString()}
          columns={[
            { key: 'sku', label: 'SKU' },
            { key: 'product', label: 'Product' },
            { key: 'stock', label: 'Stock', align: 'right' },
          ]}
          rows={[
            ['PRD-001', 'Sample Product A', '24'],
            ['PRD-002', 'Sample Product B', '12'],
            ['PRD-003', 'Sample Product C', '0'],
          ]}
          fieldVisibility={fieldVisibility}
          showHeader={showHeader}
          showFooter={showFooter}
          compact
          orientation={stockOrientation}
          stats={[
            { label: 'Closing (Cost)', value: 'Rs 125,000' },
            { label: 'Closing (Retail)', value: 'Rs 180,000' },
          ]}
        />
      </div>
    </div>
  );
}
