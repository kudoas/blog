import { expect, test } from '@playwright/test';
import { posts, external } from '../fixtures/content';

const total = posts.length + external.length;

for (const params of ['q=React', 'tag=react', 'q=React&tag=react']) {
  test(`returns keyboard focus to search after clearing ${params}`, async ({ page }) => {
    await page.goto(`/?${params}`);
    const search = page.getByRole('searchbox', { name: '記事を検索' });
    await expect(search).toBeEnabled();
    await expect(page.locator('[aria-busy="false"]')).toBeVisible();
    const clear = page.getByRole('button', { name: '条件をクリア' });
    await clear.focus();
    await page.keyboard.press('Enter');
    await expect(search).toBeFocused();
    await expect(search).toHaveValue('');
    await expect(page.getByLabel('タグで絞り込む')).toHaveValue('');
    await expect(clear).toHaveCount(0);
    await expect(page.locator('.article-list > li')).toHaveCount(total);
    await page.keyboard.type('Figma');
    await expect(search).toHaveValue('Figma');
    await expect(page.locator('.article-excerpt mark')).toContainText('Figma');
  });
}

test('keeps focus and cleared results when a pending search completes', async ({ page }) => {
  let requested = false;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/pagefind/pagefind.js', async (route) => {
    requested = true;
    await pending;
    await route.continue();
  });
  await page.goto('/');
  const search = page.getByRole('searchbox');
  await expect(search).toBeEnabled();
  await search.fill('Figma');
  await expect(page.locator('[aria-busy="true"]')).toBeAttached();
  await expect.poll(() => requested).toBe(true);
  const clear = page.getByRole('button', { name: '条件をクリア' });
  await clear.focus();
  await page.keyboard.press('Space');
  await expect(search).toBeFocused();
  await expect(page.locator('.article-list > li')).toHaveCount(total);
  release();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[aria-busy="false"]')).toBeVisible();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');
  await expect(page.locator('.article-list > li')).toHaveCount(total);
});
