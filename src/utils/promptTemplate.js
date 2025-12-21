/**
 * Генерирует промпт для создания изображения на основе данных книги
 * @param {string} bookTitle - Название книги
 * @param {string} author - Автор книги
 * @param {string} textChunk - Фрагмент текста для иллюстрации
 * @param {string} prevSceneDescription - Описание предыдущей сцены (опционально, для консистентности персонажей)
 * @param {string} audience - Целевая аудитория: "adults", "children", "teens" (по умолчанию "adults")
 * @returns {string} Промпт для генерации изображения
 */
export function generateImagePrompt(bookTitle, author, textChunk, prevSceneDescription = null, audience = 'adults') {
  const prevScenePart = prevSceneDescription 
    ? `- Previous scene (for character consistency): "${prevSceneDescription}"`
    : '- Previous scene: not available (omit this section)';
  
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
3. Art style: matched to detected genre ("Tolkien-style fantasy", "noir detective", "19th century realism").
4. Lighting & composition: dramatic/soft lighting, vertical framing, dynamic angle.
5. Negative prompt section: "blurry, modern elements, distorted faces, low quality".

Output ONLY the final English prompt (100-200 words) in natural artist instruction style. Example format:
"A cinematic vertical illustration of [scene description from book]. Key elements: [list]. Atmosphere: [mood]. Style: [genre-matched style]. Lighting: [details], 9:16 aspect ratio, highly detailed."`;
}


