import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import { load } from 'cheerio';
import { posts } from '../fixtures/content.ts';
import { linkKey, validateLinkMetadata } from '../../src/lib/markdown/link-metadata.ts';

const assets = '.cloudflare/output/v0/workers/default/assets';
const metadata = validateLinkMetadata(JSON.parse(readFileSync('content/link-metadata.json', 'utf8')));

test('renders cached link titles and external favicon URLs in static article HTML', () => {
  let enhanced = 0;
  for (const post of posts) {
    const $ = load(readFileSync(`${assets}/posts/${post.id}/index.html`, 'utf8'));
    for (const a of $('.prose a.link-with-metadata').toArray()) {
      const link = $(a);
      const key = linkKey(link.attr('href'));
      assert.ok(key);
      const icon = link.find('img.link-favicon');
      assert.equal(icon.length, metadata[key]?.icon ? 1 : 0);
      if (icon.length) {
        assert.equal(icon.attr('src'), metadata[key].icon);
        assert.equal(icon.attr('alt'), '');
        assert.equal(icon.attr('referrerpolicy'), 'no-referrer');
        assert.ok(icon.attr('src').startsWith('https://'));
      }
      if (metadata[key]) assert.equal(link.text().trim(), metadata[key].title);
      else assert.ok(link.text().trim());
      enhanced++;
    }
    assert.equal($('.prose pre .link-with-metadata').length, 0);
    assert.equal($('.toc .link-with-metadata, .post-header .link-with-metadata').length, 0);
  }
  assert.ok(enhanced > 0);
  assert.equal(existsSync(`${assets}/link-icons`), false);
});
