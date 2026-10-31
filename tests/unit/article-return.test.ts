import assert from 'node:assert/strict';
import { test } from 'node:test';
import { articleReturnLink } from '../../src/lib/article-return.ts';

const origin = 'https://blog.da1chi.net';
const taxonomies = ['/tags/react/', '/categories/dev/'];

test('returns to same-origin search with only supported conditions', () => {
  assert.deepEqual(articleReturnLink(`${origin}/?q=Figma&tag=react&tracking=ignored#main`, origin, taxonomies), {
    href: '/?q=Figma&tag=react', label: '検索結果',
  });
  assert.deepEqual(articleReturnLink(`${origin}/?tag=react`, origin, taxonomies), { href: '/?tag=react', label: '検索結果' });
});

test('only accepts known taxonomy listings for this article', () => {
  assert.deepEqual(articleReturnLink(`${origin}/tags/react/?tracking=ignored`, origin, taxonomies), {
    href: '/tags/react/', label: 'タグの記事一覧',
  });
  assert.deepEqual(articleReturnLink(`${origin}/categories/dev/`, origin, taxonomies), {
    href: '/categories/dev/', label: 'カテゴリの記事一覧',
  });
  for (const path of ['/tags/missing/', '/tags/', '/posts/sort/', '/404.html']) {
    assert.equal(articleReturnLink(`${origin}${path}`, origin, taxonomies), null);
  }
});

test('falls back for direct visits, external origins, credentials and unsupported URLs', () => {
  for (const referrer of ['', '/', `${origin}/`, `${origin}/?tracking=ignored`,
    'https://example.com/?q=Figma', 'http://blog.da1chi.net/?q=Figma',
    'javascript:alert(1)', 'https://name@blog.da1chi.net/?q=Figma']) {
    assert.equal(articleReturnLink(referrer, origin, taxonomies), null, referrer);
  }
});
