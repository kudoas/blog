import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://giscus.app/**', route => route.abort());
});

test('desktop contents starts beside the body and stays reachable while reading', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/posts/func-error-boundary/');
  const toc = page.locator('.toc');
  const prose = page.locator('.prose');
  const body = (await prose.boundingBox())!;
  const contents = (await toc.boundingBox())!;
  const header = (await page.locator('.post-header').boundingBox())!;
  // The sidebar belongs beside article content, below the article header.
  expect(contents.x).toBeGreaterThanOrEqual(body.x + body.width);
  expect(contents.y).toBeGreaterThanOrEqual(header.y + header.height);
  await page.screenshot({ path: testInfo.outputPath('article-body-toc-start.png') });
  await page.evaluate(() => window.scrollTo(0, 1200));
  await expect(toc).toBeInViewport({ ratio: 1 });
  await page.evaluate(() => window.scrollTo(0, 2200));
  await expect(toc).toBeInViewport({ ratio: 1 });
  await toc.getByRole('link').last().click();
  await expect(page).toHaveURL(/#/);
  await page.screenshot({ path: testInfo.outputPath('wide-sticky-toc.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  for (const [width, height] of [[1280, 1000], [1440, 400], [390, 1000]]) {
    await page.setViewportSize({ width, height });
    await expect(toc).toHaveCSS('position', 'static');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('long desktop tables of contents can scroll and every link remains reachable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1320, height: 500 });
  await page.goto('/posts/first-summer-intern/');
  const toc = page.locator('.toc');
  await expect(toc).toHaveAttribute('open');
  await expect(toc).toHaveCSS('position', 'sticky');
  expect(await toc.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  const link = toc.getByRole('link').last();
  await link.focus();
  await expect(link).toBeFocused();
  await expect(link).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('long-scrollable-toc.png') });
});

test('the same table of contents works without JavaScript and on mobile', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/posts/first-summer-intern/');
  const toc = page.locator('.toc');
  await expect(toc).not.toHaveAttribute('open');
  await toc.getByText('目次', { exact: true }).click();
  await expect(toc).toHaveAttribute('open');
  await toc.getByRole('link').first().click();
  await expect(page).toHaveURL(/#/);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(toc).toHaveCSS('position', 'sticky');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
});

test('wide no-JavaScript visits retain the native disclosure and all anchors', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto('/posts/first-summer-intern/');
  const toc = page.locator('.toc');
  await expect(toc).not.toHaveAttribute('open');
  await toc.locator('summary').click();
  await expect(toc).toHaveAttribute('open');
  await expect(toc.getByRole('link')).toHaveCount(20);
  await toc.getByRole('link').last().click();
  await expect(page).toHaveURL(/#/);
  await context.close();
});
