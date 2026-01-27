@echo off
REM =====================================================
REM CUSTOMER DATA CHECK SCRIPT
REM =====================================================
REM Usage: check-customer.bat [CUSTOMER_ID_OR_CODE]
REM Example: check-customer.bat CUS-018
REM =====================================================

cd /d "C:\Users\ndm31\dev\Corusr\NEW POSV3"

echo =====================================================
echo CUSTOMER DATA CHECK
echo =====================================================
echo.

if "%1"=="" (
    echo Using default customer: CUS-018
    echo To check specific customer, run: check-customer.bat CUSTOMER_ID
    echo.
    node scripts/check-customer-data.mjs CUS-018
) else (
    echo Checking customer: %1
    echo.
    node scripts/check-customer-data.mjs %1
)

echo.
pause
