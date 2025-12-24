import express from 'express';
import * as chatController from '../controllers/chatController.js';

const router = express.Router();

// Пользователи
router.post('/login', chatController.loginUser);

// Чаты
router.post('/create', chatController.createNewChat);
router.get('/list/:userId', chatController.getChats);
router.get('/history/:chatId', chatController.getHistory);

// Стриминг (основной чат)
router.post('/stream', chatController.chatStream);

export default router;
