# PWA vs Native Limits

## PWA Limitations

| Feature | Status |
|---------|--------|
| **Printing** | Limited — browser print dialog; no direct Bluetooth/WiFi printer |
| **Barcode scanning** | Limited — `getUserMedia` works but UX varies; some browsers restrict |
| **Background sync** | Limited — Background Sync API not always reliable |
| **Push notifications** | Supported — but requires service worker + user permission |
| **Offline storage** | IndexedDB — works; same as WebView |
| **Secure storage** | IndexedDB + crypto — best effort; not Keychain/Keystore |
| **Install prompt** | Varies by browser — Chrome shows; Safari may not |
| **App store** | Not listed — user installs from browser |

## Native (APK / iOS) Advantages

| Feature | Status |
|---------|--------|
| **Printing** | Full — Bluetooth/WiFi direct printer support |
| **Barcode scanning** | Full — camera access via native plugins |
| **Secure storage** | Keychain (iOS) / Keystore (Android) |
| **Background** | Better — native background tasks |
| **App store** | Listed — Play Store / App Store |
| **Offline** | SQLite possible via Capacitor plugins |

## Recommendation

- **PWA**: Fast testing, installable, no app store; use for internal/testing
- **APK/iOS**: Production, full features, app store; use for end users
