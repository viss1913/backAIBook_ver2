import axios from 'axios';

const GETIMG_API_KEY = 'key-2drYwHn9u6ml1W6VTT9Cv4Z4P1sDW2bsCf4AiXhSRdDOHhXRK0fc4tv7sFzJ87OeaVkat3coSafpH9UKPqDOlXHKXHVdenq4';
const GETIMG_API_URL = 'https://api.getimg.ai/v1';

/**
 * Прямой тест GetImg API
 */
async function testGetImgDirect() {
  console.log('=== Прямой тест GetImg API ===\n');

  const prompt = 'A person reading a book "War and Peace" by Leo Tolstoy. They are standing on a balcony watching the sunset. The sun slowly descends below the horizon, painting the sky in crimson and golden tones. Peaceful atmosphere, detailed artistic illustration.';

  // Упрощенный запрос - только обязательные параметры
  const requestData = {
    prompt: prompt
  };

  console.log('Модель: seedream-v4');
  console.log('Промпт:', prompt.substring(0, 100) + '...');
  console.log('Параметры:', JSON.stringify(requestData, null, 2));
  console.log('\nОтправляю запрос...\n');

  try {
    const response = await axios.post(
      `${GETIMG_API_URL}/seedream-v4/text-to-image`,
      requestData,
      {
        headers: {
          'Authorization': `Bearer ${GETIMG_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 180000 // 3 минуты
      }
    );

    console.log('✅ Ответ получен!');
    console.log('\n=== Структура ответа ===');
    console.log('Ключи в response.data:', Object.keys(response.data));
    console.log('\n=== Полный ответ ===');
    console.log(JSON.stringify(response.data, null, 2));

    // Проверяем разные возможные форматы ответа
    if (response.data.image) {
      console.log('\n📸 Изображение найдено в поле "image" (base64)');
      console.log('Длина base64:', response.data.image.length, 'символов');
    } else if (response.data.url) {
      console.log('\n📸 Изображение найдено в поле "url":', response.data.url);
    } else if (response.data.data && response.data.data[0]) {
      console.log('\n📸 Изображение найдено в поле "data[0]":');
      console.log(JSON.stringify(response.data.data[0], null, 2));
    } else {
      console.log('\n⚠️ Неизвестный формат ответа');
    }

  } catch (error) {
    console.error('❌ Ошибка при запросе:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

testGetImgDirect();

