# Инструкция для Android разработчика

## ⚠️ ВАЖНО: Обновленная версия

**Полная документация:** См. `ANDROID_API_COMPLETE.md` для полной документации со всеми endpoints.

## Генерация изображений через API

### Базовый URL
```
https://backaibookver2-production.up.railway.app
```

---

## Эндпоинт для генерации изображений

**POST** `/api/generate-image`

**⚠️ ИЗМЕНЕНИЕ:** Теперь требует `deviceId` в теле запроса и проверяет токены!

### Запрос

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "deviceId": "unique-device-id-12345",
  "bookTitle": "Война и мир",
  "author": "Лев Толстой",
  "textChunk": "Он стоял на балконе, глядя на закат. Солнце медленно опускалось за горизонт...",
  "styleKey": "standard"
}
```

**⚠️ ВАЖНО:**
- `deviceId` - **обязательное поле** (используйте `Settings.Secure.ANDROID_ID`)
- Новые пользователи получают 300 токенов бесплатно
- 1 изображение = 10 токенов
- Если изображение из кэша, токены не списываются

**Параметры:**
- `bookTitle` (string, обязательное, max 100 символов) - Название книги
- `author` (string, обязательное, max 50 символов) - Автор книги
- `textChunk` (string, обязательное, max 500 слов) - Фрагмент текста для иллюстрации

**Query параметры:**
- `provider` - Провайдер для генерации:
  - `gigachat` - GigaChat API (рекомендуется, синхронный) ⚡
  - `genapi` - Gen-API z-image (асинхронный, может занять 30-60 сек) ⏳
  - `getimg` - GetImg API
  - `laozhang` - LaoZhang API (по умолчанию)

**⚠️ Важно для Gen-API:**
- Gen-API работает асинхронно через callback
- Ответ может прийти через 30-60 секунд
- Увеличьте таймаут до 120 секунд для этого провайдера

---

## ⚡ Быстрый старт

```kotlin
// 1. Отправка запроса
val request = GenerateImageRequest(
    bookTitle = "Война и мир",
    author = "Лев Толстой",
    textChunk = "Он стоял на балконе..."
)

val response = api.generateImage("genapi", request)

// 2. Получение изображения
if (response.isSuccessful && response.body()?.success == true) {
    val imageUrl = response.body()?.imageUrl // data:image/png;base64,...
    displayImage(imageUrl!!)
}
```

---

## Ответ

### Успешный ответ (200 OK)

```json
{
  "success": true,
  "imageUrl": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aH...",
  "promptUsed": "A grand, 19th-century noble stands pensively on a sprawling balcony..."
}
```

**Поля:**
- `success` (boolean) - Успешность операции
- `imageUrl` (string) - Изображение в формате base64 data URL (например: `data:image/png;base64,iVBORw0KGgo...`)
- `promptUsed` (string) - Промпт, использованный для генерации (для отладки)

**⚠️ Формат изображения:**
- Все изображения возвращаются в формате **base64 data URL**
- Формат: `data:image/[тип];base64,[base64_строка]`
- Типы: `png`, `jpeg`, `webp` (зависит от провайдера)
- Android может работать с data URL напрямую через `BitmapFactory` или библиотеки типа Glide

### Ошибки

**400 Bad Request** - Ошибка валидации
```json
{
  "success": false,
  "error": "bookTitle must not exceed 100 characters"
}
```

**429 Too Many Requests** - Превышен лимит
```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again later."
}
```

**500 Internal Server Error** - Ошибка сервера
```json
{
  "success": false,
  "error": "Failed to generate image. Please try again later."
}
```

---

## Пример кода для Android (Kotlin)

### 1. Модели данных

```kotlin
// Request
data class GenerateImageRequest(
    val bookTitle: String,
    val author: String,
    val textChunk: String
)

// Response
data class GenerateImageResponse(
    val success: Boolean,
    val imageUrl: String?,
    val promptUsed: String?,
    val error: String?
)
```

### 2. Retrofit Interface

```kotlin
import retrofit2.http.*

interface BookReaderApi {
    @POST("api/generate-image")
    suspend fun generateImage(
        @Query("provider") provider: String = "gigachat",
        @Body request: GenerateImageRequest
    ): Response<GenerateImageResponse>
}
```

### 3. Использование в Activity/Fragment

```kotlin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import android.graphics.BitmapFactory
import android.util.Base64
import android.widget.ImageView

class BookReaderActivity : AppCompatActivity() {
    
    private fun generateImage(bookTitle: String, author: String, textChunk: String) {
        // Показываем индикатор загрузки
        showLoading()
        
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val request = GenerateImageRequest(
                    bookTitle = bookTitle,
                    author = author,
                    textChunk = textChunk
                )
                
                val response = ApiClient.api.generateImage("gigachat", request)
                
                withContext(Dispatchers.Main) {
                    hideLoading()
                    
                    if (response.isSuccessful && response.body()?.success == true) {
                        val imageUrl = response.body()?.imageUrl
                        if (imageUrl != null) {
                            // Отображаем изображение
                            displayImage(imageUrl)
                        } else {
                            showError("Image URL not found")
                        }
                    } else {
                        val errorMessage = response.body()?.error ?: "Unknown error"
                        showError(errorMessage)
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    hideLoading()
                    showError("Network error: ${e.message}")
                }
            }
        }
    }
    
    private fun displayImage(imageDataUrl: String) {
        try {
            // Проверяем формат: data URL или обычный URL
            if (imageDataUrl.startsWith("data:")) {
                // Извлекаем base64 из data URL
                // Формат: "data:image/png;base64,iVBORw0KGgo..." или "data:image/jpeg;base64,/9j/4AAQ..."
                val base64String = imageDataUrl.substringAfter(",")
                
                // Декодируем base64 в byte array
                val imageBytes = Base64.decode(base64String, Base64.DEFAULT)
                
                // Создаем Bitmap
                val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
                
                if (bitmap != null) {
                    // Отображаем в ImageView
                    imageView.setImageBitmap(bitmap)
                } else {
                    showError("Failed to decode image")
                }
            } else if (imageDataUrl.startsWith("http://") || imageDataUrl.startsWith("https://")) {
                // Если это обычный URL (не должно быть, но на всякий случай)
                // Используйте Glide или другую библиотеку для загрузки
                displayImageWithGlide(imageDataUrl)
            } else {
                showError("Unknown image format")
            }
            
        } catch (e: Exception) {
            showError("Failed to display image: ${e.message}")
        }
    }
    
    private fun showLoading() {
        // Показать ProgressBar или другой индикатор
        progressBar.visibility = View.VISIBLE
    }
    
    private fun hideLoading() {
        // Скрыть индикатор
        progressBar.visibility = View.GONE
    }
    
    private fun showError(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }
}
```

### 4. Использование Glide (рекомендуется)

Если используете библиотеку Glide:

```kotlin
import com.bumptech.glide.Glide

private fun displayImageWithGlide(imageDataUrl: String) {
    // Glide может работать с data URL напрямую
    Glide.with(this)
        .load(imageDataUrl)
        .into(imageView)
}
```

---

## Важные моменты

1. **Таймаут:** Установите таймаут минимум 120 секунд, так как генерация может занимать время
2. **Формат изображения:** Изображение приходит в формате JPEG, закодированное в base64
3. **Размер:** Изображение может быть большим, учитывайте это при обработке
4. **Обработка ошибок:** Всегда обрабатывайте ошибки сети и валидации

---

## Полный пример с Retrofit

```kotlin
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

object ApiClient {
    private const val BASE_URL = "https://backaibookver2-production.up.railway.app/"
    private const val TIMEOUT_SECONDS = 120L // Для Gen-API может потребоваться больше времени
    
    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .readTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .writeTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .build()
    
    private val retrofit = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(GsonConverterFactory.create())
        .build()
    
    val api: BookReaderApi = retrofit.create(BookReaderApi::class.java)
}
```

---

## Тестирование

Для тестирования можно использовать Postman или curl:

```bash
curl -X POST "https://your-app-name.railway.app/api/generate-image?provider=gigachat" \
  -H "Content-Type: application/json" \
  -d '{
    "bookTitle": "Война и мир",
    "author": "Лев Толстой",
    "textChunk": "Он стоял на балконе, глядя на закат..."
  }'
```

---

---

## 💰 Система токенов и платежи

### Новые Endpoints для работы с токенами

**Получить баланс токенов:**
```
GET /api/payments/balance?deviceId={deviceId}
```

**Получить список тарифов:**
```
GET /api/payments/pricing
```

**Создать платеж:**
```
POST /api/payments/create
Body: {"deviceId": "...", "tierId": "tier1"}
```

**Проверить статус платежа:**
```
GET /api/payments/status/{paymentId}
```

**История транзакций:**
```
GET /api/payments/transactions?deviceId={deviceId}&limit=50
```

### Тарифы

- **tier1**: 1000 токенов за 300 ₽
- **tier2**: 2000 токенов за 549 ₽ (рекомендуется) ⭐
- **tier3**: 4000 токенов за 999 ₽

### Важные моменты

- Новые пользователи получают **300 токенов** бесплатно
- **1 изображение = 10 токенов**
- Если изображение из кэша, токены **не списываются**
- После успешной оплаты токены начисляются автоматически

**📖 Полная документация:** См. `ANDROID_API_COMPLETE.md` для детальных примеров кода и всех endpoints с полными примерами реализации.

---

## Поддержка

При возникновении проблем проверьте:
1. Правильность URL сервера
2. Формат отправляемых данных
3. Наличие интернет-соединения
4. Логи сервера (если есть доступ)
5. **ВАЖНО:** Убедитесь, что передаете `deviceId` во всех запросах

