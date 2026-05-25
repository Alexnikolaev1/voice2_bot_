# Подписка бота MAX на webhook Vercel
# Запуск: .\scripts\subscribe-webhook.ps1

param(
  [Parameter(Mandatory = $true)]
  [string]$Token,

  [Parameter(Mandatory = $true)]
  [string]$WebhookUrl,

  [string]$Secret = ""
)

$body = @{
  url = $WebhookUrl
  update_types = @("message_created", "message_callback", "bot_started")
}

if ($Secret) {
  $body.secret = $Secret
}

$json = $body | ConvertTo-Json -Compress

Write-Host "Подписка на $WebhookUrl ..."

$response = Invoke-RestMethod `
  -Method Post `
  -Uri "https://platform-api.max.ru/subscriptions" `
  -Headers @{
    Authorization = $Token
    "Content-Type" = "application/json"
  } `
  -Body $json

$response | ConvertTo-Json -Depth 5
Write-Host "Готово. Проверьте бота: /start в MAX"
