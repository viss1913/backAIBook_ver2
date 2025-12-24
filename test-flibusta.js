import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'http://localhost:3000/api/books';

async function testSearch(query, vipCode = '') {
    console.log(`\n--- Testing Search: "${query}" (VIP: ${!!vipCode}) ---`);
    try {
        const response = await axios.post(`${BASE_URL}/search`, {
            query,
            vipCode
        });
        console.log('Results Count:', response.data.books.length);
        if (response.data.books.length > 0) {
            const b = response.data.books[0];
            console.log('First result:', `${b.author} - ${b.title}`);
            console.log('PD Status:', b.publicDomain ? '✅ Public Domain' : '❌ Copyrighted');
        }
    } catch (error) {
        console.error('Search failed:', error.response?.data || error.message);
    }
}

async function runTests() {
    console.log('🚀 Starting Flibusta Integration Tests...');

    // 1. Test classic author (PD)
    await testSearch('Шекспир. Ромео и жельета');

    // 2. Test modern author (Not PD)
    await testSearch('Стивен Кинг ОНО');

    // 3. Test VIP access (should bypass or at least show as PD if logic allows)
    await testSearch('Стивен Кинг ОНО', process.env.VIP_SECRET_CODE || 'test_vip_code');

    console.log('\n✅ Tests completed!');
}

runTests();
