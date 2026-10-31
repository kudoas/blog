import { expect, test } from '@playwright/test';

test('returns from an article to the same search and tag conditions', async ({ page }) => {
  await page.goto('/?q=Error&tag=react');
  await expect(page.getByRole('searchbox')).toHaveValue('Error');
  await expect(page.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('link', { name: 'Error BoundaryをFunction Componentで扱う', exact: true }).click();
  await expect(page.locator('[data-article-return-link="top"]')).toHaveText('← 検索結果');
  await expect(page.locator('[data-article-return-link="end"]')).toHaveAttribute('href', '/?q=Error&tag=react');
  await page.locator('[data-article-return-link="top"]').click();
  await expect(page.getByRole('searchbox')).toHaveValue('Error');
  await expect(page.getByLabel('タグで絞り込む')).toHaveValue('react');
});

test('returns from an article to its tag or category listing', async ({ page }) => {
  for (const [path, label] of [['/tags/react/', 'タグ'], ['/categories/dev/', 'カテゴリ']]) {
    await page.goto(path);
    await page.getByRole('link', { name: 'Error BoundaryをFunction Componentで扱う', exact: true }).click();
    await expect(page.locator('[data-article-return-link="top"]')).toHaveText(`← ${label}の記事一覧`);
    await page.locator('[data-article-return-link="end"]').click();
    await expect(page).toHaveURL(url => url.pathname === path);
  }
});

test('uses a valid listing referrer when opening an article in a new tab', async ({ page, context }) => {
  await page.goto('/tags/react/');
  const opened = context.waitForEvent('page');
  await page.getByRole('link', { name: 'Error BoundaryをFunction Componentで扱う', exact: true }).click({ modifiers: ['ControlOrMeta'] });
  const article = await opened;
  await expect(article.locator('[data-article-return-link="top"]')).toHaveAttribute('href', '/tags/react/');
  await article.close();
});

test('uses the normal listing for direct visits and external referrers', async ({ page }) => {
  for (const referer of [undefined, 'https://example.com/?q=Figma']) {
    await page.goto('/posts/func-error-boundary/', { referer });
    await expect(page.locator('[data-article-return-link="top"]')).toHaveText('← 記事一覧');
    await expect(page.locator('[data-article-return-link="end"]')).toHaveAttribute('href', '/');
  }
});

test('keeps the normal listing links usable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/tags/react/');
  await page.getByRole('link', { name: 'Error BoundaryをFunction Componentで扱う', exact: true }).click();
  await expect(page.locator('[data-article-return-link="top"]')).toHaveAttribute('href', '/');
  await page.locator('[data-article-return-link="top"]').click();
  await expect(page.getByRole('heading', { name: '記事', exact: true })).toBeVisible();
  await context.close();
});
