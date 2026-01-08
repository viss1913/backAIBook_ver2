# Инструкция по генерации изображений через Gen-API z-image

## Оглавление
1. [Общий обзор процесса](#общий-обзор-процесса)
2. [Шаг 1: Создание задачи генерации](#шаг-1-создание-задачи-генерации)
3. [Шаг 2: Получение результата (Long Polling)](#шаг-2-получение-результата-long-polling)
4. [Извлечение URL изображения](#извлечение-url-изображения)
5. [Полный пример кода](#полный-пример-кода)
6. [Обработка ошибок](#обработка-ошибок)
7. [Важные детали](#важные-детали)

---

## Общий обзор процесса

Генерация изображения через Gen-API z-image выполняется в **два этапа**:

1. **Создание задачи** - отправка POST запроса с промптом
2. **Получение результата** - опрос статуса задачи через GET запросы (Long Polling)

⚠️ **Важно:** API работает асинхронно. Первый запрос только создает задачу и возвращает `request_id`. Результат (URL картинки) нужно получать отдельными запросами, опрашивая статус задачи.

---

## Шаг 1: Создание задачи генерации

### Endpoint
```
POST https://api.gen-api.ru/api/v1/networks/z-image
```

### Заголовки
```http
Authorization: Bearer YOUR_GEN_API_KEY
Content-Type: application/json
Accept: application/json
```

### Тело запроса (JSON)

```json
{
  "translate_input": true,
  "prompt": "Ваш промпт для генерации изображения",
  "width": 992,
  "height": 992,
  "num_images": 1,
  "model": "turbo",
  "output_format": "png",
  "num_inference_steps": 8,
  "enable_safety_checker": true,
  "acceleration": "high",
  "enable_prompt_expansion": false
}
```

#### Параметры запроса:

| Параметр | Тип | Обязательный | Описание | Значение по умолчанию |
|----------|-----|--------------|----------|----------------------|
| `prompt` | string | ✅ Да | Текст описания изображения | - |
| `translate_input` | boolean | ❌ Нет | Автоматический перевод промпта | `true` |
| `width` | number | ❌ Нет | Ширина изображения в пикселях | `992` |
| `height` | number | ❌ Нет | Высота изображения в пикселях | `992` |
| `num_images` | number | ❌ Нет | Количество изображений (обычно 1) | `1` |
| `model` | string | ❌ Нет | Модель генерации | `"turbo"` |
| `output_format` | string | ❌ Нет | Формат вывода (`png`, `jpg`) | `"png"` |
| `num_inference_steps` | number | ❌ Нет | Количество шагов генерации | `8` |
| `enable_safety_checker` | boolean | ❌ Нет | Проверка безопасности контента | `true` |
| `acceleration` | string | ❌ Нет | Режим ускорения (`"none"`, `"high"`) | `"high"` |
| `enable_prompt_expansion` | boolean | ❌ Нет | Расширение промпта | `false` |

⚠️ **Примечание:** Параметр `callback_url` **НЕ передается**. Вместо callback используется Long Polling (опрос статуса).

### Пример ответа (успешное создание задачи)

```json
{
  "request_id": 12345,
  "status": "starting"
}
```

#### Поля ответа:

- `request_id` (number) - **Уникальный ID задачи**. Этот ID используется для получения результата.
- `status` (string) - Статус задачи: `"starting"`, `"processing"`, `"pending"`

---

## Шаг 2: Получение результата (Long Polling)

После получения `request_id`, необходимо периодически опрашивать статус задачи, пока она не завершится.

### Endpoint для проверки статуса
```
GET https://api.gen-api.ru/api/v1/request/get/{request_id}
```

⚠️ **Важно:** Используйте именно этот эндпоинт: `/request/get/{request_id}`, а не `/networks/z-image/{request_id}` или другие варианты.

### Заголовки
```http
Authorization: Bearer YOUR_GEN_API_KEY
Accept: application/json
```

### Рекомендуемые параметры опроса

- **Интервал между запросами:** 3 секунды (3000 мс)
- **Максимальное количество попыток:** 60 (всего ~3 минуты ожидания)
- **Timeout для каждого запроса:** 30 секунд

### Статусы задачи

| Статус | Описание | Действие |
|--------|----------|----------|
| `"starting"` | Задача только создана | Продолжать опрос |
| `"pending"` | Задача в очереди | Продолжать опрос |
| `"processing"` | Идет генерация изображения | Продолжать опрос |
| `"success"` | ✅ Генерация завершена успешно | **Извлечь URL картинки** |
| `"failed"` | ❌ Ошибка генерации | Обработать ошибку |
| `"error"` | ❌ Ошибка генерации | Обработать ошибку |

### Пример ответа во время обработки

```json
{
  "request_id": 12345,
  "status": "processing"
}
```

### Пример ответа при успехе

```json
{
  "request_id": 12345,
  "status": "success",
  "result": [
    "https://cdn.gen-api.ru/images/abc123def456.png"
  ]
}
```

**ИЛИ** (в зависимости от версии API):

```json
{
  "request_id": 12345,
  "status": "success",
  "full_response": [
    {
      "url": "https://cdn.gen-api.ru/images/abc123def456.png"
    }
  ]
}
```

---

## Извлечение URL изображения

Когда `status === "success"`, URL изображения нужно извлечь из ответа. Проверяйте поля в следующем порядке:

### 1. Поле `result` (приоритет)

Если поле `result` существует и является массивом с элементами:

```javascript
if (data.result && Array.isArray(data.result) && data.result.length > 0) {
  imageUrl = data.result[0]; // Это строка с URL
}
```

Пример структуры:
```json
{
  "status": "success",
  "result": ["https://cdn.gen-api.ru/images/abc123.png"]
}
```

### 2. Поле `full_response`

Если `result` не найден, проверьте `full_response`:

```javascript
if (data.full_response && Array.isArray(data.full_response) && data.full_response.length > 0) {
  imageUrl = data.full_response[0].url; // Объект с полем url
}
```

Пример структуры:
```json
{
  "status": "success",
  "full_response": [
    {
      "url": "https://cdn.gen-api.ru/images/abc123.png"
    }
  ]
}
```

### Форматы URL изображения

URL может быть в разных форматах:

1. **HTTP/HTTPS URL** (наиболее распространено):
   ```
   https://cdn.gen-api.ru/images/abc123def456.png
   ```

2. **Base64 data URL**:
   ```
   data:image/png;base64,iVBORw0KGgoAAAANS...
   ```

3. **Base64 строка без префикса**:
   ```
   iVBORw0KGgoAAAANS...
   ```

Рекомендуется проверять формат и обрабатывать соответственно:

```javascript
if (imageUrl.startsWith('http')) {
  // Это обычный URL, можно использовать напрямую
} else if (imageUrl.startsWith('data:')) {
  // Это data URL, уже готов для использования
} else {
  // Предполагаем base64 без префикса, можно добавить префикс:
  imageUrl = `data:image/png;base64,${imageUrl}`;
}
```

---

## Полный пример кода

### JavaScript/Node.js (с использованием axios)

```javascript
const axios = require('axios');

const GEN_API_BASE = 'https://api.gen-api.ru/api/v1';
const GEN_API_KEY = 'YOUR_GEN_API_KEY_HERE';

/**
 * Создает клиент axios для Gen-API
 */
function createGenApiClient(apiKey) {
  return axios.create({
    baseURL: GEN_API_BASE,
    timeout: 30000, // 30 секунд
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
}

/**
 * Создает задачу на генерацию изображения
 * @param {string} apiKey - API ключ Gen-API
 * @param {string} prompt - Промпт для генерации
 * @returns {Promise<number>} request_id задачи
 */
async function createImageGenerationTask(apiKey, prompt) {
  const client = createGenApiClient(apiKey);
  
  const requestData = {
    translate_input: true,
    prompt: prompt,
    width: 992,
    height: 992,
    num_images: 1,
    model: 'turbo',
    output_format: 'png',
    num_inference_steps: 8,
    enable_safety_checker: true,
    acceleration: 'high',
    enable_prompt_expansion: false
  };

  console.log('📤 Отправка запроса на создание задачи...');
  const response = await client.post('/networks/z-image', requestData);
  
  const requestId = response.data.request_id;
  const status = response.data.status;
  
  if (!requestId) {
    throw new Error('No request_id in Gen-API response');
  }
  
  console.log(`✅ Задача создана. Request ID: ${requestId}, Status: ${status}`);
  return requestId;
}

/**
 * Ожидает завершения задачи и получает URL изображения
 * @param {string} apiKey - API ключ Gen-API
 * @param {number} requestId - ID задачи
 * @param {number} maxAttempts - Максимальное количество попыток (по умолчанию 60)
 * @param {number} intervalMs - Интервал между попытками в миллисекундах (по умолчанию 3000)
 * @returns {Promise<string>} URL изображения
 */
async function pollGenApiResult(apiKey, requestId, maxAttempts = 60, intervalMs = 3000) {
  const client = createGenApiClient(apiKey);
  const endpoint = `/request/get/${requestId}`;

  console.log(`🔄 Начинаем опрос статуса задачи ${requestId}...`);
  console.log(`Максимум попыток: ${maxAttempts}, интервал: ${intervalMs}ms`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Попытка ${attempt}/${maxAttempts}...`);

      const response = await client.get(endpoint);
      const data = response.data;

      console.log(`Статус задачи: ${data.status || 'unknown'}`);

      // Успешное завершение
      if (data.status === 'success') {
        console.log('✅ Генерация завершена успешно!');

        // Извлекаем URL из result[0] или full_response[0].url
        let imageUrl = null;

        if (data.result && Array.isArray(data.result) && data.result.length > 0) {
          imageUrl = data.result[0];
          console.log('✅ URL найден в result[0]:', imageUrl);
        } else if (data.full_response && Array.isArray(data.full_response) && data.full_response.length > 0) {
          imageUrl = data.full_response[0].url;
          console.log('✅ URL найден в full_response[0].url:', imageUrl);
        }

        if (imageUrl) {
          return imageUrl;
        } else {
          throw new Error('Image URL not found in result. Check result or full_response fields.');
        }
      }
      
      // Ошибка генерации
      else if (data.status === 'failed' || data.status === 'error') {
        const errorMessage = data.error || 'Unknown error';
        throw new Error(`Gen-API generation failed: ${errorMessage}`);
      }
      
      // Задача еще обрабатывается
      else if (data.status === 'processing' || data.status === 'starting' || data.status === 'pending') {
        console.log(`⏳ Задача в процессе (${data.status}), ждем...`);
        // Ждем перед следующей попыткой (но не после последней)
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      }
      
      // Неизвестный статус
      else {
        console.log(`⚠️  Неизвестный статус: ${data.status}, ждем...`);
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      }
    } catch (error) {
      // Если задача не найдена (404), пробуем еще раз
      if (error.response?.status === 404) {
        console.log(`⚠️  Задача не найдена (404), пробуем еще раз...`);
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
          continue;
        }
      }
      // Другие ошибки пробрасываем выше
      throw error;
    }
  }

  // Превышено время ожидания
  throw new Error(`Превышено время ожидания (${maxAttempts} попыток). Результат не получен.`);
}

/**
 * Главная функция для генерации изображения
 * @param {string} apiKey - API ключ Gen-API
 * @param {string} prompt - Промпт для генерации
 * @returns {Promise<string>} URL сгенерированного изображения
 */
async function generateImage(apiKey, prompt) {
  try {
    // Шаг 1: Создаем задачу
    const requestId = await createImageGenerationTask(apiKey, prompt);
    
    // Шаг 2: Ожидаем результат
    const imageUrl = await pollGenApiResult(apiKey, requestId);
    
    return imageUrl;
  } catch (error) {
    console.error('❌ Ошибка при генерации изображения:', error.message);
    throw error;
  }
}

// Пример использования
async function main() {
  const apiKey = 'YOUR_GEN_API_KEY_HERE';
  const prompt = 'Гиперреалистичный портрет старейшины племени';

  try {
    console.log('🎨 Начинаем генерацию изображения...\n');
    const imageUrl = await generateImage(apiKey, prompt);
    console.log('\n🎉 Успех!');
    console.log('🖼️  URL изображения:', imageUrl);
  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    process.exit(1);
  }
}

// Раскомментируйте для запуска:
// main();
```

### Python пример

```python
import requests
import time

GEN_API_BASE = 'https://api.gen-api.ru/api/v1'
GEN_API_KEY = 'YOUR_GEN_API_KEY_HERE'

def create_gen_api_client(api_key):
    """Создает сессию requests с настроенными заголовками"""
    session = requests.Session()
    session.headers.update({
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    })
    session.timeout = 30
    return session

def create_image_generation_task(api_key, prompt):
    """Создает задачу на генерацию изображения"""
    client = create_gen_api_client(api_key)
    
    request_data = {
        'translate_input': True,
        'prompt': prompt,
        'width': 992,
        'height': 992,
        'num_images': 1,
        'model': 'turbo',
        'output_format': 'png',
        'num_inference_steps': 8,
        'enable_safety_checker': True,
        'acceleration': 'high',
        'enable_prompt_expansion': False
    }
    
    print('📤 Отправка запроса на создание задачи...')
    response = client.post(f'{GEN_API_BASE}/networks/z-image', json=request_data)
    response.raise_for_status()
    
    data = response.json()
    request_id = data.get('request_id')
    status = data.get('status')
    
    if not request_id:
        raise ValueError('No request_id in Gen-API response')
    
    print(f'✅ Задача создана. Request ID: {request_id}, Status: {status}')
    return request_id

def poll_gen_api_result(api_key, request_id, max_attempts=60, interval_seconds=3):
    """Ожидает завершения задачи и получает URL изображения"""
    client = create_gen_api_client(api_key)
    endpoint = f'{GEN_API_BASE}/request/get/{request_id}'
    
    print(f'🔄 Начинаем опрос статуса задачи {request_id}...')
    print(f'Максимум попыток: {max_attempts}, интервал: {interval_seconds}с')
    
    for attempt in range(1, max_attempts + 1):
        try:
            print(f'Попытка {attempt}/{max_attempts}...')
            
            response = client.get(endpoint)
            response.raise_for_status()
            data = response.json()
            
            status = data.get('status', 'unknown')
            print(f'Статус задачи: {status}')
            
            # Успешное завершение
            if status == 'success':
                print('✅ Генерация завершена успешно!')
                
                # Извлекаем URL
                image_url = None
                
                if data.get('result') and isinstance(data['result'], list) and len(data['result']) > 0:
                    image_url = data['result'][0]
                    print(f'✅ URL найден в result[0]: {image_url}')
                elif data.get('full_response') and isinstance(data['full_response'], list) and len(data['full_response']) > 0:
                    image_url = data['full_response'][0].get('url')
                    print(f'✅ URL найден в full_response[0].url: {image_url}')
                
                if image_url:
                    return image_url
                else:
                    raise ValueError('Image URL not found in result. Check result or full_response fields.')
            
            # Ошибка генерации
            elif status in ['failed', 'error']:
                error_msg = data.get('error', 'Unknown error')
                raise ValueError(f'Gen-API generation failed: {error_msg}')
            
            # Задача еще обрабатывается
            elif status in ['processing', 'starting', 'pending']:
                print(f'⏳ Задача в процессе ({status}), ждем...')
                if attempt < max_attempts:
                    time.sleep(interval_seconds)
            
            # Неизвестный статус
            else:
                print(f'⚠️  Неизвестный статус: {status}, ждем...')
                if attempt < max_attempts:
                    time.sleep(interval_seconds)
                    
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                print('⚠️  Задача не найдена (404), пробуем еще раз...')
                if attempt < max_attempts:
                    time.sleep(interval_seconds)
                    continue
            raise
    
    # Превышено время ожидания
    raise TimeoutError(f'Превышено время ожидания ({max_attempts} попыток). Результат не получен.')

def generate_image(api_key, prompt):
    """Главная функция для генерации изображения"""
    # Шаг 1: Создаем задачу
    request_id = create_image_generation_task(api_key, prompt)
    
    # Шаг 2: Ожидаем результат
    image_url = poll_gen_api_result(api_key, request_id)
    
    return image_url

# Пример использования
if __name__ == '__main__':
    api_key = 'YOUR_GEN_API_KEY_HERE'
    prompt = 'Гиперреалистичный портрет старейшины племени'
    
    try:
        print('🎨 Начинаем генерацию изображения...\n')
        image_url = generate_image(api_key, prompt)
        print('\n🎉 Успех!')
        print(f'🖼️  URL изображения: {image_url}')
    except Exception as e:
        print(f'\n❌ Ошибка: {e}')
        exit(1)
```

---

## Обработка ошибок

### HTTP ошибки

| Код | Описание | Действие |
|-----|----------|----------|
| `401` | Неверный API ключ | Проверить правильность ключа |
| `402` | Превышен лимит баланса | Пополнить баланс в личном кабинете |
| `403` | Доступ запрещен | Проверить права доступа API ключа |
| `404` | Задача не найдена (при опросе) | Может быть временной ошибкой, повторить запрос |
| `429` | Превышен лимит запросов | Увеличить интервал между запросами |
| `500` | Ошибка сервера Gen-API | Повторить запрос позже |

### Ошибки генерации

Если в ответе на опрос статуса `status === "failed"` или `status === "error"`:

```javascript
if (data.status === 'failed' || data.status === 'error') {
  const errorMessage = data.error || 'Unknown error';
  throw new Error(`Gen-API generation failed: ${errorMessage}`);
}
```

### Превышение времени ожидания

Если после всех попыток статус так и не стал `"success"`, выбрасывается ошибка:

```javascript
throw new Error(`Превышено время ожидания (${maxAttempts} попыток). Результат не получен.`);
```

Рекомендуется:
- Увеличить `maxAttempts` (например, до 120 для 6 минут ожидания)
- Увеличить `intervalMs` (например, до 5000 мс)
- Проверить статус задачи в личном кабинете Gen-API

---

## Важные детали

### 1. Базовый URL API

Всегда используйте базовый URL:
```
https://api.gen-api.ru/api/v1
```

### 2. Правильный эндпоинт для статуса

✅ **Правильно:**
```
GET /request/get/{request_id}
```

❌ **Неправильно (не использовать):**
- `/networks/z-image/{request_id}`
- `/networks/z-image/requests/{request_id}`
- `/networks/z-image/status/{request_id}`
- `/networks/z-image/result/{request_id}`
- `/requests/{request_id}`
- `/tasks/{request_id}`

### 3. Авторизация

API ключ передается в заголовке:
```
Authorization: Bearer YOUR_API_KEY
```

### 4. Асинхронность

API работает **асинхронно**. Первый запрос только создает задачу. Результат нужно получать отдельными запросами.

### 5. Время генерации

Обычно генерация занимает **30-60 секунд**, но может быть дольше в зависимости от нагрузки. Рекомендуется настроить:
- Интервал опроса: **3-5 секунд**
- Максимум попыток: **60-120** (3-6 минут ожидания)

### 6. Структура ответа может различаться

URL изображения может быть в разных полях:
- `data.result[0]` (строка с URL)
- `data.full_response[0].url` (объект с полем url)

Проверяйте оба варианта!

### 7. Формат URL изображения

URL может быть:
- HTTP/HTTPS URL: `https://cdn.gen-api.ru/images/abc123.png`
- Base64 data URL: `data:image/png;base64,...`
- Base64 строка: `iVBORw0KGgoAAAANS...`

### 8. Получение API ключа

API ключ можно получить в личном кабинете Gen-API:
- Сайт: https://gen-api.ru
- Документация: https://gen-api.ru/docs
- Документация z-image: https://gen-api.ru/model/z-image/api

---

## Краткая памятка

```
1. POST /networks/z-image → получаем request_id
2. GET /request/get/{request_id} (повторять каждые 3 сек)
   - Если status === "success" → извлекаем URL из result[0] или full_response[0].url
   - Если status === "failed"/"error" → обрабатываем ошибку
   - Если status === "processing"/"starting"/"pending" → продолжаем опрос
3. Используем полученный URL изображения
```

---

## Полезные ссылки

- Документация Gen-API: https://gen-api.ru/docs
- Документация z-image API: https://gen-api.ru/model/z-image/api
- Личный кабинет: https://gen-api.ru

---

**Удачной генерации изображений! 🎨**







