# Полная документация API для Android приложения

## 🔗 Базовый URL

**Production:**
```
https://backaibookver2-production.up.railway.app
```

---

## 📡 Все доступные Endpoints

### 1. Проверка работоспособности

**GET** `/health`

Проверяет, что сервер работает.

**Ответ:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-08T12:00:00.000Z",
  "uptime": 123.45
}
```

---

### 2. Генерация изображения (с системой токенов)

**POST** `/api/generate-image`

Генерирует AI-иллюстрацию. **Требует токены** (10 токенов за изображение).

**⚠️ ВАЖНО:** Теперь требует `deviceId` в теле запроса!

**Запрос:**
```json
{
  "deviceId": "unique-device-id-12345",
  "bookTitle": "Война и мир",
  "author": "Лев Толстой",
  "textChunk": "Он стоял на балконе, глядя на закат...",
  "styleKey": "standard"
}
```

**Успешный ответ (200):**
```json
{
  "success": true,
  "imageUrl": "https://...",
  "promptUsed": "...",
  "appliedStyleKey": "standard",
  "tokensRemaining": 290,
  "cached": false
}
```

**Ошибка недостатка токенов (402):**
```json
{
  "success": false,
  "error": "Insufficient tokens",
  "balance": 5,
  "required": 10,
  "message": "Недостаточно токенов. У вас 5, требуется 10"
}
```

**Параметры:**
- `deviceId` (string, **обязательное**) - Уникальный идентификатор устройства
- `bookTitle` (string, обязательное) - Название книги
- `author` (string, обязательное) - Автор
- `textChunk` (string, обязательное) - Фрагмент текста
- `styleKey` (string, опциональное) - Стиль изображения

---

### 3. Получить баланс токенов

**GET** `/api/payments/balance?deviceId={deviceId}`

Получает текущий баланс токенов пользователя.

**Запрос:**
```
GET /api/payments/balance?deviceId=unique-device-id-12345
```

**Ответ (200):**
```json
{
  "success": true,
  "balance": 300,
  "userId": 1
}
```

**Примечание:** Новые пользователи автоматически получают 300 токенов.

---

### 4. Получить список тарифов

**GET** `/api/payments/pricing`

Получает список доступных тарифов для покупки токенов.

**Запрос:**
```
GET /api/payments/pricing
```

**Ответ (200):**
```json
{
  "success": true,
  "pricing": [
    {
      "id": "tier1",
      "tokens": 1000,
      "price": 300.00,
      "pricePerToken": 0.30,
      "label": "1000 токенов",
      "description": "Базовый пакет",
      "popular": false
    },
    {
      "id": "tier2",
      "tokens": 2000,
      "price": 549.00,
      "pricePerToken": 0.2745,
      "label": "2000 токенов",
      "description": "Выгодный пакет",
      "popular": true
    },
    {
      "id": "tier3",
      "tokens": 4000,
      "price": 999.00,
      "pricePerToken": 0.24975,
      "label": "4000 токенов",
      "description": "Максимальный пакет",
      "popular": false
    }
  ]
}
```

---

### 5. Создать платеж

**POST** `/api/payments/create`

Создает платеж для пополнения токенов через Т-банк.

**Запрос:**
```json
{
  "deviceId": "unique-device-id-12345",
  "tierId": "tier2"
}
```

**Или кастомный платеж:**
```json
{
  "deviceId": "unique-device-id-12345",
  "tokensAmount": 1000,
  "amount": 300.00
}
```

**Ответ (200):**
```json
{
  "success": true,
  "paymentId": "payment_1234567890_abc123",
  "paymentUrl": "https://securepayments.tbank.ru/...",
  "orderId": "payment_1234567890_abc123",
  "amount": 549.00,
  "tokensAmount": 2000,
  "status": "processing"
}
```

**Параметры:**
- `deviceId` (string, обязательное) - ID устройства
- `tierId` (string, опциональное) - ID тарифа (tier1, tier2, tier3)
- `tokensAmount` (number, опциональное) - Количество токенов (если не указан tierId)
- `amount` (number, опциональное) - Сумма в рублях (если не указан tierId)

**Использование:**
1. Получите `paymentUrl` из ответа
2. Откройте его в WebView или браузере
3. Пользователь выполнит оплату
4. После оплаты проверьте статус через `/api/payments/status/:paymentId`

---

### 6. Проверить статус платежа

**GET** `/api/payments/status/:paymentId`

Проверяет статус платежа и начисляет токены при успешной оплате.

**Запрос:**
```
GET /api/payments/status/payment_1234567890_abc123
```

**Ответ (200):**
```json
{
  "success": true,
  "payment": {
    "paymentId": "payment_1234567890_abc123",
    "status": "completed",
    "amount": 549.00,
    "tokensAmount": 2000,
    "createdAt": "2024-01-08T12:00:00.000Z",
    "updatedAt": "2024-01-08T12:05:00.000Z"
  }
}
```

**Статусы:**
- `pending` - Ожидает оплаты
- `processing` - В обработке
- `completed` - Успешно завершен (токены начислены)
- `failed` - Ошибка
- `cancelled` - Отменен

**Рекомендация:** Проверяйте статус каждые 2-3 секунды после открытия Payment URL.

---

### 7. Получить историю транзакций

**GET** `/api/payments/transactions?deviceId={deviceId}&limit=50`

Получает историю всех операций с токенами.

**Запрос:**
```
GET /api/payments/transactions?deviceId=unique-device-id-12345&limit=50
```

**Ответ (200):**
```json
{
  "success": true,
  "transactions": [
    {
      "id": 1,
      "user_id": 1,
      "amount": -10,
      "type": "spend",
      "description": "Генерация изображения для \"Война и мир\"",
      "related_payment_id": null,
      "created_at": "2024-01-08T12:00:00.000Z"
    },
    {
      "id": 2,
      "user_id": 1,
      "amount": 2000,
      "type": "purchase",
      "description": "Пополнение токенов через платеж payment_123",
      "related_payment_id": 1,
      "created_at": "2024-01-08T11:00:00.000Z"
    }
  ],
  "count": 2
}
```

**Типы транзакций:**
- `spend` - Списание токенов (отрицательное значение)
- `earn` - Начисление токенов
- `bonus` - Бонусные токены (начальный баланс 300)
- `purchase` - Покупка токенов

---

## 💻 Примеры кода для Android (Kotlin)

### 1. Модели данных

```kotlin
// Запрос генерации изображения
data class GenerateImageRequest(
    val deviceId: String,
    val bookTitle: String,
    val author: String,
    val textChunk: String,
    val styleKey: String? = "standard"
)

// Ответ генерации изображения
data class GenerateImageResponse(
    val success: Boolean,
    val imageUrl: String?,
    val promptUsed: String?,
    val appliedStyleKey: String?,
    val tokensRemaining: Int?,
    val cached: Boolean? = false,
    val error: String? = null,
    val balance: Int? = null,
    val required: Int? = null
)

// Баланс токенов
data class TokenBalanceResponse(
    val success: Boolean,
    val balance: Int,
    val userId: Int
)

// Тариф
data class PricingTier(
    val id: String,
    val tokens: Int,
    val price: Double,
    val pricePerToken: Double,
    val label: String,
    val description: String,
    val popular: Boolean
)

data class PricingResponse(
    val success: Boolean,
    val pricing: List<PricingTier>
)

// Создание платежа
data class CreatePaymentRequest(
    val deviceId: String,
    val tierId: String? = null,
    val tokensAmount: Int? = null,
    val amount: Double? = null
)

data class CreatePaymentResponse(
    val success: Boolean,
    val paymentId: String,
    val paymentUrl: String?,
    val orderId: String,
    val amount: Double,
    val tokensAmount: Int,
    val status: String,
    val error: String? = null
)

// Статус платежа
data class PaymentStatus(
    val paymentId: String,
    val status: String,
    val amount: Double,
    val tokensAmount: Int,
    val createdAt: String,
    val updatedAt: String
)

data class PaymentStatusResponse(
    val success: Boolean,
    val payment: PaymentStatus
)

// Транзакция
data class TokenTransaction(
    val id: Int,
    val user_id: Int,
    val amount: Int,
    val type: String,
    val description: String?,
    val related_payment_id: Int?,
    val created_at: String
)

data class TransactionsResponse(
    val success: Boolean,
    val transactions: List<TokenTransaction>,
    val count: Int
)
```

### 2. Retrofit Interface

```kotlin
import retrofit2.http.*
import retrofit2.Response

interface BookReaderApi {
    
    // Генерация изображения
    @POST("api/generate-image")
    suspend fun generateImage(
        @Body request: GenerateImageRequest
    ): Response<GenerateImageResponse>
    
    // Баланс токенов
    @GET("api/payments/balance")
    suspend fun getTokenBalance(
        @Query("deviceId") deviceId: String
    ): Response<TokenBalanceResponse>
    
    // Тарифы
    @GET("api/payments/pricing")
    suspend fun getPricing(): Response<PricingResponse>
    
    // Создание платежа
    @POST("api/payments/create")
    suspend fun createPayment(
        @Body request: CreatePaymentRequest
    ): Response<CreatePaymentResponse>
    
    // Статус платежа
    @GET("api/payments/status/{paymentId}")
    suspend fun getPaymentStatus(
        @Path("paymentId") paymentId: String
    ): Response<PaymentStatusResponse>
    
    // История транзакций
    @GET("api/payments/transactions")
    suspend fun getTransactions(
        @Query("deviceId") deviceId: String,
        @Query("limit") limit: Int = 50
    ): Response<TransactionsResponse>
}
```

### 3. API Client

```kotlin
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

object ApiClient {
    private const val BASE_URL = "https://backaibookver2-production.up.railway.app/"
    private const val TIMEOUT_SECONDS = 120L
    
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

### 4. Использование в Activity/Fragment

```kotlin
import android.content.Context
import android.provider.Settings
import kotlinx.coroutines.*

class PaymentActivity : AppCompatActivity() {
    
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    
    // Получить deviceId (уникальный для устройства)
    private fun getDeviceId(): String {
        return Settings.Secure.getString(
            contentResolver,
            Settings.Secure.ANDROID_ID
        ) ?: UUID.randomUUID().toString()
    }
    
    // Получить баланс токенов
    private fun loadTokenBalance() {
        scope.launch {
            try {
                val response = ApiClient.api.getTokenBalance(getDeviceId())
                if (response.isSuccessful && response.body()?.success == true) {
                    val balance = response.body()?.balance ?: 0
                    updateBalanceUI(balance)
                }
            } catch (e: Exception) {
                showError("Ошибка загрузки баланса: ${e.message}")
            }
        }
    }
    
    // Получить тарифы
    private fun loadPricing() {
        scope.launch {
            try {
                val response = ApiClient.api.getPricing()
                if (response.isSuccessful && response.body()?.success == true) {
                    val pricing = response.body()?.pricing ?: emptyList()
                    displayPricingOptions(pricing)
                }
            } catch (e: Exception) {
                showError("Ошибка загрузки тарифов: ${e.message}")
            }
        }
    }
    
    // Создать платеж
    private fun createPayment(tierId: String) {
        scope.launch {
            try {
                showLoading()
                val request = CreatePaymentRequest(
                    deviceId = getDeviceId(),
                    tierId = tierId
                )
                
                val response = ApiClient.api.createPayment(request)
                
                if (response.isSuccessful && response.body()?.success == true) {
                    val paymentUrl = response.body()?.paymentUrl
                    if (paymentUrl != null) {
                        // Открыть Payment URL в WebView или браузере
                        openPaymentUrl(paymentUrl)
                        
                        // Начать проверку статуса
                        startPaymentStatusCheck(response.body()?.paymentId ?: "")
                    } else {
                        showError("Payment URL не получен")
                    }
                } else {
                    val error = response.body()?.error ?: "Неизвестная ошибка"
                    showError("Ошибка создания платежа: $error")
                }
            } catch (e: Exception) {
                showError("Ошибка сети: ${e.message}")
            } finally {
                hideLoading()
            }
        }
    }
    
    // Проверить статус платежа
    private fun checkPaymentStatus(paymentId: String) {
        scope.launch {
            try {
                val response = ApiClient.api.getPaymentStatus(paymentId)
                if (response.isSuccessful && response.body()?.success == true) {
                    val status = response.body()?.payment?.status
                    when (status) {
                        "completed" -> {
                            // Платеж успешен, токены начислены
                            showSuccess("Токены успешно начислены!")
                            loadTokenBalance() // Обновить баланс
                            stopPaymentStatusCheck()
                        }
                        "failed", "cancelled" -> {
                            showError("Платеж не завершен: $status")
                            stopPaymentStatusCheck()
                        }
                        else -> {
                            // Продолжаем проверку
                        }
                    }
                }
            } catch (e: Exception) {
                // Игнорируем ошибки при проверке статуса
            }
        }
    }
    
    // Периодическая проверка статуса платежа
    private var statusCheckJob: Job? = null
    
    private fun startPaymentStatusCheck(paymentId: String) {
        stopPaymentStatusCheck()
        statusCheckJob = scope.launch {
            repeat(30) { // Проверяем 30 раз (примерно 1 минута)
                delay(2000) // Каждые 2 секунды
                checkPaymentStatus(paymentId)
            }
        }
    }
    
    private fun stopPaymentStatusCheck() {
        statusCheckJob?.cancel()
        statusCheckJob = null
    }
    
    // Генерация изображения
    private fun generateImage(bookTitle: String, author: String, textChunk: String) {
        scope.launch {
            try {
                showLoading()
                val request = GenerateImageRequest(
                    deviceId = getDeviceId(),
                    bookTitle = bookTitle,
                    author = author,
                    textChunk = textChunk,
                    styleKey = "standard"
                )
                
                val response = ApiClient.api.generateImage(request)
                
                if (response.isSuccessful) {
                    val body = response.body()
                    if (body?.success == true) {
                        // Успех
                        val imageUrl = body.imageUrl
                        val tokensRemaining = body.tokensRemaining
                        
                        if (imageUrl != null) {
                            displayImage(imageUrl)
                            updateBalanceUI(tokensRemaining ?: 0)
                        }
                    } else {
                        // Ошибка (например, недостаточно токенов)
                        if (response.code() == 402) {
                            // Недостаточно токенов
                            val balance = body?.balance ?: 0
                            val required = body?.required ?: 10
                            showInsufficientTokensDialog(balance, required)
                        } else {
                            showError(body?.error ?: "Неизвестная ошибка")
                        }
                    }
                } else {
                    showError("Ошибка сервера: ${response.code()}")
                }
            } catch (e: Exception) {
                showError("Ошибка сети: ${e.message}")
            } finally {
                hideLoading()
            }
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }
}
```

---

## 🔑 Важные моменты

1. **deviceId** - Используйте `Settings.Secure.ANDROID_ID` для получения уникального ID устройства
2. **Токены** - Новые пользователи получают 300 токенов автоматически
3. **Стоимость** - 1 изображение = 10 токенов
4. **Кэширование** - Если изображение уже было сгенерировано, токены не списываются
5. **Платежи** - После успешной оплаты токены начисляются автоматически через webhook
6. **Проверка статуса** - Проверяйте статус платежа каждые 2-3 секунды после открытия Payment URL

---

## 📱 Полный пример использования

```kotlin
class MainActivity : AppCompatActivity() {
    
    private val deviceId = Settings.Secure.getString(
        contentResolver,
        Settings.Secure.ANDROID_ID
    ) ?: UUID.randomUUID().toString()
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Загрузить баланс при старте
        loadBalance()
        
        // Загрузить тарифы
        loadPricing()
    }
    
    private fun loadBalance() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = ApiClient.api.getTokenBalance(deviceId)
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful) {
                        val balance = response.body()?.balance ?: 0
                        balanceTextView.text = "Токенов: $balance"
                    }
                }
            } catch (e: Exception) {
                // Обработка ошибки
            }
        }
    }
    
    private fun onBuyTokensClick(tierId: String) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = ApiClient.api.createPayment(
                    CreatePaymentRequest(deviceId = deviceId, tierId = tierId)
                )
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body()?.success == true) {
                        val paymentUrl = response.body()?.paymentUrl
                        if (paymentUrl != null) {
                            // Открыть в браузере или WebView
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(paymentUrl))
                            startActivity(intent)
                        }
                    }
                }
            } catch (e: Exception) {
                // Обработка ошибки
            }
        }
    }
}
```

---

## 🧪 Тестирование

Для тестирования используйте:

```bash
# Проверка баланса
curl "https://backaibookver2-production.up.railway.app/api/payments/balance?deviceId=test-123"

# Получение тарифов
curl "https://backaibookver2-production.up.railway.app/api/payments/pricing"

# Создание платежа
curl -X POST "https://backaibookver2-production.up.railway.app/api/payments/create" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"test-123","tierId":"tier1"}'
```

