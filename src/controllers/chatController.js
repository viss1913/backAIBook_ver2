import * as chatService from '../services/chatService.js';
import * as db from '../utils/database.js';

export async function loginUser(req, res) {
    try {
        const { deviceId, displayName } = req.body;
        if (!deviceId) return res.status(400).json({ error: 'deviceId is required' });

        const user = await db.getOrCreateUser(deviceId, displayName || 'User');
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function createNewChat(req, res) {
    try {
        const { userId, title } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId is required' });

        const chatId = await db.createChat(userId, title);
        res.json({ success: true, chatId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function getChats(req, res) {
    try {
        const { userId } = req.params;
        const chats = await db.getUserChats(userId);
        res.json({ success: true, chats });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function getHistory(req, res) {
    try {
        const { chatId } = req.params;
        const { messages } = await db.getChatContext(chatId, 100);
        res.json({ success: true, messages });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

/**
 * Потоковый чат (SSE)
 */
export async function chatStream(req, res) {
    const { chatId, message } = req.body;

    if (!chatId || !message) {
        return res.status(400).write('data: {"error": "Missing chatId or message"}\n\n');
    }

    // Устанавливаем заголовки для SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
        await chatService.streamChatResponse(chatId, message, (token) => {
            // Отправляем токен клиенту
            res.write(`data: ${JSON.stringify({ token })}\n\n`);
        });

        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error) {
        console.error('SSE Error:', error);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
}
