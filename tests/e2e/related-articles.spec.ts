import { expect, test } from '@playwright/test';

test('related topics render without JavaScript, omit self and identify external destinations', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/posts/func-error-boundary/');
  const related = page.getByRole('region', { name: '関連記事' });
  await expect(related).toBeVisible();
  const links = related.getByRole('link');
  expect(await links.count()).toBeGreaterThan(0);
  expect(await links.count()).toBeLessThanOrEqual(3);
  const urls = await links.evaluateAll((items) => items.map((a) => (a as HTMLAnchorElement).href));
  expect(urls).not.toContain(page.url());
  expect(new Set(urls).size).toBe(urls.length);
  await page.goto('/posts/github-repository-migration/');
  const outside = page.getByRole('region', { name: '関連記事' }).locator('a[target="_blank"]');
  await expect(outside).toHaveCount(1);
  for (const external of await outside.all()) {
    await expect(external).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(external).toHaveAccessibleName(/外部サイトを新しいタブで開く/);
  }
  await page.goto('/posts/sort/');
  await expect(page.getByRole('region', { name: '関連記事' })).toHaveCount(0);
  await context.close();
});

test('related links fit mobile in both themes and can be followed', async ({ page }, testInfo) => {
  await page.route('https://giscus.app/**', (route) => route.abort());
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/posts/func-error-boundary/');
  const related = page.getByRole('region', { name: '関連記事' });
  await related.scrollIntoViewIfNeeded();
  for (const theme of ['ライト', 'ダーク']) {
    await page.getByRole('radio', { name: theme, exact: true }).click();
    await related.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`related-${theme}.png`) });
  }
  const local = related.locator('a[href^="/posts/"]').first();
  if (await local.count()) {
    const destination = await local.getAttribute('href');
    await local.click();
    await expect(page).toHaveURL(new RegExp(destination!));
    await expect(page.locator('.prose')).toBeVisible();
  }
});
