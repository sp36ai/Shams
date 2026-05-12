# scripts/Fix-AdbConnections.ps1
# Automates port reversals for Shams al-Asrar Firebase local development.

 $TargetDevice = "RZ8N60NJ0NH"
 Write-Host "--- Fixing ADB Connections for Shams al-Asrar (Target: $TargetDevice) ---" -ForegroundColor Cyan

# 1. Restart ADB Server to clear hung processes
Write-Host "[1/3] Restarting ADB server..."
adb kill-server
adb start-server

# 2. Verify device connection
$devices = adb devices | Select-String -Pattern "$TargetDevice\s+device$"
if (-not $devices) {
    Write-Error "Target device $TargetDevice not found. Is it connected and Authorized?"
    exit
}
Write-Host "Found device: $($devices[0].ToString().Trim())" -ForegroundColor Green

# 3. Apply Port Reversals
Write-Host "[3/3] Reversing ports for Firebase Emulators..."

adb -s $TargetDevice reverse tcp:8081 tcp:8081  # Metro Bundler
adb -s $TargetDevice reverse tcp:8181 tcp:8181  # Firestore
adb -s $TargetDevice reverse tcp:9099 tcp:9099  # Auth
adb -s $TargetDevice reverse tcp:5001 tcp:5001  # Functions
adb -s $TargetDevice reverse tcp:4000 tcp:4000  # UI
adb reverse tcp:4000 tcp:4000  # Emulator UI (Optional)
adb reverse tcp:4400 tcp:4400  # Hub
adb reverse tcp:4500 tcp:4500  # Logging

Write-Host "--- ADB Fixed! You can now run 'npm run android' ---" -ForegroundColor Cyan
Write-Host "Note: Keep this script handy. If you unplug your device, you must run it again."