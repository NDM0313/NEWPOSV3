@echo off
REM DIN Couture - one-click office ERP backup pull (NEWPOSV3)
REM Canonical local root: D:\ERP BACKUP
setlocal
title DIN Couture ERP Backup
cd /d "%~dp0"
echo.
echo === DIN Couture ERP Backup ===
echo Remote: dincouture-vps:/root/backups/erp-db/
echo Local:  D:\ERP BACKUP\
echo Repo:   %~dp0
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ops\backup\pull-din-erp-backups.ps1"
set ERR=%ERRORLEVEL%
echo.
if %ERR% NEQ 0 (
  echo DIN ERP BACKUP FAILED
  echo.
  pause
  exit /b %ERR%
)
echo DIN ERP BACKUP PASS
echo.
pause
exit /b 0
