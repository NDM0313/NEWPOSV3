@echo off
REM Quick debug APK on Windows (from erp-mobile-app folder).
REM For release: powershell -ExecutionPolicy Bypass -File scripts\build-apk-windows.ps1 -Configuration Release -Production

setlocal
cd /d "%~dp0.."

echo Syncing web assets to Android...
call npm run cap:sync:android
if errorlevel 1 exit /b 1

cd android
echo Running Gradle assembleDebug...
call gradlew.bat assembleDebug
if errorlevel 1 exit /b 1

echo.
echo Debug APK (typical path):
echo   android\app\build\outputs\apk\debug\app-debug.apk
endlocal
