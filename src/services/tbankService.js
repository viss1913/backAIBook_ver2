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
 * @param {string} [providedPassword] - Пароль (опционально)
 * @returns {string} - Подпись (Token)
 */
function generateToken(params, providedPassword) {
  const password = providedPassword || (TBANK_PASSWORD ? TBANK_PASSWORD.trim() : '');

  // Добавляем пароль к параметрам для сортировки
  const data = { ...params, Password: password };

  // Сортируем ключи и исключаем сам Token, а также объекты/массивы (Receipt, Data)
  const keys = Object.keys(data)
    .filter(key =>
      key !== 'Token' &&
      key !== 'token' &&
      key !== 'Receipt' &&
      key !== 'Data'
    )
    .sort();

  // Конкатенируем ТОЛЬКО значения (V2 стандарт)
  const stringToSign = keys.map(key => data[key]).join('');

  // Генерируем SHA256
  return crypto.createHash('sha256').update(stringToSign).digest('hex');
}

/**
 * Создание платежа в Т-банк
 * Документация: https://developer.tbank.ru/eacq/api
 */
export async function createTbankPayment(paymentData) {
  const { amount, orderId, description, userEmail, userPhone } = paymentData;

  // Use env vars or fallback to demo ONLY ifenv is missing (legacy support, but warn)
  // Fix: TRIM credentials to avoid whitespace issues from copy-paste
  const envTerminalKey = TBANK_TERMINAL_KEY ? TBANK_TERMINAL_KEY.trim() : undefined;
  const envPassword = TBANK_PASSWORD ? TBANK_PASSWORD.trim() : undefined;

  const terminalKey = envTerminalKey || '1703150935625DEMO';
  const password = envPassword || 'xcbixwo8gsjibu6u';

  console.log('--- Credential Debug ---');
  console.log('Env Key Set:', !!envTerminalKey);
  console.log('Env Pass Set:', !!envPassword);
  console.log('Using Terminal:', terminalKey);
  console.log('Using Password (masked):', password ? (password.substring(0, 2) + '***' + password.slice(-2)) : 'MISSING');

  if (envTerminalKey && !envPassword) {
    console.error('🚨 CRITICAL ERROR: TerminalKey is set in ENV, but Password is NOT! Using Demo password with Real Key will fail.');
  }

  if (!envTerminalKey) {
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

  // Добавляем чек (Receipt) для соответствия ФЗ-54 (если терминал требует фискализацию)
  // Это обязательно для большинства боевых терминалов
  params.Receipt = {
    Email: userEmail || 'user@example.com', // Обязательно, если нет телефона
    Taxation: 'usn_income', // Упрощенная система (доходы). Можно вынести в ENV если нужно другое (osn, usn_income_outcome, envd, esn, patent)
    Items: [
      {
        Name: description || 'Пополнение баланса токенов',
        Price: Math.round(amount * 100), // В копейках
        Quantity: 1.00,
        Amount: Math.round(amount * 100), // Сумма позиции в копейках
        Tax: 'none', // Без НДС (или vat20, vat10, vat0)
        PaymentMethod: 'full_prepayment', // Полная предоплата 
        PaymentObject: 'service' // Услуга
      }
    ]
  };

  // Генерируем Token (подпись) с использованием триммированного пароля
  params.Token = generateToken(params, password);

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
 * Документация: https://developer.tbank.ru/eacq/api
 */
export async function checkTbankPaymentStatus(paymentId) {
  // Fix: TRIM credentials here as well to be safe
  const envTerminalKey = TBANK_TERMINAL_KEY ? TBANK_TERMINAL_KEY.trim() : undefined;
  const envPassword = TBANK_PASSWORD ? TBANK_PASSWORD.trim() : undefined;

  if (!envTerminalKey || !envPassword) {
    throw new Error('Т-банк конфигурация не настроена');
  }

  console.log('--- Checking T-Bank Status ---');
  console.log('PaymentID (input):', paymentId);

  // Conver to string to ensure consistency (API expects String(20))
  const paymentIdStr = String(paymentId);

  const params = {
    TerminalKey: envTerminalKey,
    PaymentId: paymentIdStr
  };

  params.Token = generateToken(params, envPassword);

  console.log('Params to GetState:', JSON.stringify(params));

  try {
    // Формируем правильный URL для V2
    let apiUrl = TBANK_API_URL;
    // Remove trailing slash if present
    if (apiUrl.endsWith('/')) {
      apiUrl = apiUrl.slice(0, -1);
    }
    // Remove /v2/Init if present (just in case user pasted full Init URL)
    apiUrl = apiUrl.replace(/\/v2\/Init$/, '');

    // Ensure we target v2
    if (!apiUrl.endsWith('/v2')) {
      // If it doesn't end in /v2, check if we need to add it
      // Assuming base is https://securepay.tinkoff.ru
      if (!apiUrl.includes('/v2')) {
        apiUrl = `${apiUrl}/v2`;
      }
    }

    const requestUrl = `${apiUrl}/GetState`;
    console.log('Using GetState URL:', requestUrl);

    const response = await axios.post(
      requestUrl,
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
