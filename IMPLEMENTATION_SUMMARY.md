# Резюме реализации системы токенов

## Что было реализовано

### 1. База данных ✅

Добавлены таблицы:
- `user_tokens` - баланс токенов пользователей
- `token_transactions` - история операций с токенами
- `payments` - информация о платежах

### 2. Функции работы с токенами ✅

В `src/utils/database.js`:
- `getOrCreateUserTokens()` - получение/создание баланса (300 токенов для новых)
- `getUserTokenBalance()` - получение баланса
- `spendUserTokens()` - списание токенов
- `addUserTokens()` - пополнение токенов
- `createPayment()` - создание платежа
- `updatePaymentStatus()` - обновление статуса платежа
- `getUserTokenTransactions()` - история транзакций

### 3. Middleware для проверки токенов ✅

`src/middleware/tokenMiddleware.js`:
- `checkTokensMiddleware` - проверяет баланс перед генерацией
- `deductTokensAfterGeneration` - списывает токены после успешной генерации

### 4. Обновлен контроллер генерации изображений ✅

`src/controllers/imageController.js`:
- Добавлена проверка токенов через middleware
- Токены списываются только при новой генерации (не из кэша)
- Возвращает `tokensRemaining` в ответе

### 5. Интеграция с Т-банк эквайрингом ✅

`src/services/tbankService.js`:
- `createTbankPayment()` - создание платежа
- `checkTbankPaymentStatus()` - проверка статуса
- `verifyTbankCallback()` - верификация подписи
- `processTbankCallback()` - обработка callback
- `getTbankPaymentRedirectUrl()` - URL для редиректа

### 6. Контроллеры и роуты для платежей ✅

`src/controllers/paymentController.js`:
- `getTokenBalance()` - получение баланса
- `createTokenPayment()` - создание платежа
- `tbankWebhook()` - обработка webhook от Т-банка
- `checkPaymentStatus()` - проверка статуса платежа
- `getTokenTransactions()` - история транзакций
- `tbankSuccessRedirect()` - редирект после успешной оплаты
- `tbankFailureRedirect()` - редирект после неуспешной оплаты

`src/routes/paymentRoutes.js`:
- Все endpoints для работы с платежами

### 7. Обновлен валидатор ✅

`src/validators/imageValidator.js`:
- Добавлено обязательное поле `deviceId`

### 8. Документация ✅

- `TOKEN_SYSTEM.md` - полная документация системы токенов
- `TBANK_SETUP.md` - инструкция по настройке Т-банка
- Обновлен `README.md` с информацией о токенах

## Параметры системы

- **Начальный баланс**: 300 токенов
- **Стоимость генерации**: 10 токенов
- **Кэширование**: Токены не списываются за кэшированные изображения

## API Endpoints

### Генерация изображений
- `POST /api/generate-image` - теперь требует `deviceId` и проверяет токены

### Работа с токенами
- `GET /api/payments/balance?deviceId=...` - баланс
- `POST /api/payments/create` - создать платеж
- `GET /api/payments/status/:paymentId` - статус платежа
- `GET /api/payments/transactions?deviceId=...` - история

### Webhook Т-банка
- `POST /api/payments/tbank/callback` - обработка callback
- `GET /api/payments/tbank/success` - редирект успеха
- `GET /api/payments/tbank/failure` - редирект ошибки

## Переменные окружения

Добавьте в `.env`:
```env
# Т-банк эквайринг
TBANK_MERCHANT_ID=your_merchant_id
TBANK_SECRET_KEY=your_secret_key
TBANK_API_URL=https://securepayments.tbank.ru/api/v1
TBANK_SUCCESS_URL=https://your-domain.com/api/payments/tbank/success
TBANK_FAILURE_URL=https://your-domain.com/api/payments/tbank/failure
BASE_URL=https://your-domain.com
```

## Что нужно сделать дальше

1. **Настроить Т-банк**:
   - Получить `TBANK_MERCHANT_ID` и `TBANK_SECRET_KEY`
   - Настроить webhook URL в личном кабинете
   - Уточнить точные endpoints API (могут отличаться от примера)

2. **Протестировать**:
   - Создать тестовый платеж
   - Проверить webhook
   - Убедиться, что токены начисляются

3. **Android приложение**:
   - Добавить `deviceId` в запросы генерации
   - Реализовать UI для отображения баланса
   - Реализовать оплату через `paymentUrl`

## Важные замечания

1. **Т-банк API**: Точные endpoints и формат запросов могут отличаться. Уточните в документации Т-банка или у поддержки.

2. **Безопасность**: 
   - Webhook должен быть доступен по HTTPS
   - Проверка подписи обязательна
   - Все операции логируются

3. **Кэширование**: Если изображение уже было сгенерировано, токены не списываются, но баланс все равно возвращается в ответе.

4. **Атомарность**: Операции списания токенов выполняются в транзакциях БД для целостности данных.



