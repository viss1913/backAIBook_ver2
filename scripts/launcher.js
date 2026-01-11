
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const env = {
    ...process.env,
    GEN_API_KEY: process.env.GEN_API_KEY,
    PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY
};

console.log('🚀 Launcher: Starting pipeline with keys injected...');

const child = spawn('node', ['scripts/rewrite_full_zoomer_perplexity.js'], {
    env,
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
});

child.on('close', (code) => {
    console.log(`Launcher: Process exited with code ${code}`);
});
