# Создание таблиц вручную (без Query Editor)

## Способ 1: Railway CLI (рекомендуется)

### 1. Установите Railway CLI:
```bash
npm install -g @railway/cli
```

### 2. Войдите в Railway:
```bash
railway login
```

### 3. Подключитесь к проекту:
```bash
railway link
# Выберите ваш проект
```

### 4. Подключитесь к MySQL:
```bash
railway connect mysql
```

### 5. Выполните SQL:
Скопируйте и вставьте SQL из файла `create_missing_tables.sql` или выполните:

```sql
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

---

## Способ 2: Прямое подключение к MySQL

### 1. Получите данные подключения:
- Railway → Database → Settings → Connect
- Скопируйте Connection String или отдельные параметры:
  - Host
  - Port
  - User
  - Password
  - Database

### 2. Подключитесь через MySQL клиент:

**Через командную строку:**
```bash
mysql -h [HOST] -P [PORT] -u [USER] -p [DATABASE]
# Введите пароль
```

**Или через MySQL Workbench / DBeaver:**
- Создайте новое подключение
- Используйте данные из Railway
- Подключитесь и выполните SQL

### 3. Выполните SQL из `create_missing_tables.sql`

---

## Способ 3: Через Railway Database UI

### Если есть кнопка "+ New Table":

1. Railway → Database → Data
2. Нажмите "+ New Table"
3. Создайте таблицу `payments` со следующими полями:

**Таблица payments:**
- `id` - INT, PRIMARY KEY, AUTO_INCREMENT
- `user_id` - INT, NOT NULL, FOREIGN KEY → users(id)
- `amount` - DECIMAL(10, 2), NOT NULL
- `tokens_amount` - INT, NOT NULL
- `payment_id` - VARCHAR(255), UNIQUE
- `status` - ENUM('pending', 'processing', 'completed', 'failed', 'cancelled'), DEFAULT 'pending'
- `tbank_order_id` - VARCHAR(255)
- `tbank_payment_id` - VARCHAR(255)
- `callback_data` - TEXT
- `created_at` - TIMESTAMP, DEFAULT CURRENT_TIMESTAMP
- `updated_at` - TIMESTAMP, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

**Индексы:**
- `idx_payment_id` на `payment_id`
- `idx_tbank_order_id` на `tbank_order_id`
- `idx_status` на `status`

**Таблица token_transactions:**
- `id` - INT, PRIMARY KEY, AUTO_INCREMENT
- `user_id` - INT, NOT NULL, FOREIGN KEY → users(id)
- `amount` - INT, NOT NULL
- `type` - ENUM('spend', 'earn', 'bonus', 'purchase'), NOT NULL
- `description` - TEXT
- `related_payment_id` - INT, NULL, FOREIGN KEY → payments(id)
- `created_at` - TIMESTAMP, DEFAULT CURRENT_TIMESTAMP

---

## Способ 4: Временный endpoint для создания таблиц

Можно создать временный endpoint в коде для создания таблиц (только для разработки):

```javascript
// В src/index.js (временно!)
app.post('/admin/create-tables', async (req, res) => {
  try {
    await initDatabase();
    res.json({ success: true, message: 'Tables created' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

Затем вызовите:
```bash
curl -X POST https://backaibookver2-production.up.railway.app/admin/create-tables
```

**⚠️ Удалите этот endpoint после использования!**

---

## Проверка после создания

После создания таблиц проверьте:

```bash
node test-production.js
```

Должно работать:
- ✅ Проверка баланса токенов
- ✅ Создание платежа
- ✅ Генерация изображения

