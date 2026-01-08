# Обновление интеграции с Т-банк API

## Изменения

### 1. Параметры подключения

**Было:**
- `TBANK_MERCHANT_ID`
- `TBANK_SECRET_KEY`

**Стало:**
- `TBANK_TERMINAL_KEY` - ID терминала (например: `1703150935625DEMO`)
- `TBANK_PASSWORD` - Пароль терминала (например: `xcbixwo8gsjibu6u`)

### 2. Формат запросов

Согласно документации Т-банк API: https://developer.tbank.ru/eacq/api

**Параметры запроса:**
- `TerminalKey` вместо `merchant_id`
- `Amount` в копейках (умножаем на 100)
- `OrderId` вместо `order_id`
- `Token` вместо `signature` (генерируется через SHA256)

**Endpoints:**
- `/Init` - создание платежа
- `/GetState` - проверка статуса платежа

### 3. Генерация Token

```javascript
// Формируем строку: все параметры кроме Token, отсортированные по алфавиту
const sortedParams = Object.keys(params)
  .filter(key => key !== 'Token')
  .sort()
  .map(key => `${key}=${params[key]}`)
  .join('&');

// Добавляем пароль
const stringToSign = `${sortedParams}&Password=${TBANK_PASSWORD}`;

// SHA256 хэш
const token = crypto.createHash('sha256').update(stringToSign).digest('hex');
```

### 4. Статусы платежей

Т-банк использует следующие статусы:
- `NEW` - новый платеж
- `FORM_SHOWED` - форма показана
- `PREAUTHORIZING` - предавторизация
- `AUTHORIZING` - авторизация
- `AUTHORIZED` - авторизован
- `CONFIRMED` - подтвержден (успешный платеж)
- `REJECTED` - отклонен
- `AUTH_FAIL` - ошибка авторизации
- `CANCELED` - отменен
- `REFUNDED` - возвращен

**Маппинг на наши статусы:**
- `CONFIRMED`, `AUTHORIZED` → `completed`
- `REJECTED`, `AUTH_FAIL` → `failed`
- `CANCELED` → `cancelled`
- `PREAUTHORIZING`, `AUTHORIZING`, `CONFIRMING` → `processing`
- `NEW`, `FORM_SHOWED` → `pending`

### 5. Тарифы токенов

Добавлены предустановленные тарифы:

| Тариф | Токены | Цена | Цена за токен |
|-------|--------|------|---------------|
| tier1 | 1000 | 300 ₽ | 0.30 ₽ |
| tier2 | 2000 | 549 ₽ | 0.2745 ₽ |
| tier3 | 4000 | 999 ₽ | 0.24975 ₽ |

**Endpoint:** `GET /api/payments/pricing`

## Тестирование

### Тестовые данные

```
TerminalKey: 1703150935625DEMO
Password: xcbixwo8gsjibu6u
```

### Пример запроса создания платежа

```bash
POST /api/payments/create
Content-Type: application/json

{
  "deviceId": "test-device-123",
  "tierId": "tier1"
}
```

**Ответ:**
```json
{
  "success": true,
  "paymentId": "payment_1234567890_abc123",
  "paymentUrl": "https://securepayments.tbank.ru/...",
  "orderId": "payment_1234567890_abc123",
  "amount": 300.00,
  "tokensAmount": 1000,
  "status": "processing"
}
```

## Документация Т-банк

- API документация: https://developer.tbank.ru/eacq/api
- Подключение: https://developer.tbank.ru/eacq/intro/connection

## Важные замечания

1. **Amount в копейках**: Т-банк принимает сумму в копейках, поэтому умножаем на 100
2. **Token (подпись)**: Генерируется через SHA256, не MD5
3. **PaymentId**: После создания платежа Т-банк возвращает `PaymentId`, который нужно сохранить для проверки статуса
4. **Webhook**: Т-банк отправляет callback с параметрами в формате PascalCase (OrderId, PaymentId, Status и т.д.)



