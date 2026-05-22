import { useState } from 'react';
import { Loader2, Printer, Scan } from 'lucide-react';
import * as settingsApi from '../../api/settings';
import type { ReceiptFieldToggles } from '../../api/printingSettings';

export interface SettingsPrinterSectionProps {
  companyId: string | null;
  isAdminOrOwner: boolean;
  printerConfig: settingsApi.MobilePrinterSettings;
  printerSaving: boolean;
  printerError: string | null;
  printerBackendLabel: string;
  receiptFields: ReceiptFieldToggles;
  receiptFieldsSaving: boolean;
  receiptBrandPreview: string;
  bluetoothDevices: { name: string; address: string }[];
  labelSettings: settingsApi.MobileBarcodeLabelSettings;
  barcodeSettings: settingsApi.MobileBarcodeScannerSettings;
  barcodeSaving: boolean;
  onPrinterMode: (mode: settingsApi.MobilePrinterMode) => void;
  onPaperSize: (size: settingsApi.MobilePrinterPaperSize) => void;
  onAutoPrint: (enabled: boolean) => void;
  onBluetoothSelect: (address: string) => void;
  onTestPrint: () => void;
  onToggleReceiptField: (key: keyof ReceiptFieldToggles, value: boolean) => void;
  onLabelSettingsChange: (next: settingsApi.MobileBarcodeLabelSettings) => void;
  onBarcodeMethod: (method: settingsApi.BarcodeScannerMethod) => void;
  onPersistLabelSettings: (next: settingsApi.MobileBarcodeLabelSettings) => Promise<void>;
}

export function SettingsPrinterSection({
  companyId,
  isAdminOrOwner,
  printerConfig,
  printerSaving,
  printerError,
  printerBackendLabel,
  receiptFields,
  receiptFieldsSaving,
  receiptBrandPreview,
  bluetoothDevices,
  labelSettings,
  barcodeSettings,
  barcodeSaving,
  onPrinterMode,
  onPaperSize,
  onAutoPrint,
  onBluetoothSelect,
  onTestPrint,
  onToggleReceiptField,
  onLabelSettingsChange,
  onBarcodeMethod,
  onPersistLabelSettings,
}: SettingsPrinterSectionProps) {
  const [labelBusy, setLabelBusy] = useState(false);
  const persistLabel = (next: settingsApi.MobileBarcodeLabelSettings) => {
    onLabelSettingsChange(next);
    if (!companyId) return;
    setLabelBusy(true);
    void onPersistLabelSettings(next).finally(() => setLabelBusy(false));
  };

  return (
    <>
      <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#6B7280]/20">
            <Printer className="w-5 h-5 text-[#9CA3AF]" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-white text-sm">Printer</p>
            <p className="text-xs text-[#9CA3AF]">Thermal or A4</p>
          </div>
          {printerSaving && <Loader2 className="w-5 h-5 text-[#3B82F6] animate-spin" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onPrinterMode('thermal')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              printerConfig.mode === 'thermal' ? 'bg-[#3B82F6] text-white' : 'bg-[#374151] text-[#9CA3AF]'
            }`}
          >
            Thermal
          </button>
          <button
            type="button"
            onClick={() => onPrinterMode('a4')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              printerConfig.mode === 'a4' ? 'bg-[#3B82F6] text-white' : 'bg-[#374151] text-[#9CA3AF]'
            }`}
          >
            A4
          </button>
        </div>
        {printerConfig.mode === 'thermal' && (
          <div className="flex gap-2">
            {(['58mm', '80mm'] as const).map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => onPaperSize(sz)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  printerConfig.paperSize === sz ? 'bg-[#3B82F6] text-white' : 'bg-[#374151] text-[#9CA3AF]'
                }`}
              >
                {sz}
              </button>
            ))}
          </div>
        )}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={printerConfig.autoPrintReceipt}
            onChange={(e) => onAutoPrint(e.target.checked)}
            className="w-4 h-4 rounded border-[#4B5563] bg-[#374151] text-[#3B82F6]"
          />
          <span className="text-sm text-[#E5E7EB]">Auto-print receipt after sale</span>
        </label>
        {printerConfig.mode === 'thermal' && bluetoothDevices.length > 0 && (
          <select
            value={printerConfig.bluetoothDeviceAddress ?? ''}
            onChange={(e) => onBluetoothSelect(e.target.value)}
            className="w-full bg-[#111827] border border-[#374151] rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">Sunmi built-in (if available)</option>
            {bluetoothDevices.map((d) => (
              <option key={d.address} value={d.address}>
                {d.name} ({d.address})
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={onTestPrint}
          disabled={printerSaving}
          className="px-3 py-2 rounded-lg text-sm font-medium bg-[#374151] text-white disabled:opacity-50"
        >
          Test print
        </button>
        {printerError && <p className="text-sm text-red-400">{printerError}</p>}
        <p className="text-[10px] text-[#6B7280]">
          Source: {printerBackendLabel || '—'}
          {isAdminOrOwner ? ' · Synced to web' : ''}
        </p>
        <details className="text-xs">
          <summary className="text-[#3B82F6] cursor-pointer font-medium">Receipt header fields</summary>
          <div className="mt-2 space-y-2 border-t border-[#374151] pt-2">
            {receiptBrandPreview && <p className="text-[#6B7280]">{receiptBrandPreview}</p>}
            {(
              [
                ['showLogo', 'Logo placeholder'],
                ['showCompanyAddress', 'Address'],
                ['showPhone', 'Phone'],
                ['showDiscount', 'Discount line'],
                ['showTax', 'Tax line'],
                ['showStudioCost', 'Studio cost'],
                ['showNotes', 'Notes'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={receiptFields[key]}
                  disabled={receiptFieldsSaving}
                  onChange={(e) => onToggleReceiptField(key, e.target.checked)}
                  className="w-4 h-4 rounded border-[#4B5563] bg-[#374151] text-[#3B82F6]"
                />
                <span className="text-[#E5E7EB]">{label}</span>
              </label>
            ))}
          </div>
        </details>
      </div>

      <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-2">
        <p className="font-medium text-white text-sm">Barcode labels</p>
        <div className="flex flex-wrap gap-2">
          {(['thermal', 'a4'] as const).map((layout) => (
            <button
              key={layout}
              type="button"
              disabled={labelBusy}
              onClick={() => persistLabel({ ...labelSettings, labelLayout: layout })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                labelSettings.labelLayout === layout ? 'bg-[#3B82F6] text-white' : 'bg-[#374151] text-[#9CA3AF]'
              }`}
            >
              {layout === 'thermal' ? 'Thermal' : 'A4 sheet'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-3">
          <Scan className="w-5 h-5 text-[#9CA3AF]" />
          <p className="font-medium text-white text-sm flex-1">Barcode scanner</p>
          {barcodeSaving && <Loader2 className="w-4 h-4 text-[#3B82F6] animate-spin" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onBarcodeMethod('keyboard_wedge')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              barcodeSettings.method === 'keyboard_wedge' ? 'bg-[#3B82F6] text-white' : 'bg-[#374151] text-[#9CA3AF]'
            }`}
          >
            Keyboard wedge
          </button>
          <button
            type="button"
            onClick={() => onBarcodeMethod('camera')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              barcodeSettings.method === 'camera' ? 'bg-[#3B82F6] text-white' : 'bg-[#374151] text-[#9CA3AF]'
            }`}
          >
            Camera (native)
          </button>
        </div>
        <p className="text-[10px] text-[#6B7280]">
          {barcodeSettings.method === 'keyboard_wedge'
            ? 'Hardware scanner types into focused field.'
            : 'Uses device camera (ML Kit) on iOS/Android.'}
        </p>
      </div>
    </>
  );
}
