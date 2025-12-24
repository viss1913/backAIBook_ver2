import express from 'express';
import { searchBooks, downloadBook } from '../controllers/bookController.js';

const router = express.Router();

router.post('/search', searchBooks);
router.get('/download/:id', downloadBook);

export default router;
