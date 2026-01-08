import axios from 'axios';
import https from 'https';

// Отключаем проверку SSL для тестирования
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

const GIGACHAT_TOKEN = 'MDE5YjQxNWEtYTQzZS03MzE1LThjNzQtOWUxMDUwNzNmYjhiOjFhNDQ4NzI1LWJmZjgtNGVhMy1hMThiLTU1ZWRjZmQ5MTRhYQ==';
const GIGACHAT_API_URL = 'https://gigachat.devices.sberbank.ru/api/v1';

/**
 * Тест генерации изображений через GigaChat API
 */
async function testGigaChatImages() {
  console.log('=== Тест генерации изображений через GigaChat API ===\n');

  // Тест 1: Эндпоинт /images/generate
  console.log('Тест 1: Эндпоинт /images/generate');
  try {
    const response = await axios.post(
      `${GIGACHAT_API_URL}/images/generate`,
      {
        model: 'GigaChat:latest',
        prompt: 'Человек читает книгу "Война и мир" на балконе во время заката',
        parameters: {
          width: 1024,
          height: 1024
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${GIGACHAT_TOKEN}`
        },
        httpsAgent: httpsAgent,
        timeout: 60000
      }
    );

    console.log('✅ Ответ получен!');
    console.log('Структура ответа:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Ошибка:', error.response?.status);
    if (error.response?.data) {
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Message:', error.message);
    }
  }

  console.log('\n---\n');

  // Тест 2: Chat completions с запросом на генерацию изображения
  console.log('Тест 2: Chat Completions с запросом на генерацию');
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
        httpsAgent: httpsAgent,
        timeout: 30000
      }
    );

    console.log('✅ Ответ получен!');
    console.log('Структура ответа:', JSON.stringify(response.data, null, 2));
    
    if (response.data.choices && response.data.choices[0]) {
      console.log('\nОтвет модели:', response.data.choices[0].message?.content);
    }
  } catch (error) {
    console.log('❌ Ошибка:', error.response?.status);
    if (error.response?.data) {
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Message:', error.message);
    }
  }
}

testGigaChatImages();











