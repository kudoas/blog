import { normalizeText, tagSlug } from './articles.ts';
import type { ArticleSummary } from './articles.ts';

export interface SearchHit { article: ArticleSummary; excerpt: string }
interface SearchIndex {
  search(query: string, options: { filters: Record<string, string> }): Promise<{
    results: { data(): Promise<{ url: string; excerpt: string }> }[];
  }>;
}

// Pagefind's excerpt generation shares query state. Keep each search and its
// result loading together, even when a newer input arrives while loading.
export function createArticleSearch(load: () => Promise<SearchIndex>) {
  let queue: Promise<unknown> = Promise.resolve();
  return (articles: ArticleSummary[], query: string, tag: string): Promise<SearchHit[]> => {
    const task = queue.then(async () => {
      const index = await load();
      const result = await index.search(normalizeText(query), {
        filters: tag ? { tag: tagSlug(tag) } : {},
      });
      const data = await Promise.all(result.results.map((item) => item.data()));
      const byUrl = new Map(articles.map((article) => [article.url, article]));
      return data.flatMap(({ url, excerpt }) => {
        const article = byUrl.get(url);
        return article ? [{ article, excerpt }] : [];
      });
    });
    queue = task.catch(() => undefined);
    return task;
  };
}

let modulePromise: Promise<SearchIndex> | undefined;
export const searchArticles = createArticleSearch(() => {
  const url = '/pagefind/pagefind.js';
  modulePromise ??= import(/* @vite-ignore */ url).catch((error) => {
    modulePromise = undefined;
    throw error;
  });
  return modulePromise;
});
