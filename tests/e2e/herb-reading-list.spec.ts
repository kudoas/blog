import { expect, test } from '@playwright/test';

test('switches a client slot without a request', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (['fetch', 'xhr'].includes(request.resourceType())) requests.push(request.url());
  });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Slots の仕組みを見る' });
  const explanation = page.getByText('この文章は初回表示では隠れた分岐です。', { exact: false });
  await expect(explanation).toHaveCount(0);
  await toggle.click();
  await expect(explanation).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await toggle.click();
  await expect(explanation).toHaveCount(0);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(requests).toEqual([]);
});

test('connects Herb Dev Tools to the embedded dev server', async ({ page }) => {
  const websocketUrls: string[] = [];
  page.on('websocket', (socket) => websocketUrls.push(socket.url()));
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'HerbDevTools')?.client?.getState())).toBe('connected');
  const port = await page.locator('meta[name="herb-dev-server-port"]').getAttribute('content');
  expect(websocketUrls).toContain(`ws://localhost:${port}/`);
});

test('shows an optimistic row before its request completes and keeps it after reload', async ({ page }) => {
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
  await expect(page.locator('.saved-articles-list > li')).toHaveCount(1);
  await expect(page.locator('.saved-articles-list a')).toContainText(title);
  release();
  await expect(page.locator('.saved-articles-list').getByRole('button', { name: '解除' })).toBeEnabled();
  await page.reload();
  await expect(page.locator('.saved-articles-list a')).toContainText(title);
});

test('keeps earlier saved rows when another Outbox add is confirmed', async ({ page }) => {
  await page.goto('/');
  const articles = page.locator('.article-list > li');
  const titles = [await articles.nth(0).locator('h3 a').innerText(), await articles.nth(1).locator('h3 a').innerText()];
  const secondId = await articles.nth(1).getAttribute('data-article-id');
  await articles.nth(0).getByRole('button', { name: 'あとで読む' }).click();
  await expect(page.locator('.saved-articles-list > li')).toHaveCount(1);
  await page.locator(`.article-list > li[data-article-id="${secondId}"]`).getByRole('button', { name: 'あとで読む' }).click();
  await expect(page.locator('.saved-articles-list > li')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('.saved-articles-list')).toContainText(titles[0].replace(/↗$/, ''));
  await expect(page.locator('.saved-articles-list')).toContainText(titles[1].replace(/↗$/, ''));
});

test('adds a saved article through Outbox and removes it through slots', async ({ page }) => {
  await page.goto('/');
  const article = page.locator('.article-list > li').first();
  const articleId = await article.getAttribute('data-article-id');
  const title = (await article.locator('h3 a').innerText()).replace(/↗$/, '');
  const add = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/saved-articles' && response.status() === 201,
  );
  await article.getByRole('button', { name: 'あとで読む' }).click();
  await add;
  await expect(page.locator('.saved-articles-list > li')).toHaveCount(1);
  await expect(page.locator('.saved-articles-list a')).toContainText(title);
  await expect(page.locator('.result-number')).toHaveText('21');
  await expect(page.locator(`.article-list > li[data-article-id="${articleId}"]`)).toHaveCount(0);

  const remove = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/saved-articles/remove' && response.status() === 200,
  );
  await page.locator('.saved-articles-list').getByRole('button', { name: '解除' }).click();
  await remove;
  await expect(page.locator('.saved-articles-list > li')).toHaveCount(0);
  await expect(page.locator('.result-number')).toHaveText('22');
  await expect(page.locator(`.article-list > li[data-article-id="${articleId}"]`).getByRole('button', { name: 'あとで読む' })).toBeVisible();
});

test('uses HTML forms when JavaScript is disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await page.locator('.article-list > li').first().getByRole('button', { name: 'あとで読む' }).click();
  await expect(page.locator('.saved-articles-list > li')).toHaveCount(1);
  await page.locator('.saved-articles-list').getByRole('button', { name: '解除' }).click();
  await expect(page.locator('.saved-articles-list > li')).toHaveCount(0);
  await context.close();
});

test('preserves taxonomy context after removal', async ({ page }) => {
  await page.goto('/tags/react/');
  const before = Number.parseInt(await page.locator('.page-heading .muted').innerText(), 10);
  const articleId = await page.locator('.article-list > li').first().getAttribute('data-article-id');
  await page.locator('.article-list > li').first().getByRole('button', { name: 'あとで読む' }).click();
  await expect(page.locator('.saved-articles-list > li')).toHaveCount(1);
  await expect(page.locator('.page-heading .muted')).toContainText(`${before - 1} 件の記事`);
  await expect(page.locator(`.article-list > li[data-article-id="${articleId}"]`)).toHaveCount(0);
  await page.locator('.saved-articles-list').getByRole('button', { name: '解除' }).click();
  await expect(page.locator('.saved-articles-list > li')).toHaveCount(0);
  await expect(page.locator('.page-heading .muted')).toContainText(`${before} 件の記事`);
  await expect(page.locator(`.article-list > li[data-article-id="${articleId}"]`)).toHaveCount(1);
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
  const savedList = page.locator('.saved-articles-list');
  await expect(savedList.getByRole('alert')).toBeVisible();
  await dismissDebugOverlay();
  await savedList.getByRole('button', { name: '再試行' }).click();
  await expect(savedList.locator('> li')).toHaveCount(1);
  await expect(savedList.getByRole('alert')).toHaveCount(0);

  await page.locator('.article-list > li').nth(1).getByRole('button', { name: 'あとで読む' }).click();
  const failedRow = savedList.locator('> li').last();
  await expect(failedRow.getByRole('alert')).toBeVisible();
  await dismissDebugOverlay();
  await failedRow.getByRole('button', { name: '破棄' }).click();
  await expect(savedList.locator('> li')).toHaveCount(1);
});

test('keeps the saved-item controls usable on mobile', async ({ page }) => {
  await page.goto('/');
  await page.locator('.article-list > li').first().getByRole('button', { name: 'あとで読む' }).click();
  const remove = page.locator('.saved-articles-list').getByRole('button', { name: '解除' });
  await expect(remove).toHaveCSS('border-radius', '4px');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(remove).toBeVisible();
});

test('removal does not report missing Herb branches', async ({ page }) => {
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
    await firstArticle.getByRole('button', { name: 'あとで読む' }).click();
    await expect(page.locator('.saved-articles-list').getByRole('button', { name: '解除' })).toBeEnabled();
    await page.locator('.saved-articles-list').getByRole('button', { name: '解除' }).click();
    await expect(page.locator('.saved-articles-list > li')).toHaveCount(0);
  }
  expect(await page.evaluate(() => Reflect.get(window, 'herbMaterializeWarnings'))).toEqual([]);
});
