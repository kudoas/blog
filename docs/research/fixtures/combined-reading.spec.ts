import { expect, test } from '@playwright/test';

test('copy, search, related articles and sticky contents work together', async ({ page }, testInfo) => {
  await page.route('https://giscus.app/**', route => route.abort());
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => {
      (window as Window & { copiedText?: string }).copiedText = text;
    } } });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/posts/func-error-boundary/');
  await expect(page.locator('.toc')).toHaveCSS('position', 'sticky');
  expect((await page.locator('.prose').boundingBox())!.width).toBe(756);
  const copy = page.getByRole('button', { name: 'コードをコピー', exact: true }).first();
  await copy.click();
  expect(await page.evaluate(() => (window as Window & { copiedText?: string }).copiedText)).toBe(await page.locator('.prose pre code').first().textContent());
  const y = await page.evaluate(() => scrollY);
  await page.keyboard.press('Meta+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(copy).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBe(y);
  const related = page.getByRole('region', { name: '関連記事', exact: true });
  await related.scrollIntoViewIfNeeded();
  await expect(related.getByRole('link').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('combined-desktop.png') });
  for (const theme of ['light', 'dark'] as const) {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.getByRole('radio', { name: theme === 'light' ? 'ライト' : 'ダーク', exact: true }).click();
    await copy.scrollIntoViewIfNeeded();
    await copy.click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('.toc')).toHaveCSS('position', 'static');
    await page.screenshot({ path: testInfo.outputPath(`combined-mobile-${theme}.png`) });
  }
});
