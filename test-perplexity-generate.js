import axios from 'axios';

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || 'YOUR_PERPLEXITY_API_KEY_HERE';
const PERPLEXITY_API_URL = 'https://api.perplexity.ai';

/**
 * Тест генерации изображений через Perplexity API
 */
async function testPerplexityImageGeneration() {
  console.log('=== Тест генерации изображений через Perplexity API ===\n');

  // Тест 1: Проверяем возможный эндпоинт для генерации изображений (как у OpenAI)
  console.log('Тест 1: Эндпоинт /images/generations (как у OpenAI)');
  try {
    const response = await axios.post(
      `${PERPLEXITY_API_URL}/images/generations`,
      {
        model: 'dall-e-3',
        prompt: 'A modern fintech app interface in minimalist style',
        n: 1,
        size: '1024x1024'
      },
      {
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ Успех! Ответ:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Ошибка:', error.response?.status, error.response?.data || error.message);
  }

  console.log('\n---\n');

  // Тест 2: Chat Completions с запросом на генерацию через специальную модель
  console.log('Тест 2: Chat Completions с моделью для генерации изображений');
  const modelsToTest = ['dall-e-3', 'playground-v2.5', 'playground', 'sonar-pro'];
  
  for (const model of modelsToTest) {
    console.log(`\nПробуем модель: ${model}`);
    try {
      const response = await axios.post(
        `${PERPLEXITY_API_URL}/chat/completions`,
        {
          model: model,
          messages: [
            {
              role: 'user',
              content: 'Generate an image of a modern fintech app interface in minimalist style'
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );
      console.log('✅ Ответ получен:', JSON.stringify(response.data, null, 2).substring(0, 300));
    } catch (error) {
      if (error.response) {
        console.log(`❌ ${error.response.status}:`, error.response.data?.error?.message || error.message);
      } else {
        console.log(`❌ Ошибка:`, error.message);
      }
    }
  }
}

testPerplexityImageGeneration();

