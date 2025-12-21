import { validateGenerateImageRequest, validateGetImagesFromPerplexityRequest } from '../validators/imageValidator.js';
import { generateImageFromText, generateImageFromTextWithGetImg, generateImageFromTextWithGigaChat, getImagesFromPerplexity } from '../services/perplexityService.js';

/**
 * Контроллер для генерации изображений
 */
export async function generateImage(req, res) {
  console.log('=== Generate Image Request ===');
  console.log('Request body:', JSON.stringify(req.body));
  
  try {
    // Валидация входных данных
    console.log('Validating request...');
    const validation = validateGenerateImageRequest(req.body);
    
    if (validation.error) {
      console.error('Validation error:', validation.error);
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    const { bookTitle, author, textChunk } = validation.value;
    console.log('Validation passed. Book:', bookTitle, 'Author:', author);
    
    // OpenRouter API ключ (используется для доступа к Gemini через OpenRouter)
    const openRouterApiKey = process.env.GEMINI_API_KEY;
    
    // Определяем провайдера из query параметра (по умолчанию 'laozhang')
    const provider = req.query.provider || 'laozhang';
    console.log('Using provider:', provider);

    if (!openRouterApiKey) {
      console.error('GEMINI_API_KEY (OpenRouter) is not set');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: GEMINI_API_KEY (OpenRouter key) is missing'
      });
    }

    let result;
    
    if (provider === 'gigachat') {
      // Используем GigaChat API
      const gigachatAuthKey = process.env.GIGACHAT_AUTH_KEY;
      const gigachatClientId = process.env.GIGACHAT_CLIENT_ID;
      const gigachatScope = process.env.GIGACHAT_SCOPE || 'GIGACHAT_API_PERS';
      
      console.log('Checking GigaChat credentials...');
      console.log('GIGACHAT_AUTH_KEY exists:', !!gigachatAuthKey);
      console.log('GIGACHAT_CLIENT_ID exists:', !!gigachatClientId);
      
      if (!gigachatAuthKey) {
        console.error('GIGACHAT_AUTH_KEY is not set');
        return res.status(500).json({
          success: false,
          error: 'Server configuration error: GIGACHAT_AUTH_KEY is missing'
        });
      }
      
      if (!gigachatClientId) {
        console.error('GIGACHAT_CLIENT_ID is not set');
        return res.status(500).json({
          success: false,
          error: 'Server configuration error: GIGACHAT_CLIENT_ID is missing'
        });
      }

      console.log('API keys check passed. Starting image generation with GigaChat...');
      console.log('Calling generateImageFromTextWithGigaChat...');
      result = await generateImageFromTextWithGigaChat(openRouterApiKey, gigachatAuthKey, gigachatClientId, bookTitle, author, textChunk, gigachatScope);
    } else if (provider === 'getimg') {
      // Используем GetImg API
      const getImgApiKey = process.env.GETIMG_API_KEY;
      
      console.log('Checking GetImg API key...');
      console.log('GETIMG_API_KEY exists:', !!getImgApiKey);
      
      if (!getImgApiKey) {
        console.error('GETIMG_API_KEY is not set');
        return res.status(500).json({
          success: false,
          error: 'Server configuration error: GETIMG_API_KEY is missing'
        });
      }

      // Получаем модель из query параметра или используем по умолчанию для GetImg
      const imageModel = req.query.model || 'seedream-v4';
      console.log('Using GetImg model:', imageModel);

      // Получаем дополнительные опции из query параметров
      const options = {};
      if (req.query.width) options.width = parseInt(req.query.width);
      if (req.query.height) options.height = parseInt(req.query.height);
      if (req.query.steps) options.steps = parseInt(req.query.steps);
      if (req.query.guidance) options.guidance = parseFloat(req.query.guidance);

      console.log('API keys check passed. Starting image generation with GetImg...');
      console.log('Calling generateImageFromTextWithGetImg...');
      result = await generateImageFromTextWithGetImg(openRouterApiKey, getImgApiKey, bookTitle, author, textChunk, imageModel, options);
    } else {
      // Используем LaoZhang API (по умолчанию)
      const laoZhangApiKey = process.env.LAOZHANG_API_KEY || process.env.LAOZHAN_API_KEY;

      console.log('Checking LaoZhang API key...');
      console.log('LAOZHANG_API_KEY exists:', !!process.env.LAOZHANG_API_KEY);
      console.log('LAOZHAN_API_KEY exists:', !!process.env.LAOZHAN_API_KEY);
      console.log('Final laoZhangApiKey exists:', !!laoZhangApiKey);

      if (!laoZhangApiKey) {
        console.error('LAOZHANG_API_KEY or LAOZHAN_API_KEY is not set');
        return res.status(500).json({
          success: false,
          error: 'Server configuration error: LAOZHANG_API_KEY or LAOZHAN_API_KEY is missing'
        });
      }

      // Получаем модель из query параметра или используем по умолчанию для LaoZhang
      const imageModel = req.query.model || 'flux-kontext-pro';
      console.log('Using LaoZhang model:', imageModel);

      console.log('API keys check passed. Starting image generation with LaoZhang...');
      console.log('Calling generateImageFromText...');
      result = await generateImageFromText(openRouterApiKey, laoZhangApiKey, bookTitle, author, textChunk, imageModel);
    }
    
    console.log('Image generation completed. URL:', result.imageUrl);

    return res.status(200).json({
      success: true,
      imageUrl: result.imageUrl,
      promptUsed: result.promptUsed
    });

  } catch (error) {
    console.error('Error generating image:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);

    // Обработка различных типов ошибок
    if (error.message.includes('Rate limit')) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please try again later.'
      });
    }

    if (error.message.includes('Invalid API key')) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }

    // Общая ошибка сервера с деталями для дебага
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate image. Please try again later.',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

/**
 * Контроллер для получения изображений через Perplexity API
 */
export async function getImagesFromPerplexityController(req, res) {
  console.log('=== Get Images From Perplexity Request ===');
  console.log('Request body:', JSON.stringify(req.body));
  
  try {
    // Валидация входных данных
    console.log('Validating request...');
    const validation = validateGetImagesFromPerplexityRequest(req.body);
    
    if (validation.error) {
      console.error('Validation error:', validation.error);
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    const { query, imageFormatFilter, imageDomainFilter } = validation.value;
    console.log('Validation passed. Query:', query);
    
    // Perplexity API ключ
    const perplexityApiKey = process.env.PERPLEXITY_API_KEY;

    console.log('Checking API key...');
    console.log('PERPLEXITY_API_KEY exists:', !!perplexityApiKey);

    if (!perplexityApiKey) {
      console.error('PERPLEXITY_API_KEY is not set');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: PERPLEXITY_API_KEY is missing'
      });
    }

    console.log('API key check passed. Starting image search...');

    // Получение изображений через Perplexity
    console.log('Calling getImagesFromPerplexity...');
    const result = await getImagesFromPerplexity(perplexityApiKey, query, {
      imageFormatFilter,
      imageDomainFilter
    });
    
    console.log(`Image search completed. Found ${result.images.length} images`);

    return res.status(200).json({
      success: true,
      images: result.images,
      textResponse: result.textResponse,
      citations: result.citations,
      searchResults: result.searchResults,
      count: result.images.length
    });

  } catch (error) {
    console.error('Error getting images from Perplexity:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);

    // Обработка различных типов ошибок
    if (error.message.includes('Rate limit')) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please try again later.'
      });
    }

    if (error.message.includes('Invalid API key')) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }

    // Общая ошибка сервера с деталями для дебага
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get images from Perplexity. Please try again later.',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

