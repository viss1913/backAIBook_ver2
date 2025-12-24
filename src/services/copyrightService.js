import wdk from 'wikidata-sdk';
const { searchEntities } = wdk;
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Проверяет, является ли книга общественным достоянием (70 лет после смерти).
 * @param {string} authorName - Имя автора
 * @param {boolean} isVip - Флаг VIP статуса
 * @returns {Promise<{publicDomain: boolean, expiryYear: number}>}
 */
export async function checkCopyright(authorName, isVip = false) {
    if (isVip) {
        return { publicDomain: true, expiryYear: 0 };
    }

    if (!authorName) {
        return { publicDomain: false, expiryYear: 1955 };
    }

    try {
        // 1. Пытаемся получить дату смерти через Wikidata
        let deathYear = await getDeathYearFromWikidata(authorName);

        // 2. Если Wikidata не дала результат, пробуем Perplexity (Smart Search)
        if (!deathYear) {
            deathYear = await getDeathYearFromPerplexity(authorName);
        }

        const currentYear = new Date().getFullYear();
        // Если дата смерти неизвестна, считаем что автор жив (более безопасно)
        const expiry = deathYear ? deathYear + 70 : 2099;

        return {
            publicDomain: currentYear > expiry,
            expiryYear: deathYear ? expiry : null
        };
    } catch (error) {
        console.error('Error checking copyright:', error.message);
        return { publicDomain: false, expiryYear: 2099 };
    }
}

async function getDeathYearFromWikidata(author) {
    try {
        const url = searchEntities({
            search: author,
            language: 'ru',
            limit: 1
        });

        const response = await axios.get(url);
        const entity = response.data.search[0];

        if (entity && entity.id) {
            // Чтобы получить P569/P570 нужно делать wbgetentities, но для упрощения и скорости 
            // мы можем использовать Perplexity как основной "умный" источник для классиков
            return null;
        }
        return null;
    } catch (error) {
        return null;
    }
}

async function getDeathYearFromPerplexity(author) {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) return null;

    try {
        const response = await axios.post(
            'https://api.perplexity.ai/chat/completions',
            {
                model: 'sonar',
                messages: [
                    {
                        role: 'system',
                        content: 'Find the year of death for the given author. Respond only with the year (number) or "unknown".'
                    },
                    {
                        role: 'user',
                        content: author
                    }
                ]
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );

        const content = response.data.choices[0].message.content.trim();
        const year = parseInt(content.match(/\d{4}/)?.[0]);
        return isNaN(year) ? null : year;
    } catch (error) {
        return null;
    }
}
