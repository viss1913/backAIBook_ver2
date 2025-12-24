# Техническое задание: Flibusta PD Integration для AIBook

## Цель
Добавить backend-сервис для поиска и скачивания книг из Flibusta с автоматической проверкой статуса public domain (PD) по российскому закону (ГК РФ ст. 1281). Реализовать role-based доступ: обычные пользователи видят только PD-книги, VIP-пользователи имеют полный доступ.

---

## 1. Нормативно-правовая база

**Основное правило (ГК РФ ст. 1281):**
- Исключительные права действуют **всю жизнь автора + 70 лет после смерти** (считая с 1 января года, следующего за годом смерти).
- Книга переходит в public domain (ПД) когда: `текущий_год > (год_смерти_автора + 70)`.

**Источник данных для года смерти:**
- Используем **Perplexity API** через `/chat/completions` endpoint (OpenAI-совместимый).
- Perplexity Docs: https://docs.perplexity.ai/getting-started/overview
- Chat Completions: https://docs.perplexity.ai/api-reference/chat-completions-post

**Исключительные случаи:**
- Если год смерти не найден → помечаем статус как **"unknown_death_year"**, книгу не считаем ПД автоматически.
- Анонимные произведения: 70 лет с момента правомерного обнародования (тут используется год публикации).

---

## 2. Архитектура

### 2.1 Database Layer

**[MODIFY] `database.js`**

Создать таблицу `flibusta_books`:
```sql
CREATE TABLE flibusta_books (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  flibustaId VARCHAR(255) UNIQUE,
  title VARCHAR(500),
  author VARCHAR(255),
  deathYear INTEGER,
  expiryYear INTEGER,
  publicDomain BOOLEAN,
  formats JSON,
  localPath VARCHAR(255),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE author_rights_cache (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  author VARCHAR(255) UNIQUE,
  deathYear INTEGER,
  confidence FLOAT,
  checkedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vip_invites (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(255) UNIQUE,
  usedBy INTEGER,
  usedAt TIMESTAMP,
  expiresAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Helper методы:**
- `initFlibustaTable()` — инициализация таблиц
- `saveFlibustaBookMeta(meta)` — сохранение метаданных книги
- `findFlibustaBookById(flibustaId)` — поиск книги в кэше
- `getCachedAuthorRights(author)` — получение кэшированного статуса
- `saveCachedAuthorRights(author, deathYear, confidence)` — сохранение кэша

---

### 2.2 Services Layer

#### **[NEW] `services/aiMetadataService.js`**

Определение года смерти автора через Perplexity API.

```javascript
import axios from 'axios';

const client = axios.create({
  baseURL: process.env.PPLX_BASE_URL || 'https://api.perplexity.ai',
  headers: {
    Authorization: `Bearer ${process.env.PPLX_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

/**
 * Получить год смерти автора через Perplexity
 * @param {string} author - ФИ автора
 * @returns {Promise<{year: number|null, confidence: number}>}
 */
export async function getAuthorDeathYearFromAI(author) {
  try {
    const prompt = `
Назови только год смерти этого автора: "${author}".
Если точно неизвестно или нет единого мнения — ответь строго: NULL.
Не пиши никаких объяснений, только число года или NULL.
    `.trim();

    const { data } = await client.post('/chat/completions', {
      model: process.env.PPLX_MODEL || 'sonar-deep-research',
      messages: [
        { role: 'system', content: 'Ты юридический ассистент. Ответ должен быть максимально кратким.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 20,
    });

    const text = data.choices[0].message.content.trim();
    
    if (text === 'NULL' || text.toLowerCase() === 'null') {
      return { year: null, confidence: 0 };
    }

    const year = parseInt(text, 10);
    if (isNaN(year) || year < 1500 || year > new Date().getFullYear()) {
      return { year: null, confidence: 0 };
    }

    return { year, confidence: 0.9 };
  } catch (error) {
    console.error(`Error fetching death year for ${author}:`, error.message);
    return { year: null, confidence: 0 };
  }
}
```

#### **[NEW] `services/copyrightService.js`**

Логика проверки статуса PD.

```javascript
import * as db from '../database.js';
import { getAuthorDeathYearFromAI } from './aiMetadataService.js';

/**
 * Проверить статус public domain книги
 * @param {Object} book - {author, pubYear?}
 * @returns {Promise<{isPD: boolean, reason: string, deathYear: number|null, expiryYear: number|null}>}
 */
export async function checkPD({ author, pubYear }) {
  if (!author) {
    return {
      isPD: false,
      reason: 'unknown_author',
      deathYear: null,
      expiryYear: null,
    };
  }

  // Проверяем кэш
  const cached = await db.getCachedAuthorRights(author);
  let deathYear = null;

  if (cached && new Date() - cached.checkedAt < 30 * 24 * 60 * 60 * 1000) {
    deathYear = cached.deathYear;
  } else {
    // Запрашиваем Perplexity
    const { year, confidence } = await getAuthorDeathYearFromAI(author);
    deathYear = year;
    
    // Сохраняем в кэш
    if (deathYear) {
      await db.saveCachedAuthorRights(author, deathYear, confidence);
    }
  }

  // Если года смерти нет
  if (!deathYear) {
    return {
      isPD: false,
      reason: 'unknown_death_year',
      deathYear: null,
      expiryYear: null,
    };
  }

  // Считаем срок действия: смерть + 70 лет
  const expiryYear = deathYear + 70;
  const currentYear = new Date().getFullYear();
  const isPD = currentYear > expiryYear;

  return {
    isPD,
    reason: 'by_death_year',
    deathYear,
    expiryYear,
  };
}
```

#### **[NEW] `services/flibustaService.js`**

Интеграция с Flibusta API.

```javascript
import FlibustaAPI from 'flibusta';
import fs from 'fs/promises';
import path from 'path';
import * as copyrightService from './copyrightService.js';
import * as db from '../database.js';

const DOWNLOADS_DIR = process.env.DOWNLOADS_DIR || 'src/downloads';

const api = new FlibustaAPI(
  process.env.FLIBUSTA_MIRROR || 'https://flibusta.is'
);

/**
 * Поиск книг в Flibusta с проверкой PD
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function searchBooks(query, limit = 10) {
  try {
    const results = await api.getBooksByName(query);
    const books = results.items || results || [];

    const enriched = await Promise.all(
      books.slice(0, limit).map(async (book) => {
        const { isPD, reason, deathYear, expiryYear } = await copyrightService.checkPD({
          author: book.authors?.[0] || 'Unknown',
          pubYear: book.year,
        });

        return {
          id: book.id || `flibusta_${book.url?.split('/').pop()}`,
          title: book.title,
          author: book.authors?.[0] || 'Unknown',
          year: book.year,
          publicDomain: isPD,
          pdReason: reason,
          deathYear,
          expiryYear,
          downloads: book.downloads || [],
          cover: book.cover,
        };
      })
    );

    return enriched;
  } catch (error) {
    console.error('Error searching Flibusta:', error.message);
    return [];
  }
}

/**
 * Скачать книгу и сохранить локально
 * @param {string} bookId
 * @param {string} format - 'fb2' или 'epub'
 * @returns {Promise<{path: string, size: number}>}
 */
export async function downloadBook(bookId, format = 'fb2') {
  try {
    const bookMeta = await db.findFlibustaBookById(bookId);
    if (!bookMeta) {
      throw new Error('Book not found in cache');
    }

    // Проверяем, уже ли скачана
    if (bookMeta.localPath && fs.existsSync(bookMeta.localPath)) {
      const stats = await fs.stat(bookMeta.localPath);
      return { path: bookMeta.localPath, size: stats.size };
    }

    // Скачиваем с Flibusta
    const book = await api.getBook(bookId);
    const downloadLink = book.downloads?.find(d => d.type === format)?.link;
    
    if (!downloadLink) {
      throw new Error(`Format ${format} not available`);
    }

    const response = await fetch(`https://flibusta.is${downloadLink}`);
    const buffer = await response.arrayBuffer();

    // Сохраняем локально
    await fs.mkdir(DOWNLOADS_DIR, { recursive: true });
    const fileName = `${bookId}.${format}`;
    const filePath = path.join(DOWNLOADS_DIR, fileName);
    
    await fs.writeFile(filePath, Buffer.from(buffer));

    // Обновляем БД
    await db.saveFlibustaBookMeta({
      ...bookMeta,
      localPath: filePath,
      updatedAt: new Date(),
    });

    return { path: filePath, size: buffer.byteLength };
  } catch (error) {
    console.error(`Error downloading book ${bookId}:`, error.message);
    throw error;
  }
}
```

---

### 2.3 Middleware Layer

#### **[NEW/MODIFY] `middleware/auth.js`**

```javascript
import jwt from 'jsonwebtoken';

/**
 * Основная аутентификация - проверка JWT
 */
export function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Middleware для VIP-доступа: пропускаем PD-check если роль VIP
 */
export function vipBypassPD(req, res, next) {
  if (req.user?.role === 'vip') {
    req.skipPDCheck = true;
  }
  next();
}

/**
 * Требует определённую роль
 */
export function requireRole(requiredRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user.role !== requiredRole && req.user.role !== 'vip') {
      return res.status(403).json({ error: 'Access denied' });
    }

    next();
  };
}

/**
 * Только админы
 */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Rate limiting
 */
import rateLimit from 'express-rate-limit';

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many search requests, try again later',
});

export const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many download requests, try again later',
});
```

---

### 2.4 API Layer

#### **[NEW] `controllers/bookController.js`**

```javascript
import * as flibustaService from '../services/flibustaService.js';
import * as copyrightService from '../services/copyrightService.js';
import * as db from '../database.js';
import fs from 'fs';

/**
 * POST /api/books/search
 * Поиск книг в Flibusta
 */
export async function searchBooks(req, res) {
  try {
    const { query, limit = 10 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    const books = await flibustaService.searchBooks(query, limit);

    // Если пользователь не VIP - фильтруем только PD
    const filtered = req.skipPDCheck 
      ? books 
      : books.filter(b => b.publicDomain === true);

    res.json({
      query,
      total: filtered.length,
      books: filtered,
      userRole: req.user?.role,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
}

/**
 * GET /api/books/download/:id
 * Скачать книгу
 */
export async function downloadBook(req, res) {
  try {
    const { id } = req.params;
    const { format = 'fb2' } = req.query;

    // Получаем метаданные книги
    const book = await db.findFlibustaBookById(id);

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Проверяем доступ: обычные пользователи только PD, VIP - все
    if (!req.skipPDCheck && !book.publicDomain) {
      return res.status(403).json({ 
        error: 'This book is protected by copyright. Premium access required.',
        pdReason: book.pdReason,
        expiryYear: book.expiryYear,
      });
    }

    // Скачиваем и отдаём файл
    const { path: filePath } = await flibustaService.downloadBook(id, format);

    res.download(filePath, `${book.title}.${format}`, (err) => {
      if (err) console.error('Download error:', err);
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
}

/**
 * POST /api/auth/activate-vip
 * Активировать VIP по кодовому слову (фронт вызывает при первом открытии)
 */
export async function activateVIP(req, res) {
  try {
    const { code } = req.body;
    const userId = req.user?.id;

    if (!code || !userId) {
      return res.status(400).json({ error: 'Code and user required' });
    }

    // Проверяем код в БД
    // TODO: реализовать проверку кода в vip_invites
    const invite = await db.findVIPInvite(code);

    if (!invite || invite.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    // Обновляем роль пользователя
    await db.updateUserRole(userId, 'vip');
    await db.markInviteAsUsed(invite.id, userId);

    // Возвращаем новый JWT с ролью VIP
    const newToken = jwt.sign(
      { id: userId, role: 'vip' },
      process.env.JWT_SECRET
    );

    res.json({
      success: true,
      role: 'vip',
      token: newToken,
      message: 'VIP access activated!',
    });
  } catch (error) {
    console.error('VIP activation error:', error);
    res.status(500).json({ error: 'Activation failed' });
  }
}

/**
 * POST /api/admin/users/:userId/role
 * Админ может менять роль пользователя
 */
export async function updateUserRole(req, res) {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    const validRoles = ['user', 'premium', 'vip'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    await db.updateUserRole(userId, role);

    res.json({
      success: true,
      userId,
      newRole: role,
    });
  } catch (error) {
    console.error('Role update error:', error);
    res.status(500).json({ error: 'Update failed' });
  }
}
```

#### **[NEW] `routes/bookRoutes.js`**

```javascript
import express from 'express';
import * as bookController from '../controllers/bookController.js';
import { 
  authenticate, 
  vipBypassPD, 
  requireAdmin,
  searchLimiter,
  downloadLimiter 
} from '../middleware/auth.js';

const router = express.Router();

// Поиск книг (требует логин)
router.post(
  '/search',
  authenticate,
  vipBypassPD,
  searchLimiter,
  bookController.searchBooks
);

// Скачивание (требует логин)
router.get(
  '/download/:id',
  authenticate,
  vipBypassPD,
  downloadLimiter,
  bookController.downloadBook
);

// Активация VIP по коду (вызывается при первом запуске приложения)
router.post(
  '/activate-vip',
  authenticate,
  bookController.activateVIP
);

// Админ: менять роль пользователя
router.post(
  '/admin/users/:userId/role',
  authenticate,
  requireAdmin,
  bookController.updateUserRole
);

export default router;
```

#### **[MODIFY] `index.js`**

Добавить регистрацию маршрутов:

```javascript
import bookRoutes from './routes/bookRoutes.js';

// ... остальной код ...

app.use('/api/books', bookRoutes);

// ... оставить остальные маршруты ...
```

---

## 3. Переменные окружения (`.env`)

```env
# Основное
NODE_ENV=production
JWT_SECRET=your_super_secret_key_here
PORT=3000

# Flibusta
FLIBUSTA_MIRROR=https://flibusta.is
DOWNLOADS_DIR=src/downloads

# Perplexity API
PPLX_API_KEY=your_perplexity_api_key_here
PPLX_BASE_URL=https://api.perplexity.ai
PPLX_MODEL=sonar-deep-research

# Rate Limiting
SEARCH_RATE_LIMIT=30
DOWNLOAD_RATE_LIMIT=10

# Cache TTL
AUTHOR_CACHE_TTL_DAYS=30
BOOK_CACHE_TTL_DAYS=7
```

---

## 4. Railway Configuration

### 4.1 Volumes

Нужно смонтировать persistent storage для скачанных книг:

1. В Railway Dashboard → Select your service → Variables
2. Добавить Volume:
   - Mount Path: `/app/src/downloads`
   - Size: 10GB (или по мере необходимости)

Это гарантирует, что книги не удалятся при переразвёртывании.

### 4.2 Variables

В Railway Variables добавить все значения из `.env` (выше).

---

## 5. Тестирование

### 5.1 Unit Tests (`test-flibusta.js`)

```javascript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as copyrightService from '../services/copyrightService.js';
import * as flibustaService from '../services/flibustaService.js';

describe('Copyright Service', () => {
  it('should return PD for Tolstoy (died 1910)', async () => {
    const result = await copyrightService.checkPD({
      author: 'Лев Толстой',
    });
    expect(result.isPD).toBe(true);
    expect(result.reason).toBe('by_death_year');
  });

  it('should return NOT PD for Stephen King (died 2024+)', async () => {
    const result = await copyrightService.checkPD({
      author: 'Stephen King',
    });
    expect(result.isPD).toBe(false);
  });

  it('should handle unknown author gracefully', async () => {
    const result = await copyrightService.checkPD({
      author: 'Completely Unknown Zxcvbn Author',
    });
    expect(result.isPD).toBe(false);
    expect(result.reason).toBe('unknown_death_year');
  });
});

describe('Flibusta Service', () => {
  it('should search books and return PD-filtered results', async () => {
    const books = await flibustaService.searchBooks('Толстой', 5);
    expect(Array.isArray(books)).toBe(true);
    expect(books.length).toBeGreaterThan(0);
    books.forEach(book => {
      expect(book).toHaveProperty('title');
      expect(book).toHaveProperty('publicDomain');
      expect(book).toHaveProperty('pdReason');
    });
  });

  it('should download a PD book', async () => {
    const books = await flibustaService.searchBooks('Война и мир', 1);
    if (books.length > 0 && books[0].publicDomain) {
      const { path, size } = await flibustaService.downloadBook(books[0].id, 'fb2');
      expect(path).toBeTruthy();
      expect(size).toBeGreaterThan(0);
    }
  });
});
```

### 5.2 Manual Testing

**Curl для тестирования:**

```bash
# 1. Получить JWT токен (предполагая, что логин уже работает)
TOKEN="your_jwt_token_here"

# 2. Тест поиска (обычный пользователь - только PD)
curl -X POST http://localhost:3000/api/books/search \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"Чехов","limit":5}'

# Ожидание: массив с книгами где publicDomain: true

# 3. Тест поиска (VIP - все книги)
# (предполагая, что у пользователя role: vip в JWT)
curl -X POST http://localhost:3000/api/books/search \
  -H "Authorization: Bearer $VIP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"Stephen King","limit":5}'

# Ожидание: массив со всеми книгами, включая защищённые

# 4. Тест скачивания PD-книги
curl -X GET http://localhost:3000/api/books/download/flibusta_12345 \
  -H "Authorization: Bearer $TOKEN" \
  --output book.fb2

# 5. Тест активации VIP по коду
curl -X POST http://localhost:3000/api/auth/activate-vip \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"SECRET-VIP-123"}'
```

---

## 6. Примерные сроки

| Этап | Сложность | Время |
|------|-----------|-------|
| Database + helpers | Low | 1 час |
| Services (copyright + Flibusta) | Medium | 1.5 часа |
| API controllers + routes | Medium | 1 час |
| Auth middleware + VIP логика | Low | 30 мин |
| Tests + manual verification | Low | 1 час |
| Railway config + deploy | Low | 30 мин |
| **ИТОГО** | | **5-5.5 часов** |

---

## 7. Важные замечания

1. **Безопасность**: Все эндпоинты требуют JWT. Rate limiting добавлен, чтобы не перегружать Flibusta и не разориться на Perplexity API.

2. **Кэширование**: Результаты проверки PD кэшируются на 30 дней в БД, чтобы не дергать Perplexity при каждом поиске.

3. **Fallback**: Если Perplexity API недоступен, используем базовую логику: нет информации → не PD.

4. **Легальность**: Скачиваются только ПД-книги обычными пользователями. VIP-режим - для тестирования и избранных (объясни им про риски).

5. **Storage**: Railway Volume обязателен для персистентности файлов между деплойами.

6. **Monitoring**: Логируй ошибки Perplexity и Flibusta, чтобы видеть, что падает.

---

## 8. Дополнительно: Frontend (Android)

На фронте при первом запуске приложения показать экран:
- Заголовок: «У вас есть код доступа?»
- Поле ввода для кода
- Кнопка «Активировать» → вызов `/api/auth/activate-vip`
- Кнопка «Продолжить без кода» → обычный режим (user)

После активации обновить JWT в localStorage и перезагрузить роль.

---

**Готово к отправке разработчику!**