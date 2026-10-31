import { expect, test } from '@playwright/test';

const longPost = '/posts/first-summer-intern/';
const shortPost = '/posts/func-error-boundary/';

test('mobile long contents starts closed and remains operable by keyboard', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(longPost);
  const toc = page.locator('.toc');
  const summary = toc.locator('summary');
  await expect(toc).not.toHaveAttribute('open');
  await expect(page.locator('.prose')).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('mobile-long-toc.png') });

  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(toc).toHaveAttribute('open');
  const links = toc.locator('nav a');
  await expect(links).toHaveCount(20);
  const target = await links.first().getAttribute('href');
  await page.keyboard.press('Tab');
  await expect(links.first()).toBeFocused();
  await page.keyboard.press('Enter');
  expect(decodeURIComponent(new URL(page.url()).hash)).toBe(decodeURIComponent(target!));
  const heading = page.locator(`[id="${decodeURIComponent(target!.slice(1))}"]`);
  await expect(heading).toBeInViewport();

  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(toc).not.toHaveAttribute('open');
  await page.setViewportSize({ width: 1280, height: 844 });
  await expect(toc).not.toHaveAttribute('open');
});

test('short contents stays expanded on mobile and long contents on desktop', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(shortPost);
  await expect(page.locator('.toc')).toHaveAttribute('open');
  await expect(page.locator('.toc nav a')).toHaveCount(4);

  await page.setViewportSize({ width: 1280, height: 844 });
  await page.goto(longPost);
  await expect(page.locator('.toc')).toHaveAttribute('open');
  await expect(page.locator('.toc nav a')).toHaveCount(20);
  await page.screenshot({ path: testInfo.outputPath('desktop-long-toc.png') });
});

test('all contents links remain available without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(longPost);
  const toc = page.locator('.toc');
  await expect(toc).not.toHaveAttribute('open');
  await toc.locator('summary').click();
  await expect(toc).toHaveAttribute('open');
  await expect(toc.locator('nav a')).toHaveCount(20);
  const link = toc.locator('nav a').last();
  const target = await link.getAttribute('href');
  await link.click();
  expect(decodeURIComponent(new URL(page.url()).hash)).toBe(decodeURIComponent(target!));
  await expect(page.locator(`[id="${decodeURIComponent(target!.slice(1))}"]`)).toBeInViewport();
  await context.close();
});
