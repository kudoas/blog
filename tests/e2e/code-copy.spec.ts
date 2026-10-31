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
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(source);
  await expect(button).toBeFocused();
  await expect(first.locator('pre > code')).toHaveText(source!);

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
  test(`keeps code width and horizontal scrolling in ${theme} mode`, async ({ page, browser }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: theme });
    const baselineContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, colorScheme: theme });
    const baseline = await baselineContext.newPage();
    await baseline.goto(article);
    const baselineWidth = await baseline.locator('.prose pre').first().evaluate(element => element.clientWidth);
    await baselineContext.close();

    await page.goto(article);
    const block = page.locator('.code-block').first();
    await expect(block.getByRole('button', { name: 'コードをコピー' })).toBeVisible();
    const pre = block.locator('pre');
    expect(await pre.evaluate(element => element.clientWidth)).toBe(baselineWidth);
    expect(await pre.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
    await pre.evaluate(element => { element.scrollLeft = 100; });
    expect(await pre.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    await pre.evaluate(element => { element.scrollLeft = 0; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await block.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`${theme}-code-copy-mobile.png`) });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await block.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`${theme}-code-copy-desktop.png`) });
  });
}
