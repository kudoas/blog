import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildHerbContent } from '../../scripts/export-herb-content.ts';

test('exports published article bodies and external records from the built site', async () => {
  const content = await buildHerbContent('dist');

  assert.equal(content.schemaVersion, 1);
  assert.equal(content.posts.length, 9);
  assert.equal(content.articles.length, 22);
  assert.equal(content.posts.find((post) => post.slug === 'func-error-boundary')?.title,
    'Error BoundaryをFunction Componentで扱う');
  assert.match(content.posts.find((post) => post.slug === 'func-error-boundary')?.bodyHtml ?? '', /<pre class="astro-code/);
  assert.equal(content.articles.find((article) => article.url.includes('zenn.dev'))?.kind, 'external');
  assert.equal(content.posts.some((post) => post.draft), false);
});
