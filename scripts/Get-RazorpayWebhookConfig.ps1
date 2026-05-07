param(
  [string]$ProjectId = 'shams-app-4d0e7',
  [string]$Region = 'asia-south1',
  [string]$FunctionName = 'razorpayWebhook'
)

$ErrorActionPreference = 'Stop'

$url = "https://$Region-$ProjectId.cloudfunctions.net/$FunctionName"

Write-Host "Razorpay webhook configuration"
Write-Host "ProjectId : $ProjectId"
Write-Host "Region    : $Region"
Write-Host "Function  : $FunctionName"
Write-Host "Webhook   : $url"
Write-Host ""
Write-Host "Register this URL in Razorpay Dashboard -> Settings -> Webhooks."
Write-Host "Use the same secret value you stored as Firebase secret: RAZORPAY_WEBHOOK_SECRET"
Write-Host ""
Write-Host "Recommended Razorpay events:"
Write-Host " - payment.captured"
Write-Host " - subscription.activated"
