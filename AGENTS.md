# Repository Guidelines

Please answer concisely and politely in Japanese with emoji.

## Structure

- `content/ja/posts/` contains Markdown posts; keep existing bodies and slugs intact.
- `content/external.yaml` contains manually curated external articles, including Zenn.
- `src/content.config.ts` validates both collections; `src/lib/` prepares summary data.
- `src/pages/` and `src/layouts/` render static Astro pages. React is limited to
  interactive search and filtering in `src/components/`.
- `src/styles/global.css` owns the one-column dark blue design. `static/` preserves
  existing public image URLs. `.cloudflare/output/v0/` is generated build output.
- `cloudflare.config.ts` configures Cloudflare Workers Static Assets.
  The Astro Cloudflare adapter produces an assets-only deployment.
  `static/_redirects` preserves legacy routes.

## Development

- `bun install --frozen-lockfile` installs dependencies.
- `bun run dev` starts the Astro preview at `http://localhost:4321`.
- `bun run verify` runs textlint, TypeScript 7, unit tests, the
  production build, and generated-site tests.
- `bun run test:e2e` checks the browser flows using installed Chrome.
- `bun run build` builds the site and Pagefind index through `cf`.
- Use `bun x cf` for Cloudflare commands. Run
  `bun x cf deploy --prebuilt --mode production --dry-run` after `bun run build`
  to validate deployment packaging without uploading.

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

## Autonomous tasks in the Dev Container

- See `docs/development/devcontainer.md` for authentication, execution, and recovery.
- The `blog-agent` controller creates a task worktree from the latest main. When
  invoked by that controller, reuse its worktree and branch; do not create another.
- Make routine decisions autonomously; do not ask for command approvals. Continue
  implementation and repair until verification succeeds.
- Implement and verify, leaving changes uncommitted for the controller. It commits
  only after independent verification, then pushes the task branch and creates a PR.
- Do not merge, push main, force-push, or deploy from the container. Cloudflare
  credentials remain in GitHub Actions.
