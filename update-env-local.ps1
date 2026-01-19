# ============================================================================
# UPDATE .env.local WITH SUPABASE KEYS
# ============================================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Updating .env.local File" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Supabase credentials
$supabaseUrl = "https://pcxfwmbcjrkgzibgdrlz.supabase.co"

# Create .env.local content
$envContent = @"
# Supabase Configuration
VITE_SUPABASE_URL=$supabaseUrl
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjeGZ3bWJjanJrZ3ppYmdkcmx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcyNzQ0NDAsImV4cCI6MjA1Mjg1MDQ0MH0.YOUR_ANON_KEY_HERE

# Service Role Key (SECRET - Never commit to Git!)
# Get from: Supabase Dashboard -> Settings -> API -> service_role secret
# Copy the full key and replace YOUR_SERVICE_ROLE_KEY_HERE below
VITE_SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE

# Alternative variable names (for compatibility)
NEXT_PUBLIC_SUPABASE_URL=$supabaseUrl
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjeGZ3bWJjanJrZ3ppYmdkcmx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcyNzQ0NDAsImV4cCI6MjA1Mjg1MDQ0MH0.YOUR_ANON_KEY_HERE
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE
"@

# Write to .env.local
$envFile = ".env.local"

try {
    $envContent | Out-File -FilePath $envFile -Encoding UTF8 -NoNewline
    Write-Host "✅ Created/Updated $envFile" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 IMPORTANT: Update Service Role Key!" -ForegroundColor Yellow
    Write-Host "  1. Open $envFile" -ForegroundColor White
    Write-Host "  2. Replace YOUR_SERVICE_ROLE_KEY_HERE with your actual key" -ForegroundColor White
    Write-Host "  3. Get key from: Supabase Dashboard -> Settings -> API" -ForegroundColor White
    Write-Host "  4. Look for 'service_role secret' key" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host "❌ Error creating .env.local: $_" -ForegroundColor Red
    exit 1
}

Write-Host "============================================" -ForegroundColor Green
Write-Host "  .env.local Created!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
