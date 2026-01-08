import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

export async function checkStatus(paymentId) {
  try {
    console.log(`🔍 Проверка статуса платежа: ${paymentId}\n`);
    
    const response = await axios.get(`${BASE_URL}/api/payments/status/${paymentId}`);
    
    if (response.data.success) {
      const payment = response.data.payment;
      console.log('📊 Статус платежа:');
      console.log(`   Payment ID: ${payment.paymentId}`);
      console.log(`   Статус: ${payment.status}`);
      console.log(`   Сумма: ${payment.amount} ₽`);
      console.log(`   Токены: ${payment.tokensAmount}`);
      console.log(`   Создан: ${payment.createdAt}`);
      console.log(`   Обновлен: ${payment.updatedAt}`);
      
      if (payment.status === 'completed') {
        console.log('\n✅ Платеж успешно завершен! Токены должны быть начислены.');
      } else if (payment.status === 'processing') {
        console.log('\n⏳ Платеж в обработке. Подождите немного и проверьте снова.');
      } else if (payment.status === 'failed') {
        console.log('\n❌ Платеж завершился с ошибкой.');
      }
    } else {
      console.error('❌ Ошибка:', response.data.error);
    }
  } catch (error) {
    console.error('❌ Ошибка запроса:', error.response?.data?.error || error.message);
  }
}

// Если запущен напрямую
if (process.argv[2]) {
  checkStatus(process.argv[2]);
}



