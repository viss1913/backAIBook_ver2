import axios from 'axios';
import { generateImagePrompt } from '../utils/promptTemplate.js';

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const LAOZHANG_API_URL = 'https://api.laozhang.ai/v1/images/generations';
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
  console.log('=== generatePromptForImage ===');
  console.log('API Key exists:', !!apiKey);
  console.log('API Key starts with:', apiKey ? apiKey.substring(0, 10) + '...' : 'N/A');
  
  const client = createPerplexityClient(apiKey);
  const systemPrompt = 'Создай промпт для image generation. Ты эксперт по созданию детальных, художественных промптов для генерации изображений.';
  const userPrompt = generateImagePrompt(bookTitle, author, textChunk);

  try {
    console.log('Sending request to Perplexity API...');
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

    console.log('Perplexity API response received');
    const generatedPrompt = response.data?.choices?.[0]?.message?.content?.trim();
    if (!generatedPrompt) {
      console.error('No prompt in response:', JSON.stringify(response.data));
      throw new Error('Failed to generate prompt from Perplexity API');
    }

    console.log('Prompt generated successfully');
    return generatedPrompt;
  } catch (error) {
    console.error('Perplexity API error:', error.message);
    console.error('Error status:', error.response?.status);
    console.error('Error data:', error.response?.data);
    
    if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (error.response?.status === 401) {
      console.error('Perplexity API returned 401 - Invalid API key');
      console.error('API Key provided:', apiKey ? apiKey.substring(0, 10) + '...' : 'N/A');
      throw new Error('Invalid Perplexity API key. Please check your PERPLEXITY_API_KEY environment variable.');
    }
    throw new Error(`Perplexity API error: ${error.message}`);
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
 * @param {string} perplexityApiKey - API ключ Perplexity (для генерации промпта)
 * @param {string} laoZhangApiKey - API ключ LaoZhang (для генерации изображения)
 * @param {string} bookTitle - Название книги
 * @param {string} author - Автор
 * @param {string} textChunk - Фрагмент текста
 * @param {string} imageModel - Модель для генерации изображения (по умолчанию 'flux-kontext-pro')
 * @returns {Promise<{imageUrl: string, promptUsed: string}>}
 */
export async function generateImageFromText(perplexityApiKey, laoZhangApiKey, bookTitle, author, textChunk, imageModel = 'flux-kontext-pro') {
  try {
    // Шаг 1: Генерируем промпт для изображения через Perplexity
    const imagePrompt = await generatePromptForImage(perplexityApiKey, bookTitle, author, textChunk);
    
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

