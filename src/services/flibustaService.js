import FlibustaAPI from 'flibusta';
const Flibusta = FlibustaAPI.default || FlibustaAPI;
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { checkCopyright } from './copyrightService.js';
import { refineSearchQuery } from './aiSearchService.js';
import { findFlibustaBook, saveFlibustaBook } from '../utils/database.js';

const DOWNLOADS_DIR = path.resolve('src/downloads');
const FLIBUSTA_MIRROR = process.env.FLIBUSTA_MIRROR || 'https://flibusta.is';
const TOR_PROXY = process.env.TOR_PROXY;

// Настройка агента если есть прокси
const axiosConfig = {};
if (TOR_PROXY) {
    axiosConfig.httpsAgent = new SocksProxyAgent(TOR_PROXY);
}

const api = new Flibusta(FLIBUSTA_MIRROR);

/**
 * Ищет книги с предварительной ИИ-обработкой запроса и проверкой прав.
 */
export async function searchPDbooks(rawQuery, limit = 10, isVip = false) {
    console.log(`Searching for: "${rawQuery}" (VIP: ${isVip})`);

    // 1. Умная обработка запроса (исправление опечаток)
    const { title, author } = await refineSearchQuery(rawQuery);
    // Для Флибусты лучше искать по названию, а автора использовать для фильтрации,
    // так как поиск по строке "Автор Название" часто выдает 0 результатов.
    const searchQuery = title;

    try {
        // 2. Поиск во Флибусте
        console.log(`Calling flibusta search for: "${searchQuery}"`);
        const results = await api.getBooksByName(searchQuery);
        if (!results || !Array.isArray(results)) {
            console.log('Flibusta returned non-array results:', typeof results);
            return [];
        }

        console.log(`Found ${results.length} results from Flibusta`);

        // 3. Сортировка: приоритет автору из Gemini
        if (author) {
            results.sort((a, b) => {
                const aName = a.authors?.map(au => au.name || '').join(' ').toLowerCase() || '';
                const bName = b.authors?.map(au => au.name || '').join(' ').toLowerCase() || '';
                const aMatch = aName.includes(author.toLowerCase());
                const bMatch = bName.includes(author.toLowerCase());
                if (aMatch && !bMatch) return -1;
                if (!aMatch && bMatch) return 1;
                return 0;
            });
        }

        // 4. Фильтрация и обогащение данными о правах
        const processedBooks = [];
        for (const item of results.slice(0, limit)) {
            try {
                const bookInfo = item.book;
                if (!bookInfo) continue;

                // 3.1. Проверка кэша
                const cached = await findFlibustaBook(bookInfo.id);
                if (cached) {
                    console.log(`Using cached data for: ${bookInfo.id}`);
                    processedBooks.push({
                        id: `flibusta_${bookInfo.id}`,
                        flibustaId: bookInfo.id,
                        title: cached.title,
                        author: cached.author,
                        publicDomain: !!cached.public_domain,
                        expiryYear: cached.expiry_year,
                        formats: ['fb2'],
                        coverUrl: item.cover || null
                    });
                    continue;
                }

                const authorNames = item.authors?.map(a => a.name).join(', ') || 'Unknown';
                console.log(`Processing book: ${bookInfo.id} - ${bookInfo.name} (${authorNames})`);

                // Проверяем права по основному автору (первому в списке)
                const primaryAuthor = item.authors?.[0]?.name || 'Unknown';
                const cp = await checkCopyright(primaryAuthor, isVip);

                processedBooks.push({
                    id: `flibusta_${bookInfo.id}`,
                    flibustaId: bookInfo.id,
                    title: bookInfo.name,
                    author: authorNames,
                    publicDomain: cp.publicDomain,
                    expiryYear: cp.expiryYear,
                    formats: ['fb2'],
                    coverUrl: item.cover || null
                });

                // 3.2. Сохраняем в кэш
                await saveFlibustaBook({
                    flibusta_id: bookInfo.id,
                    title: bookInfo.name,
                    author: authorNames,
                    public_domain: cp.publicDomain,
                    expiry_year: cp.expiryYear
                });
            } catch (innerErr) {
                console.error(`Error processing book item:`, innerErr.message);
            }
        }

        console.log(`Successfully processed ${processedBooks.length} books`);
        return processedBooks;
    } catch (error) {
        console.error('Flibusta search core error:', error);
        throw error;
    }
}

/**
 * Скачивает книгу и сохраняет локально.
 */
export async function downloadFlibustaBook(id, isVip = false) {
    const flibustaId = id.replace('flibusta_', '');
    const fileName = `${id}.fb2`;
    const filePath = path.join(DOWNLOADS_DIR, fileName);

    // 1. Проверяем кэш
    if (fs.existsSync(filePath)) {
        return { filePath, fileName, cached: true };
    }

    // 2. Скачивание (нужен прямой запрос к зеркалу или поддержка в либе)
    // В библиотеке flibusta обычно есть методы получения ссылок
    try {
        const downloadUrl = `${FLIBUSTA_MIRROR}/b/${flibustaId}/fb2`;
        console.log(`Downloading book from: ${downloadUrl}`);

        const response = await axios({
            method: 'GET',
            url: downloadUrl,
            responseType: 'stream',
            ...axiosConfig
        });

        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve({ filePath, fileName, cached: false }));
            writer.on('error', reject);
        });
    } catch (error) {
        console.error('Download error:', error.message);
        throw error;
    }
}
