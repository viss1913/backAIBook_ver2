import axios from 'axios';

import dotenv from 'dotenv';
dotenv.config();

const GEN_API_KEY = process.env.GEN_API_KEY || 'YOUR_GEN_API_KEY_HERE';
const GEN_API_BASE = 'https://api.gen-api.ru/api/v1';
const RAILWAY_URL = 'https://your-app-name.railway.app'; // Замените на ваш URL

/**
 * Тест Gen-API с callback на Railway
 */
async function testGenApiWithRailway() {
  console.log('=== Тест Gen-API с callback на Railway ===\n');
  console.log('⚠️  Убедитесь, что заменили RAILWAY_URL на ваш реальный URL!\n');

  const callbackUrl = `${RAILWAY_URL}/api/gen-api-callback`;
  
  console.log('Callback URL:', callbackUrl);
  console.log('\n---\n');

  // Создаем задачу
  console.log('📤 Создание задачи генерации...');
  const requestData = {
    prompt: 'Фотография девушки в студии, красивое лицо, улыбка, 4К, реалистичная',
    callback_url: callbackUrl
  };

  try {
    const createResponse = await axios.post(
      `${GEN_API_BASE}/networks/sdxl`,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${GEN_API_KEY}`
        },
        timeout: 30000
      }
    );

    console.log('✅ Задача создана!');
    console.log('Response:', JSON.stringify(createResponse.data, null, 2));
    
    const requestId = createResponse.data.request_id;
    console.log(`\nRequest ID: ${requestId}`);
    console.log('Status:', createResponse.data.status);
    
    console.log('\n✅ Задача отправлена!');
    console.log('Callback будет отправлен на:', callbackUrl);
    console.log('Проверьте логи сервера на Railway для получения результата');
    console.log('\nОжидаемое время генерации: 30-60 секунд');

  } catch (error) {
    console.error('❌ Ошибка:', error.response?.status);
    if (error.response?.data) {
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Message:', error.message);
    }
  }
}

testGenApiWithRailway();











