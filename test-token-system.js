import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_DEVICE_ID = `test-device-${Date.now()}`;

console.log('🧪 Тестирование системы токенов\n');
console.log(`Base URL: ${BASE_URL}`);
console.log(`Test Device ID: ${TEST_DEVICE_ID}\n`);

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function logSuccess(message) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function logError(message) {
  console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function logInfo(message) {
  console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

async function testGetBalance() {
  console.log('\n📊 Тест 1: Получение баланса токенов');
  try {
    const response = await axios.get(`${BASE_URL}/api/payments/balance`, {
      params: { deviceId: TEST_DEVICE_ID }
    });
    
    if (response.data.success) {
      logSuccess(`Баланс: ${response.data.balance} токенов`);
      return response.data.balance;
    } else {
      logError(`Ошибка: ${response.data.error}`);
      return null;
    }
  } catch (error) {
    logError(`Ошибка запроса: ${error.response?.data?.error || error.message}`);
    return null;
  }
}

async function testGetPricing() {
  console.log('\n💰 Тест 2: Получение тарифов');
  try {
    const response = await axios.get(`${BASE_URL}/api/payments/pricing`);
    
    if (response.data.success) {
      logSuccess('Тарифы получены:');
      response.data.pricing.forEach(tier => {
        console.log(`  ${tier.id}: ${tier.tokens} токенов за ${tier.price} ₽`);
      });
      return response.data.pricing;
    } else {
      logError(`Ошибка: ${response.data.error}`);
      return null;
    }
  } catch (error) {
    logError(`Ошибка запроса: ${error.response?.data?.error || error.message}`);
    return null;
  }
}

async function testCreatePayment(tierId = 'tier1') {
  console.log(`\n💳 Тест 3: Создание платежа (${tierId})`);
  try {
    const response = await axios.post(`${BASE_URL}/api/payments/create`, {
      deviceId: TEST_DEVICE_ID,
      tierId: tierId
    });
    
    if (response.data.success) {
      logSuccess('Платеж создан:');
      console.log(`  Payment ID: ${response.data.paymentId}`);
      console.log(`  Order ID: ${response.data.orderId}`);
      console.log(`  Amount: ${response.data.amount} ₽`);
      console.log(`  Tokens: ${response.data.tokensAmount}`);
      console.log(`  Payment URL: ${response.data.paymentUrl}`);
      logInfo('⚠️  Для завершения платежа перейдите по Payment URL');
      return response.data;
    } else {
      logError(`Ошибка: ${response.data.error}`);
      return null;
    }
  } catch (error) {
    logError(`Ошибка запроса: ${error.response?.data?.error || error.message}`);
    if (error.response?.data?.details) {
      console.log(`  Детали: ${error.response.data.details}`);
    }
    return null;
  }
}

async function testCheckPaymentStatus(paymentId) {
  console.log(`\n🔍 Тест 4: Проверка статуса платежа (${paymentId})`);
  try {
    const response = await axios.get(`${BASE_URL}/api/payments/status/${paymentId}`);
    
    if (response.data.success) {
      logSuccess(`Статус: ${response.data.payment.status}`);
      console.log(`  Amount: ${response.data.payment.amount} ₽`);
      console.log(`  Tokens: ${response.data.payment.tokensAmount}`);
      return response.data.payment;
    } else {
      logError(`Ошибка: ${response.data.error}`);
      return null;
    }
  } catch (error) {
    logError(`Ошибка запроса: ${error.response?.data?.error || error.message}`);
    return null;
  }
}

async function testGenerateImage(shouldFail = false) {
  console.log(`\n🎨 Тест 5: Генерация изображения (${shouldFail ? 'ожидается ошибка' : 'успех'})`);
  try {
    const response = await axios.post(`${BASE_URL}/api/generate-image`, {
      deviceId: TEST_DEVICE_ID,
      bookTitle: 'Тестовая книга',
      author: 'Тестовый автор',
      textChunk: 'Это тестовый фрагмент текста для генерации изображения.',
      styleKey: 'standard'
    });
    
    if (response.data.success) {
      logSuccess('Изображение сгенерировано:');
      console.log(`  URL: ${response.data.imageUrl}`);
      console.log(`  Cached: ${response.data.cached || false}`);
      console.log(`  Tokens remaining: ${response.data.tokensRemaining || 'N/A'}`);
      return response.data;
    } else {
      if (shouldFail && response.status === 402) {
        logSuccess(`Ожидаемая ошибка (недостаточно токенов): ${response.data.error}`);
        return response.data;
      } else {
        logError(`Ошибка: ${response.data.error}`);
        return null;
      }
    }
  } catch (error) {
    if (shouldFail && error.response?.status === 402) {
      logSuccess(`Ожидаемая ошибка (недостаточно токенов): ${error.response.data.error}`);
      return error.response.data;
    } else {
      logError(`Ошибка запроса: ${error.response?.data?.error || error.message}`);
      return null;
    }
  }
}

async function testGetTransactions() {
  console.log('\n📜 Тест 6: Получение истории транзакций');
  try {
    const response = await axios.get(`${BASE_URL}/api/payments/transactions`, {
      params: { deviceId: TEST_DEVICE_ID, limit: 10 }
    });
    
    if (response.data.success) {
      logSuccess(`Найдено транзакций: ${response.data.count}`);
      if (response.data.transactions.length > 0) {
        console.log('Последние транзакции:');
        response.data.transactions.slice(0, 5).forEach(tx => {
          const sign = tx.amount > 0 ? '+' : '';
          console.log(`  ${sign}${tx.amount} токенов - ${tx.type} - ${tx.description || 'N/A'}`);
        });
      }
      return response.data.transactions;
    } else {
      logError(`Ошибка: ${response.data.error}`);
      return null;
    }
  } catch (error) {
    logError(`Ошибка запроса: ${error.response?.data?.error || error.message}`);
    return null;
  }
}

async function runAllTests() {
  console.log('='.repeat(60));
  console.log('🚀 Запуск тестов системы токенов');
  console.log('='.repeat(60));

  // Тест 1: Баланс (новый пользователь должен получить 300 токенов)
  const initialBalance = await testGetBalance();
  if (initialBalance === null) {
    logError('Не удалось получить баланс. Остановка тестов.');
    return;
  }

  if (initialBalance !== 300) {
    logWarning(`Ожидалось 300 токенов, получено ${initialBalance}`);
  }

  // Тест 2: Тарифы
  const pricing = await testGetPricing();
  if (!pricing) {
    logWarning('Не удалось получить тарифы, но продолжаем тесты');
  }

  // Тест 3: Генерация изображения (должна пройти успешно, т.к. есть 300 токенов)
  await testGenerateImage(false);

  // Проверяем баланс после генерации
  const balanceAfterGen = await testGetBalance();
  if (balanceAfterGen !== null) {
    const expectedBalance = initialBalance - 10;
    if (balanceAfterGen === expectedBalance) {
      logSuccess(`Баланс уменьшился правильно: ${initialBalance} → ${balanceAfterGen}`);
    } else {
      logWarning(`Баланс изменился неожиданно: ${initialBalance} → ${balanceAfterGen} (ожидалось ${expectedBalance})`);
    }
  }

  // Тест 4: Создание платежа
  const payment = await testCreatePayment('tier1');
  if (payment) {
    logInfo(`\n💡 Для тестирования полного цикла платежа:`);
    logInfo(`   1. Перейдите по URL: ${payment.paymentUrl}`);
    logInfo(`   2. Выполните тестовый платеж`);
    logInfo(`   3. Запустите проверку статуса:`);
    logInfo(`      node -e "import('./test-token-system.js').then(m => m.testCheckPaymentStatus('${payment.paymentId}'))"`);
    
    // Проверяем статус сразу (должен быть processing)
    await new Promise(resolve => setTimeout(resolve, 1000));
    await testCheckPaymentStatus(payment.paymentId);
  }

  // Тест 5: История транзакций
  await testGetTransactions();

  // Тест 6: Попытка генерации при недостатке токенов (если потратили все)
  // Сначала проверим баланс
  const currentBalance = await testGetBalance();
  if (currentBalance !== null && currentBalance < 10) {
    logInfo('\n⚠️  Баланс меньше 10 токенов, тестируем ошибку недостатка токенов');
    await testGenerateImage(true);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✨ Тесты завершены');
  console.log('='.repeat(60));
}

// Запуск тестов
runAllTests().catch(error => {
  logError(`Критическая ошибка: ${error.message}`);
  console.error(error);
  process.exit(1);
});

// Экспортируем функции для использования в других скриптах
export {
  testGetBalance,
  testGetPricing,
  testCreatePayment,
  testCheckPaymentStatus,
  testGenerateImage,
  testGetTransactions
};

