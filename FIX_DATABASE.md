# Исправление базы данных

## Проблема

Таблицы `payments` и `token_transactions` не созданы в базе данных Railway.

## Решение

### Вариант 1: Через Railway Database UI (рекомендуется)

1. Откройте Railway → ваш проект → Database → Data
2. Нажмите на кнопку **"+ New Table"** или используйте Query Editor
3. Если есть Query Editor, выполните SQL из файла `create_missing_tables.sql`

### Вариант 2: Через Railway CLI

```bash
railway connect
railway run mysql < create_missing_tables.sql
```

### Вариант 3: Вручную через SQL

Откройте Railway → Database → Query и выполните:

```sql
-- Таблица платежей
CREATE TABLE IF NOT EXISTS payments (
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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_payment_id (payment_id),
  INDEX idx_tbank_order_id (tbank_order_id),
  INDEX idx_status (status)
);

-- Таблица токенов (если еще не создана)
CREATE TABLE IF NOT EXISTS user_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  balance INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user (user_id)
);

-- Таблица транзакций
CREATE TABLE IF NOT EXISTS token_transactions (
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

## Проверка

После создания таблиц проверьте:

```bash
node test-production.js
```

Должно работать:
- ✅ Проверка баланса токенов
- ✅ Создание платежа
- ✅ Генерация изображения

## Альтернатива: Перезапуск с логированием

Если таблицы не создаются автоматически, проверьте логи Railway:

1. Railway → Deployments → View Logs
2. Найдите сообщение "Database tables initialized successfully"
3. Если есть ошибки - скопируйте их и исправьте

Возможные проблемы:
- Ошибка подключения к БД
- Неправильные переменные окружения MySQL
- Ошибка синтаксиса SQL



