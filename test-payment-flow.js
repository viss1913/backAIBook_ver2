import axios from 'axios';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_DEVICE_ID = `test-device-${Date.now()}`;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

console.log('💳 Тестирование полного цикла платежа\n');
console.log(`Base URL: ${BASE_URL}`);
console.log(`Test Device ID: ${TEST_DEVICE_ID}\n`);

async function main() {
  try {
    // 1. Получаем баланс
    console.log('📊 Шаг 1: Проверка баланса...');
    const balanceResponse = await axios.get(`${BASE_URL}/api/payments/balance`, {
      params: { deviceId: TEST_DEVICE_ID }
    });
    console.log(`Текущий баланс: ${balanceResponse.data.balance} токенов\n`);

    // 2. Получаем тарифы
    console.log('💰 Шаг 2: Получение тарифов...');
    const pricingResponse = await axios.get(`${BASE_URL}/api/payments/pricing`);
    const pricing = pricingResponse.data.pricing;
    
    console.log('Доступные тарифы:');
    pricing.forEach((tier, index) => {
      console.log(`  ${index + 1}. ${tier.label} - ${tier.price} ₽ (${tier.tokens} токенов)`);
    });

    // 3. Выбираем тариф
    const tierChoice = await question('\nВыберите тариф (1-3) или введите номер: ');
    const selectedTier = pricing[parseInt(tierChoice) - 1] || pricing.find(t => t.id === tierChoice);
    
    if (!selectedTier) {
      console.log('❌ Неверный выбор тарифа');
      rl.close();
      return;
    }

    console.log(`\nВыбран тариф: ${selectedTier.label} за ${selectedTier.price} ₽\n`);

    // 4. Создаем платеж
    console.log('💳 Шаг 3: Создание платежа...');
    const paymentResponse = await axios.post(`${BASE_URL}/api/payments/create`, {
      deviceId: TEST_DEVICE_ID,
      tierId: selectedTier.id
    });

    if (!paymentResponse.data.success) {
      console.log(`❌ Ошибка создания платежа: ${paymentResponse.data.error}`);
      rl.close();
      return;
    }

    const payment = paymentResponse.data;
    console.log('✅ Платеж создан!');
    console.log(`   Payment ID: ${payment.paymentId}`);
    console.log(`   Payment URL: ${payment.paymentUrl}\n`);

    // 5. Инструкции
    console.log('📋 Инструкции:');
    console.log('1. Откройте Payment URL в браузере');
    console.log('2. Выполните тестовый платеж (используйте тестовые данные карты)');
    console.log('3. После оплаты вернитесь сюда и нажмите Enter\n');

    await question('Нажмите Enter после завершения оплаты... ');

    // 6. Проверяем статус
    console.log('\n🔍 Шаг 4: Проверка статуса платежа...');
    
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const statusResponse = await axios.get(`${BASE_URL}/api/payments/status/${payment.paymentId}`);
      const paymentStatus = statusResponse.data.payment;
      
      console.log(`Попытка ${attempts + 1}/${maxAttempts}: Статус - ${paymentStatus.status}`);
      
      if (paymentStatus.status === 'completed') {
        console.log('✅ Платеж успешно завершен!');
        break;
      } else if (paymentStatus.status === 'failed' || paymentStatus.status === 'cancelled') {
        console.log(`❌ Платеж завершился со статусом: ${paymentStatus.status}`);
        break;
      }
      
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Ждем 2 секунды
      }
    }

    // 7. Проверяем баланс после платежа
    console.log('\n📊 Шаг 5: Проверка баланса после платежа...');
    const newBalanceResponse = await axios.get(`${BASE_URL}/api/payments/balance`, {
      params: { deviceId: TEST_DEVICE_ID }
    });
    const newBalance = newBalanceResponse.data.balance;
    
    console.log(`Новый баланс: ${newBalance} токенов`);
    const expectedBalance = balanceResponse.data.balance + selectedTier.tokens;
    
    if (newBalance === expectedBalance) {
      console.log(`✅ Баланс обновлен правильно: ${balanceResponse.data.balance} → ${newBalance}`);
    } else {
      console.log(`⚠️  Баланс: ${balanceResponse.data.balance} → ${newBalance} (ожидалось ${expectedBalance})`);
    }

    // 8. История транзакций
    console.log('\n📜 Шаг 6: История транзакций...');
    const transactionsResponse = await axios.get(`${BASE_URL}/api/payments/transactions`, {
      params: { deviceId: TEST_DEVICE_ID, limit: 5 }
    });
    
    if (transactionsResponse.data.success && transactionsResponse.data.transactions.length > 0) {
      console.log('Последние транзакции:');
      transactionsResponse.data.transactions.forEach(tx => {
        const sign = tx.amount > 0 ? '+' : '';
        const date = new Date(tx.created_at).toLocaleString('ru-RU');
        console.log(`  ${date}: ${sign}${tx.amount} токенов - ${tx.type} - ${tx.description || 'N/A'}`);
      });
    }

    console.log('\n✨ Тестирование завершено!');

  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
    if (error.response?.data?.details) {
      console.error('Детали:', error.response.data.details);
    }
  } finally {
    rl.close();
  }
}

main();



