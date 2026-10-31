import { expect, test } from '@playwright/test';

const article = '/posts/func-error-boundary/';

test('opens article search, restores focus on close and uses the existing result page', async ({ page }) => {
  await page.route('https://giscus.app/**', (route) => route.abort());
  await page.goto(article);
  const entry = page.getByRole('link', { name: '検索を開く' });
  await entry.click();
  const dialog = page.getByRole('dialog', { name: '記事を検索' });
  const query = dialog.getByRole('searchbox', { name: '検索キーワード' });
  await expect(query).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(entry).toBeFocused();
  await entry.click();
  await query.fill('Figma');
  await dialog.getByRole('button', { name: '検索する' }).click();
  await expect(page).toHaveURL(/\/\?q=Figma#article-search$/);
  await expect(page.getByRole('searchbox', { name: '記事を検索' })).toBeFocused();
  await expect(page.getByRole('link', { name: 'ゆめみのインターンに参加した', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'ゆめみのインターンに参加した', exact: true }).click();
  await expect(page.locator('[data-article-return-link="top"]')).toHaveAttribute('href', '/?q=Figma');
});

test('keyboard shortcut works halfway through an article and preserves reading position', async ({ page }) => {
  await page.route('https://giscus.app/**', (route) => route.abort());
  await page.goto(article);
  const target = page.locator('.prose h2').last();
  await target.scrollIntoViewIfNeeded();
  await target.evaluate((element) => { element.setAttribute('tabindex', '-1'); (element as HTMLElement).focus(); });
  const before = await page.evaluate(() => scrollY);
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '検索を閉じる' }).click();
  await expect(target).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBe(before);
});

test('does not intercept the shortcut while typing and fits a mobile viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/');
  await page.getByRole('searchbox', { name: '記事を検索' }).focus();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('link', { name: '検索を開く' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('mobile-search-entry.png') });
});

test('the search entry remains a usable listing link without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(article);
  await page.getByRole('link', { name: '検索を開く' }).click();
  await expect(page).toHaveURL(/\/#article-search$/);
  await expect(page.getByRole('searchbox', { name: '記事を検索' })).toBeDisabled();
  await expect(page.locator('.article-list > li')).toHaveCount(22);
  await context.close();
});
