# Reset a user's password on VPS Supabase (works from Windows PowerShell).
# Usage: .\scripts\vps-reset-user-password.ps1 -Email "ndm313@live.com" -Password "123456"
# Or:    .\scripts\vps-reset-user-password.ps1 "ndm313@live.com" "123456"

param(
    [Parameter(Position = 0)]
    [string] $Email = "ndm313@yahoo.com",
    [Parameter(Position = 1)]
    [string] $Password = "Demo123!"
)

# Escape single quotes for SQL: ' -> ''
$SqlPass = $Password -replace "'", "''"

$Sql = @"
UPDATE auth.users
SET encrypted_password = crypt('$SqlPass', gen_salt('bf'))
WHERE email = '$Email';
"@

Write-Host "[VPS] Resetting password for $Email ..."
$Sql | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "[DONE] Sign in at http://localhost:5173 or https://erp.dincouture.pk with $Email and your new password."
