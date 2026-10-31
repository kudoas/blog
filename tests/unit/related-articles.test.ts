import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ArticleSummary } from '../../src/lib/articles.ts';
import { relatedArticles } from '../../src/lib/related-articles.ts';

const site = 'https://blog.example/';
const current = { id: 'local:current', url: '/posts/current/', tags: ['React', 'TypeScript'] };
const article = (id: string, tags: string[], overrides: Partial<ArticleSummary> = {}): ArticleSummary => ({
  id: `local:${id}`, url: `/posts/${id}/`, title: id, kind: 'local', date: '2026-01-01T00:00:00Z',
  tags, categories: [], source: 'このブログ', description: '', draft: false, ...overrides,
});

test('ranks shared unique normalized tags before date and resolves ties consistently', () => {
  const items = [
    article('newer', ['React'], { date: '2026-03-01T00:00:00Z' }),
    article('two', ['ｒｅａｃｔ', 'typescript', 'React']),
    article('z', ['React']), article('a', ['React']), article('unrelated', ['Ruby']),
  ];
  assert.deepEqual(relatedArticles(current, items, site).map((a) => a.id), ['local:two', 'local:newer', 'local:a']);
  assert.deepEqual(items.map((a) => a.title), ['newer', 'two', 'z', 'a', 'unrelated']);
});

test('excludes self, aliases of self, drafts and repeated destinations while allowing external sources', () => {
  const items = [
    article('current', ['React']), article('alias', ['React'], { url: 'https://blog.example/posts/current/#heading' }),
    article('draft', ['React'], { draft: true }), article('local', ['React']),
    article('alias-local', ['React'], { url: 'https://blog.example/posts/local/#heading' }),
    article('external', ['TypeScript'], { id: 'external:outside', kind: 'external', url: 'https://example.com/outside', source: 'Zenn' }),
  ];
  const found = relatedArticles(current, items, site);
  assert.equal(found.length, 2);
  assert.ok(found.some((a) => a.kind === 'external'));
  assert.equal(new Set(found.map((a) => new URL(a.url, site).href)).size, 2);
});

test('omits unrelated suggestions for untagged articles and respects an explicit limit', () => {
  const items = [article('one', ['React']), article('two', ['React'])];
  assert.deepEqual(relatedArticles({ ...current, tags: [] }, items, site), []);
  assert.deepEqual(relatedArticles(current, [article('ruby', ['Ruby'])], site), []);
  assert.equal(relatedArticles(current, items, site, 1).length, 1);
  assert.deepEqual(relatedArticles(current, items, site, 0), []);
});
