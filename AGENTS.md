# Repository Guidelines

Please answer concisely and politely in Japanese with emoji.

## Structure

- `content/ja/posts/` contains Markdown posts; keep existing bodies and slugs intact.
- `content/external.yaml` contains manually curated external articles, including Zenn.
- `src/content.config.ts` validates both collections; `src/lib/` prepares summary data.
- `src/pages/` and `src/layouts/` render static Astro pages. React is limited to
  interactive search and filtering in `src/components/`.
- `src/styles/global.css` owns the one-column dark blue design. `static/` preserves
  existing public image URLs. `dist/` is generated output.
- `wrangler.jsonc` configures Cloudflare Workers Static Assets; `static/_redirects`
  preserves legacy routes.

## Development

- `bun install --frozen-lockfile` installs dependencies.
- `bun run dev` starts the Astro preview at `http://localhost:4321`.
- `bun run verify` runs textlint, TypeScript 7, unit tests, the
  production build, and generated-site tests.
- `bun run test:e2e` checks the browser flows using installed Chrome.

## Content and naming

- New posts require `title`, `date`, `tags`, and `draft` in front matter. Historical
  posts without `draft` default to published. Preserve existing `/posts/<slug>/` URLs.
- Use root-relative paths to images under `static/`; do not rename existing images.
- External items require unique kebab-case `id`, `title`, HTTPS `url`, `date`, and
  `source`. Optional `tags`, `categories`, and `description` support other sites.
- Keep layout filenames and CSS classes in kebab-case. Follow `.textlintrc` for prose.

## Validation and changes

- Run `bun run verify` before committing and browser tests for UI work.
- Keep tests about observable behavior, including route and asset compatibility.
- Preserve unrelated work. Stage only intended files. Commit locally after checks;
  do not push without an explicit request.
