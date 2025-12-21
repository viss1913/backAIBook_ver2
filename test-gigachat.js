import axios from 'axios';
import https from 'https';

// Отключаем проверку SSL для тестирования (только для разработки!)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

const GIGACHAT_API_URL = 'https://gigachat.devices.sberbank.ru/api/v1';
const GIGACHAT_TOKEN = 'MDE5YjQxNWEtYTQzZS03MzE1LThjNzQtOWUxMDUwNzNmYjhiOjFhNDQ4NzI1LWJmZjgtNGVhMy1hMThiLTU1ZWRjZmQ5MTRhYQ==';

/**
 * Тест GigaChat API
 */
async function testGigaChat() {
  console.log('=== Тест GigaChat API ===\n');

  // Тест 1: Базовый chat completions
  console.log('Тест 1: Chat Completions (базовый запрос)');
  try {
    const response = await axios.post(
      `${GIGACHAT_API_URL}/chat/completions`,
      {
        model: 'GigaChat',
        messages: [
          {
            role: 'system',
            content: 'Ты помощник для создания промптов для генерации изображений.'
          },
          {
            role: 'user',
            content: 'Создай детальный промпт на английском языке для генерации изображения: человек читает книгу "Война и мир" на балконе во время заката.'
          }
        ],
        function_call: 'auto'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${GIGACHAT_TOKEN}`
        },
        timeout: 30000,
        httpsAgent: httpsAgent
      }
    );

    console.log('✅ Ответ получен!');
    console.log('Структура ответа:', JSON.stringify(response.data, null, 2).substring(0, 500));
    
    if (response.data.choices && response.data.choices[0]) {
      console.log('\nОтвет модели:', response.data.choices[0].message?.content);
    }
  } catch (error) {
    console.log('❌ Ошибка:', error.response?.status, error.response?.data || error.message);
  }

  console.log('\n---\n');

  // Тест 2: Проверяем, есть ли эндпоинт для генерации изображений
  console.log('Тест 2: Проверка эндпоинта /images/generations');
  try {
    const response = await axios.post(
      `${GIGACHAT_API_URL}/images/generations`,
      {
        prompt: 'A person reading a book on a balcony during sunset',
        n: 1,
        size: '1024x1024'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${GIGACHAT_TOKEN}`
        },
        timeout: 30000,
        httpsAgent: httpsAgent
      }
    );
    console.log('✅ Ответ получен!', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Ошибка:', error.response?.status, error.response?.data || error.message);
  }

  console.log('\n---\n');

  // Тест 3: Запрос на генерацию изображения через chat
  console.log('Тест 3: Запрос на генерацию изображения через chat');
  try {
    const response = await axios.post(
      `${GIGACHAT_API_URL}/chat/completions`,
      {
        model: 'GigaChat',
        messages: [
          {
            role: 'user',
            content: 'Нарисуй изображение человека, читающего книгу на балконе во время заката'
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${GIGACHAT_TOKEN}`
        },
        timeout: 30000,
        httpsAgent: httpsAgent
      }
    );

    console.log('✅ Ответ получен!');
    console.log('Структура ответа:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Ошибка:', error.response?.status, error.response?.data || error.message);
  }
}

testGigaChat();

