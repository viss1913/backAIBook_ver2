/**
 * Тест для Railway API
 */
import axios from 'axios';

const BASE_URL = 'https://backaibookver2-production.up.railway.app';

const testData = {
  bookTitle: "Гарри Поттер и философский камень",
  author: "Джоан Роулинг",
  textChunk: "Гарри никогда не видел ничего более странного и прекрасного. Он стоял на пороге огромного зала с высоким потолком, который невозможно было разглядеть из-за темноты. Тысячи и тысячи свечей парили в воздухе над четырьмя длинными столами, за которыми сидели остальные ученики, их лица освещались призрачным светом свечей. Еще выше были нарисованы звезды на потолке. Это было волшебно."
};

console.log('🧪 Тестирование Railway API...\n');
console.log('📖 Книга:', testData.bookTitle);
console.log('✍️  Автор:', testData.author);
console.log('\nОтправка запроса...\n');

const startTime = Date.now();

axios.post(`${BASE_URL}/api/generate-image`, testData, {
  timeout: 90000, // 90 секунд
  headers: {
    'Content-Type': 'application/json; charset=utf-8'
  }
})
.then(response => {
  const duration = Date.now() - startTime;
  console.log('✅ УСПЕХ! Изображение сгенерировано!\n');
  console.log(`⏱️  Время выполнения: ${(duration / 1000).toFixed(2)} секунд\n`);
  
  if (response.data.success) {
    console.log('📝 Промпт, использованный для генерации:');
    console.log(response.data.promptUsed);
    console.log('\n🖼️  URL изображения:');
    console.log(response.data.imageUrl);
    console.log('\n📋 Полный ответ:');
    console.log(JSON.stringify(response.data, null, 2));
  } else {
    console.log('❌ Ошибка:', response.data.error);
  }
})
.catch(error => {
  const duration = Date.now() - startTime;
  console.error('\n❌ Ошибка запроса:\n');
  
  if (error.response) {
    console.error('Статус:', error.response.status);
    console.error('Данные ответа:', JSON.stringify(error.response.data, null, 2));
    console.error('Заголовки:', JSON.stringify(error.response.headers, null, 2));
  } else if (error.request) {
    console.error('Запрос отправлен, но ответа нет');
    console.error('Проверьте URL:', BASE_URL);
  } else {
    console.error('Ошибка:', error.message);
  }
  
  console.error(`\n⏱️  Время до ошибки: ${(duration / 1000).toFixed(2)} секунд`);
});

