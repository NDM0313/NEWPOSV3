# Capacitor – Android & iOS Build

**App:** Din Collection  
**Bundle ID:** com.dincouture.erp

## Quick commands (production — use these for APK/IPA)

```bash
# Prod web bundle + copy to native projects (both platforms)
npm run cap:sync

# Android prod sync only
npm run cap:sync:android:prod

# iOS prod sync only
npm run cap:sync:ios:prod

# One-shot release builds
npm run android:apk:release:mac   # Mac
npm run ios:ipa:release:mac       # Mac + Xcode

# Open in Android Studio / Xcode
npm run cap:android
npm run cap:ios
```

## Build steps

### Android (release APK)
1. `npm run android:apk:release:mac` (or `:win` on Windows)
2. APK copied to `releases/erp-mobile-*.apk`

### Android (debug APK for device testing)
1. `npm run android:debug`
2. APK: `android/app/build/outputs/apk/debug/app-debug.apk`

### iOS (Mac + Xcode required)
1. `npm run ios:ipa:release:mac` — archive + export IPA to `releases/`
2. Or: `npm run cap:sync:ios:prod` → `npm run cap:ios` → Product → Run / Archive

## After code changes

Har web change ke baad **prod sync** chalao (non-prod sync broken asset paths / localhost errors de sakta hai):

```bash
npm run cap:sync:android:prod   # Android
npm run cap:sync:ios:prod       # iOS
```

Phir Android Studio / Xcode mein dubara build karo, ya `android:apk:release:mac` / `ios:ipa:release:mac` use karo.

## Dev with live reload (optional — dev only)

`capacitor.config.ts` mein **temporarily** `server.url` set karke dev server se live reload:

```ts
server: { url: 'http://192.168.x.x:5174', cleartext: true }
```

**Warning:** `server.url` remove kiye bina native build **kabhi mat karo**. Agar reh gaya to APK/iOS app device par `localhost:5174` se load karegi aur `ERR_CONNECTION_REFUSED` + Vite HMR errors aayenge.

Live reload ke baad:
1. `server.url` hatao
2. `npm run cap:sync:android:prod` / `cap:sync:ios:prod`
3. Native project dubara build karo

## Recovery: "Something went wrong" / localhost:5174 on device

Symptoms: `.tsx` load errors, `ws://localhost:5174` WebSocket failures, boot error screen.

1. Confirm [`capacitor.config.ts`](capacitor.config.ts) has **no** `server.url`
2. Check synced config has no `server.url`:
   - `android/app/src/main/assets/capacitor.config.json`
   - `ios/App/App/capacitor.config.json`
3. Rebuild with prod path:
   ```bash
   node scripts/prepare-release-env.mjs
   node scripts/verify-mobile-build-env.mjs
   npm run cap:sync:android:prod   # or ios
   ```
4. Verify `dist/index.html` uses `./assets/` (not `/assets/`)
5. Uninstall old APK/IPA from device, install fresh build; keep Wi-Fi on for API (`https://erp.dincouture.pk`)

## Browser dev (laptop only)

```bash
npm run dev   # http://localhost:5174 — not for native APK/IPA
```
