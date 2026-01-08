# Переменные окружения для Railway

## 📋 Список переменных для добавления в Railway

Скопируйте эти переменные и добавьте в **Railway → ваш проект → Variables**:

### 🔴 ОБЯЗАТЕЛЬНО (Т-банк эквайринг):

```
TBANK_TERMINAL_KEY=1703150935625DEMO
TBANK_PASSWORD=xcbixwo8gsjibu6u
TBANK_API_URL=https://securepay.tinkoff.ru
```

### 🔴 ОБЯЗАТЕЛЬНО (URLs):

```
TBANK_SUCCESS_URL=https://backaibookver2-production.up.railway.app/api/payments/tbank/success
TBANK_FAILURE_URL=https://backaibookver2-production.up.railway.app/api/payments/tbank/failure
BASE_URL=https://backaibookver2-production.up.railway.app
```

### ✅ Автоматически (MySQL от Railway):

Эти переменные Railway создает автоматически при подключении MySQL плагина:
- `MYSQL_HOST`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`
- `MYSQL_PORT`

**Проверьте, что MySQL плагин подключен!**

### 📝 Уже должны быть (API ключи):

```
PERPLEXITY_API_KEY=ваш_ключ
LAOZHANG_API_KEY=ваш_ключ
GEMINI_API_KEY=ваш_ключ
```

## 🚀 Быстрая инструкция

1. **Откройте Railway** → ваш проект → **Variables**
2. **Добавьте переменные** из списка выше
3. **Замените** `your-railway-app` на ваш реальный Railway URL
4. **Сохраните** - Railway автоматически перезапустит приложение

## ✅ Проверка после добавления

После добавления переменных проверьте:

```bash
# 1. Health check
curl https://your-railway-app.up.railway.app/health

# 2. Тарифы
curl https://your-railway-app.up.railway.app/api/payments/pricing

# 3. Создание платежа
curl -X POST https://your-railway-app.up.railway.app/api/payments/create \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"test","tierId":"tier1"}'
```

## 🔧 Настройка Webhook в Т-банк

После деплоя настройте webhook в личном кабинете Т-банка:

**Webhook URL:**
```
https://your-railway-app.up.railway.app/api/payments/tbank/callback
```

**Где настроить:**
- Личный кабинет Т-банка → Интернет-эквайринг → Настройки → Webhook/Callback URL

## 📌 Готовые переменные для вашего проекта

```
TBANK_TERMINAL_KEY=1703150935625DEMO
TBANK_PASSWORD=xcbixwo8gsjibu6u
TBANK_API_URL=https://securepay.tinkoff.ru
TBANK_SUCCESS_URL=https://backaibookver2-production.up.railway.app/api/payments/tbank/success
TBANK_FAILURE_URL=https://backaibookver2-production.up.railway.app/api/payments/tbank/failure
BASE_URL=https://backaibookver2-production.up.railway.app
```

## ⚠️ Для Production

После тестирования замените тестовые данные на production:

```
TBANK_TERMINAL_KEY=ваш_production_terminal_key
TBANK_PASSWORD=ваш_production_password
```

Получите их в личном кабинете Т-банка.

