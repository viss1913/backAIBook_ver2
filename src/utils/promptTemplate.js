/**
 * Генерирует промпт для создания ОБЛОЖКИ книги
 * @param {string} bookTitle - Название книги
 * @param {string} author - Автор книги
 * @returns {string} Промпт для Gemini
 */
export function generateCoverPromptTemplate(bookTitle, author) {
  return `Create a professional, artistic book cover design prompt IN ENGLISH for an AI image generator.
  
  Book Title: "${bookTitle}"
  Author: "${author}"
  
  Instructions:
  1. Analyze the title and author to determine the likely genre and mood.
  2. Design a stunning, high-quality cover composition.
  3. Include artistic style (e.g., "minimalist", "oil painting", "digital art", "vintage", "3D render").
  4. Specify typography placement (though AI might not render text perfectly, describe the vibe of the title's visual style).
  5. Format: Vertical 9:16 aspect ratio.
  6. Atmosphere: Professional, book-store quality.
  
  Output ONLY the final English prompt (100-200 words).`;
}

/**
 * Генерирует промпт для АНАЛИЗА текста книги с целью поиска точек для иллюстраций
 * @param {string} textChunk - Большой фрагмент текста (глава или часть главы)
 * @returns {string} Промпт для Gemini
 */
export function generateAnalysisPromptTemplate(textChunk) {
  return `Analyze the following book text and identify 3-5 key moments that would be perfect for visual illustrations.
  
  Text: "${textChunk}"
  
  For each moment, provide:
  1. Character Offset: The approximate character position in the text (0 to ${textChunk.length}).
  2. Scene Description: A brief description of what is happening (in Russian).
  3. Visual Prompt: A detailed instruction for an image generator (in English) that describes the scene visually, including characters, environment, lighting, and style.
  
  Output the result ONLY as a JSON array of objects with the following keys: "offset", "description", "visualPrompt".
  Example: [{"offset": 120, "description": "Герой входит в лес", "visualPrompt": "A mysterious man entering a dark, enchanted forest..."}]`;
}

/**
 * Генерирует промпт для создания изображения на основе данных книги
 * @param {string} bookTitle - Название книги
 * @param {string} author - Автор книги
 * @param {string} textChunk - Фрагмент текста для иллюстрации
 * @param {string} prevSceneDescription - Описание предыдущей сцены (опционально, для консистентности персонажей)
 * @param {string} audience - Целевая аудитория: "adults", "children", "teens" (по умолчанию "adults")
 * @returns {string} Промпт для генерации изображения
 */
export function generateImagePrompt(bookTitle, author, textChunk, prevSceneDescription = null, audience = 'adults', styleDescription = null) {
  const prevScenePart = prevSceneDescription
    ? `- Previous scene (for character consistency): "${prevSceneDescription}"`
    : '- Previous scene: not available (omit this section)';

  const styleInstruction = styleDescription
    ? `3. Art style: MUST BE EXACTLY "${styleDescription}". Do not invent a different style.`
    : '3. Art style: matched to detected genre ("Tolkien-style fantasy", "noir detective", "19th century realism").';

  return `Create a detailed prompt IN ENGLISH for an AI image generator (DALL-E 3/Midjourney/Flux) to illustrate a key scene from the book "${bookTitle}" by "${author}".
  
  Reader is currently reading this page text: "${textChunk}" (analyze this text to determine genre, characters, atmosphere).
  
  Additional context:
  - Automatically detect book genre from text (fantasy/sci-fi/detective/classics/romance/horror etc.).
  ${prevScenePart}
  - Target audience: ${audience} (adults/children/teens).
  - Format: vertical 9:16 for mobile book reader app, ultra-detailed, 4K, cinematic quality.
  
  The generated prompt MUST include:
  1. Key scene elements: main characters, actions, setting (extract from page text).
  2. Atmosphere: emotions, time of day, weather (from text).
  ${styleInstruction}
  4. Lighting & composition: dramatic/soft lighting, vertical framing, dynamic angle.
  5. Negative prompt section: "blurry, modern elements, distorted faces, low quality".
  
  Output ONLY the final English prompt (100-200 words) in natural artist instruction style. Example format:
  "A cinematic vertical illustration of [scene description from book]. Key elements: [list]. Atmosphere: [mood]. Style: [requested style]. Lighting: [details], 9:16 aspect ratio, highly detailed."`;
}
