# PowerShell Script: Update .env.local and Apply Schema
# Date: 2026-01-20

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "UPDATING .env.local AND APPLYING SCHEMA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Update .env.local
Write-Host "[1/2] Updating .env.local..." -ForegroundColor Yellow

$envContent = @"
# Supabase Configuration - NEW PROJECT
# Project URL: https://wrwljqzckmnmuphwhslt.supabase.co
# Updated: 2026-01-20

# Vite format (for Vite-based projects)
VITE_SUPABASE_URL=https://wrwljqzckmnmuphwhslt.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_25HWVdeBmLXUEtPLT5BRYw_I1wYVDsu

# Next.js format (for Next.js projects)
NEXT_PUBLIC_SUPABASE_URL=https://wrwljqzckmnmuphwhslt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_25HWVdeBmLXUEtPLT5BRYw_I1wYVDsu

# Supabase Service Role Key (Backend only - DO NOT expose in frontend!)
SUPABASE_SERVICE_ROLE_KEY=sb_secret_eqaY2igHxF7jLp0CGATiog_7o4sZjd6
VITE_SUPABASE_SERVICE_ROLE_KEY=sb_secret_eqaY2igHxF7jLp0CGATiog_7o4sZjd6

# Direct PostgreSQL Connection (for migrations/scripts)
DATABASE_URL=postgresql://postgres:khan313ndm313@db.wrwljqzckmnmuphwhslt.supabase.co:5432/postgres

# Pooler Connection (for connection pooling)
DATABASE_POOLER_URL=postgresql://postgres.wrwljqzckmnmuphwhslt:khan313ndm313@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
"@

try {
    $envContent | Out-File -FilePath ".env.local" -Encoding utf8 -Force
    Write-Host "✅ .env.local updated successfully!" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ Error updating .env.local: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Instructions for schema application
Write-Host "[2/2] Schema Application Instructions" -ForegroundColor Yellow
Write-Host ""
Write-Host "📋 SCHEMA MUST BE APPLIED MANUALLY:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   1. Go to: https://supabase.com/dashboard" -ForegroundColor White
Write-Host "   2. Select project: wrwljqzckmnmuphwhslt" -ForegroundColor White
Write-Host "   3. Click 'SQL Editor' in left sidebar" -ForegroundColor White
Write-Host "   4. Click 'New Query'" -ForegroundColor White
Write-Host "   5. Open file: supabase-extract/migrations/03_frontend_driven_schema.sql" -ForegroundColor White
Write-Host "   6. Copy ENTIRE file content" -ForegroundColor White
Write-Host "   7. Paste into SQL Editor" -ForegroundColor White
Write-Host "   8. Click 'Run' button (or Ctrl+Enter)" -ForegroundColor White
Write-Host "   9. Wait 30-60 seconds for execution" -ForegroundColor White
Write-Host "   10. Verify success message appears" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ .env.local has been updated with new project credentials" -ForegroundColor Green
Write-Host "⚠️  Schema must be applied manually via Supabase SQL Editor" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Apply schema via Supabase SQL Editor (see instructions above)" -ForegroundColor White
Write-Host "2. Restart your dev server to load new environment variables" -ForegroundColor White
Write-Host "3. Test connection by creating a new business" -ForegroundColor White
Write-Host ""
