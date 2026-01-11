
import dotenv from 'dotenv';
import { generateImageWithSiliconFlow } from './src/services/siliconFlowService.js';

dotenv.config();

const apiKey = 'sk-mzuoxyxewgzwbvrdzlbpsjgxjqxkchumiideptuisdjcynnd';
// Простой промпт для теста
const prompt = "A cute cat sitting on a windowsill, raining outside, cozy atmosphere, lo-fi style";
// const model = 'black-forest-labs/FLUX-1.1-pro';
// const model = 'black-forest-labs/FLUX.1-schnell'; 
const model = 'Tongyi-MAI/Z-Image-Turbo'; // Testing this one

async function test() {
    if (!apiKey) {
        console.error('❌ SILICONFLOW_API_KEY not found in .env');
        return;
    }

    console.log(`🚀 Starting SiliconFlow Image Generation Test`);
    console.log(`Model: ${model}`);
    console.log(`Prompt: "${prompt}"`);
    console.log('-------------------------------------------');

    const start = Date.now();
    try {
        // Z-Image supports 512x512
        const result = await generateImageWithSiliconFlow(apiKey, prompt, model, '512x512');
        const duration = (Date.now() - start) / 1000;

        console.log('-------------------------------------------');
        console.log(`✅ Success!`);
        console.log(`⏱️ Time taken: ${duration.toFixed(2)} seconds`);
        console.log(`🖼️ Image URL: ${result.imageUrl}`);
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

test();
