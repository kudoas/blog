import { expect, test } from '@playwright/test';
import { posts, external } from '../fixtures/content';

const total = posts.length + external.length;
const angular = external.filter(article => article.tags?.includes('Angular'));

test('explains local and external articles before opening them', async ({ page }, testInfo) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    const articles = page.locator('.article-summary');
    await expect(articles).toHaveCount(total);
    await expect(articles.locator('.article-description')).toHaveCount(total);
    const sorting = articles.filter({ has: page.getByRole('heading', { name: 'Pythonでのソートアルゴリズムの実装' }) });
    await expect(sorting.locator('.article-description')).toContainText('バブルソート・挿入ソート・選択ソート');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`article-discovery-${width}.png`) });
  }
  await page.getByRole('searchbox').fill('Figma');
  await expect(page.locator('[aria-busy="false"]')).toBeVisible();
  await expect(page.locator('.article-excerpt mark')).toContainText('Figma');
  await expect(page.locator('.article-summary .article-description')).toHaveCount(0);
});

test('finds external articles through tags and their descriptions', async ({ page }) => {
  await page.goto('/');
  const tags = page.getByLabel('タグで絞り込む');
  await expect(tags).toBeEnabled();
  await tags.selectOption('angular');
  await expect(page.locator('.article-summary')).toHaveCount(angular.length);
  const external = page.locator('.article-summary h2 a');
  for (const link of await external.all()) {
    expect(angular.map(article => article.url)).toContain(await link.getAttribute('href'));
    await expect(link).toHaveAttribute('target', '_blank');
  }
  await page.reload();
  await expect(tags).toHaveValue('angular');
  await page.getByRole('searchbox').fill('ViewChild');
  await expect(page.locator('[aria-busy="false"]')).toBeVisible();
  await expect(page.locator('.article-summary')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: '非同期処理後に動的に生成される DOM にアクセスする' })).toBeVisible();
  await page.goto('/tags/angular/');
  await expect(page.locator('.article-summary')).toHaveCount(angular.length);
  await expect(page.locator('.article-description')).toHaveCount(angular.length);
});

test('keeps descriptions and topic links available without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/tags/angular/');
  await expect(page.locator('.article-summary')).toHaveCount(angular.length);
  await expect(page.locator('.article-description')).toHaveCount(angular.length);
  await page.getByRole('link', { name: '#Bun', exact: true }).click();
  await expect(page.getByRole('heading', { name: '#Bun', exact: true })).toBeVisible();
  await expect(page.locator('.article-summary')).toHaveCount(2);
  await context.close();
});
