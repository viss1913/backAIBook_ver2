import { getOrCreateUser, getUserTokenBalance, spendUserTokens } from '../utils/database.js';

/**
 * Middleware для проверки токенов перед генерацией изображения
 * Требует deviceId в теле запроса
 */
export async function checkTokensMiddleware(req, res, next) {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'deviceId is required'
      });
    }

    // Получаем или создаем пользователя
    const user = await getOrCreateUser(deviceId, null);

    // Получаем баланс токенов (для новых пользователей будет 300)
    const balance = await getUserTokenBalance(user.id);

    // Определяем стоимость в зависимости от режима (mode)
    const mode = req.query.mode || 'turbo'; // Default to turbo/fast
    let IMAGE_COST = 25; // Default (Pro)

    if (mode === 'base' || mode === 'economy') {
      IMAGE_COST = 5; // Schnell
    } else {
      IMAGE_COST = 25; // Pro
    }

    if (balance < IMAGE_COST) {
      return res.status(402).json({
        success: false,
        error: 'Insufficient tokens',
        balance: balance,
        required: IMAGE_COST,
        message: `Недостаточно токенов. У вас ${balance}, требуется ${IMAGE_COST}`
      });
    }

    // Сохраняем информацию о пользователе в request для использования в контроллере
    req.user = user;
    req.tokenBalance = balance;
    req.imageCost = IMAGE_COST;

    next();
  } catch (error) {
    console.error('Error in checkTokensMiddleware:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while checking tokens'
    });
  }
}

/**
 * Middleware для списания токенов после успешной генерации
 * Используется в контроллере после успешной генерации
 */
export async function deductTokensAfterGeneration(userId, description = 'Генерация изображения', amount = 25) {
  const success = await spendUserTokens(userId, amount, description);

  if (!success) {
    console.error(`Failed to deduct tokens for user ${userId}`);
    throw new Error('Failed to deduct tokens');
  }

  return true;
}



