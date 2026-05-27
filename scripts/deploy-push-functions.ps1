# Deploy LinkUp push Edge Functions + secrets (Windows PowerShell).
# Run from repo root:  .\scripts\deploy-push-functions.ps1
#
# Prerequisites:
#   npx supabase login
#   npx supabase link --project-ref othikifibhjpfgyxpzcu   (if not already linked)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

function New-RandomSecret {
  return ([guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")).Substring(0, 48)
}

$webhookSecret = $env:PUSH_NOTIFICATION_WEBHOOK_SECRET
if (-not $webhookSecret) {
  $webhookSecret = New-RandomSecret
  Write-Host "Generated PUSH_NOTIFICATION_WEBHOOK_SECRET (save this for the Database Webhook header):"
  Write-Host $webhookSecret
}

$testSecret = $env:PUSH_TEST_SECRET
if (-not $testSecret) {
  $testSecret = New-RandomSecret
  Write-Host "Generated PUSH_TEST_SECRET (for test-expo-push curl):"
  Write-Host $testSecret
}

Write-Host "`nSetting secrets..."
npx supabase secrets set "PUSH_NOTIFICATION_WEBHOOK_SECRET=$webhookSecret"
npx supabase secrets set "PUSH_TEST_SECRET=$testSecret"

Write-Host "`nDeploying functions..."
npx supabase functions deploy push-on-notification --no-verify-jwt
npx supabase functions deploy test-expo-push --no-verify-jwt

Write-Host "`nDone. Next: Supabase Dashboard -> Database -> Webhooks -> notifications INSERT -> push-on-notification"
Write-Host "Header: x-linkup-webhook-secret = $webhookSecret"
