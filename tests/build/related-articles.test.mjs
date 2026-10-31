import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { load } from 'cheerio';
import { parse } from 'yaml';
import { posts } from '../fixtures/content.ts';

const assets = '.cloudflare/output/v0/workers/default/assets';
const normalized = (value) => value.normalize('NFKC').toLocaleLowerCase('ja').trim().replace(/\s+/g, '-');
const external = parse(readFileSync('content/external.yaml', 'utf8'));
const items = [...posts.map((p) => ({ ...p.data, url: `/posts/${p.id}/` })), ...external];

test('all generated related destinations share a tag, omit self and stay outside the search body', () => {
  for (const post of posts) {
    const $ = load(readFileSync(`${assets}/posts/${post.id}/index.html`, 'utf8'));
    const section = $('.related-articles');
    const links = section.find('li > a');
    assert.ok(links.length <= 3);
    const urls = links.map((_, link) => $(link).attr('href')).get();
    assert.equal(new Set(urls).size, urls.length);
    assert.ok(!urls.includes(`/posts/${post.id}/`));
    if (section.length) {
      assert.ok(links.length > 0);
      assert.equal(section.attr('data-pagefind-ignore'), '');
      assert.equal(section.closest('[data-pagefind-body]').length, 0);
      for (const url of urls) {
        const target = items.find((item) => item.url === url);
        assert.ok(target, url);
        assert.ok(target.tags?.some((tag) => post.data.tags?.map(normalized).includes(normalized(tag))), url);
      }
    }
  }
});
