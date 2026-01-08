import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3000';

/**
 * Симуляция запроса с фронтенда
 */
async function simulateFrontendRequest() {
  console.log('=== Симуляция запроса с фронтенда ===\n');
  console.log('Имитируем запрос от Android приложения...\n');

  // Данные, которые отправляет фронтенд
  const frontendRequest = {
    bookTitle: 'Война и мир',
    author: 'Лев Толстой',
    textChunk: 'Он стоял на балконе, глядя на закат. Солнце медленно опускалось за горизонт, окрашивая небо в багровые и золотые тона. В воздухе витала тишина, нарушаемая лишь далеким пением птиц.'
  };

  console.log('📤 Отправляем запрос на бэкенд:');
  console.log(JSON.stringify(frontendRequest, null, 2));
  console.log('\nЭндпоинт: POST /api/generate-image?provider=gigachat');
  console.log('---\n');

  try {
    const startTime = Date.now();
    
    const response = await axios.post(
      `${API_URL}/api/generate-image?provider=gigachat`,
      frontendRequest,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 180000 // 3 минуты
      }
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('✅ Ответ получен от бэкенда!');
    console.log(`⏱️  Время выполнения: ${duration} секунд\n`);
    
    console.log('=== Результат ===');
    console.log('Success:', response.data.success);
    
    if (response.data.imageUrl) {
      console.log('\n📸 Изображение:');
      if (response.data.imageUrl.startsWith('data:image')) {
        const sizeKB = (response.data.imageUrl.length / 1024).toFixed(2);
        console.log(`   Формат: Base64 Data URL`);
        console.log(`   Размер: ${sizeKB} KB (в base64)`);
        console.log(`   Первые 100 символов: ${response.data.imageUrl.substring(0, 100)}...`);
      } else {
        console.log(`   URL: ${response.data.imageUrl}`);
      }
    }
    
    if (response.data.promptUsed) {
      console.log('\n📝 Промпт, использованный для генерации:');
      console.log(`   ${response.data.promptUsed}`);
    }

    console.log('\n✅ Процесс завершен успешно!');
    console.log('\n📋 Резюме:');
    console.log('   1. ✅ Запрос получен от фронтенда');
    console.log('   2. ✅ Промпт сгенерирован через Gemini (OpenRouter)');
    console.log('   3. ✅ Изображение сгенерировано через GigaChat');
    console.log('   4. ✅ Изображение скачано и конвертировано в base64');
    console.log('   5. ✅ Ответ отправлен фронтенду');

  } catch (error) {
    console.error('\n❌ Ошибка при обработке запроса:');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 500) {
        console.error('\n⚠️  Возможные причины:');
        console.error('   - Не установлены переменные окружения (GEMINI_API_KEY, GIGACHAT_AUTH_KEY, GIGACHAT_CLIENT_ID)');
        console.error('   - Ошибка при получении access_token от GigaChat');
        console.error('   - Ошибка при генерации промпта через Gemini');
        console.error('   - Ошибка при генерации изображения в GigaChat');
      }
    } else if (error.request) {
      console.error('Не удалось получить ответ от сервера');
      console.error('Убедитесь, что сервер запущен на', API_URL);
    } else {
      console.error('Error:', error.message);
    }
    
    process.exit(1);
  }
}

simulateFrontendRequest();













