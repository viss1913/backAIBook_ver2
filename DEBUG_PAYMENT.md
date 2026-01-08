# Диагностика проблем с платежами

## Как найти логи

1. **Railway → ваш проект → Deployments**
2. **Нажмите на последний деплой**
3. **View Logs** или **Logs**
4. Найдите строки с:
   - `=== Creating payment in T-bank ===`
   - `=== T-bank API Request ===`
   - `=== T-bank API Response ===`
   - `=== T-bank API Error ===`

## Что искать в логах

### Успешное создание платежа:

```
=== Creating payment in T-bank ===
Amount: 300 RUB
Tokens: 1000
Order ID: payment_123...

=== T-bank API Request ===
URL: https://securepayments.tbank.ru/api/v1/Init
TerminalKey: 1703150935625DEMO
Params: {...}

=== T-bank API Response ===
Status: 200
Full response: {
  "Success": true,
  "PaymentURL": "https://securepayments.tbank.ru/...",
  ...
}
```

### Ошибка:

```
=== T-bank API Error ===
Error message: ...
Response status: 400/401/500
Response data: {...}
```

## Типичные проблемы

### 1. Payment URL = undefined

**Причина:** Т-банк вернул другую структуру ответа

**Решение:** 
- Найдите в логах "Full response:" 
- Скопируйте полный ответ
- Проверьте, в каком поле находится URL (может быть `PaymentURL`, `PaymentUrl`, `Url`, `url`)

### 2. Ошибка 401 (Unauthorized)

**Причина:** Неверный TerminalKey или Password

**Решение:**
- Проверьте переменные `TBANK_TERMINAL_KEY` и `TBANK_PASSWORD` в Railway
- Убедитесь, что используете боевые ключи, а не тестовые

### 3. Ошибка 400 (Bad Request)

**Причина:** Неверный формат запроса или параметры

**Решение:**
- Проверьте логи "Params:" - все ли параметры правильные
- Убедитесь, что сумма в копейках (умножена на 100)
- Проверьте формат OrderId

### 4. Ошибка сети (ECONNREFUSED, ETIMEDOUT)

**Причина:** Т-банк API недоступен или неправильный URL

**Решение:**
- Проверьте `TBANK_API_URL` в переменных окружения
- Убедитесь, что URL правильный: `https://securepayments.tbank.ru/api/v1`

## Скопируйте и отправьте

Когда найдете проблему, скопируйте из логов:

1. **Полный ответ от Т-банк** (строка "Full response:")
2. **Ошибку** (если есть, строка "=== T-bank API Error ===")
3. **Параметры запроса** (строка "Params:")

Это поможет исправить проблему.

