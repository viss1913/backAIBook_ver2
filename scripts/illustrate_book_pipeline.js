
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { parseFB2, analyzeContentWithGemini, injectImagesToFB2 } from '../src/services/fb2Service.js';
import { generateImageFromTextWithGenApi } from '../src/services/perplexityService.js';
import axios from 'axios';

// Настройка окружения
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const INPUT_DIR = path.join(__dirname, '../fb2Books');
const OUTPUT_DIR = path.join(__dirname, '../fb2Books/illustrated');
const TEMP_DIR = path.join(__dirname, '../temp_illustration');

// Имя файла книги
const BOOK_FILENAME = 'Tokareva_Carevna-lyagushka_3_Sleza-Zhar-pticy.fb2.zip';

// API Keys
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const GEN_API_KEY = process.env.GEN_API_KEY;

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

async function downloadImageToBase64(url) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data, 'binary').toString('base64');
    } catch (error) {
        console.error(`Failed to download image from ${url}:`, error.message);
        return null;
    }
}

async function runPipeline() {
    console.log('🚀 Starting AI Illustration Pipeline (Optimized)...');
    console.log(`📖 Book: ${BOOK_FILENAME}`);

    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY (OpenRouter) is missing!');
    if (!GEN_API_KEY) throw new Error('GEN_API_KEY is missing!');

    // 1. Распаковка и чтение
    console.log('\n📦 Step 1: Reading & Unzipping...');
    const zipPath = path.join(INPUT_DIR, BOOK_FILENAME);
    const zip = new AdmZip(zipPath);
    const zipEntries = zip.getEntries();

    let fb2Entry = zipEntries.find(entry => entry.entryName.endsWith('.fb2'));
    if (!fb2Entry) {
        throw new Error('No .fb2 file found in archive!');
    }

    console.log(`Found FB2: ${fb2Entry.entryName}`);
    const fb2Buffer = fb2Entry.getData();

    // 2. Парсинг и Флаттеринг секций
    console.log('\n🔍 Step 2: Parsing & Flattening Sections...');
    const { fb2Data, title, author } = parseFB2(fb2Buffer);
    console.log(`Title: ${title}, Author: ${author}`);

    // Рекурсивно собираем все секции с текстом
    const allSections = [];
    const collectSections = (node) => {
        if (!node) return;

        // Проверяем является ли узел секцией с текстом
        let hasText = false;
        if (node.p) hasText = true;

        // Если это "секция" и в ней есть параграфы - добавляем в список кандидатов
        // FB2 парсинг: node может быть section, или node может содержать section

        // Вариант А: node имеет поле section
        if (node.section) {
            const sections = Array.isArray(node.section) ? node.section : [node.section];
            sections.forEach(s => collectSections(s));
        }

        // Вариант Б: node сам является секцией (мы это поймем по наличию title или p, но лучше полагаться на рекурсию)
        if (hasText) {
            // Чтобы не добавлять "слишком мелкие" вложенные секции, можно проверять длину
            // Но для простоты добавляем все
            allSections.push(node);
        }
    };

    const body = fb2Data.FictionBook.body;
    const mainBody = Array.isArray(body) ? body[0] : body;
    collectSections(mainBody);

    console.log(`Found ${allSections.length} potential sections.`);

    // --- SMART SAMPLING STRATEGY ---
    const MAX_ILLUSTRATIONS = 5; // Максимум картинок на книгу (экономия $)
    let selectedSections = [];

    if (allSections.length === 0) {
        console.warn('No sections found! Using raw body fallback.');
        // Fallback если структура не стандартная
        selectedSections.push({ section: mainBody, index: 0 });
    } else {
        const step = Math.max(1, Math.floor(allSections.length / MAX_ILLUSTRATIONS));

        for (let i = 0; i < allSections.length && selectedSections.length < MAX_ILLUSTRATIONS; i += step) {
            selectedSections.push({
                section: allSections[i],
                index: i
            });
        }
    }

    console.log(`🎯 Selected ${selectedSections.length} sections for analysis.`);

    const readyIllustrations = [];

    // Цикл по выбранным секциям
    for (const [idx, item] of selectedSections.entries()) {
        const section = item.section;
        console.log(`\n--- Processing Section #${item.index} (${idx + 1}/${selectedSections.length}) ---`);

        // Извлекаем текст
        let sectionText = "";
        try {
            const paragraphs = section.p
                ? (Array.isArray(section.p) ? section.p : [section.p])
                : [];

            sectionText = paragraphs
                .map(p => typeof p === 'string' ? p : JSON.stringify(p))
                .join(' ')
                .substring(0, 4000);
        } catch (e) {
            console.warn('Failed to extract text, skipping.');
            continue;
        }

        if (sectionText.length < 300) {
            console.log('Section too short (<300 chars), skipping.');
            continue;
        }

        // 3. Анализ (AI Director)
        console.log(`🎬 Analyzing content...`);
        let scene = null;
        try {
            const analysisResult = await analyzeContentWithGemini(GEMINI_API_KEY, sectionText);

            if (Array.isArray(analysisResult) && analysisResult.length > 0) {
                scene = analysisResult[0];
            } else if (analysisResult && analysisResult.illustrations && analysisResult.illustrations.length > 0) {
                scene = analysisResult.illustrations[0];
            } else if (analysisResult && analysisResult.illustration) {
                scene = analysisResult.illustration;
            } else if (!Array.isArray(analysisResult) && analysisResult.contextDescription) {
                scene = analysisResult; // Если вернул сразу объект сцены
            }
        } catch (error) {
            console.error('Analysis failed:', error.message);
            // Если 404 - пробуем продолжить (может следующая сработает или это глюк OpenRouter)
            continue;
        }

        if (!scene) {
            console.log('No suitable scene found.');
            continue;
        }

        // 4. Генерация (AI Artist)
        console.log(`🎨 Generating Image: "${scene.contextDescription || scene.description || scene.prompt}"`);
        try {
            const chunk = scene.quote || scene.description || sectionText.substring(0, 500);

            const result = await generateImageFromTextWithGenApi(
                PERPLEXITY_API_KEY,
                GEN_API_KEY,
                title,
                author,
                chunk,
                { model: 'turbo', width: 1024, height: 1024 },
                null,
                'all ages',
                'fairytale book illustration, digital art, detailed'
            );

            console.log('✅ Image Generated:', result.imageUrl);
            const base64Data = await downloadImageToBase64(result.imageUrl);

            if (base64Data) {
                readyIllustrations.push({
                    id: `ill_ch${item.index}_${Date.now()}.png`,
                    base64Data: base64Data,
                    anchorText: scene.quote || "text_not_found_fallback",
                    prompt: result.promptUsed
                });
            }
        } catch (err) {
            console.error(`❌ Failed to generate image:`, err.message);
        }

        // Пауза
        await new Promise(r => setTimeout(r, 1500));
    }

    // 5. Сборка (Assembly)
    console.log('\n🔧 Step 5: Assembling new FB2...');
    const newXml = injectImagesToFB2(fb2Data, readyIllustrations);

    // Запаковываем в Zip
    const newZip = new AdmZip();
    // Имя сохраняется то же
    newZip.addFile(fb2Entry.entryName, Buffer.from(newXml, 'utf8'));

    const outputFilename = BOOK_FILENAME.replace('.fb2.zip', '_Illustrated.fb2.zip');
    const outputPath = path.join(OUTPUT_DIR, outputFilename);
    const outputXmlPath = path.join(OUTPUT_DIR, outputFilename.replace('.fb2.zip', '.fb2'));

    newZip.writeZip(outputPath);
    fs.writeFileSync(outputXmlPath, newXml);

    console.log(`\n🎉 Success! Illustrated book saved to:`);
    console.log(`   Zip: ${outputPath}`);
    console.log(`   FB2: ${outputXmlPath}`);
    console.log(`   Added ${readyIllustrations.length} images.`);
}

runPipeline().catch(console.error);
