-- SQL скрипт для создания недостающих таблиц
-- Выполните этот скрипт в Railway Database → Query

-- Таблица платежей (для Т-банк эквайринга)
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

-- Таблица токенов пользователей (если еще не создана)
CREATE TABLE IF NOT EXISTS user_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  balance INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user (user_id)
);

-- Таблица транзакций токенов (история операций)
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



