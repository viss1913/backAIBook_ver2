import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Исправляет ошибки в поисковом запросе и извлекает название и автора через Gemini.
 * @param {string} rawQuery - "Шекспир. Ромео и жельета"
 * @returns {Promise<{title: string, author: string}>}
 */
export async function refineSearchQuery(rawQuery) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn('GEMINI_API_KEY is not set, skipping AI query refinement');
        return { title: rawQuery, author: '' };
    }

    try {
        console.log(`Refining query: "${rawQuery}" via Gemini...`);
        const response = await axios.post(
            OPENROUTER_API_URL,
            {
                model: 'google/gemini-2.0-flash-001',
                messages: [
                    {
                        role: 'system',
                        content: `You are a helpful librarian. The user provides a raw book search query, possibly with typos or in a messy format. 
            Extract the correct book title and author name in Russian (if likely Russian/Classic) or original language.
            Respond strictly in JSON format: {"title": "...", "author": "..."}.
            If author is missing, leave empty string. 
            Example: "Ромео и жельета" -> {"title": "Ромео и Джульетта", "author": "Уильям Шекспир"}`
                    },
                    {
                        role: 'user',
                        content: rawQuery
                    }
                ],
                response_format: { type: 'json_object' }
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );

        const content = response.data.choices[0].message.content;
        console.log('Gemini raw response:', content);
        const result = JSON.parse(content);
        console.log('Refined query:', result);
        return result;
    } catch (error) {
        console.error('Error refining query with AI:', error.message);
        if (error.response) {
            console.error('AI Error details:', JSON.stringify(error.response.data));
        }
        return { title: rawQuery, author: '' };
    }
}
