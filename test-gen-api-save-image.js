import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.RAILWAY_URL || 'http://localhost:3000';
const GEN_API_KEY = process.env.GEN_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Сохраняет изображение из base64 или URL в файл
 */
async function saveImage(imageData, outputPath) {
  try {
    // Если это data URL (base64)
    if (imageData.startsWith('data:')) {
      const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Определяем расширение файла
        let ext = 'png';
        if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
          ext = 'jpg';
        } else if (mimeType.includes('webp')) {
          ext = 'webp';
        }
        
        const finalPath = outputPath.endsWith(`.${ext}`) ? outputPath : `${outputPath}.${ext}`;
        fs.writeFileSync(finalPath, buffer);
        console.log(`✅ Изображение сохранено: ${finalPath}`);
        return finalPath;
      }
    }
    
    // Если это URL
    if (imageData.startsWith('http')) {
      console.log('📥 Скачивание изображения с URL...');
      const response = await axios.get(imageData, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);
      
      // Определяем расширение из Content-Type или URL
      const contentType = response.headers['content-type'] || 'image/png';
      let ext = 'png';
      if (contentType.includes('jpeg') || contentType.includes('jpg')) {
        ext = 'jpg';
      } else if (contentType.includes('webp')) {
        ext = 'webp';
      } else if (imageData.includes('.jpg') || imageData.includes('.jpeg')) {
        ext = 'jpg';
      } else if (imageData.includes('.webp')) {
        ext = 'webp';
      }
      
      const finalPath = outputPath.endsWith(`.${ext}`) ? outputPath : `${outputPath}.${ext}`;
      fs.writeFileSync(finalPath, buffer);
      console.log(`✅ Изображение скачано и сохранено: ${finalPath}`);
      return finalPath;
    }
    
    // Если это просто base64 без префикса
    try {
      const buffer = Buffer.from(imageData, 'base64');
      const finalPath = `${outputPath}.png`;
      fs.writeFileSync(finalPath, buffer);
      console.log(`✅ Изображение сохранено (base64): ${finalPath}`);
      return finalPath;
    } catch (e) {
      throw new Error('Не удалось распознать формат изображения');
    }
  } catch (error) {
    console.error('❌ Ошибка при сохранении изображения:', error.message);
    throw error;
  }
}

/**
 * Тест генерации изображения через API с сохранением
 */
async function testGenerateAndSaveImage() {
  console.log('=== Тест генерации изображения через Gen-API ===\n');
  console.log('Base URL:', BASE_URL);
  console.log('GEN_API_KEY установлен:', !!GEN_API_KEY);
  console.log('GEMINI_API_KEY установлен:', !!GEMINI_API_KEY);
  console.log('\n---\n');

  if (!GEN_API_KEY) {
    console.error('❌ GEN_API_KEY не установлен в .env файле!');
    return;
  }

  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY не установлен в .env файле!');
    return;
  }

  // Тестовые данные
  const testData = {
    bookTitle: 'Война и мир',
    author: 'Лев Толстой',
    textChunk: 'Он стоял на балконе, глядя на закат. Солнце медленно опускалось за горизонт, окрашивая небо в багровые и золотые тона. В воздухе витала тишина, нарушаемая лишь далеким пением птиц.'
  };

  console.log('📝 Тестовые данные:');
  console.log('Книга:', testData.bookTitle);
  console.log('Автор:', testData.author);
  console.log('Фрагмент:', testData.textChunk.substring(0, 100) + '...');
  console.log('\n---\n');

  try {
    console.log('📤 Отправка запроса на генерацию изображения...');
    console.log('Провайдер: gen-api');
    console.log('Ожидаемое время: 30-90 секунд\n');

    const startTime = Date.now();
    
    const response = await axios.post(
      `${BASE_URL}/api/generate-image?provider=gen-api`,
      testData,
      {
        timeout: 120000, // 2 минуты
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const duration = Date.now() - startTime;
    console.log(`\n✅ Успех! Время выполнения: ${(duration / 1000).toFixed(2)} секунд\n`);

    if (response.data.success) {
      console.log('📝 Промпт, использованный для генерации:');
      console.log(response.data.promptUsed);
      console.log('\n🖼️  Данные изображения:');
      
      const imageUrl = response.data.imageUrl;
      if (imageUrl) {
        if (imageUrl.startsWith('data:')) {
          console.log('Формат: Base64 (data URL)');
          console.log('Размер данных:', (imageUrl.length / 1024).toFixed(2), 'KB');
        } else if (imageUrl.startsWith('http')) {
          console.log('Формат: URL');
          console.log('URL:', imageUrl);
        }
        
        // Сохраняем изображение
        console.log('\n💾 Сохранение изображения...');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputDir = path.join(__dirname, 'generated-images');
        
        // Создаем директорию, если её нет
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
          console.log('📁 Создана директория:', outputDir);
        }
        
        const outputPath = path.join(outputDir, `image-${timestamp}`);
        const savedPath = await saveImage(imageUrl, outputPath);
        
        console.log('\n✅ Готово!');
        console.log('Изображение сохранено в:', savedPath);
        console.log('Полный путь:', path.resolve(savedPath));
      } else {
        console.log('⚠️  imageUrl отсутствует в ответе');
      }
    } else {
      console.log('❌ Ошибка:', response.data.error);
    }

  } catch (error) {
    console.error('\n❌ Ошибка при генерации изображения:\n');
    
    if (error.response) {
      console.error('Статус:', error.response.status);
      console.error('Данные ответа:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('Запрос отправлен, но ответа нет');
      console.error('Проверьте URL:', BASE_URL);
      console.error('Убедитесь, что сервер запущен');
    } else {
      console.error('Ошибка:', error.message);
    }
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Подсказка: Сервер не запущен или недоступен по адресу', BASE_URL);
      console.error('   Запустите сервер: npm run dev');
    }
  }
}

// Запускаем тест
testGenerateAndSaveImage();

