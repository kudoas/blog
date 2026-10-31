import { chromium, firefox, webkit } from '@playwright/test';
import { mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const baseURL = process.argv[2] ?? 'http://127.0.0.1:4334';
const output = process.argv[3] ?? '/tmp/blog-reading-evaluation';
await mkdir(output, { recursive: true });
const report = { date: new Date().toISOString(), baseURL, density: [], reading: [], zoom: [] };

async function prepare(context) {
  await context.route('https://giscus.app/**', route => route.abort());
  return context.newPage();
}
async function measure(page) {
  return page.evaluate(() => {
    const prose = document.querySelector('.prose');
    const pre = prose?.querySelector('pre');
    const style = prose ? getComputedStyle(prose) : null;
    return {
      width: innerWidth, height: innerHeight, dpr: devicePixelRatio,
      visualScale: visualViewport.scale,
      documentOverflow: document.documentElement.scrollWidth > innerWidth,
      proseWidth: prose?.getBoundingClientRect().width,
      proseFont: style?.fontSize,
      proseHeight: prose?.getBoundingClientRect().height,
      codeWidth: pre?.clientWidth, codeScrollWidth: pre?.scrollWidth,
    };
  });
}

const chrome = await chromium.launch({ channel: 'chrome' });
try {
  for (const width of [390, 1440]) {
    const context = await chrome.newContext({ viewport: { width, height: 1000 }, colorScheme: 'light' });
    const page = await prepare(context);
    await page.goto(baseURL);
    await page.getByRole('searchbox').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('input[type="search"]').disabled);
    await page.evaluate(() => document.fonts.ready);
    for (const candidate of ['baseline-three-lines', 'two-lines', 'compact-spacing']) {
      const css = candidate === 'two-lines' ? '.article-description {-webkit-line-clamp:2 !important}'
        : candidate === 'compact-spacing' ? '.article-summary {padding-block:18px !important} .article-meta {margin-top:6px !important}' : '/* baseline: no overrides */';
      const handle = await page.addStyleTag({ content: css });
      const metrics = await page.evaluate(() => {
        const list = document.querySelector('.article-list');
        const titles = [...list.querySelectorAll('h2')];
        const descriptions = [...list.querySelectorAll('.article-description')];
        return {
          listHeight: Math.round(list.getBoundingClientRect().height),
          visibleTitles: titles.filter(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }).length,
          descriptions: descriptions.length,
          clippedDescriptions: descriptions.filter(el => el.scrollHeight > el.clientHeight + 1).length,
          documentOverflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      report.density.push({ width, candidate, ...metrics });
      await page.screenshot({ path: join(output, `list-${width}-${candidate}.png`), fullPage: true });
      await handle.evaluate(el => el.remove());
    }
    await context.close();
  }
} finally { await chrome.close(); }

for (const [engine, type, options] of [['chrome', chromium, { channel: 'chrome' }], ['firefox', firefox, {}], ['webkit', webkit, {}]]) {
  const browser = await type.launch(options);
  try {
    for (const width of [320, 390, 1440]) {
      for (const theme of ['light', 'dark']) {
        const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme });
        const page = await prepare(context);
        await page.goto(baseURL);
        const paths = await page.locator('.article-summary h2 a[href^="/posts/"]').evaluateAll(links => links.map(link => new URL(link.href).pathname));
        for (const path of paths) {
          await page.goto(new URL(path, baseURL).href);
          const metrics = await measure(page);
          assert.equal(metrics.documentOverflow, false, `${engine} ${width} ${path}`);
          assert.equal(metrics.proseFont, width <= 600 ? '16px' : '17px');
          assert.ok(metrics.proseWidth <= (width <= 600 ? 326 : 756));
          const code = page.locator('.prose pre').first();
          if (await code.count()) {
            await code.evaluate(el => { el.scrollLeft = el.scrollWidth; });
            const state = await code.evaluate(el => ({ scrollable: el.scrollWidth > el.clientWidth, scrolled: el.scrollLeft > 0 }));
            assert.ok(!state.scrollable || state.scrolled);
            await code.locator('code').evaluate(el => { const range = document.createRange(); range.selectNodeContents(el); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); });
            assert.ok(await page.evaluate(() => getSelection().toString().length > 0));
          }
          report.reading.push({ engine, version: browser.version(), theme, path, ...metrics });
        }
        await context.close();
      }
    }
  } finally { await browser.close(); }
}

// Use Chrome's actual default page-zoom preference in an isolated profile.
// This is not CSS zoom, pinch zoom, deviceScaleFactor, or viewport-only emulation.
for (const factor of [1, 2]) {
  const profile = await mkdtemp(join(tmpdir(), 'blog-reading-zoom-'));
  await mkdir(join(profile, 'Default'));
  await writeFile(join(profile, 'Default', 'Preferences'), JSON.stringify({ partition: { default_zoom_level: { x: Math.log(factor) / Math.log(1.2) } } }));
  const context = await chromium.launchPersistentContext(profile, { channel: 'chrome', viewport: null, args: ['--window-size=1440,1000'] });
  try {
    const page = await prepare(context);
    await page.goto(new URL('/posts/func-error-boundary/', baseURL).href);
    const metrics = await measure(page);
    report.zoom.push({ factor, ...metrics });
    assert.equal(metrics.documentOverflow, false);
    await page.screenshot({ path: join(output, `article-zoom-${factor}.png`), fullPage: true });
  } finally { await context.close(); await rm(profile, { recursive: true, force: true }); }
}
assert.ok(report.zoom[1].width < report.zoom[0].width * 0.55, 'Actual page zoom must halve the layout viewport');
assert.equal(report.zoom[1].dpr / report.zoom[0].dpr, 2);
assert.equal(report.zoom[1].visualScale, 1);
await writeFile(join(output, 'metrics.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ density: report.density, readingCases: report.reading.length, zoom: report.zoom }, null, 2));
