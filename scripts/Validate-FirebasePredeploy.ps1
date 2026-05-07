param(
  [switch]$NoCliChecks,
  [switch]$NoRulesTests
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $repoRoot

$results = New-Object System.Collections.Generic.List[object]
$hasFailures = $false

$expectedProjectId = 'shams-app-4d0e7'
$requiredSecrets = @(
  'RAZORPAY_WEBHOOK_SECRET',
  'GOOGLE_PLAY_CLIENT_EMAIL',
  'GOOGLE_PLAY_PRIVATE_KEY'
)
$requiredCallableFiles = @(
  'functions/src/functions/askOracle.ts',
  'functions/src/functions/quota.ts',
  'functions/src/functions/readings.ts',
  'functions/src/functions/payments/googlePlay.ts'
)
$requiredManualChecks = @(
  'apiKeyRotated',
  'apiKeyRestrictedToAndroidAndRequiredApis',
  'firebaseBillingVerified',
  'appCheckEnabledInFirebaseConsole',
  'functionsSecretsProvisioned',
  'googlePlayServiceAccountConfigured',
  'razorpayWebhookRegistered'
)

function Add-CheckResult {
  param(
    [Parameter(Mandatory = $true)][string]$Status,
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Detail
  )

  $script:results.Add([pscustomobject]@{
    status = $Status
    name = $Name
    detail = $Detail
  }) | Out-Null

  if ($Status -eq 'FAIL') {
    $script:hasFailures = $true
  }
}

function Read-JsonFile {
  param([Parameter(Mandatory = $true)][string]$Path)
  return (Get-Content -Path $Path -Raw | ConvertFrom-Json)
}

function Test-FileContains {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Pattern
  )

  $content = Get-Content -Path $Path -Raw
  return $content -match $Pattern
}

function Select-LineValue {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Pattern
  )

  $match = [regex]::Match((Get-Content -Path $Path -Raw), $Pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
  if ($match.Success) {
    return $match.Groups[1].Value
  }
  return $null
}

function Quote-ProcessArg {
  param([Parameter(Mandatory = $true)][string]$Value)

  if ($Value -match '[\s"]') {
    return '"' + ($Value -replace '"', '\"') + '"'
  }
  return $Value
}

function Invoke-ExternalCommand {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [string[]]$ArgumentList = @(),
    [int]$TimeoutSec = 30,
    [string]$WorkingDirectory = $repoRoot
  )

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $FilePath
  $psi.Arguments = (($ArgumentList | ForEach-Object { Quote-ProcessArg $_ }) -join ' ')
  $psi.WorkingDirectory = $WorkingDirectory
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $psi

  [void]$process.Start()
  $finished = $process.WaitForExit($TimeoutSec * 1000)

  if (-not $finished) {
    try {
      $process.Kill()
    } catch {
    }
    return [pscustomobject]@{
      timedOut = $true
      exitCode = -1
      stdout = ''
      stderr = "Timed out after $TimeoutSec seconds"
    }
  }

  return [pscustomobject]@{
    timedOut = $false
    exitCode = $process.ExitCode
    stdout = $process.StandardOutput.ReadToEnd()
    stderr = $process.StandardError.ReadToEnd()
  }
}

function Resolve-CommandPath {
  param([Parameter(Mandatory = $true)][string]$Name)

  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($null -eq $cmd) {
    return $null
  }
  return $cmd.Source
}

function Invoke-FirebaseCli {
  param(
    [string[]]$ArgumentList = @(),
    [int]$TimeoutSec = 30
  )

  $firebaseArgs = @('/d', '/c', 'firebase') + $ArgumentList
  return Invoke-ExternalCommand -FilePath 'cmd.exe' -ArgumentList $firebaseArgs -TimeoutSec $TimeoutSec
}

function Test-ManualCheckTrue {
  param(
    [Parameter(Mandatory = $true)]$ManualChecks,
    [Parameter(Mandatory = $true)][string]$Name
  )

  $prop = $ManualChecks.PSObject.Properties[$Name]
  if ($null -eq $prop) {
    Add-CheckResult -Status 'FAIL' -Name "Manual check: $Name" -Detail 'Missing from firebase.predeploy.json'
    return
  }

  if ($prop.Value -eq $true) {
    Add-CheckResult -Status 'PASS' -Name "Manual check: $Name" -Detail 'Attested as complete'
  } else {
    Add-CheckResult -Status 'FAIL' -Name "Manual check: $Name" -Detail 'Still false in firebase.predeploy.json'
  }
}

function Assert-CommandSucceeded {
  param(
    [Parameter(Mandatory = $true)]$Result,
    [Parameter(Mandatory = $true)][string]$Name
  )

  if ($Result.timedOut) {
    Add-CheckResult -Status 'FAIL' -Name $Name -Detail $Result.stderr
    return $false
  }

  if ($Result.exitCode -ne 0) {
    $detail = ($Result.stderr.Trim(), $Result.stdout.Trim() | Where-Object { $_ }) -join ' | '
    if ([string]::IsNullOrWhiteSpace($detail)) {
      $detail = "Command failed with exit code $($Result.exitCode)"
    }
    Add-CheckResult -Status 'FAIL' -Name $Name -Detail $detail
    return $false
  }

  Add-CheckResult -Status 'PASS' -Name $Name -Detail 'Command succeeded'
  return $true
}

Add-CheckResult -Status 'INFO' -Name 'Validator' -Detail "Repo root: $repoRoot"

foreach ($requiredFile in @(
  '.firebaserc',
  'firebase.json',
  'firebase.predeploy.json',
  'android/app/google-services.json',
  'src/App.tsx',
  'firestore.rules',
  'firestore.rules.test.ts',
  'scripts/Setup-FirebaseSecrets.ps1',
  'scripts/Get-RazorpayWebhookConfig.ps1'
)) {
  if (Test-Path $requiredFile) {
    Add-CheckResult -Status 'PASS' -Name "File exists: $requiredFile" -Detail 'Present'
  } else {
    Add-CheckResult -Status 'FAIL' -Name "File exists: $requiredFile" -Detail 'Missing required file'
  }
}

$firebaseConfig = Read-JsonFile -Path 'firebase.json'
$firebaseRc = Read-JsonFile -Path '.firebaserc'
$predeploy = Read-JsonFile -Path 'firebase.predeploy.json'

if ($firebaseConfig.projectId -eq $expectedProjectId) {
  Add-CheckResult -Status 'PASS' -Name 'firebase.json projectId' -Detail $firebaseConfig.projectId
} else {
  Add-CheckResult -Status 'FAIL' -Name 'firebase.json projectId' -Detail "Expected $expectedProjectId but found $($firebaseConfig.projectId)"
}

$defaultProject = $firebaseRc.projects.default
if ($defaultProject -eq $expectedProjectId) {
  Add-CheckResult -Status 'PASS' -Name '.firebaserc default project' -Detail $defaultProject
} else {
  Add-CheckResult -Status 'FAIL' -Name '.firebaserc default project' -Detail "Expected $expectedProjectId but found $defaultProject"
}

if ($predeploy.projectId -eq $expectedProjectId) {
  Add-CheckResult -Status 'PASS' -Name 'firebase.predeploy.json projectId' -Detail $predeploy.projectId
} else {
  Add-CheckResult -Status 'FAIL' -Name 'firebase.predeploy.json projectId' -Detail "Expected $expectedProjectId but found $($predeploy.projectId)"
}

$configuredSecrets = @()
foreach ($fn in $firebaseConfig.functions) {
  foreach ($secret in $fn.secrets) {
    $configuredSecrets += [string]$secret
  }
}
$configuredSecrets = $configuredSecrets | Select-Object -Unique
foreach ($secretName in $requiredSecrets) {
  if ($configuredSecrets -contains $secretName) {
    Add-CheckResult -Status 'PASS' -Name "Function secret declared: $secretName" -Detail 'Present in firebase.json'
  } else {
    Add-CheckResult -Status 'FAIL' -Name "Function secret declared: $secretName" -Detail 'Missing from firebase.json functions.secrets'
  }
}

$googleServices = Read-JsonFile -Path 'android/app/google-services.json'
if ($googleServices.project_info.project_id -eq $expectedProjectId) {
  Add-CheckResult -Status 'PASS' -Name 'google-services.json project_id' -Detail $googleServices.project_info.project_id
} else {
  Add-CheckResult -Status 'FAIL' -Name 'google-services.json project_id' -Detail "Expected $expectedProjectId but found $($googleServices.project_info.project_id)"
}

$packageNames = @()
$apiKeys = @()
foreach ($client in $googleServices.client) {
  $packageNames += [string]$client.client_info.android_client_info.package_name
  foreach ($apiKey in $client.api_key) {
    $apiKeys += [string]$apiKey.current_key
  }
}
$packageNames = @($packageNames | Select-Object -Unique)
$apiKeys = @($apiKeys | Select-Object -Unique)

foreach ($expectedPackage in @('com.astrosarfaraz.shamsalasrar', 'com.astrosarfaraz.shamsalasrar.debug')) {
  if ($packageNames -contains $expectedPackage) {
    Add-CheckResult -Status 'PASS' -Name "Android package configured: $expectedPackage" -Detail 'Present in google-services.json'
  } else {
    Add-CheckResult -Status 'FAIL' -Name "Android package configured: $expectedPackage" -Detail 'Missing from google-services.json'
  }
}

if ($apiKeys.Count -eq 1 -and -not [string]::IsNullOrWhiteSpace($apiKeys[0])) {
  Add-CheckResult -Status 'PASS' -Name 'Firebase API key present' -Detail $apiKeys[0]
} else {
  Add-CheckResult -Status 'FAIL' -Name 'Firebase API key present' -Detail 'Missing or inconsistent API key entries in google-services.json'
}

if (
  (Test-FileContains -Path 'src/App.tsx' -Pattern 'initializeAppCheck') -and
  (Test-FileContains -Path 'src/App.tsx' -Pattern 'playIntegrity') -and
  (Test-FileContains -Path 'src/App.tsx' -Pattern 'FIREBASE_APP_CHECK_DEBUG_TOKEN_ANDROID')
) {
  Add-CheckResult -Status 'PASS' -Name 'Client App Check initialization' -Detail 'Found initializeAppCheck + Play Integrity + debug token env wiring'
} else {
  Add-CheckResult -Status 'FAIL' -Name 'Client App Check initialization' -Detail 'Missing expected App Check initialization markers in src/App.tsx'
}

foreach ($callableFile in $requiredCallableFiles) {
  if (Test-FileContains -Path $callableFile -Pattern 'enforceAppCheck:\s*process\.env\.NODE_ENV\s*!==\s*''development''') {
    Add-CheckResult -Status 'PASS' -Name "Callable App Check enforced: $callableFile" -Detail 'Found enforceAppCheck gate'
  } else {
    Add-CheckResult -Status 'FAIL' -Name "Callable App Check enforced: $callableFile" -Detail 'Missing enforceAppCheck in callable function config'
  }
}

foreach ($secretName in $requiredSecrets) {
  if (Test-FileContains -Path 'functions/.env.example' -Pattern ("(?m)^$secretName=")) {
    Add-CheckResult -Status 'PASS' -Name "functions/.env.example documents $secretName" -Detail 'Present'
  } else {
    Add-CheckResult -Status 'FAIL' -Name "functions/.env.example documents $secretName" -Detail 'Missing required secret documentation'
  }
}

if (Test-Path 'functions/.env') {
  $functionsEnvRaw = Get-Content -Path 'functions/.env' -Raw
  if ($functionsEnvRaw -match 'your-razorpay-webhook-secret-here' -or $functionsEnvRaw -match 'your-service-account@project\.iam\.gserviceaccount\.com' -or $functionsEnvRaw -match '-----BEGIN RSA PRIVATE KEY-----\\n\.\.\.\\n-----END RSA PRIVATE KEY-----') {
    Add-CheckResult -Status 'WARN' -Name 'functions/.env local secret placeholders' -Detail 'Local emulator env still contains placeholder values'
  } else {
    Add-CheckResult -Status 'PASS' -Name 'functions/.env local secret placeholders' -Detail 'No known placeholder secrets detected'
  }
} else {
  Add-CheckResult -Status 'WARN' -Name 'functions/.env local secret placeholders' -Detail 'functions/.env not present; emulator-only local secret check skipped'
}

$pinningContent = Get-Content -Path 'src/utils/certificatePinning.ts' -Raw
$pinningHasPlaceholders = $pinningContent -match 'REPLACE_WITH_FIREBASE_PRODUCTION_SHA256' -or $pinningContent -match 'REPLACE_WITH_DEVELOPMENT_SHA256'
$pinningEnabledValue = Select-LineValue -Path 'src/utils/certificatePinning.ts' -Pattern '^\s*enabled:\s*(true|false)\b'
$pinningFailClosedValue = Select-LineValue -Path 'src/utils/certificatePinning.ts' -Pattern '^\s*failOnPinMismatch:\s*(true|false)\b'
$pinningEnabled = $pinningEnabledValue -eq 'true'
$pinningFailClosed = $pinningFailClosedValue -eq 'true'

if ($pinningHasPlaceholders -and $pinningEnabled) {
  Add-CheckResult -Status 'FAIL' -Name 'Certificate pinning configuration' -Detail 'Pinning is enabled while placeholder hashes are still present'
} elseif ($pinningHasPlaceholders) {
  Add-CheckResult -Status 'WARN' -Name 'Certificate pinning configuration' -Detail 'Placeholder certificate pins remain; launch allowed because fail-closed pinning is disabled'
} elseif ($pinningEnabled -and $pinningFailClosed) {
  Add-CheckResult -Status 'PASS' -Name 'Certificate pinning configuration' -Detail 'Real pins appear configured and fail-closed mode is enabled'
} else {
  Add-CheckResult -Status 'WARN' -Name 'Certificate pinning configuration' -Detail 'Pinning is not fully enabled'
}

foreach ($manualCheckName in $requiredManualChecks) {
  Test-ManualCheckTrue -ManualChecks $predeploy.manualChecks -Name $manualCheckName
}

if ($predeploy.manualChecks.PSObject.Properties['certificatePinsCaptured']) {
  if ($predeploy.manualChecks.certificatePinsCaptured -eq $true) {
    Add-CheckResult -Status 'PASS' -Name 'Manual check: certificatePinsCaptured' -Detail 'Attested as complete'
  } else {
    Add-CheckResult -Status 'WARN' -Name 'Manual check: certificatePinsCaptured' -Detail 'Still false in firebase.predeploy.json'
  }
}

if (-not $NoCliChecks) {
  $firebaseCliPath = Resolve-CommandPath -Name 'firebase'
  if ($null -eq $firebaseCliPath) {
    Add-CheckResult -Status 'FAIL' -Name 'Firebase CLI available' -Detail 'firebase command not found on PATH'
  } else {
    Add-CheckResult -Status 'PASS' -Name 'Firebase CLI path resolution' -Detail $firebaseCliPath

    $firebaseVersion = Invoke-FirebaseCli -ArgumentList @('--version') -TimeoutSec 20
    Assert-CommandSucceeded -Result $firebaseVersion -Name 'Firebase CLI available' | Out-Null

    $firebaseLogin = Invoke-FirebaseCli -ArgumentList @('login:list') -TimeoutSec 30
    if (-not $firebaseLogin.timedOut -and $firebaseLogin.exitCode -eq 0 -and $firebaseLogin.stdout -match 'No authorized accounts') {
      Add-CheckResult -Status 'FAIL' -Name 'Firebase CLI authentication' -Detail 'firebase login:list returned no authorized accounts'
    } else {
      Assert-CommandSucceeded -Result $firebaseLogin -Name 'Firebase CLI authentication' | Out-Null
    }
  }
} else {
  Add-CheckResult -Status 'WARN' -Name 'Firebase CLI checks' -Detail 'Skipped via -NoCliChecks'
}

$functionsTypecheck = Invoke-ExternalCommand -FilePath 'node' -ArgumentList @('functions/node_modules/typescript/bin/tsc', '--noEmit', '-p', 'functions/tsconfig.json') -TimeoutSec 600
Assert-CommandSucceeded -Result $functionsTypecheck -Name 'Functions TypeScript compile check' | Out-Null

$appTypecheck = Invoke-ExternalCommand -FilePath 'node' -ArgumentList @('node_modules/typescript/bin/tsc', '--noEmit', '-p', 'tsconfig.json') -TimeoutSec 600
Assert-CommandSucceeded -Result $appTypecheck -Name 'App TypeScript compile check' | Out-Null

if (-not $NoRulesTests) {
  $rulesTestCommand = 'node node_modules/jest/bin/jest.js firestore.rules.test.ts --runInBand --testEnvironment node'
  $firebaseCliPath = Resolve-CommandPath -Name 'firebase'
  if ($null -eq $firebaseCliPath) {
    Add-CheckResult -Status 'FAIL' -Name 'Firestore rules test suite' -Detail 'firebase command not found on PATH'
  } else {
    $rulesResult = Invoke-FirebaseCli -ArgumentList @('emulators:exec', '--config', 'firebase.test.json', '--only', 'firestore', $rulesTestCommand) -TimeoutSec 300
    Assert-CommandSucceeded -Result $rulesResult -Name 'Firestore rules test suite' | Out-Null
  }
} else {
  Add-CheckResult -Status 'WARN' -Name 'Firestore rules test suite' -Detail 'Skipped via -NoRulesTests'
}

Write-Output ''
Write-Output 'Firebase predeploy validation summary'
Write-Output '-----------------------------------'
foreach ($result in $results) {
  Write-Output ("[{0}] {1} :: {2}" -f $result.status, $result.name, $result.detail)
}

if ($hasFailures) {
  Write-Output ''
  Write-Output 'Result: FAIL'
  exit 1
}

Write-Output ''
Write-Output 'Result: PASS'
exit 0
