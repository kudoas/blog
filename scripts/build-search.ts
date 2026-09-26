import { readFile } from 'node:fs/promises';
import * as pagefind from 'pagefind';
import { parse } from 'yaml';
import { externalArticlesSchema } from '../src/lib/content-schema.ts';
import { tagSlug } from '../src/lib/articles.ts';

function check({ errors }: { errors: string[] }) {
  if (errors.length) throw new Error(errors.join('\n'));
}

try {
  const external = externalArticlesSchema.parse(parse(await readFile('content/external.yaml', 'utf8')));
  const created = await pagefind.createIndex();
  check(created);
  if (!created.index) throw new Error('Pagefind did not create an index');
  const { index } = created;
  const local = await index.addDirectory({ path: 'dist', glob: 'posts/*/index.html' });
  check(local);
  for (const article of external) {
    check(await index.addCustomRecord({
      url: article.url,
      language: 'ja',
      content: [article.title, ...article.tags, article.description].join('\n'),
      meta: { title: article.title },
      filters: { tag: article.tags.map(tagSlug) },
    }));
  }
  check(await index.writeFiles({ outputPath: 'dist/pagefind' }));
  console.log(`Pagefind: ${local.page_count} local and ${external.length} external articles indexed`);
} finally {
  await pagefind.close();
}
