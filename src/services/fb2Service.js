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
    const finalApiKey = apiKey || process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY;
    console.log('=== analyzeContentWithGemini ===');

    const userPrompt = generateAnalysisPromptTemplate(textChunk);
    const systemPrompt = 'You are a literary analyst and art director. Your task is to find the most visually impactful moments in a book text for illustration.';

    try {
        const response = await axios.post(OPENROUTER_API_URL, {
            model: 'google/gemini-2.0-flash-001', // Stable Flash model
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
/**
 * Внедряет изображения в структуру FB2
 * @param {Object} fb2Data - Объект данных FB2 (из fast-xml-parser)
 * @param {Array} illustrations - Массив иллюстраций ({id, base64Data, anchorText, prompt})
 */
export function injectImagesToFB2(fb2Data, illustrations) {
    if (!illustrations || illustrations.length === 0) return fb2Data;

    // 1. Добавляем секции <binary>
    if (!fb2Data.FictionBook.binary) {
        fb2Data.FictionBook.binary = [];
    } else if (!Array.isArray(fb2Data.FictionBook.binary)) {
        fb2Data.FictionBook.binary = [fb2Data.FictionBook.binary];
    }

    // Хелпер для рекурсивного поиска и вставки (упрощенный)
    const insertImageToSectionWithText = (node, anchorText, imageId) => {
        if (!node) return false;

        const nodeStr = JSON.stringify(node);
        // Если текст найден где-то в этом узле
        if (nodeStr.includes(anchorText)) {
            // Если это секция (имеет <p> или просто структуру секции)
            // Структура обычно: section: { p: [...], ... } или просто section: [...]
            if (node.section) {
                if (Array.isArray(node.section)) {
                    for (let s of node.section) {
                        if (insertImageToSectionWithText(s, anchorText, imageId)) return true;
                    }
                } else {
                    return insertImageToSectionWithText(node.section, anchorText, imageId);
                }
            }

            // Если мы добрались до уровня где есть 'p' (параграфы), или это конечная секция
            // Просто добавляем тег image в эту секцию
            if (!node.image) {
                node.image = [];
            } else if (!Array.isArray(node.image)) {
                node.image = [node.image];
            }

            // Проверяем, не дублируем ли мы картинку
            if (!node.image.some(img => img['@_l:href'] === `#${imageId}`)) {
                node.image.push({
                    "@_l:href": `#${imageId}`
                });
            }
            return true;
        }
        return false;
    };

    illustrations.forEach((ill, index) => {
        const imageId = ill.id || `ill_${index + 1}.png`;

        // 1. Binary data
        // Проверяем на дубликаты
        if (!fb2Data.FictionBook.binary.some(b => b['@_id'] === imageId)) {
            fb2Data.FictionBook.binary.push({
                "@_id": imageId,
                "@_content-type": "image/png",
                "#text": ill.base64Data
            });
        }

        // 2. Вставка ссылки в текст
        let body = fb2Data.FictionBook.body;
        if (Array.isArray(body)) {
            // Ищем в основном теле
            insertImageToSectionWithText(body[0], ill.anchorText, imageId);
        } else {
            insertImageToSectionWithText(body, ill.anchorText, imageId);
        }
    });

    const builder = new XMLBuilder({
        ignoreAttributes: false,
        format: true,
        suppressEmptyNode: true,
        attributeNamePrefix: "@_"
    });

    return builder.build(fb2Data);
}
