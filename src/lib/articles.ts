import type { ExternalArticle, PostData } from './content-schema.ts';

export interface ArticleSummary {
  id: string;
  kind: 'local' | 'external';
  title: string;
  url: string;
  date: string;
  tags: string[];
  categories: string[];
  source: string;
  description: string;
  draft: boolean;
}

export const normalizeText = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ja').trim();
export const tagSlug = (tag: string) => normalizeText(tag).replace(/\s+/g, '-');
export const tagUrl = (tag: string) => `/tags/${encodeURIComponent(tagSlug(tag))}/`;

export function buildArticleIndex(
  posts: { id: string; data: PostData }[],
  external: ExternalArticle[],
  includeDrafts = false,
): ArticleSummary[] {
  const items: ArticleSummary[] = [
    ...posts.filter(({ data }) => includeDrafts || !data.draft).map(({ id, data }) => ({
      id: `local:${id}`,
      kind: 'local' as const,
      title: data.title,
      url: `/posts/${id}/`,
      date: data.date.toISOString(),
      tags: data.tags,
      categories: data.categories,
      source: 'このブログ',
      description: data.description,
      draft: data.draft,
    })),
    ...external.map((data) => ({
      id: `external:${data.id}`,
      kind: 'external' as const,
      title: data.title,
      url: data.url,
      date: data.date.toISOString(),
      tags: data.tags,
      categories: data.categories,
      source: data.source,
      description: data.description,
      draft: false,
    })),
  ];
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`Duplicate article identifier: ${item.id}`);
    ids.add(item.id);
  }
  return items.sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.id.localeCompare(b.id));
}

export function filterArticles(items: ArticleSummary[], query: string, tag: string) {
  const search = normalizeText(query);
  const selectedTag = tagSlug(tag);
  return items.filter((item) =>
    (!search || normalizeText([item.title, ...item.tags].join(' ')).includes(search)) &&
    (!selectedTag || item.tags.some((value) => tagSlug(value) === selectedTag)),
  );
}

export function collectTerms(items: ArticleSummary[], field: 'tags' | 'categories' = 'tags') {
  const terms = new Map<string, { slug: string; label: string; count: number }>();
  for (const item of items) {
    for (const slug of new Set(item[field].map(tagSlug))) {
      const existing = terms.get(slug);
      if (existing) existing.count += 1;
      else terms.set(slug, { slug, label: item[field].find((value) => tagSlug(value) === slug)!, count: 1 });
    }
  }
  return [...terms.values()].sort((a, b) => a.label.localeCompare(b.label, 'ja'));
}

export function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value)).replaceAll('/', '.');
}
