import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  use: { baseURL: 'http://127.0.0.1:4189', headless: true },
  webServer: {
    command: 'npm run build && npm run serve',
    url: 'http://127.0.0.1:4189',
    env: { PORT: '4189', GEMINI_API_KEY: '', OPENAI_API_KEY: '' },
    reuseExistingServer: false,
  },
});
