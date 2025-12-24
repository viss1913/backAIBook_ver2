import { searchPDbooks, downloadFlibustaBook } from '../services/flibustaService.js';
import path from 'path';

/**
 * Поиск книг
 */
export async function searchBooks(req, res) {
    const { query, limit, vipCode } = req.body;
    const isVip = vipCode === process.env.VIP_SECRET_CODE;

    if (!query) {
        return res.status(400).json({ success: false, error: 'Query is required' });
    }

    try {
        const books = await searchPDbooks(query, limit || 10, isVip);
        res.json({ success: true, books });
    } catch (error) {
        console.error('Search controller error:', error);
        res.status(500).json({ success: false, error: 'Failed to search books' });
    }
}

/**
 * Скачивание книги
 */
export async function downloadBook(req, res) {
    const { id } = req.params;
    const { vipCode } = req.query; // Для GET запроса передаем в query
    const isVip = vipCode === process.env.VIP_SECRET_CODE;

    try {
        // 1. Сначала проверяем PD статус если не VIP
        // (В идеале тут запрос к БД, но для начала можно попробовать скачать и проверить)

        const { filePath, fileName } = await downloadFlibustaBook(id, isVip);

        res.download(filePath, fileName, (err) => {
            if (err) {
                console.error('File delivery error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ success: false, error: 'Failed to deliver file' });
                }
            }
        });
    } catch (error) {
        console.error('Download controller error:', error);
        res.status(500).json({ success: false, error: 'Failed to download book' });
    }
}
