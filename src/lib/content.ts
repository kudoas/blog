import { getCollection } from 'astro:content';
import { buildArticleIndex } from './articles';

export async function getPosts(includeDrafts = import.meta.env.DEV) {
  return (await getCollection('posts'))
    .filter(({ data }) => includeDrafts || !data.draft)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime() || a.id.localeCompare(b.id));
}

export async function getArticles() {
  const [posts, external] = await Promise.all([getPosts(), getCollection('external')]);
  return buildArticleIndex(posts, external.map(({ data }) => data), import.meta.env.DEV);
}
