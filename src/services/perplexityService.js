import axios from 'axios';
import { generateImagePrompt } from '../utils/promptTemplate.js';

import https from 'https';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const LAOZHANG_API_URL = 'https://api.laozhang.ai/v1/images/generations';
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const GETIMG_API_URL = 'https://api.getimg.ai/v1';
const GIGACHAT_OAUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
const GIGACHAT_API_URL = 'https://gigachat.devices.sberbank.ru/api/v1';
const GEN_API_BASE = 'https://api.gen-api.ru/api/v1';
const TIMEOUT = 30000; // 30 секунд

// Хранилище для асинхронных запросов Gen-API (в памяти)
// В production лучше использовать Redis или БД
const genApiRequests = new Map(); // request_id -> { promise, resolve, reject }

// HTTPS agent для GigaChat (отключаем проверку SSL)
const gigachatHttpsAgent = new https.Agent({
  rejectUnauthorized: false
});

/**
 * Создает клиент axios с настройками для OpenRouter API
 */
function createOpenRouterClient(apiKey) {
  return axios.create({
    baseURL: OPENROUTER_API_URL,
    timeout: TIMEOUT,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/viss1913/backAIBook_ver2', // Опционально, для статистики
      'X-Title': 'AI Book Reader Backend' // Опционально
    }
  });
}

/**
 * Генерирует промпт для изображения через OpenRouter API (Gemini модель)
 * @param {string} apiKey - API ключ OpenRouter
 * @param {string} bookTitle - Название книги
 * @param {string} author - Автор
 * @param {string} textChunk - Фрагмент текста
 * @returns {Promise<string>} Сгенерированный промпт
 */
export async function generatePromptForImage(apiKey, bookTitle, author, textChunk, prevSceneDescription = null, audience = 'adults') {
  console.log('=== generatePromptForImage (OpenRouter/Gemini) ===');
  console.log('API Key exists:', !!apiKey);
  console.log('API Key starts with:', apiKey ? apiKey.substring(0, 10) + '...' : 'N/A');
  console.log('Book:', bookTitle, 'by', author);
  console.log('Audience:', audience);
  console.log('Previous scene provided:', !!prevSceneDescription);

  const client = createOpenRouterClient(apiKey);
  const userPrompt = generateImagePrompt(bookTitle, author, textChunk, prevSceneDescription, audience);
  const systemPrompt = 'You are an expert at creating detailed, artistic prompts for AI image generators. Your task is to analyze book text and create professional image generation prompts in English.';

  try {
    const modelName = 'google/gemini-2.0-flash-001';
    console.log('Using OpenRouter model:', modelName);

    console.log('Payload for OpenRouter:', JSON.stringify({
      model: modelName,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
    }));

    const response = await client.post('', {
      model: modelName,
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
      max_tokens: 800  // Увеличено для более детальных промптов (100-200 слов)
    });

    console.log('OpenRouter API response received');
    const generatedPrompt = response.data?.choices?.[0]?.message?.content?.trim();
    if (!generatedPrompt) {
      console.error('No prompt in response:', JSON.stringify(response.data));
      throw new Error('Failed to generate prompt from OpenRouter API');
    }

    console.log('Prompt generated successfully');
    return generatedPrompt;
  } catch (error) {
    console.error('OpenRouter API error:', error.message);
    console.error('Error status:', error.response?.status);
    console.error('Error data:', error.response?.data);

    if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.error('OpenRouter API returned 401/403 - Invalid API key');
      console.error('API Key provided:', apiKey ? apiKey.substring(0, 10) + '...' : 'N/A');
      throw new Error('Invalid OpenRouter API key. Please check your GEMINI_API_KEY (OpenRouter key) environment variable.');
    }
    throw new Error(`OpenRouter API error: ${error.message}`);
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
async function generateImage(laoZhangApiKey, prompt, bookTitle, author, model = 'flux-kontext-pro', styleSuffix = '') {
  const client = createLaoZhangClient(laoZhangApiKey);

  try {
    // Добавляем контекст и стиль
    const imagePrompt = `Человек читает книгу "${bookTitle}" автора ${author}. ${prompt.trim()}${styleSuffix ? ', ' + styleSuffix : ''}`;
    console.log('Final image prompt for LaoZhang:', imagePrompt);

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
 * @param {string} openRouterApiKey - API ключ OpenRouter (для генерации промпта через Gemini)
 * @param {string} laoZhangApiKey - API ключ LaoZhang (для генерации изображения)
 * @param {string} bookTitle - Название книги
 * @param {string} author - Автор
 * @param {string} textChunk - Фрагмент текста
 * @param {string} imageModel - Модель для генерации изображения (по умолчанию 'flux-kontext-pro')
 * @returns {Promise<{imageUrl: string, promptUsed: string}>}
 */
/**
 * Создает клиент axios для Perplexity API
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
 * Получает изображения через Perplexity API на основе текстового запроса
 * @param {string} apiKey - API ключ Perplexity
 * @param {string} query - Текстовый запрос для поиска изображений
 * @param {Object} options - Дополнительные опции
 * @param {string[]} options.imageFormatFilter - Фильтр по форматам изображений (jpeg, png, webp, gif, svg, bmp)
 * @param {string[]} options.imageDomainFilter - Фильтр по доменам (например, ["-gettyimages.com"] для исключения)
 * @returns {Promise<{images: Array, textResponse: string, citations: Array}>}
 */
export async function getImagesFromPerplexity(apiKey, query, options = {}) {
  console.log('=== getImagesFromPerplexity ===');
  console.log('Query:', query);

  const client = createPerplexityClient(apiKey);

  const requestData = {
    model: 'sonar',
    return_images: true,
    messages: [
      {
        role: 'user',
        content: query
      }
    ]
  };

  // Добавляем фильтры, если они указаны
  if (options.imageFormatFilter && options.imageFormatFilter.length > 0) {
    requestData.image_format_filter = options.imageFormatFilter;
  }

  if (options.imageDomainFilter && options.imageDomainFilter.length > 0) {
    requestData.image_domain_filter = options.imageDomainFilter;
  }

  try {
    console.log('Sending request to Perplexity API...');
    const response = await client.post('', requestData);

    console.log('Perplexity API response received');

    const images = response.data?.images || [];
    const textResponse = response.data?.choices?.[0]?.message?.content || '';
    const citations = response.data?.citations || [];
    const searchResults = response.data?.search_results || [];

    console.log(`Found ${images.length} images`);

    return {
      images: images.map(img => ({
        imageUrl: img.image_url,
        originUrl: img.origin_url,
        title: img.title,
        width: img.width,
        height: img.height
      })),
      textResponse,
      citations,
      searchResults
    };
  } catch (error) {
    console.error('Perplexity API error:', error.message);
    console.error('Error status:', error.response?.status);
    console.error('Error data:', error.response?.data);

    if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (error.response?.status === 401 || error.response?.status === 403) {
      throw new Error('Invalid Perplexity API key');
    }
    if (error.response?.status === 400) {
      const errorMessage = error.response.data?.error?.message || error.message;
      throw new Error(`Perplexity API validation error: ${errorMessage}`);
    }
    throw new Error(`Perplexity API error: ${error.message}`);
  }
}

/**
 * Создает клиент axios для GetImg API
 */
function createGetImgClient(apiKey) {
  return axios.create({
    baseURL: GETIMG_API_URL,
    timeout: 60000, // 60 секунд для генерации изображений
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Генерирует изображение через GetImg API
 * @param {string} apiKey - API ключ GetImg
 * @param {string} prompt - Промпт для генерации изображения
 * @param {string} model - Модель для генерации (по умолчанию 'seedream-v4')
 * @param {Object} options - Дополнительные опции
 * @param {number} options.width - Ширина изображения (по умолчанию 1024)
 * @param {number} options.height - Высота изображения (по умолчанию 1024)
 * @param {number} options.steps - Количество шагов (по умолчанию 28)
 * @param {number} options.guidance - Guidance scale (по умолчанию 7.5)
 * @returns {Promise<string>} URL сгенерированного изображения
 */
async function generateImageWithGetImg(apiKey, prompt, model = 'seedream-v4', options = {}) {
  console.log('=== generateImageWithGetImg ===');
  console.log('Model:', model);
  console.log('Prompt:', prompt.substring(0, 100) + '...');

  const client = createGetImgClient(apiKey);

  const {
    width = 1024,
    height = 1024,
    steps = 28,
    guidance = 7.5
  } = options;

  const requestData = {
    prompt: prompt,
    width: width,
    height: height,
    steps: steps,
    guidance: guidance
  };

  try {
    console.log('Sending request to GetImg API...');
    const response = await client.post(`/${model}/text-to-image`, requestData);

    console.log('GetImg API response received');

    // GetImg API возвращает изображение в base64 или URL
    // Проверяем формат ответа
    let imageUrl;
    if (response.data.image) {
      // Если изображение в base64, конвертируем в data URL
      imageUrl = `data:image/png;base64,${response.data.image}`;
    } else if (response.data.url) {
      // Если есть прямой URL
      imageUrl = response.data.url;
    } else if (response.data.data && response.data.data[0] && response.data.data[0].url) {
      // Если формат как у OpenAI
      imageUrl = response.data.data[0].url;
    } else {
      console.error('Unexpected response format:', JSON.stringify(response.data));
      throw new Error('No image URL in response from GetImg API');
    }

    console.log('Image generated successfully');
    return imageUrl;
  } catch (error) {
    console.error('GetImg API error:', error.message);
    console.error('Error status:', error.response?.status);
    console.error('Error data:', error.response?.data);

    if (error.response?.status === 402) {
      const errorMessage = error.response.data?.error?.message || 'Quota exceeded. Please top-up your GetImg account.';
      throw new Error(`GetImg API quota exceeded: ${errorMessage}`);
    }
    if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (error.response?.status === 401 || error.response?.status === 403) {
      throw new Error('Invalid GetImg API key');
    }
    if (error.response?.status === 400) {
      const errorMessage = error.response.data?.error?.message || error.response.data?.message || error.message;
      throw new Error(`GetImg API validation error: ${errorMessage}`);
    }
    throw new Error(`GetImg API error: ${error.message}`);
  }
}

export async function generateImageFromText(openRouterApiKey, laoZhangApiKey, bookTitle, author, textChunk, imageModel = 'flux-kontext-pro', prevSceneDescription = null, audience = 'adults', styleSuffix = '') {
  try {
    // Шаг 1: Генерируем промпт для изображения через OpenRouter (Gemini модель)
    const imagePrompt = await generatePromptForImage(openRouterApiKey, bookTitle, author, textChunk, prevSceneDescription, audience);

    // Шаг 2: Генерируем изображение через LaoZhang API
    const imageUrl = await generateImage(laoZhangApiKey, imagePrompt, bookTitle, author, imageModel, styleSuffix);

    return {
      imageUrl,
      promptUsed: imagePrompt
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Генерирует изображение через GetImg API с использованием промпта от OpenRouter
 * @param {string} openRouterApiKey - API ключ OpenRouter (для генерации промпта через Gemini)
 * @param {string} getImgApiKey - API ключ GetImg (для генерации изображения)
 * @param {string} bookTitle - Название книги
 * @param {string} author - Автор
 * @param {string} textChunk - Фрагмент текста
 * @param {string} imageModel - Модель для генерации изображения (по умолчанию 'seedream-v4')
 * @param {Object} options - Дополнительные опции для GetImg API
 * @returns {Promise<{imageUrl: string, promptUsed: string}>}
 */
export async function generateImageFromTextWithGetImg(openRouterApiKey, getImgApiKey, bookTitle, author, textChunk, imageModel = 'seedream-v4', options = {}, prevSceneDescription = null, audience = 'adults', styleSuffix = '') {
  try {
    // Шаг 1: Генерируем промпт для изображения через OpenRouter (Gemini модель)
    const imagePrompt = await generatePromptForImage(openRouterApiKey, bookTitle, author, textChunk, prevSceneDescription, audience);

    // Объединяем промпт со стилем
    const finalPrompt = `${imagePrompt.trim()}${styleSuffix ? ', ' + styleSuffix : ''}`;

    // Шаг 2: Генерируем изображение через GetImg API
    const imageUrl = await generateImageWithGetImg(getImgApiKey, finalPrompt, imageModel, options);

    return {
      imageUrl,
      promptUsed: imagePrompt
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Получает access_token для GigaChat через OAuth
 * @param {string} authKey - Ключ авторизации (Base64)
 * @param {string} clientId - Client ID
 * @param {string} scope - Scope (по умолчанию 'GIGACHAT_API_PERS')
 * @returns {Promise<string>} Access token
 */
async function getGigaChatAccessToken(authKey, clientId, scope = 'GIGACHAT_API_PERS') {
  console.log('=== getGigaChatAccessToken ===');

  try {
    const response = await axios.post(
      GIGACHAT_OAUTH_URL,
      `scope=${scope}`,
      {
        headers: {
          'Authorization': `Basic ${authKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'RqUID': clientId
        },
        httpsAgent: gigachatHttpsAgent,
        timeout: TIMEOUT
      }
    );

    console.log('GigaChat access token obtained');
    return response.data.access_token;
  } catch (error) {
    console.error('GigaChat OAuth error:', error.message);
    console.error('Error status:', error.response?.status);
    console.error('Error data:', error.response?.data);

    if (error.response?.status === 401 || error.response?.status === 403) {
      throw new Error('Invalid GigaChat authorization key');
    }
    throw new Error(`GigaChat OAuth error: ${error.message}`);
  }
}

/**
 * Извлекает file_id из ответа GigaChat
 * @param {string} content - Содержимое ответа модели
 * @returns {string|null} File ID или null
 */
function extractGigaChatImageId(content) {
  const match = content.match(/<img\s+src="([^"]+)"\s+fuse="true"\/>/);
  return match ? match[1] : null;
}

/**
 * Генерирует изображение через GigaChat API
 * @param {string} accessToken - Access token
 * @param {string} prompt - Промпт для генерации изображения
 * @param {string} clientId - Client ID
 * @param {string} systemPrompt - Системный промпт (опционально)
 * @returns {Promise<string>} File ID изображения
 */
async function generateImageWithGigaChat(accessToken, prompt, clientId, systemPrompt = 'Ты помощник для создания изображений.') {
  console.log('=== generateImageWithGigaChat ===');
  console.log('Prompt:', prompt.substring(0, 100) + '...');

  try {
    const response = await axios.post(
      `${GIGACHAT_API_URL}/chat/completions`,
      {
        model: 'GigaChat',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        function_call: 'auto'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Client-ID': clientId
        },
        httpsAgent: gigachatHttpsAgent,
        timeout: 120000 // 120 секунд для генерации (GigaChat может генерировать долго)
      }
    );

    console.log('GigaChat API response received');
    const content = response.data.choices[0]?.message?.content;

    const fileId = extractGigaChatImageId(content);
    if (!fileId) {
      throw new Error('No image ID found in GigaChat response');
    }

    console.log('Image file ID:', fileId);
    return fileId;
  } catch (error) {
    console.error('GigaChat API error:', error.message);
    console.error('Error status:', error.response?.status);
    console.error('Error data:', error.response?.data);

    if (error.response?.status === 401 || error.response?.status === 403) {
      throw new Error('Invalid GigaChat access token');
    }
    throw new Error(`GigaChat API error: ${error.message}`);
  }
}

/**
 * Скачивает изображение из GigaChat по file_id
 * @param {string} accessToken - Access token
 * @param {string} fileId - File ID изображения
 * @param {string} clientId - Client ID
 * @returns {Promise<string>} Base64 строка изображения
 */
async function downloadGigaChatImage(accessToken, fileId, clientId) {
  console.log('=== downloadGigaChatImage ===');
  console.log('File ID:', fileId);

  try {
    const response = await axios.get(
      `${GIGACHAT_API_URL}/files/${fileId}/content`,
      {
        headers: {
          'Accept': 'application/jpg',
          'Authorization': `Bearer ${accessToken}`,
          'X-Client-ID': clientId
        },
        httpsAgent: gigachatHttpsAgent,
        responseType: 'arraybuffer',
        timeout: TIMEOUT
      }
    );

    console.log('Image downloaded, size:', response.data.length, 'bytes');

    // Конвертируем в base64 data URL
    const base64 = Buffer.from(response.data).toString('base64');
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.error('GigaChat download error:', error.message);
    console.error('Error status:', error.response?.status);

    if (error.response?.status === 404) {
      throw new Error('Image file not found in GigaChat');
    }
    throw new Error(`GigaChat download error: ${error.message}`);
  }
}

/**
 * Генерирует изображение через GigaChat API с использованием промпта от OpenRouter
 * @param {string} openRouterApiKey - API ключ OpenRouter (для генерации промпта через Gemini)
 * @param {string} gigachatAuthKey - Ключ авторизации GigaChat (Base64)
 * @param {string} gigachatClientId - Client ID GigaChat
 * @param {string} bookTitle - Название книги
 * @param {string} author - Автор
 * @param {string} textChunk - Фрагмент текста
 * @param {string} scope - Scope для OAuth (по умолчанию 'GIGACHAT_API_PERS')
 * @returns {Promise<{imageUrl: string, promptUsed: string}>}
 */
export async function generateImageFromTextWithGigaChat(openRouterApiKey, gigachatAuthKey, gigachatClientId, bookTitle, author, textChunk, scope = 'GIGACHAT_API_PERS', prevSceneDescription = null, audience = 'adults', styleSuffix = '') {
  try {
    // Шаг 1: Получаем access_token
    const accessToken = await getGigaChatAccessToken(gigachatAuthKey, gigachatClientId, scope);

    // Шаг 2: Генерируем промпт для изображения через OpenRouter (Gemini модель)
    const imagePrompt = await generatePromptForImage(openRouterApiKey, bookTitle, author, textChunk, prevSceneDescription, audience);

    // Шаг 3: Формируем запрос на русском для GigaChat + стиль
    const russianPrompt = `Нарисуй ${imagePrompt.trim()}${styleSuffix ? '. Стиль: ' + styleSuffix : ''}`;
    console.log('GigaChat Prompt:', russianPrompt);

    // Шаг 4: Генерируем изображение через GigaChat
    const fileId = await generateImageWithGigaChat(accessToken, russianPrompt, gigachatClientId);

    // Шаг 5: Скачиваем изображение
    const imageUrl = await downloadGigaChatImage(accessToken, fileId, gigachatClientId);

    return {
      imageUrl,
      promptUsed: imagePrompt
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Создает клиент axios для Gen-API
 */
function createGenApiClient(apiKey) {
  return axios.create({
    baseURL: GEN_API_BASE,
    timeout: TIMEOUT,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
}

/**
 * Обрабатывает callback от Gen-API
 * @param {Object} callbackData - Данные из callback
 */
export async function handleGenApiCallback(callbackData) {
  console.log('=== handleGenApiCallback ===');
  console.log('Callback data:', JSON.stringify(callbackData, null, 2));
  console.log('Current pending requests:', Array.from(genApiRequests.keys()));

  const requestId = callbackData.request_id;
  if (!requestId) {
    console.error('No request_id in callback');
    console.error('Available keys in callbackData:', Object.keys(callbackData));
    return;
  }

  console.log(`Looking for request_id: ${requestId} (type: ${typeof requestId})`);

  // Пробуем найти по разным типам ID (число/строка)
  let request = genApiRequests.get(requestId);

  if (!request) {
    // Пробуем числовой вариант
    const numericId = typeof requestId === 'string' ? parseInt(requestId, 10) : Number(requestId);
    if (!isNaN(numericId)) {
      request = genApiRequests.get(numericId);
      if (request) {
        console.log(`Found request by numeric ID: ${numericId}`);
        // Обновляем ключ на правильный тип
        genApiRequests.delete(numericId);
        genApiRequests.set(requestId, request);
      }
    }
  }

  if (!request) {
    // Пробуем строковый вариант
    const stringId = String(requestId);
    request = genApiRequests.get(stringId);
    if (request) {
      console.log(`Found request by string ID: ${stringId}`);
    }
  }

  if (!request) {
    console.warn(`No pending request found for request_id: ${requestId} (type: ${typeof requestId})`);
    console.warn(`Available request IDs:`, Array.from(genApiRequests.keys()));
    console.warn(`Trying to find by numeric: ${typeof requestId === 'string' ? parseInt(requestId, 10) : Number(requestId)}`);
    return;
  }

  console.log(`Found pending request for ID: ${requestId}`);

  // ВАЖНО: Структура ответа Gen-API:
  // - result: массив с URL ["https://..."]
  // - full_response: массив объектов [{"url": "https://..."}]
  // - output: может отсутствовать (старый формат)

  if (callbackData.status === 'success') {
    // Извлекаем изображение из правильных полей
    let imageUrl = null;

    // Вариант 1: result - массив с URL (ПРАВИЛЬНЫЙ для Gen-API!)
    if (callbackData.result && Array.isArray(callbackData.result) && callbackData.result.length > 0) {
      imageUrl = callbackData.result[0];
      console.log('✅ Изображение найдено в result[0]:', imageUrl);
    }
    // Вариант 2: full_response - массив объектов с url
    else if (callbackData.full_response && Array.isArray(callbackData.full_response) && callbackData.full_response.length > 0) {
      imageUrl = callbackData.full_response[0].url;
      console.log('✅ Изображение найдено в full_response[0].url:', imageUrl);
    }
    // Вариант 3: output (старый формат, может отсутствовать)
    else if (callbackData.output) {
      console.log('📦 Используем старый формат output');

      if (callbackData.output.image) {
        const image = callbackData.output.image;
        if (typeof image === 'string') {
          if (image.startsWith('http')) {
            // Если это URL, передаем напрямую на фронт (не конвертируем в base64)
            imageUrl = image;
          } else if (image.startsWith('data:')) {
            // Уже в формате data URL, передаем как есть
            imageUrl = image;
          } else {
            // Предполагаем, что это base64 строка без префикса
            // Конвертируем в data URL (по умолчанию PNG)
            imageUrl = `data:image/png;base64,${image}`;
          }
        }
      } else if (callbackData.output.image_url) {
        // Передаем URL напрямую на фронт
        imageUrl = callbackData.output.image_url;
      } else if (callbackData.output.url) {
        // Передаем URL напрямую на фронт
        imageUrl = callbackData.output.url;
      }
    }

    if (imageUrl) {
      // Передаем URL напрямую на фронт (не конвертируем в base64)
      // Фронт может загрузить изображение по URL
      console.log('✅ Изображение найдено, передаем URL на фронт:', imageUrl);
      request.resolve({ imageUrl, requestId, status: 'success' });
    } else {
      console.error('❌ Изображение не найдено в callback данных');
      console.error('Доступные поля:', Object.keys(callbackData));
      console.error('Полные данные:', JSON.stringify(callbackData, null, 2));
      request.reject(new Error('No image found in callback data. Check result, full_response, or output fields.'));
    }
  } else if (callbackData.status === 'failed' || callbackData.status === 'error') {
    request.reject(new Error(`Gen-API generation failed: ${callbackData.error || 'Unknown error'}`));
  } else {
    // Еще обрабатывается
    console.log(`Request ${requestId} still processing: ${callbackData.status}`);
  }
}

/**
 * Long polling для получения результата Gen-API
 * Использует правильный эндпоинт: GET /request/get/{request_id}
 */
async function pollGenApiResult(apiKey, requestId, maxAttempts = 60, intervalMs = 3000) {
  console.log(`=== Long polling для request_id: ${requestId} ===`);
  console.log(`Максимум попыток: ${maxAttempts}, интервал: ${intervalMs}ms`);

  const client = createGenApiClient(apiKey);
  const endpoint = `/request/get/${requestId}`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Попытка ${attempt}/${maxAttempts}...`);

      const response = await client.get(endpoint);
      const data = response.data;

      console.log(`Статус задачи: ${data.status || 'unknown'}`);

      if (data.status === 'success') {
        console.log('✅ Генерация завершена успешно!');

        // Извлекаем URL из result[0] или full_response[0].url
        let imageUrl = null;

        if (data.result && Array.isArray(data.result) && data.result.length > 0) {
          imageUrl = data.result[0];
          console.log('✅ URL найден в result[0]:', imageUrl);
        } else if (data.full_response && Array.isArray(data.full_response) && data.full_response.length > 0) {
          imageUrl = data.full_response[0].url;
          console.log('✅ URL найден в full_response[0].url:', imageUrl);
        }

        if (imageUrl) {
          return { imageUrl, requestId, status: 'success' };
        } else {
          throw new Error('Image URL not found in result. Check result or full_response fields.');
        }
      } else if (data.status === 'failed' || data.status === 'error') {
        throw new Error(`Gen-API generation failed: ${data.error || 'Unknown error'}`);
      } else if (data.status === 'processing' || data.status === 'starting' || data.status === 'pending') {
        console.log(`⏳ Задача в процессе (${data.status}), ждем...`);
        // Ждем перед следующей попыткой
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      } else {
        console.log(`⚠️  Неизвестный статус: ${data.status}, ждем...`);
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      }
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`⚠️  Задача не найдена (404), пробуем еще раз...`);
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
          continue;
        }
      }
      throw error;
    }
  }

  throw new Error('Превышено время ожидания. Результат не получен.');
}

/**
 * Генерирует изображение через Gen-API z-image
 * Использует long polling вместо callback (callback не работает надежно)
 * @param {string} apiKey - API ключ Gen-API
 * @param {string} prompt - Промпт для генерации
 * @param {string} callbackUrl - URL для callback (не используется, но оставлен для совместимости)
 * @param {Object} options - Дополнительные опции
 * @returns {Promise<{imageUrl: string, requestId: number, status: string}>}
 */
async function generateImageWithGenApi(apiKey, prompt, callbackUrl, options = {}) {
  console.log('=== generateImageWithGenApi ===');
  console.log('Prompt:', prompt.substring(0, 100) + '...');
  console.log('Используем long polling вместо callback');

  const client = createGenApiClient(apiKey);

  const {
    width = 992,
    height = 992,
    model = 'turbo',
    output_format = 'png',
    num_inference_steps = 8,
    acceleration = 'high' // По умолчанию high для ускорения
  } = options;

  // НЕ передаем callback_url, используем long polling
  const requestData = {
    translate_input: true,
    prompt: prompt,
    // callback_url не передаем - используем long polling
    width: width,
    height: height,
    num_images: 1,
    model: model,
    output_format: output_format,
    num_inference_steps: num_inference_steps,
    enable_safety_checker: true,
    acceleration: acceleration,
    enable_prompt_expansion: false
  };

  try {
    console.log('Sending request to Gen-API...');
    const response = await client.post('/networks/z-image', requestData);

    console.log('Gen-API response received');

    const requestId = response.data.request_id;
    const status = response.data.status;

    if (!requestId) {
      throw new Error('No request_id in Gen-API response');
    }

    console.log('Request ID:', requestId, '(type:', typeof requestId, ')');
    console.log('Status:', status);
    console.log('Full response:', JSON.stringify(response.data, null, 2));
    console.log('\n⏳ Начинаем long polling для получения результата...');

    // Используем long polling вместо ожидания callback
    return await pollGenApiResult(apiKey, requestId);

  } catch (error) {
    console.error('Gen-API error:', error.message);
    console.error('Error status:', error.response?.status);
    console.error('Error data:', error.response?.data);

    if (error.response?.status === 402) {
      throw new Error('Gen-API quota exceeded. Please top-up your account.');
    }
    if (error.response?.status === 401 || error.response?.status === 403) {
      throw new Error('Invalid Gen-API key');
    }
    throw new Error(`Gen-API error: ${error.message}`);
  }
}

/**
 * Генерирует изображение через Gen-API с использованием промпта от OpenRouter
 * @param {string} openRouterApiKey - API ключ OpenRouter (для генерации промпта через Gemini)
 * @param {string} genApiKey - API ключ Gen-API
 * @param {string} bookTitle - Название книги
 * @param {string} author - Автор
 * @param {string} textChunk - Фрагмент текста
 * @param {string} callbackBaseUrl - Базовый URL для callback (например, Railway URL)
 * @param {Object} options - Дополнительные опции для Gen-API
 * @returns {Promise<{imageUrl: string, promptUsed: string}>}
 */
export async function generateImageFromTextWithGenApi(openRouterApiKey, genApiKey, bookTitle, author, textChunk, callbackBaseUrl, options = {}, prevSceneDescription = null, audience = 'adults', styleSuffix = '') {
  try {
    // Шаг 1: Генерируем промпт для изображения через OpenRouter (Gemini модель)
    const imagePrompt = await generatePromptForImage(openRouterApiKey, bookTitle, author, textChunk, prevSceneDescription, audience);

    // Объединяем промпт со стилем
    const finalPrompt = `${imagePrompt.trim()}${styleSuffix ? ', ' + styleSuffix : ''}`;

    // Шаг 2: Формируем callback URL
    const callbackUrl = `${callbackBaseUrl}/api/gen-api-callback`;

    // Шаг 3: Генерируем изображение через Gen-API (асинхронно)
    const result = await generateImageWithGenApi(genApiKey, finalPrompt, callbackUrl, options);

    return {
      imageUrl: result.imageUrl,
      promptUsed: imagePrompt
    };
  } catch (error) {
    throw error;
  }
}

