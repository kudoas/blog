import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildArticleIndex, filterArticles, tagSlug, formatDate } from '../../src/lib/articles.ts';
import { postSchema, externalArticlesSchema } from '../../src/lib/content-schema.ts';

const local = (id: string, overrides = {}) => ({
  id,
  data: postSchema.parse({ title: 'React の記事', date: '2020-10-09T09:43:00+09:00', tags: ['React'], ...overrides }),
});
const external = externalArticlesSchema.parse([
  { id: 'outside', title: 'Angular 入門', date: '2025-12-07T12:25:22+09:00', source: '個人ブログ', url: 'https://example.com/articles/angular', tags: ['Angular'] },
]);

test('merges any external source with local posts in descending publication order', () => {
  const articles = buildArticleIndex([local('func-error-boundary')], external);
  assert.deepEqual(articles.map(({ id, kind, url }) => ({ id, kind, url })), [
    { id: 'external:outside', kind: 'external', url: 'https://example.com/articles/angular' },
    { id: 'local:func-error-boundary', kind: 'local', url: '/posts/func-error-boundary/' },
  ]);
  assert.equal(articles[0].source, '個人ブログ');
  assert.equal(articles[1].date, '2020-10-09T00:43:00.000Z');
});

test('omitted draft is published; an explicit draft only appears in preview', () => {
  const posts = [local('published'), local('hidden', { draft: true })];
  assert.deepEqual(buildArticleIndex(posts, []).map((p) => p.id), ['local:published']);
  assert.equal(buildArticleIndex(posts, [], true).length, 2);
});

test('rejects duplicate external identifiers before a loader can overwrite an entry', () => {
  assert.equal(externalArticlesSchema.safeParse([external[0], { ...external[0], url: 'https://example.com/other' }]).success, false);
});

test('rejects malformed dates, empty titles and executable external URLs', () => {
  for (const override of [{ date: 'invalid' }, { date: null }, { title: ' ' }, { url: 'javascript:alert(1)' }, { url: 'http://example.com/post' }]) {
    assert.equal(externalArticlesSchema.safeParse([{ ...external[0], ...override }]).success, false);
  }
  assert.equal(postSchema.safeParse({ title: '記事', date: null }).success, false);
});

test('prevents duplicate local slugs and external URLs from silently appearing twice', () => {
  assert.throws(() => buildArticleIndex([local('same'), local('same')], []), /Duplicate/);
  assert.equal(externalArticlesSchema.safeParse([external[0], { ...external[0], id: 'second' }]).success, false);
});

test('normalizes full-width letters and case while combining query and one tag', () => {
  const articles = buildArticleIndex([local('react'), local('hooks', { title: 'Hooks の使い方' })], external);
  assert.deepEqual(filterArticles(articles, ' ｒｅａｃｔ ', 'react').map((p) => p.id), ['local:hooks', 'local:react']);
  assert.equal(filterArticles(articles, 'React', 'angular').length, 0);
  assert.equal(filterArticles(articles, '見つからない', '').length, 0);
  assert.equal(filterArticles(articles, '', '').length, 3);
});

test('tag links retain existing ASCII routes and support Japanese tags', () => {
  assert.equal(tagSlug('Nodejs'), 'nodejs');
  assert.equal(tagSlug('styled-component'), 'styled-component');
  assert.equal(tagSlug('Web Components'), 'web-components');
  assert.equal(tagSlug('日本語'), '日本語');
});

test('dates use Japan time regardless of the machine timezone', () => {
  assert.equal(formatDate('2025-12-06T23:30:00Z'), '2025.12.07');
});
