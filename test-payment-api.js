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

console.log('💳 Тестирование оплаты через Т-банк API\n');
console.log(`Base URL: ${BASE_URL}`);
console.log(`Test Device ID: ${TEST_DEVICE_ID}\n`);

async function testPaymentFlow() {
  try {
    // Шаг 1: Получаем тарифы
    console.log('📋 Шаг 1: Получение тарифов...\n');
    const pricingResponse = await axios.get(`${BASE_URL}/api/payments/pricing`);
    
    if (!pricingResponse.data.success) {
      console.error('❌ Ошибка получения тарифов:', pricingResponse.data.error);
      rl.close();
      return;
    }

    const pricing = pricingResponse.data.pricing;
    console.log('Доступные тарифы:');
    pricing.forEach((tier, index) => {
      const popular = tier.popular ? ' ⭐ (рекомендуется)' : '';
      console.log(`  ${index + 1}. ${tier.label} - ${tier.price} ₽ (${tier.tokens} токенов)${popular}`);
    });

    // Шаг 2: Выбираем тариф
    console.log('\n');
    const tierChoice = await question('Выберите тариф (1-3) или введите tierId (tier1/tier2/tier3): ');
    
    let selectedTier;
    if (['1', '2', '3'].includes(tierChoice)) {
      selectedTier = pricing[parseInt(tierChoice) - 1];
    } else {
      selectedTier = pricing.find(t => t.id === tierChoice);
    }
    
    if (!selectedTier) {
      console.log('❌ Неверный выбор тарифа');
      rl.close();
      return;
    }

    console.log(`\n✅ Выбран тариф: ${selectedTier.label} за ${selectedTier.price} ₽\n`);

    // Шаг 3: Получаем текущий баланс
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

    // Шаг 4: Создаем платеж
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
      rl.close();
      return;
    }

    const payment = paymentResponse.data;
    
    console.log('✅ Платеж успешно создан!\n');
    console.log('📝 Детали платежа:');
    console.log(`   Payment ID: ${payment.paymentId}`);
    console.log(`   Order ID: ${payment.orderId}`);
    console.log(`   Сумма: ${payment.amount} ₽`);
    console.log(`   Токены: ${payment.tokensAmount}`);
    console.log(`   Статус: ${payment.status}\n`);
    
    console.log('🔗 Payment URL:');
    console.log(`   ${payment.paymentUrl}\n`);
    
    console.log('='.repeat(70));
    console.log('📋 ИНСТРУКЦИИ ДЛЯ ТЕСТИРОВАНИЯ ОПЛАТЫ:');
    console.log('='.repeat(70));
    console.log('1. Скопируйте Payment URL выше');
    console.log('2. Откройте его в браузере');
    console.log('3. Выполните тестовый платеж (используйте тестовые данные карты)');
    console.log('4. После оплаты вернитесь сюда и нажмите Enter');
    console.log('='.repeat(70));
    console.log('\n');

    await question('⏳ Нажмите Enter после завершения оплаты (или Ctrl+C для выхода)... ');

    // Шаг 5: Проверяем статус платежа
    console.log('\n🔍 Шаг 4: Проверка статуса платежа...\n');
    
    let attempts = 0;
    const maxAttempts = 15;
    let finalStatus = null;
    
    while (attempts < maxAttempts) {
      try {
        const statusResponse = await axios.get(`${BASE_URL}/api/payments/status/${payment.paymentId}`);
        const paymentStatus = statusResponse.data.payment;
        
        console.log(`Попытка ${attempts + 1}/${maxAttempts}: Статус - ${paymentStatus.status}`);
        
        finalStatus = paymentStatus.status;
        
        if (paymentStatus.status === 'completed') {
          console.log('\n✅ Платеж успешно завершен!');
          break;
        } else if (paymentStatus.status === 'failed') {
          console.log('\n❌ Платеж завершился с ошибкой');
          break;
        } else if (paymentStatus.status === 'cancelled') {
          console.log('\n⚠️  Платеж был отменен');
          break;
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Ждем 2 секунды
        }
      } catch (error) {
        console.error('Ошибка проверки статуса:', error.response?.data?.error || error.message);
        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    if (finalStatus === 'completed') {
      // Шаг 6: Проверяем баланс после платежа
      console.log('\n📊 Шаг 5: Проверка баланса после платежа...\n');
      try {
        const newBalanceResponse = await axios.get(`${BASE_URL}/api/payments/balance`, {
          params: { deviceId: TEST_DEVICE_ID }
        });
        
        if (newBalanceResponse.data.success) {
          const newBalance = newBalanceResponse.data.balance;
          console.log(`✅ Новый баланс: ${newBalance} токенов`);
          console.log(`   (Должно быть начислено ${selectedTier.tokens} токенов)\n`);
        }
      } catch (error) {
        console.log('⚠️  Не удалось проверить баланс (возможно БД не настроена)');
      }

      // Шаг 7: История транзакций
      console.log('📜 Шаг 6: История транзакций...\n');
      try {
        const transactionsResponse = await axios.get(`${BASE_URL}/api/payments/transactions`, {
          params: { deviceId: TEST_DEVICE_ID, limit: 5 }
        });
        
        if (transactionsResponse.data.success && transactionsResponse.data.transactions.length > 0) {
          console.log('Последние транзакции:');
          transactionsResponse.data.transactions.slice(0, 3).forEach(tx => {
            const sign = tx.amount > 0 ? '+' : '';
            const date = new Date(tx.created_at).toLocaleString('ru-RU');
            console.log(`   ${date}: ${sign}${tx.amount} токенов - ${tx.type}`);
            if (tx.description) {
              console.log(`      ${tx.description}`);
            }
          });
        }
      } catch (error) {
        console.log('⚠️  Не удалось получить историю транзакций');
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✨ Тестирование завершено!');
    console.log('='.repeat(70));
    console.log(`\n💡 Для повторной проверки статуса используйте:`);
    console.log(`   curl "${BASE_URL}/api/payments/status/${payment.paymentId}"`);
    console.log(`\n💡 Или через браузер:`);
    console.log(`   ${BASE_URL}/api/payments/status/${payment.paymentId}\n`);

  } catch (error) {
    console.error('\n❌ Критическая ошибка:', error.message);
    if (error.response) {
      console.error('   Статус:', error.response.status);
      console.error('   Данные:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.config) {
      console.error('   URL:', error.config.url);
      console.error('   Method:', error.config.method);
    }
  } finally {
    rl.close();
  }
}

// Запуск
testPaymentFlow();



