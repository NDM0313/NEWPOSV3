# Use JDK 17 for Android build (Gradle 8.14 does not support JDK 25).
$paths = @(
  "$env:ProgramFiles\Eclipse Adoptium\jdk-17*",
  "$env:ProgramFiles\Microsoft\jdk-17*",
  "$env:ProgramFiles\Java\jdk-17*",
  "$env:ProgramFiles\Zulu\zulu-17*",
  "$env:LOCALAPPDATA\Programs\Eclipse Adoptium\jdk-17*"
)
$jdk17 = $null
foreach ($p in $paths) {
  $resolved = Get-Item $p -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($resolved -and (Test-Path "$resolved\bin\javac.exe")) { $jdk17 = $resolved.FullName; break }
}
if (-not $jdk17 -and $env:JAVA_HOME) {
  try {
    $ver = & "$env:JAVA_HOME\bin\java" -version 2>&1
    if ($ver -match '"17\.' -or $ver -match '"21\.') { $jdk17 = $env:JAVA_HOME }
  } catch {}
}
if ($jdk17) {
  $env:JAVA_HOME = $jdk17
  Write-Host "Using JAVA_HOME=$env:JAVA_HOME"
  & "$PSScriptRoot\gradlew.bat" @args
  exit $LASTEXITCODE
}
Write-Error @"
JDK 17 or 21 not found. Android build does not support JDK 25.

Install JDK 17 from https://adoptium.net/ then either:
  1. Set JAVA_HOME to JDK 17 and run gradlew.bat, or
  2. Uncomment org.gradle.java.home in android\gradle.properties.

See android\README_BUILD.md for details.
"@
exit 1
