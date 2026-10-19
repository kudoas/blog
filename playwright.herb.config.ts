import { defineConfig } from '@playwright/test';

const deployedURL = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: deployedURL ?? 'http://127.0.0.1:3000', trace: 'retain-on-failure', channel: process.env.CI ? undefined : 'chrome' },
  webServer: deployedURL ? undefined : {
    command: 'cd experiments/herb && mise exec ruby@4.0.6 -- bundle exec rails server -p 3000',
    url: 'http://127.0.0.1:3000/up',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
