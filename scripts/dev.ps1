# Development helper for Windows PowerShell.
# Starts the API and web dev servers in separate PowerShell windows.

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$api = Join-Path $root "services/api"
$web = Join-Path $root "apps/web"
$envFile = Join-Path $root ".env"

if (-not (Test-Path $envFile)) {
    Copy-Item (Join-Path $root ".env.example") $envFile
    Write-Host "Created .env from .env.example. Replace ASTA_SECRET_KEY before production." -ForegroundColor Yellow
}

if (-not (Test-Path (Join-Path $web "node_modules"))) {
    Write-Host "Installing web dependencies..." -ForegroundColor Cyan
    Push-Location $web
    npm install
    Pop-Location
}

Write-Host "Starting ASTA API on http://127.0.0.1:8000" -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$api'; python -m uvicorn app.main:app --reload --port 8000"
)

Write-Host "Starting ASTA web on http://localhost:5173" -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$web'; npm run dev"
)

Write-Host "Two windows opened. Close them to stop the servers." -ForegroundColor Green
