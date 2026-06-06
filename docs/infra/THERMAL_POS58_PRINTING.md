# 58mm POS Thermal Printing (XP-58 / POS58)

This guide covers the Web ERP thermal receipt path for **58mm roll printers** (e.g. Xprinter XP-58, device name **POSPrinter POS58**).

## Settings

1. Open **Settings → Documents & Printing → Thermal Receipts**
2. Set **Roll width** to **58mm** (system default for new companies)
3. Optional: set **Preferred POS printer name** to `POSPrinter POS58`
4. Click **Save** — syncs `companies.paper_size` and `printer_mode`

## Layout specs (code source of truth)

Defined in [`src/app/constants/thermalPrintDimensions.ts`](../../src/app/constants/thermalPrintDimensions.ts):

| Spec | 58mm value |
|------|------------|
| Screen layout width | 210px |
| Print roll width | 58mm |
| Print margin | 1mm |
| Item / Qty / Amt columns | 52% / 14% / 34% |
| Base font | 9px (compact mode scales down) |

Rendered by [`ThermalReceiptLayout.tsx`](../../src/app/components/shared/invoice/ThermalReceiptLayout.tsx); printed via [`useThermalPrint.ts`](../../src/app/hooks/useThermalPrint.ts).

## Windows setup

1. Install the Xprinter driver and confirm the device appears as **POSPrinter POS58** (or your chosen name)
2. Set it as the **Windows default printer**
3. In ERP Settings → Thermal Receipts, match **Preferred POS printer name**

## Silent / kiosk printing (Chrome / Edge)

The web app cannot bypass the browser print dialog by itself. For unattended POS:

1. Create a shortcut to Chrome or Edge with the flag `--kiosk-printing`
2. Example target:
   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing https://your-erp-url
   ```
3. Ensure Windows default printer is the POS58 device

Constants and hint text: [`printingSettingsService.ts`](../../src/app/services/printingSettingsService.ts) → `POS_SILENT_PRINT_GUIDE`, `getPosPrintAutomationHint()`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Text cut off on right edge | Confirm **58mm** selected in Settings; browser print scale **100%**; margins not enlarged |
| Blank second page | Should not occur — thermal uses `body.print-thermal-receipt` and `.thermal-receipt-root` only |
| Wrong paper width | Save Thermal tab; verify `printing_settings.thermal.paperSize` and `companies.paper_size` |
| Report uses thermal layout | Reports are **A4 only** — see [`reportPrintConfig.ts`](../../src/app/components/reports/shared/reportPrintConfig.ts) |

## What uses thermal vs A4

| Document | Engine |
|----------|--------|
| Sales invoice (thermal) | `ThermalReceiptLayout` |
| POS receipt | `ThermalReceiptLayout` |
| Order slip (thermal) | `ThermalReceiptLayout` |
| Stock Report, Product Sell, Day Book, … | A4 via `useReportExport` — **never thermal** |

See also: [`DOCUMENTS_AND_PRINTING.md`](DOCUMENTS_AND_PRINTING.md)
