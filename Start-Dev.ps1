# Start-Dev.ps1 - Launch all services for local development

Write-Host "=== Shams al-Asrar Development Environment ===" -ForegroundColor Cyan
Write-Host ""

# Check if Firebase CLI is installed
$firebaseInstalled = Get-Command firebase -ErrorAction SilentlyContinue
if (-not $firebaseInstalled) {
    Write-Host "ERROR: Firebase CLI not found!" -ForegroundColor Red
    Write-Host "Install it with: npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}

# Check if functions dependencies are installed
if (-not (Test-Path "functions\node_modules")) {
    Write-Host "Installing Functions dependencies..." -ForegroundColor Yellow
    Push-Location functions
    npm install
    Pop-Location
}

Write-Host "Starting Firebase Emulators..." -ForegroundColor Green
Write-Host "  - Auth:      http://localhost:9099" -ForegroundColor Gray
Write-Host "  - Functions: http://localhost:5001" -ForegroundColor Gray
Write-Host "  - Firestore: http://localhost:8282" -ForegroundColor Gray
Write-Host "  - UI:        http://localhost:4000" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host ""

# Start emulators (this blocks)
firebase emulators:start
