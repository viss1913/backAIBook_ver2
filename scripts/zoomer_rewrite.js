
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
const OUTPUT_DIR = path.join(__dirname, '../fb2Books/zoomer_edition');

// Имя файла книги
const BOOK_FILENAME = 'Dyuma_Tri-mushketera_1_Tri-mushketera.Uk3Rnw.13332.fb2.zip';

// API Keys
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function rewriteTextWithAI(textChunk) {
    const systemPrompt = `Ты — профессиональный переводчик на язык зумеров и интернет-сленга. 
Твоя задача — переписать классический текст на современный молодежный лад (Gen Z style).
Используй слова: кринж, вайб, краш, рофл, пруфы, душнила, нормис, имба, сигма, скуф, тюбик, брух, ноу кап, база, скипнуть, муд.
Стиль должен быть как треш-стрим или постироничный тред в Твиттере или ТикТоке.
Сохраняй сюжет и имена, но меняй подачу на максимально несерьезную и молодежную.
Не пиши вступлений типа "Вот перевод:", просто давай текст.`;

    try {
        const response = await axios.post(OPENROUTER_API_URL, {
            model: 'google/gemini-2.0-flash-001', // Быстрая и дешевая модель
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: textChunk }
            ],
            temperature: 0.8 // Повыше для креативности
        }, {
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://viss-reader.com',
            }
        });

        return response.data?.choices?.[0]?.message?.content || textChunk;
    } catch (error) {
        console.error('Rewrite failed:', error.message);
        if (error.response) console.error(error.response.data);
        return textChunk; // Fallback to original
    }
}

async function runRewrite() {
    console.log('💀 Starting Zoomer Rewrite Operation...');
    console.log(`📖 Book: ${BOOK_FILENAME}`);

    if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is missing!');

    // 1. Распаковка и чтение
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

    const title = fb2Data.FictionBook?.description?.['title-info']?.['book-title'];
    console.log(`Original Title: ${title}`);

    // Меняем заголовок
    if (fb2Data.FictionBook.description['title-info']) {
        fb2Data.FictionBook.description['title-info']['book-title'] = `${title} (Zoomer Edition)`;
    }

    // 3. Обработка текста
    const body = fb2Data.FictionBook.body;
    const mainBody = Array.isArray(body) ? body[0] : body;

    // Собираем параграфы
    let allParagraphsNodes = [];

    const collectParagraphs = (node) => {
        if (!node) return;
        if (node.section) {
            const sections = Array.isArray(node.section) ? node.section : [node.section];
            sections.forEach(s => collectParagraphs(s));
        }
        if (node.p) {
            const ps = Array.isArray(node.p) ? node.p : [node.p];
            // Мы хотим менять контент "на месте", поэтому нам нужны ссылки на объекты или массивы
            // Проще собрать просто все строки, но нам надо их потом записать обратно.
            // В fast-xml-parser 'p' может быть просто строкой.
            // Сложно менять 'in-place' если это примитивы.
            // Поэтому будем менять саму node.p
        }
    };

    // Альтернативный подход: Итерируемся по СЕКЦИЯМ
    // Берем первые 3 секции (главы)
    const sections = Array.isArray(mainBody.section) ? mainBody.section : [mainBody.section];
    const LIMIT_SECTIONS = 2; // Берем только первые 2 главы для теста

    console.log(`Found ${sections.length} chapters. We will rewrite the first ${LIMIT_SECTIONS}.`);

    for (let i = 0; i < Math.min(sections.length, LIMIT_SECTIONS); i++) {
        const section = sections[i];
        console.log(`\n--- Rewriting Chapter ${i + 1} ---`);

        // Получаем параграфы (может быть массив строк или одна строка)
        let paragraphs = [];
        if (Array.isArray(section.p)) {
            paragraphs = section.p;
        } else if (section.p) {
            paragraphs = [section.p];
        } else {
            console.log('Empty chapter, skipping.');
            continue;
        }

        // Разбиваем на чанки по 5 параграфов
        const CHUNK_SIZE = 5;
        const newParagraphs = [];

        for (let j = 0; j < paragraphs.length; j += CHUNK_SIZE) {
            const chunk = paragraphs.slice(j, j + CHUNK_SIZE);
            const textToRewrite = chunk.map(p => (typeof p === 'object' ? p['#text'] : p)).join('\n\n');

            if (textToRewrite.length < 50) {
                newParagraphs.push(...chunk);
                continue;
            }

            console.log(`Writing chunk ${j / CHUNK_SIZE + 1}... (${textToRewrite.length} chars)`);

            const rewrittenText = await rewriteTextWithAI(textToRewrite);

            // Разбиваем обратно на параграфы (примерно)
            const rewrittenPs = rewrittenText.split('\n').filter(line => line.trim().length > 0);
            newParagraphs.push(...rewrittenPs);

            // Пауза 1 сек
            await new Promise(r => setTimeout(r, 1000));
        }

        // Заменяем параграфы в секции
        section.p = newParagraphs;
    }

    // Отрезаем остальные главы, чтобы файл был поменьше (как просил юзер - "не всю книгу")
    // Оставляем только те, которые переписали + 1 для контекста (но без перевода)
    mainBody.section = sections.slice(0, LIMIT_SECTIONS);
    console.log(`\n✂️ Cut off the rest of the book. Kept ${LIMIT_SECTIONS} chapters.`);

    // 4. Сборка
    console.log('\n🔧 Assembling new FB2...');
    const builder = new XMLBuilder({
        ignoreAttributes: false,
        format: true,
        suppressEmptyNode: true,
        attributeNamePrefix: "@_"
    });
    const newXml = builder.build(fb2Data);

    const newZip = new AdmZip();
    const newFilenameInternal = fb2Entry.entryName.replace('.fb2', '_Zoomer.fb2');
    newZip.addFile(newFilenameInternal, Buffer.from(newXml, 'utf8'));

    const outputFilename = BOOK_FILENAME.replace('.fb2.zip', '_Zoomer_Edition.fb2.zip');
    const outputPath = path.join(OUTPUT_DIR, outputFilename);
    const outputXmlPath = path.join(OUTPUT_DIR, outputFilename.replace('.zip', ''));

    newZip.writeZip(outputPath);
    fs.writeFileSync(outputXmlPath, newXml);

    console.log(`\n🎉 Success! Result:`);
    console.log(`   Zip: ${outputPath}`);
}

runRewrite().catch(console.error);
