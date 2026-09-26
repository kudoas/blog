import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as pagefind from 'pagefind';
import { posts, external } from '../fixtures/content';

const total = posts.length + external.length;

test('finds body text and external articles through the same search', async ({ page }, testInfo) => {
  const transfers: Promise<{ url: string; transferSize: number }>[] = [];
  page.on('requestfinished', (request) => {
    const url = new URL(request.url()).pathname;
    if (url.startsWith('/pagefind/')) transfers.push(request.sizes().then((size) => ({
      url, transferSize: size.responseBodySize + size.responseHeadersSize,
    })));
  });
  await page.goto('/');
  const search = page.getByRole('searchbox');
  await expect(search).toBeEnabled();
  await search.fill('Figma');
  await expect(page.getByRole('link', { name: 'ゆめみのインターンに参加した', exact: true })).toBeVisible();
  await expect(page.locator('.article-excerpt mark')).toContainText('Figma');
  const resources = await Promise.all(transfers);
  const metricsPath = testInfo.outputPath('first-search-transfer.json');
  await writeFile(metricsPath, JSON.stringify(resources, null, 2));
  await testInfo.attach('first-search-transfer.json', { path: metricsPath, contentType: 'application/json' });
  await page.screenshot({ path: testInfo.outputPath('desktop-search.png'), fullPage: true });
  await search.fill('クイックソート');
  await expect(page.getByRole('link', { name: 'Pythonでのソートアルゴリズムの実装', exact: true })).toBeVisible();
  await search.fill('Renovate');
  await expect(page.locator('.article-summary h3 a')).toHaveCount(1);
  await expect(page.locator('.article-summary h3 a')).toHaveAttribute('href', /zenn.dev/);
  await search.fill('zzzxxyy');
  await expect(page.getByText('条件に合う記事が見つかりませんでした。')).toBeVisible();
});

test('searches titles and tags, combines filters, clears and restores the URL', async ({ page }) => {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: '記事を検索' });
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

test('fits a mobile viewport and exposes keyboard focus', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '本文へスキップ' })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('searchbox').fill('Figma');
  await expect(page.locator('.article-excerpt mark')).toContainText('Figma');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('mobile-search.png'), fullPage: true });
  await page.goto('/posts/func-error-boundary/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('renders HTML-looking content in excerpts as text', async ({ page }, testInfo) => {
  const outputPath = testInfo.outputPath('index');
  try {
    const created = await pagefind.createIndex();
    expect(created.errors).toEqual([]);
    const result = await created.index!.addCustomRecord({
      url: '/posts/yumemi-intern/', language: 'ja',
      content: 'Figma <img src=x onerror="document.body.dataset.injected=1"> <script>document.body.dataset.injected=1</script>',
      meta: { title: 'ゆめみのインターンに参加した' },
    });
    expect(result.errors).toEqual([]);
    expect((await created.index!.writeFiles({ outputPath })).errors).toEqual([]);
  } finally {
    await pagefind.close();
  }
  await page.route('**/pagefind/**', async (route) => {
    const filename = new URL(route.request().url()).pathname.replace('/pagefind/', '');
    await route.fulfill({ body: await readFile(join(outputPath, filename)),
      contentType: filename.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
  });
  await page.goto('/?q=Figma');
  await expect(page.locator('.article-excerpt mark')).toContainText('Figma');
  await expect(page.locator('.article-excerpt')).toContainText('<img');
  await expect(page.locator('.article-excerpt img, .article-excerpt script')).toHaveCount(0);
  expect(await page.locator('body').getAttribute('data-injected')).toBeNull();
});

test('indexes exactly the published local and external articles', async ({ page }) => {
  await page.goto('/');
  const urls = await page.evaluate(async () => {
    const bundle = '/pagefind/pagefind.js';
    const pagefind = await import(/* @vite-ignore */ bundle);
    const found = await pagefind.search(null);
    const records = await Promise.all(found.results.map((item: { data(): Promise<{ url: string }> }) => item.data()));
    return records.map((item: { url: string }) => item.url).sort();
  });
  expect(urls).toEqual([...posts.map(({ id }) => `/posts/${id}/`), ...external.map(({ url }) => url)].sort());
});

test('falls back to title and tag search when the index cannot load', async ({ page }) => {
  await page.route('**/pagefind/**', (route) => route.abort());
  await page.goto('/?q=Renovate');
  await expect(page.getByRole('alert')).toContainText('タイトル・タグから検索しています');
  await expect(page.locator('.article-summary h3 a')).toHaveCount(1);
  await expect(page.locator('.article-summary h3 a')).toHaveAttribute('href', /zenn.dev/);
  await page.getByRole('searchbox').fill('ｒｅａｃｔ');
  await page.getByLabel('タグで絞り込む').selectOption('nodejs');
  await expect(page.getByText('条件に合う記事が見つかりませんでした。')).toBeVisible();
  await page.getByRole('button', { name: '条件をクリア' }).click();
  await expect(page.locator('.article-list > li')).toHaveCount(total);
});

test('does not search during composition or let a pending search replace cleared results', async ({ page }) => {
  let requested = false;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/pagefind/pagefind.js', async (route) => {
    requested = true;
    await pending;
    await route.continue();
  });
  await page.goto('/');
  const input = page.getByRole('searchbox');
  await expect(input).toBeEnabled();
  await input.dispatchEvent('compositionstart');
  await input.fill('Figma');
  // Longer than the debounce: composing must not even fetch the search bundle.
  await page.waitForTimeout(500);
  expect(requested).toBe(false);
  await input.dispatchEvent('compositionend');
  await expect.poll(() => requested).toBe(true);
  await expect(page.getByRole('status')).toHaveText('検索中…');
  await page.getByRole('button', { name: '条件をクリア' }).click();
  await expect(page.locator('.article-list > li')).toHaveCount(total);
  release();
  await input.fill('Renovate');
  await expect(page.locator('.article-summary h3 a')).toHaveCount(1);
  await expect(page.locator('.article-summary h3 a')).toContainText('Renovate');
  await expect(page).toHaveURL(/q=Renovate/);
});
