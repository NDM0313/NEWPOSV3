# Android build

This project uses **Gradle 9.1** and **Android Gradle Plugin 9.0**, which support **Java 17 through 25**. You can use your system JDK (including JDK 25) without changing it.

## Build

From the `android` folder:

- **Windows:** `.\gradlew.bat assembleDebug`
- **macOS/Linux:** `./gradlew assembleDebug`

Ensure **Android SDK** is installed and `sdk.dir` is set in `local.properties` (or `ANDROID_HOME` is set). From `erp-mobile-app`, run `npx cap sync` if you add Cordova plugins (otherwise the stub project is used).
