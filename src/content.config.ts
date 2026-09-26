import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import type { Loader } from 'astro/loaders';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { externalArticleSchema, externalArticlesSchema, postSchema } from './lib/content-schema';

// Validate the entire file before storing entries, so duplicate IDs cannot be overwritten.
function externalArticles(): Loader {
  return {
    name: 'external-articles',
    async load({ store, parseData, watcher, config, logger }) {
      const file = fileURLToPath(new URL('./content/external.yaml', config.root));
      const sync = async () => {
        const articles = externalArticlesSchema.parse(parse(await readFile(file, 'utf8')));
        const entries = await Promise.all(articles.map(async (article) => ({
          id: article.id,
          data: await parseData({ id: article.id, data: article, filePath: file }),
          filePath: 'content/external.yaml',
        })));
        store.clear();
        for (const entry of entries) store.set(entry);
      };
      await sync();
      if (watcher) {
        watcher.add(file);
        const onChange = (changed: string) => {
          if (changed === file) void sync().catch((error) => logger.error(String(error)));
        };
        watcher.on('change', onChange);
        watcher.on('add', onChange);
        watcher.on('unlink', onChange);
      }
    },
  };
}

export const collections = {
  posts: defineCollection({
    loader: glob({ pattern: '*.md', base: './content/ja/posts', generateId: ({ entry }) => entry.replace(/\.md$/, '') }),
    schema: postSchema,
  }),
  external: defineCollection({ loader: externalArticles(), schema: externalArticleSchema }),
};
