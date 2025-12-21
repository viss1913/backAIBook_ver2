/**
 * Простой скрипт для отладки получения результата Gen-API
 * 
 * ИСПОЛЬЗОВАНИЕ:
 * 1. Откройте личный кабинет Gen-API: https://gen-api.ru
 * 2. Найдите последнюю задачу и скопируйте request_id
 * 3. Запустите: node test-gen-api-simple-debug.js <request_id>
 * 
 * Пример: node test-gen-api-simple-debug.js 12345678
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GEN_API_KEY = process.env.GEN_API_KEY;
const GEN_API_BASE = 'https://api.gen-api.ru/api/v1';

async function testGetResult(requestId) {
  console.log('=== Тест получения результата Gen-API ===\n');
  console.log('Request ID:', requestId);
  console.log('GEN_API_KEY установлен:', !!GEN_API_KEY);
  console.log('\n---\n');

  if (!GEN_API_KEY) {
    console.error('❌ GEN_API_KEY не установлен в .env файле!');
    return;
  }

  // Список возможных эндпоинтов для проверки
  // ПРАВИЛЬНЫЙ эндпоинт: /request/get/{request_id}
  const endpoints = [
    {
      name: 'ПРАВИЛЬНЫЙ: request/get',
      url: `${GEN_API_BASE}/request/get/${requestId}` // ⬅️ ПРАВИЛЬНЫЙ!
    },
    {
      name: 'Стандартный requests',
      url: `${GEN_API_BASE}/requests/${requestId}`
    },
    {
      name: 'Z-Image прямой',
      url: `${GEN_API_BASE}/networks/z-image/${requestId}`
    },
    {
      name: 'Z-Image requests',
      url: `${GEN_API_BASE}/networks/z-image/requests/${requestId}`
    },
    {
      name: 'Z-Image status',
      url: `${GEN_API_BASE}/networks/z-image/status/${requestId}`
    },
    {
      name: 'Z-Image result',
      url: `${GEN_API_BASE}/networks/z-image/result/${requestId}`
    },
    {
      name: 'Tasks',
      url: `${GEN_API_BASE}/tasks/${requestId}`
    },
    {
      name: 'Status',
      url: `${GEN_API_BASE}/status/${requestId}`
    },
    {
      name: 'Result',
      url: `${GEN_API_BASE}/result/${requestId}`
    }
  ];

  console.log('Пробуем разные эндпоинты...\n');

  for (const endpoint of endpoints) {
    try {
      console.log(`📡 ${endpoint.name}: ${endpoint.url}`);
      
      const response = await axios.get(endpoint.url, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${GEN_API_KEY}`
        },
        timeout: 10000
      });

      console.log(`   ✅ Статус HTTP: ${response.status}`);
      console.log(`   📦 Статус задачи: ${response.data.status || 'не указан'}`);
      
      // Проверяем наличие output
      if (response.data.output) {
        console.log(`   🎨 OUTPUT НАЙДЕН!`);
        console.log(`   📋 Структура output:`);
        console.log(JSON.stringify(response.data.output, null, 6));
        
        // Пробуем найти картинку
        const output = response.data.output;
        let imageFound = false;
        
        // Вариант 1: массив images
        if (Array.isArray(output)) {
          console.log(`   📸 Output - массив, элементов: ${output.length}`);
          if (output.length > 0) {
            console.log(`   🔍 Первый элемент:`, JSON.stringify(output[0], null, 6));
            if (output[0].url || output[0].image_url || output[0].image) {
              imageFound = true;
              console.log(`   ✅ КАРТИНКА НАЙДЕНА в массиве!`);
            }
          }
        }
        // Вариант 2: объект
        else if (typeof output === 'object') {
          console.log(`   📸 Output - объект`);
          console.log(`   🔑 Ключи:`, Object.keys(output));
          
          // Проверяем разные возможные поля
          const possibleFields = ['url', 'image_url', 'image', 'images', 'data'];
          for (const field of possibleFields) {
            if (output[field]) {
              console.log(`   ✅ Поле "${field}" найдено!`);
              imageFound = true;
            }
          }
        }
        
        if (!imageFound) {
          console.log(`   ⚠️  Картинка не найдена в ожидаемых полях`);
        }
      } else {
        console.log(`   ⚠️  Output отсутствует`);
      }
      
      // Выводим полный ответ для анализа
      console.log(`\n   📄 Полный ответ:`);
      console.log(JSON.stringify(response.data, null, 6));
      
      console.log(`\n   ✅✅✅ ЭТОТ ЭНДПОИНТ РАБОТАЕТ! ✅✅✅\n`);
      console.log('---\n');
      
      return {
        success: true,
        endpoint: endpoint.url,
        data: response.data
      };
      
    } catch (error) {
      if (error.response) {
        console.log(`   ❌ HTTP ${error.response.status}`);
        if (error.response.data) {
          console.log(`   📋 Ответ:`, JSON.stringify(error.response.data, null, 6));
        }
      } else {
        console.log(`   ❌ Ошибка: ${error.message}`);
      }
      console.log('');
    }
  }

  console.log('\n⚠️  Ни один эндпоинт не вернул успешный результат');
  console.log('Возможные причины:');
  console.log('1. request_id неверный');
  console.log('2. Задача еще не завершена');
  console.log('3. Нужно использовать другой эндпоинт (проверить документацию)');
  
  return null;
}

// Получаем request_id из аргументов командной строки
const requestId = process.argv[2];

if (!requestId) {
  console.log('Использование: node test-gen-api-simple-debug.js <request_id>');
  console.log('\nПример:');
  console.log('  node test-gen-api-simple-debug.js 12345678');
  console.log('\nКак найти request_id:');
  console.log('1. Откройте https://gen-api.ru');
  console.log('2. Войдите в личный кабинет');
  console.log('3. Найдите последнюю задачу');
  console.log('4. Скопируйте request_id из задачи');
  process.exit(1);
}

testGetResult(requestId)
  .then(result => {
    if (result) {
      console.log('\n✅ Тест завершен успешно!');
      console.log('Рабочий эндпоинт:', result.endpoint);
      console.log('\nСледующие шаги:');
      console.log('1. Использовать этот эндпоинт в основном скрипте');
      console.log('2. Адаптировать парсинг output под структуру выше');
    } else {
      console.log('\n❌ Тест не нашел рабочий эндпоинт');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n❌ Критическая ошибка:', error.message);
    process.exit(1);
  });

