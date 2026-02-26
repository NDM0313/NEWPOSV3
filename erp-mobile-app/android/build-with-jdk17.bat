@echo off
REM Use JDK 17 for Android build (Gradle 8.14 does not support JDK 25).
REM Set JAVA_HOME to your JDK 17 path if not using a path below.

set "JAVA17="
for /d %%d in ("%ProgramFiles%\Eclipse Adoptium\jdk-17*" "%ProgramFiles%\Microsoft\jdk-17*" "%ProgramFiles%\Java\jdk-17*" "%LOCALAPPDATA%\Programs\Eclipse Adoptium\jdk-17*") do (
  if not defined JAVA17 if exist "%%d\bin\javac.exe" set "JAVA17=%%d"
)
if not defined JAVA17 if defined JAVA_HOME (
  "%JAVA_HOME%\bin\java" -version 2>nul | findstr /C:"17" >nul && set "JAVA17=%JAVA_HOME%"
  if not defined JAVA17 "%JAVA_HOME%\bin\java" -version 2>nul | findstr /C:"21" >nul && set "JAVA17=%JAVA_HOME%"
)

if defined JAVA17 (
  set "JAVA_HOME=%JAVA17%"
  echo Using JAVA_HOME=%JAVA_HOME%
  call "%~dp0gradlew.bat" %*
  exit /b %ERRORLEVEL%
)

echo ERROR: JDK 17 or 21 not found. Android build does not support JDK 25.
echo.
echo Install JDK 17 from https://adoptium.net/ then either:
echo   1. Set JAVA_HOME to JDK 17 and run gradlew.bat normally, or
echo   2. Uncomment org.gradle.java.home in android\gradle.properties with your JDK 17 path.
echo.
echo See android\README_BUILD.md for details.
exit /b 1
