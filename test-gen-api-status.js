import axios from 'axios';

import dotenv from 'dotenv';
dotenv.config();

const GEN_API_KEY = process.env.GEN_API_KEY || 'YOUR_GEN_API_KEY_HERE';
const GEN_API_BASE = 'https://api.gen-api.ru/api/v1';

/**
 * Тест Gen-API с проверкой статуса
 */
async function testGenApiWithStatus() {
  console.log('=== Тест Gen-API (SDXL) с проверкой статуса ===\n');

  // Шаг 1: Создаем задачу
  console.log('Шаг 1: Создание задачи генерации...');
  const requestData = {
    prompt: 'Фотография девушки в студии, красивое лицо, улыбка, 4К, реалистичная'
  };

  try {
    const createResponse = await axios.post(
      `${GEN_API_BASE}/networks/sdxl`,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${GEN_API_KEY}`
        },
        timeout: 30000
      }
    );

    console.log('✅ Задача создана!');
    console.log('Response:', JSON.stringify(createResponse.data, null, 2));
    
    const requestId = createResponse.data.request_id;
    if (!requestId) {
      console.log('❌ request_id не найден в ответе');
      return;
    }

    console.log(`\nRequest ID: ${requestId}`);
    console.log('Status:', createResponse.data.status);
    console.log('\n---\n');

    // Шаг 2: Проверяем статус задачи
    console.log('Шаг 2: Проверка статуса задачи...');
    
    // Пробуем разные возможные эндпоинты для проверки статуса
    const possibleEndpoints = [
      `${GEN_API_BASE}/requests/${requestId}`,
      `${GEN_API_BASE}/networks/sdxl/${requestId}`,
      `${GEN_API_BASE}/tasks/${requestId}`,
      `${GEN_API_BASE}/status/${requestId}`
    ];

    let statusChecked = false;
    for (const endpoint of possibleEndpoints) {
      try {
        console.log(`Пробуем: ${endpoint}`);
        const statusResponse = await axios.get(
          endpoint,
          {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${GEN_API_KEY}`
            },
            timeout: 10000
          }
        );
        
        console.log('✅ Статус получен!');
        console.log(JSON.stringify(statusResponse.data, null, 2));
        statusChecked = true;
        break;
      } catch (error) {
        if (error.response?.status === 404) {
          console.log(`   ❌ 404 - не найден`);
        } else {
          console.log(`   ❌ Ошибка: ${error.response?.status || error.message}`);
        }
      }
    }

    if (!statusChecked) {
      console.log('\n⚠️  Не удалось найти эндпоинт для проверки статуса');
      console.log('Возможно, нужно использовать callback_url или polling');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.response?.status, error.response?.data || error.message);
  }
}

testGenApiWithStatus();











