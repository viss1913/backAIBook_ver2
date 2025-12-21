import axios from 'axios';

import dotenv from 'dotenv';
dotenv.config();

const GEN_API_KEY = process.env.GEN_API_KEY || 'YOUR_GEN_API_KEY_HERE';
const GEN_API_URL = 'https://api.gen-api.ru/api/v1/networks/sdxl';

/**
 * Тест Gen-API для генерации изображений
 */
async function testGenApi() {
  console.log('=== Тест Gen-API (SDXL) ===\n');

  // Убираем callback_url или передаем пустую строку
  const requestData = {
    prompt: 'Фотография девушки в студии, красивое лицо, улыбка, 4К, реалистичная'
  };

  console.log('Отправляю запрос...');
  console.log('Промпт:', requestData.prompt);
  console.log('Эндпоинт:', GEN_API_URL);
  console.log('\n');

  try {
    const response = await axios.post(
      GEN_API_URL,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${GEN_API_KEY}`
        },
        timeout: 120000 // 2 минуты
      }
    );

    console.log('✅ Ответ получен!');
    console.log('\n=== Структура ответа ===');
    console.log(JSON.stringify(response.data, null, 2));

    // Проверяем формат ответа
    console.log('\n=== Анализ ответа ===');
    console.log('Ключи в response.data:', Object.keys(response.data));
    
    // Проверяем различные возможные поля
    if (response.data.image) {
      console.log('\n📸 Изображение найдено в поле "image"');
    }
    if (response.data.image_url) {
      console.log('\n📸 URL изображения:', response.data.image_url);
    }
    if (response.data.url) {
      console.log('\n📸 URL:', response.data.url);
    }
    if (response.data.data) {
      console.log('\n📸 Данные:', JSON.stringify(response.data.data, null, 2));
    }
    if (response.data.result) {
      console.log('\n📸 Результат:', JSON.stringify(response.data.result, null, 2));
    }
    if (response.data.task_id) {
      console.log('\n📋 Task ID:', response.data.task_id);
      console.log('⚠️  Возможно, это асинхронный API - нужно проверять статус задачи');
    }

  } catch (error) {
    console.error('❌ Ошибка при запросе:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

testGenApi();

