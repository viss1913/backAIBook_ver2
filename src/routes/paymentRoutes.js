import express from 'express';
import {
  getTokenBalance,
  getPricing,
  createTokenPayment,
  tbankWebhook,
  checkPaymentStatus,
  getTokenTransactions,
  tbankSuccessRedirect,
  tbankFailureRedirect
} from '../controllers/paymentController.js';

const router = express.Router();

/**
 * GET /api/payments/balance?deviceId=...
 * Получить баланс токенов пользователя
 */
router.get('/balance', getTokenBalance);

/**
 * GET /api/payments/pricing
 * Получить список тарифов на покупку токенов
 */
router.get('/pricing', getPricing);

/**
 * POST /api/payments/create
 * Создать платеж для пополнения токенов
 * Body: { deviceId, tierId } или { deviceId, tokensAmount, amount }
 * 
 * Примеры:
 * { deviceId: "xxx", tierId: "tier1" } - использовать тариф
 * { deviceId: "xxx", tokensAmount: 1000, amount: 300 } - кастомный платеж
 */
router.post('/create', createTokenPayment);

/**
 * GET /api/payments/status/:paymentId
 * Проверить статус платежа
 */
router.get('/status/:paymentId', checkPaymentStatus);

/**
 * GET /api/payments/transactions?deviceId=...&limit=50
 * Получить историю транзакций токенов
 */
router.get('/transactions', getTokenTransactions);

/**
 * POST /api/payments/tbank/callback
 * Webhook для обработки callback от Т-банка
 * ВАЖНО: Этот endpoint должен быть доступен извне для Т-банка
 */
router.post('/tbank/callback', tbankWebhook);

/**
 * GET /api/payments/tbank/success
 * Редирект после успешной оплаты
 */
router.get('/tbank/success', tbankSuccessRedirect);

/**
 * GET /api/payments/tbank/failure
 * Редирект после неуспешной оплаты
 */
router.get('/tbank/failure', tbankFailureRedirect);

export default router;

