import { expect, test } from '@playwright/test';

test('connects Herb Dev Tools to the embedded dev server', async ({ page }) => {
  const websocketUrls: string[] = [];
  page.on('websocket', (socket) => websocketUrls.push(socket.url()));

  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'HerbDevTools')?.client?.getState())).toBe('connected');

  const port = await page.locator('meta[name="herb-dev-server-port"]').getAttribute('content');
  expect(websocketUrls).toContain(`ws://localhost:${port}/`);
});

test('styles the search controls and saved-item removal', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.search-fields')).toHaveCSS('display', 'flex');
  await expect(page.locator('#article-search')).toHaveCSS('background-color', 'rgb(12, 34, 59)');
  await expect(page.locator('#tag-filter')).toHaveCSS('background-color', 'rgb(12, 34, 59)');

  const confirmation = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/saved-articles' && response.status() === 201,
  );
  await page.locator('.article-list > li').first().getByRole('button', { name: 'あとで読む' }).click();
  await confirmation;
  await expect(page.locator('.saved-articles-list').getByRole('button', { name: '解除' })).toHaveCSS('border-radius', '4px');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.search-fields')).toHaveCSS('flex-direction', 'column');
  await expect(page.locator('#tag-filter')).toHaveCSS('width', '350px');
});

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
  const earlyRemovals: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/saved-articles/remove') earlyRemovals.push(request.url());
  });
  await page.locator("[data-herb-name='saved_articles']").getByRole('button', { name: '解除' }).click();
  expect(earlyRemovals).toHaveLength(0);
  expect(new URL(page.url()).pathname).toBe('/');
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

test('removes a saved item through slots without navigating away', async ({ page }) => {
  await page.goto('/');
  const navigations: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  });

  const firstArticle = page.locator('.article-list > li').first();
  const confirmation = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/saved-articles' && response.status() === 201,
  );
  await firstArticle.getByRole('button', { name: 'あとで読む' }).click();
  await confirmation;
  const removal = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/saved-articles/remove' && response.status() === 200,
  );
  await page.locator("[data-herb-name='saved_articles']").getByRole('button', { name: '解除' }).click();
  await removal;

  await expect(page.locator("[data-herb-name='saved_articles'] > li")).toHaveCount(0);
  await expect(firstArticle.getByRole('button', { name: 'あとで読む' })).toBeVisible();
  expect(navigations).toHaveLength(0);
});

test('removing a saved item does not report missing Herb branches', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const devTools = Reflect.get(window, 'HerbDevTools');
    const originalReport = devTools.report.bind(devTools);
    const warnings: string[] = [];
    Reflect.set(window, 'herbMaterializeWarnings', warnings);
    devTools.report = (input: unknown) => {
      for (const entry of Array.isArray(input) ? input : [input]) {
        if (entry && typeof entry === 'object' && Reflect.get(entry, 'code') === 'herb-slots-materialize') {
          warnings.push(Reflect.get(entry, 'template'));
        }
      }
      return originalReport(input);
    };
  });

  const firstArticle = page.locator('.article-list > li').first();
  for (let cycle = 0; cycle < 3; cycle += 1) {
    const confirmation = page.waitForResponse((response) =>
      new URL(response.url()).pathname === '/saved-articles' && response.status() === 201,
    );
    await firstArticle.getByRole('button', { name: 'あとで読む' }).click();
    await confirmation;

    await expect(page.locator('.saved-articles-list').getByRole('button', { name: '解除' })).toBeEnabled();
    const removal = page.waitForResponse((response) =>
      new URL(response.url()).pathname === '/saved-articles/remove' && response.status() === 200,
    );
    await page.locator('.saved-articles-list').getByRole('button', { name: '解除' }).click();
    await removal;
    await expect(page.locator('.saved-articles-list > li')).toHaveCount(0);
    await expect(firstArticle.getByRole('button', { name: 'あとで読む' })).toBeVisible();
  }
  expect(await page.evaluate(() => Reflect.get(window, 'herbMaterializeWarnings'))).toEqual([]);
});

test('keeps filtered results when a saved item is removed', async ({ page }) => {
  await page.goto('/');
  const filtered = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/search' && response.status() === 200,
  );
  await page.locator('#tag-filter').selectOption('react');
  await filtered;
  await expect(page.locator('.article-explorer [aria-busy]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.article-list > li').first()).toBeVisible();
  await expect(page.locator('#tag-filter')).toHaveValue('react');
  const titles = await page.locator('.article-list > li h3 a').allTextContents();
  const url = page.url();

  const confirmation = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/saved-articles' && response.status() === 201,
  );
  await page.locator('.article-list > li').first().getByRole('button', { name: 'あとで読む' }).click();
  await confirmation;
  const removal = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/saved-articles/remove' && response.status() === 200,
  );
  await page.locator("[data-herb-name='saved_articles']").getByRole('button', { name: '解除' }).click();
  await removal;

  await expect(page.locator("[data-herb-name='saved_articles'] > li")).toHaveCount(0);
  await expect(page.locator('#tag-filter')).toHaveValue('react');
  expect(await page.locator('.article-list > li h3 a').allTextContents()).toEqual(titles);
  expect(page.url()).toBe(url);
});

test('removes a saved item through slots on a taxonomy page', async ({ page }) => {
  await page.goto('/tags/react/');
  const article = page.locator('.article-list > li').first();
  const confirmation = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/saved-articles' && response.status() === 201,
  );
  await article.getByRole('button', { name: 'あとで読む' }).click();
  await confirmation;
  const removal = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/saved-articles/remove' && response.status() === 200,
  );
  await page.locator("[data-herb-name='saved_articles']").getByRole('button', { name: '解除' }).click();
  await removal;

  await expect(page.locator("[data-herb-name='saved_articles'] > li")).toHaveCount(0);
  await expect(article.getByRole('button', { name: 'あとで読む' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/tags/react/');
});

test('lets the reader retry or discard a failed Outbox row', async ({ page }) => {
  const dismissDebugOverlay = async () => {
    if (await page.locator('meta[name="herb-debug-mode"]').count()) {
      await page.locator('button[data-herb-dev-tools-action="dismiss-overlay"]').click();
    }
  };

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
  await dismissDebugOverlay();
  await firstSavedRow.getByRole('button', { name: '再試行' }).click();
  await expect(savedList.locator('> li')).toHaveCount(1);
  await expect(savedList.getByRole('alert')).toHaveCount(0);

  await page.locator('.article-list > li').nth(1).getByRole('button', { name: 'あとで読む' }).click();
  const failedRow = savedList.locator('> li').last();
  await expect(failedRow.getByRole('alert')).toBeVisible();
  await dismissDebugOverlay();
  await failedRow.getByRole('button', { name: '破棄' }).click();
  await expect(savedList.locator('> li')).toHaveCount(1);
});

test('confirms a read-later add from a taxonomy page', async ({ page }) => {
  await page.goto('/tags/react/');
  const article = page.locator('.article-list > li').first();
  const title = await article.locator('h3 a').innerText();

  const confirmation = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/saved-articles' && response.status() === 201,
  );
  await article.getByRole('button', { name: 'あとで読む' }).click();
  await expect(page.locator("[data-herb-name='saved_articles'] > li")).toHaveCount(1);
  await expect(page.locator("[data-herb-name='saved_articles'] a")).toContainText(title);
  await confirmation;
  await page.reload();
  await expect(page.locator("[data-herb-name='saved_articles'] > li")).toHaveCount(1);
});
