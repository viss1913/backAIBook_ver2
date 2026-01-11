
import axios from 'axios';

const API_URL = 'https://api.siliconflow.com/v1/images/generations';

/**
 * Generates an image using SiliconFlow API
 * @param {string} apiKey 
 * @param {string} prompt 
 * @param {string} model - e.g. 'black-forest-labs/FLUX-1.1-pro'
 * @param {string} size - e.g. '512x512'
 */
export async function generateImageWithSiliconFlow(apiKey, prompt, model = 'black-forest-labs/FLUX-1.1-pro', size = '512x512') {
    if (!apiKey) throw new Error('SiliconFlow API Key is missing');

    console.log(`[SiliconFlow] Generating image... Model: ${model}, Size: ${size}`);

    try {
        const response = await axios.post(API_URL, {
            model: model,
            prompt: prompt,
            image_size: size,
            // seed: Math.floor(Math.random() * 9999999999) // Optional for random variation
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey.trim()}`,
                'Content-Type': 'application/json'
            },
            timeout: 120000 // 2 minutes timeout (Pro models can be slow)
        });

        const imageUrl = response.data?.images?.[0]?.url;

        if (!imageUrl) {
            console.error('[SiliconFlow] Response:', JSON.stringify(response.data));
            throw new Error('No image URL in SiliconFlow response');
        }

        return {
            imageUrl: imageUrl,
            promptUsed: prompt,
            model: model
        };

    } catch (error) {
        if (error.response) {
            console.error('[SiliconFlow] API Error:', error.response.status, error.response.data);
            throw new Error(`SiliconFlow API Error: ${JSON.stringify(error.response.data)}`);
        }
        throw error;
    }
}
