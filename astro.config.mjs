import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import remarkBreaks from 'remark-breaks';
import { unified, rehypeHeadingIds } from '@astrojs/markdown-remark';
import { site } from './src/site.ts';
import { fileURLToPath } from 'node:url';
import { buildSearch } from './scripts/build-search.ts';
import linkMetadata from './content/link-metadata.json' with { type: 'json' };
import { rehypeLinkMetadata, validateLinkMetadata } from './src/lib/markdown/link-metadata.ts';

export default defineConfig({
  site: site.url,
  output: 'static',
  adapter: cloudflare({ prerenderEnvironment: 'node', imageService: 'passthrough' }),
  session: false,
  publicDir: './static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [react(), sitemap(), {
    name: 'pagefind',
    hooks: {
      'astro:build:done': async ({ dir }) => buildSearch(fileURLToPath(dir)),
    },
  }],
  markdown: {
    processor: unified({ remarkPlugins: [remarkBreaks], rehypePlugins: [rehypeHeadingIds, [rehypeLinkMetadata, { metadata: validateLinkMetadata(linkMetadata) }]] }),
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false },
  },
});
