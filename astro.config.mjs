import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import remarkBreaks from 'remark-breaks';
import { unified } from '@astrojs/markdown-remark';
import { site } from './src/site.ts';

export default defineConfig({
  site: site.url,
  output: 'static',
  publicDir: './static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [react(), sitemap()],
  markdown: {
    processor: unified({ remarkPlugins: [remarkBreaks] }),
    shikiConfig: { theme: 'github-dark' },
  },
});
