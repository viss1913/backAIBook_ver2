import axios from 'axios';
import { generateImagePrompt } from '../utils/promptTemplate.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const LAOZHANG_API_URL = 'https://api.laozhang.ai/v1/images/generations';
const TIMEOUT = 30000; // 30 секунд

/**
 * Создает клиент axios с настройками для Gemini API
 */
function createGeminiClient(apiKey) {
  return axios.create({
    baseURL: GEMINI_API_URL,
    timeout: TIMEOUT,
    headers: {
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
  console.log('=== generatePromptForImage (Gemini) ===');
  console.log('API Key exists:', !!apiKey);
  console.log('API Key starts with:', apiKey ? apiKey.substring(0, 10) + '...' : 'N/A');
  
  const client = createGeminiClient(apiKey);
  const userPrompt = generateImagePrompt(bookTitle, author, textChunk);
  
  // Gemini использует другой формат - system instruction в отдельном поле
  const systemInstruction = 'Создай промпт для image generation. Ты эксперт по созданию детальных, художественных промптов для генерации изображений.';

  try {
    console.log('Sending request to Gemini API...');
    // Gemini API использует ключ в URL параметре
    const response = await client.post(`/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
      contents: [{
        parts: [{
          text: userPrompt
        }]
      }],
      systemInstruction: {
        parts: [{
          text: systemInstruction
        }]
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500
      }
    });

    console.log('Gemini API response received');
    const generatedPrompt = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!generatedPrompt) {
      console.error('No prompt in response:', JSON.stringify(response.data));
      throw new Error('Failed to generate prompt from Gemini API');
    }

    console.log('Prompt generated successfully');
    return generatedPrompt;
  } catch (error) {
    console.error('Gemini API error:', error.message);
    console.error('Error status:', error.response?.status);
    console.error('Error data:', error.response?.data);
    
    if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.error('Gemini API returned 401/403 - Invalid API key');
      console.error('API Key provided:', apiKey ? apiKey.substring(0, 10) + '...' : 'N/A');
      throw new Error('Invalid Gemini API key. Please check your GEMINI_API_KEY environment variable.');
    }
    throw new Error(`Gemini API error: ${error.message}`);
  }
}

/**
 * Создает клиент axios для LaoZhang API
 */
function createLaoZhangClient(apiKey) {
  return axios.create({
    baseURL: LAOZHANG_API_URL,
    timeout: TIMEOUT,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Генерирует изображение через LaoZhang API
 * @param {string} apiKey - API ключ LaoZhang
 * @param {string} prompt - Промпт для генерации изображения
 * @param {string} bookTitle - Название книги
 * @param {string} author - Автор книги
 * @param {string} model - Модель для генерации (по умолчанию 'flux-kontext-pro')
 * @returns {Promise<string>} URL сгенерированного изображения
 */
async function generateImage(laoZhangApiKey, prompt, bookTitle, author, model = 'flux-kontext-pro') {
  const client = createLaoZhangClient(laoZhangApiKey);

  try {
    // Добавляем контекст про человека, читающего книгу
    const imagePrompt = `Человек читает книгу "${bookTitle}" автора ${author}. ${prompt}`;

    const response = await client.post('', {
      model: model,
      prompt: imagePrompt,
      n: 1,
      size: '1024x1024'
    });

    // LaoZhang API возвращает OpenAI-совместимый формат
    const imageUrl = response.data?.data?.[0]?.url;
    
    if (!imageUrl) {
      throw new Error('No image URL in response from LaoZhang API');
    }

    return imageUrl;
  } catch (error) {
    if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (error.response?.status === 401) {
      throw new Error('Invalid LaoZhang API key');
    }
    if (error.response?.status) {
      const errorMessage = error.response.data?.error?.message || error.message;
      throw new Error(`LaoZhang API error (${error.response.status}): ${errorMessage}`);
    }
    throw new Error(`Image generation error: ${error.message}`);
  }
}

/**
 * Основная функция для генерации изображения
 * @param {string} geminiApiKey - API ключ Gemini (для генерации промпта)
 * @param {string} laoZhangApiKey - API ключ LaoZhang (для генерации изображения)
 * @param {string} bookTitle - Название книги
 * @param {string} author - Автор
 * @param {string} textChunk - Фрагмент текста
 * @param {string} imageModel - Модель для генерации изображения (по умолчанию 'flux-kontext-pro')
 * @returns {Promise<{imageUrl: string, promptUsed: string}>}
 */
export async function generateImageFromText(geminiApiKey, laoZhangApiKey, bookTitle, author, textChunk, imageModel = 'flux-kontext-pro') {
  try {
    // Шаг 1: Генерируем промпт для изображения через Gemini
    const imagePrompt = await generatePromptForImage(geminiApiKey, bookTitle, author, textChunk);
    
    // Шаг 2: Генерируем изображение через LaoZhang API, добавляя контекст про человека, читающего книгу
    const imageUrl = await generateImage(laoZhangApiKey, imagePrompt, bookTitle, author, imageModel);

    return {
      imageUrl,
      promptUsed: imagePrompt
    };
  } catch (error) {
    throw error;
  }
}

