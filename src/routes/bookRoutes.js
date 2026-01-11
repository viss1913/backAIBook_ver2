import express from 'express';
import { searchBooks, downloadBook } from '../controllers/bookController.js';
import { rewriteFragment } from '../controllers/aiRewriteController.js';

const router = express.Router();

router.get('/search', searchBooks);
router.get('/download/:link', downloadBook);
router.post('/rewrite', rewriteFragment);

export default router;
