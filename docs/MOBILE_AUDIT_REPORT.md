# Mobile ERP Audit Report — GO-LIVE READINESS

**Generated:** 2025-02-23  
**Scope:** erp-mobile-app (Capacitor 8.1.0, Android & iOS)

---

## 1. Executive Summary

| Area | Status | Notes |
|------|--------|-------|
| Supabase URL | ✅ Pass | Same as Web (supabase.dincouture.pk) |
| company_id Behavior | ✅ Pass | Same tenant isolation |
| Branch Lock | ✅ Pass | user.branchLocked; selector disabled when locked |
| PIN Login | ✅ Pass | SHA-256 hash, AES-GCM; 5-attempt lockout |
| Offline Queue | ✅ Pass | IndexedDB; sale, expense, journal_entry, payment |
| Sync Conflict | ⚠️ Review | Last-write-wins; no explicit conflict UI |
| Storage Security | ✅ Pass | Secure storage for tokens |
| Printer Integration | ❌ Missing | No Bluetooth/thermal |
| Barcode Scanner | ❌ Missing | No camera-based scanning |
| Camera Permissions | ❌ Missing | No CAMERA in AndroidManifest |

---

## 2. Supabase Configuration

- **URL:** `VITE_SUPABASE_URL` = https://supabase.dincouture.pk
- **Key:** `VITE_SUPABASE_ANON_KEY` (same as Web)
- **Source:** `erp-mobile-app/src/lib/supabase.ts`
- **Status:** ✅ Aligned with Web ERP.

---

## 3. company_id & Branch Lock

- **company_id:** From auth session; all API calls scoped by company.
- **Branch lock:** `user.branchLocked` flag; when true, branch selector disabled, forced to `user.branchId`.
- **Admin:** Can select "All Branches" or specific branch.
- **Status:** ✅ Same behavior as Web.

---

## 4. PIN Login Security

- **Storage:** `secureStorage.ts` — encrypted payload (AES-GCM)
- **PIN:** SHA-256 hashed with salt `erp_mobile_pin_salt_v1`
- **Max attempts:** 5 → 15-minute lockout
- **Session expiry:** 7 days max
- **Fallback:** crypto-js when Web Crypto unavailable
- **Status:** ✅ Secure implementation.

---

## 5. Offline Queue & Sync

- **Storage:** IndexedDB `erp_mobile_offline`, store `pending`
- **Types:** sale, expense, journal_entry, payment
- **Auto-sync:** Every 60 seconds when online
- **Event:** Triggers on `online` event
- **UI:** SyncStatusBar — "Offline" | "X pending" | "Syncing..." | "Sync Error"
- **Status:** ✅ Working for supported types.

---

## 6. Sync Conflict Handling

- **Strategy:** Last-write-wins (no explicit merge)
- **Risk:** Concurrent edits may overwrite
- **Recommendation:** Document for users; consider conflict UI for critical flows
- **Status:** ⚠️ Acceptable for MVP; improve post go-live.

---

## 7. Secure Token Storage

- **Tokens:** Stored in encrypted vault (secureStorage)
- **Clear on:** Sign-out
- **Status:** ✅ Secure.

---

## 8. Missing: Printer Integration

- **Current:** Browser print dialog only (`window.print()`)
- **Needed:** Bluetooth/thermal printer for receipts
- **Plugins:** None installed (e.g. @capacitor-community/bluetooth-le)
- **Status:** ❌ Not implemented. Required for POS-on-mobile.

---

## 9. Missing: Barcode Scanner

- **Current:** Manual barcode entry in product forms
- **Needed:** Camera-based scanning
- **Plugins:** None
- **Status:** ❌ Not implemented.

---

## 10. Missing: Camera Permissions

- **Android:** Only INTERNET in AndroidManifest.xml
- **iOS:** No NSCameraUsageDescription in Info.plist
- **Status:** ❌ Required for barcode scanner.

---

## 11. Recommendations

| Priority | Item | Action |
|----------|------|--------|
| High | Printer configuration | Add Settings → Printer (Bluetooth/USB/Network, 58mm/80mm) |
| High | Thermal printer | Add Capacitor plugin for Bluetooth printing |
| Medium | Barcode scanner | Add camera + barcode plugin |

---

## 12. Verdict

**Mobile ERP is GO-LIVE READY for core flows** (sales, expenses, sync, PIN, branch lock). Printer and barcode scanner are not implemented; acceptable if POS-on-mobile is not required at go-live.
