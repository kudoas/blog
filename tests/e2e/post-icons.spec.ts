import { expect, test } from '@playwright/test';
import { posts, external } from '../fixtures/content';

const iconCount = posts.filter(post => post.data.icon).length + external.filter(article => article.icon).length;

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

test('article and listing icons render without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('/');
    const local = page.locator('.article-summary h2 a[href="/posts/func-error-boundary/"]');
    await expect(local.locator('.article-icon')).toHaveText('⚛️');
    await expect(page.locator('.article-icon')).toHaveCount(iconCount);
    await page.goto('/posts/func-error-boundary/');
    await expect(page.locator('.post-icon')).toHaveText('⚛️');
  } finally { await context.close(); }
});


test('listing icons survive hydration, search and taxonomy filtering without changing link names', async ({ page }, testInfo) => {
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto('/');
      await expect(page.locator('.article-icon')).toHaveCount(iconCount);
      const external = page.getByRole('link', { name: /Angular v21 CDK Overlay/ });
      await expect(external.locator('.article-icon')).toHaveText('🪐');
      await expect(external.locator('.article-icon')).toHaveAttribute('aria-hidden', 'true');
      await page.screenshot({ path: testInfo.outputPath(`listing-icons-${width}-${colorScheme}.png`) });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
  await page.goto('/?q=Error%20Boundary');
  const local = page.getByRole('link', { name: 'Error BoundaryをFunction Componentで扱う', exact: true });
  await expect(local).toBeVisible();
  await expect(local.locator('.article-icon')).toHaveText('⚛️');
  await page.goto('/tags/react/');
  await expect(page.locator('.article-summary h2 a[href="/posts/func-error-boundary/"] .article-icon')).toHaveText('⚛️');
  await page.goto('/categories/dev/');
  await expect(page.locator('.article-icon')).toHaveCount(iconCount);
});
