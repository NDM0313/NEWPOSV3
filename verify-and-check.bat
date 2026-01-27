@echo off
REM =====================================================
REM COMPLETE DATABASE VERIFICATION & CHECK SCRIPT
REM =====================================================
REM This script verifies database access and checks accounting data
REM =====================================================

echo =====================================================
echo STEP 0: PROJECT DIRECTORY
echo =====================================================
cd /d "C:\Users\ndm31\dev\Corusr\NEW POSV3"
echo Current directory: %CD%

echo.
echo =====================================================
echo STEP 1: ENV FILE VERIFY (DATABASE ACCESS CONFIRM)
echo =====================================================
if not exist .env.local (
    echo ERROR: .env.local file not found!
    pause
    exit /b 1
)

type .env.local
echo.
echo Checking DATABASE_POOLER_URL...
findstr /C:"DATABASE_POOLER_URL" .env.local >nul
if errorlevel 1 (
    echo ERROR: DATABASE_POOLER_URL not found in .env.local
    pause
    exit /b 1
) else (
    echo ✅ DATABASE_POOLER_URL found
)

echo.
echo =====================================================
echo STEP 2: NODE + DEPENDENCIES CHECK
echo =====================================================
node -v
if errorlevel 1 (
    echo ERROR: Node.js not found!
    pause
    exit /b 1
)

npm -v
if errorlevel 1 (
    echo ERROR: npm not found!
    pause
    exit /b 1
)

echo.
echo Installing dependencies...
call npm install
if errorlevel 1 (
    echo WARNING: npm install had errors, but continuing...
)

echo.
echo =====================================================
echo STEP 3: EXTRACT DATABASE CREDENTIALS
echo =====================================================
REM Extract password from .env.local
for /f "tokens=2 delims==" %%a in ('findstr /C:"DATABASE_POOLER_URL" .env.local') do set DB_URL=%%a
echo Database URL extracted (password hidden for security)

echo.
echo =====================================================
echo STEP 4: RUN VERIFICATION SCRIPTS
echo =====================================================
echo Running data verification...
node scripts/final-verification.mjs
if errorlevel 1 (
    echo WARNING: Verification script had errors
)

echo.
echo =====================================================
echo STEP 5: CHECK CUSTOMER DATA (Optional)
echo =====================================================
echo To check specific customer, run: check-customer.bat CUSTOMER_ID
echo Or skip this step and continue...
choice /C YN /M "Run customer data check now"
if errorlevel 2 goto skip_customer_check
if errorlevel 1 (
    echo Running customer data check...
    node scripts/check-customer-data.mjs
)
:skip_customer_check

echo.
echo =====================================================
echo STEP 6: READY FOR MANUAL CHECKS
echo =====================================================
echo.
echo Next steps:
echo 1. Run: npm run dev
echo 2. Open browser console
echo 3. Navigate to Customer Ledger
echo 4. Check console logs for verification
echo.
echo For SQL queries, use Supabase SQL Editor:
echo https://supabase.com/dashboard/project/wrwljqzckmnmuphwhslt/sql/new
echo.
echo =====================================================
echo VERIFICATION COMPLETE
echo =====================================================
pause
