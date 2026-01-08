import axios from 'axios';

const BASE_URL = 'https://backaibookver2-production.up.railway.app';
const TEST_DEVICE_ID = `test-device-${Date.now()}`;

console.log('🧪 Тест создания платежа с детальным логированием\n');
console.log(`Base URL: ${BASE_URL}`);
console.log(`Device ID: ${TEST_DEVICE_ID}\n`);

async function testPayment() {
  try {
    console.log('📤 Создание платежа...\n');
    const response = await axios.post(`${BASE_URL}/api/payments/create`, {
      deviceId: TEST_DEVICE_ID,
      tierId: 'tier3'
    }, {
      timeout: 30000
    });
    
    console.log('✅ Ответ от сервера:');
    console.log('Status:', response.status);
    console.log('Full response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('\n✅ Платеж создан успешно!');
      console.log('Payment ID:', response.data.paymentId);
      console.log('Payment URL:', response.data.paymentUrl || '⚠️  UNDEFINED!');
      console.log('Amount:', response.data.amount, 'RUB');
      console.log('Tokens:', response.data.tokensAmount);
      
      if (!response.data.paymentUrl) {
        console.log('\n❌ ПРОБЛЕМА: Payment URL не получен!');
        console.log('Проверьте логи Railway на наличие полного ответа от Т-банк');
      } else {
        console.log('\n✅ Payment URL получен, можно открыть в браузере');
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
    } else {
      console.error('Error:', error.message);
    }
  }
}

testPayment();

