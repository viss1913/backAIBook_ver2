import axios from 'axios';

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || 'YOUR_PERPLEXITY_API_KEY_HERE';
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

/**
 * Тестовый запрос к Perplexity API для получения изображений
 */
async function testPerplexityImages() {
  console.log('=== Тест Perplexity API для получения изображений ===\n');

  // Промпт связанный с чтением книг и иллюстрациями
  const testPrompt = 'Покажи мне красивые иллюстрации к классическим литературным произведениям, например к романам о приключениях или фантастике';

  const requestData = {
    model: 'sonar',
    return_images: true,
    messages: [
      {
        role: 'user',
        content: testPrompt
      }
    ],
    image_format_filter: ['jpeg', 'png', 'webp'] // Только статические форматы
  };

  console.log('Отправляю запрос...');
  console.log('Промпт:', testPrompt);
  console.log('Модель: sonar');
  console.log('return_images: true\n');

  try {
    const response = await axios.post(
      PERPLEXITY_API_URL,
      requestData,
      {
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Ответ получен!');
    console.log('\n=== Структура ответа ===');
    console.log(JSON.stringify(response.data, null, 2));

    // Пытаемся найти изображения в ответе
    console.log('\n=== Анализ ответа ===');
    
    if (response.data.choices && response.data.choices[0]) {
      const message = response.data.choices[0].message;
      console.log('Текстовый ответ:', message.content);
      
      // Проверяем различные возможные поля для изображений
      if (message.images) {
        console.log('\n📸 Найдены изображения в message.images:');
        console.log(JSON.stringify(message.images, null, 2));
      }
      
      if (message.media) {
        console.log('\n📸 Найдены медиа в message.media:');
        console.log(JSON.stringify(message.media, null, 2));
      }
    }

    // Проверяем корневой уровень ответа
    if (response.data.images) {
      console.log('\n📸 Найдены изображения в корне ответа:');
      console.log(JSON.stringify(response.data.images, null, 2));
    }

    // Выводим все ключи для анализа
    console.log('\n=== Все ключи в ответе ===');
    console.log('Ключи в response.data:', Object.keys(response.data));
    if (response.data.choices && response.data.choices[0]) {
      console.log('Ключи в choices[0]:', Object.keys(response.data.choices[0]));
      if (response.data.choices[0].message) {
        console.log('Ключи в message:', Object.keys(response.data.choices[0].message));
      }
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

// Запускаем тест
testPerplexityImages();

