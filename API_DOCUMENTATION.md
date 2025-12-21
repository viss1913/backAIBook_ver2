# API Документация для Android приложения

Документация по использованию API бэкенда для генерации AI-иллюстраций.

## 🔗 Базовый URL

**Локальная разработка:**
```
http://localhost:3000
```

**Production (Railway):**
```
https://your-app-name.railway.app
```

Замените `your-app-name` на имя вашего приложения на Railway.

---

## 📡 Endpoints

### 1. Проверка работоспособности сервера

**GET** `/health`

Проверяет, что сервер работает.

**Запрос:**
```http
GET /health HTTP/1.1
Host: your-app-name.railway.app
```

**Ответ (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2024-12-21T12:00:00.000Z"
}
```

**Использование:**
- Проверка доступности сервера перед основными запросами
- Пинг для поддержания соединения

---

### 2. Генерация AI-иллюстрации

**POST** `/api/generate-image`

Генерирует AI-иллюстрацию для выбранного фрагмента текста из книги.

#### Запрос

**Headers:**
```http
Content-Type: application/json
```

**Body:**
```json
{
  "bookTitle": "Война и мир",
  "author": "Лев Толстой",
  "textChunk": "Он стоял на балконе, глядя на закат. Солнце медленно опускалось за горизонт, окрашивая небо в багровые и золотые тона. В воздухе витала тишина, нарушаемая лишь далеким пением птиц."
}
```

**Параметры:**
- `bookTitle` (string, обязательное, max 100 символов) - Название книги
- `author` (string, обязательное, max 50 символов) - Автор книги
- `textChunk` (string, обязательное, max 500 слов) - Фрагмент текста для иллюстрации

#### Успешный ответ (200 OK)

```json
{
  "success": true,
  "imageUrl": "https://cdn.perplexity.ai/images/abc123.jpg",
  "promptUsed": "A detailed artistic illustration of a person standing on a balcony at sunset, with the sky painted in crimson and golden tones, peaceful atmosphere with distant bird songs"
}
```

**Поля ответа:**
- `success` (boolean) - Успешность операции (всегда `true` при 200)
- `imageUrl` (string) - URL сгенерированного изображения
- `promptUsed` (string) - Промпт, использованный для генерации (для отладки)

#### Ошибки

**400 Bad Request** - Ошибка валидации данных
```json
{
  "success": false,
  "error": "bookTitle must not exceed 100 characters, textChunk must not exceed 500 words"
}
```

**429 Too Many Requests** - Превышен лимит запросов
```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again later."
}
```

**500 Internal Server Error** - Ошибка сервера или API
```json
{
  "success": false,
  "error": "Failed to generate image. Please try again later."
}
```

---

## 📱 Примеры кода для Android (Kotlin)

### Использование Retrofit

#### 1. Модели данных

```kotlin
// Request модель
data class GenerateImageRequest(
    val bookTitle: String,
    val author: String,
    val textChunk: String
)

// Response модель
data class GenerateImageResponse(
    val success: Boolean,
    val imageUrl: String?,
    val promptUsed: String?,
    val error: String?
)

// Health check модель
data class HealthResponse(
    val status: String,
    val timestamp: String
)
```

#### 2. API Interface

```kotlin
import retrofit2.http.*

interface BookReaderApi {
    
    @GET("health")
    suspend fun checkHealth(): Response<HealthResponse>
    
    @POST("api/generate-image")
    suspend fun generateImage(
        @Body request: GenerateImageRequest
    ): Response<GenerateImageResponse>
}
```

#### 3. Retrofit Setup

```kotlin
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

object ApiClient {
    private const val BASE_URL = "https://your-app-name.railway.app/"
    private const val TIMEOUT_SECONDS = 35L // Немного больше чем timeout на сервере (30 сек)
    
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

#### 4. Использование в Activity/Fragment

```kotlin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

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
                
                val response = ApiClient.api.generateImage(request)
                
                withContext(Dispatchers.Main) {
                    hideLoading()
                    
                    if (response.isSuccessful && response.body()?.success == true) {
                        val imageUrl = response.body()?.imageUrl
                        if (imageUrl != null) {
                            // Загружаем и отображаем изображение
                            loadImage(imageUrl)
                        } else {
                            showError("Image URL not found in response")
                        }
                    } else {
                        // Обработка ошибок
                        val errorMessage = response.body()?.error 
                            ?: "Unknown error occurred"
                        handleError(response.code(), errorMessage)
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    hideLoading()
                    handleException(e)
                }
            }
        }
    }
    
    private fun handleError(statusCode: Int, errorMessage: String) {
        when (statusCode) {
            400 -> {
                // Ошибка валидации - показываем пользователю
                Toast.makeText(this, "Invalid input: $errorMessage", Toast.LENGTH_LONG).show()
            }
            429 -> {
                // Rate limit - предлагаем повторить позже
                Toast.makeText(this, "Too many requests. Please try again later.", Toast.LENGTH_LONG).show()
            }
            500 -> {
                // Ошибка сервера
                Toast.makeText(this, "Server error. Please try again later.", Toast.LENGTH_LONG).show()
            }
            else -> {
                Toast.makeText(this, "Error: $errorMessage", Toast.LENGTH_LONG).show()
            }
        }
    }
    
    private fun handleException(e: Exception) {
        when (e) {
            is java.net.SocketTimeoutException -> {
                Toast.makeText(this, "Request timeout. Please check your connection.", Toast.LENGTH_LONG).show()
            }
            is java.net.UnknownHostException -> {
                Toast.makeText(this, "Cannot connect to server. Check your internet connection.", Toast.LENGTH_LONG).show()
            }
            else -> {
                Toast.makeText(this, "Network error: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }
    
    private fun loadImage(imageUrl: String) {
        // Используйте Glide, Coil или другой библиотеку для загрузки изображения
        // Пример с Glide:
        // Glide.with(this).load(imageUrl).into(imageView)
    }
}
```

---

## 📱 Примеры кода для Android (Java)

### Использование Retrofit

#### 1. Модели данных

```java
// GenerateImageRequest.java
public class GenerateImageRequest {
    private String bookTitle;
    private String author;
    private String textChunk;
    
    public GenerateImageRequest(String bookTitle, String author, String textChunk) {
        this.bookTitle = bookTitle;
        this.author = author;
        this.textChunk = textChunk;
    }
    
    // Getters and setters
    public String getBookTitle() { return bookTitle; }
    public void setBookTitle(String bookTitle) { this.bookTitle = bookTitle; }
    
    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }
    
    public String getTextChunk() { return textChunk; }
    public void setTextChunk(String textChunk) { this.textChunk = textChunk; }
}

// GenerateImageResponse.java
public class GenerateImageResponse {
    private boolean success;
    private String imageUrl;
    private String promptUsed;
    private String error;
    
    // Getters and setters
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    
    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
    
    public String getPromptUsed() { return promptUsed; }
    public void setPromptUsed(String promptUsed) { this.promptUsed = promptUsed; }
    
    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
}
```

#### 2. API Interface

```java
import retrofit2.Call;
import retrofit2.http.*;

public interface BookReaderApi {
    @GET("health")
    Call<HealthResponse> checkHealth();
    
    @POST("api/generate-image")
    Call<GenerateImageResponse> generateImage(@Body GenerateImageRequest request);
}
```

#### 3. Использование

```java
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class BookReaderActivity extends AppCompatActivity {
    
    private void generateImage(String bookTitle, String author, String textChunk) {
        showLoading();
        
        GenerateImageRequest request = new GenerateImageRequest(bookTitle, author, textChunk);
        Call<GenerateImageResponse> call = ApiClient.getApi().generateImage(request);
        
        call.enqueue(new Callback<GenerateImageResponse>() {
            @Override
            public void onResponse(Call<GenerateImageResponse> call, Response<GenerateImageResponse> response) {
                hideLoading();
                
                if (response.isSuccessful() && response.body() != null) {
                    GenerateImageResponse body = response.body();
                    if (body.isSuccess() && body.getImageUrl() != null) {
                        loadImage(body.getImageUrl());
                    } else {
                        showError(body.getError());
                    }
                } else {
                    handleError(response.code(), response.body() != null ? response.body().getError() : "Unknown error");
                }
            }
            
            @Override
            public void onFailure(Call<GenerateImageResponse> call, Throwable t) {
                hideLoading();
                handleException(t);
            }
        });
    }
}
```

---

## 🔧 Использование OkHttp напрямую (без Retrofit)

```kotlin
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

class ApiService {
    private val client = OkHttpClient.Builder()
        .connectTimeout(35, TimeUnit.SECONDS)
        .readTimeout(35, TimeUnit.SECONDS)
        .build()
    
    private val baseUrl = "https://your-app-name.railway.app"
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
    
    fun generateImage(
        bookTitle: String,
        author: String,
        textChunk: String,
        callback: (Result<String>) -> Unit
    ) {
        val json = JSONObject().apply {
            put("bookTitle", bookTitle)
            put("author", author)
            put("textChunk", textChunk)
        }
        
        val requestBody = json.toString().toRequestBody(jsonMediaType)
        val request = Request.Builder()
            .url("$baseUrl/api/generate-image")
            .post(requestBody)
            .addHeader("Content-Type", "application/json")
            .build()
        
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                callback(Result.failure(e))
            }
            
            override fun onResponse(call: Call, response: Response) {
                val body = response.body?.string()
                if (response.isSuccessful && body != null) {
                    val jsonResponse = JSONObject(body)
                    if (jsonResponse.getBoolean("success")) {
                        val imageUrl = jsonResponse.getString("imageUrl")
                        callback(Result.success(imageUrl))
                    } else {
                        val error = jsonResponse.getString("error")
                        callback(Result.failure(Exception(error)))
                    }
                } else {
                    callback(Result.failure(Exception("Request failed: ${response.code}")))
                }
            }
        })
    }
}
```

---

## ⚠️ Важные замечания

### 1. Timeout
- Сервер имеет timeout 30 секунд для генерации изображения
- Рекомендуется установить timeout на клиенте 35-40 секунд

### 2. Обработка ошибок
- Всегда проверяйте `success` поле в ответе
- Обрабатывайте сетевые ошибки (timeout, no connection)
- Показывайте понятные сообщения пользователю

### 3. Валидация на клиенте
- Проверяйте длину `bookTitle` (max 100 символов)
- Проверяйте длину `author` (max 50 символов)
- Проверяйте количество слов в `textChunk` (max 500 слов)

### 4. Rate Limiting
- При получении 429 ошибки, не делайте повторные запросы сразу
- Добавьте задержку или покажите пользователю сообщение

### 5. Загрузка изображений
- Используйте библиотеки типа Glide, Coil или Picasso
- Кэшируйте изображения для повторного использования
- Обрабатывайте ошибки загрузки изображений

### 6. Интернет разрешения
Убедитесь, что в `AndroidManifest.xml` есть:
```xml
<uses-permission android:name="android.permission.INTERNET" />
```

---

## 📝 Пример валидации на клиенте (Kotlin)

```kotlin
fun validateInput(bookTitle: String, author: String, textChunk: String): ValidationResult {
    val errors = mutableListOf<String>()
    
    if (bookTitle.isBlank()) {
        errors.add("Book title is required")
    } else if (bookTitle.length > 100) {
        errors.add("Book title must not exceed 100 characters")
    }
    
    if (author.isBlank()) {
        errors.add("Author is required")
    } else if (author.length > 50) {
        errors.add("Author must not exceed 50 characters")
    }
    
    if (textChunk.isBlank()) {
        errors.add("Text chunk is required")
    } else {
        val wordCount = textChunk.trim().split("\\s+".toRegex()).size
        if (wordCount > 500) {
            errors.add("Text chunk must not exceed 500 words (current: $wordCount)")
        }
    }
    
    return if (errors.isEmpty()) {
        ValidationResult.Success
    } else {
        ValidationResult.Error(errors)
    }
}

sealed class ValidationResult {
    object Success : ValidationResult()
    data class Error(val messages: List<String>) : ValidationResult()
}
```

---

## 🧪 Тестирование с curl

```bash
# Health check
curl https://your-app-name.railway.app/health

# Generate image
curl -X POST https://your-app-name.railway.app/api/generate-image \
  -H "Content-Type: application/json" \
  -d '{
    "bookTitle": "Война и мир",
    "author": "Лев Толстой",
    "textChunk": "Он стоял на балконе, глядя на закат."
  }'
```

---

## 📞 Поддержка

При возникновении проблем:
1. Проверьте доступность сервера через `/health`
2. Проверьте формат запроса (Content-Type, JSON структура)
3. Проверьте логи сервера (если есть доступ)
4. Убедитесь, что API ключ настроен на сервере

