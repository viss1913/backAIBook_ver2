import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'https://backaibookver2-production.up.railway.app';

// SQL команды для создания таблиц
const sqlCommands = [
  `CREATE TABLE IF NOT EXISTS payments (
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
  )`,
  
  `CREATE TABLE IF NOT EXISTS token_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    amount INT NOT NULL,
    type ENUM('spend', 'earn', 'bonus', 'purchase') NOT NULL,
    description TEXT,
    related_payment_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (related_payment_id) REFERENCES payments(id) ON DELETE SET NULL
  )`
];

console.log('⚠️  Этот скрипт не может выполнить SQL напрямую.');
console.log('Используйте один из способов ниже:\n');

console.log('='.repeat(70));
console.log('СПОСОБ 1: Railway CLI');
console.log('='.repeat(70));
console.log('1. Установите Railway CLI: npm install -g @railway/cli');
console.log('2. Выполните: railway connect');
console.log('3. Подключитесь к MySQL и выполните SQL из create_missing_tables.sql\n');

console.log('='.repeat(70));
console.log('СПОСОБ 2: Прямое подключение к MySQL');
console.log('='.repeat(70);
console.log('1. Railway → Database → Settings → Connect');
console.log('2. Скопируйте Connection String');
console.log('3. Подключитесь через MySQL клиент (MySQL Workbench, DBeaver, etc.)');
console.log('4. Выполните SQL из create_missing_tables.sql\n');

console.log('='.repeat(70));
console.log('СПОСОБ 3: Через Railway Database UI');
console.log('='.repeat(70);
console.log('1. Railway → Database → Data');
console.log('2. Найдите кнопку "+ New Table" или "SQL Editor"');
console.log('3. Создайте таблицы вручную или выполните SQL\n');

console.log('='.repeat(70));
console.log('SQL для копирования:');
console.log('='.repeat(70);
console.log(sqlCommands.join(';\n\n') + ';');

