import { expect, test } from '@playwright/test';

test('adds a read-later row optimistically, confirms it and keeps it after reload', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  let requested!: () => void;
  const requestStarted = new Promise<void>((resolve) => { requested = resolve; });

  await page.route('**/saved-articles**', async (route) => {
    requested();
    await held;
    await route.continue();
  });
  await page.goto('/');
  const title = (await page.locator('.article-list > li').first().locator('h3 a').innerText()).replace(/↗$/, '');
  await page.locator('.article-list > li').first().getByRole('button', { name: 'あとで読む' }).click();
  await requestStarted;
  await expect(page.locator("[data-herb-name='saved_articles'] > li")).toHaveCount(1);
  await expect(page.locator("[data-herb-name='saved_articles'] a")).toContainText(title);
  const confirmation = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/saved-articles' && response.status() === 201,
  );
  release();
  await confirmation;
  await expect(page.locator("[data-herb-name='saved_articles'] a")).toContainText(title);

  await page.reload();
  await expect(page.locator("[data-herb-name='saved_articles'] > li")).toHaveCount(1);
  await expect(page.locator("[data-herb-name='saved_articles'] a")).toContainText(title);
});

test('keeps earlier saved rows when a later Outbox add is confirmed', async ({ page }) => {
  await page.goto('/');
  const articles = page.locator('.article-list > li');
  const titles = [
    (await articles.nth(0).locator('h3 a').innerText()).replace(/↗$/, ''),
    (await articles.nth(1).locator('h3 a').innerText()).replace(/↗$/, ''),
  ];
  const savedList = page.locator("[data-herb-name='saved_articles']");

  await articles.nth(0).getByRole('button', { name: 'あとで読む' }).click();
  await expect(savedList.locator('> li')).toHaveCount(1);
  await articles.nth(1).getByRole('button', { name: 'あとで読む' }).click();

  await expect(savedList.locator('> li')).toHaveCount(2);
  await expect(savedList).toContainText(titles[0]);
  await expect(savedList).toContainText(titles[1]);
  await page.reload();
  await expect(savedList.locator('> li')).toHaveCount(2);
  await expect(savedList).toContainText(titles[0]);
  await expect(savedList).toContainText(titles[1]);
});

test('adds and removes a read-later item with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  const firstArticle = page.locator('.article-list > li').first();
  await firstArticle.getByRole('button', { name: 'あとで読む' }).click();
  await expect(page.locator("[data-herb-name='saved_articles'] > li")).toHaveCount(1);
  await page.locator("[data-herb-name='saved_articles']").getByRole('button', { name: '解除' }).click();
  await expect(page.locator("[data-herb-name='saved_articles'] > li")).toHaveCount(0);
  await context.close();
});

test('lets the reader retry or discard a failed Outbox row', async ({ page }) => {
  let attempts = 0;
  await page.route('**/saved-articles**', async (route) => {
    attempts += 1;
    if (attempts === 2) await route.continue();
    else await route.fulfill({ status: 503, body: 'temporarily unavailable' });
  });
  await page.goto('/');
  await page.locator('.article-list > li').nth(0).getByRole('button', { name: 'あとで読む' }).click();
  const savedList = page.locator("[data-herb-name='saved_articles']");
  const firstSavedRow = savedList.locator('> li').last();
  await expect(firstSavedRow.getByRole('alert')).toBeVisible();
  await firstSavedRow.getByRole('button', { name: '再試行' }).click();
  await expect(savedList.locator('> li')).toHaveCount(1);
  await expect(savedList.getByRole('alert')).toHaveCount(0);

  await page.locator('.article-list > li').nth(1).getByRole('button', { name: 'あとで読む' }).click();
  const failedRow = savedList.locator('> li').last();
  await expect(failedRow.getByRole('alert')).toBeVisible();
  await failedRow.getByRole('button', { name: '破棄' }).click();
  await expect(savedList.locator('> li')).toHaveCount(1);
});

test('confirms a read-later add from a taxonomy page', async ({ page }) => {
  await page.goto('/tags/react/');
  const article = page.locator('.article-list > li').first();
  const title = await article.locator('h3 a').innerText();

  await article.getByRole('button', { name: 'あとで読む' }).click();
  await expect(page.locator("[data-herb-name='saved_articles'] > li")).toHaveCount(1);
  await expect(page.locator("[data-herb-name='saved_articles'] a")).toContainText(title);
  await page.reload();
  await expect(page.locator("[data-herb-name='saved_articles'] > li")).toHaveCount(1);
});
