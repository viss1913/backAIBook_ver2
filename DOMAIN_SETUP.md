# Настройка домена для webhook Т-банка

## Варианты настройки

### Вариант 1: Использовать основной домен (рекомендуется)

Если у вас уже есть домен `ai-asol.ru` и сервер на нем, можно использовать:

```
https://ai-asol.ru/api/payments/tbank/callback
```

**Преимущества:**
- Не нужно настраивать поддомен
- Проще в управлении
- Один SSL сертификат

**Настройка в Railway:**
1. Railway → ваш проект → Settings → Networking
2. Добавьте Custom Domain: `ai-asol.ru`
3. Настройте DNS записи (Railway покажет инструкции)
4. Обновите переменные окружения:

```env
BASE_URL=https://ai-asol.ru
TBANK_SUCCESS_URL=https://ai-asol.ru/api/payments/tbank/success
TBANK_FAILURE_URL=https://ai-asol.ru/api/payments/tbank/failure
```

### Вариант 2: Поддомен третьего уровня

Если хотите отдельный поддомен для API:

```
https://api.ai-asol.ru/api/payments/tbank/callback
```

или

```
https://payments.ai-asol.ru/api/payments/tbank/callback
```

**Преимущества:**
- Лучшая организация
- Можно отдельно настроить для API
- Легче масштабировать

**Настройка:**
1. Создайте поддомен в панели управления доменом
2. Настройте DNS запись (A или CNAME) на Railway
3. Добавьте Custom Domain в Railway
4. Обновите переменные окружения

### Вариант 3: Использовать Railway URL напрямую

Если Railway URL доступен по HTTPS (что обычно так и есть):

```
https://backaibookver2-production.up.railway.app/api/payments/tbank/callback
```

**Преимущества:**
- Не нужно настраивать домен
- Работает сразу
- Railway автоматически предоставляет HTTPS

**Недостатки:**
- Длинный URL
- Менее профессионально выглядит

## Что нужно для webhook Т-банка

**Обязательные требования:**
1. ✅ **HTTPS** - обязательно (не HTTP!)
2. ✅ **Доступность извне** - URL должен быть доступен из интернета
3. ✅ **Стабильный URL** - не должен меняться

**Не обязательно:**
- ❌ Поддомен - можно использовать основной домен
- ❌ Отдельный домен - можно использовать существующий

## Рекомендация

**Используйте основной домен `ai-asol.ru`**, если:
- У вас уже есть сервер на этом домене
- Или можете настроить Railway Custom Domain на этот домен

**Используйте Railway URL**, если:
- Не хотите настраивать домен сейчас
- Railway URL работает по HTTPS (обычно работает)

## Настройка Custom Domain на Railway

1. **Railway → ваш проект → Settings → Networking**
2. **Нажмите "Add Custom Domain"**
3. **Введите домен:** `ai-asol.ru` или `api.ai-asol.ru`
4. **Railway покажет DNS записи**, которые нужно добавить:
   - Обычно это CNAME запись
   - Или A запись с IP адресом
5. **Добавьте DNS записи** в панели управления доменом
6. **Подождите** пока DNS распространится (5-30 минут)
7. **Railway автоматически** выдаст SSL сертификат

## Обновление переменных окружения

После настройки домена обновите в Railway → Variables:

```env
BASE_URL=https://ai-asol.ru
TBANK_SUCCESS_URL=https://ai-asol.ru/api/payments/tbank/success
TBANK_FAILURE_URL=https://ai-asol.ru/api/payments/tbank/failure
```

Или для поддомена:

```env
BASE_URL=https://api.ai-asol.ru
TBANK_SUCCESS_URL=https://api.ai-asol.ru/api/payments/tbank/success
TBANK_FAILURE_URL=https://api.ai-asol.ru/api/payments/tbank/failure
```

## Настройка webhook в Т-банк

После настройки домена:

1. Откройте личный кабинет Т-банка
2. Найдите раздел "Webhook" или "Callback URL"
3. Укажите URL:
   - `https://ai-asol.ru/api/payments/tbank/callback`
   - Или `https://api.ai-asol.ru/api/payments/tbank/callback`
   - Или `https://backaibookver2-production.up.railway.app/api/payments/tbank/callback`

## Проверка

После настройки проверьте доступность:

```bash
curl https://ai-asol.ru/api/payments/tbank/callback
# Должен вернуть ошибку метода (405), но не 404 - значит endpoint существует
```

Или через браузер откройте:
```
https://ai-asol.ru/health
```

Должен вернуть: `{"status":"ok"}`

## Важные замечания

1. **HTTPS обязателен** - Т-банк не принимает HTTP для webhook
2. **DNS может распространяться до 24 часов** (обычно 5-30 минут)
3. **Railway автоматически выдает SSL** после настройки Custom Domain
4. **Webhook URL должен быть стабильным** - не меняйте его после настройки в Т-банке

