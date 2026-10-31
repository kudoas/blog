import { expect, test } from '@playwright/test';

const article = '/posts/func-error-boundary/';

test.beforeEach(async ({ page }) => {
  await page.route('https://giscus.app/**', route => route.abort());
});

test('copies only the selected code, preserves whitespace, and works with the keyboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(article);
  const blocks = page.locator('.code-block');
  const first = blocks.first();
  const source = await first.locator('pre > code').textContent();
  expect(source).toContain('\n');
  const button = first.getByRole('button', { name: 'コードをコピー', exact: true });
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(first.getByRole('status')).toHaveText('コピーしました');
  await expect(button.locator('.code-copy-check')).toBeVisible();
  await expect(button.locator('.code-copy-icon')).toBeHidden();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(source);
  await expect(button).toBeFocused();
  await expect(first.locator('pre > code')).toHaveText(source!);
  await expect(first.getByRole('status')).toHaveText('');
  await expect(button.locator('.code-copy-icon')).toBeVisible();
  await expect(button).toBeFocused();

  const second = blocks.nth(1);
  const secondSource = await second.locator('pre > code').textContent();
  await second.getByRole('button', { name: 'コードをコピー', exact: true }).click();
  await expect(second.getByRole('status')).toHaveText('コピーしました');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(secondSource);
  expect(secondSource).not.toBe(source);
});

for (const unavailable of [false, true]) {
  test(`explains manual copying when the clipboard is ${unavailable ? 'unavailable' : 'denied'}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.addInitScript((missing) => {
      if (missing) Object.defineProperty(navigator, 'clipboard', { value: undefined });
      else Object.defineProperty(navigator.clipboard, 'writeText', {
        value: () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')),
      });
    }, unavailable);
    await page.goto(article);
    const first = page.locator('.code-block').first();
    const source = await first.locator('pre > code').textContent();
    const button = first.getByRole('button', { name: 'コードをコピー', exact: true });
    await button.focus();
    await page.keyboard.press('Space');
    await expect(first.getByRole('status')).toHaveText('コピーできませんでした。コードを選択してコピーしてください。');
    await expect(first.locator('.code-copy-feedback')).toHaveText('コピーできませんでした');
    await expect(first.locator('.code-copy-feedback')).toBeVisible();
    await expect(button).toBeFocused();
    await expect(first.locator('pre > code')).toHaveText(source!);
    await expect(button).not.toHaveAttribute('aria-busy', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('retains plain readable code and no copy controls without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(article);
  await expect(page.getByRole('button', { name: 'コードをコピー', exact: true })).toHaveCount(0);
  await expect(page.locator('.code-block')).toHaveCount(0);
  await expect(page.locator('.prose pre > code').first()).toContainText('class ErrorBoundary');
  await context.close();
});

for (const theme of ['light', 'dark'] as const) {
  test(`keeps long code scrollable and copy controls usable in ${theme} mode`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(article);
    const block = page.locator('.code-block').first();
    await block.scrollIntoViewIfNeeded();
    await expect(block.getByRole('button', { name: 'コードをコピー' })).toBeVisible();
    const pre = block.locator('pre');
    const copy = block.getByRole('button', { name: 'コードをコピー' });
    expect(await pre.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
    await pre.evaluate(element => { element.scrollLeft = 100; });
    expect(await pre.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    await expect(copy).toBeInViewport();
    await pre.evaluate(element => { element.scrollLeft = 0; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await block.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`${theme}-code-copy-mobile.png`) });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await block.scrollIntoViewIfNeeded();
    await expect(copy).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${theme}-code-copy-desktop.png`) });
  });
}

test('copies code with a touch interaction', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 320, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  await page.route('https://giscus.app/**', route => route.abort());
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', { value: () => Promise.resolve() });
  });
  await page.goto(article);
  const block = page.locator('.code-block').first();
  const button = block.getByRole('button', { name: 'コードをコピー' });
  await expect(button).toBeVisible();
  await button.tap();
  await expect(block.getByRole('status')).toHaveText('コピーしました');
  await context.close();
});
