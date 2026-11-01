import { defineConfig } from '@playwright/test';

const deployedURL = process.env.E2E_BASE_URL;
const browserName = process.env.E2E_BROWSER === 'firefox' ? 'firefox' : 'chromium';

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: deployedURL ?? 'http://127.0.0.1:4321', trace: 'retain-on-failure', browserName, channel: browserName === 'chromium' && !process.env.CI ? 'chrome' : undefined },
  webServer: deployedURL ? undefined : {
    command: 'bun run preview --host 127.0.0.1 --ignore-lock',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: !process.env.CI,
  },
});
