# ============================================
# CREATE DEMO USER - PowerShell Script
# ============================================
# Run this script to create the demo user
# Usage: .\create-user.ps1

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  CREATE DEMO USER IN SUPABASE" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env.local exists
if (-not (Test-Path ".env.local")) {
    Write-Host "❌ Error: .env.local file not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please create .env.local with:" -ForegroundColor Yellow
    Write-Host "  VITE_SUPABASE_URL=https://pcxfwmbcjrkgzibgdrlz.supabase.co" -ForegroundColor White
    Write-Host "  VITE_SUPABASE_ANON_KEY=your-anon-key" -ForegroundColor White
    Write-Host "  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Read .env.local
$envContent = Get-Content ".env.local" -Raw
$supabaseUrl = ""
$serviceRoleKey = ""

# Parse environment variables
if ($envContent -match "VITE_SUPABASE_URL=(.+)") {
    $supabaseUrl = $matches[1].Trim()
}
if ($envContent -match "SUPABASE_SERVICE_ROLE_KEY=(.+)") {
    $serviceRoleKey = $matches[1].Trim()
}

if (-not $supabaseUrl) {
    Write-Host "❌ Error: VITE_SUPABASE_URL not found in .env.local" -ForegroundColor Red
    exit 1
}

if (-not $serviceRoleKey) {
    Write-Host "❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in .env.local" -ForegroundColor Red
    Write-Host ""
    Write-Host "To get Service Role Key:" -ForegroundColor Yellow
    Write-Host "  1. Go to Supabase Dashboard" -ForegroundColor White
    Write-Host "  2. Settings → API" -ForegroundColor White
    Write-Host "  3. Copy 'service_role' key (NOT anon key!)" -ForegroundColor White
    Write-Host "  4. Add to .env.local: SUPABASE_SERVICE_ROLE_KEY=your-key" -ForegroundColor White
    Write-Host ""
    Write-Host "⚠️  WARNING: Service Role Key is SECRET - never commit to Git!" -ForegroundColor Yellow
    exit 1
}

Write-Host "📧 Creating user: admin@dincollection.com" -ForegroundColor Yellow
Write-Host ""

try {
    # Create user via Supabase Admin API
    $body = @{
        email = "admin@dincollection.com"
        password = "admin123"
        email_confirm = $true
        user_metadata = @{
            full_name = "Admin User"
        }
    } | ConvertTo-Json

    $headers = @{
        "apikey" = $serviceRoleKey
        "Authorization" = "Bearer $serviceRoleKey"
        "Content-Type" = "application/json"
    }

    $response = Invoke-RestMethod -Uri "$supabaseUrl/auth/v1/admin/users" -Method Post -Headers $headers -Body $body

    if ($response.user) {
        Write-Host "✅ User created successfully!" -ForegroundColor Green
        Write-Host "   User ID: $($response.user.id)" -ForegroundColor Gray
        Write-Host ""
        
        # Link to database
        Write-Host "🔗 Linking to database..." -ForegroundColor Yellow
        
        $dbBody = @{
            id = $response.user.id
            company_id = "00000000-0000-0000-0000-000000000001"
            email = "admin@dincollection.com"
            full_name = "Admin User"
            role = "admin"
            is_active = $true
        } | ConvertTo-Json

        $dbHeaders = @{
            "apikey" = $serviceRoleKey
            "Authorization" = "Bearer $serviceRoleKey"
            "Content-Type" = "application/json"
            "Prefer" = "resolution=merge-duplicates"
        }

        try {
            $dbResponse = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/users" -Method Post -Headers $dbHeaders -Body $dbBody
            Write-Host "✅ Linked to database" -ForegroundColor Green
        } catch {
            Write-Host "⚠️  Could not link to database (may already exist)" -ForegroundColor Yellow
        }

        Write-Host ""
        Write-Host "============================================" -ForegroundColor Green
        Write-Host "  ✅ SUCCESS! User Created" -ForegroundColor Green
        Write-Host "============================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Login Credentials:" -ForegroundColor Cyan
        Write-Host "  Email: admin@dincollection.com" -ForegroundColor White
        Write-Host "  Password: admin123" -ForegroundColor White
        Write-Host ""
        Write-Host "🚀 You can now login to the application!" -ForegroundColor Green
        Write-Host ""

    } else {
        throw "User creation failed"
    }

} catch {
    $errorMessage = $_.Exception.Message
    if ($errorMessage -match "already registered" -or $errorMessage -match "already exists") {
        Write-Host "✅ User already exists in Auth" -ForegroundColor Green
        Write-Host ""
        Write-Host "You can now login with:" -ForegroundColor Cyan
        Write-Host "  Email: admin@dincollection.com" -ForegroundColor White
        Write-Host "  Password: admin123" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "❌ Error creating user: $errorMessage" -ForegroundColor Red
        Write-Host ""
        Write-Host "Alternative: Create user manually in Supabase Dashboard" -ForegroundColor Yellow
        Write-Host "  1. Go to: https://supabase.com/dashboard" -ForegroundColor White
        Write-Host "  2. Authentication → Users → Add user" -ForegroundColor White
        Write-Host "  3. Email: admin@dincollection.com" -ForegroundColor White
        Write-Host "  4. Password: admin123" -ForegroundColor White
        Write-Host "  5. Auto Confirm: Yes" -ForegroundColor White
        Write-Host ""
    }
}
