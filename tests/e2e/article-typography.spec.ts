import { expect, test } from '@playwright/test';
import { posts } from '../fixtures/content';

test('keeps articles readable in narrow and wide viewports with both themes', async ({ page }, testInfo) => {
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme });
      for (const { id } of posts) {
        await page.goto(`/posts/${id}/`);
        await expect(page.locator('.prose')).toHaveCSS('font-size', width <= 600 ? '16px' : '17px');
        const prose = (await page.locator('.prose').boundingBox())!;
        expect(prose.width).toBeLessThanOrEqual(width <= 600 ? 326 : 756);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      await page.goto('/posts/func-error-boundary/');
      await page.locator('.prose pre').first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`article-typography-${width}-${theme}.png`) });
      const code = page.locator('.prose pre').first();
      await code.focus();
      await expect(code).toBeFocused();
      if (width <= 600) {
        expect(await code.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
        await code.evaluate(node => { node.scrollLeft = node.scrollWidth; });
        expect(await code.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
      }
    }
  }
});
