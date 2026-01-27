@echo off
REM =====================================================
REM QUICK START - COMPLETE VERIFICATION
REM =====================================================
REM This is the main script to run for complete verification
REM =====================================================

echo.
echo =====================================================
echo COMPLETE ACCOUNTING DATA VERIFICATION
echo =====================================================
echo.

cd /d "C:\Users\ndm31\dev\Corusr\NEW POSV3"

REM Step 1: Environment Check
echo [1/6] Checking environment...
if not exist .env.local (
    echo ERROR: .env.local not found!
    pause
    exit /b 1
)
echo ✅ .env.local found

REM Step 2: Node.js Check
echo [2/6] Checking Node.js...
node -v >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not installed!
    pause
    exit /b 1
)
echo ✅ Node.js OK

REM Step 3: Dependencies
echo [3/6] Checking dependencies...
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)
echo ✅ Dependencies OK

REM Step 4: Final Verification
echo [4/6] Running final verification...
node scripts/final-verification.mjs
if errorlevel 1 (
    echo WARNING: Verification had errors
)

REM Step 5: Customer Data Check (Optional)
echo [5/6] Customer data check...
echo (Skipping - use check-customer.bat for specific customer)
REM node scripts/check-customer-data.mjs

REM Step 6: Summary
echo.
echo [6/6] =====================================================
echo VERIFICATION COMPLETE
echo =====================================================
echo.
echo Next steps:
echo 1. Run: npm run dev
echo 2. Open browser and check Customer Ledger
echo 3. Check browser console for logs
echo.
echo For specific customer check:
echo   check-customer.bat CUSTOMER_ID
echo.
pause
