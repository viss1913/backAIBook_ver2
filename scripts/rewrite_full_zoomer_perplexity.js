
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import axios from 'axios';

// Настройка окружения
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const INPUT_DIR = path.join(__dirname, '../fb2Books');
const OUTPUT_DIR = path.join(__dirname, '../fb2Books/zoomer_full');

// Имя файла книги
const BOOK_FILENAME = 'Dyuma_Tri-mushketera_1_Tri-mushketera.Uk3Rnw.13332.fb2.zip';

// API Configuration
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Промпт для Perplexity (Sonar)
// Sonar - поисковая модель, поэтому важно дать ей понять, что мы хотим РЕРАЙТ, а не поиск инфы.
const SYSTEM_PROMPT = `You are a specialized "Zoomer Translator" AI. 
Your task is to rewrite the provided text into modern Gen Z internet slang (Zoomer style).
Use terms like: cringe, vibing, no cap, fr (for real), bussin, sus, bet, slay, main character energy, NPC, pov, oof, bruh.
Tone: Ironic, informal, like a TikTok storytime or chaotic Twitter thread.
CRITICAL: Do not search the internet. Do not summarize. Rewrite the text sentence-by-sentence or paragraph-by-paragraph preserving the original meaning but changing the style totally.
Output ONLY the rewritten text. No introductory phrases.`;

async function rewriteWithPerplexity(textChunk, retryCount = 0) {
    try {
        const response = await axios.post(PERPLEXITY_API_URL, {
            model: 'sonar',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: `Rewrite this text in Zoomer slang:\n\n${textChunk}` }
            ],
            temperature: 0.8,
            max_tokens: 2000 // Позволяем длинные ответы
        }, {
            headers: {
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 60000 // 60 sec timeout
        });

        // Perplexity иногда добавляет цитаты, они нам не нужны для художки.
        // Обычно в content их нет, если не было поиска, но на всякий случай просто берем content.
        let content = response.data?.choices?.[0]?.message?.content || textChunk;

        // Очистка от возможного мусора "Here is the rewrite:"
        content = content.replace(/^(Here is|Sure|Okay).*?:\n/i, '').trim();

        return content;

    } catch (error) {
        if (error.response?.status === 429 && retryCount < 3) {
            console.log(`⚠️ Rate limit hit. Waiting 10s... (Attempt ${retryCount + 1}/3)`);
            await new Promise(r => setTimeout(r, 10000));
            return rewriteWithPerplexity(textChunk, retryCount + 1);
        }

        console.error('❌ Perplexity rewrite error:', error.message);
        if (error.response) console.error('Data:', error.response.data);
        return textChunk; // Fallback to original text on error
    }
}

async function runFullRewrite() {
    console.log('💀 Starting FULL ZOOMER REWRITE (Perplexity Edition)...');
    console.log(`📖 Book: ${BOOK_FILENAME}`);

    if (!PERPLEXITY_API_KEY) throw new Error('PERPLEXITY_API_KEY is missing!');

    // 1. Распаковка
    console.log('\n📦 Reading & Unzipping...');
    const zipPath = path.join(INPUT_DIR, BOOK_FILENAME);
    const zip = new AdmZip(zipPath);
    const zipEntries = zip.getEntries();

    let fb2Entry = zipEntries.find(entry => entry.entryName.endsWith('.fb2'));
    if (!fb2Entry) {
        throw new Error('No .fb2 file found in archive!');
    }

    const fb2Buffer = fb2Entry.getData();

    // 2. Парсинг
    console.log('\n🔍 Parsing FB2...');
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_"
    });
    const fb2Data = parser.parse(fb2Buffer.toString());

    const title = fb2Data.FictionBook?.description?.['title-info']?.['book-title'] || 'Unknown';
    console.log(`Title: ${title}`);

    // Update Title
    if (fb2Data.FictionBook.description?.['title-info']) {
        fb2Data.FictionBook.description['title-info']['book-title'] = `${title} (Zoomer Perplexity Full Ver)`;
    }

    // 3. Processing
    // В некоторых FB2 может быть несколько body (один основной, другие - сноски/эпиграфы)
    // Мы хотим обработать ВСЕ body или хотя бы найти самый большой.
    const bodies = Array.isArray(fb2Data.FictionBook.body) ? fb2Data.FictionBook.body : [fb2Data.FictionBook.body];

    // Функция для рекурсивного сбора всех текстовых узлов (параграфов) из секций
    const collectParagraphsRecursively = (node, collection = []) => {
        if (!node) return collection;

        // Если у узла есть секции -> идем вглубь
        if (node.section) {
            const sections = Array.isArray(node.section) ? node.section : [node.section];
            sections.forEach(s => collectParagraphsRecursively(s, collection));
        }

        // Если у узла есть параграфы -> это то что нам нужно
        if (node.p) {
            collection.push(node); // Сохраняем ссылку на объект секции/узла, содержащего p
        }

        return collection;
    }

    console.log(`🔥 Analyzying FB2 structure... Found ${bodies.length} body elements.`);

    // Собираем все узлы с текстом со всех body
    let allTextNodes = [];
    bodies.forEach((body, idx) => {
        // Body тоже может содержать секции
        collectParagraphsRecursively(body, allTextNodes);
    });

    console.log(`Found ${allTextNodes.length} sections containing text.`);
    console.log('⚠️  This will take a while. Go touch grass while you wait.');

    // Итерируемся по найденным узлам (ОГРАНИЧЕНИЕ: Первые 5 секций для быстрого результата)
    const MAX_SECTIONS = 5;
    console.log(`✂️ Cutting book to first ${MAX_SECTIONS} sections as requested.`);

    // Оставляем только нужные секции в массиве для обработки
    const nodesToProcess = allTextNodes.slice(0, MAX_SECTIONS);

    // ВАЖНО: Нам нужно удалить остальные секции из XML структуры, иначе файл будет содержать кучу непереведенного текста
    // Это сложно сделать рекурсивно "на лету", поэтому мы просто переведем первые 5, 
    // а остальные оставим как есть (или можно было бы удалить, но пользователь просил "что есть то и ок")
    // Давайте лучше оставим как есть, но пометим в заголовке что это Partial.

    if (fb2Data.FictionBook.description['title-info']) {
        fb2Data.FictionBook.description['title-info']['book-title'] = `${title} (Zoomer Partial Edition)`;
    }

    for (let i = 0; i < nodesToProcess.length; i++) {
        const node = nodesToProcess[i];
        console.log(`\n👉 Processing Section ${i + 1}/${nodesToProcess.length}`);

        // ... (rest of the loop logic)
        let paragraphs = [];
        if (Array.isArray(node.p)) paragraphs = node.p;
        else if (node.p) paragraphs = [node.p];
        else continue;

        const CHUNK_SIZE = 8;
        const newParagraphs = [];

        for (let j = 0; j < paragraphs.length; j += CHUNK_SIZE) {
            const chunk = paragraphs.slice(j, j + CHUNK_SIZE);
            const textToRewrite = chunk.map(p => {
                if (typeof p === 'string') return p;
                if (p['#text']) return p['#text'];
                return JSON.stringify(p);
            }).join('\n\n');

            if (textToRewrite.length < 30) {
                newParagraphs.push(...chunk);
                continue;
            }

            process.stdout.write(`   Part ${Math.floor(j / CHUNK_SIZE) + 1}... `);
            const rewrittenText = await rewriteWithPerplexity(textToRewrite);
            process.stdout.write(`Done.\n`);

            const rewrittenPs = rewrittenText.split('\n').filter(line => line.trim().length > 0);
            newParagraphs.push(...rewrittenPs);

            // Minimal pause
            await new Promise(r => setTimeout(r, 500));
        }
        node.p = newParagraphs;
    }

    // 4. Saving
    console.log('\n💾 Saving partial masterpiece...');
    const builder = new XMLBuilder({
        ignoreAttributes: false,
        format: true,
        suppressEmptyNode: true,
        attributeNamePrefix: "@_"
    });
    const newXml = builder.build(fb2Data);

    const newZip = new AdmZip();
    const newFilenameInternal = fb2Entry.entryName.replace('.fb2', '_ZoomerPartial.fb2');
    newZip.addFile(newFilenameInternal, Buffer.from(newXml, 'utf8'));

    const outputFilename = BOOK_FILENAME.replace('.fb2.zip', '_Zoomer_Partial.fb2.zip');
    const outputPath = path.join(OUTPUT_DIR, outputFilename);

    newZip.writeZip(outputPath);

    console.log(`\n🎉 DONE! Partial book saved.`);
    console.log(`   Path: ${outputPath}`);
}

runFullRewrite().catch(console.error);
