# Shams al-Asrār - Windows PowerShell Log Monitor
$TargetDevice = "RZ8N60NJ0NH"

Write-Host "--- Diagnostic: Checking Device $TargetDevice ---" -ForegroundColor Cyan
if (!(adb devices | Select-String "$TargetDevice\s+device")) {
    Write-Error "Device $TargetDevice not found or unauthorized."
    exit
}

Write-Host "--- Diagnostic: Checking Metro Bundler (8081) ---" -ForegroundColor Cyan
Test-NetConnection -ComputerName localhost -Port 8081 | Out-Null
if (!$?) { Write-Warning "Metro Bundler (8081) is not responding. Is 'npm start' running?" }

Write-Host "--- Clearing old logs ---" -ForegroundColor Gray
adb -s $TargetDevice logcat -c

Write-Host "--- Watching for [Shams] events (Ctrl+C to stop) ---" -ForegroundColor Green
adb -s $TargetDevice logcat *:S ReactNativeJS:V AndroidRuntime:E | Select-String "Shams|FATAL|Exception"