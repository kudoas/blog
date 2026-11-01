import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { posts } from '../fixtures/content.ts';

function luminance(color) {
  assert.match(color, /^#[\da-f]{6}$/i, `Unsupported theme color: ${color}`);
  const linear = color.slice(1).match(/../g).map(value => {
    const channel = parseInt(value, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

const property = (style, name) => style.match(new RegExp(`(?:^|;)\\s*${name}:\\s*([^;]+)`))?.[1].trim();

test('published syntax tokens meet normal-text contrast in both generated themes', () => {
  let tokens = 0;
  for (const { id } of posts) {
    const $ = load(readFileSync(`.cloudflare/output/v0/workers/default/assets/posts/${id}/index.html`, 'utf8'));
    for (const pre of $('.prose pre.astro-code').toArray()) {
      const base = $(pre).attr('style');
      for (const theme of ['light', 'dark']) {
        const background = luminance(property(base, `--shiki-${theme}-bg`));
        const defaultForeground = luminance(property(base, `--shiki-${theme}`));
        const defaultRatio = (Math.max(defaultForeground, background) + 0.05) / (Math.min(defaultForeground, background) + 0.05);
        assert.ok(defaultRatio >= 4.5, `${id} ${theme}: default code text has contrast ${defaultRatio.toFixed(2)}:1`);
        for (const span of $(pre).find('code span[style]').toArray()) {
          if (!$(span).text().trim()) continue;
          const color = property($(span).attr('style'), `--shiki-${theme}`) ?? property(base, `--shiki-${theme}`);
          const foreground = luminance(color);
          const ratio = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
          assert.ok(ratio >= 4.5, `${id} ${theme}: ${color} has contrast ${ratio.toFixed(2)}:1`);
          tokens++;
        }
      }
    }
  }
  assert.ok(tokens > 0, 'The check must cover generated syntax tokens');
});
