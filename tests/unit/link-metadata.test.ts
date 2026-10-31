import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMarkdownProcessor, rehypeHeadingIds } from '@astrojs/markdown-remark';
import { load } from 'cheerio';
import { linkKey, rehypeLinkMetadata, validateLinkMetadata } from '../../src/lib/markdown/link-metadata.ts';
import { pageMetadata, fetchResource } from '../../scripts/lib/link-metadata.ts';

const destination = 'https://example.com/page';
const metadata = { [destination]: { title: 'Page title <b>is text</b>', icon: '/link-icons/0123456789abcdef0123.png' } };
async function render(markdown: string, data = metadata) {
  const processor = await createMarkdownProcessor({ syntaxHighlight: false, rehypePlugins: [rehypeHeadingIds, [rehypeLinkMetadata, { metadata: data }]] });
  return load((await processor.render(markdown)).code);
}

test('enhances inline, standalone, bare and reference links without changing their destinations', async () => {
  const $ = await render(`文章中の[API名](${destination}#method)です。\n\n- [参考](${destination})\n\n<${destination}>\n\n[ref][page]\n\n[page]: ${destination}`);
  assert.equal($('a.link-with-metadata').length, 4);
  assert.equal($('a').first().attr('href'), `${destination}#method`);
  assert.equal($('a').first().text().trim(), metadata[destination].title);
  assert.equal($('a b').length, 0);
  assert.equal($('a img').first().attr('alt'), '');
  assert.equal($('a img').first().attr('aria-hidden'), 'true');
});

test('keeps text when metadata is unavailable and leaves images, anchors and code untouched', async () => {
  const $ = await render(`- [元の説明](https://unknown.example/)\n\n[章](#section)\n\n[![画像](/image.png)](${destination})\n\n\`[code](${destination})\`\n\n\`\`\`md\n[code](${destination})\n\`\`\``);
  assert.equal($('a.link-with-metadata').length, 1);
  assert.equal($('a.link-with-metadata').text().trim(), '元の説明');
  assert.equal($('a.link-with-metadata img').attr('src'), '/link-icons/default.svg');
  assert.equal($('a[href="#section"]').text(), '章');
  assert.equal($('a[href="https://example.com/page"] img').attr('src'), '/image.png');
  assert.equal($('code img').length, 0);
});

test('preserves the original heading anchors even when a linked heading gets a page title', async () => {
  const $ = await render(`## [Original](${destination})\n\n## [Original](${destination})`);
  assert.deepEqual($('h2').map((_, node) => $(node).attr('id')).get(), ['original', 'original-1']);
  assert.equal($('h2 a').first().text().trim(), metadata[destination].title);
});

test('validates local metadata and normalizes fragments without accepting executable destinations', () => {
  assert.equal(linkKey(`${destination}#anchor`), destination);
  assert.equal(linkKey('javascript:alert(1)'), null);
  assert.equal(linkKey('mailto:me@example.com'), null);
  assert.equal(linkKey('#part'), null);
  assert.equal(validateLinkMetadata(metadata), metadata);
  assert.throws(() => validateLinkMetadata({ [destination]: { title: '', icon: '/link-icons/a.svg' } }));
  assert.throws(() => validateLinkMetadata({ [destination]: { title: 'Title', icon: 'https://tracker.example/icon' } }));
});

test('extracts titles and icons using the final page URL and decodes HTML entities', () => {
  assert.deepEqual(pageMetadata('<title>fallback</title><meta property="og:title" content="A &amp; B"><link rel="shortcut icon" href="../icon.png">', 'https://example.com/docs/page'), { title: 'A & B', icons: ['https://example.com/icon.png', 'https://example.com/favicon.ico'] });
  assert.throws(() => pageMetadata('<title>Just a moment...</title>', destination));
});

test('refresh requests follow bounded redirects and report failures instead of caching error pages', async () => {
  const visited: string[] = [];
  const fetcher = (async (url: string) => {
    visited.push(url);
    return visited.length === 1 ? new Response(null, { status: 302, headers: { location: '/final' } }) : new Response('<title>Final</title>', { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }) as typeof fetch;
  const result = await fetchResource(destination, 100, fetcher);
  assert.deepEqual(visited, [destination, 'https://example.com/final']);
  assert.equal(result.type, 'text/html');
  await assert.rejects(fetchResource(destination, 3, (async () => new Response('too big')) as typeof fetch), /too large/);
  await assert.rejects(fetchResource(destination, 100, (async () => new Response('blocked', { status: 403 })) as typeof fetch), /HTTP 403/);
  await assert.rejects(fetchResource(destination, 100, (async () => { throw new Error('timeout'); }) as typeof fetch), /timeout/);
});
