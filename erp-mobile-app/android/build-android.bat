@echo off
REM Build Android with JDK 17 to avoid "Unsupported class file major version 69" (Java 25).
REM Set JAVA_HOME to JDK 17 if you have it, then run gradlew.

set "JAVA17="
REM Try common JDK 17 install locations (dir so we get latest version)
for /f "delims=" %%d in ('dir /b /ad "C:\Program Files\Eclipse Adoptium\jdk-17*" 2^>nul') do set "JAVA17=C:\Program Files\Eclipse Adoptium\%%d"
if not defined JAVA17 for /f "delims=" %%d in ('dir /b /ad "C:\Program Files\Java\jdk-17*" 2^>nul') do set "JAVA17=C:\Program Files\Java\%%d"
if not defined JAVA17 for /f "delims=" %%d in ('dir /b /ad "C:\Program Files\Microsoft\jdk-17*" 2^>nul') do set "JAVA17=C:\Program Files\Microsoft\%%d"
if not defined JAVA17 for /f "delims=" %%d in ('dir /b /ad "%LOCALAPPDATA%\Programs\Eclipse Adoptium\jdk-17*" 2^>nul') do set "JAVA17=%LOCALAPPDATA%\Programs\Eclipse Adoptium\%%d"
if not defined JAVA17 for /f "delims=" %%d in ('dir /b /ad "%USERPROFILE%\.jdks\*17*" 2^>nul') do set "JAVA17=%USERPROFILE%\.jdks\%%d"
if defined JAVA17 (
  set "JAVA_HOME=%JAVA17%"
  echo Using JDK 17: %JAVA_HOME%
  REM Stop any daemon running with wrong JDK so next build uses JDK 17
  gradlew.bat --stop 2>nul
) else (
  echo JDK 17 not found in common paths. Using current JAVA_HOME.
  echo If build fails with "major version 69", install JDK 17 and set JAVA_HOME to it.
)

cd /d "%~dp0"
call gradlew.bat %*
