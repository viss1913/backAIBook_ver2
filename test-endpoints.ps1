# Проверка доступности endpoints

$baseUrl = "https://backaibookver2-production.up.railway.app"

Write-Host "🔍 Проверка доступности endpoints" -ForegroundColor Cyan
Write-Host ""

# 1. Health check
Write-Host "1. Проверка /health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET -TimeoutSec 10
    Write-Host "   ✅ Сервер работает" -ForegroundColor Green
    Write-Host "   Status: $($health.status)" -ForegroundColor White
} catch {
    Write-Host "   ❌ Сервер недоступен: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 2. Pricing endpoint
Write-Host "2. Проверка /api/payments/pricing..." -ForegroundColor Yellow
try {
    $pricing = Invoke-RestMethod -Uri "$baseUrl/api/payments/pricing" -Method GET -TimeoutSec 10
    Write-Host "   ✅ Endpoint работает" -ForegroundColor Green
    Write-Host "   Тарифов: $($pricing.pricing.Count)" -ForegroundColor White
} catch {
    Write-Host "   ❌ Endpoint недоступен: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Детали: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""

# 3. Create payment endpoint
Write-Host "3. Проверка /api/payments/create..." -ForegroundColor Yellow
$body = @{
    deviceId = "test-123"
    tierId = "tier1"
} | ConvertTo-Json

try {
    $payment = Invoke-RestMethod -Uri "$baseUrl/api/payments/create" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 30
    Write-Host "   ✅ Endpoint работает" -ForegroundColor Green
    Write-Host "   Payment ID: $($payment.paymentId)" -ForegroundColor White
    Write-Host "   Payment URL: $($payment.paymentUrl)" -ForegroundColor White
} catch {
    Write-Host "   ❌ Endpoint недоступен или ошибка" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        $errorData = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "   Ошибка: $($errorData.error)" -ForegroundColor Yellow
        if ($errorData.details) {
            Write-Host "   Детали: $($errorData.details)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   Ошибка: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "✅ Проверка завершена" -ForegroundColor Cyan

