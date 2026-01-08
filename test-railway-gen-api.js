/**
 * Тест генерации изображения через Gen-API на Railway
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const RAILWAY_URL = 'https://backaibookver2-production.up.railway.app';

// Тестовые данные
const testData = {
  bookTitle: 'Гарри Поттер и философский камень',
  author: 'Дж. К. Роулинг',
  textChunk: 'Гарри Поттер сидел в Большом зале Хогвартса. Плавающие свечи освещали готические своды, а на столах стояли золотые тарелки, наполненные магической едой. В воздухе витала атмосфера волшебства и таинственности.'
};

console.log('=== Тест Gen-API на Railway ===\n');
console.log('URL:', RAILWAY_URL);
console.log('Провайдер: genapi');
console.log('\nТестовые данные:');
console.log('Книга:', testData.bookTitle);
console.log('Автор:', testData.author);
console.log('Фрагмент:', testData.textChunk.substring(0, 100) + '...');
console.log('\n---\n');

const startTime = Date.now();

axios.post(
  `${RAILWAY_URL}/api/generate-image?provider=genapi`,
  testData,
  {
    timeout: 120000, // 2 минуты (Gen-API может занять время)
    headers: {
      'Content-Type': 'application/json'
    }
  }
)
.then(response => {
  const duration = Date.now() - startTime;
  console.log(`\n✅ УСПЕХ! Время выполнения: ${(duration / 1000).toFixed(2)} секунд\n`);
  
  console.log('📋 Полный ответ:');
  console.log(JSON.stringify(response.data, null, 2));
  
  if (response.data.success) {
    console.log('\n✅ Генерация успешна!');
    console.log('📝 Промпт:', response.data.promptUsed);
    console.log('🖼️  URL изображения:', response.data.imageUrl);
    
    if (response.data.imageUrl) {
      if (response.data.imageUrl.startsWith('http')) {
        console.log('\n✅ URL валидный, можно загрузить изображение');
      } else if (response.data.imageUrl.startsWith('data:')) {
        console.log('\n✅ Base64 изображение получено');
      }
    }
  } else {
    console.log('\n❌ Ошибка:', response.data.error);
  }
})
.catch(error => {
  const duration = Date.now() - startTime;
  console.error('\n❌ Ошибка запроса:\n');
  
  if (error.response) {
    console.error('HTTP статус:', error.response.status);
    console.error('Данные ответа:', JSON.stringify(error.response.data, null, 2));
    console.error('Заголовки:', JSON.stringify(error.response.headers, null, 2));
  } else if (error.request) {
    console.error('Запрос отправлен, но ответа нет');
    console.error('Проверьте URL:', RAILWAY_URL);
    console.error('Проверьте, что сервер запущен на Railway');
  } else {
    console.error('Ошибка:', error.message);
  }
  
  if (error.code === 'ECONNABORTED') {
    console.error('\n⚠️  Превышено время ожидания (timeout)');
    console.error('Gen-API может занимать 30-90 секунд');
  }
  
  console.error(`\n⏱️  Время до ошибки: ${(duration / 1000).toFixed(2)} секунд`);
  process.exit(1);
});












