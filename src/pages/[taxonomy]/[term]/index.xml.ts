import rss from '@astrojs/rss';
import { getArticles, getPosts } from '../../../lib/content';
import { collectTerms, tagSlug } from '../../../lib/articles';
import { site } from '../../../site';
import type { APIRoute } from 'astro';

export async function getStaticPaths() {
  const articles = await getArticles();
  return (['tags', 'categories'] as const).flatMap((taxonomy) =>
    collectTerms(articles, taxonomy).map(({ slug, label }) => ({ params: { taxonomy, term: slug }, props: { label } })),
  );
}

export const GET: APIRoute = async ({ params, props }) => {
  const field = params.taxonomy as 'tags' | 'categories';
  const posts = (await getPosts(false)).filter(({ data }) => data[field].some((term) => tagSlug(term) === params.term));
  return rss({
    title: `${props.label} | ${site.title}`,
    description: site.description,
    site: site.url,
    items: posts.map(({ id, data }) => ({ title: data.title, pubDate: data.date, description: data.description, link: `/posts/${id}/` })),
    customData: '<language>ja</language>',
  });
};
