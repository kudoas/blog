import type { ArticleSummary } from './articles.ts';
import { tagSlug } from './articles.ts';

/** Prefer shared topics, then newer articles; never repeat a destination. */
export function relatedArticles(
  current: Pick<ArticleSummary, 'id' | 'url' | 'tags'>,
  articles: readonly ArticleSummary[],
  siteUrl: string,
  limit = 3,
): ArticleSummary[] {
  const tags = new Set(current.tags.map(tagSlug).filter(Boolean));
  if (!tags.size || limit <= 0) return [];
  const destination = (value: string) => {
    const url = new URL(value, siteUrl);
    url.hash = '';
    return url.href;
  };
  const currentUrl = destination(current.url);
  const candidates = articles.filter((article) => !article.draft && article.id !== current.id)
    .map((article) => ({
      article,
      url: destination(article.url),
      shared: [...new Set(article.tags.map(tagSlug).filter(Boolean))].filter((tag) => tags.has(tag)).length,
    }))
    .filter(({ url, shared }) => url !== currentUrl && shared > 0)
    .sort((a, b) => b.shared - a.shared || Date.parse(b.article.date) - Date.parse(a.article.date) || a.article.id.localeCompare(b.article.id));
  const seen = new Set<string>();
  return candidates.filter(({ url }) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  }).slice(0, limit).map(({ article }) => article);
}
