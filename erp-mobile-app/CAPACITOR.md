# Capacitor – Android & iOS Build

**App:** Din Collection  
**Bundle ID:** com.dincouture.erp

## Quick commands

```bash
# Build web + copy to native projects
npm run cap:sync

# Open in Android Studio (APK/AAB build)
npm run cap:android

# Open in Xcode (iOS build – Mac only)
npm run cap:ios
```

## Build steps

### Android
1. `npm run cap:sync`
2. `npm run cap:android` → Android Studio opens
3. Build → Build Bundle(s) / APK(s) → Build APK(s)
4. APK location: `android/app/build/outputs/apk/debug/`

### iOS (Mac + Xcode required)
1. `npm run cap:sync`
2. `npm run cap:ios` → Xcode opens
3. Select your Team (Apple ID)
4. Product → Run (simulator) or Archive (IPA for device/store)

## After code changes

Har web change ke baad:
```bash
npm run cap:sync
```
Phir Android Studio / Xcode mein dubara build karo.

## Dev with live reload (optional)

`capacitor.config.ts` mein `server.url` set karke dev server se live reload:
```ts
server: { url: 'http://192.168.x.x:5174', cleartext: true }
```
Production build ke liye ye remove karo.
