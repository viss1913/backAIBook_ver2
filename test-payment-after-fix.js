import axios from 'axios';

const BASE_URL = 'https://backaibookver2-production.up.railway.app';
const TEST_DEVICE_ID = `test-device-${Date.now()}`;

console.log('🧪 Тест создания платежа после исправления API\n');
console.log(`Base URL: ${BASE_URL}`);
console.log(`Device ID: ${TEST_DEVICE_ID}\n`);

async function testPayment() {
  try {
    console.log('📤 Создание платежа (tier1: 1000 токенов за 300 руб)...\n');
    
    const startTime = Date.now();
    const response = await axios.post(`${BASE_URL}/api/payments/create`, {
      deviceId: TEST_DEVICE_ID,
      tierId: 'tier1'
    }, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Ответ получен за ${(duration / 1000).toFixed(2)} секунд\n`);
    console.log('Status:', response.status);
    console.log('\n📋 Полный ответ:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('\n✅ Платеж создан успешно!');
      console.log('Payment ID:', response.data.paymentId);
      console.log('Payment URL:', response.data.paymentUrl || '⚠️  UNDEFINED!');
      console.log('Amount:', response.data.amount, 'RUB');
      console.log('Tokens:', response.data.tokensAmount);
      
      if (response.data.paymentUrl) {
        console.log('\n🌐 Откройте Payment URL в браузере:');
        console.log(response.data.paymentUrl);
      } else {
        console.log('\n❌ ПРОБЛЕМА: Payment URL не получен!');
        console.log('Проверьте логи Railway на наличие ошибок от Т-банк API');
      }
    } else {
      console.log('\n❌ Ошибка:', response.data.error);
      if (response.data.details) {
        console.log('Детали:', response.data.details);
      }
    }
  } catch (error) {
    console.error('\n❌ Ошибка запроса:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('Запрос отправлен, но ответа нет');
      console.error('Возможно, сервер еще перезапускается. Подождите 1-2 минуты и попробуйте снова.');
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Ждем 5 секунд перед тестом (на случай если сервер еще перезапускается)
console.log('⏳ Ожидание 5 секунд перед тестом...\n');
setTimeout(() => {
  testPayment();
}, 5000);

