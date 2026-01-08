import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Пул соединений с MySQL
 */
const pool = mysql.createPool({
  host: process.env.MYSQLHOST || process.env.MYSQL_HOST,
  user: process.env.MYSQLUSER || process.env.MYSQL_USER,
  password: process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD,
  database: process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE,
  port: process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

/**
 * Инициализация базы данных (создание таблиц)
 */
export async function initDatabase() {
  const connection = await pool.getConnection();
  try {
    console.log('Initializing database tables...');

    // Таблица книг
    await connection.query(`
      CREATE TABLE IF NOT EXISTS books (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        author VARCHAR(255),
        hash VARCHAR(64) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица иллюстраций
    await connection.query(`
      CREATE TABLE IF NOT EXISTS illustrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        book_id INT,
        type ENUM('cover', 'inline') NOT NULL,
        image_url TEXT NOT NULL,
        prompt TEXT,
        style_key VARCHAR(50) DEFAULT 'standard',
        text_offset INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      )
    `);

    // Проверяем наличие колонки style_key в illustrations
    const [columns] = await connection.query("SHOW COLUMNS FROM illustrations LIKE 'style_key'");
    if (columns.length === 0) {
      console.log('Adding style_key column to illustrations table...');
      await connection.query('ALTER TABLE illustrations ADD COLUMN style_key VARCHAR(50) DEFAULT "standard" AFTER prompt');
    }

    // Таблица пользователей
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица чатов (с полем для долгосрочной памяти - summary)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        title VARCHAR(255),
        summary TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Таблица сообщений
    await connection.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        chat_id INT,
        role ENUM('user', 'assistant') NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      )
    `);

    // Таблица книг Flibusta (кэш метаданных и прав)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS flibusta_books(
        id INT AUTO_INCREMENT PRIMARY KEY,
        flibusta_id INT UNIQUE NOT NULL,
        title VARCHAR(255),
        author VARCHAR(255),
        public_domain BOOLEAN DEFAULT FALSE,
        expiry_year INT,
        last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Таблица токенов пользователей
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        balance INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user (user_id)
      )
    `);

    // Таблица транзакций токенов (история операций)
    await connection.query(`
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
      )
    `);

    // Таблица платежей (для Т-банк эквайринга)
    await connection.query(`
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
      )
    `);

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Поиск книги по хэшу
 */
export async function findBookByHash(hash) {
  const [rows] = await pool.query('SELECT * FROM books WHERE hash = ?', [hash]);
  return rows[0];
}

/**
 * Сохранение книги
 */
export async function saveBook(title, author, hash) {
  const [result] = await pool.query(
    'INSERT INTO books (title, author, hash) VALUES (?, ?, ?)',
    [title, author, hash]
  );
  return result.insertId;
}

/**
 * Поиск иллюстраций книги
 */
export async function getBookIllustrations(bookId) {
  const [rows] = await pool.query(
    'SELECT * FROM illustrations WHERE book_id = ? ORDER BY text_offset ASC',
    [bookId]
  );
  return rows;
}

/**
 * Сохранение иллюстрации
 */
export async function saveIllustration(bookId, type, imageUrl, prompt, styleKey = 'standard', offset = 0) {
  const [result] = await pool.query(
    'INSERT INTO illustrations (book_id, type, image_url, prompt, style_key, text_offset) VALUES (?, ?, ?, ?, ?, ?)',
    [bookId, type, imageUrl, prompt, styleKey, offset]
  );
  return result.insertId;
}

/**
 * Поиск книги во Флибуста-кэше
 */
export async function findFlibustaBook(flibustaId) {
  try {
    const [rows] = await pool.query('SELECT * FROM flibusta_books WHERE flibusta_id = ?', [flibustaId]);
    return rows[0];
  } catch (e) {
    return null;
  }
}

/**
 * Сохранение/Обновление данных о книге Флибусты
 */
export async function saveFlibustaBook(data) {
  try {
    const { flibusta_id, title, author, public_domain, expiry_year } = data;
    await pool.query(
      `INSERT INTO flibusta_books (flibusta_id, title, author, public_domain, expiry_year) 
       VALUES (?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       public_domain = VALUES(public_domain), 
       expiry_year = VALUES(expiry_year)`,
      [flibusta_id, title, author, public_domain, expiry_year]
    );
  } catch (e) {
    console.error('Cache save error:', e.message);
  }
}

/**
 * Управление пользователями
 */
export async function getOrCreateUser(deviceId, displayName) {
  const [rows] = await pool.query('SELECT * FROM users WHERE device_id = ?', [deviceId]);
  if (rows[0]) return rows[0];

  const [result] = await pool.query(
    'INSERT INTO users (device_id, display_name) VALUES (?, ?)',
    [deviceId, displayName]
  );
  return { id: result.insertId, device_id: deviceId, display_name: displayName };
}

/**
 * Управление чатами
 */
export async function createChat(userId, title = 'Новый диалог') {
  const [result] = await pool.query(
    'INSERT INTO chats (user_id, title) VALUES (?, ?)',
    [userId, title]
  );
  return result.insertId;
}

export async function getUserChats(userId) {
  const [rows] = await pool.query('SELECT * FROM chats WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  return rows;
}

export async function updateChatSummary(chatId, summary) {
  await pool.query('UPDATE chats SET summary = ? WHERE id = ?', [summary, chatId]);
}

/**
 * Управление сообщениями
 */
export async function saveChatMessage(chatId, role, content) {
  const [result] = await pool.query(
    'INSERT INTO chat_messages (chat_id, role, content) VALUES (?, ?, ?)',
    [chatId, role, content]
  );
  return result.insertId;
}

export async function getChatContext(chatId, limit = 20) {
  // Получаем summary (долгосрочная память)
  const [chats] = await pool.query('SELECT summary FROM chats WHERE id = ?', [chatId]);
  const summary = chats[0]?.summary || '';

  // Получаем последние сообщения (краткосрочная память)
  const [messages] = await pool.query(
    'SELECT role, content FROM chat_messages WHERE chat_id = ? ORDER BY created_at ASC LIMIT ?',
    [chatId, limit]
  );

  return { summary, messages };
}

export async function getMessageCount(chatId) {
  const [rows] = await pool.query('SELECT COUNT(*) as count FROM chat_messages WHERE chat_id = ?', [chatId]);
  return rows[0].count;
}

/**
 * Управление токенами пользователей
 */

/**
 * Получить или создать баланс токенов для пользователя
 * Новым пользователям начисляется 300 токенов
 */
export async function getOrCreateUserTokens(userId) {
  const [rows] = await pool.query('SELECT * FROM user_tokens WHERE user_id = ?', [userId]);
  
  if (rows[0]) {
    return rows[0];
  }

  // Создаем запись с начальным балансом 300 токенов
  const [result] = await pool.query(
    'INSERT INTO user_tokens (user_id, balance) VALUES (?, ?)',
    [userId, 300]
  );

  // Записываем транзакцию о бонусных токенах
  await pool.query(
    'INSERT INTO token_transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)',
    [userId, 300, 'bonus', 'Начальный бонус для нового пользователя']
  );

  return { id: result.insertId, user_id: userId, balance: 300 };
}

/**
 * Получить баланс токенов пользователя
 */
export async function getUserTokenBalance(userId) {
  const tokens = await getOrCreateUserTokens(userId);
  return tokens.balance;
}

/**
 * Списать токены у пользователя
 * @param {number} userId - ID пользователя
 * @param {number} amount - Количество токенов для списания
 * @param {string} description - Описание операции
 * @returns {boolean} - true если списание успешно, false если недостаточно токенов
 */
export async function spendUserTokens(userId, amount, description = 'Списание токенов') {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Получаем текущий баланс
    const tokens = await getOrCreateUserTokens(userId);
    
    if (tokens.balance < amount) {
      await connection.rollback();
      return false;
    }

    // Списываем токены
    await connection.query(
      'UPDATE user_tokens SET balance = balance - ? WHERE user_id = ?',
      [amount, userId]
    );

    // Записываем транзакцию
    await connection.query(
      'INSERT INTO token_transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)',
      [userId, -amount, 'spend', description]
    );

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Пополнить баланс токенов пользователя
 * @param {number} userId - ID пользователя
 * @param {number} amount - Количество токенов для пополнения
 * @param {string} description - Описание операции
 * @param {number} paymentId - ID платежа (опционально)
 */
export async function addUserTokens(userId, amount, description = 'Пополнение токенов', paymentId = null) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Убеждаемся что запись существует
    await getOrCreateUserTokens(userId);

    // Пополняем баланс
    await connection.query(
      'UPDATE user_tokens SET balance = balance + ? WHERE user_id = ?',
      [amount, userId]
    );

    // Записываем транзакцию
    await connection.query(
      'INSERT INTO token_transactions (user_id, amount, type, description, related_payment_id) VALUES (?, ?, ?, ?, ?)',
      [userId, amount, 'purchase', description, paymentId]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Управление платежами
 */

/**
 * Создать новый платеж
 */
export async function createPayment(userId, amount, tokensAmount, paymentId, tbankOrderId = null) {
  const [result] = await pool.query(
    `INSERT INTO payments (user_id, amount, tokens_amount, payment_id, tbank_order_id, status) 
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [userId, amount, tokensAmount, paymentId, tbankOrderId]
  );
  return result.insertId;
}

/**
 * Обновить статус платежа
 */
export async function updatePaymentStatus(paymentId, status, tbankPaymentId = null, callbackData = null) {
  await pool.query(
    `UPDATE payments 
     SET status = ?, tbank_payment_id = ?, callback_data = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE payment_id = ?`,
    [status, tbankPaymentId, callbackData, paymentId]
  );
}

/**
 * Получить платеж по payment_id
 */
export async function getPaymentByPaymentId(paymentId) {
  const [rows] = await pool.query('SELECT * FROM payments WHERE payment_id = ?', [paymentId]);
  return rows[0];
}

/**
 * Получить платеж по tbank_order_id
 */
export async function getPaymentByTbankOrderId(tbankOrderId) {
  const [rows] = await pool.query('SELECT * FROM payments WHERE tbank_order_id = ?', [tbankOrderId]);
  return rows[0];
}

/**
 * Получить историю транзакций пользователя
 */
export async function getUserTokenTransactions(userId, limit = 50) {
  const [rows] = await pool.query(
    `SELECT * FROM token_transactions 
     WHERE user_id = ? 
     ORDER BY created_at DESC 
     LIMIT ?`,
    [userId, limit]
  );
  return rows;
}

export default pool;
