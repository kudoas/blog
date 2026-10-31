import { defineConfig } from 'cf/config';

export default defineConfig({
  worker: {
    name: 'tech-blog',
    compatibilityDate: '2026-09-25',
    previewUrls: true,
    assets: {
      htmlHandling: 'force-trailing-slash',
      notFoundHandling: '404-page',
    },
  },
});
