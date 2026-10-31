import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import remarkBreaks from 'remark-breaks';
import { unified } from '@astrojs/markdown-remark';
import { site } from './src/site.ts';
import { fileURLToPath } from 'node:url';
import { buildSearch } from './scripts/build-search.ts';

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
    processor: unified({ remarkPlugins: [remarkBreaks] }),
    shikiConfig: { theme: 'github-dark' },
  },
});
