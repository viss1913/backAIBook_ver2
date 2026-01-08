import axios from 'axios';

const BASE_URL = 'https://backaibookver2-production.up.railway.app';
const TEST_DEVICE_ID = `test-device-${Date.now()}`;

console.log('🧪 Тестирование production сервера\n');
console.log(`Base URL: ${BASE_URL}`);
console.log(`Test Device ID: ${TEST_DEVICE_ID}\n`);

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

async function testHealth() {
  console.log('📊 Тест 1: Health check');
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    if (response.data.status === 'ok') {
      logSuccess(`Сервер работает! Uptime: ${response.data.uptime}s`);
      return true;
    }
    return false;
  } catch (error) {
    logError(`Ошибка: ${error.message}`);
    return false;
  }
}

async function testPricing() {
  console.log('\n💰 Тест 2: Получение тарифов');
  try {
    const response = await axios.get(`${BASE_URL}/api/payments/pricing`);
    if (response.data.success) {
      logSuccess('Тарифы получены:');
      response.data.pricing.forEach(tier => {
        const popular = tier.popular ? ' ⭐' : '';
        console.log(`  ${tier.id}: ${tier.tokens} токенов за ${tier.price} ₽${popular}`);
      });
      return response.data.pricing;
    } else {
      logError(`Ошибка: ${response.data.error}`);
      return null;
    }
  } catch (error) {
    logError(`Ошибка: ${error.response?.data?.error || error.message}`);
    return null;
  }
}

async function testBalance() {
  console.log('\n📊 Тест 3: Проверка баланса токенов');
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
    if (error.response?.status === 500) {
      logError('Ошибка БД (возможно MySQL не подключен)');
    } else {
      logError(`Ошибка: ${error.response?.data?.error || error.message}`);
    }
    return null;
  }
}

async function testCreatePayment(tierId = 'tier1') {
  console.log(`\n💳 Тест 4: Создание платежа (${tierId})`);
  try {
    const response = await axios.post(`${BASE_URL}/api/payments/create`, {
      deviceId: TEST_DEVICE_ID,
      tierId: tierId
    });
    
    if (response.data.success) {
      logSuccess('Платеж создан успешно!');
      console.log(`  Payment ID: ${response.data.paymentId}`);
      console.log(`  Order ID: ${response.data.orderId}`);
      console.log(`  Amount: ${response.data.amount} ₽`);
      console.log(`  Tokens: ${response.data.tokensAmount}`);
      console.log(`  Status: ${response.data.status}`);
      console.log(`\n  🔗 Payment URL:`);
      console.log(`  ${response.data.paymentUrl}`);
      return response.data;
    } else {
      logError(`Ошибка: ${response.data.error}`);
      if (response.data.details) {
        console.log(`  Детали: ${response.data.details}`);
      }
      return null;
    }
  } catch (error) {
    logError(`Ошибка: ${error.response?.data?.error || error.message}`);
    if (error.response?.data?.details) {
      console.log(`  Детали: ${error.response.data.details}`);
    }
    if (error.response?.status === 500) {
      console.log(`  Возможно проблема с БД или Т-банк API`);
    }
    return null;
  }
}

async function testGenerateImage() {
  console.log('\n🎨 Тест 5: Генерация изображения (требует токены)');
  try {
    const response = await axios.post(`${BASE_URL}/api/generate-image`, {
      deviceId: TEST_DEVICE_ID,
      bookTitle: 'Тестовая книга',
      author: 'Тестовый автор',
      textChunk: 'Это тестовый фрагмент текста для генерации изображения.',
      styleKey: 'standard'
    });
    
    if (response.data.success) {
      logSuccess('Изображение сгенерировано!');
      console.log(`  URL: ${response.data.imageUrl}`);
      console.log(`  Cached: ${response.data.cached || false}`);
      console.log(`  Tokens remaining: ${response.data.tokensRemaining || 'N/A'}`);
      return response.data;
    } else {
      if (response.status === 402) {
        logError(`Недостаточно токенов: ${response.data.error}`);
        console.log(`  Balance: ${response.data.balance}, Required: ${response.data.required}`);
      } else {
        logError(`Ошибка: ${response.data.error}`);
      }
      return null;
    }
  } catch (error) {
    if (error.response?.status === 402) {
      logError(`Недостаточно токенов: ${error.response.data.error}`);
      console.log(`  Balance: ${error.response.data.balance}, Required: ${error.response.data.required}`);
    } else {
      logError(`Ошибка: ${error.response?.data?.error || error.message}`);
    }
    return null;
  }
}

async function runAllTests() {
  console.log('='.repeat(70));
  console.log('🚀 Тестирование production сервера');
  console.log('='.repeat(70));

  // Тест 1: Health
  const healthOk = await testHealth();
  if (!healthOk) {
    logError('Сервер не отвечает. Остановка тестов.');
    return;
  }

  // Тест 2: Тарифы
  const pricing = await testPricing();
  if (!pricing) {
    logError('Не удалось получить тарифы');
  }

  // Тест 3: Баланс
  const balance = await testBalance();
  if (balance !== null) {
    logInfo(`Новый пользователь получил ${balance} токенов (ожидалось 300)`);
  }

  // Тест 4: Создание платежа
  const payment = await testCreatePayment('tier1');
  if (payment) {
    logInfo('\n💡 Для завершения теста:');
    logInfo(`   1. Откройте Payment URL в браузере`);
    logInfo(`   2. Выполните тестовый платеж`);
    logInfo(`   3. Проверьте статус: ${BASE_URL}/api/payments/status/${payment.paymentId}`);
  }

  // Тест 5: Генерация изображения (если есть токены)
  if (balance !== null && balance >= 10) {
    await testGenerateImage();
  } else {
    logInfo('\n⚠️  Пропуск теста генерации (недостаточно токенов или БД не настроена)');
  }

  console.log('\n' + '='.repeat(70));
  console.log('✨ Тестирование завершено');
  console.log('='.repeat(70));
}

runAllTests().catch(error => {
  logError(`Критическая ошибка: ${error.message}`);
  console.error(error);
  process.exit(1);
});



