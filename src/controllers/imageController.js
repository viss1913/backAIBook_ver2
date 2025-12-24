import { validateGenerateImageRequest, validateGetImagesFromPerplexityRequest } from '../validators/imageValidator.js';
import { generateImageFromText, generateImageFromTextWithGetImg, generateImageFromTextWithGigaChat, generateImageFromTextWithGenApi, getImagesFromPerplexity, generatePromptForImage } from '../services/perplexityService.js';
import { findBookByHash, saveBook, saveIllustration, getBookIllustrations, initDatabase } from '../utils/database.js';
import { analyzeContentWithGemini, parseFB2 } from '../services/fb2Service.js';
import { generateCoverPromptTemplate } from '../utils/promptTemplate.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Загрузка стилей при старте
let imageStylesConfig = { imageStyles: [] };
try {
  const configPath = path.resolve('src/config/imageStyles.json');
  if (fs.existsSync(configPath)) {
    imageStylesConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log(`Loaded ${imageStylesConfig.imageStyles.length} image styles.`);
  }
} catch (error) {
  console.error('Error loading image styles:', error.message);
}

function getAppliedStyle(styleKey) {
  const styles = imageStylesConfig.imageStyles;
  const fallback = styles.find(s => s.key === 'standard') || { key: 'standard', promptSuffix: 'cinematic digital illustration' };

  if (!styleKey) return fallback;
  const match = styles.find(s => s.key === styleKey);
  return match || fallback;
}

/**
 * Контроллер для генерации изображений
 */
export async function generateImage(req, res) {
  console.log('=== Generate Image Request ===');
  console.log('Request body:', JSON.stringify(req.body));

  try {
    // Валидация входных данных
    console.log('Validating request...');
    const validation = validateGenerateImageRequest(req.body);

    if (validation.error) {
      console.error('Validation error:', validation.error);
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    const { bookTitle, author, textChunk, prevSceneDescription, audience, styleKey } = validation.value;
    const appliedStyle = getAppliedStyle(styleKey);
    console.log('Validation passed. Style:', appliedStyle.key);
    console.log('Validation passed. Book:', bookTitle, 'Author:', author);

    // Генерируем хэш контента для кэширования
    const hash = crypto.createHash('sha256').update(`${bookTitle}:${author}:${textChunk}`).digest('hex');
    console.log('Content hash:', hash);

    // Проверяем в базе
    let existingBook = await findBookByHash(hash);
    if (existingBook) {
      const illustrations = await getBookIllustrations(existingBook.id);
      const inlineIll = illustrations.find(ill => ill.type === 'inline');
      if (inlineIll) {
        console.log('Found existing illustration in database:', inlineIll.image_url);
        return res.status(200).json({
          success: true,
          imageUrl: inlineIll.image_url,
          promptUsed: inlineIll.prompt,
          cached: true
        });
      }
    } else {
      // Сохраняем книгу, если её нет
      const bookId = await saveBook(bookTitle, author, hash);
      existingBook = { id: bookId };
    }

    // OpenRouter API ключ (используется для доступа к Gemini через OpenRouter)
    const openRouterApiKey = process.env.GEMINI_API_KEY;

    // Определяем провайдера из query параметра (по умолчанию 'laozhang')
    const provider = req.query.provider || 'laozhang';
    console.log('Using provider:', provider);

    if (!openRouterApiKey) {
      console.error('GEMINI_API_KEY (OpenRouter) is not set');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: GEMINI_API_KEY (OpenRouter key) is missing'
      });
    }

    let result;

    const styleSuffix = appliedStyle.promptSuffix;

    if (provider === 'gigachat') {
      const gigachatAuthKey = process.env.GIGACHAT_AUTH_KEY;
      const gigachatClientId = process.env.GIGACHAT_CLIENT_ID;
      const gigachatScope = process.env.GIGACHAT_SCOPE || 'GIGACHAT_API_PERS';
      result = await generateImageFromTextWithGigaChat(openRouterApiKey, gigachatAuthKey, gigachatClientId, bookTitle, author, textChunk, gigachatScope, prevSceneDescription || null, audience || 'adults', styleSuffix);
    } else if (provider === 'getimg') {
      const getImgApiKey = process.env.GETIMG_API_KEY;
      const imageModel = req.query.model || 'seedream-v4';
      const options = {};
      if (req.query.width) options.width = parseInt(req.query.width);
      if (req.query.height) options.height = parseInt(req.query.height);
      result = await generateImageFromTextWithGetImg(openRouterApiKey, getImgApiKey, bookTitle, author, textChunk, imageModel, options, prevSceneDescription || null, audience || 'adults', styleSuffix);
    } else if (provider === 'genapi') {
      const genApiKey = process.env.GEN_API_KEY;
      const callbackBaseUrl = process.env.RAILWAY_URL || req.protocol + '://' + req.get('host');
      const options = { acceleration: 'high' };
      if (req.query.width) options.width = parseInt(req.query.width);
      if (req.query.height) options.height = parseInt(req.query.height);
      result = await generateImageFromTextWithGenApi(openRouterApiKey, genApiKey, bookTitle, author, textChunk, callbackBaseUrl, options, prevSceneDescription || null, audience || 'adults', styleSuffix);
    } else {
      const laoZhangApiKey = process.env.LAOZHANG_API_KEY || process.env.LAOZHAN_API_KEY;
      const imageModel = req.query.model || 'flux-kontext-pro';
      result = await generateImageFromText(openRouterApiKey, laoZhangApiKey, bookTitle, author, textChunk, imageModel, prevSceneDescription || null, audience || 'adults', styleSuffix);
    }

    console.log('Image generation completed. URL:', result.imageUrl);

    // Сохраняем в базу для кэширования
    await saveIllustration(existingBook.id, 'inline', result.imageUrl, result.promptUsed, appliedStyle.key);

    return res.status(200).json({
      success: true,
      imageUrl: result.imageUrl,
      promptUsed: result.promptUsed,
      appliedStyleKey: appliedStyle.key
    });

  } catch (error) {
    console.error('Error generating image:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);

    // Обработка различных типов ошибок
    if (error.message.includes('Rate limit')) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please try again later.'
      });
    }

    if (error.message.includes('Invalid API key')) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }

    // Общая ошибка сервера с деталями для дебага
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate image. Please try again later.',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

/**
 * Контроллер для получения изображений через Perplexity API
 */
export async function getImagesFromPerplexityController(req, res) {
  console.log('=== Get Images From Perplexity Request ===');
  console.log('Request body:', JSON.stringify(req.body));

  try {
    // Валидация входных данных
    console.log('Validating request...');
    const validation = validateGetImagesFromPerplexityRequest(req.body);

    if (validation.error) {
      console.error('Validation error:', validation.error);
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    const { query, imageFormatFilter, imageDomainFilter } = validation.value;
    console.log('Validation passed. Query:', query);

    // Perplexity API ключ
    const perplexityApiKey = process.env.PERPLEXITY_API_KEY;

    console.log('Checking API key...');
    console.log('PERPLEXITY_API_KEY exists:', !!perplexityApiKey);

    if (!perplexityApiKey) {
      console.error('PERPLEXITY_API_KEY is not set');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: PERPLEXITY_API_KEY is missing'
      });
    }

    console.log('API key check passed. Starting image search...');

    // Получение изображений через Perplexity
    console.log('Calling getImagesFromPerplexity...');
    const result = await getImagesFromPerplexity(perplexityApiKey, query, {
      imageFormatFilter,
      imageDomainFilter
    });

    console.log(`Image search completed. Found ${result.images.length} images`);

    return res.status(200).json({
      success: true,
      images: result.images,
      textResponse: result.textResponse,
      citations: result.citations,
      searchResults: result.searchResults,
      count: result.images.length
    });

  } catch (error) {
    console.error('Error getting images from Perplexity:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);

    // Обработка различных типов ошибок
    if (error.message.includes('Rate limit')) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please try again later.'
      });
    }

    if (error.message.includes('Invalid API key')) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }

    // Общая ошибка сервера с деталями для дебага
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get images from Perplexity. Please try again later.',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

/**
 * Контроллер для генерации ОБЛОЖКИ книги
 */
export async function generateCover(req, res) {
  console.log('=== Generate Cover Request ===');
  const { bookTitle, author } = req.body;

  if (!bookTitle || !author) {
    return res.status(400).json({ success: false, error: 'bookTitle and author are required' });
  }

  try {
    const hash = crypto.createHash('sha256').update(`cover:${bookTitle}:${author}`).digest('hex');
    let existingBook = await findBookByHash(hash);

    if (existingBook) {
      const illustrations = await getBookIllustrations(existingBook.id);
      const cover = illustrations.find(ill => ill.type === 'cover');
      if (cover) {
        return res.status(200).json({ success: true, imageUrl: cover.image_url, cached: true });
      }
    } else {
      const bookId = await saveBook(bookTitle, author, hash);
      existingBook = { id: bookId };
    }

    const openRouterApiKey = process.env.GEMINI_API_KEY;
    const provider = req.query.provider || 'laozhang';
    const coverPrompt = generateCoverPromptTemplate(bookTitle, author);

    // Здесь вызываем сервис генерации (упрощенно через LaoZhang для примера)
    const laoZhangApiKey = process.env.LAOZHANG_API_KEY || process.env.LAOZHAN_API_KEY;
    const result = await generateImageFromText(openRouterApiKey, laoZhangApiKey, bookTitle, author, "This is a book cover", 'flux-kontext-pro');

    await saveIllustration(existingBook.id, 'cover', result.imageUrl, result.promptUsed);

    return res.status(200).json({ success: true, imageUrl: result.imageUrl });
  } catch (error) {
    console.error('Error generating cover:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Контроллер для АНАЛИЗА контента книги
 */
export async function analyzeBookContent(req, res) {
  console.log('=== Analyze Book Content Request ===');
  const { textChunk } = req.body;

  if (!textChunk) {
    return res.status(400).json({ success: false, error: 'textChunk is required' });
  }

  try {
    const openRouterApiKey = process.env.GEMINI_API_KEY;
    const analysis = await analyzeContentWithGemini(openRouterApiKey, textChunk);

    return res.status(200).json({ success: true, analysis });
  } catch (error) {
    console.error('Error analyzing content:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
