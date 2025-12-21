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
async function generatePromptForImage(apiKey, bookTitle, author, textChunk) {
  console.log('=== generatePromptForImage (OpenRouter/Gemini) ===');
  console.log('API Key exists:', !!apiKey);
  console.log('API Key starts with:', apiKey ? apiKey.substring(0, 10) + '...' : 'N/A');
  
  const client = createOpenRouterClient(apiKey);
  const userPrompt = generateImagePrompt(bookTitle, author, textChunk);
  const systemPrompt = 'Создай промпт для image generation. Ты эксперт по созданию детальных, художественных промптов для генерации изображений.';

  try {
    console.log('Sending request to OpenRouter API...');
    // OpenRouter использует OpenAI-совместимый формат
    // Модель: google/gemini-2.5-flash (боевая модель)
    const modelName = 'google/gemini-2.5-flash';
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
      max_tokens: 500
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

export async function generateImageFromText(openRouterApiKey, laoZhangApiKey, bookTitle, author, textChunk, imageModel = 'flux-kontext-pro') {
  try {
    // Шаг 1: Генерируем промпт для изображения через OpenRouter (Gemini модель)
    const imagePrompt = await generatePromptForImage(openRouterApiKey, bookTitle, author, textChunk);
    
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
export async function generateImageFromTextWithGetImg(openRouterApiKey, getImgApiKey, bookTitle, author, textChunk, imageModel = 'seedream-v4', options = {}) {
  try {
    // Шаг 1: Генерируем промпт для изображения через OpenRouter (Gemini модель)
    const imagePrompt = await generatePromptForImage(openRouterApiKey, bookTitle, author, textChunk);
    
    // Шаг 2: Генерируем изображение через GetImg API
    const imageUrl = await generateImageWithGetImg(getImgApiKey, imagePrompt, imageModel, options);

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
export async function generateImageFromTextWithGigaChat(openRouterApiKey, gigachatAuthKey, gigachatClientId, bookTitle, author, textChunk, scope = 'GIGACHAT_API_PERS') {
  try {
    // Шаг 1: Получаем access_token
    const accessToken = await getGigaChatAccessToken(gigachatAuthKey, gigachatClientId, scope);
    
    // Шаг 2: Генерируем промпт для изображения через OpenRouter (Gemini модель)
    const imagePrompt = await generatePromptForImage(openRouterApiKey, bookTitle, author, textChunk);
    
    // Шаг 3: Формируем запрос на русском для GigaChat
    const russianPrompt = `Нарисуй ${imagePrompt}`;
    
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
export function handleGenApiCallback(callbackData) {
  console.log('=== handleGenApiCallback ===');
  console.log('Callback data:', JSON.stringify(callbackData, null, 2));
  
  const requestId = callbackData.request_id;
  if (!requestId) {
    console.error('No request_id in callback');
    return;
  }

  const request = genApiRequests.get(requestId);
  if (!request) {
    console.warn(`No pending request found for request_id: ${requestId}`);
    return;
  }

  if (callbackData.status === 'success' && callbackData.output) {
    // Извлекаем изображение из output
    let imageUrl = null;
    
    if (callbackData.output.image) {
      const image = callbackData.output.image;
      if (typeof image === 'string') {
        if (image.startsWith('http')) {
          imageUrl = image;
        } else if (image.startsWith('data:')) {
          imageUrl = image;
        }
      }
    } else if (callbackData.output.image_url) {
      imageUrl = callbackData.output.image_url;
    } else if (callbackData.output.url) {
      imageUrl = callbackData.output.url;
    }

    if (imageUrl) {
      request.resolve({ imageUrl, requestId, status: 'success' });
    } else {
      request.reject(new Error('No image found in callback output'));
    }
  } else if (callbackData.status === 'failed' || callbackData.status === 'error') {
    request.reject(new Error(`Gen-API generation failed: ${callbackData.error || 'Unknown error'}`));
  } else {
    // Еще обрабатывается
    console.log(`Request ${requestId} still processing: ${callbackData.status}`);
  }
}

/**
 * Генерирует изображение через Gen-API z-image
 * @param {string} apiKey - API ключ Gen-API
 * @param {string} prompt - Промпт для генерации
 * @param {string} callbackUrl - URL для callback
 * @param {Object} options - Дополнительные опции
 * @returns {Promise<{imageUrl: string, requestId: number, status: string}>}
 */
async function generateImageWithGenApi(apiKey, prompt, callbackUrl, options = {}) {
  console.log('=== generateImageWithGenApi ===');
  console.log('Prompt:', prompt.substring(0, 100) + '...');
  console.log('Callback URL:', callbackUrl);
  
  const client = createGenApiClient(apiKey);
  
  const {
    width = 992,
    height = 992,
    model = 'turbo',
    output_format = 'png',
    num_inference_steps = 8,
    acceleration = 'high' // По умолчанию high для ускорения
  } = options;

  const requestData = {
    translate_input: true,
    prompt: prompt,
    callback_url: callbackUrl,
    width: width,
    height: height,
    num_images: 1,
    model: model,
    output_format: output_format,
    num_inference_steps: num_inference_steps,
    enable_safety_checker: true,
    acceleration: acceleration, // Используем high по умолчанию
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

    console.log('Request ID:', requestId);
    console.log('Status:', status);

    // Создаем Promise для ожидания callback
    return new Promise((resolve, reject) => {
      genApiRequests.set(requestId, { resolve, reject });
      
      // Таймаут через 5 минут
      setTimeout(() => {
        if (genApiRequests.has(requestId)) {
          genApiRequests.delete(requestId);
          reject(new Error('Gen-API request timeout (5 minutes)'));
        }
      }, 300000);
    });

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
export async function generateImageFromTextWithGenApi(openRouterApiKey, genApiKey, bookTitle, author, textChunk, callbackBaseUrl, options = {}) {
  try {
    // Шаг 1: Генерируем промпт для изображения через OpenRouter (Gemini модель)
    const imagePrompt = await generatePromptForImage(openRouterApiKey, bookTitle, author, textChunk);
    
    // Шаг 2: Формируем callback URL
    const callbackUrl = `${callbackBaseUrl}/api/gen-api-callback`;
    
    // Шаг 3: Генерируем изображение через Gen-API (асинхронно)
    const result = await generateImageWithGenApi(genApiKey, imagePrompt, callbackUrl, options);

    return {
      imageUrl: result.imageUrl,
      promptUsed: imagePrompt
    };
  } catch (error) {
    throw error;
  }
}

