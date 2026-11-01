import { expect, test, type Page } from '@playwright/test';

// Observe the actual ViewTransition used by ClientRouter, including its animation.
async function observeTransitions(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener('astro:before-swap', (event) => {
      const { viewTransition, to } = event as Event & { viewTransition: ViewTransition; to: URL };
      const result = { path: to.pathname, state: 'pending', duration: '', animation: '' };
      const save = () => sessionStorage.setItem('test-view-transition', JSON.stringify(result));
      save();
      viewTransition.ready.then(() => {
        const style = getComputedStyle(document.documentElement, '::view-transition-new(root)');
        result.duration = style.animationDuration;
        result.animation = style.animationName;
        result.state = 'ready';
        save();
        return viewTransition.finished;
      }).then(() => {
        result.state = 'finished';
        save();
      }).catch(() => { result.state = 'skipped'; save(); });
    });
  });
}

async function expectTransition(page: Page, path: string, motion: boolean = true) {
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('test-view-transition') ?? 'null')))
    .toMatchObject({ path, state: 'finished', ...(motion ? { duration: '0.16s' } : { animation: 'none' }) });
}

test('cross-fades client navigation and history while retaining theme, copy and search controls', async ({ page }) => {
  await observeTransitions(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: {
      writeText: async (value: string) => { sessionStorage.setItem('test-copied-code', value); },
    } });
  });
  await page.route('https://giscus.app/**', route => route.abort());
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/tags/react/');
  const documentOrigin = await page.evaluate(() => performance.timeOrigin);
  await page.getByRole('radio', { name: 'ダーク', exact: true }).click();
  await page.getByRole('link', { name: 'Error BoundaryをFunction Componentで扱う', exact: true }).click();
  await expectTransition(page, '/posts/func-error-boundary/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const block = page.locator('.code-block').first();
  await block.getByRole('button', { name: 'コードをコピー', exact: true }).click();
  await expect(block.getByRole('status')).toHaveText('コピーしました');
  expect(await page.evaluate(() => sessionStorage.getItem('test-copied-code'))).toBe(await block.locator('pre > code').textContent());

  await page.goBack();
  await expectTransition(page, '/tags/react/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('#React');
  await page.goForward();
  await expectTransition(page, '/posts/func-error-boundary/');
  await page.getByRole('link', { name: '検索を開く' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentOrigin);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('disables document animations for reduced motion and keeps native anchors', async ({ page }) => {
  await observeTransitions(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('link', { name: 'タグ', exact: true }).click();
  await expectTransition(page, '/tags/', false);
  await page.getByRole('link', { name: '本文へスキップ' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/tags\/#main$/);
  await expect(page.locator('#main')).toBeFocused();
});

test('keeps cross-page links usable with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  await page.goto('/tags/react/');
  await page.getByRole('link', { name: 'Error BoundaryをFunction Componentで扱う', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Error BoundaryをFunction Componentで扱う');
  await expect(page.locator('.prose pre > code').first()).toContainText('class ErrorBoundary');
  await page.goBack();
  await expect(page).toHaveURL(/\/tags\/react\/$/);
  await context.close();
});

test('reinitializes comments, search context and long contents across repeated article visits', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  // Exercise the third-party script lifecycle without depending on GitHub availability.
  await page.route('https://giscus.app/client.js', route => route.fulfill({ contentType: 'text/javascript', body: `{
    const client = document.currentScript;
    const frame = document.createElement('iframe');
    frame.className = 'giscus-frame';
    frame.dataset.term = client.dataset.term;
    frame.src = 'about:blank';
    client.parentElement.append(frame);
  }` }));
  await page.goto('/');
  await page.getByRole('searchbox', { name: '記事を検索', exact: true }).fill('Error');
  await page.getByLabel('タグで絞り込む').selectOption('react');
  await expect(page.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false');
  const historyState = await page.evaluate(() => history.state);
  expect(historyState).toHaveProperty('index');
  await page.getByRole('link', { name: 'Error BoundaryをFunction Componentで扱う', exact: true }).click();
  await expect(page.locator('[data-article-return-link="top"]')).toHaveAttribute('href', '/?q=Error&tag=react');
  await expect(page.locator('.giscus-frame')).toHaveAttribute('data-term', '/posts/func-error-boundary/');
  await page.getByRole('radio', { name: 'ダーク', exact: true }).click();
  await expect(page.locator('.giscus script')).toHaveAttribute('data-theme', 'transparent_dark');

  const home = page.getByRole('link', { name: 'daichi/tech ホーム' });
  await home.click();
  await page.locator('a[href="/posts/async-nodejs/"]').click();
  await expect(page.locator('.giscus-frame')).toHaveAttribute('data-term', '/posts/async-nodejs/');
  await expect(page.locator('.giscus script')).toHaveAttribute('data-theme', 'transparent_dark');
  await expect(page.locator('.code-block .code-block')).toHaveCount(0);
  expect(await page.locator('.code-copy').count()).toBe(await page.locator('.prose pre').count());
  await page.getByRole('radio', { name: 'ライト', exact: true }).click();
  await expect(page.locator('.giscus script')).toHaveAttribute('data-theme', 'light');

  for (let visit = 0; visit < 2; visit++) {
    await home.click();
    await page.locator('a[href="/posts/first-summer-intern/"]').click();
    await expect(page.locator('.toc')).toHaveAttribute('open');
    await expect(page.locator('.giscus-frame')).toHaveAttribute('data-term', '/posts/first-summer-intern/');
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('keeps incoming controls usable while the comment client is still loading', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('https://giscus.app/client.js', async route => {
    await pending;
    await route.fulfill({ contentType: 'text/javascript', body: '' });
  });
  await page.goto('/tags/react/');
  try {
    await page.getByRole('link', { name: 'Error BoundaryをFunction Componentで扱う', exact: true }).click();
    await expect(page.locator('.code-copy').first()).toBeVisible();
    await page.getByRole('radio', { name: 'ダーク', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('link', { name: '検索を開く' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  } finally {
    release();
  }
});

test('swaps pages without animation when the browser has no View Transition API', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(document, 'startViewTransition', { value: undefined }));
  await page.goto('/');
  const origin = await page.evaluate(() => performance.timeOrigin);
  await page.getByRole('link', { name: 'タグ', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('タグから探す');
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(origin);
  await expect(page.locator('html')).toHaveCSS('animation-name', 'none');
  await page.getByRole('link', { name: '検索を開く' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
