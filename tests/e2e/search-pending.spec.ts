import { expect, test } from '@playwright/test';
import { posts, external } from '../fixtures/content';

const total = posts.length + external.length;

test('keeps the initial list while the first search index is loading', async ({ page }, testInfo) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/pagefind/pagefind.js', async (route) => {
    await pending;
    await route.continue();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('searchbox')).toBeEnabled();
  const footerBefore = await page.locator('.site-footer').evaluate((node) => node.getBoundingClientRect().top + window.scrollY);
  await page.getByRole('searchbox').fill('React');
  await expect(page.getByRole('status')).toHaveText('検索中…');
  await expect(page.locator('[aria-busy="true"]')).toBeVisible();
  await expect(page.locator('.article-list > li')).toHaveCount(total);
  await expect(page.getByText('検索中は変更前の一覧を表示しています。')).toBeVisible();
  const footerDuring = await page.locator('.site-footer').evaluate((node) => node.getBoundingClientRect().top + window.scrollY);
  expect(footerDuring).toBeGreaterThanOrEqual(footerBefore);
  await page.screenshot({ path: testInfo.outputPath('mobile-search-pending.png') });
  release();
  await expect(page.locator('[aria-busy="false"]')).toBeVisible();
  await expect(page.locator('.article-list > li')).toHaveCount(3);
  await expect(page.getByText('検索中は変更前の一覧を表示しています。')).toHaveCount(0);
});

test('keeps settled results during composition and clears without showing stale results', async ({ page }) => {
  await page.goto('/?q=React');
  await expect(page.locator('[aria-busy="false"]')).toBeVisible();
  await expect(page.locator('.article-list > li')).toHaveCount(3);
  const linksBefore = await page.locator('.article-summary').getByRole('heading').getByRole('link').allTextContents();
  const search = page.getByRole('searchbox');
  await search.dispatchEvent('compositionstart');
  await search.fill('Figma');
  await expect(page.locator('[aria-busy="true"]')).toBeVisible();
  expect(await page.locator('.article-summary').getByRole('heading').getByRole('link').allTextContents()).toEqual(linksBefore);
  await page.getByRole('button', { name: '条件をクリア' }).click();
  await expect(page.locator('.article-list > li')).toHaveCount(total);
  await search.dispatchEvent('compositionend');
  await expect(page.locator('[aria-busy="false"]')).toBeVisible();
  await expect(page.locator('.article-list > li')).toHaveCount(total);
});

test('retains the last fallback results when a new search is composing', async ({ page }) => {
  await page.route('**/pagefind/**', (route) => route.abort());
  await page.goto('/?q=React');
  await expect(page.getByRole('alert')).toBeVisible();
  const fallbackLinks = await page.locator('.article-summary').getByRole('heading').getByRole('link').allTextContents();
  expect(fallbackLinks.length).toBeGreaterThan(0);
  const search = page.getByRole('searchbox');
  await search.dispatchEvent('compositionstart');
  await search.fill('Figma');
  await expect(page.locator('[aria-busy="true"]')).toBeVisible();
  expect(await page.locator('.article-summary').getByRole('heading').getByRole('link').allTextContents()).toEqual(fallbackLinks);
  await search.dispatchEvent('compositionend');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('.empty-state')).toHaveText('条件に合う記事が見つかりませんでした。');
});
