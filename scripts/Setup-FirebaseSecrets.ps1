param(
  [string]$ProjectId = 'shams-app-4d0e7',
  [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'

function Require-Command {
  param([Parameter(Mandatory = $true)][string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

function Get-SecretValue {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [string]$EnvVarName = $Name
  )

  $existing = [Environment]::GetEnvironmentVariable($EnvVarName)
  if (-not [string]::IsNullOrWhiteSpace($existing)) {
    return $existing
  }

  if ($CheckOnly) {
    return $null
  }

  Write-Host ""
  Write-Host "Enter value for $Name"
  if ($Name -eq 'GOOGLE_PLAY_PRIVATE_KEY') {
    Write-Host "Paste the full private key. Finish with a line containing only END."
    $lines = New-Object System.Collections.Generic.List[string]
    while ($true) {
      $line = Read-Host
      if ($line -eq 'END') {
        break
      }
      $lines.Add($line) | Out-Null
    }
    return ($lines -join "`n")
  }

  return (Read-Host -Prompt $Name)
}

function Test-PlaceholderValue {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Value
  )

  $normalized = $Value.Trim().ToLowerInvariant()

  if ([string]::IsNullOrWhiteSpace($normalized)) {
    return $true
  }

  $knownPlaceholders = @(
    'your-razorpay-webhook-secret-here',
    'your-service-account@project.iam.gserviceaccount.com',
    '"-----begin rsa private key-----\n...\n-----end rsa private key-----"',
    '-----begin rsa private key-----\n...\n-----end rsa private key-----'
  )

  if ($knownPlaceholders -contains $normalized) {
    return $true
  }

  if ($normalized.Contains('your-') -or $normalized.Contains('example.com')) {
    return $true
  }

  if ($Name -eq 'GOOGLE_PLAY_PRIVATE_KEY' -and $normalized.Contains('...')) {
    return $true
  }

  return $false
}

function Set-FirebaseSecret {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Value,
    [Parameter(Mandatory = $true)][string]$ProjectId
  )

  $tmp = [System.IO.Path]::GetTempFileName()
  try {
    [System.IO.File]::WriteAllText($tmp, $Value, [System.Text.Encoding]::UTF8)
    firebase functions:secrets:set $Name --project $ProjectId --data-file $tmp | Out-Host
  } finally {
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  }
}

Require-Command -Name 'firebase'

$secretNames = @(
  'RAZORPAY_WEBHOOK_SECRET',
  'GOOGLE_PLAY_CLIENT_EMAIL',
  'GOOGLE_PLAY_PRIVATE_KEY'
)

Write-Host "Project: $ProjectId"
Write-Host "Required Firebase function secrets:"
$secretNames | ForEach-Object { Write-Host " - $_" }

if ($CheckOnly) {
  Write-Host ""
  Write-Host "Check-only mode. This script cannot read existing secret values back from Firebase."
  Write-Host "It validates prerequisites and reminds you which secrets must exist."
  exit 0
}

foreach ($secretName in $secretNames) {
  $value = Get-SecretValue -Name $secretName
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "No value provided for $secretName"
  }
  if (Test-PlaceholderValue -Name $secretName -Value $value) {
    throw "Placeholder value detected for $secretName. Provide the real production secret before running this script."
  }
  Set-FirebaseSecret -Name $secretName -Value $value -ProjectId $ProjectId
}

Write-Host ""
Write-Host "Secret setup complete."
Write-Host "Next:"
Write-Host "  1. firebase deploy --only functions --project $ProjectId"
Write-Host "  2. Run scripts/Get-RazorpayWebhookConfig.ps1 to register the webhook in Razorpay Dashboard"
