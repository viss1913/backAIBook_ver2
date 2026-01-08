import axios from 'axios';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3000';

/**
 * Тест нового эндпоинта для получения изображений через Perplexity
 */
async function testGetImagesEndpoint() {
  console.log('=== Тест эндпоинта /api/get-images ===\n');
  console.log('API URL:', API_URL);
  console.log('PERPLEXITY_API_KEY установлен:', !!process.env.PERPLEXITY_API_KEY);
  console.log('\n');

  const testRequest = {
    query: 'Покажи мне красивые иллюстрации к классическим литературным произведениям, например к романам о приключениях или фантастике',
    imageFormatFilter: ['jpeg', 'png', 'webp']
  };

  console.log('Отправляю запрос:', JSON.stringify(testRequest, null, 2));
  console.log('\n');

  try {
    const response = await axios.post(
      `${API_URL}/api/get-images`,
      testRequest,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60 секунд таймаут
      }
    );

    console.log('✅ Ответ получен!');
    console.log('\n=== Результат ===');
    console.log('Success:', response.data.success);
    console.log('Найдено изображений:', response.data.count);
    console.log('\n=== Изображения ===');
    
    if (response.data.images && response.data.images.length > 0) {
      response.data.images.forEach((img, index) => {
        console.log(`\n${index + 1}. ${img.title || 'Без названия'}`);
        console.log(`   URL: ${img.imageUrl}`);
        console.log(`   Размер: ${img.width}x${img.height}`);
        if (img.originUrl) {
          console.log(`   Источник: ${img.originUrl}`);
        }
      });
    } else {
      console.log('Изображения не найдены');
    }

    console.log('\n=== Текстовый ответ (первые 300 символов) ===');
    if (response.data.textResponse) {
      console.log(response.data.textResponse.substring(0, 300) + '...');
    }

    console.log('\n=== Цитаты ===');
    if (response.data.citations && response.data.citations.length > 0) {
      console.log(`Найдено ${response.data.citations.length} источников`);
      response.data.citations.slice(0, 3).forEach((citation, index) => {
        console.log(`${index + 1}. ${citation}`);
      });
    }

    console.log('\n✅ Тест успешно завершен!');

  } catch (error) {
    console.error('❌ Ошибка при запросе:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('Не удалось получить ответ от сервера');
      console.error('Убедитесь, что сервер запущен на', API_URL);
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

// Запускаем тест
testGetImagesEndpoint();













