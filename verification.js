import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'http://localhost:3000/api';

async function testEndpoints() {
    console.log('=== Testing New Endpoints ===');

    try {
        // 1. Тест анализа контента
        console.log('\n1. Testing /analyze-content...');
        const analysisResponse = await axios.post(`${BASE_URL}/analyze-content`, {
            textChunk: "Гарри стоял перед зеркалом Еиналеж. В его глубине он видел не только себя, но и своих родителей. Его отец улыбался, а мать плакала от счастья. Это был самый важный момент его жизни в Хогвартсе."
        });
        console.log('Analysis Result:', JSON.stringify(analysisResponse.data, null, 2));

        // 2. Тест генерации обложки (может не сработать без реальных ключей)
        console.log('\n2. Testing /generate-cover...');
        try {
            const coverResponse = await axios.post(`${BASE_URL}/generate-cover`, {
                bookTitle: "Гарри Поттер и Философский камень",
                author: "Дж. К. Роулинг"
            });
            console.log('Cover Result:', coverResponse.data);
        } catch (err) {
            console.log('Cover generation failed (likely due to missing DB or API keys):', err.message);
        }

    } catch (error) {
        console.error('Test failed:', error.response?.data || error.message);
    }
}

// Запускать только если сервер запущен
// testEndpoints();

console.log('Verification script created. To run tests, start the server and call testEndpoints().');
console.log('NOTE: Ensure MySQL environment variables are set for database tests.');
