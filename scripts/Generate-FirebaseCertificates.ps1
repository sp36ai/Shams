#!/usr/bin/env pwsh
<#
.SYNOPSIS
Generate test certificates for Firebase Emulator with SHA1 and SHA256 fingerprints

.DESCRIPTION
Creates self-signed certificate for local Firebase Emulator testing
Generates both SHA256 (recommended) and SHA1 fingerprints
Outputs to functions/certs/ directory

.EXAMPLE
.\Generate-FirebaseCertificates.ps1
#>

param(
    [string]$CertsDir = "functions\certs",
    [int]$ValidityDays = 365,
    [string]$CommonName = "localhost",
    [string]$Organization = "Shams Al-Asrar Dev"
)

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Firebase Emulator Certificate Generation                ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Create certs directory if it doesn't exist
if (-not (Test-Path $CertsDir)) {
    Write-Host "[*] Creating $CertsDir directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $CertsDir -Force | Out-Null
}

Write-Host "[*] Certificate Parameters:" -ForegroundColor Cyan
Write-Host "    Common Name: $CommonName"
Write-Host "    Organization: $Organization"
Write-Host "    Validity: $ValidityDays days"
Write-Host "    Output: $CertsDir\"
Write-Host ""

# File paths
$keyFile = "$CertsDir\firebase-dev.key"
$crtFile = "$CertsDir\firebase-dev.crt"
$pemFile = "$CertsDir\firebase-dev.pem"
$fingerprintsFile = "$CertsDir\fingerprints.json"

# Check if OpenSSL is available
$openssl = Get-Command openssl -ErrorAction SilentlyContinue
if (-not $openssl) {
    Write-Host "[✗] ERROR: OpenSSL not found!" -ForegroundColor Red
    Write-Host "    Install from: https://slproweb.com/products/Win32OpenSSL.html" -ForegroundColor Red
    Write-Host "    Or: choco install openssl"
    exit 1
}

Write-Host "[✓] OpenSSL found: $($openssl.Path)" -ForegroundColor Green
Write-Host ""

# Step 1: Generate private key
Write-Host "[1/5] Generating private key (2048-bit RSA)..." -ForegroundColor Yellow
try {
    & openssl genrsa -out $keyFile 2048 2>&1 | Out-Null
    Write-Host "      ✓ Created: $keyFile" -ForegroundColor Green
} catch {
    Write-Host "      ✗ Failed to generate private key" -ForegroundColor Red
    exit 1
}

# Step 2: Generate self-signed certificate
Write-Host "[2/5] Generating self-signed certificate..." -ForegroundColor Yellow
$subject = "/CN=$CommonName/O=$Organization/C=US/ST=Development/L=Local"
try {
    & openssl req -new -x509 -key $keyFile -out $crtFile -days $ValidityDays `
        -subj $subject 2>&1 | Out-Null
    Write-Host "      ✓ Created: $crtFile" -ForegroundColor Green
} catch {
    Write-Host "      ✗ Failed to generate certificate" -ForegroundColor Red
    exit 1
}

# Step 3: Convert to PEM format
Write-Host "[3/5] Converting to PEM format..." -ForegroundColor Yellow
try {
    & openssl x509 -in $crtFile -out $pemFile 2>&1 | Out-Null
    Write-Host "      ✓ Created: $pemFile" -ForegroundColor Green
} catch {
    Write-Host "      ✗ Failed to convert to PEM" -ForegroundColor Red
    exit 1
}

# Step 4: Extract SHA256 fingerprint
Write-Host "[4/5] Extracting fingerprints..." -ForegroundColor Yellow
try {
    # SHA256 Base64 (for pinning)
    $sha256Base64 = & openssl x509 -in $pemFile -pubkey -noout | `
        & openssl pkey -pubin -outform DER | `
        & openssl dgst -sha256 -binary | `
        & openssl enc -base64 | ForEach-Object { $_ -replace "`n", "" }
    
    Write-Host "      ✓ SHA256 (Base64): $sha256Base64" -ForegroundColor Green

    # SHA256 Hex format
    $sha256Hex = & openssl x509 -in $pemFile -pubkey -noout | `
        & openssl pkey -pubin -outform DER | `
        & openssl dgst -sha256 | ForEach-Object { $_ -replace "^.*= ", "" }
    
    Write-Host "      ✓ SHA256 (Hex):    $sha256Hex" -ForegroundColor Green

    # SHA1 fingerprint (legacy)
    $sha1Output = & openssl x509 -in $pemFile -noout -fingerprint -sha1
    $sha1 = ($sha1Output -replace "^SHA1 Fingerprint=", "").Trim()
    
    Write-Host "      ✓ SHA1:            $sha1" -ForegroundColor Yellow
} catch {
    Write-Host "      ✗ Failed to extract fingerprints" -ForegroundColor Red
    exit 1
}

# Step 5: Create fingerprints.json
Write-Host "[5/5] Creating fingerprints.json..." -ForegroundColor Yellow
$fingerprintsData = @{
    generated = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    validity = @{
        validFrom = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        validUntil = (Get-Date).AddDays($ValidityDays) | ForEach-Object { $_.ToString("yyyy-MM-dd HH:mm:ss") }
        daysValid = $ValidityDays
    }
    certificate = @{
        commonName = $CommonName
        organization = $Organization
        keySize = 2048
    }
    fingerprints = @{
        sha256 = @{
            base64 = $sha256Base64
            hex = $sha256Hex
            purpose = "Primary fingerprint for certificate pinning"
        }
        sha1 = @{
            value = $sha1
            purpose = "Legacy - for reference only"
        }
    }
    files = @{
        privateKey = "firebase-dev.key (KEEP PRIVATE - DO NOT COMMIT)"
        certificate = "firebase-dev.crt (Self-signed)"
        pem = "firebase-dev.pem (For OpenSSL/Node.js)"
    }
    gitignore = "Add '*.key' to .gitignore to prevent private key leaks"
} | ConvertTo-Json -Depth 10

try {
    $fingerprintsData | Out-File -FilePath $fingerprintsFile -Encoding UTF8
    Write-Host "      ✓ Created: $fingerprintsFile" -ForegroundColor Green
} catch {
    Write-Host "      ✗ Failed to create fingerprints.json" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║              ✓ Certificate Generation Complete            ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# Display summary
Write-Host "📋 SUMMARY:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Certificate Files Created:" -ForegroundColor White
Write-Host "  • $keyFile" -ForegroundColor White
Write-Host "  • $crtFile" -ForegroundColor White
Write-Host "  • $pemFile" -ForegroundColor White
Write-Host ""

Write-Host "Fingerprints for Certificate Pinning:" -ForegroundColor White
Write-Host ""
Write-Host "SHA256 (Base64) - USE THIS FOR PINNING:" -ForegroundColor Green
Write-Host "  $sha256Base64" -ForegroundColor Cyan
Write-Host ""
Write-Host "SHA256 (Hex) - For debugging:" -ForegroundColor Yellow
Write-Host "  $sha256Hex" -ForegroundColor Cyan
Write-Host ""
Write-Host "SHA1 (Legacy) - Reference only:" -ForegroundColor Gray
Write-Host "  $sha1" -ForegroundColor Cyan
Write-Host ""

Write-Host "📝 NEXT STEPS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Copy the SHA256 fingerprint (Base64) above"
Write-Host ""
Write-Host "2. Update functions/src/config.ts:" -ForegroundColor White
Write-Host '   development: {' -ForegroundColor Gray
Write-Host '     domain: "localhost:5001",' -ForegroundColor Gray
Write-Host "     sha256: \"$sha256Base64\"," -ForegroundColor Yellow
Write-Host "     sha1: \"$sha1\"" -ForegroundColor Gray
Write-Host '   }' -ForegroundColor Gray
Write-Host ""
Write-Host "3. Update src/utils/certificatePinning.ts with the same values" -ForegroundColor White
Write-Host ""
Write-Host "4. Start Firebase Emulator:" -ForegroundColor White
Write-Host "   firebase emulators:start" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Test with your app" -ForegroundColor White
Write-Host ""

Write-Host "⚠️  SECURITY REMINDERS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  • NEVER commit *.key files to Git" -ForegroundColor Red
Write-Host "  • Add 'functions/certs/*.key' to .gitignore" -ForegroundColor Red
Write-Host "  • This certificate is for LOCAL DEVELOPMENT ONLY" -ForegroundColor Red
Write-Host "  • For production, use Firebase's automatic certificates" -ForegroundColor Red
Write-Host ""

# Create .gitignore entry if needed
$gitignorePath = "$CertsDir\.gitignore"
if (-not (Test-Path $gitignorePath)) {
    @"
# Private keys - NEVER commit
*.key
*.pem
fingerprints.json

# Generated files
*.crt
# Exclude certs directory from production builds
! .gitignore

# IDE
.DS_Store
"@ | Out-File -FilePath $gitignorePath -Encoding UTF8
    Write-Host "✓ Created $gitignorePath" -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ Ready to use for Firebase Emulator!" -ForegroundColor Green
