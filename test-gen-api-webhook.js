import axios from 'axios';

import dotenv from 'dotenv';
dotenv.config();

const GEN_API_KEY = process.env.GEN_API_KEY || 'YOUR_GEN_API_KEY_HERE';
const GEN_API_BASE = 'https://api.gen-api.ru/api/v1';

/**
 * Тест с использованием webhook.site для получения callback
 */
async function testGenApiWithWebhook() {
  console.log('=== Тест Gen-API с webhook.site ===\n');

  // Получаем временный webhook URL от webhook.site
  try {
    console.log('📡 Получение временного webhook URL...');
    const webhookResponse = await axios.get('https://webhook.site/token');
    const webhookToken = webhookResponse.data.uuid;
    const callbackUrl = `https://webhook.site/${webhookToken}`;
    
    console.log('✅ Webhook URL получен:', callbackUrl);
    console.log('\n---\n');

    // Создаем задачу с callback_url
    console.log('📤 Создание задачи генерации...');
    const requestData = {
      prompt: 'Фотография девушки в студии, красивое лицо, улыбка, 4К, реалистичная',
      callback_url: callbackUrl
    };

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
    
    console.log('\n---\n');
    console.log('⏳ Ожидаем callback на webhook.site...');
    console.log(`Проверяем: https://webhook.site/#/${webhookToken}`);
    console.log('\nМожно открыть эту ссылку в браузере, чтобы увидеть callback в реальном времени');
    console.log('Или подождите 30-60 секунд и проверим результат...\n');

    // Ждем и проверяем webhook
    await new Promise(resolve => setTimeout(resolve, 60000)); // 60 секунд

    console.log('Проверяем полученные запросы...');
    const requestsResponse = await axios.get(`https://webhook.site/token/${webhookToken}/requests`);
    
    if (requestsResponse.data && requestsResponse.data.data && requestsResponse.data.data.length > 0) {
      const lastRequest = requestsResponse.data.data[0];
      console.log('\n✅ Callback получен!');
      console.log('Request:', JSON.stringify(lastRequest, null, 2));
      
      // Парсим body callback
      if (lastRequest.body) {
        try {
          const callbackData = typeof lastRequest.body === 'string' 
            ? JSON.parse(lastRequest.body) 
            : lastRequest.body;
          
          console.log('\n=== Callback Data ===');
          console.log(JSON.stringify(callbackData, null, 2));
          
          if (callbackData.status === 'success' && callbackData.output) {
            console.log('\n✅ Генерация завершена успешно!');
            
            if (callbackData.output.image) {
              const image = callbackData.output.image;
              if (typeof image === 'string') {
                if (image.startsWith('http')) {
                  console.log('✅ URL изображения:', image);
                } else if (image.startsWith('data:')) {
                  console.log('✅ Base64 изображение получено');
                  console.log('Длина:', image.length, 'символов');
                }
              }
            }
            if (callbackData.output.image_url) {
              console.log('✅ URL изображения:', callbackData.output.image_url);
            }
          }
        } catch (e) {
          console.log('Body (raw):', lastRequest.body);
        }
      }
    } else {
      console.log('⚠️  Callback еще не получен. Проверьте вручную:');
      console.log(`https://webhook.site/#/${webhookToken}`);
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

testGenApiWithWebhook();

