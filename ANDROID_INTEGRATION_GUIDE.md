# 📱 Простая инструкция для Android разработчика
## Генерация изображений для читалки

---

## 🎯 Что нужно сделать

1. Отправить JSON запрос на сервер
2. Подождать ответ (30-60 секунд)
3. Получить картинку в base64
4. Показать в ImageView

**Всё остальное делается на бэкенде!**

---

## 📍 Базовый URL

```
https://backaibookver2-production.up.railway.app
```

---

## 🔧 Шаг 1: Добавить зависимости

В `build.gradle` (Module: app):

```gradle
dependencies {
    // Retrofit для HTTP запросов
    implementation 'com.squareup.retrofit2:retrofit:2.9.0'
    implementation 'com.squareup.retrofit2:converter-gson:2.9.0'
    
    // OkHttp для таймаутов
    implementation 'com.squareup.okhttp3:okhttp:4.11.0'
    
    // Coroutines
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3'
}
```

В `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

---

## 📦 Шаг 2: Создать модели данных

### GenerateImageRequest.kt

```kotlin
data class GenerateImageRequest(
    val bookTitle: String,
    val author: String,
    val textChunk: String
)
```

### GenerateImageResponse.kt

```kotlin
data class GenerateImageResponse(
    val success: Boolean,
    val imageUrl: String?,  // data:image/png;base64,...
    val promptUsed: String?,
    val error: String?
)
```

---

## 🌐 Шаг 3: Настроить Retrofit

### ApiClient.kt

```kotlin
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {
    private const val BASE_URL = "https://backaibookver2-production.up.railway.app/"
    
    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(120, TimeUnit.SECONDS)  // Важно: 120 секунд!
        .readTimeout(120, TimeUnit.SECONDS)
        .writeTimeout(120, TimeUnit.SECONDS)
        .build()
    
    private val retrofit = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(GsonConverterFactory.create())
        .build()
    
    val api: BookReaderApi = retrofit.create(BookReaderApi::class.java)
}
```

### BookReaderApi.kt

```kotlin
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Query

interface BookReaderApi {
    @POST("api/generate-image")
    suspend fun generateImage(
        @Query("provider") provider: String = "genapi",
        @Body request: GenerateImageRequest
    ): Response<GenerateImageResponse>
}
```

---

## 🎨 Шаг 4: Использование в Activity/Fragment

### Простой пример

```kotlin
import android.graphics.BitmapFactory
import android.util.Base64
import android.widget.ImageView
import android.widget.ProgressBar
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class BookReaderActivity : AppCompatActivity() {
    
    private lateinit var imageView: ImageView
    private lateinit var progressBar: ProgressBar
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_book_reader)
        
        imageView = findViewById(R.id.imageView)
        progressBar = findViewById(R.id.progressBar)
    }
    
    /**
     * Генерирует изображение для фрагмента текста
     */
    fun generateImage(bookTitle: String, author: String, textChunk: String) {
        // Показываем загрузку
        progressBar.visibility = View.VISIBLE
        
        CoroutineScope(Dispatchers.IO).launch {
            try {
                // 1. Отправляем запрос
                val request = GenerateImageRequest(
                    bookTitle = bookTitle,
                    author = author,
                    textChunk = textChunk
                )
                
                val response = ApiClient.api.generateImage("genapi", request)
                
                // 2. Обрабатываем ответ
                withContext(Dispatchers.Main) {
                    progressBar.visibility = View.GONE
                    
                    if (response.isSuccessful && response.body()?.success == true) {
                        val imageUrl = response.body()?.imageUrl
                        if (imageUrl != null) {
                            // 3. Показываем картинку
                            showImage(imageUrl)
                        } else {
                            Toast.makeText(this@BookReaderActivity, "Изображение не получено", Toast.LENGTH_SHORT).show()
                        }
                    } else {
                        val error = response.body()?.error ?: "Ошибка сервера"
                        Toast.makeText(this@BookReaderActivity, error, Toast.LENGTH_LONG).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    progressBar.visibility = View.GONE
                    Toast.makeText(this@BookReaderActivity, "Ошибка: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
    
    /**
     * Показывает изображение из base64 data URL
     */
    private fun showImage(dataUrl: String) {
        try {
            // Формат: "data:image/png;base64,iVBORw0KGgo..."
            // Извлекаем base64 часть (после запятой)
            val base64String = dataUrl.substringAfter(",")
            
            // Декодируем base64 в байты
            val imageBytes = Base64.decode(base64String, Base64.DEFAULT)
            
            // Создаем Bitmap
            val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
            
            // Показываем в ImageView
            imageView.setImageBitmap(bitmap)
            
        } catch (e: Exception) {
            Toast.makeText(this, "Ошибка отображения: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }
}
```

---

## 📱 Пример использования

```kotlin
// Когда пользователь читает книгу и нужно показать иллюстрацию
generateImage(
    bookTitle = "Война и мир",
    author = "Лев Толстой",
    textChunk = "Он стоял на балконе, глядя на закат..."
)
```

---

## 🎨 Простой Layout

### activity_book_reader.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical">

    <!-- Текст книги -->
    <ScrollView
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1">
        
        <TextView
            android:id="@+id/textView"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:padding="16dp"
            android:textSize="16sp" />
    </ScrollView>

    <!-- Сгенерированное изображение -->
    <ImageView
        android:id="@+id/imageView"
        android:layout_width="match_parent"
        android:layout_height="200dp"
        android:scaleType="centerCrop"
        android:background="#F0F0F0" />

    <!-- Индикатор загрузки -->
    <ProgressBar
        android:id="@+id/progressBar"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_gravity="center"
        android:visibility="gone" />

</LinearLayout>
```

---

## ⚠️ Важно!

1. **Таймаут**: Обязательно установите 120 секунд (генерация может занять 30-60 секунд)
2. **Формат ответа**: Изображение всегда приходит как `data:image/png;base64,...`
3. **Обработка ошибок**: Всегда обрабатывайте сетевые ошибки и таймауты

---

## 🔄 Полный поток

```
1. Пользователь читает книгу
   ↓
2. Вызываете generateImage(bookTitle, author, textChunk)
   ↓
3. Показывается ProgressBar
   ↓
4. Отправляется POST запрос на /api/generate-image?provider=genapi
   ↓
5. Бэкенд генерирует изображение (OpenRouter → Gen-API)
   ↓
6. Получаете ответ: { "success": true, "imageUrl": "data:image/png;base64,..." }
   ↓
7. Декодируете base64 и показываете в ImageView
   ↓
8. Готово! 🎉
```

---

## 📝 Альтернатива: Использование Glide

Если используете библиотеку Glide, можно еще проще:

```kotlin
import com.bumptech.glide.Glide

private fun showImage(dataUrl: String) {
    // Glide может работать с data URL напрямую!
    Glide.with(this)
        .load(dataUrl)
        .into(imageView)
}
```

---

## ✅ Готово!

Это всё, что нужно. Просто:
- Отправить JSON
- Подождать
- Получить картинку
- Показать

**Всё остальное делает бэкенд!** 🚀
