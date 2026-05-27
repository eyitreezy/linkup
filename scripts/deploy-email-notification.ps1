# Deploy LinkUp notification-email Edge Function + secrets (Windows PowerShell).
# Run from repo root:  .\scripts\deploy-email-notification.ps1
#
# Prerequisites:
#   Resend API key + verified domain + From address
#   npx supabase login
#   npx supabase link --project-ref othikifibhjpfgyxpzcu

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

function New-RandomSecret {
  return ([guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")).Substring(0, 48)
}

$resendKey = $env:RESEND_API_KEY
if (-not $resendKey) {
  $resendKey = Read-Host "Paste your Resend API key (re_...)"
}

$resendFrom = $env:RESEND_FROM
if (-not $resendFrom) {
  Write-Host ""
  Write-Host "No custom domain yet? Press Enter to use Resend DEV sender:"
  Write-Host "  LinkUp <onboarding@resend.dev>"
  Write-Host "  (Only delivers to the email you used to sign up for Resend — fine for a quick test.)"
  Write-Host "  For real users you need a verified domain later — see docs/EMAIL_NOTIFICATIONS_SETUP.md"
  Write-Host ""
  $input = Read-Host 'RESEND_FROM (Enter = dev default, or type LinkUp <notify@yourdomain.com>)'
  if ([string]::IsNullOrWhiteSpace($input)) {
    $resendFrom = 'LinkUp <onboarding@resend.dev>'
  } else {
    $resendFrom = $input
  }
}

$webhookSecret = $env:NOTIFICATION_EMAIL_WEBHOOK_SECRET
if (-not $webhookSecret) {
  $webhookSecret = New-RandomSecret
  Write-Host "Generated NOTIFICATION_EMAIL_WEBHOOK_SECRET (use for Database Webhook header x-linkup-webhook-secret):"
  Write-Host $webhookSecret
}

Write-Host "`nSetting secrets..."
npx supabase secrets set "RESEND_API_KEY=$resendKey"
npx supabase secrets set "RESEND_FROM=$resendFrom"
npx supabase secrets set "NOTIFICATION_EMAIL_WEBHOOK_SECRET=$webhookSecret"

Write-Host "`nDeploying notification-email..."
npx supabase functions deploy notification-email --no-verify-jwt

Write-Host "`nDone. Next: Supabase Dashboard -> Database -> Webhooks -> notifications INSERT"
Write-Host "URL: https://othikifibhjpfgyxpzcu.supabase.co/functions/v1/notification-email"
Write-Host "Header: x-linkup-webhook-secret = $webhookSecret"
