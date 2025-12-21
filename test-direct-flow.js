import { generateImageFromTextWithGigaChat } from './src/services/perplexityService.js';

// Тестовые данные (как будто с фронтенда)
const testData = {
  bookTitle: 'Война и мир',
  author: 'Лев Толстой',
  textChunk: 'Он стоял на балконе, глядя на закат. Солнце медленно опускалось за горизонт, окрашивая небо в багровые и золотые тона. В воздухе витала тишина, нарушаемая лишь далеким пением птиц.'
};

// API ключи (нужно установить реальные значения)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'sk-or-v1-...'; // OpenRouter ключ
const GIGACHAT_AUTH_KEY = process.env.GIGACHAT_AUTH_KEY || 'MDE5YjQxNWEtYTQzZS03MzE1LThjNzQtOWUxMDUwNzNmYjhiOjIyMDBkZjY1LTc2Y2MtNGNiNy05YTY0LWMwNDEzNDMwNWJkOQ==';
const GIGACHAT_CLIENT_ID = process.env.GIGACHAT_CLIENT_ID || '019b415a-a43e-7315-8c74-9e105073fb8b';

/**
 * Симуляция полного процесса
 */
async function simulateFullFlow() {
  console.log('=== Симуляция полного процесса генерации изображения ===\n');
  
  console.log('📥 Шаг 1: Получены данные с фронтенда:');
  console.log(JSON.stringify(testData, null, 2));
  console.log('\n---\n');
  
  console.log('🔄 Шаг 2: Отправка запроса в OpenRouter (Gemini) для генерации промпта...');
  console.log('   Модель: google/gemini-2.5-flash');
  console.log('   Функция: generatePromptForImage()');
  console.log('\n---\n');
  
  console.log('🔄 Шаг 3: Получение access_token от GigaChat через OAuth...');
  console.log('   Эндпоинт: /api/v2/oauth');
  console.log('   Scope: GIGACHAT_API_PERS');
  console.log('\n---\n');
  
  console.log('🔄 Шаг 4: Отправка промпта в GigaChat для генерации изображения...');
  console.log('   Эндпоинт: /api/v1/chat/completions');
  console.log('   Модель: GigaChat');
  console.log('   function_call: auto');
  console.log('\n---\n');
  
  console.log('🔄 Шаг 5: Скачивание изображения по file_id...');
  console.log('   Эндпоинт: /api/v1/files/{file_id}/content');
  console.log('\n---\n');
  
  try {
    console.log('⏳ Запускаем процесс...\n');
    const startTime = Date.now();
    
    const result = await generateImageFromTextWithGigaChat(
      GEMINI_API_KEY,
      GIGACHAT_AUTH_KEY,
      GIGACHAT_CLIENT_ID,
      testData.bookTitle,
      testData.author,
      testData.textChunk
    );
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n✅ Процесс завершен успешно!');
    console.log(`⏱️  Общее время: ${duration} секунд\n`);
    
    console.log('=== Результат ===');
    console.log('📝 Промпт, сгенерированный Gemini:');
    console.log(`   ${result.promptUsed}\n`);
    
    console.log('📸 Изображение:');
    if (result.imageUrl.startsWith('data:image')) {
      const sizeKB = (result.imageUrl.length / 1024).toFixed(2);
      console.log(`   Формат: Base64 Data URL (JPEG)`);
      console.log(`   Размер: ${sizeKB} KB (в base64)`);
      console.log(`   Первые 80 символов: ${result.imageUrl.substring(0, 80)}...`);
    } else {
      console.log(`   URL: ${result.imageUrl}`);
    }
    
    console.log('\n📋 Итоговый ответ для фронтенда:');
    console.log(JSON.stringify({
      success: true,
      imageUrl: result.imageUrl.substring(0, 100) + '...',
      promptUsed: result.promptUsed
    }, null, 2));
    
    console.log('\n✅ Все шаги выполнены успешно!');
    
  } catch (error) {
    console.error('\n❌ Ошибка на этапе:', error.message);
    console.error('\nСтек ошибки:', error.stack);
    
    if (error.message.includes('GEMINI_API_KEY')) {
      console.error('\n⚠️  Нужно установить реальный GEMINI_API_KEY (OpenRouter ключ)');
    }
    if (error.message.includes('GigaChat')) {
      console.error('\n⚠️  Проверьте GIGACHAT_AUTH_KEY и GIGACHAT_CLIENT_ID');
    }
  }
}

simulateFullFlow();


