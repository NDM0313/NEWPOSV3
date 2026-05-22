import type { MobileBarcodeLabelSettings, MobilePrinterSettings } from '../../api/settings';
import { BarcodeLabelPrintSheet } from './BarcodeLabelPrintSheet';
import { linesFromProducts } from '../../lib/barcodeLabelLines';

interface PrintBarcodeLabelModalProps {
  open: boolean;
  onClose: () => void;
  productName: string;
  sku: string;
  barcode: string;
  price?: number;
  businessName?: string;
  labelSettings: MobileBarcodeLabelSettings;
  printerSettings: MobilePrinterSettings;
}

/** Thin wrapper: single-product print via shared batch sheet. */
export function PrintBarcodeLabelModal({
  open,
  onClose,
  productName,
  sku,
  barcode,
  price,
  businessName,
  labelSettings,
  printerSettings,
}: PrintBarcodeLabelModalProps) {
  const code = (barcode || sku || '').trim();
  const lines = linesFromProducts(
    [
      {
        id: 'single',
        name: productName,
        sku: sku || code,
        barcode: code,
        retailPrice: price,
      },
    ],
    labelSettings,
  );

  return (
    <BarcodeLabelPrintSheet
      open={open}
      onClose={onClose}
      title="Print labels"
      lines={lines}
      labelSettings={labelSettings}
      printerSettings={printerSettings}
      businessName={businessName}
    />
  );
}
