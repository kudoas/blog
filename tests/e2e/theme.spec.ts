import { expect, test, type Page } from '@playwright/test';

const choices = { light: 'ライト', dark: 'ダーク' };
const chooseTheme = (page: Page, theme: keyof typeof choices) => page.getByRole('radio', { name: choices[theme], exact: true }).click();
const selection = (page: Page) => page.locator('input[name="theme-preference"]:checked');

async function expectTheme(page: Page, theme: 'light' | 'dark') {
  await expect.poll(() => page.evaluate((scheme) => {
    const sample = document.createElement('span');
    sample.style.backgroundColor = 'Canvas';
    document.body.append(sample);
    const inherited = getComputedStyle(sample).backgroundColor;
    sample.style.colorScheme = scheme;
    const expected = getComputedStyle(sample).backgroundColor;
    sample.remove();
    return inherited === expected;
  }, theme)).toBe(true);
}

function contrast(foreground: string, background: string) {
  const luminance = (color: string) => {
    const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const [red, green, blue] = rgb.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return red * 0.2126 + green * 0.7152 + blue * 0.0722;
  };
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test('follows the system until explicitly selected, persists navigation', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const selected = selection(page);
  await expect(selected).toHaveValue('light');
  await expectTheme(page, 'light');
  await expect(page.getByRole('group', { name: '配色', exact: true }).getByRole('radio')).toHaveCount(2);
  expect(await page.evaluate(() => localStorage.getItem('blog-theme'))).toBeNull();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectTheme(page, 'dark');
  await expect(selected).toHaveValue('dark');
  await chooseTheme(page, 'light');
  await expectTheme(page, 'light');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectTheme(page, 'light');
  await page.getByRole('link', { name: 'タグ', exact: true }).click();
  await expectTheme(page, 'light');
  await expect(selected).toHaveValue('light');
  await page.reload();
  await expectTheme(page, 'light');
  await chooseTheme(page, 'dark');
  await expectTheme(page, 'dark');
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
  await expect(selection(page)).toHaveValue('light');
  await expectTheme(page, 'light');
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage unavailable'); } });
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.reload();
  await chooseTheme(page, 'dark');
  await expectTheme(page, 'dark');
  expect(errors).toEqual([]);
});

test('synchronizes preferences between tabs', async ({ context, page }) => {
  await page.goto('/');
  const other = await context.newPage();
  await other.goto('/tags/');
  await chooseTheme(page, 'dark');
  await expectTheme(other, 'dark');
  await expect(selection(other)).toHaveValue('dark');
  await chooseTheme(page, 'light');
  await expectTheme(other, 'light');
});

for (const theme of ['light', 'dark'] as const) {
  test(`renders readable ${theme} pages without JavaScript`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: theme });
    const page = await context.newPage();
    await page.goto('/posts/func-error-boundary/');
    await expectTheme(page, theme);
    await expect(page.getByRole('group', { name: '配色', exact: true })).toBeHidden();
    await expect(page.locator('.prose pre').first()).toBeVisible();
    await context.close();
  });

  test(`fits mobile, exposes keyboard focus and colors code and search in ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('/');
    const selected = selection(page);
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      if (await selected.evaluate((element) => element === document.activeElement)) break;
    }
    await expect(selected).toBeFocused();
    await chooseTheme(page, theme);
    await expect(selected).toHaveValue(theme);
    await expectTheme(page, theme);
    await page.getByRole('searchbox').fill('Figma');
    await expect(page.locator('.article-excerpt mark')).toContainText('Figma');
    const highlight = await page.locator('.article-excerpt mark').first().evaluate((mark) => {
      const { color, backgroundColor } = getComputedStyle(mark);
      return { color, backgroundColor };
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${theme}-mobile.png`), fullPage: true });
    await page.goto('/posts/func-error-boundary/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`${theme}-article.png`), fullPage: true });
    const { canvas, text, link, code } = await page.evaluate(() => {
      const sample = document.createElement('span');
      sample.style.backgroundColor = 'Canvas';
      document.body.append(sample);
      const canvas = getComputedStyle(sample).backgroundColor;
      sample.remove();
      const codeStyle = getComputedStyle(document.querySelector('.prose pre')!);
      return {
        canvas,
        text: getComputedStyle(document.querySelector('.prose')!).color,
        link: getComputedStyle(document.querySelector('.prose a')!).color,
        code: { color: codeStyle.color, backgroundColor: codeStyle.backgroundColor },
      };
    });
    expect(contrast(text, canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(link, canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(code.color, code.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(highlight.color, highlight.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    expect(highlight.backgroundColor).not.toBe(canvas);
  });
}

for (const delayed of [false, true]) {
  test(`comments follow the selected theme with ${delayed ? 'delayed' : 'immediate'} loading`, async ({ page }) => {
    await page.addInitScript(() => { if (window === window.top) localStorage.setItem('blog-theme', 'light'); });
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    await page.route('https://giscus.app/client.js', async (route) => {
      if (delayed) await pending;
      await route.fulfill({ contentType: 'text/javascript', body: `
        const frame = document.createElement('iframe');
        frame.className = 'giscus-frame';
        frame.src = 'https://giscus.app/test-theme?theme=' + document.currentScript.dataset.theme;
        document.querySelector('.giscus').append(frame);
      ` });
    });
    await page.route('https://giscus.app/test-theme?*', async (route) => {
      await route.fulfill({ contentType: 'text/html', body: `
        <html><body><script>
          document.documentElement.dataset.theme = new URL(location.href).searchParams.get('theme');
          window.addEventListener('message', (event) => {
            if (event.data?.giscus?.setConfig?.theme) document.documentElement.dataset.theme = event.data.giscus.setConfig.theme;
          });
        </script></body></html>
      ` });
    });
    // DOMContentLoaded must not wait for the deliberately delayed async client.
    await page.goto('/posts/func-error-boundary/', { waitUntil: 'domcontentloaded' });
    const comments = page.frameLocator('iframe.giscus-frame').locator('html');
    if (!delayed) await expect(comments).toHaveAttribute('data-theme', 'light');
    await chooseTheme(page, 'dark');
    if (delayed) release();
    await expect(comments).toHaveAttribute('data-theme', 'transparent_dark');
    await chooseTheme(page, 'light');
    await expect(comments).toHaveAttribute('data-theme', 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(comments).toHaveAttribute('data-theme', 'light');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(comments).toHaveAttribute('data-theme', 'light');
  });
}

test('switches the theme using arrow keys', async ({ page }) => {
  await page.goto('/');
  await chooseTheme(page, 'light');
  await page.getByRole('radio', { name: 'ライト', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'ダーク', exact: true })).toBeChecked();
  await expectTheme(page, 'dark');
  await page.keyboard.press('ArrowLeft');
  await expectTheme(page, 'light');
});

test('clicking the current system color saves an explicit preference', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(selection(page)).toHaveValue('light');
  await chooseTheme(page, 'light');
  expect(await page.evaluate(() => localStorage.getItem('blog-theme'))).toBe('light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectTheme(page, 'light');
});
