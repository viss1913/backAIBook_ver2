import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createRequire } from 'module';

// Загружаем .env
dotenv.config();

// Проверяем переменные
const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GEN_API_KEY = process.env.GEN_API_KEY;
const GEN_API_BASE = 'https://api.gen-api.ru/api/v1';
const GEN_API_URL = `${GEN_API_BASE}/networks/z-image`;

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
 * Создает задачу генерации изображения через Gen-API
 * Согласно ТЗ: сначала пробуем GET, если не работает - POST
 */
async function createGenApiTask(prompt, options = {}) {
  if (!GEN_API_KEY) {
    throw new Error('GEN_API_KEY is not set in .env file');
  }

  const body = {
    // callback_url не передаем, используем long polling
    prompt: prompt,
    translate_input: options.translate_input ?? true,
    strength: options.strength ?? 1,
    width: options.width ?? 992,
    height: options.height ?? 992,
    num_images: options.num_images ?? 1,
    model: options.model ?? 'turbo',
    output_format: options.output_format ?? 'png',
    num_inference_steps: options.num_inference_steps ?? 8,
    enable_safety_checker: options.enable_safety_checker ?? true,
    acceleration: options.acceleration ?? 'none',
    enable_prompt_expansion: options.enable_prompt_expansion ?? false
  };

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${GEN_API_KEY}`
  };

  console.log('📤 Создание задачи генерации...');
  console.log('URL:', GEN_API_URL);
  console.log('Метод: GET (согласно ТЗ)');
  console.log('Промпт:', prompt);
  console.log('Параметры:', JSON.stringify(body, null, 2));
  console.log('\n---\n');

  // Сначала пробуем GET (как в ТЗ)
  try {
    console.log('🔄 Попытка 1: GET запрос (согласно ТЗ)...');
    const response = await axios.get(GEN_API_URL, {
      headers: headers,
      params: body, // Для GET передаем параметры через query string
      timeout: 30000
    });

    console.log('✅ GET запрос успешен!');
    console.log('Ответ:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    if (error.response?.status === 405 || error.message.includes('405')) {
      console.log('⚠️  GET не поддерживается, пробуем POST...');
    } else {
      console.log('⚠️  GET запрос не сработал, пробуем POST...');
      console.log('Ошибка:', error.response?.status, error.response?.data || error.message);
    }

    // Пробуем POST (стандартный метод для создания ресурсов)
    try {
      console.log('\n🔄 Попытка 2: POST запрос...');
      const response = await axios.post(GEN_API_URL, body, {
        headers: headers,
        timeout: 30000
      });

      console.log('✅ POST запрос успешен!');
      console.log('Ответ:', JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (postError) {
      console.error('❌ POST запрос также не сработал');
      console.error('Статус:', postError.response?.status);
      console.error('Данные:', JSON.stringify(postError.response?.data, null, 2));
      throw new Error(`Gen-API request failed: ${postError.response?.status || postError.message}`);
    }
  }
}

/**
 * Long polling для получения результата
 * Периодически опрашивает статус задачи
 * ВАЖНО: Первый ответ - только создание задачи, картинка приходит в output во втором ответе
 */
async function pollGenApiResult(requestId, maxAttempts = 60, intervalMs = 3000) {
  console.log(`\n🔄 Long polling для request_id: ${requestId}`);
  console.log(`Максимум попыток: ${maxAttempts}, интервал: ${intervalMs}ms`);
  console.log('⚠️  ВАЖНО: Первый ответ - только создание задачи, картинка будет в output!\n');

  // Пробуем разные эндпоинты для проверки статуса
  // ПРАВИЛЬНЫЙ эндпоинт: /request/get/{request_id}
  const endpoints = [
    `${GEN_API_BASE}/request/get/${requestId}`, // ⬅️ ПРАВИЛЬНЫЙ эндпоинт!
    `${GEN_API_BASE}/requests/${requestId}`,
    `${GEN_API_BASE}/networks/z-image/${requestId}`,
    `${GEN_API_BASE}/networks/z-image/requests/${requestId}`,
    `${GEN_API_BASE}/tasks/${requestId}`,
    `${GEN_API_BASE}/status/${requestId}`,
    `${GEN_API_BASE}/networks/z-image/status/${requestId}`,
    `${GEN_API_BASE}/networks/z-image/result/${requestId}`,
    `${GEN_API_BASE}/result/${requestId}`
  ];

  let workingEndpoint = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`\nПопытка ${attempt}/${maxAttempts}...`);

    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(endpoint, {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${GEN_API_KEY}`
          },
          timeout: 10000
        });

        const data = response.data;
        
        // Логируем только при первой успешной попытке или при изменении статуса
        if (attempt === 1 || data.status !== 'starting' && data.status !== 'processing' && data.status !== 'pending') {
          console.log(`✅ Эндпоинт: ${endpoint}`);
          console.log('Статус:', data.status || 'unknown');
          
          // Логируем полный ответ для анализа структуры output
          if (data.output) {
            console.log('📦 Output найден! Структура:', JSON.stringify(data.output, null, 2));
          }
        }

        // Проверяем статус
        if (data.status === 'success' || data.status === 'completed') {
          console.log('\n✅ Генерация завершена успешно!');
          
          // ВАЖНО: Картинка должна быть в output!
          if (!data.output) {
            console.warn('⚠️  Статус success, но output отсутствует!');
            console.warn('Полный ответ:', JSON.stringify(data, null, 2));
          } else {
            console.log('✅ Output найден, извлекаем изображение...');
          }
          
          workingEndpoint = endpoint;
          return data;
        } else if (data.status === 'failed' || data.status === 'error') {
          throw new Error(`Генерация завершилась с ошибкой: ${data.error || JSON.stringify(data)}`);
        } else if (data.status === 'processing' || data.status === 'starting' || data.status === 'pending') {
          if (workingEndpoint === null) {
            workingEndpoint = endpoint;
            console.log(`✅ Найден рабочий эндпоинт: ${endpoint}`);
          }
          // Задача еще в процессе, выходим из цикла по эндпоинтам и ждем
          break;
        }

        // Если статус не определен, пробуем следующий эндпоинт
        continue;
      } catch (error) {
        // Пробуем следующий эндпоинт
        if (error.response?.status === 404) {
          continue; // Эндпоинт не существует, пробуем следующий
        }
        // Другие ошибки игнорируем и пробуем следующий эндпоинт
      }
    }

    // Ждем перед следующей попыткой
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  throw new Error('Превышено время ожидания. Результат не получен.');
}

/**
 * Извлекает URL изображения из результата Gen-API
 * ВАЖНО: Структура ответа Gen-API:
 * - result: массив с URL ["https://..."]
 * - full_response: массив объектов [{"url": "https://..."}]
 * - output: может отсутствовать!
 */
function extractImageUrl(result) {
  console.log('\n🔍 Анализ структуры результата:');
  console.log('Доступные поля:', Object.keys(result));
  
  // Вариант 1: result - массив с URL (ПРАВИЛЬНЫЙ для Gen-API!)
  if (result.result && Array.isArray(result.result) && result.result.length > 0) {
    const imageUrl = result.result[0];
    if (typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
      console.log('✅ Найден URL в result[0]:', imageUrl);
      return imageUrl;
    }
  }

  // Вариант 2: full_response - массив объектов с url
  if (result.full_response && Array.isArray(result.full_response) && result.full_response.length > 0) {
    const firstItem = result.full_response[0];
    if (firstItem.url) {
      console.log('✅ Найден URL в full_response[0].url:', firstItem.url);
      return firstItem.url;
    }
  }

  // Вариант 3: output (старый формат, может отсутствовать)
  if (result.output) {
    console.log('📦 Output найден (старый формат)');
    const output = result.output;
  console.log('\n🔍 Анализ структуры output:');
  console.log('Тип output:', typeof output);
  console.log('Ключи output:', Object.keys(output));
  console.log('Полный output:', JSON.stringify(output, null, 2));

  // Вариант 1: output - массив объектов с url
  if (Array.isArray(output)) {
    console.log('📦 Output - массив, ищем изображения...');
    for (const item of output) {
      if (item.url) {
        console.log('✅ Найден URL в массиве:', item.url);
        return item.url;
      }
      if (item.image_url) {
        console.log('✅ Найден image_url в массиве:', item.image_url);
        return item.image_url;
      }
      if (item.image) {
        console.log('✅ Найден image в массиве');
        return typeof item.image === 'string' ? item.image : item.image.url || item.image.image_url;
      }
    }
  }

  // Вариант 2: output - объект с прямыми полями
  if (typeof output === 'object') {
    // Проверяем image (может быть base64 или URL)
    if (output.image) {
      const image = output.image;
      if (typeof image === 'string') {
        console.log('✅ Найден image (строка)');
        return image;
      } else if (typeof image === 'object' && image.url) {
        console.log('✅ Найден image.url:', image.url);
        return image.url;
      }
    }

    // Проверяем image_url
    if (output.image_url) {
      console.log('✅ Найден image_url:', output.image_url);
      return output.image_url;
    }

    // Проверяем url
    if (output.url) {
      console.log('✅ Найден url:', output.url);
      return output.url;
    }

    // Проверяем images (массив)
    if (output.images && Array.isArray(output.images) && output.images.length > 0) {
      const firstImage = output.images[0];
      if (typeof firstImage === 'string') {
        console.log('✅ Найден images[0] (строка):', firstImage);
        return firstImage;
      } else if (typeof firstImage === 'object') {
        if (firstImage.url) {
          console.log('✅ Найден images[0].url:', firstImage.url);
          return firstImage.url;
        }
        if (firstImage.image_url) {
          console.log('✅ Найден images[0].image_url:', firstImage.image_url);
          return firstImage.image_url;
        }
      }
    }

    // Проверяем data (может быть base64)
    if (output.data) {
      console.log('✅ Найден data');
      return typeof output.data === 'string' ? output.data : output.data.url || output.data.image_url;
    }
  }

  // Если ничего не нашли, выводим подробную информацию
  console.error('\n❌ Изображение не найдено!');
  console.error('Полный ответ:', JSON.stringify(result, null, 2));
  throw new Error('Изображение не найдено. Проверьте поля: result, full_response, output');
}

/**
 * Основная функция теста
 */
async function testGenApiDirect() {
  console.log('=== Тест Gen-API Z-Image (Long Polling) ===\n');
  console.log('GEN_API_KEY установлен:', !!GEN_API_KEY);
  console.log('GEN_API_URL:', GEN_API_URL);
  console.log('\n---\n');

  if (!GEN_API_KEY) {
    console.error('❌ GEN_API_KEY не установлен в .env файле!');
    console.error('Добавьте в .env: GEN_API_KEY=sk-ваш_ключ');
    return;
  }

  // Тестовый промпт - Гарри Поттер
  const prompt = 'Гарри Поттер в Большом зале Хогвартса, магический пир, плавающие свечи, готическая архитектура, волшебная атмосфера, детальная иллюстрация в стиле фэнтези';

  try {
    // Шаг 1: Создаем задачу
    const taskResult = await createGenApiTask(prompt, {
      width: 992,
      height: 992,
      model: 'turbo',
      output_format: 'png',
      num_inference_steps: 8,
      acceleration: 'none'
    });

    const requestId = taskResult.request_id;
    if (!requestId) {
      throw new Error('request_id не найден в ответе');
    }

    console.log(`\n✅ Задача создана!`);
    console.log(`Request ID: ${requestId}`);
    console.log(`Статус: ${taskResult.status}`);
    console.log('\n⚠️  ВАЖНО: Это только первый ответ - создание задачи!');
    console.log('   Картинка придет позже в поле output через long polling или callback.');
    console.log('\n💡 Сохраните этот request_id для получения результата позже:');
    console.log(`   node test-gen-api-get-by-id.js ${requestId}`);
    console.log('\n---\n');

    // Шаг 2: Long polling для получения результата
    const finalResult = await pollGenApiResult(requestId);

    console.log('\n---\n');
    console.log('📸 Извлечение изображения из результата...');
    console.log('⚠️  ВАЖНО: Картинка может быть в result, full_response или output!');

    // Шаг 3: Извлекаем изображение
    const imageUrl = extractImageUrl(finalResult);
    console.log('\n✅ Изображение извлечено!');

    if (imageUrl.startsWith('data:')) {
      console.log('Формат: Base64 (data URL)');
      console.log('Размер данных:', (imageUrl.length / 1024).toFixed(2), 'KB');
    } else if (imageUrl.startsWith('http')) {
      console.log('Формат: URL');
      console.log('URL:', imageUrl);
    } else {
      console.log('Формат: Base64 (без префикса)');
    }

    // Шаг 4: Сохраняем изображение
    console.log('\n💾 Сохранение изображения...');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputDir = path.join(__dirname, 'generated-images');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log('📁 Создана директория:', outputDir);
    }

    const outputPath = path.join(outputDir, `gen-api-${requestId}-${timestamp}`);
    const savedPath = await saveImage(imageUrl, outputPath);

    console.log('\n✅ Готово!');
    console.log('Изображение сохранено в:', savedPath);
    console.log('Полный путь:', path.resolve(savedPath));

  } catch (error) {
    console.error('\n❌ Ошибка при тестировании:\n');
    console.error('Сообщение:', error.message);
    if (error.response) {
      console.error('Статус:', error.response.status);
      console.error('Данные:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Запускаем тест
testGenApiDirect();

