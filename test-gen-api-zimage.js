import axios from 'axios';

import dotenv from 'dotenv';
dotenv.config();

const GEN_API_KEY = process.env.GEN_API_KEY || 'YOUR_GEN_API_KEY_HERE';
const GEN_API_BASE = 'https://api.gen-api.ru/api/v1';

/**
 * Тест Gen-API модели z-image
 */
async function testGenApiZImage() {
  console.log('=== Тест Gen-API (z-image) ===\n');

  // Для теста используем простой промпт
  const prompt = 'Гиперреалистичный, крупный портрет старейшины племени из долины Омо, украшенного сложными узорами из белой глины и головным убором из сухих цветов, семенных коробочек и ржавых крышек от бутылок. Фокус невероятно чёткий на текстуре кожи, виден каждый пор, морщина и шрам, рассказывающий историю выживания. Фон — размытое, дымное пространство хижины, с тёплым отблеском огня от очага, отражающимся в тёмных, глубоких, выразительных глазах персонажа. Снято на камеру Leica M6 с эстетикой зерна фотоплёнки Kodak Portra 400.';

  // URL вашего Railway приложения (замените на реальный)
  const RAILWAY_URL = process.env.RAILWAY_URL || 'https://your-app-name.railway.app';
  const callbackUrl = `${RAILWAY_URL}/api/gen-api-callback`;

  // Параметры запроса
  const params = {
    translate_input: true,
    prompt: prompt,
    strength: 1,
    width: 992,
    height: 992,
    num_images: 1,
    model: 'turbo',
    output_format: 'png',
    num_inference_steps: 8,
    enable_safety_checker: true,
    acceleration: 'none',
    enable_prompt_expansion: false,
    callback_url: callbackUrl // Используем callback на Railway
  };

  console.log('Callback URL:', callbackUrl);
  console.log('⚠️  Убедитесь, что заменили RAILWAY_URL на ваш реальный URL!\n');

  console.log('📤 Отправка GET запроса...');
  console.log('Промпт (первые 100 символов):', prompt.substring(0, 100) + '...');
  console.log('Параметры:', JSON.stringify(params, null, 2));
  console.log('\n');

  try {
    // Убираем callback_url из параметров, если null
    const requestData = { ...params };
    if (requestData.callback_url === null) {
      delete requestData.callback_url;
    }

    // POST запрос (как в примере с unirest, но используем POST)
    const response = await axios.post(
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

    console.log('✅ Ответ получен!');
    console.log('\n=== Полный ответ ===');
    console.log(JSON.stringify(response.data, null, 2));

    // Анализ ответа
    if (response.data.request_id) {
      console.log('\n📋 Request ID:', response.data.request_id);
      console.log('Status:', response.data.status);
      
      if (response.data.status === 'success' || response.data.status === 'completed') {
        console.log('\n✅ Генерация завершена!');
        
        if (response.data.output) {
          console.log('Output:', Object.keys(response.data.output));
          
          // Проверяем изображение
          if (response.data.output.image) {
            const image = response.data.output.image;
            if (typeof image === 'string') {
              if (image.startsWith('http')) {
                console.log('✅ URL изображения:', image);
              } else if (image.startsWith('data:')) {
                console.log('✅ Base64 изображение получено');
                console.log('Длина:', image.length, 'символов');
              }
            }
          }
          if (response.data.output.image_url) {
            console.log('✅ URL изображения:', response.data.output.image_url);
          }
        }
      } else if (response.data.status === 'starting' || response.data.status === 'processing') {
        console.log('\n⏳ Генерация началась!');
        console.log('Callback будет отправлен на:', callbackUrl);
        console.log('Проверьте логи сервера на Railway для получения результата');
        console.log('Ожидаемое время генерации: 30-60 секунд');
      }
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.response?.status);
    if (error.response?.data) {
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Message:', error.message);
    }
  }
}

testGenApiZImage();

