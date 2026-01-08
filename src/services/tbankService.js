import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Сервис для работы с Т-банк интернет эквайрингом
 * 
 * Документация: https://developer.tbank.ru/eacq/intro/connection
 */

// Конфигурация Т-банк API
// Документация: https://developer.tbank.ru/eacq/api/init
const TBANK_API_URL = process.env.TBANK_API_URL || 'https://securepay.tinkoff.ru';
const TBANK_TERMINAL_KEY = process.env.TBANK_TERMINAL_KEY || '1703150935625DEMO'; // Тестовый терминал
const TBANK_PASSWORD = process.env.TBANK_PASSWORD || 'xcbixwo8gsjibu6u'; // Тестовый пароль
const TBANK_API_TOKEN = process.env.TBANK_API_TOKEN; // Bearer Token для авторизации (если используется)
const TBANK_SUCCESS_URL = process.env.TBANK_SUCCESS_URL || `${process.env.BASE_URL || 'http://localhost:3000'}/api/payments/tbank/success`;
const TBANK_FAILURE_URL = process.env.TBANK_FAILURE_URL || `${process.env.BASE_URL || 'http://localhost:3000'}/api/payments/tbank/failure`;

/**
 * Генерация подписи для запроса Т-банк API
 * Согласно документации: https://developer.tbank.ru/eacq/api
 * @param {Object} params - Параметры запроса
 * @returns {string} - Подпись (Token)
 */
function generateToken(params) {
  // Формируем строку для подписи (все параметры кроме Token, отсортированные по алфавиту)
  const sortedParams = Object.keys(params)
    .filter(key => key !== 'Token' && key !== 'token')
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  // Добавляем пароль
  const stringToSign = `${sortedParams}&Password=${TBANK_PASSWORD}`;
  
  // Генерируем SHA256 хэш (или MD5, в зависимости от версии API)
  // По умолчанию используем SHA256
  return crypto.createHash('sha256').update(stringToSign).digest('hex');
}

/**
 * Создание платежа в Т-банк
 * @param {Object} paymentData - Данные платежа
 * @param {number} paymentData.amount - Сумма платежа в рублях
 * @param {string} paymentData.orderId - Уникальный ID заказа
 * @param {string} paymentData.description - Описание платежа
 * @param {string} paymentData.userEmail - Email пользователя (опционально)
 * @param {string} paymentData.userPhone - Телефон пользователя (опционально)
 * @returns {Promise<Object>} - Ответ от Т-банк с URL для оплаты
 */
/**
 * Создание платежа в Т-банк
 * Документация: https://developer.tbank.ru/eacq/api
 */
export async function createTbankPayment(paymentData) {
  const { amount, orderId, description, userEmail, userPhone } = paymentData;

  if (!TBANK_TERMINAL_KEY || !TBANK_PASSWORD) {
    throw new Error('Т-банк конфигурация не настроена. Установите TBANK_TERMINAL_KEY и TBANK_PASSWORD');
  }

  // Формируем параметры запроса согласно документации Т-банк
  const params = {
    TerminalKey: TBANK_TERMINAL_KEY,
    Amount: Math.round(amount * 100), // Сумма в копейках
    OrderId: orderId,
    Description: description || 'Пополнение токенов',
    SuccessURL: TBANK_SUCCESS_URL,
    FailURL: TBANK_FAILURE_URL,
    // Дополнительные параметры
    ...(userEmail && { Email: userEmail }),
    ...(userPhone && { Phone: userPhone })
  };

  // Генерируем Token (подпись)
  params.Token = generateToken(params);

  try {
    console.log('=== T-bank API Request ===');
    console.log('URL:', `${TBANK_API_URL}/v2/Init`);
    console.log('TerminalKey:', TBANK_TERMINAL_KEY);
    console.log('Params (без Token):', JSON.stringify({ ...params, Token: '[HIDDEN]' }, null, 2));
    
    // Согласно документации: https://developer.tbank.ru/eacq/api/init
    // Endpoint: /v2/Init
    // Авторизация: Bearer API Token (если TBANK_API_TOKEN указан) или через Token в теле запроса
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // Если указан API Token, используем Bearer авторизацию
    if (TBANK_API_TOKEN) {
      headers['Authorization'] = `Bearer ${TBANK_API_TOKEN}`;
      console.log('Using Bearer Token authorization');
    }
    
    const response = await axios.post(
      `${TBANK_API_URL}/v2/Init`,
      params,
      {
        headers: headers,
        timeout: 30000
      }
    );

    // Логируем полный ответ для отладки
    console.log('=== T-bank API Response ===');
    console.log('Status:', response.status);
    console.log('Full response:', JSON.stringify(response.data, null, 2));
    console.log('Response keys:', Object.keys(response.data || {}));
    
    // Проверяем все возможные поля для PaymentURL
    const possibleUrlFields = ['PaymentURL', 'PaymentUrl', 'Url', 'url', 'PaymentUrl', 'payment_url', 'redirectUrl', 'RedirectUrl'];
    console.log('Checking for PaymentURL in fields:');
    possibleUrlFields.forEach(field => {
      if (response.data[field]) {
        console.log(`  ✓ Found ${field}: ${response.data[field]}`);
      }
    });

    // Проверяем ответ
    // Согласно документации: https://developer.tbank.ru/eacq/api/init
    if (response.data.Success === false) {
      const errorMessage = response.data.Message || response.data.ErrorMessage || 'Ошибка создания платежа';
      console.error('T-bank returned Success: false');
      console.error('Error message:', errorMessage);
      console.error('Error code:', response.data.ErrorCode);
      throw new Error(errorMessage);
    }

    // PaymentURL может быть в разных полях в зависимости от API версии
    // Согласно документации, обычно это PaymentURL
    const paymentUrl = response.data.PaymentURL || 
                      response.data.PaymentUrl || 
                      response.data.Url || 
                      response.data.url ||
                      response.data.PaymentLink;
    
    if (!paymentUrl) {
      console.error('❌ PaymentURL не найден в ответе Т-банк!');
      console.error('Все поля ответа:', Object.keys(response.data));
      console.error('Полный ответ:', JSON.stringify(response.data, null, 2));
      throw new Error('PaymentURL не получен от Т-банк. Проверьте логи для деталей.');
    }

    console.log('✅ PaymentURL получен:', paymentUrl);

    // PaymentURL - URL для редиректа на страницу оплаты
    return {
      success: true,
      paymentUrl: paymentUrl,
      orderId: response.data.OrderId || orderId,
      paymentId: response.data.PaymentId || response.data.PaymentId,
      status: response.data.Status,
      data: response.data
    };
  } catch (error) {
    console.error('=== T-bank API Error ===');
    console.error('Error message:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      console.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
    } else if (error.request) {
      console.error('Request was made but no response received');
      console.error('Request config:', JSON.stringify({
        url: error.config?.url,
        method: error.config?.method,
        data: error.config?.data
      }, null, 2));
    }
    throw new Error(`Ошибка создания платежа: ${error.response?.data?.Message || error.message}`);
  }
}

/**
 * Проверка статуса платежа
 * @param {string} orderId - ID заказа
 * @returns {Promise<Object>} - Статус платежа
 */
/**
 * Проверка статуса платежа
 * Документация: https://developer.tbank.ru/eacq/api
 */
export async function checkTbankPaymentStatus(paymentId) {
  if (!TBANK_TERMINAL_KEY || !TBANK_PASSWORD) {
    throw new Error('Т-банк конфигурация не настроена');
  }

  const params = {
    TerminalKey: TBANK_TERMINAL_KEY,
    PaymentId: paymentId
  };

  params.Token = generateToken(params);

  try {
    const response = await axios.post(
      `${TBANK_API_URL}/GetState`,
      params,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      }
    );

    if (response.data.Success === false) {
      throw new Error(response.data.Message || 'Ошибка проверки статуса');
    }

    // Статусы: NEW, FORM_SHOWED, DEADLINE_EXPIRED, CANCELED, PREAUTHORIZING, AUTHORIZING, AUTHORIZED, AUTH_FAIL, REJECTED, 3DS_CHECKING, 3DS_CHECKED, REVERSING, REVERSED, CONFIRMING, CONFIRMED, REFUNDING, REFUNDED, PARTIAL_REFUNDED
    return {
      success: true,
      status: response.data.Status,
      orderId: response.data.OrderId,
      amount: response.data.Amount ? response.data.Amount / 100 : null, // Конвертируем из копеек
      paymentId: response.data.PaymentId,
      data: response.data
    };
  } catch (error) {
    console.error('Т-банк status check error:', error.response?.data || error.message);
    throw new Error(`Ошибка проверки статуса: ${error.response?.data?.Message || error.message}`);
  }
}

/**
 * Верификация callback от Т-банка
 * @param {Object} callbackData - Данные из callback
 * @returns {boolean} - true если подпись валидна
 */
/**
 * Верификация callback от Т-банка
 */
export function verifyTbankCallback(callbackData) {
  if (!TBANK_PASSWORD) {
    return false;
  }

  // Получаем Token из callback
  const receivedToken = callbackData.Token || callbackData.token;
  if (!receivedToken) {
    return false;
  }

  // Генерируем Token из полученных данных
  const calculatedToken = generateToken(callbackData);

  // Сравниваем токены
  return receivedToken.toLowerCase() === calculatedToken.toLowerCase();
}

/**
 * Обработка успешного платежа (webhook/callback)
 * @param {Object} callbackData - Данные из callback
 * @returns {Object} - Обработанные данные платежа
 */
/**
 * Обработка callback от Т-банка
 */
export function processTbankCallback(callbackData) {
  // Верифицируем Token
  if (!verifyTbankCallback(callbackData)) {
    throw new Error('Неверный Token callback от Т-банка');
  }

  // Извлекаем данные (формат Т-банк API)
  const orderId = callbackData.OrderId;
  const paymentId = callbackData.PaymentId;
  const amount = callbackData.Amount ? callbackData.Amount / 100 : null; // Конвертируем из копеек
  const status = callbackData.Status;

  // Определяем статус платежа
  // Статусы Т-банк: NEW, AUTHORIZED, CONFIRMED, REJECTED, CANCELED, REFUNDED и т.д.
  let paymentStatus = 'pending';
  if (status === 'CONFIRMED' || status === 'AUTHORIZED') {
    paymentStatus = 'completed';
  } else if (status === 'REJECTED' || status === 'AUTH_FAIL') {
    paymentStatus = 'failed';
  } else if (status === 'CANCELED' || status === 'CANCELED') {
    paymentStatus = 'cancelled';
  } else if (status === 'PREAUTHORIZING' || status === 'AUTHORIZING' || status === 'CONFIRMING') {
    paymentStatus = 'processing';
  } else if (status === 'NEW' || status === 'FORM_SHOWED') {
    paymentStatus = 'pending';
  }

  return {
    orderId,
    paymentId,
    amount,
    status: paymentStatus,
    rawData: callbackData
  };
}

/**
 * Получить URL для редиректа на оплату (альтернативный метод)
 * Используется если Т-банк требует редирект на их страницу оплаты
 */
/**
 * Получить URL для редиректа на оплату (альтернативный метод)
 * Используется если нужно сформировать URL напрямую
 */
export function getTbankPaymentRedirectUrl(orderId, amount, description) {
  if (!TBANK_TERMINAL_KEY || !TBANK_PASSWORD) {
    throw new Error('Т-банк конфигурация не настроена');
  }

  const params = {
    TerminalKey: TBANK_TERMINAL_KEY,
    Amount: Math.round(amount * 100),
    OrderId: orderId,
    Description: description || 'Пополнение токенов',
    SuccessURL: TBANK_SUCCESS_URL,
    FailURL: TBANK_FAILURE_URL
  };

  params.Token = generateToken(params);

  // Формируем URL с параметрами
  const queryString = Object.keys(params)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  return `${TBANK_API_URL}/Init?${queryString}`;
}

