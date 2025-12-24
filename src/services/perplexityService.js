import axios from 'axios';
import { generateImagePrompt, generateAnalysisPromptTemplate } from '../utils/promptTemplate.js';

import https from 'https';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const LAOZHANG_API_URL = 'https://api.laozhang.ai/v1/images/generations';
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const GETIMG_API_URL = 'https://api.getimg.ai/v1';
const GEN_API_BASE = 'https://api.gen-api.ru/api/v1';
const TIMEOUT = 30000; // 30 секунд


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
 * Генерирует промпт для изображения через Perplexity API (вместо Gemini/OpenRouter)
 * @param {string} apiKey - API ключ Perplexity
 * @param {string} bookTitle - Название книги
 * @param {string} author - Автор
 * @param {string} textChunk - Фрагмент текста
 * @returns {Promise<string>} Сгенерированный промпт
 */
export async function generatePromptWithPerplexity(apiKey, bookTitle, author, textChunk, prevSceneDescription = null, audience = 'adults') {
  console.log('=== generatePromptWithPerplexity ===');
  console.log('API Key exists:', !!apiKey);

  const client = createPerplexityClient(apiKey);
  const userPrompt = generateImagePrompt(bookTitle, author, textChunk, prevSceneDescription, audience);
  const systemPrompt = 'You are an expert at creating detailed, artistic prompts for AI image generators. Your task is to analyze book text and create professional image generation prompts in English.';

  try {
    const modelName = 'sonar'; // Можно использовать 'sonar-pro' для более высокого качества
    console.log('Using Perplexity model:', modelName);

    const response = await client.post('', {
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    console.log('Perplexity API response received');
    const generatedPrompt = response.data?.choices?.[0]?.message?.content?.trim();

    if (!generatedPrompt) {
      console.error('No prompt in response:', JSON.stringify(response.data));
      throw new Error('Failed to generate prompt from Perplexity API');
    }

    console.log('Prompt generated successfully with Perplexity');
    return generatedPrompt;
  } catch (error) {
    console.error('Perplexity prompt API error:', error.message);
    if (error.response?.status) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data));
    }
    throw new Error(`Perplexity prompt API error: ${error.message}`);
  }
}

/**
 * Анализирует текст книги через Perplexity для поиска точек вставки иллюстраций
 * (Альтернатива analyzeContentWithGemini)
 */
export async function analyzeContentWithPerplexity(apiKey, textChunk) {
  console.log('=== analyzeContentWithPerplexity ===');

  const client = createPerplexityClient(apiKey);
  const userPrompt = generateAnalysisPromptTemplate(textChunk);
  const systemPrompt = 'You are a literary analyst and art director. Your task is to find the most visually impactful moments in a book text for illustration.';

  try {
    const response = await client.post('', {
      model: 'sonar',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3
    });

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Failed to get analysis from Perplexity');

    // Попытка извлечь JSON
    const jsonMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;

    try {
      const result = JSON.parse(jsonStr);
      return Array.isArray(result) ? result : (result.illustrations || []);
    } catch (e) {
      console.error('Failed to parse JSON from Perplexity response:', e.message);
      // Если не распарсилось, возвращаем пустой массив или пробуем очистить от markdown
      const cleanStr = content.replace(/```json|```/g, '').trim();
      return JSON.parse(cleanStr);
    }
  } catch (error) {
    console.error('Perplexity analysis error:', error.message);
    throw error;
  }
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

export async function generateImageFromText(promptApiKey, laoZhangApiKey, bookTitle, author, textChunk, imageModel = 'flux-kontext-pro', prevSceneDescription = null, audience = 'adults', styleSuffix = '') {
  try {
    // Шаг 1: Генерируем промпт для изображения через Perplexity
    const imagePrompt = await generatePromptWithPerplexity(promptApiKey, bookTitle, author, textChunk, prevSceneDescription, audience);

    // Шаг 2: Генерируем изображение через LaoZhang API
    const imageUrl = await generateImage(laoZhangApiKey, imagePrompt, bookTitle, author, imageModel, styleSuffix);

    // Будем возвращать полный промпт со стилем для отладки
    const finalPrompt = `Человек читает книгу "${bookTitle}" автора ${author}. ${imagePrompt.trim()}${styleSuffix ? ', ' + styleSuffix : ''}`;

    return {
      imageUrl,
      promptUsed: finalPrompt
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Генерирует изображение через GetImg API с использованием промпта от Perplexity
 * @param {string} promptApiKey - API ключ Perplexity (для генерации промпта)
 * @param {string} getImgApiKey - API ключ GetImg (для генерации изображения)
 * @param {string} bookTitle - Название книги
 * @param {string} author - Автор
 * @param {string} textChunk - Фрагмент текста
 * @param {string} imageModel - Модель для генерации изображения (по умолчанию 'seedream-v4')
 * @param {Object} options - Дополнительные опции для GetImg API
 * @returns {Promise<{imageUrl: string, promptUsed: string}>}
 */
export async function generateImageFromTextWithGetImg(promptApiKey, getImgApiKey, bookTitle, author, textChunk, imageModel = 'seedream-v4', options = {}, prevSceneDescription = null, audience = 'adults', styleSuffix = '') {
  try {
    // Шаг 1: Генерируем промпт для изображения через Perplexity
    const imagePrompt = await generatePromptWithPerplexity(promptApiKey, bookTitle, author, textChunk, prevSceneDescription, audience);

    // Объединяем промпт со стилем
    const finalPrompt = `${imagePrompt.trim()}${styleSuffix ? ', ' + styleSuffix : ''}`;

    // Шаг 2: Генерируем изображение через GetImg API
    const imageUrl = await generateImageWithGetImg(getImgApiKey, finalPrompt, imageModel, options);

    return {
      imageUrl,
      promptUsed: finalPrompt
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
 * @param {Object} options - Дополнительные опции
 * @returns {Promise<{imageUrl: string, requestId: number, status: string}>}
 */
async function generateImageWithGenApi(apiKey, prompt, options = {}) {
  console.log('=== generateImageWithGenApi ===');
  console.log('Full Prompt length:', prompt.length);
  console.log('Prompt Start:', prompt.substring(0, 100) + '...');
  console.log('Prompt End (style):', '...' + prompt.substring(prompt.length - 100));
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
 * Генерирует изображение через Gen-API с использованием промпта от Perplexity
 * @param {string} promptApiKey - API ключ Perplexity (для генерации промпта)
 * @param {string} genApiKey - API ключ Gen-API
 * @param {string} bookTitle - Название книги
 * @param {string} author - Автор
 * @param {string} textChunk - Фрагмент текста
 * @param {Object} options - Дополнительные опции для Gen-API
 * @returns {Promise<{imageUrl: string, promptUsed: string}>}
 */
export async function generateImageFromTextWithGenApi(promptApiKey, genApiKey, bookTitle, author, textChunk, options = {}, prevSceneDescription = null, audience = 'adults', styleSuffix = '') {
  try {
    // Шаг 1: Генерируем промпт для изображения через Perplexity
    const imagePrompt = await generatePromptWithPerplexity(promptApiKey, bookTitle, author, textChunk, prevSceneDescription, audience);

    // Объединяем промпт со стилем
    const finalPrompt = `${imagePrompt.trim()}${styleSuffix ? ', ' + styleSuffix : ''}`;
    console.log('DEBUG: Generated finalPrompt for Gen-API (length:', finalPrompt.length, ')');
    console.log('DEBUG: Style suffix added:', styleSuffix || 'none');

    // Шаг 3: Генерируем изображение через Gen-API (асинхронно)
    const result = await generateImageWithGenApi(genApiKey, finalPrompt, options);

    return {
      imageUrl: result.imageUrl,
      promptUsed: finalPrompt
    };
  } catch (error) {
    throw error;
  }
}

