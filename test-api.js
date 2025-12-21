/**
 * Тестовый скрипт для проверки работы API генерации изображений
 * Использование: node test-api.js
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testGenerateImage() {
  console.log('🧪 Тестирование API генерации изображений...\n');
  
  // Проверяем переменные окружения
  if (!process.env.PERPLEXITY_API_KEY) {
    console.error('❌ PERPLEXITY_API_KEY не установлен в .env');
    return;
  }
  
  if (!process.env.LAOZHANG_API_KEY) {
    console.error('❌ LAOZHANG_API_KEY не установлен в .env');
    return;
  }

  // Тестовые данные
  const testData = {
    bookTitle: "Война и мир",
    author: "Лев Толстой",
    textChunk: "Он стоял на балконе, глядя на закат. Солнце медленно опускалось за горизонт, окрашивая небо в багровые и золотые тона."
  };

  try {
    console.log('📤 Отправка запроса...');
    console.log('Данные:', JSON.stringify(testData, null, 2));
    console.log(`URL: ${BASE_URL}/api/generate-image\n`);

    const startTime = Date.now();
    
    const response = await axios.post(`${BASE_URL}/api/generate-image`, testData, {
      timeout: 60000, // 60 секунд для теста
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const duration = Date.now() - startTime;

    console.log('✅ Успешный ответ!');
    console.log(`⏱️  Время выполнения: ${(duration / 1000).toFixed(2)} секунд\n`);
    console.log('Ответ:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.imageUrl) {
      console.log(`\n🖼️  URL изображения: ${response.data.imageUrl}`);
    }

  } catch (error) {
    console.error('\n❌ Ошибка при тестировании:');
    
    if (error.response) {
      console.error(`Статус: ${error.response.status}`);
      console.error('Ответ:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('Запрос отправлен, но ответа нет');
      console.error('Проверьте, запущен ли сервер на', BASE_URL);
    } else {
      console.error('Ошибка:', error.message);
    }
  }
}

// Запуск теста
testGenerateImage();


