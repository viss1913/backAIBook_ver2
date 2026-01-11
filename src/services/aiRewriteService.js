
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CACHE SETUP
const CACHE_DIR = path.join(__dirname, '../../cache');
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// CONFIG
const MODEL = 'google/gemini-2.0-flash-001'; // Используем 2.0 Flash (2.5 пока мог быть не доступен в API, но по цене они близки. Если надо строго 2.5, поменяем)
const TIMEOUT = 15000;

// PRICING CONSTANTS
const PRICING = {
    INPUT_PER_1M: 0.30,
    OUTPUT_PER_1M: 2.50,
    USD_TO_RUB: 100,
    MARKUP: 2.5,
    TOKEN_PRICE_RUB: 0.25
};

const STYLES_PROMPTS = {
    'zoomer': `Rewrite the following text into Gen Z internet slang (Zoomer style). Use words like: cringe, no cap, fr, vibing, sus, bet. Keep the meaning but change the tone to be ironic and informal.`
};

/**
 * Calculates the cost in platform tokens
 */
function calculateCost(inputText, outputText) {
    // 1 token approx 3.5 chars
    const inputTokens = Math.ceil(inputText.length / 3.5);
    const outputTokens = Math.ceil(outputText.length / 3.5);

    const costInputUSD = (inputTokens / 1_000_000) * PRICING.INPUT_PER_1M;
    const costOutputUSD = (outputTokens / 1_000_000) * PRICING.OUTPUT_PER_1M;

    const totalUSD = costInputUSD + costOutputUSD;
    const totalRUB = totalUSD * PRICING.USD_TO_RUB;
    const priceWithMarkup = totalRUB * PRICING.MARKUP;

    const tokensToCharge = priceWithMarkup / PRICING.TOKEN_PRICE_RUB;

    // Возвращаем точное значение до сотых, но не меньше 0.01
    return Math.max(0.01, parseFloat(tokensToCharge.toFixed(2)));
}

function getCachePath(style) {
    return path.join(CACHE_DIR, `rewrites_${style}.json`);
}

function getFromCache(text, style) {
    try {
        const hash = crypto.createHash('md5').update(text).digest('hex');
        const cacheFile = getCachePath(style);

        if (fs.existsSync(cacheFile)) {
            const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            if (data[hash]) {
                return data[hash]; // Returns { text: "...", cost: 0 } logically, but we might charge 0 or nominal
            }
        }
    } catch (e) {
        console.error('Cache read error:', e);
    }
    return null;
}

function saveToCache(text, style, rewrittenText) {
    try {
        const hash = crypto.createHash('md5').update(text).digest('hex');
        const cacheFile = getCachePath(style);

        let data = {};
        if (fs.existsSync(cacheFile)) {
            data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        }

        data[hash] = rewrittenText;
        fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Cache write error:', e);
    }
}

export async function rewriteTextFragment(text, styleKey, apiKey) {
    if (!text || !styleKey) throw new Error('Text and style are required');

    // 1. Check Cache
    const cached = getFromCache(text, styleKey);
    if (cached) {
        return {
            original: text,
            rewritten: cached,
            isCached: true,
            tokensCost: 0 // Free if cached? Or small fee? Let's say 0 for now.
        };
    }

    // 2. Prepare Prompt
    const stylePrompt = STYLES_PROMPTS[styleKey] || STYLES_PROMPTS['zoomer'];
    const systemPrompt = `${stylePrompt}\nOUTPUT ONLY THE REWRITTEN TEXT. NO INTRO.`;

    // 3. Call AI
    try {
        const response = await axios.post(OPENROUTER_API_URL, {
            model: MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
            ],
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://viss-reader.com'
            },
            timeout: TIMEOUT
        });

        const rewritten = response.data?.choices?.[0]?.message?.content?.trim();
        if (!rewritten) throw new Error('No content from AI');

        // 4. Calculate Cost
        const cost = calculateCost(text, rewritten);

        // 5. Save Cache
        saveToCache(text, styleKey, rewritten);

        return {
            original: text,
            rewritten: rewritten,
            isCached: false,
            tokensCost: cost
        };

    } catch (error) {
        if (error.response) {
            console.error('AI Rewrite API Error:', error.response.status, error.response.data);
            throw new Error(`AI API Error: ${JSON.stringify(error.response.data)}`);
        }
        console.error('AI Rewrite Error:', error.message);
        throw error;
    }
}
