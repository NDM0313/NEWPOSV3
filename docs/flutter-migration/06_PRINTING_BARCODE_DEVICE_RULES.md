# 06 — Printing, Barcode, and Device Rules

## Print pipeline (current Capacitor)

Unified order in [`printService.ts`](../../erp-mobile-app/src/services/printService.ts):

1. **Sunmi built-in** (AIDL via `ErpPrinterPlugin.java`)
2. **Bluetooth ESC/POS** (SPP, MAC address from settings)
3. **Browser / PDF** fallback (web dev, A4)

### Key files

| File | Role |
|------|------|
| [`services/printService.ts`](../../erp-mobile-app/src/services/printService.ts) | Probe backend, dispatch print |
| [`services/thermalPrint.ts`](../../erp-mobile-app/src/services/thermalPrint.ts) | ESC/POS UTF-8 encoding |
| [`services/saleThermalReceipt.ts`](../../erp-mobile-app/src/services/saleThermalReceipt.ts) | Sale receipt line builder |
| [`services/printAfterTransaction.ts`](../../erp-mobile-app/src/services/printAfterTransaction.ts) | Post-transaction auto-print hook |
| [`lib/erpPrinterNative.ts`](../../erp-mobile-app/src/lib/erpPrinterNative.ts) | Capacitor bridge |
| [`android/.../ErpPrinterPlugin.java`](../../erp-mobile-app/android/app/src/main/java/com/dincouture/erp/ErpPrinterPlugin.java) | Native Sunmi + Bluetooth |
| [`android/.../MainActivity.java`](../../erp-mobile-app/android/app/src/main/java/com/dincouture/erp/MainActivity.java) | Registers plugins |
| [`api/printingSettings.ts`](../../erp-mobile-app/src/api/printingSettings.ts) | Server printing settings |
| [`api/companyPrinter.ts`](../../erp-mobile-app/src/api/companyPrinter.ts) | Company printer config |
| [`components/settings/SettingsPrinterSection.tsx`](../../erp-mobile-app/src/components/settings/SettingsPrinterSection.tsx) | Printer UI |

### Printer settings (mobile)

Stored in `settings` table key `mobile_printer` ([`api/settings.ts`](../../erp-mobile-app/src/api/settings.ts)):

| Field | Values |
|-------|--------|
| `mode` | `thermal` \| `a4` |
| `paperSize` | `58mm` \| `80mm` |
| `autoPrintReceipt` | boolean |
| `bluetoothDeviceAddress` | MAC e.g. `00:11:22:33:44:55` |

Company-level printer: [`companyPrinter.ts`](../../erp-mobile-app/src/api/companyPrinter.ts).

### Document types

| Type | Format | Typical use |
|------|--------|-------------|
| Sale receipt | Thermal ESC/POS | POS checkout |
| Invoice | PDF (jsPDF) | Share / email / WhatsApp |
| Payment receipt | Thermal + PDF | [`sharePaymentReceipt.ts`](../../erp-mobile-app/src/lib/sharePaymentReceipt.ts) |
| Barcode label | Thermal or A4 sheet | [`barcodeLabelPrint.ts`](../../erp-mobile-app/src/services/barcodeLabelPrint.ts) |
| Reports | PDF previews | `*PreviewPdf.tsx` components |

PDF generation: [`utils/pdfGenerator.ts`](../../erp-mobile-app/src/utils/pdfGenerator.ts) — native share via Capacitor Filesystem + Share.

## WhatsApp sharing

| File | Role |
|------|------|
| [`lib/sharePaymentReceipt.ts`](../../erp-mobile-app/src/lib/sharePaymentReceipt.ts) | Share sheet / WhatsApp fallback |
| [`lib/phoneWhatsApp.ts`](../../erp-mobile-app/src/lib/phoneWhatsApp.ts) | `wa.me` URL helpers |
| [`lib/erpWhatsApp.ts`](../../erp-mobile-app/src/lib/erpWhatsApp.ts) | Android native bridge |
| [`ErpWhatsAppPlugin.java`](../../erp-mobile-app/android/app/src/main/java/com/dincouture/erp/ErpWhatsAppPlugin.java) | PDF intent to WhatsApp |

Flutter: `share_plus` for generic share; platform channel for WhatsApp PDF intent on Android if needed.

## Barcode / camera scanner

### Scan (POS / product lookup)

| File | Role |
|------|------|
| [`features/barcode/barcodeService.ts`](../../erp-mobile-app/src/features/barcode/barcodeService.ts) | ML Kit scan (native only) |
| [`features/barcode/useBarcodeScanner.ts`](../../erp-mobile-app/src/features/barcode/useBarcodeScanner.ts) | Scanner hook |
| [`features/barcode/BarcodeScanner.tsx`](../../erp-mobile-app/src/features/barcode/BarcodeScanner.tsx) | Scanner UI |
| [`features/barcode/mlkit-stub.ts`](../../erp-mobile-app/src/features/barcode/mlkit-stub.ts) | Web/dev stub |
| [`components/sales/BarcodeCameraModal.tsx`](../../erp-mobile-app/src/components/sales/BarcodeCameraModal.tsx) | Camera modal in sales/POS |

Vite aliases real ML Kit away unless `VITE_TARGET=capacitor` ([`vite.config.ts`](../../erp-mobile-app/vite.config.ts)).

Flow: scan barcode → lookup product by barcode/SKU → add to cart.

### Label print

| File | Role |
|------|------|
| [`services/barcodeLabelPrint.ts`](../../erp-mobile-app/src/services/barcodeLabelPrint.ts) | Label print dispatch |
| [`lib/barcodeLabelLines.ts`](../../erp-mobile-app/src/lib/barcodeLabelLines.ts) | Label line formatting |
| [`components/products/PrintBarcodeLabelModal.tsx`](../../erp-mobile-app/src/components/products/PrintBarcodeLabelModal.tsx) | Batch label UI |
| [`components/products/BarcodeLabelPrintSheet.tsx`](../../erp-mobile-app/src/components/products/BarcodeLabelPrintSheet.tsx) | Label sheet |

Uses `jsbarcode` for barcode images in PDF/print paths.

## Android device configuration

From [`android/app/build.gradle`](../../erp-mobile-app/android/app/build.gradle) and [`android/variables.gradle`](../../erp-mobile-app/android/variables.gradle):

| Setting | Value |
|---------|-------|
| `applicationId` | `com.dincouture.erp` |
| `minSdk` | 24 (Android 7.0+) |
| `targetSdk` / `compileSdk` | 36 |
| JDK | 17 |
| `versionCode` | 39 (bump each release) |
| `versionName` | 1.0.5 |

### Permissions ([`AndroidManifest.xml`](../../erp-mobile-app/android/app/src/main/AndroidManifest.xml))

- `CAMERA` — barcode scan
- `INTERNET`
- `READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE` (maxSdk 32)
- `BLUETOOTH`, `BLUETOOTH_ADMIN` (maxSdk 30)
- `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN`

### Network / WebView

- `usesCleartextTraffic="true"`
- [`network_security_config.xml`](../../erp-mobile-app/android/app/src/main/res/xml/network_security_config.xml)
- Capacitor `android.allowMixedContent: true` ([`capacitor.config.ts`](../../erp-mobile-app/capacitor.config.ts))

### Sunmi V2 Pro considerations

- Primary production POS device class (Android 7+, built-in thermal)
- Test: Sunmi AIDL path before Bluetooth fallback
- Verify receipt width for `58mm` vs `80mm` paper settings
- Camera scanner on older Android may need lower preview resolution

## Flutter implementation options

| Feature | Recommended approach |
|---------|---------------------|
| Thermal Sunmi | Platform channel port of `ErpPrinterPlugin` or Sunmi vendor SDK |
| Bluetooth ESC/POS | `esc_pos_utils` + `flutter_bluetooth_serial` / `print_bluetooth_thermal` |
| PDF invoice | `pdf` + `printing` package |
| Share | `share_plus` |
| Barcode scan | `mobile_scanner` (ML Kit on Android) |
| Camera attachments | `image_picker` |

Suggested `lib/device/` structure:

```
lib/device/
  printing/print_service.dart
  printing/thermal_encoder.dart
  printing/sunmi_channel.dart
  barcode/barcode_scanner_screen.dart
  sharing/whatsapp_share.dart
```

## Real device test checklist

### Thermal print

- [ ] Sunmi V2 Pro: sale receipt after POS checkout
- [ ] Sunmi: payment receipt
- [ ] Bluetooth printer paired: receipt prints to paired MAC
- [ ] Auto-print on/off respects `autoPrintReceipt` setting
- [ ] 58mm vs 80mm paper size formatting
- [ ] Unicode product names render correctly on thermal

### PDF / share

- [ ] Invoice PDF preview opens
- [ ] Share sheet exports PDF
- [ ] WhatsApp share sends PDF on Android (native plugin path)
- [ ] Payment receipt share includes correct RCV reference

### Barcode

- [ ] POS scan adds correct product to cart
- [ ] Invalid barcode shows user-friendly error
- [ ] Product label batch print (1+ labels)
- [ ] Camera permission prompt on first scan

### Regression

- [ ] Print after offline sync (sale synced then print)
- [ ] No print duplicate on retry
- [ ] `log_print` RPC called when applicable ([`sales.ts`](../../erp-mobile-app/src/api/sales.ts))
