import {
  getOrCreateUser,
  getUserTokenBalance,
  createPayment,
  updatePaymentStatus,
  getPaymentByPaymentId,
  getPaymentByTbankOrderId,
  addUserTokens,
  getUserTokenTransactions
} from '../utils/database.js';
import {
  createTbankPayment,
  checkTbankPaymentStatus,
  processTbankCallback,
  getTbankPaymentRedirectUrl
} from '../services/tbankService.js';
import { getAllPricing, getPricingById } from '../config/tokenPricing.js';
import crypto from 'crypto';

/**
 * Получить баланс токенов пользователя
 * GET /api/payments/balance
 */
export async function getTokenBalance(req, res) {
  try {
    const { deviceId } = req.query;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'deviceId is required'
      });
    }

    const user = await getOrCreateUser(deviceId, null);
    const balance = await getUserTokenBalance(user.id);

    return res.status(200).json({
      success: true,
      balance: balance,
      userId: user.id
    });
  } catch (error) {
    console.error('Error getting token balance:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get token balance'
    });
  }
}

/**
 * Получить список тарифов
 * GET /api/payments/pricing
 */
export async function getPricing(req, res) {
  try {
    const pricing = getAllPricing();
    return res.status(200).json({
      success: true,
      pricing: pricing
    });
  } catch (error) {
    console.error('Error getting pricing:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get pricing'
    });
  }
}

/**
 * Создать платеж для пополнения токенов
 * POST /api/payments/create
 * Body: { deviceId, tierId } или { deviceId, tokensAmount, amount }
 */
export async function createTokenPayment(req, res) {
  try {
    const { deviceId, tierId, tokensAmount, amount } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'deviceId is required'
      });
    }

    let finalTokensAmount, finalAmount;

    // Если указан tierId, используем тариф
    if (tierId) {
      const pricing = getPricingById(tierId);
      if (!pricing) {
        return res.status(400).json({
          success: false,
          error: `Invalid tierId: ${tierId}`
        });
      }
      finalTokensAmount = pricing.tokens;
      finalAmount = pricing.price;
    } else if (tokensAmount && amount) {
      // Прямое указание количества токенов и суммы (для кастомных платежей)
      finalTokensAmount = tokensAmount;
      finalAmount = amount;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either tierId or both tokensAmount and amount are required'
      });
    }

    if (!finalTokensAmount || finalTokensAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'tokensAmount must be greater than 0'
      });
    }

    if (!finalAmount || finalAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'amount must be greater than 0'
      });
    }

    // Получаем или создаем пользователя
    const user = await getOrCreateUser(deviceId, null);

    // Генерируем уникальный ID платежа
    const paymentId = `payment_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    // Создаем запись о платеже в БД
    const dbPaymentId = await createPayment(
      user.id,
      finalAmount,
      finalTokensAmount,
      paymentId,
      null
    );

    try {
      console.log('=== Creating payment in T-bank ===');
      console.log('Amount:', finalAmount, 'RUB');
      console.log('Tokens:', finalTokensAmount);
      console.log('Order ID:', paymentId);

      // Создаем платеж в Т-банк
      const tbankResult = await createTbankPayment({
        amount: finalAmount,
        orderId: paymentId,
        description: `Пополнение токенов: ${finalTokensAmount} токенов`,
        userEmail: null,
        userPhone: null
      });

      console.log('T-bank payment created successfully');
      console.log('Payment URL:', tbankResult.paymentUrl);
      console.log('Payment ID:', tbankResult.paymentId);

      // Обновляем запись о платеже с order_id от Т-банка
      if (tbankResult.orderId) {
        await updatePaymentStatus(
          paymentId,
          'processing',
          tbankResult.paymentId,
          JSON.stringify(tbankResult.data)
        );
      }

      return res.status(200).json({
        success: true,
        paymentId: paymentId,
        paymentUrl: tbankResult.paymentUrl,
        orderId: tbankResult.orderId,
        amount: finalAmount,
        tokensAmount: finalTokensAmount,
        status: 'processing'
      });
    } catch (tbankError) {
      // Если ошибка при создании платежа в Т-банк, обновляем статус
      try {
        await updatePaymentStatus(paymentId, 'failed', null, JSON.stringify({ error: tbankError.message }));
      } catch (e) {
        console.error('Error updating payment status:', e);
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to create payment',
        details: tbankError.message
      });
    }
  } catch (error) {
    console.error('Error creating payment:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create payment',
      message: error.message, // Pass the specific T-Bank error
      details: error.response?.data
    });
  }
}

/**
 * Webhook для обработки callback от Т-банка
 * POST /api/payments/tbank/callback
 */
export async function tbankWebhook(req, res) {
  try {
    console.log('Т-банк webhook received:', JSON.stringify(req.body));

    // Обрабатываем callback
    const processedData = processTbankCallback(req.body);

    // Находим платеж по order_id или payment_id
    let payment = null;
    if (processedData.paymentId) {
      // Сначала пробуем найти по PaymentId от Т-банка (если сохранили в tbank_payment_id)
      payment = await getPaymentByTbankOrderId(processedData.paymentId);
    }
    if (!payment) {
      payment = await getPaymentByPaymentId(processedData.orderId);
    }

    if (!payment) {
      console.error(`Payment not found for orderId: ${processedData.orderId}`);
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    // Обновляем статус платежа
    // Сохраняем PaymentId от Т-банка в tbank_payment_id
    await updatePaymentStatus(
      payment.payment_id,
      processedData.status,
      processedData.paymentId || payment.tbank_payment_id,
      JSON.stringify(processedData.rawData)
    );

    // Если платеж успешен, начисляем токены
    if (processedData.status === 'completed' && payment.status !== 'completed') {
      await addUserTokens(
        payment.user_id,
        payment.tokens_amount,
        `Пополнение токенов через платеж ${payment.payment_id}`,
        payment.id
      );

      console.log(`Tokens added for user ${payment.user_id}: ${payment.tokens_amount}`);
    }

    // Т-банк ожидает определенный ответ (уточнить в документации)
    return res.status(200).json({
      success: true,
      message: 'Callback processed'
    });
  } catch (error) {
    console.error('Error processing Т-банк webhook:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to process webhook'
    });
  }
}

/**
 * Проверить статус платежа
 * GET /api/payments/status/:paymentId
 */
export async function checkPaymentStatus(req, res) {
  try {
    const { paymentId } = req.params;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: 'paymentId is required'
      });
    }

    // Получаем платеж из БД
    const payment = await getPaymentByPaymentId(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    // Если платеж еще в обработке, проверяем статус в Т-банк
    if (payment.status === 'pending' || payment.status === 'processing') {
      try {
        // Используем PaymentId от Т-банка, если есть, иначе payment_id
        const paymentIdToCheck = payment.tbank_payment_id || payment.payment_id;
        const tbankStatus = await checkTbankPaymentStatus(paymentIdToCheck);

        // Маппинг статусов Т-банк на наши статусы
        let mappedStatus = payment.status;
        if (tbankStatus.status === 'CONFIRMED' || tbankStatus.status === 'AUTHORIZED') {
          mappedStatus = 'completed';
        } else if (tbankStatus.status === 'REJECTED' || tbankStatus.status === 'AUTH_FAIL') {
          mappedStatus = 'failed';
        } else if (tbankStatus.status === 'CANCELED') {
          mappedStatus = 'cancelled';
        } else if (['PREAUTHORIZING', 'AUTHORIZING', 'CONFIRMING'].includes(tbankStatus.status)) {
          mappedStatus = 'processing';
        }

        // Обновляем статус если изменился
        if (mappedStatus !== payment.status) {
          await updatePaymentStatus(
            payment.payment_id,
            mappedStatus,
            tbankStatus.paymentId || payment.tbank_payment_id,
            JSON.stringify(tbankStatus.data)
          );

          // Если платеж успешен, начисляем токены
          if (mappedStatus === 'completed' && payment.status !== 'completed') {
            await addUserTokens(
              payment.user_id,
              payment.tokens_amount,
              `Пополнение токенов через платеж ${payment.payment_id}`,
              payment.id
            );
          }
        }
      } catch (tbankError) {
        console.error('Error checking Т-банк status:', tbankError);
        // Продолжаем с данными из БД
      }
    }

    // Получаем обновленный платеж
    const updatedPayment = await getPaymentByPaymentId(paymentId);

    return res.status(200).json({
      success: true,
      payment: {
        paymentId: updatedPayment.payment_id,
        status: updatedPayment.status,
        amount: parseFloat(updatedPayment.amount),
        tokensAmount: updatedPayment.tokens_amount,
        createdAt: updatedPayment.created_at,
        updatedAt: updatedPayment.updated_at
      }
    });
  } catch (error) {
    console.error('Error checking payment status:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to check payment status'
    });
  }
}

/**
 * Получить историю транзакций токенов
 * GET /api/payments/transactions?deviceId=...
 */
export async function getTokenTransactions(req, res) {
  try {
    const { deviceId } = req.query;
    const limit = parseInt(req.query.limit) || 50;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'deviceId is required'
      });
    }

    const user = await getOrCreateUser(deviceId, null);
    const transactions = await getUserTokenTransactions(user.id, limit);

    return res.status(200).json({
      success: true,
      transactions: transactions,
      count: transactions.length
    });
  } catch (error) {
    console.error('Error getting transactions:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get transactions'
    });
  }
}

/**
 * Success redirect handler (после успешной оплаты)
 * GET /api/payments/tbank/success
 */
export async function tbankSuccessRedirect(req, res) {
  try {
    const { order_id, payment_id } = req.query;

    if (order_id) {
      // Редирект на страницу успеха в приложении
      // В реальном приложении это будет deep link или URL приложения
      return res.redirect(`vissreader://payment/success?orderId=${order_id}&paymentId=${payment_id || ''}`);
    }

    return res.status(200).send(`
      <html>
        <head><title>Платеж успешен</title></head>
        <body>
          <h1>Платеж успешно обработан</h1>
          <p>Ваши токены будут начислены в течение нескольких минут.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error in success redirect:', error);
    return res.status(500).send('Error processing success redirect');
  }
}

/**
 * Failure redirect handler (после неуспешной оплаты)
 * GET /api/payments/tbank/failure
 */
export async function tbankFailureRedirect(req, res) {
  try {
    const { order_id } = req.query;

    if (order_id) {
      return res.redirect(`vissreader://payment/failure?orderId=${order_id}`);
    }

    return res.status(200).send(`
      <html>
        <head><title>Ошибка платежа</title></head>
        <body>
          <h1>Ошибка при обработке платежа</h1>
          <p>Пожалуйста, попробуйте еще раз.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error in failure redirect:', error);
    return res.status(500).send('Error processing failure redirect');
  }
}

