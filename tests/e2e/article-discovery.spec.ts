import { expect, test } from '@playwright/test';

test('explains local and external articles before opening them', async ({ page }, testInfo) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    const articles = page.locator('.article-summary');
    await expect(articles).toHaveCount(22);
    await expect(articles.locator('.article-description')).toHaveCount(22);
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
  await expect(page.locator('.article-summary')).toHaveCount(7);
  const external = page.locator('.article-summary h2 a');
  for (const link of await external.all()) {
    await expect(link).toHaveAttribute('href', /^https:\/\/zenn\.dev\//);
    await expect(link).toHaveAttribute('target', '_blank');
  }
  await page.reload();
  await expect(tags).toHaveValue('angular');
  await page.getByRole('searchbox').fill('ViewChild');
  await expect(page.locator('[aria-busy="false"]')).toBeVisible();
  await expect(page.locator('.article-summary')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: '非同期処理後に動的に生成される DOM にアクセスする' })).toBeVisible();
  await page.goto('/tags/angular/');
  await expect(page.locator('.article-summary')).toHaveCount(7);
  await expect(page.locator('.article-description')).toHaveCount(7);
});

test('keeps descriptions and topic links available without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/tags/angular/');
  await expect(page.locator('.article-summary')).toHaveCount(7);
  await expect(page.locator('.article-description')).toHaveCount(7);
  await page.getByRole('link', { name: '#Bun', exact: true }).click();
  await expect(page.getByRole('heading', { name: '#Bun', exact: true })).toBeVisible();
  await expect(page.locator('.article-summary')).toHaveCount(2);
  await context.close();
});
