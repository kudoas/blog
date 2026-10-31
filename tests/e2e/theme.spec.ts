import { expect, test } from '@playwright/test';

const colors = { light: 'rgb(255, 255, 255)', dark: 'rgb(6, 25, 47)' };

async function expectTheme(page: import('@playwright/test').Page, theme: 'light' | 'dark') {
  await expect(page.locator('html')).toHaveCSS('background-color', colors[theme]);
  await expect(page.locator('html')).toHaveCSS('color-scheme', theme);
}

test('follows the system until explicitly selected, persists navigation and can return to system', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const select = page.getByLabel('配色', { exact: true });
  await expect(select).toHaveValue('system');
  await expectTheme(page, 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectTheme(page, 'dark');
  await select.selectOption('light');
  await expectTheme(page, 'light');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectTheme(page, 'light');
  await page.getByRole('link', { name: 'タグ', exact: true }).click();
  await expectTheme(page, 'light');
  await expect(select).toHaveValue('light');
  await page.reload();
  await expectTheme(page, 'light');
  await select.selectOption('dark');
  await expectTheme(page, 'dark');
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute('content', '#06192f');
  await select.selectOption('system');
  expect(await page.evaluate(() => localStorage.getItem('blog-theme'))).toBeNull();
  await page.emulateMedia({ colorScheme: 'light' });
  await expectTheme(page, 'light');
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute('content', /^#(?:fff|ffffff)$/);
});

test('applies a saved preference before body parsing', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => {
    localStorage.setItem('blog-theme', 'dark');
    new MutationObserver(() => {
      if (document.body && !('themeAtBody' in document.documentElement.dataset)) {
        document.documentElement.dataset.themeAtBody = document.documentElement.dataset.theme;
      }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme-at-body', 'dark');
  await expectTheme(page, 'dark');
});

test('invalid preferences fall back to system and blocked storage still permits switching', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => localStorage.setItem('blog-theme', 'invalid'));
  await page.goto('/');
  await expect(page.getByLabel('配色')).toHaveValue('system');
  await expectTheme(page, 'light');
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage unavailable'); } });
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.reload();
  await page.getByLabel('配色').selectOption('dark');
  await expectTheme(page, 'dark');
  expect(errors).toEqual([]);
});

test('synchronizes preferences between tabs', async ({ context, page }) => {
  await page.goto('/');
  const other = await context.newPage();
  await other.goto('/tags/');
  await page.getByLabel('配色').selectOption('dark');
  await expectTheme(other, 'dark');
  await expect(other.getByLabel('配色')).toHaveValue('dark');
  await page.getByLabel('配色').selectOption('light');
  await expectTheme(other, 'light');
});

for (const theme of ['light', 'dark'] as const) {
  test(`renders readable ${theme} pages without JavaScript`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: theme });
    const page = await context.newPage();
    await page.goto('/posts/func-error-boundary/');
    await expectTheme(page, theme);
    await expect(page.getByLabel('配色')).toBeHidden();
    await expect(page.locator('.prose pre').first()).toBeVisible();
    await expect(page.locator('.prose pre').first()).toHaveCSS('background-color', theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(36, 41, 46)');
    await context.close();
  });

  test(`fits mobile, exposes keyboard focus and colors code and search in ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('/');
    const select = page.getByLabel('配色');
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      if (await select.evaluate((element) => element === document.activeElement)) break;
    }
    await expect(select).toBeFocused();
    await select.selectOption(theme);
    await expect(select).toHaveValue(theme);
    await expectTheme(page, theme);
    await page.getByRole('searchbox').fill('Figma');
    await expect(page.locator('.article-excerpt mark')).toContainText('Figma');
    await expect(page.locator('.article-excerpt mark').first()).toHaveCSS('background-color', theme === 'light' ? 'rgb(219, 234, 254)' : 'rgb(23, 71, 107)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${theme}-mobile.png`), fullPage: true });
    await page.goto('/posts/func-error-boundary/');
    await expect(page.locator('.prose pre').first()).toHaveCSS('background-color', theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(36, 41, 46)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`${theme}-article.png`), fullPage: true });
    // Verify the colors actually used by the browser rather than duplicating the palette.
    const contrast = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const luminance = (color: string) => {
        const hex = color.slice(1);
        const fullHex = hex.length === 3 ? [...hex].map((v) => v + v).join('') : hex;
        const rgb = color.startsWith('#') ? fullHex.match(/../g)!.map((v) => parseInt(v, 16)) : color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
        const linear = rgb.map((v) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
        return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
      };
      const bg = luminance(root.getPropertyValue('--bg').trim());
      return ['--text', '--muted', '--accent', '--draft-text'].map((token) => {
        const fg = luminance(root.getPropertyValue(token).trim());
        return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
      });
    });
    for (const ratio of contrast) expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
}
