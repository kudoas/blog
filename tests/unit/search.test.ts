import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createArticleSearch } from '../../src/lib/search.ts';
import { buildArticleIndex } from '../../src/lib/articles.ts';

const articles = buildArticleIndex([], [{
  id: 'example', title: 'Example', url: 'https://example.com/article',
  date: new Date('2026-01-01'), tags: ['React'], categories: [], source: 'Example', description: '',
}]);

test('keeps each query with its excerpts and preserves search order', async () => {
  let queryState = '';
  const seen: string[] = [];
  const search = createArticleSearch(async () => ({
    async search(query, options) {
      queryState = query;
      seen.push(query);
      assert.deepEqual(options.filters, { tag: 'react' });
      return { results: [{ async data() {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { url: articles[0].url, excerpt: queryState };
      } }] };
    },
  }));
  const [first, second] = await Promise.all([
    search(articles, 'Ｆｉｇｍａ', 'Ｒｅａｃｔ'), search(articles, 'Renovate', 'React'),
  ]);
  assert.deepEqual(seen, ['figma', 'renovate']);
  assert.equal(first[0].excerpt, 'figma');
  assert.equal(second[0].excerpt, 'renovate');
  assert.equal(first[0].article, articles[0]);
});

test('can search again after a failed load and ignores records absent from the article list', async () => {
  let attempts = 0;
  const search = createArticleSearch(async () => {
    if (++attempts === 1) throw new Error('offline');
    return { async search() { return { results: [
      { async data() { return { url: '/unknown/', excerpt: 'unknown' }; } },
      { async data() { return { url: articles[0].url, excerpt: 'found' }; } },
    ] }; } };
  });
  await assert.rejects(search(articles, 'first', ''), /offline/);
  assert.deepEqual(await search(articles, 'second', ''), [{ article: articles[0], excerpt: 'found' }]);
});
