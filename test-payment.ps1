# Тест создания платежа через PowerShell

$baseUrl = "https://backaibookver2-production.up.railway.app"
$deviceId = "test-device-$(Get-Date -Format 'yyyyMMddHHmmss')"

Write-Host "🧪 Тест создания платежа" -ForegroundColor Cyan
Write-Host "Base URL: $baseUrl"
Write-Host "Device ID: $deviceId"
Write-Host ""

$body = @{
    deviceId = $deviceId
    tierId = "tier1"
} | ConvertTo-Json

Write-Host "📤 Отправка запроса..." -ForegroundColor Yellow
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/payments/create" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -TimeoutSec 30

    Write-Host "✅ Ответ получен!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Полный ответ:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10
    Write-Host ""

    if ($response.success) {
        Write-Host "✅ Платеж создан успешно!" -ForegroundColor Green
        Write-Host "Payment ID: $($response.paymentId)" -ForegroundColor White
        Write-Host "Payment URL: $($response.paymentUrl)" -ForegroundColor White
        Write-Host "Amount: $($response.amount) RUB" -ForegroundColor White
        Write-Host "Tokens: $($response.tokensAmount)" -ForegroundColor White
        
        if ($response.paymentUrl) {
            Write-Host ""
            Write-Host "🌐 Payment URL можно открыть в браузере" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "❌ ПРОБЛЕМА: Payment URL не получен!" -ForegroundColor Red
            Write-Host "Проверьте логи Railway" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ Ошибка: $($response.error)" -ForegroundColor Red
        if ($response.details) {
            Write-Host "Детали: $($response.details)" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "❌ Ошибка запроса:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.ErrorDetails.Message) {
        Write-Host ""
        Write-Host "Детали ошибки:" -ForegroundColor Yellow
        Write-Host $_.ErrorDetails.Message -ForegroundColor Yellow
    }
}

