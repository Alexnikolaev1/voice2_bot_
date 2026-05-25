# Subscribe MAX bot to Vercel webhook
# Run: .\scripts\subscribe-webhook.ps1 -Token "..." -WebhookUrl "https://your-app.vercel.app/api/webhook" -Secret "..."

param(
  [Parameter(Mandatory = $true)]
  [string]$Token,

  [Parameter(Mandatory = $true)]
  [string]$WebhookUrl,

  [string]$Secret = ""
)

function Test-MaxWebhookUrl {
  param([string]$Url)

  $Url = $Url.Trim()
  if (-not $Url) {
    return "WebhookUrl is empty."
  }

  $parsed = $null
  if (-not [uri]::TryCreate($Url, [uriKind]::Absolute, [ref]$parsed)) {
    return "WebhookUrl is not a valid absolute URL: '$Url'"
  }

  if ($parsed.Scheme -ne "https") {
    return "WebhookUrl must use https:// (MAX does not accept http://)."
  }

  if ($parsed.Port -ne -1 -and $parsed.Port -ne 443) {
    return "WebhookUrl must not include a port (only HTTPS 443). Remove ':$($parsed.Port)' from the URL."
  }

  $hostname = $parsed.Host
  if ($hostname -match "localhost|127\.0\.0\.1|0\.0\.0\.0") {
    return "WebhookUrl cannot be localhost. Deploy to Vercel (or use an HTTPS tunnel) and pass that public URL."
  }

  if ($hostname -match "YOUR_APP|your-app|example\.com|placeholder") {
    return "WebhookUrl looks like a placeholder. Use your real Vercel URL, e.g. https://voice2bot-gemini.vercel.app/api/webhook"
  }

  if ($Url -notmatch "/api/webhook/?$") {
    return "WebhookUrl should end with /api/webhook (your project route). Got: '$Url'"
  }

  return $null
}

$WebhookUrl = $WebhookUrl.Trim()
$Token = $Token.Trim()

$urlError = Test-MaxWebhookUrl -Url $WebhookUrl
if ($urlError) {
  Write-Error $urlError
  Write-Host ""
  Write-Host "How to get a valid URL:"
  Write-Host "  1. cd Voice2botGemini"
  Write-Host "  2. npx vercel --prod"
  Write-Host "  3. Open https://YOUR-DEPLOYMENT.vercel.app/api/webhook in a browser (should return JSON ok:true)"
  Write-Host "  4. Run this script with that full https URL"
  exit 1
}

$body = @{
  url = $WebhookUrl
  update_types = @("message_created", "message_callback", "bot_started")
}

if ($Secret) {
  $body.secret = $Secret.Trim()
}

$json = $body | ConvertTo-Json -Compress

Write-Host "Subscribing to: $WebhookUrl"

try {
  $response = Invoke-RestMethod `
    -Method Post `
    -Uri "https://platform-api.max.ru/subscriptions" `
    -Headers @{
      Authorization = $Token
      "Content-Type" = "application/json"
    } `
    -Body $json

  $response | ConvertTo-Json -Depth 5
  Write-Host "Done. Test the bot in MAX: /start"
}
catch {
  $detail = $_.ErrorDetails.Message
  if ($detail) {
    Write-Error "MAX API error: $detail"
  }
  else {
    Write-Error $_
  }
  Write-Host ""
  Write-Host "Check:"
  Write-Host "  - URL opens in browser and returns ok (GET /api/webhook)"
  Write-Host "  - No typos, no quotes inside the URL, no trailing spaces"
  Write-Host "  - Token is MAX_BOT_TOKEN from dev.max.ru (Authorization header, not Bearer)"
  exit 1
}
