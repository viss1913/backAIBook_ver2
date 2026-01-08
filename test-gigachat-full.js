import axios from 'axios';
import https from 'https';

// Отключаем проверку SSL для тестирования
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

const GIGACHAT_AUTH_KEY = 'MDE5YjQxNWEtYTQzZS03MzE1LThjNzQtOWUxMDUwNzNmYjhiOjIyMDBkZjY1LTc2Y2MtNGNiNy05YTY0LWMwNDEzNDMwNWJkOQ==';
const CLIENT_ID = '019b415a-a43e-7315-8c74-9e105073fb8b';
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
          'RqUID': CLIENT_ID // Уникальный идентификатор запроса
        },
        httpsAgent: httpsAgent,
        timeout: 30000
      }
    );

    console.log('✅ Токен получен!');
    console.log('Access Token:', response.data.access_token?.substring(0, 50) + '...');
    console.log('Expires in:', response.data.expires_at || 'N/A');
    
    return response.data.access_token;
  } catch (error) {
    console.error('❌ Ошибка получения токена:');
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Извлекает file_id из ответа модели
 */
function extractImageId(content) {
  // Ищем паттерн <img src="uuid" fuse="true"/>
  const match = content.match(/<img\s+src="([^"]+)"\s+fuse="true"\/>/);
  if (match) {
    return match[1];
  }
  return null;
}

/**
 * Генерирует изображение через GigaChat
 */
async function generateImageWithGigaChat(accessToken, prompt) {
  console.log('\n=== Генерация изображения ===\n');
  console.log('Промпт:', prompt);
  
  try {
    const response = await axios.post(
      `${GIGACHAT_API_URL}/chat/completions`,
      {
        model: 'GigaChat',
        messages: [
          {
            role: 'system',
            content: 'Ты помощник для создания изображений.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        function_call: 'auto'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Client-ID': CLIENT_ID
        },
        httpsAgent: httpsAgent,
        timeout: 60000
      }
    );

    console.log('✅ Ответ получен!');
    const content = response.data.choices[0]?.message?.content;
    console.log('Ответ модели:', content);
    
    // Извлекаем file_id
    const fileId = extractImageId(content);
    if (!fileId) {
      console.log('⚠️ Идентификатор изображения не найден в ответе');
      return null;
    }
    
    console.log('File ID:', fileId);
    return fileId;
  } catch (error) {
    console.error('❌ Ошибка генерации изображения:');
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Скачивает изображение по file_id
 */
async function downloadImage(accessToken, fileId) {
  console.log('\n=== Скачивание изображения ===\n');
  console.log('File ID:', fileId);
  
  try {
    const response = await axios.get(
      `${GIGACHAT_API_URL}/files/${fileId}/content`,
      {
        headers: {
          'Accept': 'application/jpg',
          'Authorization': `Bearer ${accessToken}`,
          'X-Client-ID': CLIENT_ID
        },
        httpsAgent: httpsAgent,
        responseType: 'arraybuffer', // Для бинарных данных
        timeout: 30000
      }
    );

    console.log('✅ Изображение скачано!');
    console.log('Размер:', response.data.length, 'байт');
    console.log('Content-Type:', response.headers['content-type']);
    
    // Конвертируем в base64 для удобства
    const base64 = Buffer.from(response.data).toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64}`;
    
    return {
      data: response.data,
      base64: base64,
      dataUrl: dataUrl,
      size: response.data.length
    };
  } catch (error) {
    console.error('❌ Ошибка скачивания изображения:');
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Полный тест генерации изображения
 */
async function testGigaChatImageGeneration() {
  try {
    // Шаг 1: Получаем access_token
    const accessToken = await getAccessToken();
    
    // Шаг 2: Генерируем изображение
    const prompt = 'Нарисуй человека, читающего книгу "Война и мир" на балконе во время заката';
    const fileId = await generateImageWithGigaChat(accessToken, prompt);
    
    if (!fileId) {
      console.log('\n⚠️ Не удалось получить file_id');
      return;
    }
    
    // Шаг 3: Скачиваем изображение
    const image = await downloadImage(accessToken, fileId);
    
    console.log('\n✅ Успешно! Изображение готово!');
    console.log('Размер:', image.size, 'байт');
    console.log('Data URL (первые 100 символов):', image.dataUrl.substring(0, 100) + '...');
    
  } catch (error) {
    console.error('\n❌ Общая ошибка:', error.message);
  }
}

testGigaChatImageGeneration();













