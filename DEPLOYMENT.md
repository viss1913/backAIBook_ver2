# Инструкция по деплою на Railway

## Переменные окружения

Установите следующие переменные окружения в Railway:

### Обязательные:
```
GEMINI_API_KEY=sk-or-v1-... (OpenRouter ключ для Gemini)
RAILWAY_URL=https://backaibookver2-production.up.railway.app
```

### Для GigaChat:
```
GIGACHAT_AUTH_KEY=MDE5YjQxNWEtYTQzZS03MzE1LThjNzQtOWUxMDUwNzNmYjhiOjIyMDBkZjY1LTc2Y2MtNGNiNy05YTY0LWMwNDEzNDMwNWJkOQ==
GIGACHAT_CLIENT_ID=019b415a-a43e-7315-8c74-9e105073fb8b
GIGACHAT_SCOPE=GIGACHAT_API_PERS
```

### Для Gen-API:
```
GEN_API_KEY=sk-Boa02hFnr6sRexnIqyGkAApynkaGS2U2v1dPfY1MYLpnvWVK9xnofPQpnMQz
```

### Для GetImg (опционально):
```
GETIMG_API_KEY=ваш_ключ_getimg
```

### Для LaoZhang (опционально):
```
LAOZHANG_API_KEY=ваш_ключ_laozhang
```

### Для Perplexity (опционально, для поиска изображений):
```
PERPLEXITY_API_KEY=ваш_ключ_perplexity
```

## Доступные провайдеры

- `gigachat` - GigaChat API (синхронный, рекомендуется)
- `genapi` - Gen-API z-image (асинхронный, через callback)
- `getimg` - GetImg API
- `laozhang` - LaoZhang API (по умолчанию)

## Эндпоинты

- `POST /api/generate-image?provider=gigachat` - Генерация изображений
- `POST /api/get-images` - Поиск изображений через Perplexity
- `POST /api/gen-api-callback` - Callback от Gen-API (внутренний)

## Проверка деплоя

После деплоя проверьте:
1. `GET /health` - должен вернуть `{"status":"ok"}`
2. Логи на Railway - не должно быть ошибок о missing API keys
3. Тестовый запрос на генерацию изображения

