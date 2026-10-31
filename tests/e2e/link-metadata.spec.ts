import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const metadata = JSON.parse(readFileSync('content/link-metadata.json', 'utf8')) as Record<string, { title: string; icon?: string }>;
const github = 'https://github.com/bvaughn/react-error-boundary';

test('renders inline and reference titles with external icons in both themes without overflow', async ({ page }, testInfo) => {
  await page.route('https://giscus.app/**', route => route.abort());
  const iconUrls = [...new Set(Object.values(metadata).flatMap(entry => entry.icon ? [entry.icon] : []))];
  const iconRequests: { url: string; referer: string | undefined }[] = [];
  // Keep browser checks independent of remote servers while checking the actual URLs and headers.
  for (const url of iconUrls) await page.route(url, async route => {
    iconRequests.push({ url: route.request().url(), referer: route.request().headers().referer });
    await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="8" fill="blue"/></svg>' });
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
      await expect(link.locator('img')).toHaveAttribute('src', metadata[github].icon!);
      await expect(link.locator('img')).toHaveAttribute('referrerpolicy', 'no-referrer');
      await link.scrollIntoViewIfNeeded();
      await expect.poll(() => link.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
      const inline = page.locator('.prose a[href$="#componentdidcatch"]');
      await expect(inline).toHaveText(metadata['https://ja.reactjs.org/docs/react-component.html'].title);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator('.prose h2').last().scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`link-titles-${width}-${theme}.png`) });
    }
  }
  expect(iconRequests.some(request => request.url === metadata[github].icon)).toBe(true);
  expect(iconRequests.every(request => request.referer === undefined)).toBe(true);
});

test('cached titles and the unavailable-page fallback work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/posts/func-error-boundary/');
  await expect(page.locator(`.prose a[href="${github}"]`).first()).toHaveText(metadata[github].title);
  await page.goto('/posts/async-nodejs/');
  const unavailable = page.locator('.prose a[href^="https://stackoverflow.com/"]');
  await expect(unavailable).toContainText(/\S/);
  await expect(unavailable.locator('img')).toHaveCount(0);
  await context.close();
});

test('hides failed external favicons while retaining the title and destination', async ({ page }) => {
  for (const url of new Set(Object.values(metadata).flatMap(entry => entry.icon ? [entry.icon] : []))) {
    await page.route(url, route => route.abort());
  }
  await page.goto('/posts/func-error-boundary/');
  const link = page.locator(`.prose a[href="${github}"]`).first();
  await link.scrollIntoViewIfNeeded();
  await expect(link.locator('img')).toBeHidden();
  await expect(link).toHaveText(metadata[github].title);
  await expect(link).toHaveAttribute('href', github);
});
