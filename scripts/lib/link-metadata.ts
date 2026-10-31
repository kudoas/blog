import { load } from 'cheerio';
import { linkKey } from '../../src/lib/markdown/link-metadata.ts';

export function pageMetadata(html: string, pageUrl: string) {
  const $ = load(html);
  const title = ($('meta[property="og:title"]').first().attr('content') || $('title').first().text()).replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!title || /^(just a moment|access denied|attention required|403 forbidden)/i.test(title)) throw new Error('No usable page title');
  const icons = $('link[rel]').toArray().filter(el => ($(el).attr('rel') ?? '').toLowerCase().split(/\s+/).includes('icon'))
    .map(el => $(el).attr('href')).filter((href): href is string => Boolean(href))
    .map(href => linkKey(href, pageUrl)).filter((href): href is string => Boolean(href && new URL(href).protocol === 'https:'));
  const fallback = new URL('/favicon.ico', pageUrl);
  return { title, icons: [...new Set([...icons, ...(fallback.protocol === 'https:' ? [fallback.href] : [])])] };
}

export async function fetchResource(url: string, maximum: number, fetcher: typeof fetch = fetch) {
  let current = url;
  for (let redirects = 0; redirects <= 5; redirects++) {
    const target = new URL(current);
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || /^(localhost|127\.|\[?::1\]?)/i.test(target.hostname)) throw new Error('Unsupported metadata URL');
    const response = await fetcher(current, { redirect: 'manual', signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'daichi-tech-link-metadata/1.0' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) throw new Error('Redirect without location');
      current = new URL(location, current).href;
      continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}`); }
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (!response.body) throw new Error('Empty response');
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > maximum) throw new Error('Metadata response too large');
      chunks.push(chunk);
    }
    return { url: current, type: response.headers.get('content-type')?.split(';')[0].trim().toLowerCase(), data: Buffer.concat(chunks) };
  }
  throw new Error('Too many redirects');
}
