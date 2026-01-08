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
const TBANK_TERMINAL_KEY = process.env.TBANK_TERMINAL_KEY; // Expect specific key from env
const TBANK_PASSWORD = process.env.TBANK_PASSWORD; // Expect specific password from env
const TBANK_API_TOKEN = process.env.TBANK_API_TOKEN; // Bearer Token (optional)
const TBANK_SUCCESS_URL = process.env.TBANK_SUCCESS_URL || `${process.env.BASE_URL || 'http://localhost:3000'}/api/payments/tbank/success`;
const TBANK_FAILURE_URL = process.env.TBANK_FAILURE_URL || `${process.env.BASE_URL || 'http://localhost:3000'}/api/payments/tbank/failure`;

// Validate credentials on startup
if (!TBANK_TERMINAL_KEY || !TBANK_PASSWORD) {
  console.warn('⚠️ WARNING: TBANK_TERMINAL_KEY or TBANK_PASSWORD are missing in .env');
  console.warn('⚠️ Payments will likely FAIL unless using a hardcoded fallback (not recommended for production).');
}

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
 * Документация: https://developer.tbank.ru/eacq/api
 */
export async function createTbankPayment(paymentData) {
  const { amount, orderId, description, userEmail, userPhone } = paymentData;

  // Use env vars or fallback to demo ONLY ifenv is missing (legacy support, but warn)
  const terminalKey = TBANK_TERMINAL_KEY || '1703150935625DEMO';
  const password = TBANK_PASSWORD || 'xcbixwo8gsjibu6u';

  if (!TBANK_TERMINAL_KEY) {
    console.warn('⚠️ Using DEMO Terminal Key because TBANK_TERMINAL_KEY is not set.');
  }

  // Формируем параметры запроса согласно документации Т-банк
  const params = {
    TerminalKey: terminalKey,
    Amount: Math.round(amount * 100), // Сумма в копейках
    OrderId: orderId,
    Description: description || 'Пополнение токенов',
    SuccessURL: TBANK_SUCCESS_URL,
    FailURL: TBANK_FAILURE_URL,
    // Дополнительные параметры
    ...(userEmail && { Email: userEmail }),
    ...(userPhone && { Phone: userPhone })
  };

  // Генерируем Token (подпись) - передаем пароль явно
  // Note: generateToken relies on the global TBANK_PASSWORD currently. 
  // Let's modify generateToken or handle it here locally to be safe if we switched to local vars above.
  // Ideally, generateToken should take password as arg, but for minimal invasive change let's rely on global if set, 
  // or re-implement token gen logic locally if needed. 
  // Actually, let's fix generateToken usage by temporarily overriding or creating a local helper if we want to support the demo fallback properly without changing global const logic too much.
  // BUT the user SAID they added keys, so global `TBANK_PASSWORD` should be good.

  // Let's update the generateToken function slightly in a separate tool call if needed, 
  // but for now, assuming TBANK_PASSWORD is set correctly from env as per user input.
  // If we fell back to demo strings above locally, generateToken might fail if it uses the empty global.
  // Let's patch generateToken logic inline here for safety or update the global var usage.

  // Re-implementing token generation locally to be safe with the `password` variable selected above
  const sortedParams = Object.keys(params)
    .filter(key => key !== 'Token' && key !== 'token')
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  const stringToSign = `${sortedParams}&Password=${password}`;
  params.Token = crypto.createHash('sha256').update(stringToSign).digest('hex');

  try {
    // Формируем правильный URL
    let apiUrl = TBANK_API_URL;
    if (!apiUrl.endsWith('/v2/Init') && !apiUrl.endsWith('/v2/Init/')) {
      apiUrl = apiUrl.replace(/\/$/, '');
      apiUrl = `${apiUrl}/v2/Init`;
    }

    console.log('=== T-bank API Request ===');
    console.log('URL:', apiUrl);
    console.log('TerminalKey:', terminalKey);
    console.log('OrderId:', orderId);
    console.log('Amount (coins):', params.Amount);

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (TBANK_API_TOKEN) {
      headers['Authorization'] = `Bearer ${TBANK_API_TOKEN}`;
    }

    const response = await axios.post(apiUrl, params, { headers, timeout: 30000 });

    console.log('=== T-bank API Response ===');
    console.log('Status:', response.status);
    console.log('Success:', response.data.Success);

    if (response.data.Success === false) {
      const errorMessage = response.data.Message || response.data.ErrorMessage || 'Ошибка создания платежа';
      const errorDetails = response.data.Details || '';
      console.error('❌ T-Bank Error:', errorMessage, errorDetails);
      throw new Error(`T-Bank Error: ${errorMessage} ${errorDetails}`);
    }

    // Ищем PaymentURL в разных полях
    const paymentUrl = response.data.PaymentURL ||
      response.data.PaymentUrl ||
      response.data.Url ||
      response.data.url ||
      response.data.PaymentLink;

    if (!paymentUrl) {
      console.error('❌ PaymentURL not found in successful response:', JSON.stringify(response.data));
      throw new Error('PaymentURL не получен от Т-банк');
    }

    console.log('✅ PaymentURL received:', paymentUrl);

    return {
      success: true,
      paymentUrl: paymentUrl,
      orderId: response.data.OrderId || orderId,
      paymentId: response.data.PaymentId,
      status: response.data.Status,
      data: response.data
    };
  } catch (error) {
    console.error('=== Payment Creation Failed ===');
    console.error(error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data));
    }
    throw error;
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

