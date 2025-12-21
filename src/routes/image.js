import express from 'express';
import { generateImage, getImagesFromPerplexityController } from '../controllers/imageController.js';
import { handleGenApiCallback } from '../services/perplexityService.js';

const router = express.Router();

/**
 * POST /api/generate-image
 * Генерирует AI-иллюстрацию для фрагмента текста из книги
 */
router.post('/generate-image', generateImage);

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
  
  try {
    // Пробуем обработать данные из query параметров
    await handleGenApiCallback(req.query);
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error handling Gen-API callback (GET):', error);
    res.status(200).json({ received: true });
  }
});

export default router;


