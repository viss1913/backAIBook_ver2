/**
 * Простой скрипт для создания задачи генерации и получения request_id
 * Только создает задачу, не ждет результата
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GEN_API_KEY = process.env.GEN_API_KEY;
const GEN_API_BASE = 'https://api.gen-api.ru/api/v1';
const GEN_API_URL = `${GEN_API_BASE}/networks/z-image`;

/**
 * Создает задачу генерации изображения
 */
async function createTask() {
  console.log('=== Создание задачи Gen-API ===\n');
  console.log('GEN_API_KEY установлен:', !!GEN_API_KEY);
  console.log('URL:', GEN_API_URL);
  console.log('\n---\n');

  if (!GEN_API_KEY) {
    console.error('❌ GEN_API_KEY не установлен в .env файле!');
    process.exit(1);
  }

  // Промпт - Гарри Поттер
  const prompt = 'Гарри Поттер в Большом зале Хогвартса, магический пир, плавающие свечи, готическая архитектура, волшебная атмосфера, детальная иллюстрация в стиле фэнтези';

  const requestData = {
    prompt: prompt,
    translate_input: true,
    width: 992,
    height: 992,
    num_images: 1,
    model: 'turbo',
    output_format: 'png',
    num_inference_steps: 8,
    enable_safety_checker: true,
    acceleration: 'none',
    enable_prompt_expansion: false
  };

  console.log('📤 Отправка запроса на создание задачи...');
  console.log('Промпт:', prompt);
  console.log('\n---\n');

  try {
    // Пробуем POST (стандартный метод)
    const response = await axios.post(GEN_API_URL, requestData, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${GEN_API_KEY}`
      },
      timeout: 30000
    });

    console.log('✅ Задача создана успешно!\n');
    console.log('📋 Ответ от Gen-API:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('\n---\n');

    const requestId = response.data.request_id;
    const status = response.data.status;

    if (!requestId) {
      console.error('❌ request_id не найден в ответе!');
      console.error('Полный ответ:', JSON.stringify(response.data, null, 2));
      process.exit(1);
    }

    console.log('✅✅✅ REQUEST_ID ПОЛУЧЕН ✅✅✅\n');
    console.log('📌 Request ID:', requestId);
    console.log('📊 Статус:', status);
    console.log('\n💡 Используйте этот request_id для получения результата:');
    console.log(`   node test-gen-api-quick.js ${requestId}`);
    console.log('\n⚠️  ВАЖНО: Это только создание задачи!');
    console.log('   Картинка придет позже в поле output через callback или long polling.');
    console.log('\n---\n');

    return requestId;

  } catch (error) {
    console.error('\n❌ Ошибка при создании задачи:\n');
    
    if (error.response) {
      console.error('HTTP статус:', error.response.status);
      console.error('Данные ответа:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('Запрос отправлен, но ответа нет');
      console.error('Проверьте интернет соединение и URL:', GEN_API_URL);
    } else {
      console.error('Ошибка:', error.message);
    }
    
    process.exit(1);
  }
}

// Запускаем создание задачи
createTask()
  .then(requestId => {
    console.log('✅ Готово! Request ID сохранен.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Критическая ошибка:', error.message);
    process.exit(1);
  });










