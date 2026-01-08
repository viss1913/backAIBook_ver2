import axios from 'axios';

import dotenv from 'dotenv';
dotenv.config();

const GEN_API_KEY = process.env.GEN_API_KEY || 'YOUR_GEN_API_KEY_HERE';
const GEN_API_BASE = 'https://api.gen-api.ru/api/v1';

/**
 * Простой тест - создаем задачу и смотрим ответ
 */
async function testGenApiSimple() {
  console.log('=== Простой тест Gen-API ===\n');

  const requestData = {
    prompt: 'Фотография девушки в студии, красивое лицо, улыбка, 4К, реалистичная'
  };

  try {
    console.log('📤 Отправка запроса...');
    const response = await axios.post(
      `${GEN_API_BASE}/networks/sdxl`,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${GEN_API_KEY}`
        },
        timeout: 180000 // 3 минуты - возможно, это long-polling
      }
    );

    console.log('✅ Ответ получен!');
    console.log('\n=== Полный ответ ===');
    console.log(JSON.stringify(response.data, null, 2));

    // Проверяем структуру ответа
    if (response.data.status === 'success') {
      console.log('\n✅ Генерация завершена успешно!');
      
      if (response.data.output) {
        console.log('\n📸 Output:', Object.keys(response.data.output));
        
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
    } else {
      console.log('\n📋 Статус:', response.data.status);
      console.log('Request ID:', response.data.request_id);
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.response?.status);
    if (error.response?.data) {
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Message:', error.message);
      if (error.message.includes('timeout')) {
        console.log('\n⚠️  Таймаут - возможно, это long-polling и нужно ждать дольше');
      }
    }
  }
}

testGenApiSimple();













