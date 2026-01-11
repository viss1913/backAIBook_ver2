
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
const OUTPUT_DIR = path.join(__dirname, '../fb2Books/rewritten_editions');

// CONFIGURATION
const BOOK_FILENAME = 'Dyuma_Tri-mushketera_1_Tri-mushketera.Uk3Rnw.13332.fb2.zip';
const STYLE_NAME = 'Odessa'; // 'Zoomer', 'Odessa', 'Noir'
const PERCENTAGE_TO_PROCESS = 0.2; // 20%

// API Keys
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const STYLES = {
    'Zoomer': `Ты — профессиональный переводчик на язык зумеров и интернет-сленга. 
Твоя задача — переписать классический текст на современный молодежный лад (Gen Z style).
Используй слова: кринж, вайб, краш, рофл, пруфы, душнила, нормис, имба, сигма, скуф, тюбик, брух, ноу кап, база.
Стиль должен быть как треш-стрим или постироничный тред в Твиттере.`,

    'Odessa': `Ты — старый одессит, который рассказывает эту историю своим соседям на Привозе.
Используй колоритный одесский говор, юмор и обороты речи.
Используй фразы типа: "И шо вы думаете?", "Таки да", "Слушайте сюда", "Шоб я так жил", "Не делайте мне нервы", "Ой вэй".
Стиль: Бабель "Одесские рассказы", но чуть современнее.
Сохраняй сюжет и имена, но комментируй их поступки с житейской одесской мудростью.
Не пиши вступлений, просто давай переписанный текст.`
};

async function rewriteTextWithAI(textChunk, style) {
    const systemPrompt = STYLES[style] || STYLES['Zoomer'];

    try {
        const response = await axios.post(OPENROUTER_API_URL, {
            model: 'google/gemini-2.0-flash-001',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: textChunk }
            ],
            temperature: 0.85
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
        return textChunk;
    }
}

async function runRewrite() {
    console.log(`🎭 Starting ${STYLE_NAME} Style Rewrite Operation...`);
    console.log(`📖 Book: ${BOOK_FILENAME}`);
    console.log(`📊 Target: First ${PERCENTAGE_TO_PROCESS * 100}% of the book.`);

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
        fb2Data.FictionBook.description['title-info']['book-title'] = `${title} (${STYLE_NAME} Edition)`;
    }

    // 3. Обработка текста
    const body = fb2Data.FictionBook.body;
    const mainBody = Array.isArray(body) ? body[0] : body;

    // Собираем все главы (sections)
    const allSections = Array.isArray(mainBody.section) ? mainBody.section : [mainBody.section];

    const limitSections = Math.ceil(allSections.length * PERCENTAGE_TO_PROCESS);
    console.log(`Found ${allSections.length} chapters. We will rewrite the first ${limitSections} (approx 20%).`);

    // Отрезаем лишнее СРАЗУ, чтобы в итоговом файле был только переписанный кусок
    const sectionsToProcess = allSections.slice(0, limitSections);
    mainBody.section = sectionsToProcess; // Оставляем только нужные в структуре

    for (let i = 0; i < sectionsToProcess.length; i++) {
        const section = sectionsToProcess[i];
        console.log(`\n--- Rewriting Chapter ${i + 1}/${sectionsToProcess.length} ---`);

        let paragraphs = [];
        if (Array.isArray(section.p)) {
            paragraphs = section.p;
        } else if (section.p) {
            paragraphs = [section.p];
        } else {
            console.log('Empty chapter, skipping.');
            continue;
        }

        const CHUNK_SIZE = 6; // Чуть больше контекста для одесского стиля
        const newParagraphs = [];

        for (let j = 0; j < paragraphs.length; j += CHUNK_SIZE) {
            const chunk = paragraphs.slice(j, j + CHUNK_SIZE);
            // Извлекаем текст
            const textToRewrite = chunk.map(p => (typeof p === 'object' ? p['#text'] : p)).join('\n\n');

            if (textToRewrite.length < 50) {
                newParagraphs.push(...chunk);
                continue;
            }

            console.log(`Writing chunk ${Math.floor(j / CHUNK_SIZE) + 1}... (${textToRewrite.length} chars)`);

            const rewrittenText = await rewriteTextWithAI(textToRewrite, STYLE_NAME);

            const rewrittenPs = rewrittenText.split('\n').filter(line => line.trim().length > 0);
            newParagraphs.push(...rewrittenPs);

            await new Promise(r => setTimeout(r, 1200)); // Пауза
        }

        section.p = newParagraphs;
    }

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
    const newFilenameInternal = fb2Entry.entryName.replace('.fb2', `_${STYLE_NAME}.fb2`);
    newZip.addFile(newFilenameInternal, Buffer.from(newXml, 'utf8'));

    const outputFilename = BOOK_FILENAME.replace('.fb2.zip', `_${STYLE_NAME}_Edition.fb2.zip`);
    const outputPath = path.join(OUTPUT_DIR, outputFilename);
    const outputXmlPath = path.join(OUTPUT_DIR, outputFilename.replace('.zip', ''));

    newZip.writeZip(outputPath);
    // Для удобства просмотра
    fs.writeFileSync(outputXmlPath, newXml);

    console.log(`\n🎉 Success! Result:`);
    console.log(`   Zip: ${outputPath}`);
}

runRewrite().catch(console.error);
