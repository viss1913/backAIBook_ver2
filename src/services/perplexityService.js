import axios from 'axios';
import { generateImagePrompt } from '../utils/promptTemplate.js';

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const TIMEOUT = 30000; // 30 секунд

/**
 * Создает клиент axios с настройками для Perplexity API
 */
function createPerplexityClient(apiKey) {
  return axios.create({
    baseURL: PERPLEXITY_API_URL,
    timeout: TIMEOUT,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Генерирует промпт для изображения через Perplexity API
 * @param {string} apiKey - API ключ Perplexity
 * @param {string} bookTitle - Название книги
 * @param {string} author - Автор
 * @param {string} textChunk - Фрагмент текста
 * @returns {Promise<string>} Сгенерированный промпт
 */
async function generatePromptForImage(apiKey, bookTitle, author, textChunk) {
  const client = createPerplexityClient(apiKey);
  const systemPrompt = 'Создай промпт для image generation. Ты эксперт по созданию детальных, художественных промптов для генерации изображений.';
  const userPrompt = generateImagePrompt(bookTitle, author, textChunk);

  try {
    const response = await client.post('', {
      model: 'llama-3.1-sonar-huge-128k-online',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const generatedPrompt = response.data?.choices?.[0]?.message?.content?.trim();
    if (!generatedPrompt) {
      throw new Error('Failed to generate prompt from Perplexity API');
    }

    return generatedPrompt;
  } catch (error) {
    if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (error.response?.status === 401) {
      throw new Error('Invalid API key');
    }
    throw new Error(`Perplexity API error: ${error.message}`);
  }
}

/**
 * Генерирует изображение через Perplexity API
 * Использует специальный запрос для генерации изображения
 * @param {string} apiKey - API ключ Perplexity
 * @param {string} prompt - Промпт для генерации изображения
 * @returns {Promise<string>} URL сгенерированного изображения
 */
async function generateImage(apiKey, prompt) {
  const client = createPerplexityClient(apiKey);

  try {
    // Запрос на генерацию изображения через Perplexity
    // Используем специальный промпт, который просит API сгенерировать изображение
    const imageRequestPrompt = `Based on this detailed image generation prompt, generate an image and return the image URL. The prompt is: ${prompt}. Return only the direct URL to the generated image.`;

    const response = await client.post('', {
      model: 'llama-3.1-sonar-huge-128k-online',
      messages: [
        {
          role: 'system',
          content: 'You are an image generation assistant. When asked to generate an image, you must return a direct URL to the generated image.'
        },
        {
          role: 'user',
          content: imageRequestPrompt
        }
      ],
      temperature: 0.5,
      max_tokens: 200
    });

    const content = response.data?.choices?.[0]?.message?.content?.trim();
    
    if (!content) {
      throw new Error('Empty response from Perplexity API');
    }

    // Ищем URL в ответе (может быть в разных форматах)
    const urlPatterns = [
      /https?:\/\/[^\s\)"']+\.(jpg|jpeg|png|webp|gif)/i,
      /https?:\/\/cdn\.perplexity\.ai\/[^\s\)"']+/i,
      /https?:\/\/[^\s\)"']+/
    ];

    for (const pattern of urlPatterns) {
      const match = content.match(pattern);
      if (match) {
        return match[0];
      }
    }

    // Если URL не найден в тексте, возможно API вернул JSON
    try {
      const jsonMatch = content.match(/\{.*"url".*:.*"([^"]+)".*\}/);
      if (jsonMatch) {
        return jsonMatch[1];
      }
    } catch (e) {
      // Игнорируем ошибки парсинга JSON
    }

    throw new Error('No image URL found in response. Response: ' + content.substring(0, 100));
  } catch (error) {
    if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (error.response?.status === 401) {
      throw new Error('Invalid API key');
    }
    if (error.response?.status) {
      throw new Error(`Perplexity API error (${error.response.status}): ${error.response.data?.error?.message || error.message}`);
    }
    throw new Error(`Image generation error: ${error.message}`);
  }
}

/**
 * Основная функция для генерации изображения
 * @param {string} apiKey - API ключ Perplexity
 * @param {string} bookTitle - Название книги
 * @param {string} author - Автор
 * @param {string} textChunk - Фрагмент текста
 * @returns {Promise<{imageUrl: string, promptUsed: string}>}
 */
/**
 * Основная функция для генерации изображения
 * @param {string} apiKey - API ключ Perplexity
 * @param {string} bookTitle - Название книги
 * @param {string} author - Автор
 * @param {string} textChunk - Фрагмент текста
 * @returns {Promise<{imageUrl: string, promptUsed: string}>}
 */
export async function generateImageFromText(apiKey, bookTitle, author, textChunk) {
  try {
    // Шаг 1: Генерируем промпт для изображения через Perplexity
    const imagePrompt = await generatePromptForImage(apiKey, bookTitle, author, textChunk);
    
    // Шаг 2: Генерируем изображение используя созданный промпт
    const imageUrl = await generateImage(apiKey, imagePrompt);

    return {
      imageUrl,
      promptUsed: imagePrompt
    };
  } catch (error) {
    throw error;
  }
}

