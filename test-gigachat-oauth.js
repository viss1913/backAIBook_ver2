import axios from 'axios';
import https from 'https';

// Отключаем проверку SSL для тестирования
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

const GIGACHAT_AUTH_KEY = 'MDE5YjQxNWEtYTQzZS03MzE1LThjNzQtOWUxMDUwNzNmYjhiOjFhNDQ4NzI1LWJmZjgtNGVhMy1hMThiLTU1ZWRjZmQ5MTRhYQ==';
const OAUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
const GIGACHAT_API_URL = 'https://gigachat.devices.sberbank.ru/api/v1';

/**
 * Получает access_token через OAuth
 */
async function getAccessToken() {
  console.log('=== Получение access_token через OAuth ===\n');
  
  try {
    const response = await axios.post(
      OAUTH_URL,
      'scope=GIGACHAT_API_PERS',
      {
        headers: {
          'Authorization': `Basic ${GIGACHAT_AUTH_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'RqUID': '1234567890' // Уникальный идентификатор запроса
        },
        httpsAgent: httpsAgent,
        timeout: 30000
      }
    );

    console.log('✅ Токен получен!');
    console.log('Ответ:', JSON.stringify(response.data, null, 2));
    
    return response.data.access_token;
  } catch (error) {
    console.error('❌ Ошибка получения токена:');
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Тест GigaChat API с получением токена
 */
async function testGigaChatWithToken() {
  try {
    // Шаг 1: Получаем access_token
    const accessToken = await getAccessToken();
    console.log('\n---\n');
    
    // Шаг 2: Тестируем chat completions
    console.log('=== Тест Chat Completions ===\n');
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
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`
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
    console.error('❌ Ошибка:', error.response?.status, error.response?.data || error.message);
  }
}

testGigaChatWithToken();


