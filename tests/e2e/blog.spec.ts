import { expect, test } from '@playwright/test';
import { posts, external } from '../fixtures/content';

const total = posts.length + external.length;

test('searches titles and tags, combines filters, clears and restores the URL', async ({ page }) => {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'タイトル・タグで検索' });
  await expect(search).toBeEnabled();
  await expect(page.locator('.article-list > li')).toHaveCount(total);
  await search.fill('ｒｅａｃｔ');
  await expect(page.getByRole('link', { name: 'Error BoundaryをFunction Componentで扱う', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pythonでのソートアルゴリズムの実装', exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/q=/);
  await page.reload();
  await expect(search).toHaveValue('ｒｅａｃｔ');
  await expect(page.getByRole('link', { name: 'Error BoundaryをFunction Componentで扱う', exact: true })).toBeVisible();
  await page.getByLabel('タグで絞り込む').selectOption('nodejs');
  await expect(page.getByText('条件に合う記事が見つかりませんでした。')).toBeVisible();
  await page.getByRole('button', { name: '条件をクリア' }).click();
  await expect(page.locator('.article-list > li')).toHaveCount(total);
  await expect(page).toHaveURL(/\/$/);
});

test('keeps article links and the body readable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('.article-list > li')).toHaveCount(total);
  await page.getByRole('link', { name: 'Error BoundaryをFunction Componentで扱う', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Error BoundaryをFunction Componentで扱う');
  await expect(page.locator('.prose pre').first()).toBeVisible();
  await context.close();
});

test('fits a mobile viewport and exposes keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '本文へスキップ' })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/posts/func-error-boundary/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
