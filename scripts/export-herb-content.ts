import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { load } from 'cheerio';
import { parse } from 'yaml';
import { buildArticleIndex, collectTerms } from '../src/lib/articles.ts';
import { externalArticlesSchema, postSchema } from '../src/lib/content-schema.ts';

function frontMatter(source: string, filename: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  if (!match) throw new Error(`Missing front matter: ${filename}`);
  return postSchema.parse(parse(match[1]));
}

export async function buildHerbContent(distDir: string) {
  const filenames = (await readdir('content/ja/posts')).filter((name) => name.endsWith('.md')).sort();
  const local = await Promise.all(filenames.map(async (filename) => ({
    id: filename.slice(0, -3),
    data: frontMatter(await readFile(join('content/ja/posts', filename), 'utf8'), filename),
  })));
  const external = externalArticlesSchema.parse(parse(await readFile('content/external.yaml', 'utf8')));
  const articles = buildArticleIndex(local, external);
  const posts = await Promise.all(local.filter(({ data }) => !data.draft).map(async ({ id, data }) => {
    const html = await readFile(join(distDir, 'posts', id, 'index.html'), 'utf8');
    const $ = load(html);
    const body = $('.prose[data-pagefind-body]');
    if (body.length !== 1) throw new Error(`Missing rendered article body: ${id}`);
    return {
      slug: id,
      ...data,
      date: data.date.toISOString(),
      bodyHtml: body.html() ?? '',
      headings: body.find('h2[id],h3[id]').map((_, heading) => ({
        depth: Number(heading.tagName.slice(1)),
        slug: $(heading).attr('id')!,
        text: $(heading).text(),
      })).get(),
    };
  }));
  const buildSha = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  return {
    schemaVersion: 1,
    buildSha,
    posts,
    articles,
    taxonomies: { tags: collectTerms(articles), categories: collectTerms(articles, 'categories') },
  };
}

if (import.meta.main) {
  const content = await buildHerbContent('dist');
  const target = 'experiments/herb/build/content.json';
  await mkdir('experiments/herb/build', { recursive: true });
  await writeFile(target, JSON.stringify(content));
  console.log(`Herb content: ${content.posts.length} posts, ${content.articles.length} articles`);
}
