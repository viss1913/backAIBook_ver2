import axios from 'axios';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { generateCoverPromptTemplate, generateAnalysisPromptTemplate } from '../utils/promptTemplate.js';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT = 60000;

/**
 * Анализирует текст книги через Gemini для поиска точек вставки иллюстраций
 * @param {string} apiKey - API ключ OpenRouter
 * @param {string} textChunk - Текст для анализа
 * @returns {Promise<Array>} Массив объектов с точками вставки
 */
export async function analyzeContentWithGemini(apiKey, textChunk) {
    console.log('=== analyzeContentWithGemini ===');

    const userPrompt = generateAnalysisPromptTemplate(textChunk);
    const systemPrompt = 'You are a literary analyst and art director. Your task is to find the most visually impactful moments in a book text for illustration.';

    try {
        const response = await axios.post(OPENROUTER_API_URL, {
            model: 'google/gemini-2.0-flash-exp', // Используем быструю модель для анализа
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: TIMEOUT
        });

        const content = response.data?.choices?.[0]?.message?.content;
        if (!content) throw new Error('Failed to get analysis from Gemini');

        // Gemini может вернуть JSON в блоке кода или напрямую
        const jsonStr = content.includes('```json')
            ? content.match(/```json\n([\s\S]*?)\n```/)?.[1] || content
            : content;

        const result = JSON.parse(jsonStr);
        return Array.isArray(result) ? result : result.illustrations || [];
    } catch (error) {
        console.error('Gemini analysis error:', error.message);
        throw error;
    }
}

/**
 * Парсит файл FB2 и извлекает метаданные и основной текст
 * @param {Buffer} fileBuffer - Содержимое файла FB2
 */
export function parseFB2(fileBuffer) {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_"
    });
    const fb2Data = parser.parse(fileBuffer.toString());

    const description = fb2Data.FictionBook?.description?.['title-info'];
    const title = description?.['book-title'] || 'Unknown Title';
    const authorData = description?.author;
    const author = Array.isArray(authorData)
        ? `${authorData[0]?.['first-name']} ${authorData[0]?.['last-name']}`
        : `${authorData?.['first-name']} ${authorData?.['last-name']}`;

    return { fb2Data, title, author };
}

/**
 * Внедряет изображения в структуру FB2
 * @param {Object} fb2Data - Объект данных FB2
 * @param {Array} illustrations - Массив иллюстраций ({imageUrl, offset, id})
 */
export function injectImagesToFB2(fb2Data, illustrations) {
    // 1. Добавляем секции <binary> для каждого изображения
    if (!fb2Data.FictionBook.binary) {
        fb2Data.FictionBook.binary = [];
    } else if (!Array.isArray(fb2Data.FictionBook.binary)) {
        fb2Data.FictionBook.binary = [fb2Data.FictionBook.binary];
    }

    illustrations.forEach((ill, index) => {
        const id = `ill_${index + 1}.png`;
        // Важно: в реальном приложении здесь нужно скачать изображение и сконвертировать в Base64
        // Пока добавим плейсхолдер или URL если FB2 ридер это поддерживает (обычно нет)
        fb2Data.FictionBook.binary.push({
            "@_id": id,
            "@_content-type": "image/png",
            "#text": ill.base64Data // Здесь должна быть base64 строка
        });

        // 2. Вставка тега <image> в тело текста по офсету - это сложная часть
        // Для MVP можно просто добавлять в начало глав
    });

    const builder = new XMLBuilder({
        ignoreAttributes: false,
        format: true
    });
    return builder.build(fb2Data);
}
