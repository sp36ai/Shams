<#
.SYNOPSIS
    Capture the SHA-256 SPKI fingerprint of the production Firebase/Google endpoints.
    Use these values to update src/utils/certificatePinning.ts.
#>

$domains = @(
    "firestore.googleapis.com",
    "firebase.googleapis.com",
    "identitytoolkit.googleapis.com"
)

Write-Host "Capturing SPKI Fingerprints (SHA-256 Base64)..." -ForegroundColor Cyan

foreach ($domain in $domains) {
    Write-Host "`nDomain: $domain" -ForegroundColor Yellow
    
    # Connect to the domain and extract the public key hash
    $opensslCmd = "openssl s_client -connect ${domain}:443 -servername $domain -showcerts < /dev/null 2>/dev/null | openssl x509 -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | openssl enc -base64"
    
    $pin = bash -c $opensslCmd
    
    if ($null -ne $pin) {
        Write-Host "Pin: $pin" -ForegroundColor Green
        Write-Host "Copy this value into PRODUCTION_SPKI_PINS['$domain']"
    } else {
        Write-Host "Failed to capture pin for $domain. Ensure openssl is installed." -ForegroundColor Red
    }
}
Write-Host "`nVerification Complete." -ForegroundColor Cyan