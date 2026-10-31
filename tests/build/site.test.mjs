import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { posts, external } from '../fixtures/content.ts';

const output = '.cloudflare/output/v0/workers/default/assets';

const page = (path) => load(readFileSync(`${output}/${path}`, 'utf8'));

test('packages an assets-only Worker with search and legacy redirects', () => {
  const config = JSON.parse(readFileSync('.cloudflare/output/v0/workers/default/worker.config.json', 'utf8'));
  const root = JSON.parse(readFileSync('.cloudflare/output/v0/config.json', 'utf8'));
  assert.equal(config.name, 'tech-blog');
  assert.equal(config.assets.htmlHandling, 'force-trailing-slash');
  assert.equal(config.assets.notFoundHandling, '404-page');
  assert.equal(root.buildContext.isPreview, false);
  assert.equal(root.buildContext.mode, 'production');
  assert.equal(config.manifest, undefined);
  assert.equal(existsSync('.cloudflare/output/v0/workers/default/bundle'), false);
  assert.deepEqual(Object.values(config.env).map(({ type }) => type), ['assets']);
  assert.equal(readFileSync(`${output}/_redirects`, 'utf8'), readFileSync('static/_redirects', 'utf8'));
  assert.ok(existsSync(`${output}/pagefind/pagefind.js`));
});

test('all published local and external entries appear in prerendered HTML', () => {
  const $ = page('index.html');
  assert.equal($('.article-list > li').length, posts.length + external.length);
  const links = $('.article-summary h3 a').map((_, a) => $(a).attr('href')).get();
  for (const { id } of posts) assert.ok(links.includes(`/posts/${id}/`), id);
  for (const { url } of external) assert.ok(links.includes(url), url);
  const dates = $('.article-date').map((_, time) => Date.parse($(time).attr('datetime'))).get();
  assert.deepEqual(dates, [...dates].sort((a, b) => b - a));
});

test('ships the search bundle and restricts local indexing to article content', () => {
  assert.ok(existsSync(`${output}/pagefind/pagefind.js`));
  assert.equal(page('index.html')('[data-pagefind-body]').length, 0);
  for (const { id } of posts) {
    const $ = page(`posts/${id}/index.html`);
    assert.equal($('h1[data-pagefind-body]').length, 1);
    assert.equal($('.prose[data-pagefind-body]').length, 1);
    assert.equal($('.toc [data-pagefind-body], .post-end [data-pagefind-body], .site-header [data-pagefind-body]').length, 0);
    for (const tag of $('.post-tags a').toArray()) {
      assert.equal($(tag).attr('data-pagefind-filter'), 'tag[data-search-tag]');
    }
  }
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
    assert.ok(existsSync(`${output}${new URL(image).pathname}`));
    for (const a of $('.toc a').toArray()) {
      const fragment = $(a).attr('href').slice(1);
      assert.ok($('[id]').toArray().some((heading) => $(heading).attr('id') === fragment), fragment);
    }
    for (const img of $('.prose img').toArray()) {
      const url = new URL($(img).attr('src'), 'https://blog.da1chi.net');
      if (url.host === 'blog.da1chi.net') assert.ok(existsSync(`${output}${url.pathname}`), url.pathname);
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
  const $ = load(readFileSync(`${output}/index.xml`, 'utf8'), { xml: true });
  assert.equal($('item').length, posts.length);
  const react = load(readFileSync(`${output}/tags/react/index.xml`, 'utf8'), { xml: true });
  assert.equal(react('item').length, posts.filter(({ data }) => data.tags?.includes('React')).length);
  assert.equal($('item link').toArray().some((node) => $(node).text().includes('zenn.dev')), false);
});

test('taxonomy links and the sitemap point at generated pages', () => {
  const $ = page('tags/index.html');
  for (const a of $('.term-list a').toArray()) assert.ok(existsSync(`${output}${decodeURI($(a).attr('href'))}index.html`));
  const sitemap = load(readFileSync(`${output}/sitemap-0.xml`, 'utf8'), { xml: true });
  const urls = sitemap('loc').map((_, node) => sitemap(node).text()).get();
  for (const { id } of posts) assert.ok(urls.includes(`https://blog.da1chi.net/posts/${id}/`));
  assert.equal(urls.some((url) => url.includes('/404')), false);
  assert.ok(existsSync(`${output}/categories/dev/index.html`));
});

test('legacy public assets remain available at their original paths', () => {
  for (const path of [
    'assets/font/KintoSans-Regular.ttf',
    'assets/iconfont/iconfont.woff2',
    'gallery/photo/beach.jpg',
    'images/header/background.jpg',
    'manifest.json',
  ]) {
    assert.ok(existsSync(`${output}/${path}`), path);
  }
});


test('published posts connect comments and reactions to their canonical article path', () => {
  for (const { id } of posts) {
    const $ = page(`posts/${id}/index.html`);
    const section = $('#comments');
    const client = section.find('script[src="https://giscus.app/client.js"]');
    assert.equal(section.length, 1);
    assert.equal(section.attr('aria-labelledby'), 'comments-heading');
    assert.equal(section.find('h2').text(), 'コメント・リアクション');
    assert.equal(client.length, 1);
    assert.equal(client.attr('data-repo'), 'kudoas/blog');
    assert.equal(client.attr('data-repo-id'), 'MDEwOlJlcG9zaXRvcnkzMDgxODE2MTY=');
    assert.equal(client.attr('data-category-id'), 'DIC_kwDOEl56cM4DKE7U');
    assert.equal(client.attr('data-mapping'), 'specific');
    assert.equal(client.attr('data-term'), `/posts/${id}/`);
    assert.equal(client.attr('data-strict'), '1');
    assert.equal(client.attr('data-reactions-enabled'), '1');
    assert.equal(client.attr('data-input-position'), 'top');
    assert.equal(client.attr('data-lang'), 'ja');
    assert.equal(client.attr('data-loading'), 'lazy');
    assert.equal(client.attr('data-theme'), 'preferred_color_scheme');
    assert.equal($('meta[name="giscus:backlink"]').attr('content'), `https://blog.da1chi.net/posts/${id}/`);
    const fallback = new URL(section.find('a').attr('href'));
    assert.equal(fallback.origin, 'https://github.com');
    assert.equal(fallback.pathname, '/kudoas/blog/discussions');
    assert.equal(fallback.searchParams.get('discussions_q'), `category:Announcements "/posts/${id}/"`);
    assert.equal(section.parents('[data-pagefind-body]').length, 0);
    assert.equal(section.find('[data-pagefind-body]').length, 0);
    assert.notEqual(section.attr('data-pagefind-ignore'), undefined);
  }
});

test('article discussion integration is absent on listing and error pages', () => {
  for (const path of ['index.html', 'tags/index.html', 'categories/index.html', '404.html']) {
    const $ = page(path);
    assert.equal($('#comments').length, 0);
    assert.equal($('script[src="https://giscus.app/client.js"]').length, 0);
    assert.equal($('meta[name="giscus:backlink"]').length, 0);
  }
});
