import { rewriteTextFragment } from '../services/aiRewriteService.js';
import { getOrCreateUser, getUserTokenBalance, addUserTokens } from '../utils/database.js';

export async function rewriteFragment(req, res) {
    try {
        const { text, style, deviceId } = req.body;

        if (!text || !style) {
            return res.status(400).json({ success: false, error: 'Text and style are required' });
        }

        if (!deviceId) {
            return res.status(400).json({ success: false, error: 'DeviceId is required for billing' });
        }

        const apiKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ success: false, error: 'Server AI configuration missing' });
        }

        // 1. Проверка баланса перед операцией
        const user = await getOrCreateUser(deviceId);
        const currentBalance = await getUserTokenBalance(user.id);

        if (currentBalance <= 0) {
            return res.status(402).json({
                success: false,
                error: 'Not enough tokens',
                balance: currentBalance
            });
        }

        // 2. Выполнение рерайта
        const result = await rewriteTextFragment(text, style, apiKey);

        // 3. Списание токенов
        let charged = false;
        if (result.tokensCost > 0 && !result.isCached) {
            // Списываем только если не кэш
            await addUserTokens(user.id, -result.tokensCost, `JIT Перевод: ${style}`, null);
            charged = true;
        }

        const newBalance = await getUserTokenBalance(user.id);

        return res.json({
            success: true,
            data: {
                ...result,
                charged: charged
            },
            balance: newBalance
        });

    } catch (error) {
        console.error('Rewrite Controller Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
