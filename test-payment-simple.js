import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_DEVICE_ID = `test-device-${Date.now()}`;

// Получаем tierId из аргументов командной строки или используем tier1 по умолчанию
const tierId = process.argv[2] || 'tier1';

console.log('💳 Тестирование оплаты через Т-банк API\n');
console.log(`Base URL: ${BASE_URL}`);
console.log(`Test Device ID: ${TEST_DEVICE_ID}`);
console.log(`Tier ID: ${tierId}\n`);

async function testPayment() {
  try {
    // Шаг 1: Получаем тарифы
    console.log('📋 Шаг 1: Получение тарифов...\n');
    const pricingResponse = await axios.get(`${BASE_URL}/api/payments/pricing`);
    
    if (!pricingResponse.data.success) {
      console.error('❌ Ошибка получения тарифов:', pricingResponse.data.error);
      return;
    }

    const pricing = pricingResponse.data.pricing;
    const selectedTier = pricing.find(t => t.id === tierId);
    
    if (!selectedTier) {
      console.error(`❌ Тариф "${tierId}" не найден`);
      console.log('\nДоступные тарифы:');
      pricing.forEach(tier => {
        console.log(`  - ${tier.id}: ${tier.label} - ${tier.price} ₽`);
      });
      return;
    }

    console.log(`✅ Выбран тариф: ${selectedTier.label} за ${selectedTier.price} ₽\n`);

    // Шаг 2: Получаем текущий баланс (если БД настроена)
    console.log('📊 Шаг 2: Проверка текущего баланса...');
    try {
      const balanceResponse = await axios.get(`${BASE_URL}/api/payments/balance`, {
        params: { deviceId: TEST_DEVICE_ID }
      });
      if (balanceResponse.data.success) {
        console.log(`   Текущий баланс: ${balanceResponse.data.balance} токенов\n`);
      }
    } catch (error) {
      console.log('   (Баланс недоступен, возможно БД не настроена)\n');
    }

    // Шаг 3: Создаем платеж
    console.log('💳 Шаг 3: Создание платежа...\n');
    const paymentResponse = await axios.post(`${BASE_URL}/api/payments/create`, {
      deviceId: TEST_DEVICE_ID,
      tierId: selectedTier.id
    });

    if (!paymentResponse.data.success) {
      console.error('❌ Ошибка создания платежа:', paymentResponse.data.error);
      if (paymentResponse.data.details) {
        console.error('   Детали:', paymentResponse.data.details);
      }
      return;
    }

    const payment = paymentResponse.data;
    
    console.log('✅ Платеж успешно создан!\n');
    console.log('='.repeat(70));
    console.log('📝 ДЕТАЛИ ПЛАТЕЖА:');
    console.log('='.repeat(70));
    console.log(`Payment ID: ${payment.paymentId}`);
    console.log(`Order ID: ${payment.orderId}`);
    console.log(`Сумма: ${payment.amount} ₽`);
    console.log(`Токены: ${payment.tokensAmount}`);
    console.log(`Статус: ${payment.status}`);
    console.log('='.repeat(70));
    console.log('\n🔗 PAYMENT URL (скопируйте и откройте в браузере):');
    console.log('='.repeat(70));
    console.log(payment.paymentUrl);
    console.log('='.repeat(70));
    
    console.log('\n📋 ИНСТРУКЦИИ:');
    console.log('1. Скопируйте Payment URL выше');
    console.log('2. Откройте его в браузере');
    console.log('3. Выполните тестовый платеж');
    console.log('4. После оплаты проверьте статус командой:');
    console.log(`\n   node -e "import('./test-check-status.js').then(m => m.checkStatus('${payment.paymentId}'))"`);
    console.log(`\n   Или через браузер:`);
    console.log(`   ${BASE_URL}/api/payments/status/${payment.paymentId}`);
    console.log('\n💡 Для проверки статуса вручную:');
    console.log(`   curl "${BASE_URL}/api/payments/status/${payment.paymentId}"`);
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Критическая ошибка:', error.message);
    if (error.response) {
      console.error('   Статус:', error.response.status);
      console.error('   Данные:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.config) {
      console.error('   URL:', error.config.url);
    }
  }
}

testPayment();



