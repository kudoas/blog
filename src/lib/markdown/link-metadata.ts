export interface LinkMetadata { title: string; icon?: string }
export type LinkMetadataIndex = Record<string, LinkMetadata>;
interface HtmlNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HtmlNode[];
}

export function linkKey(href: string, base = 'https://blog.da1chi.net/'): string | null {
  if (href.startsWith('#')) return null;
  try {
    const url = new URL(href, base);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}

export function validateLinkMetadata(input: unknown): LinkMetadataIndex {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid link metadata');
  for (const [url, entry] of Object.entries(input)) {
    if (linkKey(url) !== url || !entry || typeof entry !== 'object') throw new Error(`Invalid link metadata: ${url}`);
    const { title, icon } = entry as LinkMetadata;
    if (typeof title !== 'string' || !title.trim() || title.length > 300) throw new Error(`Invalid link title: ${url}`);
    if (icon !== undefined && (typeof icon !== 'string' || !/^\/link-icons\/[a-f0-9]{20}\.(png|ico|svg|webp|gif|jpg)$/.test(icon))) throw new Error(`Invalid link icon: ${url}`);
  }
  return input as LinkMetadataIndex;
}

export function rehypeLinkMetadata(options: { metadata?: LinkMetadataIndex; onLink?: (url: string) => void } = {}) {
  const metadata = options.metadata ?? {};
  const containsImage = (node: HtmlNode): boolean => node.tagName === 'img' || Boolean(node.children?.some(containsImage));
  return (tree: HtmlNode) => {
    function walk(node: HtmlNode) {
      if (node.tagName === 'a' && typeof node.properties?.href === 'string') {
        // Linked images remain images. Code fences do not contain anchor nodes.
        if (node.children?.some(containsImage)) return;
        const key = linkKey(node.properties.href);
        if (!key) return;
        options.onLink?.(key);
        const entry = metadata[key];
        const original = node.children ?? [];
        node.properties.className = [...(Array.isArray(node.properties.className) ? node.properties.className : []), 'link-with-metadata'];
        node.children = [
          { type: 'element', tagName: 'img', properties: {
            src: entry?.icon ?? '/link-icons/default.svg', alt: '', width: 16, height: 16,
            className: ['link-favicon'], loading: 'lazy', decoding: 'async', ariaHidden: 'true',
          }, children: [] },
          { type: 'text', value: ' ' },
          ...(entry ? [{ type: 'text', value: entry.title }] : original),
        ];
        return;
      }
      for (const child of node.children ?? []) walk(child);
    }
    walk(tree);
  };
}
