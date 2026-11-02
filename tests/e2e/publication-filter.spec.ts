import { expect, test, type Page } from '@playwright/test';
import { posts, external } from '../fixtures/content';

const contributed = [...posts.filter(post => post.data.publication === 'contribution').map(post => `/posts/${post.id}/`), ...external.filter(article => article.publication === 'contribution').map(article => article.url)];
const personal = [...posts.filter(post => post.data.publication !== 'contribution').map(post => `/posts/${post.id}/`), ...external.filter(article => article.publication !== 'contribution').map(article => article.url)];
async function expectURLs(page: Page, urls: string[]) {
  await expect.poll(() => page.locator('.article-summary h2 a').evaluateAll(links => links.map(link => link.getAttribute('href')).sort()))
    .toEqual([...urls].sort());
}

test('switches classifications, restores the URL and clears all conditions', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radio', { name: '寄稿記事', exact: true }).check();
  await expectURLs(page, contributed);
  await expect(page).toHaveURL(/publication=contribution/);
  await page.reload();
  await expect(page.getByRole('radio', { name: '寄稿記事', exact: true })).toBeChecked();
  await expectURLs(page, contributed);
  await page.getByRole('radio', { name: '個人記事', exact: true }).check();
  await expectURLs(page, personal);
  await page.getByRole('button', { name: '条件をクリア' }).click();
  await expectURLs(page, [...personal, ...contributed]);
  await expect(page.getByRole('radio', { name: 'すべて', exact: true })).toBeChecked();
  await expect(page.getByRole('searchbox', { name: '記事を検索', exact: true })).toBeFocused();
  await expect(page).toHaveURL(url => !url.search);
});

test('combines full-text and tags and retains conditions in the search dialog', async ({ page }) => {
  await page.goto('/?q=Renovate&tag=github-actions&publication=contribution');
  await expectURLs(page, ['https://tech.classi.jp/entry/2023/10/04/180000']);
  await page.getByRole('radio', { name: '個人記事', exact: true }).check();
  await expectURLs(page, ['https://zenn.dev/da1chi/articles/939f27321ba016']);
  await page.getByRole('link', { name: '検索を開く' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('searchbox')).toHaveValue('Renovate');
  await dialog.getByRole('button', { name: '検索する' }).click();
  await expect(page).toHaveURL(url => url.searchParams.get('q') === 'Renovate' && url.searchParams.get('tag') === 'github-actions' && url.searchParams.get('publication') === 'personal');
  await expectURLs(page, ['https://zenn.dev/da1chi/articles/939f27321ba016']);
});

test('retains classification when returning from an article and traversing history', async ({ page }) => {
  await page.route('https://giscus.app/**', route => route.abort());
  await page.goto('/?q=Error&tag=react&publication=personal');
  await page.getByRole('link', { name: 'Error BoundaryをFunction Componentで扱う', exact: true }).click();
  await expect(page.locator('[data-article-return-link="top"]')).toHaveAttribute('href', '/?q=Error&tag=react&publication=personal');
  await page.getByRole('link', { name: '検索を開く' }).click();
  await expect(page.getByRole('dialog').getByRole('searchbox')).toHaveValue('Error');
  await page.keyboard.press('Escape');
  await page.locator('[data-article-return-link="top"]').click();
  await expect(page.getByRole('radio', { name: '個人記事', exact: true })).toBeChecked();
  await expect(page.getByLabel('タグで絞り込む')).toHaveValue('react');
  await page.goBack();
  await expect(page.locator('[data-article-return-link="top"]')).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('radio', { name: '個人記事', exact: true })).toBeChecked();
  await expect(page.getByRole('searchbox', { name: '記事を検索', exact: true })).toHaveValue('Error');
});

test('keeps classification on search failure and normalizes unknown filters', async ({ page }) => {
  await page.route('**/pagefind/**', route => route.abort());
  await page.goto('/?q=Renovate&publication=contribution');
  await expect(page.getByRole('alert')).toBeVisible();
  await expectURLs(page, ['https://tech.classi.jp/entry/2023/10/04/180000']);
  await page.getByRole('radio', { name: '個人記事', exact: true }).check();
  await expectURLs(page, ['https://zenn.dev/da1chi/articles/939f27321ba016']);
  await page.goto('/?publication=unknown');
  await expect(page.getByRole('radio', { name: 'すべて', exact: true })).toBeChecked();
  await expectURLs(page, [...personal, ...contributed]);
});
