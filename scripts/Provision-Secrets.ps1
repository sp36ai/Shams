<#
.SYNOPSIS
    Provision production secrets to GCP Secret Manager and grant access to Cloud Functions.
#>

$projectId = "shams-app-4d0e7"
$secrets = @("RAZORPAY_WEBHOOK_SECRET", "GOOGLE_PLAY_CLIENT_EMAIL", "GOOGLE_PLAY_PRIVATE_KEY", "ANTHROPIC_API_KEY")

Write-Host "Configuring Secret Manager for project: $projectId" -ForegroundColor Cyan

# 1. Create secrets if they don't exist
foreach ($s in $secrets) {
    $exists = gcloud secrets list --filter="name:$s" --format="value(name)"
    if (-not $exists) {
        Write-Host "Creating secret: $s" -ForegroundColor Yellow
        gcloud secrets create $s --replication-policy="automatic"
    }
}

# 2. Grant access to the Cloud Functions Service Account
$saEmail = "shams-app-4d0e7@appspot.gserviceaccount.com"

foreach ($s in $secrets) {
    Write-Host "Granting secretAccessor role to $saEmail for $s" -ForegroundColor Yellow
    gcloud secrets add-iam-policy-binding $s `
        --member="serviceAccount:$saEmail" `
        --role="roles/secretmanager.secretAccessor"
}

Write-Host "`nProvisioning Complete." -ForegroundColor Green
Write-Host "Action Required: Set values via Firebase CLI:" -ForegroundColor Yellow
Write-Host "firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET"
Write-Host "firebase functions:secrets:set GOOGLE_PLAY_CLIENT_EMAIL"
Write-Host "firebase functions:secrets:set GOOGLE_PLAY_PRIVATE_KEY"
Write-Host "firebase functions:secrets:set ANTHROPIC_API_KEY"