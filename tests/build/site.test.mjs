import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { posts, external } from '../fixtures/content.ts';

const page = (path) => load(readFileSync(`dist/${path}`, 'utf8'));

test('all published local and external entries appear in prerendered HTML', () => {
  const $ = page('index.html');
  assert.equal($('.article-list > li').length, posts.length + external.length);
  const links = $('.article-summary h3 a').map((_, a) => $(a).attr('href')).get();
  for (const { id } of posts) assert.ok(links.includes(`/posts/${id}/`), id);
  for (const { url } of external) assert.ok(links.includes(url), url);
  const dates = $('.article-date').map((_, time) => Date.parse($(time).attr('datetime'))).get();
  assert.deepEqual(dates, [...dates].sort((a, b) => b - a));
});

test('each Markdown article retains its URL, metadata, image paths and heading anchors', () => {
  for (const { id, data } of posts) {
    const $ = page(`posts/${id}/index.html`);
    assert.equal($('h1').text(), data.title);
    assert.equal($('link[rel="canonical"]').attr('href'), `https://blog.da1chi.net/posts/${id}/`);
    assert.equal($('meta[property="og:type"]').attr('content'), 'article');
    assert.ok($('meta[name="description"]').attr('content'));
    const image = $('meta[property="og:image"]').attr('content');
    assert.ok(image.startsWith('https://blog.da1chi.net/'));
    assert.ok(existsSync(`dist${new URL(image).pathname}`));
    for (const a of $('.toc a').toArray()) {
      const fragment = $(a).attr('href').slice(1);
      assert.ok($('[id]').toArray().some((heading) => $(heading).attr('id') === fragment), fragment);
    }
    for (const img of $('.prose img').toArray()) {
      const url = new URL($(img).attr('src'), 'https://blog.da1chi.net');
      if (url.host === 'blog.da1chi.net') assert.ok(existsSync(`dist${url.pathname}`), url.pathname);
    }
    assert.equal($('astro-island').length, 0, 'article pages must not hydrate React');
  }
});

test('Markdown rendering preserves code, inline HTML and hard line breaks', () => {
  const react = page('posts/func-error-boundary/index.html');
  assert.ok(react('.prose pre code').text().includes('<ErrorBoundary>'));
  assert.ok(page('posts/treasure/index.html')('.prose u').length > 0);
  assert.ok(page('posts/first-summer-intern/index.html')('.prose s').length > 0);
  assert.ok(page('posts/async-nodejs/index.html')('.prose br').length > 0);
});

test('RSS includes exactly the published local posts and tag feeds stay filtered', () => {
  const $ = load(readFileSync('dist/index.xml', 'utf8'), { xml: true });
  assert.equal($('item').length, posts.length);
  const react = load(readFileSync('dist/tags/react/index.xml', 'utf8'), { xml: true });
  assert.equal(react('item').length, posts.filter(({ data }) => data.tags?.includes('React')).length);
  assert.equal($('item link').toArray().some((node) => $(node).text().includes('zenn.dev')), false);
});

test('taxonomy links and the sitemap point at generated pages', () => {
  const $ = page('tags/index.html');
  for (const a of $('.term-list a').toArray()) assert.ok(existsSync(`dist${decodeURI($(a).attr('href'))}index.html`));
  const sitemap = load(readFileSync('dist/sitemap-0.xml', 'utf8'), { xml: true });
  const urls = sitemap('loc').map((_, node) => sitemap(node).text()).get();
  for (const { id } of posts) assert.ok(urls.includes(`https://blog.da1chi.net/posts/${id}/`));
  assert.equal(urls.some((url) => url.includes('/404')), false);
  assert.ok(existsSync('dist/categories/dev/index.html'));
});
