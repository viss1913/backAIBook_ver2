/**
 * Быстрый тест получения результата по правильному эндпоинту
 * GET https://api.gen-api.ru/api/v1/request/get/{request_id}
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GEN_API_KEY = process.env.GEN_API_KEY;
const GEN_API_BASE = 'https://api.gen-api.ru/api/v1';

// Получаем request_id из аргументов
const requestId = process.argv[2];

if (!requestId) {
  console.log('Использование: node test-gen-api-quick.js <request_id>');
  console.log('\nПример: node test-gen-api-quick.js 12345678');
  process.exit(1);
}

if (!GEN_API_KEY) {
  console.error('❌ GEN_API_KEY не установлен!');
  process.exit(1);
}

console.log('=== Быстрый тест Gen-API ===\n');
console.log('Request ID:', requestId);
console.log('Эндпоинт: GET /request/get/{request_id}\n');

const endpoint = `${GEN_API_BASE}/request/get/${requestId}`;

axios.get(endpoint, {
  headers: {
    'Accept': 'application/json',
    'Authorization': `Bearer ${GEN_API_KEY}`
  },
  timeout: 10000
})
.then(response => {
  console.log('✅ Успех!');
  console.log('HTTP статус:', response.status);
  console.log('\n📦 Статус задачи:', response.data.status);
  
  if (response.data.output) {
    console.log('\n🎨 OUTPUT НАЙДЕН!');
    console.log('Структура output:');
    console.log(JSON.stringify(response.data.output, null, 2));
    
    // Пробуем найти картинку
    const output = response.data.output;
    
    if (Array.isArray(output)) {
      console.log('\n📸 Output - массив');
      if (output.length > 0 && output[0].url) {
        console.log('✅ URL картинки:', output[0].url);
      }
    } else if (output.image_url) {
      console.log('\n✅ URL картинки:', output.image_url);
    } else if (output.url) {
      console.log('\n✅ URL картинки:', output.url);
    } else if (output.image) {
      console.log('\n✅ Image найдено (может быть base64)');
      if (typeof output.image === 'string' && output.image.startsWith('http')) {
        console.log('URL:', output.image);
      } else {
        console.log('Base64 (первые 100 символов):', output.image.substring(0, 100));
      }
    }
  } else {
    console.log('\n⚠️  Output отсутствует');
  }
  
  console.log('\n📄 Полный ответ:');
  console.log(JSON.stringify(response.data, null, 2));
})
.catch(error => {
  console.error('❌ Ошибка:');
  if (error.response) {
    console.error('HTTP статус:', error.response.status);
    console.error('Данные:', JSON.stringify(error.response.data, null, 2));
  } else {
    console.error('Сообщение:', error.message);
  }
  process.exit(1);
});












