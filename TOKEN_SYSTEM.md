# Система токенов и оплаты

## Обзор

Система токенов позволяет контролировать использование генерации изображений. Пользователи получают начальный баланс токенов и могут пополнять его через платежи.

## Основные параметры

- **Начальный баланс**: 300 токенов для новых пользователей
- **Стоимость генерации**: 10 токенов за 1 изображение
- **Кэширование**: Если изображение уже было сгенерировано, токены не списываются

## Идентификация пользователей

Пользователи идентифицируются через `deviceId` - уникальный идентификатор устройства Android приложения.

## API Endpoints

### 1. Получить баланс токенов

**GET** `/api/payments/balance?deviceId={deviceId}`

**Response:**
```json
{
  "success": true,
  "balance": 300,
  "userId": 1
}
```

### 2. Генерация изображения (с проверкой токенов)

**POST** `/api/generate-image`

**Request Body:**
```json
{
  "deviceId": "unique-device-id",
  "bookTitle": "Война и мир",
  "author": "Лев Толстой",
  "textChunk": "Он стоял на балконе...",
  "styleKey": "standard"
}
```

**Response (успех):**
```json
{
  "success": true,
  "imageUrl": "https://...",
  "promptUsed": "...",
  "appliedStyleKey": "standard",
  "tokensRemaining": 290
}
```

**Response (недостаточно токенов):**
```json
{
  "success": false,
  "error": "Insufficient tokens",
  "balance": 5,
  "required": 10,
  "message": "Недостаточно токенов. У вас 5, требуется 10"
}
```

### 3. Получить список тарифов

**GET** `/api/payments/pricing`

**Response:**
```json
{
  "success": true,
  "pricing": [
    {
      "id": "tier1",
      "tokens": 1000,
      "price": 300.00,
      "pricePerToken": 0.30,
      "label": "1000 токенов",
      "description": "Базовый пакет",
      "popular": false
    },
    {
      "id": "tier2",
      "tokens": 2000,
      "price": 549.00,
      "pricePerToken": 0.2745,
      "label": "2000 токенов",
      "description": "Выгодный пакет",
      "popular": true
    },
    {
      "id": "tier3",
      "tokens": 4000,
      "price": 999.00,
      "pricePerToken": 0.24975,
      "label": "4000 токенов",
      "description": "Максимальный пакет",
      "popular": false
    }
  ]
}
```

### 4. Создать платеж для пополнения токенов

**POST** `/api/payments/create`

**Вариант 1: Использование тарифа (рекомендуется)**
```json
{
  "deviceId": "unique-device-id",
  "tierId": "tier2"
}
```

**Вариант 2: Кастомный платеж**
```json
{
  "deviceId": "unique-device-id",
  "tokensAmount": 100,
  "amount": 99.00
}
```

**Response:**
```json
{
  "success": true,
  "paymentId": "payment_1234567890_abc123",
  "paymentUrl": "https://securepayments.tbank.ru/pay/...",
  "orderId": "order_123",
  "amount": 99.00,
  "tokensAmount": 100,
  "status": "processing"
}
```

### 4. Проверить статус платежа

**GET** `/api/payments/status/:paymentId`

**Response:**
```json
{
  "success": true,
  "payment": {
    "paymentId": "payment_1234567890_abc123",
    "status": "completed",
    "amount": 99.00,
    "tokensAmount": 100,
    "createdAt": "2024-01-01T12:00:00Z",
    "updatedAt": "2024-01-01T12:05:00Z"
  }
}
```

**Статусы платежа:**
- `pending` - Ожидает оплаты
- `processing` - В обработке
- `completed` - Успешно завершен
- `failed` - Ошибка
- `cancelled` - Отменен

### 5. Получить историю транзакций

**GET** `/api/payments/transactions?deviceId={deviceId}&limit=50`

**Response:**
```json
{
  "success": true,
  "transactions": [
    {
      "id": 1,
      "user_id": 1,
      "amount": -10,
      "type": "spend",
      "description": "Генерация изображения для \"Война и мир\"",
      "created_at": "2024-01-01T12:00:00Z"
    },
    {
      "id": 2,
      "user_id": 1,
      "amount": 100,
      "type": "purchase",
      "description": "Пополнение токенов через платеж payment_123",
      "related_payment_id": 1,
      "created_at": "2024-01-01T11:00:00Z"
    }
  ],
  "count": 2
}
```

**Типы транзакций:**
- `spend` - Списание токенов
- `earn` - Начисление токенов
- `bonus` - Бонусные токены (начальный баланс)
- `purchase` - Покупка токенов

## Интеграция с Т-банк эквайрингом

### Настройка

Добавьте в `.env`:

```env
# Т-банк эквайринг
TBANK_TERMINAL_KEY=1703150935625DEMO
TBANK_PASSWORD=xcbixwo8gsjibu6u
TBANK_API_URL=https://securepayments.tbank.ru/api/v1
TBANK_SUCCESS_URL=https://your-domain.com/api/payments/tbank/success
TBANK_FAILURE_URL=https://your-domain.com/api/payments/tbank/failure
BASE_URL=https://your-domain.com
```

**Примечание:** Указанные значения - тестовые. Для production получите свои данные в личном кабинете Т-банка.

### Webhook

Т-банк отправляет callback на:

**POST** `/api/payments/tbank/callback`

Этот endpoint должен быть доступен извне. Убедитесь, что:
1. Сервер доступен по HTTPS
2. URL добавлен в настройки Т-банк кабинета
3. Webhook обрабатывает подпись для безопасности

### Процесс оплаты

1. Пользователь создает платеж через `/api/payments/create`
2. Получает `paymentUrl` для редиректа
3. Переходит на страницу оплаты Т-банка
4. После оплаты Т-банк отправляет callback на webhook
5. Система начисляет токены пользователю
6. Пользователь может проверить статус через `/api/payments/status/:paymentId`

## Структура базы данных

### Таблица `user_tokens`

Хранит баланс токенов пользователей:

```sql
CREATE TABLE user_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  balance INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user (user_id)
);
```

### Таблица `token_transactions`

История всех операций с токенами:

```sql
CREATE TABLE token_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount INT NOT NULL,
  type ENUM('spend', 'earn', 'bonus', 'purchase') NOT NULL,
  description TEXT,
  related_payment_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (related_payment_id) REFERENCES payments(id) ON DELETE SET NULL
);
```

### Таблица `payments`

Информация о платежах:

```sql
CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  tokens_amount INT NOT NULL,
  payment_id VARCHAR(255) UNIQUE,
  status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
  tbank_order_id VARCHAR(255),
  tbank_payment_id VARCHAR(255),
  callback_data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## Безопасность

1. **Проверка подписи**: Все callback от Т-банка проверяются на валидность подписи
2. **Уникальные ID**: Каждый платеж имеет уникальный `payment_id`
3. **Транзакции БД**: Операции с токенами выполняются в транзакциях для целостности данных
4. **Валидация**: Все входные данные валидируются

## Примеры использования

### Android приложение

```kotlin
// Получить баланс
val response = api.getTokenBalance(deviceId)
val balance = response.balance

// Генерация изображения
val request = GenerateImageRequest(
    deviceId = deviceId,
    bookTitle = "Война и мир",
    author = "Лев Толстой",
    textChunk = text
)
val result = api.generateImage(request)

if (result.success) {
    // Показать изображение
    showImage(result.imageUrl)
    // Обновить баланс
    updateBalance(result.tokensRemaining)
} else if (result.error == "Insufficient tokens") {
    // Предложить пополнить баланс
    showPaymentDialog()
}

// Создать платеж
val payment = api.createPayment(
    deviceId = deviceId,
    tokensAmount = 100,
    amount = 99.00
)
// Открыть paymentUrl в браузере
openPaymentUrl(payment.paymentUrl)
```

## Примечания

1. **Кэширование**: Если изображение уже было сгенерировано, токены не списываются
2. **Начальный баланс**: Новые пользователи автоматически получают 300 токенов
3. **Атомарность**: Операции списания токенов атомарны - либо списываются, либо нет
4. **Мониторинг**: Все транзакции логируются для аудита

## Документация Т-банк

Для настройки интеграции с Т-банк эквайрингом:
- Документация: https://developer.tbank.ru/eacq/intro/connection
- Личный кабинет: https://securepayments.tbank.ru

**ВАЖНО**: Точные endpoints и формат запросов могут отличаться в зависимости от версии API Т-банка. Уточните в документации:
- URL для создания платежа
- Формат подписи
- Структуру callback данных
- Параметры запросов

