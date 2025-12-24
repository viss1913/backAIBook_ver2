import express from 'express';
import { generateImage, getImagesFromPerplexityController, generateCover, analyzeBookContent } from '../controllers/imageController.js';
import { handleGenApiCallback } from '../services/perplexityService.js';

const router = express.Router();

/**
 * POST /api/generate-image
 * Генерирует AI-иллюстрацию для фрагмента текста из книги
 */
router.post('/generate-image', generateImage);

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

/**
 * POST /api/gen-api-callback
 * Callback эндпоинт для получения результатов от Gen-API
 */
router.post('/gen-api-callback', async (req, res) => {
  console.log('=== Gen-API Callback Received (POST) ===');
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('Query:', JSON.stringify(req.query, null, 2));
  console.log('Content-Type:', req.get('Content-Type'));
  console.log('Body type:', typeof req.body);
  console.log('Body keys:', req.body ? Object.keys(req.body) : 'null');

  // Проверяем, есть ли данные в body
  if (!req.body || Object.keys(req.body).length === 0) {
    console.error('⚠️  POST callback received but body is empty!');
    console.error('This might indicate a problem with body parsing middleware');
    console.error('Expected format: { request_id: number, status: string, output: {...} }');

    return res.status(200).json({
      received: true,
      warning: 'Empty body received. Check Content-Type and body parsing.',
      expected: {
        request_id: 'number',
        status: 'string (e.g., "success")',
        output: {
          image: 'string (base64 or URL)',
          image_url: 'string (URL)',
          url: 'string (URL)'
        }
      }
    });
  }

  try {
    // Обрабатываем callback (теперь async)
    await handleGenApiCallback(req.body);

    // Отвечаем OK
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error handling Gen-API callback:', error);
    console.error('Error stack:', error.stack);
    res.status(200).json({ received: true }); // Все равно отвечаем OK, чтобы Gen-API не повторял запрос
  }
});

// Также обрабатываем GET на случай, если Gen-API отправляет GET запросы
router.get('/gen-api-callback', async (req, res) => {
  console.log('=== Gen-API Callback Received (GET) ===');
  console.log('Query params:', JSON.stringify(req.query, null, 2));
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('URL:', req.url);
  console.log('Full URL:', req.protocol + '://' + req.get('host') + req.originalUrl);

  // Проверяем, есть ли данные в query параметрах
  const hasQueryData = Object.keys(req.query).length > 0;

  if (!hasQueryData) {
    console.warn('⚠️  GET callback received but no query parameters found!');
    console.warn('This might be a health check or test request from Gen-API');
    console.warn('Gen-API typically sends POST requests with JSON body');
    console.warn('If this is a real callback, check Gen-API documentation for GET format');

    // Отвечаем OK, но не обрабатываем как callback
    return res.status(200).json({
      received: true,
      message: 'GET callback received but no data found. Gen-API should send POST with JSON body.',
      note: 'This endpoint expects POST requests with JSON body containing request_id, status, and output'
    });
  }

  try {
    // Пробуем обработать данные из query параметров
    console.log('Attempting to process callback data from query params...');
    await handleGenApiCallback(req.query);

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error handling Gen-API callback (GET):', error);
    console.error('Error stack:', error.stack);
    res.status(200).json({ received: true });
  }
});

export default router;


