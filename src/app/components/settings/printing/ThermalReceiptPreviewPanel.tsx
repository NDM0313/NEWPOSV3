import React from 'react';
import { useSettings } from '@/app/context/SettingsContext';
import { useCompanyLogoDisplayUrl } from '@/app/hooks/useCompanyLogoDisplayUrl';
import type { ThermalSettings } from '@/app/types/printingSettings';
import {
  ThermalReceiptLayout,
  type ThermalPaperSize,
  type ThermalReceiptLineItem,
} from '@/app/components/shared/invoice/ThermalReceiptLayout';

interface ThermalReceiptPreviewPanelProps {
  thermal: ThermalSettings;
}

const MOCK_ITEMS: ThermalReceiptLineItem[] = [
  { key: '1', name: 'Sample Product A', qty: '2', amount: '5,000' },
  { key: '2', name: 'Sample Product B', qty: '1', amount: '1,800' },
];

/** Mini tabular report preview for Settings → Thermal Receipts. */
export function ThermalReceiptPreviewPanel({ thermal }: ThermalReceiptPreviewPanelProps) {
  const { company } = useSettings();
  const logoUrl = useCompanyLogoDisplayUrl(thermal.showLogo ? company.logoUrl : undefined);
  const paperSize: ThermalPaperSize = thermal.paperSize ?? '58mm';

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-input-background p-3">
      <p className="text-xs text-muted-foreground mb-2 font-medium">Thermal preview (sample)</p>
      <div className="flex justify-center overflow-auto max-h-[520px] py-2">
        <ThermalReceiptLayout
          paperSize={paperSize}
          thermal={thermal}
          companyName={company.name || 'Your Company'}
          companyAddress={company.address}
          companyPhone={company.phone}
          logoUrl={logoUrl || undefined}
          invoiceNo="INV-SAMPLE"
          invoiceDate={new Date().toLocaleDateString()}
          customerName="Walk-in"
          cashierName={thermal.showCashier ? 'Admin' : undefined}
          lineItems={MOCK_ITEMS}
          totalRows={[{ label: 'TOTAL', value: '6,800', bold: true }]}
        />
      </div>
      <p className="text-[11px] text-muted-foreground mt-2 text-center">
        {paperSize} roll · toggles update live
      </p>
    </div>
  );
}
