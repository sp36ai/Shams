Write-Host "--- Shams al-Asrār Automation Script ---" -ForegroundColor Yellow

Write-Host "[0/4] Environment Pre-check..." -ForegroundColor Cyan
if (-not (Test-Path "node_modules")) {
    Write-Host "node_modules missing. Running npm install..." -ForegroundColor Yellow
    npm install
}

$gsj = "android/app/google-services.json"
if (-not (Test-Path $gsj)) {
    Write-Host "ERROR: $gsj missing. Build will fail. Please add it from Firebase Console." -ForegroundColor Red
    exit
}

Write-Host "[1/4] Checking for connected Android devices..." -ForegroundColor Cyan
$devices = adb devices | Select-String -Pattern "\tdevice$"
if (-not $devices) {
    Write-Host "ERROR: No Android device detected. Please connect a device via USB or start an emulator." -ForegroundColor Red
    exit
}
Write-Host "Device detected: $($devices[0].ToString().Trim())" -ForegroundColor Green

Write-Host "[*] Checking if Metro (8081) is already running..." -ForegroundColor Gray
$metroProcess = Get-Process -Id (Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue
if ($metroProcess) {
    Write-Host "Metro already running. Skipping start." -ForegroundColor Yellow
} else {
    Write-Host "[2/4] Starting Metro Bundler in a new window..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm start" -WindowStyle Minimized
}

Write-Host "[*] Clearing Android logcat..." -ForegroundColor Gray
adb logcat -c

Write-Host "[3/4] Building and installing the app (this may take 2-4 minutes)..." -ForegroundColor Cyan
npm run android

if ($LASTEXITCODE -eq 0) {
    Write-Host "[*] Automating environment setup..." -ForegroundColor Yellow
    $pkg = "com.astrosarfaraz.shamsalasrar"
    
    # Force grant permissions so you don't have to click 'Allow'
    adb shell pm grant $pkg android.permission.ACCESS_FINE_LOCATION
    adb shell pm grant $pkg android.permission.ACCESS_COARSE_LOCATION

    # Force restart to ensure the Quota Reset in App.tsx and new permissions are active
    adb shell am force-stop $pkg
    adb shell am start -n "$pkg/.MainActivity"

    Write-Host "[4/4] Build successful! Tailing logs now..." -ForegroundColor Green
    npx react-native log-android
} else {
    Write-Host "Build failed. Check the errors above." -ForegroundColor Red
}