import { expect, test, type Page } from '@playwright/test';

// Observe the browser's real cross-document transition, rather than just its CSS.
async function observeTransitions(page: Page) {
  await page.addInitScript(() => {
    addEventListener('pagereveal', (event) => {
      const transition = (event as Event & { viewTransition?: ViewTransition | null }).viewTransition;
      const result = { path: location.pathname, state: transition ? 'pending' : 'none', duration: '' };
      const save = () => sessionStorage.setItem('test-view-transition', JSON.stringify(result));
      save();
      if (!transition) return;
      transition.ready.then(() => {
        result.duration = getComputedStyle(document.documentElement, '::view-transition-new(root)').animationDuration;
        result.state = 'ready';
        save();
        return transition.finished;
      }).then(() => {
        result.state = 'finished';
        save();
      }).catch(() => { result.state = 'skipped'; save(); });
    });
  });
}

async function expectTransition(page: Page, path: string, state: 'finished' | 'none') {
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('test-view-transition') ?? 'null')))
    .toMatchObject({ path, state, duration: state === 'finished' ? '0.16s' : '' });
}

test('cross-fades native page navigation and history while retaining theme and article controls', async ({ page, context }) => {
  await observeTransitions(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.route('https://giscus.app/**', route => route.abort());
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/tags/react/');
  await page.getByRole('radio', { name: 'ダーク', exact: true }).click();
  await page.getByRole('link', { name: 'Error BoundaryをFunction Componentで扱う', exact: true }).click();
  await expectTransition(page, '/posts/func-error-boundary/', 'finished');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const block = page.locator('.code-block').first();
  await block.getByRole('button', { name: 'コードをコピー', exact: true }).click();
  await expect(block.getByRole('status')).toHaveText('コピーしました');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await block.locator('pre > code').textContent());

  await page.goBack();
  await expectTransition(page, '/tags/react/', 'finished');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('#React');
  await page.goForward();
  await expectTransition(page, '/posts/func-error-boundary/', 'finished');
  await page.getByRole('link', { name: '検索を開く' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('disables document animations for reduced motion and keeps native anchors', async ({ page }) => {
  await observeTransitions(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('link', { name: 'タグ', exact: true }).click();
  await expectTransition(page, '/tags/', 'none');
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
