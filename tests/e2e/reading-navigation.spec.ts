import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://giscus.app/**', route => route.abort());
});

test('keeps the 756px body centered and follows scrolling only on wide, tall screens', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/posts/func-error-boundary/');
  const toc = page.locator('.toc');
  const prose = page.locator('.prose');
  const paragraphWidth = (await prose.boundingBox())!.width;
  const paragraphX = (await prose.boundingBox())!.x;
  expect(paragraphWidth).toBe(756);
  expect(paragraphX).toBe(342);
  await expect(toc).toHaveCSS('position', 'sticky');
  expect((await toc.boundingBox())!.x).toBeGreaterThan((await prose.boundingBox())!.x + paragraphWidth);
  await page.evaluate(() => window.scrollTo(0, 1200));
  await expect.poll(async () => (await toc.boundingBox())!.y).toBe(24);
  await toc.getByRole('link').last().click();
  await expect(page).toHaveURL(/#/);
  await page.screenshot({ path: testInfo.outputPath('wide-sticky-toc.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  for (const [width, height] of [[1280, 1000], [1440, 400], [390, 1000]]) {
    await page.setViewportSize({ width, height });
    await expect(toc).toHaveCSS('position', 'static');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await prose.boundingBox())!.width).toBeLessThanOrEqual(width <= 600 ? 326 : 756);
  }
});

test('long desktop tables of contents can scroll and every link remains reachable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1320, height: 500 });
  await page.goto('/posts/first-summer-intern/');
  const toc = page.locator('.toc');
  await expect(toc).toHaveAttribute('open');
  await expect(toc).toHaveCSS('position', 'sticky');
  expect((await toc.boundingBox())!.height).toBeLessThanOrEqual(452);
  const link = toc.getByRole('link').last();
  await link.focus();
  await expect(link).toBeFocused();
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

test('switches layout at the width and height boundaries without changing body width', async ({ page }) => {
  await page.goto('/posts/func-error-boundary/');
  for (const [width, height, position] of [[1319, 1000, 'static'], [1320, 1000, 'sticky'], [1440, 479, 'static'], [1440, 480, 'sticky']] as const) {
    await page.setViewportSize({ width, height });
    await expect(page.locator('.toc')).toHaveCSS('position', position);
    expect((await page.locator('.prose').boundingBox())!.width).toBe(756);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
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
  expect((await page.locator('.prose').boundingBox())!.width).toBe(756);
  await context.close();
});

test('preserves existing prose spacing and muted contents links regardless of stylesheet order', async ({ page }) => {
  await page.goto('/posts/func-error-boundary/');
  const styles = await page.evaluate(() => {
    const heading = getComputedStyle(document.querySelectorAll('.prose h2')[1]);
    const paragraph = getComputedStyle(document.querySelector('.prose p')!);
    return {
      headingMargin: parseFloat(heading.marginBlockStart), headingFont: parseFloat(heading.fontSize),
      paragraphMargin: parseFloat(paragraph.marginBlockStart), paragraphFont: parseFloat(paragraph.fontSize),
      tocLink: getComputedStyle(document.querySelector('.toc a')!).color,
      tocSummary: getComputedStyle(document.querySelector('.toc summary')!).color,
    };
  });
  expect(styles.headingMargin).toBeCloseTo(styles.headingFont * 2.8, 1);
  expect(styles.paragraphMargin).toBeCloseTo(styles.paragraphFont * 1.5, 1);
  expect(styles.tocLink).toBe(styles.tocSummary);
});
