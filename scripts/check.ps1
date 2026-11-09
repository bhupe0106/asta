# Run the full local verification suite (Windows PowerShell).
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

Write-Host "Backend tests..." -ForegroundColor Cyan
Push-Location (Join-Path $root "services/api")
python -m pytest
Pop-Location

Write-Host "Frontend typecheck..." -ForegroundColor Cyan
Push-Location (Join-Path $root "apps/web")
npm run typecheck
Write-Host "Frontend production build..." -ForegroundColor Cyan
npm run build
Pop-Location

Write-Host "All checks passed." -ForegroundColor Green
