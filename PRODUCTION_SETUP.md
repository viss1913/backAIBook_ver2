# Настройка боевых ключей Т-банка для Production

## Текущая реализация

✅ **Уже работает:**
1. Создание платежа через `/api/payments/create`
2. Получение `paymentUrl` от Т-банка
3. Возврат `paymentUrl` на фронт (Android приложение)
4. Android открывает Payment URL в браузере/WebView

## Настройка боевых ключей

### 1. Получите боевые данные от Т-банка

В личном кабинете Т-банка получите:
- **TerminalKey** (ID терминала)
- **Password** (Пароль терминала)

### 2. Добавьте в Railway → Variables

Замените тестовые значения на боевые:

```env
# Боевые ключи Т-банка (замените на ваши!)
TBANK_TERMINAL_KEY=ваш_боевой_terminal_key
TBANK_PASSWORD=ваш_боевой_password
TBANK_API_URL=https://securepayments.tbank.ru/api/v1

# URLs для редиректов (используем Railway URL)
TBANK_SUCCESS_URL=https://backaibookver2-production.up.railway.app/api/payments/tbank/success
TBANK_FAILURE_URL=https://backaibookver2-production.up.railway.app/api/payments/tbank/failure
BASE_URL=https://backaibookver2-production.up.railway.app
```

### 3. Настройте Webhook в Т-банк

В личном кабинете Т-банка:
1. Интернет-эквайринг → Настройки → Webhook/Callback URL
2. Укажите:
   ```
   https://backaibookver2-production.up.railway.app/api/payments/tbank/callback
   ```
3. Сохраните

## Как это работает

### Поток оплаты:

1. **Android приложение** вызывает:
   ```
   POST /api/payments/create
   Body: {"deviceId": "...", "tierId": "tier2"}
   ```

2. **Сервер** создает платеж в Т-банк и возвращает:
   ```json
   {
     "success": true,
     "paymentId": "payment_123...",
     "paymentUrl": "https://securepayments.tbank.ru/...",
     "amount": 549.00,
     "tokensAmount": 2000
   }
   ```

3. **Android приложение** получает `paymentUrl` и открывает его:
   - В браузере: `Intent.ACTION_VIEW`
   - Или в WebView внутри приложения

4. **Пользователь** оплачивает на странице Т-банка

5. **Т-банк** отправляет webhook на:
   ```
   POST https://backaibookver2-production.up.railway.app/api/payments/tbank/callback
   ```

6. **Сервер** обрабатывает webhook и начисляет токены

7. **Android приложение** может проверить статус:
   ```
   GET /api/payments/status/{paymentId}
   ```

## Проверка после настройки

### 1. Проверьте создание платежа:

```bash
curl -X POST https://backaibookver2-production.up.railway.app/api/payments/create \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"test-123","tierId":"tier1"}'
```

**Должен вернуть:**
```json
{
  "success": true,
  "paymentUrl": "https://securepayments.tbank.ru/...",
  ...
}
```

### 2. Проверьте webhook URL:

Webhook должен быть доступен по HTTPS:
```
https://backaibookver2-production.up.railway.app/api/payments/tbank/callback
```

### 3. Проверьте логи Railway:

После создания платежа проверьте логи:
- Railway → Deployments → View Logs
- Должны быть логи: "Т-банк API ответ: ..."

## Важные моменты

1. **Payment URL** передается на фронт - Android открывает его
2. **Webhook** работает автоматически - Т-банк сам отправляет callback
3. **Токены начисляются** автоматически после успешной оплаты
4. **Railway URL** уже работает по HTTPS - можно использовать сразу

## Если Payment URL = undefined

Если `paymentUrl` возвращается как `undefined`, проверьте логи Railway:
- Найдите "Т-банк API ответ:" в логах
- Скопируйте полный ответ от Т-банка
- Возможно, нужно исправить парсинг ответа

## Готово к использованию

После настройки боевых ключей:
1. ✅ Создание платежей работает
2. ✅ Payment URL передается на фронт
3. ✅ Webhook обрабатывается автоматически
4. ✅ Токены начисляются после оплаты

Можно тестировать с реальными платежами!

