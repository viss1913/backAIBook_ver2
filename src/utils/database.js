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
        text_offset INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      )
    `);

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
export async function saveIllustration(bookId, type, imageUrl, prompt, offset = 0) {
  const [result] = await pool.query(
    'INSERT INTO illustrations (book_id, type, image_url, prompt, text_offset) VALUES (?, ?, ?, ?, ?)',
    [bookId, type, imageUrl, prompt, offset]
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

export default pool;
