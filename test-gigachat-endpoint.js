import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3000';

/**
 * Тест эндпоинта для генерации изображений через GigaChat
 */
async function testGigaChatEndpoint() {
  console.log('=== Тест эндпоинта /api/generate-image с GigaChat ===\n');
  console.log('API URL:', API_URL);
  console.log('\n');

  const testRequest = {
    bookTitle: 'Война и мир',
    author: 'Лев Толстой',
    textChunk: 'Он стоял на балконе, глядя на закат. Солнце медленно опускалось за горизонт, окрашивая небо в багровые и золотые тона.'
  };

  console.log('Отправляю запрос:', JSON.stringify(testRequest, null, 2));
  console.log('Провайдер: gigachat');
  console.log('\n');

  try {
    const response = await axios.post(
      `${API_URL}/api/generate-image?provider=gigachat`,
      testRequest,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 120000 // 2 минуты для генерации
      }
    );

    console.log('✅ Ответ получен!');
    console.log('\n=== Результат ===');
    console.log('Success:', response.data.success);
    console.log('Image URL:', response.data.imageUrl?.substring(0, 100) + '...');
    console.log('Prompt Used:', response.data.promptUsed?.substring(0, 200) + '...');
    
    if (response.data.imageUrl) {
      if (response.data.imageUrl.startsWith('data:image')) {
        console.log('\n📸 Изображение в формате base64 data URL');
        console.log('Длина:', response.data.imageUrl.length, 'символов');
      } else {
        console.log('\n📸 Изображение доступно по URL');
      }
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

testGigaChatEndpoint();

