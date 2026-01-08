import axios from 'axios';

import dotenv from 'dotenv';
dotenv.config();

const GEN_API_KEY = process.env.GEN_API_KEY || 'YOUR_GEN_API_KEY_HERE';
const GEN_API_BASE = 'https://api.gen-api.ru/api/v1';

/**
 * Полный тест Gen-API с получением изображения
 */
async function testGenApiFull() {
  console.log('=== Полный тест Gen-API (SDXL) ===\n');

  // Шаг 1: Создаем задачу
  console.log('📤 Шаг 1: Создание задачи генерации...');
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

    // Шаг 2: Polling - проверяем статус задачи
    console.log('🔄 Шаг 2: Ожидание завершения генерации...');
    console.log('Проверяем статус каждые 3 секунды...\n');

    let attempts = 0;
    const maxAttempts = 40; // Максимум 2 минуты (40 * 3 сек)
    let finalResult = null;

    while (attempts < maxAttempts) {
      attempts++;
      
      // Пробуем разные эндпоинты для проверки статуса
      const endpoints = [
        `${GEN_API_BASE}/requests/${requestId}`,
        `${GEN_API_BASE}/networks/sdxl/${requestId}`,
        `${GEN_API_BASE}/tasks/${requestId}`,
        `${GEN_API_BASE}/status/${requestId}`,
        `${GEN_API_BASE}/networks/sdxl/status/${requestId}`
      ];

      let statusChecked = false;
      for (const endpoint of endpoints) {
        try {
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
          
          const statusData = statusResponse.data;
          console.log(`Попытка ${attempts}: Status = ${statusData.status || 'unknown'}`);
          
          if (statusData.status === 'success' || statusData.status === 'completed') {
            console.log('\n✅ Генерация завершена!');
            console.log('Result:', JSON.stringify(statusData, null, 2));
            finalResult = statusData;
            statusChecked = true;
            break;
          } else if (statusData.status === 'failed' || statusData.status === 'error') {
            console.log('\n❌ Генерация завершилась с ошибкой');
            console.log('Result:', JSON.stringify(statusData, null, 2));
            return;
          }
          
          statusChecked = true;
          break;
        } catch (error) {
          // Пробуем следующий эндпоинт
          continue;
        }
      }

      if (finalResult) {
        break;
      }

      if (!statusChecked) {
        console.log(`Попытка ${attempts}: Не удалось проверить статус, пробуем снова...`);
      }

      // Ждем 3 секунды перед следующей проверкой
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (!finalResult) {
      console.log('\n⚠️  Превышено время ожидания или не найден эндпоинт для проверки статуса');
      console.log('Возможно, нужно использовать callback_url для получения результата');
      return;
    }

    // Шаг 3: Извлекаем изображение из результата
    console.log('\n---\n');
    console.log('📸 Шаг 3: Извлечение изображения...');
    
    if (finalResult.output) {
      console.log('Output найден:', Object.keys(finalResult.output));
      
      // Проверяем различные возможные поля с изображением
      if (finalResult.output.image) {
        console.log('✅ Изображение в output.image');
        const imageData = finalResult.output.image;
        if (typeof imageData === 'string') {
          if (imageData.startsWith('http')) {
            console.log('URL изображения:', imageData);
          } else if (imageData.startsWith('data:')) {
            console.log('Base64 изображение (первые 100 символов):', imageData.substring(0, 100));
          }
        }
      }
      if (finalResult.output.image_url) {
        console.log('✅ URL изображения:', finalResult.output.image_url);
      }
      if (finalResult.output.url) {
        console.log('✅ URL:', finalResult.output.url);
      }
      if (finalResult.output.data) {
        console.log('✅ Данные:', typeof finalResult.output.data);
      }
    } else if (finalResult.image) {
      console.log('✅ Изображение в корневом поле image');
    } else if (finalResult.image_url) {
      console.log('✅ URL изображения:', finalResult.image_url);
    } else {
      console.log('⚠️  Изображение не найдено в ожидаемых полях');
      console.log('Полный ответ:', JSON.stringify(finalResult, null, 2));
    }

  } catch (error) {
    console.error('\n❌ Ошибка:', error.response?.status);
    if (error.response?.data) {
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Message:', error.message);
    }
  }
}

testGenApiFull();













