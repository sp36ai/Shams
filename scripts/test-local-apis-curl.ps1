$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Invoke-CurlRequest {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Url,
    [string]$Body,
    [hashtable]$Headers
  )

  $respFile = [System.IO.Path]::GetTempFileName()
  $bodyFile = $null
  try {
    $curlArgs = @('-sS', '--connect-timeout', '10', '--max-time', '30', '-X', $Method, $Url, '-o', $respFile, '-w', '%{http_code}')
    if ($Headers) {
      foreach ($k in $Headers.Keys) {
        $curlArgs += @('-H', "${k}: $($Headers[$k])")
      }
    }
    if ($null -ne $Body) {
      $bodyFile = [System.IO.Path]::GetTempFileName()
      [System.IO.File]::WriteAllText($bodyFile, [string]$Body, [System.Text.Encoding]::UTF8)
      $curlArgs += @('--data-binary', "@$bodyFile")
    }

    $statusRaw = & curl.exe @curlArgs
    $bodyText = Get-Content $respFile -Raw
    $statusCode = 0
    [void][int]::TryParse($statusRaw, [ref]$statusCode)

    $json = $null
    try {
      if ($bodyText) {
        $json = $bodyText | ConvertFrom-Json
      }
    } catch {
      $json = $null
    }

    return [pscustomobject]@{
      name   = $Name
      status = $statusCode
      body   = $bodyText
      json   = $json
    }
  } finally {
    Remove-Item $respFile -Force -ErrorAction SilentlyContinue
    if ($bodyFile) {
      Remove-Item $bodyFile -Force -ErrorAction SilentlyContinue
    }
  }
}

function Add-Result {
  param([System.Collections.Generic.List[object]]$List, [object]$Resp)
  $List.Add([pscustomobject]@{
    name = $Resp.name
    status = $Resp.status
    body = $Resp.body
  }) | Out-Null
}

$projectId = 'shams-app-4d0e7'
$region = 'asia-south1'
$functionsBase = "http://127.0.0.1:5001/$projectId/$region"
$authBase = 'http://127.0.0.1:9099'

$results = New-Object System.Collections.Generic.List[object]

# Auth emulator login for callable endpoints
$authBody = @{ email = 'curltester@example.com'; password = 'Passw0rd!'; returnSecureToken = $true } | ConvertTo-Json -Compress
$signUp = Invoke-CurlRequest -Name 'auth.signUp' -Method 'POST' -Url "$authBase/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key" -Body $authBody -Headers @{ 'Content-Type' = 'application/json' }
Add-Result -List $results -Resp $signUp

$signIn = Invoke-CurlRequest -Name 'auth.signInWithPassword' -Method 'POST' -Url "$authBase/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key" -Body $authBody -Headers @{ 'Content-Type' = 'application/json' }
Add-Result -List $results -Resp $signIn

$idToken = $null
if ($signIn.json -and $signIn.json.idToken) {
  $idToken = [string]$signIn.json.idToken
}
if ([string]::IsNullOrWhiteSpace($idToken)) {
  throw "No idToken from auth emulator. signUp=$($signUp.status) signIn=$($signIn.status)"
}

$callHeaders = @{
  'Content-Type' = 'application/json'
  'Authorization' = "Bearer $idToken"
}

# 0) health endpoint (HTTP)
$health = Invoke-CurlRequest -Name 'health' -Method 'GET' -Url "$functionsBase/health"
Add-Result -List $results -Resp $health

# 1) getQuota (authenticated callable)
$quotaReq = @{ data = @{} } | ConvertTo-Json -Compress
$quota = Invoke-CurlRequest -Name 'getQuota' -Method 'POST' -Url "$functionsBase/getQuota" -Body $quotaReq -Headers $callHeaders
Add-Result -List $results -Resp $quota

# 2) askWatchOracle valid payload (happy path — New RKP watch computation).
#    No lat/lon: the watch frame needs no location. utcOffsetMinutes uses the
#    sign convention the server expects (+05:30 -> 330).
$askValidReq = @{
  data = @{
    question = 'Will my business launch succeed this year?'
    questionLang = 'en'
    utcOffsetMinutes = 330
  }
} | ConvertTo-Json -Compress
$askValid = Invoke-CurlRequest -Name 'askWatchOracle.valid' -Method 'POST' -Url "$functionsBase/askWatchOracle" -Body $askValidReq -Headers $callHeaders
Add-Result -List $results -Resp $askValid

# 3) askWatchOracle invalid payload (fast schema validation)
$askInvalidReq = @{
  data = @{
    question = 'bad'
    questionLang = 'xx'
    utcOffsetMinutes = 9999
  }
} | ConvertTo-Json -Compress
$askInvalid = Invoke-CurlRequest -Name 'askWatchOracle.invalid' -Method 'POST' -Url "$functionsBase/askWatchOracle" -Body $askInvalidReq -Headers $callHeaders
Add-Result -List $results -Resp $askInvalid

# 3) syncReadings valid mock payload
$mockReadingId = 'mock-sync-reading-001'
$syncReq = @{
  data = @{
    readings = @(
      @{
        id = $mockReadingId
        question = 'Will my business launch succeed?'
        questionLang = 'en'
        category = 'career'
        verdict = 'YES'
        createdAt = '2026-01-15T10:00:00.000Z'
        chartJson = @{ mock = $true }
        verdictJson = @{ score = 0.8 }
      }
    )
  }
} | ConvertTo-Json -Compress -Depth 20
$sync = Invoke-CurlRequest -Name 'syncReadings' -Method 'POST' -Url "$functionsBase/syncReadings" -Body $syncReq -Headers $callHeaders
Add-Result -List $results -Resp $sync

# 4) deleteReading for the synced mock reading
$deleteReq = @{ data = @{ readingId = $mockReadingId } } | ConvertTo-Json -Compress
$delete = Invoke-CurlRequest -Name 'deleteReading' -Method 'POST' -Url "$functionsBase/deleteReading" -Body $deleteReq -Headers $callHeaders
Add-Result -List $results -Resp $delete

# 5) verifyGooglePlayPurchase with unknown product (fast invalid-argument path)
$gpReq = @{
  data = @{
    purchaseToken = 'mock_purchase_token_123'
    productId = 'mock_unknown_product'
    packageName = 'com.astrosarfaraz.shamsalasrar'
  }
} | ConvertTo-Json -Compress
$gp = Invoke-CurlRequest -Name 'verifyGooglePlayPurchase.invalidProduct' -Method 'POST' -Url "$functionsBase/verifyGooglePlayPurchase" -Body $gpReq -Headers $callHeaders
Add-Result -List $results -Resp $gp

# 6) razorpayWebhook invalid signature
$hookBody = '{"event":"payment.captured","payload":{"payment":{"entity":{"notes":{"userId":"u1","planId":"plan_starter_weekly"}}}}}'
$razor = Invoke-CurlRequest -Name 'razorpayWebhook.invalidSignature' -Method 'POST' -Url "$functionsBase/razorpayWebhook" -Body $hookBody -Headers @{
  'Content-Type' = 'application/json'
  'x-razorpay-signature' = 'deadbeef'
}
Add-Result -List $results -Resp $razor

Write-Output '=== CURL TEST SUMMARY ==='
$results | Select-Object name, status | Format-Table -AutoSize | Out-String | Write-Output

Write-Output '=== CURL TEST RESPONSES ==='
$results | ConvertTo-Json -Depth 8
