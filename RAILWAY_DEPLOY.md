# Деплой на Railway с системой токенов

## Переменные окружения для Railway

### 1. Т-банк эквайринг (ОБЯЗАТЕЛЬНО для системы токенов)

Добавьте в Railway → Variables:

```
TBANK_TERMINAL_KEY=1703150935625DEMO
TBANK_PASSWORD=xcbixwo8gsjibu6u
TBANK_API_URL=https://securepayments.tbank.ru/api/v1
```

**Важно:** Замените на ваши production данные после получения от Т-банка.

### 2. URLs для редиректов (ОБЯЗАТЕЛЬНО)

Замените `your-railway-app` на ваш реальный Railway URL:

```
TBANK_SUCCESS_URL=https://your-railway-app.up.railway.app/api/payments/tbank/success
TBANK_FAILURE_URL=https://your-railway-app.up.railway.app/api/payments/tbank/failure
BASE_URL=https://your-railway-app.up.railway.app
```

**Как узнать ваш Railway URL:**
1. Откройте ваш проект на Railway
2. Перейдите в Settings → Networking
3. Скопируйте ваш Public Domain (например: `backaibookver2-production.up.railway.app`)
4. Используйте его в переменных выше

### 3. База данных MySQL

Railway автоматически создает переменные при подключении MySQL плагина:
- `MYSQL_HOST`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`
- `MYSQL_PORT`

**Проверьте, что MySQL плагин подключен к вашему проекту.**

### 4. API ключи для генерации изображений

```
PERPLEXITY_API_KEY=ваш_ключ
LAOZHANG_API_KEY=ваш_ключ (или LAOZHAN_API_KEY)
GEMINI_API_KEY=ваш_ключ
GETIMG_API_KEY=ваш_ключ (опционально)
GEN_API_KEY=ваш_ключ (опционально)
```

## Полный список переменных для Railway

Скопируйте и добавьте в Railway → Variables:

```env
# Т-банк эквайринг
TBANK_TERMINAL_KEY=1703150935625DEMO
TBANK_PASSWORD=xcbixwo8gsjibu6u
TBANK_API_URL=https://securepayments.tbank.ru/api/v1
TBANK_SUCCESS_URL=https://backaibookver2-production.up.railway.app/api/payments/tbank/success
TBANK_FAILURE_URL=https://backaibookver2-production.up.railway.app/api/payments/tbank/failure
BASE_URL=https://backaibookver2-production.up.railway.app

# API ключи (уже должны быть)
PERPLEXITY_API_KEY=ваш_ключ
LAOZHANG_API_KEY=ваш_ключ
GEMINI_API_KEY=ваш_ключ

# База данных (Railway создает автоматически)
# MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_PORT
```

## Шаги деплоя

1. **Подключите MySQL плагин** (если еще не подключен):
   - Railway → ваш проект → Add → Database → MySQL
   - Railway автоматически создаст переменные окружения

2. **Добавьте переменные окружения**:
   - Railway → ваш проект → Variables
   - Добавьте все переменные из списка выше (URLs уже настроены)

3. **Настройте webhook в Т-банк**:
   - В личном кабинете Т-банка найдите раздел "Webhook" или "Callback URL"
   - Укажите: `https://backaibookver2-production.up.railway.app/api/payments/tbank/callback`
   - Убедитесь, что URL доступен по HTTPS

4. **Запушьте код в GitHub**:
   ```bash
   git add .
   git commit -m "Add token system and T-bank integration"
   git push origin main
   ```

5. **Railway автоматически задеплоит** при пуше в main ветку

## Проверка после деплоя

### 1. Проверка health endpoint:
```bash
curl https://backaibookver2-production.up.railway.app/health
```

Должен вернуть: `{"status":"ok"}`

### 2. Проверка тарифов:
```bash
curl https://backaibookver2-production.up.railway.app/api/payments/pricing
```

Должен вернуть список тарифов.

### 3. Проверка создания платежа:
```bash
curl -X POST https://backaibookver2-production.up.railway.app/api/payments/create \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"test-123","tierId":"tier1"}'
```

Должен вернуть Payment URL.

### 4. Проверка логов:
- Railway → ваш проект → Deployments → View Logs
- Убедитесь, что нет ошибок подключения к БД
- Убедитесь, что таблицы созданы (должно быть сообщение "Database tables initialized successfully")

## Важные замечания

1. **HTTPS обязателен** для webhook от Т-банка
2. **Railway URL** должен быть доступен извне
3. **База данных** автоматически инициализируется при первом запуске
4. **Webhook URL** должен быть настроен в личном кабинете Т-банка

## Troubleshooting

### Ошибка: "Access denied for user"

**Решение:** Проверьте, что MySQL плагин подключен и переменные окружения созданы.

### Ошибка: "Т-банк конфигурация не настроена"

**Решение:** Проверьте, что все переменные `TBANK_*` добавлены в Railway.

### Webhook не приходит

**Решение:**
- Убедитесь, что URL указан правильно в настройках Т-банка
- Проверьте, что Railway URL доступен по HTTPS
- Проверьте логи Railway на наличие ошибок

### Платеж создается, но токены не начисляются

**Решение:**
- Проверьте логи webhook: Railway → Logs
- Убедитесь, что webhook URL правильный
- Проверьте статус платежа через API

## Production данные Т-банка

После тестирования с тестовыми данными:
1. Получите production `TBANK_TERMINAL_KEY` и `TBANK_PASSWORD` в личном кабинете Т-банка
2. Обновите переменные в Railway
3. Перезапустите приложение (Railway сделает это автоматически при обновлении переменных)

