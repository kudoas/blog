import { defineConfig } from '@playwright/test';

const deployedURL = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: deployedURL ?? 'http://127.0.0.1:4321', trace: 'retain-on-failure', channel: process.env.CI ? undefined : 'chrome' },
  webServer: deployedURL ? undefined : {
    command: 'bun run preview --host 127.0.0.1',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: !process.env.CI,
  },
});
