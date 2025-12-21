import { validateGenerateImageRequest } from '../validators/imageValidator.js';
import { generateImageFromText } from '../services/perplexityService.js';

/**
 * Контроллер для генерации изображений
 */
export async function generateImage(req, res) {
  try {
    // Валидация входных данных
    const validation = validateGenerateImageRequest(req.body);
    
    if (validation.error) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    const { bookTitle, author, textChunk } = validation.value;
    const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
    // Поддерживаем оба варианта названия переменной (с G и без G)
    const laoZhangApiKey = process.env.LAOZHANG_API_KEY || process.env.LAOZHAN_API_KEY;

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

    // Получаем модель из query параметра или используем по умолчанию
    const imageModel = req.query.model || 'flux-kontext-pro';

    // Генерация изображения
    const result = await generateImageFromText(perplexityApiKey, laoZhangApiKey, bookTitle, author, textChunk, imageModel);

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

