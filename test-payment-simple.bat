@echo off
echo Тест создания платежа
echo.

curl -X POST https://backaibookver2-production.up.railway.app/api/payments/create ^
  -H "Content-Type: application/json" ^
  -d "{\"deviceId\":\"test-123\",\"tierId\":\"tier1\"}"

echo.
echo.
pause

