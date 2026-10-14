# Phase 6 partial — Flutter ERP mobile

**Status:** Device-adjacent features + offline queue foundation.

## Added

| Feature | Notes |
|---------|--------|
| Offline mutation queue | `shared_preferences` pending store; draft sale + POS checkout |
| Sync engine | `OfflineSyncService.runSync()` + banner + auto-sync on reconnect |
| Products list cache | Read-through cache when network fails |
| Barcode scan (POS) | `mobile_scanner` → product lookup by SKU/barcode |
| Share invoice | `share_plus` text summary on sale detail |

## Dependencies

- `shared_preferences`, `mobile_scanner`, `share_plus`

## Extended in follow-up pass

- Offline queue: **expense** + **draft purchase**
- **Rental detail** `/rentals/:id`
- **Sale PDF** share (`pdf` + `share_plus`)

## Still future

- Full Drift schema + payment/journal offline types
- Thermal Sunmi / Bluetooth print (native channel)
- WhatsApp PDF intent (Android native)
- Studio production writes, rental booking writes
