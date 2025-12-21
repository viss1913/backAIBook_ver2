import { validateGenerateImageRequest } from '../validators/imageValidator.js';
import { generateImageFromText } from '../services/perplexityService.js';

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
    
    const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
    // Поддерживаем оба варианта названия переменной (с G и без G)
    const laoZhangApiKey = process.env.LAOZHANG_API_KEY || process.env.LAOZHAN_API_KEY;

    console.log('Checking API keys...');
    console.log('PERPLEXITY_API_KEY exists:', !!perplexityApiKey);
    console.log('LAOZHANG_API_KEY exists:', !!process.env.LAOZHANG_API_KEY);
    console.log('LAOZHAN_API_KEY exists:', !!process.env.LAOZHAN_API_KEY);
    console.log('Final laoZhangApiKey exists:', !!laoZhangApiKey);

    if (!perplexityApiKey) {
      console.error('PERPLEXITY_API_KEY is not set');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: PERPLEXITY_API_KEY is missing'
      });
    }

    if (!laoZhangApiKey) {
      console.error('LAOZHANG_API_KEY or LAOZHAN_API_KEY is not set');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: LAOZHANG_API_KEY or LAOZHAN_API_KEY is missing'
      });
    }

    console.log('API keys check passed. Starting image generation...');

    // Получаем модель из query параметра или используем по умолчанию
    const imageModel = req.query.model || 'flux-kontext-pro';
    console.log('Using image model:', imageModel);

    // Генерация изображения
    console.log('Calling generateImageFromText...');
    const result = await generateImageFromText(perplexityApiKey, laoZhangApiKey, bookTitle, author, textChunk, imageModel);
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

