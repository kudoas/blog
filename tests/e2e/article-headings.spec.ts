import { expect, test } from '@playwright/test';

test('article headings expose a continuous hierarchy at mobile and desktop sizes', async ({ page }, testInfo) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ['/', '/tags/react/', '/categories/dev/']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      const articles = page.locator('.article-summary');
      expect(await articles.count()).toBeGreaterThan(0);
      await expect(articles.getByRole('heading', { level: 2 })).toHaveCount(await articles.count());
      await expect(page.getByRole('heading', { level: 3 })).toHaveCount(0);
      expect(await articles.getByRole('heading', { level: 2 }).first().evaluate((heading) => getComputedStyle(heading).fontSize)).toBe(width === 390 ? '16px' : '17px');
    }
    await page.screenshot({ path: testInfo.outputPath(`article-headings-${width}.png`) });
  }
});
