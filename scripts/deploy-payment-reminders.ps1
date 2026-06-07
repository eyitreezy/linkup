# Deploy payment-reminder-sweep + cron secret (Windows PowerShell).
# Run from repo root:  .\scripts\deploy-payment-reminders.ps1
#
# Requires: migration 20260528120000_payment_reminder_automation.sql applied
# Push + email: Database Webhooks on notifications INSERT (see docs/PAYMENT_REMINDER_AUTOMATION.md)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

function New-RandomSecret {
  return ([guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")).Substring(0, 48)
}

$cronSecret = $env:PAYMENT_REMINDER_CRON_SECRET
if (-not $cronSecret) {
  $cronSecret = New-RandomSecret
  Write-Host "Generated PAYMENT_REMINDER_CRON_SECRET (use for cron header x-cron-secret):"
  Write-Host $cronSecret
}

Write-Host "`nSetting secret..."
npx supabase secrets set "PAYMENT_REMINDER_CRON_SECRET=$cronSecret"

Write-Host "`nDeploying payment-reminder-sweep..."
npx supabase functions deploy payment-reminder-sweep --no-verify-jwt

Write-Host "`nDone. Next:"
Write-Host "1. npx supabase db push   (if migration not applied)"
Write-Host "2. Dashboard -> Edge Functions -> payment-reminder-sweep -> Schedules"
Write-Host "   Cron: */15 * * * *   Header: x-cron-secret = $cronSecret"
Write-Host "3. Confirm notifications INSERT webhooks for push + email"
Write-Host "See docs/PAYMENT_REMINDER_AUTOMATION.md"
