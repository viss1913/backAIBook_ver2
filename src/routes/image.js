import express from 'express';
import { generateImage, getImagesFromPerplexityController, generateCover, analyzeBookContent } from '../controllers/imageController.js';
import { checkTokensMiddleware } from '../middleware/tokenMiddleware.js';

const router = express.Router();

/**
 * POST /api/generate-image
 * Генерирует AI-иллюстрацию для фрагмента текста из книги
 * Требует deviceId в теле запроса и достаточное количество токенов
 */
router.post('/generate-image', checkTokensMiddleware, generateImage);

/**
 * POST /api/generate-cover
 * Генерирует обложку книги
 */
router.post('/generate-cover', generateCover);

/**
 * POST /api/analyze-content
 * Анализирует текст книги на наличие сцен для иллюстраций
 */
router.post('/analyze-content', analyzeBookContent);

/**
 * POST /api/get-images
 * Получает изображения через Perplexity API на основе текстового запроса
 */
router.post('/get-images', getImagesFromPerplexityController);

export default router;


