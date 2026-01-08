import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import imageRoutes from './routes/image.js';
import bookRoutes from './routes/bookRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import { initDatabase } from './utils/database.js';
import fs from 'fs';
import path from 'path';

// Загрузка переменных окружения
dotenv.config();

process.on('uncaughtException', (err) => {
  console.error('CRITICAL UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

const app = express();
const PORT = process.env.PORT || 3000;

// Убедимся что папка для скачивания существует
const downloadsDir = path.resolve('src/downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// Middleware
app.use(cors({
  origin: '*', // Разрешаем все источники для Android приложения
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Логирование запросов (для дебага)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoints
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'AI Book Reader Backend is running',
    version: '1.0.0'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api', imageRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/payments', paymentRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server is running on port ${PORT}`);

  // Инициализация БД
  try {
    await initDatabase();
  } catch (err) {
    console.error('Failed to initialize database:', err);
  }
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  if (!process.env.PERPLEXITY_API_KEY) {
    console.warn('⚠️  WARNING: PERPLEXITY_API_KEY is not set!');
  }

  if (!process.env.LAOZHANG_API_KEY && !process.env.LAOZHAN_API_KEY) {
    console.warn('⚠️  WARNING: LAOZHANG_API_KEY or LAOZHAN_API_KEY is not set!');
  }

  if (!process.env.GETIMG_API_KEY) {
    console.warn('⚠️  WARNING: GETIMG_API_KEY is not set!');
  }

  if (!process.env.GEN_API_KEY) {
    console.warn('⚠️  WARNING: GEN_API_KEY is not set!');
  }
});

