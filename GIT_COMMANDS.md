# Команды для пуша в GitHub

## 1. Добавить все файлы

```bash
git add .
```

## 2. Сделать коммит

```bash
git commit -m "Add token system and T-bank payment integration"
```

## 3. Запушить в GitHub

```bash
git push origin main
```

## Полная последовательность (скопируйте и выполните):

```bash
git add .
git commit -m "Add token system and T-bank payment integration"
git push origin main
```

## Что будет добавлено:

✅ Система токенов (база данных, middleware, контроллеры)
✅ Интеграция с Т-банк эквайрингом
✅ Тарифы на покупку токенов
✅ API endpoints для платежей
✅ Тестовые скрипты
✅ Документация

## После пуша:

Railway автоматически задеплоит приложение при пуше в main ветку.

**Не забудьте добавить переменные окружения в Railway!** (см. RAILWAY_VARIABLES.md)

