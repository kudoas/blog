import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
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
const extension: Record<string, string> = { 'image/png': 'png', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico', 'image/svg+xml': 'svg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/jpeg': 'jpg' };
await mkdir('static/link-icons', { recursive: true });
const icons = new Map<string, Promise<string | undefined>>();
function cacheIcon(url: string) {
  if (!icons.has(url)) icons.set(url, (async () => {
    try {
      const resource = await fetchResource(url, 512 * 1024);
      const ext = resource.type && extension[resource.type];
      if (!ext || resource.data.length === 0) return;
      const file = `${createHash('sha256').update(url).digest('hex').slice(0, 20)}.${ext}`;
      await writeFile(`static/link-icons/${file}`, resource.data);
      return `/link-icons/${file}`;
    } catch { return; }
  })());
  return icons.get(url)!;
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
      let icon: string | undefined;
      for (const candidate of page.icons.slice(0, 3)) {
        icon = await cacheIcon(candidate);
        if (icon) break;
      }
      const savedIcon = icon ?? metadata[url]?.icon;
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
