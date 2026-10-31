import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const metadata = JSON.parse(readFileSync('content/link-metadata.json', 'utf8')) as Record<string, { title: string; icon?: string }>;
const github = 'https://github.com/bvaughn/react-error-boundary';

test('renders inline and reference titles with local icons in both themes without overflow', async ({ page }, testInfo) => {
  await page.route('https://giscus.app/**', route => route.abort());
  const externalIconRequests: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (/favicon|link-icons/.test(url.pathname) && url.hostname !== '127.0.0.1') externalIconRequests.push(request.url());
  });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto('/posts/func-error-boundary/');
      const link = page.locator(`.prose a[href="${github}"]`).first();
      await expect(link).toHaveText(metadata[github].title);
      await expect(link).toHaveAttribute('href', github);
      await expect(link.locator('img')).toHaveAttribute('alt', '');
      await link.scrollIntoViewIfNeeded();
      await expect.poll(() => link.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
      const inline = page.locator('.prose a[href$="#componentdidcatch"]');
      await expect(inline).toHaveText(metadata['https://ja.reactjs.org/docs/react-component.html'].title);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator('.prose h2').last().scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`link-titles-${width}-${theme}.png`) });
    }
  }
  expect(externalIconRequests).toEqual([]);
});

test('cached titles and the unavailable-page fallback work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/posts/func-error-boundary/');
  await expect(page.locator(`.prose a[href="${github}"]`).first()).toHaveText(metadata[github].title);
  await page.goto('/posts/async-nodejs/');
  const unavailable = page.locator('.prose a[href^="https://stackoverflow.com/"]');
  await expect(unavailable).toContainText(/\S/);
  await expect(unavailable.locator('img')).toHaveAttribute('src', '/link-icons/default.svg');
  await context.close();
});
