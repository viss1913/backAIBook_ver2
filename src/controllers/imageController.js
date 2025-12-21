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
    const apiKey = process.env.PERPLEXITY_API_KEY;

    if (!apiKey) {
      console.error('PERPLEXITY_API_KEY is not set');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }

    // Генерация изображения
    const result = await generateImageFromText(apiKey, bookTitle, author, textChunk);

    return res.status(200).json({
      success: true,
      imageUrl: result.imageUrl,
      promptUsed: result.promptUsed
    });

  } catch (error) {
    console.error('Error generating image:', error);

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

    // Общая ошибка сервера
    return res.status(500).json({
      success: false,
      error: 'Failed to generate image. Please try again later.'
    });
  }
}

