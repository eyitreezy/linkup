# Configure Supabase Auth SMTP for signup confirm + password reset (Windows PowerShell).
# Auth mail is separate from notification-email Edge Function secrets.
#
# Run from repo root:  .\scripts\configure-auth-smtp.ps1
#
# Prerequisites:
#   Resend account with verified flowdecklabs.com (or your sending domain)
#   Supabase Dashboard access for project LinkUp (othikifibhjpfgyxpzcu)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$resendKey = $env:RESEND_API_KEY
if (-not $resendKey) {
  $resendKey = Read-Host "Paste your Resend API key (re_...)"
}

$authFrom = $env:AUTH_SMTP_FROM
if (-not $authFrom) {
  Write-Host ""
  Write-Host "Use a verified sender on your domain. Do NOT use admin@ unless authorized in Resend."
  Write-Host "Recommended: LinkUp <auth@flowdecklabs.com>"
  $input = Read-Host "Auth SMTP sender (Enter = LinkUp <auth@flowdecklabs.com>)"
  if ([string]::IsNullOrWhiteSpace($input)) {
    $authFrom = "LinkUp <auth@flowdecklabs.com>"
  } else {
    $authFrom = $input
  }
}

Write-Host ""
Write-Host "=== Supabase Dashboard steps (Auth SMTP cannot be set via CLI) ==="
Write-Host ""
Write-Host "1. Open: https://supabase.com/dashboard/project/othikifibhjpfgyxpzcu/settings/auth"
Write-Host "2. SMTP Settings -> Enable custom SMTP"
Write-Host "3. Enter:"
Write-Host "     Host:     smtp.resend.com"
Write-Host "     Port:     465 (SSL) or 587 (STARTTLS)"
Write-Host "     Username: resend"
Write-Host "     Password: (your Resend API key — same as notification mail)"
Write-Host "     Sender:   $authFrom"
Write-Host ""
Write-Host "4. Authentication -> URL Configuration -> Redirect URLs must include:"
Write-Host "     linkup://auth/callback"
Write-Host ""
Write-Host "5. Authentication -> Email Templates:"
Write-Host "     Confirm signup  <- supabase/email-templates/confirmation.html"
Write-Host "     Reset password  <- supabase/email-templates/recovery.html"
Write-Host ""
Write-Host "6. Resend -> Domains -> verify flowdecklabs.com (SPF, DKIM, DMARC)"
Write-Host ""
Write-Host "7. Test: sign up with Gmail, then check Authentication -> Logs for send errors."
Write-Host ""
Write-Host "If you see bounces to admin@flowdecklabs.com, the old sender is still configured in Supabase SMTP."
Write-Host "See docs/EMAIL_VERIFICATION_SETUP.md"
Write-Host ""

if ($resendKey) {
  Write-Host "Resend API key captured for your reference (not stored by this script)."
}

Write-Host "Done."
