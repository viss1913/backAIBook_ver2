import axios from 'axios';

import dotenv from 'dotenv';
dotenv.config();

const GEN_API_KEY = process.env.GEN_API_KEY || 'YOUR_GEN_API_KEY_HERE';
const GEN_API_BASE = 'https://api.gen-api.ru/api/v1';
const RAILWAY_URL = 'https://backaibookver2-production.up.railway.app';

/**
 * Тест Gen-API с реальным Railway URL
 */
async function testGenApiWithRealRailway() {
  console.log('=== Тест Gen-API с реальным Railway URL ===\n');
  console.log('Railway URL:', RAILWAY_URL);
  console.log('Callback URL:', `${RAILWAY_URL}/api/gen-api-callback`);
  console.log('\n---\n');

  const callbackUrl = `${RAILWAY_URL}/api/gen-api-callback`;
  
  // Простой промпт для теста
  const prompt = 'Фотография девушки в студии, красивое лицо, улыбка, 4К, реалистичная';

  const requestData = {
    translate_input: true,
    prompt: prompt,
    callback_url: callbackUrl,
    width: 992,
    height: 992,
    num_images: 1,
    model: 'turbo',
    output_format: 'png',
    num_inference_steps: 8,
    enable_safety_checker: true,
    acceleration: 'high',
    enable_prompt_expansion: false
  };

  console.log('📤 Создание задачи генерации...');
  console.log('Промпт:', prompt);
  console.log('\n');

  try {
    const createResponse = await axios.post(
      `${GEN_API_BASE}/networks/z-image`,
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
    console.log('Ожидаемое время генерации: 30-60 секунд');
    console.log('\n💡 Для проверки callback откройте логи Railway или проверьте эндпоинт');

  } catch (error) {
    console.error('❌ Ошибка:', error.response?.status);
    if (error.response?.data) {
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Message:', error.message);
    }
  }
}

testGenApiWithRealRailway();

