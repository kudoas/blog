import rss from '@astrojs/rss';
import { getPosts } from '../lib/content';
import { site } from '../site';

export async function GET() {
  const posts = await getPosts(false);
  return rss({
    title: site.title,
    description: site.description,
    site: site.url,
    items: posts.map(({ id, data }) => ({ title: data.title, pubDate: data.date, description: data.description, link: `/posts/${id}/` })),
    customData: '<language>ja</language>',
  });
}
