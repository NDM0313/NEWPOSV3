# Thermal Printer Setup — GO-LIVE READINESS

**Generated:** 2025-02-23

---

## 1. Supported Configurations

| Platform | 58mm | 80mm | A4 | Bluetooth | USB | Network |
|----------|------|------|-----|-----------|-----|---------|
| Web ERP | ✅ | ✅ | ✅ | — | Browser print | — |
| Mobile ERP | 🔜 | 🔜 | Browser | 🔜 | — | 🔜 |

---

## 2. Web ERP — Current Implementation

### Printer Config (Settings)
- **Location:** Settings → Printer Configuration (see Phase 4 implementation)
- **DB columns:** `companies.printer_mode`, `companies.paper_size`, `companies.default_printer_name`, `companies.print_receipt_auto`

### Printer Mode
- **thermal** — Receipt layout (58mm or 80mm)
- **a4** — Standard A4 invoice/receipt

### Paper Size (thermal only)
- **58mm** — Narrow receipt (e.g. portable printers)
- **80mm** — Standard receipt (default)

### CSS Print Media
- `ClassicPrintBase` applies `classic-print-thermal` when `printerMode === 'thermal'`
- 80mm: `max-width: 80mm; width: 80mm`
- 58mm: `max-width: 58mm; width: 58mm` (via paper_size)

### ESC/POS Compatibility
- **Current:** Browser print dialog → system print driver
- **ESC/POS raw:** Not implemented for Web (browser cannot send raw bytes to USB/Bluetooth)
- **Recommendation:** Use system print driver; most thermal printers support standard printing when driver installed

---

## 3. Mobile ERP — Required Implementation

### Capacitor Plugin
- **Option:** `@capacitor-community/bluetooth-le` or thermal printer SDK
- **Status:** Not installed

### Printer Type
- **Bluetooth** — Pair with thermal printer via system Bluetooth
- **USB** — Android USB host (OTG); iOS limited
- **Network** — WiFi thermal printers (e.g. Star Micronics, Epson)

### Test Print Button
- **Location:** Settings → Printer Configuration
- **Action:** Send test receipt (company name, date, "Test Print") to selected printer

### Implementation Steps
1. Install Capacitor printer plugin
2. Add `printer_type` (bluetooth | usb | network) to companies or settings
3. Add printer pairing/selection UI
4. Implement `sendRawEscPos(commands: Uint8Array)` for receipt printing
5. Add Test Print in Settings

---

## 4. ESC/POS Commands (Basic)

For raw thermal printing (mobile/native):

```
ESC @     — Initialize printer
ESC a 1   — Center align
GS ! 0    — Normal text size
... text ...
LF        — Line feed
ESC @     — Cut (if supported)
```

---

## 5. Settings UI — Printer Configuration

| Field | Type | Options | Default |
|-------|------|---------|---------|
| Printer Type | Select | Bluetooth / USB / Network | — |
| Paper Size | Select | 58mm / 80mm | 80mm |
| Test Print | Button | — | — |

**Web:** Printer Type = Browser (implicit); Paper Size and Test Print (opens print dialog) available.

---

## 6. Verdict

**Web:** Thermal (58mm/80mm) and A4 supported via CSS and usePrinterConfig. Settings section added.  
**Mobile:** Bluetooth/thermal not implemented. Required for POS-on-mobile with receipt printing.
