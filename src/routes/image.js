import express from 'express';
import { generateImage } from '../controllers/imageController.js';

const router = express.Router();

/**
 * POST /api/generate-image
 * Генерирует AI-иллюстрацию для фрагмента текста из книги
 */
router.post('/generate-image', generateImage);

export default router;


