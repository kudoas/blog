import { expect, test } from '@playwright/test';

test('shows an optional article icon above the title in both themes and viewport sizes', async ({ page }, testInfo) => {
  await page.route('https://giscus.app/**', route => route.abort());
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto('/posts/func-error-boundary/');
      const icon = page.locator('.post-icon');
      const heading = page.getByRole('heading', { level: 1 });
      const meta = page.locator('.post-meta');
      await expect(icon).toHaveText('⚛️');
      await expect(icon).toHaveAttribute('aria-hidden', 'true');
      await expect(heading).toHaveText('Error BoundaryをFunction Componentで扱う');
      expect(await heading.getAttribute('data-pagefind-body')).not.toBeNull();
      const [i, h, m] = await Promise.all([icon.boundingBox(), heading.boundingBox(), meta.boundingBox()]);
      expect(i!.y + i!.height).toBeLessThanOrEqual(h!.y);
      expect(h!.y + h!.height).toBeLessThanOrEqual(m!.y);
      expect(i!.height).toBeGreaterThanOrEqual(96);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`post-icon-${width}-${colorScheme}.png`) });
    }
  }
});

test('omitted icons retain the existing header and icons also render without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('/posts/async-nodejs/');
    await expect(page.locator('.post-icon')).toHaveCount(0);
    await expect(page.locator('.post-header-with-icon')).toHaveCount(0);
    const [meta, title] = await Promise.all([page.locator('.post-meta').boundingBox(), page.locator('.post-header h1').boundingBox()]);
    expect(meta!.y + meta!.height).toBeLessThanOrEqual(title!.y);
    await page.goto('/posts/func-error-boundary/');
    await expect(page.locator('.post-icon')).toHaveText('⚛️');
  } finally { await context.close(); }
});
