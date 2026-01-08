# Исправление интеграции с Т-банк API

## Проблема
Использовался неправильный endpoint и URL согласно документации: https://developer.tbank.ru/eacq/api/init

## Исправления

### 1. Endpoint изменен
- ❌ Было: `/Init` или `/api/v1/Init`
- ✅ Стало: `/v2/Init`

### 2. URL изменен
- ❌ Было: `https://securepayments.tbank.ru/api/v1`
- ✅ Стало: `https://securepay.tinkoff.ru`

### 3. Полный URL для запроса
```
POST https://securepay.tinkoff.ru/v2/Init
```

## Обновление переменных окружения

В Railway → Variables обновите:

```env
TBANK_API_URL=https://securepay.tinkoff.ru
```

**Важно:** Уберите `/api/v1` из URL, оставьте только базовый URL!

## Проверка после обновления

После деплоя проверьте логи:
1. Должен быть запрос на: `https://securepay.tinkoff.ru/v2/Init`
2. Должен вернуться `PaymentURL` в ответе
3. Статус должен быть 200

## Документация
- Официальная документация: https://developer.tbank.ru/eacq/api/init
- Endpoint: `/v2/Init`
- Метод: `POST`
- Формат: `application/json`

