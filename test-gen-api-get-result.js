import axios from 'axios';

import dotenv from 'dotenv';
dotenv.config();

const GEN_API_KEY = process.env.GEN_API_KEY || 'YOUR_GEN_API_KEY_HERE';
const GEN_API_BASE = 'https://api.gen-api.ru/api/v1';

/**
 * Тест получения результата по request_id
 */
async function testGetResult() {
  console.log('=== Тест получения результата Gen-API ===\n');

  // Используем request_id из предыдущего теста
  const requestId = 34866292;
  
  console.log(`Проверяем результат для request_id: ${requestId}\n`);

  // Пробуем разные возможные эндпоинты
  const endpoints = [
    `${GEN_API_BASE}/requests/${requestId}`,
    `${GEN_API_BASE}/networks/sdxl/${requestId}`,
    `${GEN_API_BASE}/tasks/${requestId}`,
    `${GEN_API_BASE}/status/${requestId}`,
    `${GEN_API_BASE}/networks/sdxl/status/${requestId}`,
    `${GEN_API_BASE}/networks/sdxl/result/${requestId}`,
    `${GEN_API_BASE}/result/${requestId}`
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Пробуем: ${endpoint}`);
      const response = await axios.get(
        endpoint,
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${GEN_API_KEY}`
          },
          timeout: 10000
        }
      );
      
      console.log('✅ Успех!');
      console.log('Status:', response.status);
      console.log('Data:', JSON.stringify(response.data, null, 2));
      
      // Проверяем наличие изображения
      if (response.data.output) {
        console.log('\n📸 Output найден!');
        if (response.data.output.image || response.data.output.image_url) {
          console.log('✅ Изображение найдено в output!');
        }
      }
      
      return; // Успешно нашли эндпоинт
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`   ❌ 404 - не найден\n`);
      } else if (error.response?.status === 200) {
        console.log(`   ✅ 200 - но проверим данные\n`);
        console.log('Data:', JSON.stringify(error.response.data, null, 2));
        return;
      } else {
        console.log(`   ❌ ${error.response?.status || error.message}\n`);
      }
    }
  }

  console.log('\n⚠️  Не удалось найти рабочий эндпоинт для получения результата');
  console.log('Вероятно, нужно использовать callback_url для получения результата');
}

testGetResult();











