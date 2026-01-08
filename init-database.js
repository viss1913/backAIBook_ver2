import axios from 'axios';

const BASE_URL = 'https://backaibookver2-production.up.railway.app';

console.log('🔧 Инициализация базы данных через API...\n');
console.log(`URL: ${BASE_URL}/admin/init-db\n`);

async function initDatabase() {
  try {
    console.log('Отправка запроса...');
    const response = await axios.post(`${BASE_URL}/admin/init-db`);
    
    if (response.data.success) {
      console.log('✅ Успех!');
      console.log(`   ${response.data.message}`);
      console.log(`   Время: ${response.data.timestamp}`);
      console.log('\n✨ Таблицы созданы! Теперь можно тестировать платежи.');
    } else {
      console.error('❌ Ошибка:', response.data.error);
    }
  } catch (error) {
    console.error('❌ Ошибка запроса:');
    if (error.response) {
      console.error(`   Статус: ${error.response.status}`);
      console.error(`   Ошибка: ${error.response.data.error || JSON.stringify(error.response.data)}`);
      if (error.response.data.stack) {
        console.error('\n   Stack trace:');
        console.error(error.response.data.stack);
      }
    } else {
      console.error(`   ${error.message}`);
    }
    process.exit(1);
  }
}

// Ждем немного перед вызовом (чтобы Railway успел задеплоить)
console.log('⏳ Ждем 10 секунд для деплоя на Railway...\n');
setTimeout(() => {
  initDatabase();
}, 10000);



