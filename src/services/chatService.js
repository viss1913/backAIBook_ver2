import axios from 'axios';
import { saveChatMessage, getChatContext, updateChatSummary, getMessageCount } from '../utils/database.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GEMINI_MODEL = 'google/gemini-2.0-flash-001';

/**
 * Генерирует потоковый ответ от ИИ с учетом истории и саммари.
 */
export async function streamChatResponse(chatId, userMessage, onToken) {
    // 1. Получаем контекст (саммари + последние 20 сообщений)
    const { summary, messages } = await getChatContext(chatId, 20);

    // 2. Формируем историю для ИИ
    const history = messages.map(msg => ({
        role: msg.role,
        content: msg.content
    }));

    // Добавляем текущее сообщение пользователя (еще не в БД для контекста)
    history.push({ role: 'user', content: userMessage });

    const systemPrompt = ` Ты — профессиональный книжный консультант и литературный критик. Помогай пользователю выбирать книги и обсуждать их.
    Если у тебя есть "Долгосрочная память" ниже — используй её для понимания предпочтений пользователя.
    
    Долгосрочная память: ${summary || 'Пока пуста.'} `;

    const payload = {
        model: GEMINI_MODEL,
        stream: true,
        messages: [
            { role: 'system', content: systemPrompt },
            ...history
        ]
    };

    let fullResponse = '';

    try {
        const response = await axios({
            method: 'POST',
            url: OPENROUTER_URL,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`
            },
            data: payload,
            responseType: 'stream'
        });

        return new Promise((resolve, reject) => {
            response.data.on('data', chunk => {
                const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
                for (const line of lines) {
                    const message = line.replace(/^data: /, '');
                    if (message === '[DONE]') break;
                    try {
                        const parsed = JSON.parse(message);
                        const token = parsed.choices[0]?.delta?.content || '';
                        if (token) {
                            fullResponse += token;
                            onToken(token); // Отдаем токен во внешний колбэк
                        }
                    } catch (e) {
                        // Пропускаем невалидный JSON
                    }
                }
            });

            response.data.on('end', async () => {
                // Сохраняем переписку
                await saveChatMessage(chatId, 'user', userMessage);
                await saveChatMessage(chatId, 'assistant', fullResponse);

                // Если пора — обновляем саммари (каждые 20 сообщений)
                const count = await getMessageCount(chatId);
                if (count > 0 && count % 20 === 0) {
                    await triggerSummarization(chatId, summary, history);
                }

                resolve(fullResponse);
            });

            response.data.on('error', reject);
        });
    } catch (error) {
        console.error('Chat Service Error:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Фоновое обновление саммари (сжатие памяти)
 */
async function triggerSummarization(chatId, oldSummary, history) {
    console.log(`Triggering summarization for chat ${chatId}...`);
    const prompt = `Обнови краткое описание интересов и предпочтений пользователя на основе этой переписки. 
    Старое описание: ${oldSummary}
    
    Переписка:
    ${history.map(m => `${m.role}: ${m.content}`).join('\n')}
    
    Выдай только обновленный краткий текст профиля пользователя.`;

    try {
        const response = await axios.post(OPENROUTER_URL, {
            model: GEMINI_MODEL,
            messages: [{ role: 'user', content: prompt }]
        }, {
            headers: { 'Authorization': `Bearer ${process.env.GEMINI_API_KEY}` }
        });

        const newSummary = response.data.choices[0]?.message?.content;
        if (newSummary) {
            await updateChatSummary(chatId, newSummary);
            console.log('Summary updated successfully');
        }
    } catch (e) {
        console.error('Summarization failed:', e.message);
    }
}
