import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GEN_API_KEY = process.env.GEN_API_KEY;
const GEN_API_BASE = 'https://api.gen-api.ru/api/v1';

/**
 * Сохраняет изображение из base64 или URL в файл
 */
async function saveImage(imageData, outputPath) {
  try {
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
      }
      
      const finalPath = outputPath.endsWith(`.${ext}`) ? outputPath : `${outputPath}.${ext}`;
      fs.writeFileSync(finalPath, buffer);
      console.log(`✅ Изображение скачано и сохранено: ${finalPath}`);
      return finalPath;
    }
    
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
 * Пробует получить результат по request_id через разные эндпоинты
 */
async function getResultByRequestId(requestId) {
  console.log(`\n🔍 Поиск результата для request_id: ${requestId}\n`);

  // Пробуем разные возможные эндпоинты
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
    `${GEN_API_BASE}/result/${requestId}`,
    `${GEN_API_BASE}/requests/${requestId}/status`,
    `${GEN_API_BASE}/requests/${requestId}/result`
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Пробуем: ${endpoint}`);
      const response = await axios.get(endpoint, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${GEN_API_KEY}`
        },
        timeout: 10000
      });
      
      console.log(`✅ Успех! Статус: ${response.status}`);
      console.log('Данные:', JSON.stringify(response.data, null, 2));
      
      // ВАЖНО: Структура ответа Gen-API:
      // - result: массив с URL ["https://..."]
      // - full_response: массив объектов [{"url": "https://..."}]
      // - output: может отсутствовать!
      
      let imageUrl = null;
      
      // Вариант 1: result - массив с URL (ПРАВИЛЬНЫЙ!)
      if (response.data.result && Array.isArray(response.data.result) && response.data.result.length > 0) {
        imageUrl = response.data.result[0];
        if (typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
          console.log('✅ Изображение найдено в result[0]:', imageUrl);
          return { data: response.data, imageUrl, endpoint };
        }
      }

      // Вариант 2: full_response - массив объектов с url
      if (response.data.full_response && Array.isArray(response.data.full_response) && response.data.full_response.length > 0) {
        const firstItem = response.data.full_response[0];
        if (firstItem.url) {
          imageUrl = firstItem.url;
          console.log('✅ Изображение найдено в full_response[0].url:', imageUrl);
          return { data: response.data, imageUrl, endpoint };
        }
      }

      // Вариант 3: output (старый формат, может отсутствовать)
      if (response.data.output) {
        console.log('\n📸 Output найден (старый формат)');
        console.log('Структура output:', JSON.stringify(response.data.output, null, 2));
        
        const output = response.data.output;
        
        // Пробуем извлечь изображение из output
        if (Array.isArray(output)) {
          for (const item of output) {
            if (item.url) {
              imageUrl = item.url;
              break;
            }
            if (item.image_url) {
              imageUrl = item.image_url;
              break;
            }
            if (item.image) {
              imageUrl = typeof item.image === 'string' ? item.image : item.image.url || item.image.image_url;
              break;
            }
          }
        } else if (typeof output === 'object') {
          if (output.image) {
            imageUrl = typeof output.image === 'string' ? output.image : output.image.url || output.image.image_url;
          } else if (output.image_url) {
            imageUrl = output.image_url;
          } else if (output.url) {
            imageUrl = output.url;
          } else if (output.images && Array.isArray(output.images) && output.images.length > 0) {
            const firstImage = output.images[0];
            imageUrl = typeof firstImage === 'string' ? firstImage : firstImage.url || firstImage.image_url;
          } else if (output.data) {
            imageUrl = typeof output.data === 'string' ? output.data : output.data.url || output.data.image_url;
          }
        }
        
        if (imageUrl) {
          console.log('✅ Изображение найдено в output!');
          return { data: response.data, imageUrl, endpoint };
        }
      }
      
      // Если ничего не нашли
      if (!imageUrl) {
        console.log('⚠️  Изображение не найдено. Полный ответ:', JSON.stringify(response.data, null, 2));
      }
      
      // Если статус success, но нет output, возвращаем данные для анализа
      if (response.data.status === 'success') {
        return { data: response.data, imageUrl: null, endpoint };
      }
      
      return { data: response.data, imageUrl: null, endpoint };
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`   ❌ 404 - не найден\n`);
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        console.log(`   ❌ ${error.response.status} - ошибка авторизации\n`);
      } else if (error.response?.status) {
        console.log(`   ❌ ${error.response.status} - ${JSON.stringify(error.response.data)}\n`);
      } else {
        console.log(`   ❌ ${error.message}\n`);
      }
    }
  }

  return null;
}

/**
 * Основная функция
 */
async function main() {
  console.log('=== Получение результата Gen-API по request_id ===\n');
  
  if (!GEN_API_KEY) {
    console.error('❌ GEN_API_KEY не установлен в .env файле!');
    return;
  }

  // Получаем request_id из аргументов командной строки или просим ввести
  const requestId = process.argv[2];
  
  if (!requestId) {
    console.log('Использование: node test-gen-api-get-by-id.js <request_id>');
    console.log('\nПример: node test-gen-api-get-by-id.js 34866292');
    console.log('\nЕсли вы не знаете request_id, проверьте логи предыдущего запроса');
    console.log('или создайте новую задачу и скопируйте request_id из ответа.\n');
    return;
  }

  try {
    const result = await getResultByRequestId(requestId);
    
    if (!result) {
      console.log('\n⚠️  Не удалось найти рабочий эндпоинт для получения результата');
      console.log('Возможные причины:');
      console.log('1. request_id неверный');
      console.log('2. Задача еще не завершена');
      console.log('3. Нужно использовать callback_url для получения результата');
      return;
    }

    console.log(`\n✅ Результат получен через эндпоинт: ${result.endpoint}`);
    console.log(`Статус: ${result.data.status || 'unknown'}`);
    
    if (result.imageUrl) {
      console.log('\n💾 Сохранение изображения...');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputDir = path.join(__dirname, 'generated-images');
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const outputPath = path.join(outputDir, `gen-api-${requestId}-${timestamp}`);
      const savedPath = await saveImage(result.imageUrl, outputPath);
      
      console.log('\n✅ Готово!');
      console.log('Изображение сохранено в:', savedPath);
    } else {
      console.log('\n⚠️  Изображение не найдено в результате');
      console.log('Полные данные:', JSON.stringify(result.data, null, 2));
    }

  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    if (error.response) {
      console.error('Статус:', error.response.status);
      console.error('Данные:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

main();

