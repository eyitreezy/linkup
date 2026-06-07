# Deploy Paystack Edge Functions + secret (Windows PowerShell).
# Run from repo root:  .\scripts\deploy-paystack.ps1
#
# Prerequisites:
#   Paystack Dashboard → Settings → API Keys (test or live)
#   npx supabase login
#   npx supabase link --project-ref othikifibhjpfgyxpzcu

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

function Test-SupabaseCliAuth {
  $null = npx supabase projects list 2>&1
  if ($LASTEXITCODE -eq 0) { return $true }
  return $false
}

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  if (-not (Test-SupabaseCliAuth)) {
    Write-Host ""
    Write-Host "Supabase CLI is not authenticated in this terminal." -ForegroundColor Yellow
    Write-Host "On Windows (especially Cursor terminal), login often does not persist."
    Write-Host ""
    Write-Host "Fix (pick one):"
    Write-Host "  A) Windows Terminal or PowerShell outside Cursor:"
    Write-Host "       npx supabase login"
    Write-Host "  B) Personal access token (recommended):"
    Write-Host "       1. https://supabase.com/dashboard/account/tokens -> Generate new token"
    Write-Host "       2. In THIS terminal:"
    Write-Host '          $env:SUPABASE_ACCESS_TOKEN = "sbp_paste_token_here"'
    Write-Host "       3. Re-run: .\scripts\deploy-paystack.ps1"
    Write-Host ""
    throw "Missing SUPABASE_ACCESS_TOKEN. Set it or run supabase login in a terminal where auth works."
  }
} else {
  Write-Host "Using SUPABASE_ACCESS_TOKEN from environment."
}

$secret = $env:PAYSTACK_SECRET_KEY
if (-not $secret) {
  Write-Host "Paste your Paystack SECRET key (sk_test_... or sk_live_...):"
  $secret = Read-Host "PAYSTACK_SECRET_KEY"
}

if (-not $secret) {
  throw "PAYSTACK_SECRET_KEY is required."
}

Write-Host "`nSetting PAYSTACK_SECRET_KEY (server only — never in the mobile app)..."
npx supabase secrets set "PAYSTACK_SECRET_KEY=$secret"

Write-Host "`nDeploying paystack-checkout-return (HTTPS → linkup:// after payment)..."
npx supabase functions deploy paystack-checkout-return --no-verify-jwt

Write-Host "`nDeploying paystack-initialize (JWT required — user checkout)..."
npx supabase functions deploy paystack-initialize

Write-Host "`nDeploying paystack-webhook router (no JWT — paste this ONE URL in Paystack)..."
npx supabase functions deploy paystack-webhook --no-verify-jwt

Write-Host "`nDeploying paystack-webhook-escrow (internal handler)..."
npx supabase functions deploy paystack-webhook-escrow --no-verify-jwt

Write-Host "`nDeploying paystack-webhook-premium (internal handler)..."
npx supabase functions deploy paystack-webhook-premium --no-verify-jwt

Write-Host "`nDone. Next steps:"
Write-Host "1. Paystack Dashboard -> Settings -> API Keys & Webhooks -> copy PUBLIC key to .env"
Write-Host "2. Same page -> Test Webhook URL (Test mode ON):"
Write-Host "   https://othikifibhjpfgyxpzcu.supabase.co/functions/v1/paystack-webhook"
Write-Host "3. Restart Expo after updating .env"
Write-Host "Full guide: docs/PAYSTACK_SETUP.md"
