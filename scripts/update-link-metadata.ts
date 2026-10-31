import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { rehypeLinkMetadata, validateLinkMetadata } from '../src/lib/markdown/link-metadata.ts';
import { pageMetadata, fetchResource } from './lib/link-metadata.ts';

const metadataPath = 'content/link-metadata.json';
const metadata = validateLinkMetadata(JSON.parse(await readFile(metadataPath, 'utf8')));
const urls = new Set<string>();
const renderer = await createMarkdownProcessor({ syntaxHighlight: false, rehypePlugins: [[rehypeLinkMetadata, { onLink: (url: string) => urls.add(url) }]] });
for (const file of (await readdir('content/ja/posts')).filter(name => name.endsWith('.md')).sort()) {
  const raw = await readFile(`content/ja/posts/${file}`, 'utf8');
  await renderer.render(raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, ''));
}
let failures = 0;
const queue = [...urls].sort();
await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
  while (queue.length) {
    const url = queue.shift()!;
    try {
      const response = await fetchResource(url, 2 * 1024 * 1024);
      if (response.type !== 'text/html' && response.type !== 'application/xhtml+xml') throw new Error('Not an HTML page');
      const page = pageMetadata(response.data.toString('utf8'), response.url);
      const savedIcon = page.icons[0] ?? metadata[url]?.icon;
      metadata[url] = { title: page.title, ...(savedIcon ? { icon: savedIcon } : {}) };
      console.log(`Updated: ${url}`);
    } catch (error) {
      failures++;
      console.warn(`Kept existing metadata or original link: ${url} (${error instanceof Error ? error.message : String(error)})`);
    }
  }
}));
await writeFile(metadataPath, `${JSON.stringify(Object.fromEntries(Object.entries(metadata).sort(([a], [b]) => a.localeCompare(b))), null, 2)}\n`);
console.log(`${urls.size} destinations; ${failures} could not be refreshed.`);
if (failures) process.exitCode = 1;
