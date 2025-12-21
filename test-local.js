/**
 * Быстрый тест для локального сервера
 */
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'http://localhost:3000';

const testData = {
  bookTitle: "Гарри Поттер и философский камень",
  author: "Джоан Роулинг",
  textChunk: "Гарри никогда не видел ничего более странного и прекрасного. Он стоял на пороге огромного зала с высоким потолком, который невозможно было разглядеть из-за темноты. Тысячи и тысячи свечей парили в воздухе над четырьмя длинными столами, за которыми сидели остальные ученики, их лица освещались призрачным светом свечей. Еще выше были нарисованы звезды на потолке. Это было волшебно."
};

console.log('🧪 Тестирование локального API...\n');
console.log('Данные:', JSON.stringify(testData, null, 2));
console.log(`\nURL: ${BASE_URL}/api/generate-image\n`);

axios.post(`${BASE_URL}/api/generate-image`, testData, {
  timeout: 60000
})
.then(response => {
  console.log('✅ Успех!');
  console.log('\nОтвет:');
  console.log(JSON.stringify(response.data, null, 2));
  
  if (response.data.success && response.data.imageUrl) {
    console.log(`\n🖼️  URL изображения: ${response.data.imageUrl}`);
  }
})
.catch(error => {
  console.error('\n❌ Ошибка:');
  if (error.response) {
    console.error('Статус:', error.response.status);
    console.error('Ответ:', JSON.stringify(error.response.data, null, 2));
  } else {
    console.error('Ошибка:', error.message);
    console.error('\n💡 Убедитесь, что сервер запущен: npm run dev');
  }
});


