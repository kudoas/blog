# Repository Guidelines

## Project Structure
- `content/` holds Markdown posts, `archetypes/` stores new-post templates, and `static/` plus `assets/` contain public images and social-card fonts.
- `layouts/` overrides the Zzo theme; add partials or CSS tweaks here when UI changes are needed.
- `config/` alongside `config.toml` captures Hugo configuration, `resources/` caches build artifacts, and `public/` contains generated output.
- The root `Makefile` exposes Twitter card helpers, while `.textlintrc` and `node_modules/` define the textlint toolchain.

## Build, Test, and Development Commands
- `hugo server -D`: run a local preview including drafts at `http://localhost:1313`.
- `hugo --minify`: build the production site into `public/`.
- `npm run textlint`: lint all Markdown under `content/**` with Japanese technical-writing rules.
- `make tgen-all` / `make tgen-diff`: regenerate all Twitter cards or only ones touched since `HEAD`.

## Coding Style and Naming
- Markdown lines should wrap near 80 characters, and every front matter block must include `title`, `date`, `tags`, and `draft`.
- Save media as `static/assets/<category>/<slug>-<index>.png` and reference them via root-relative paths in posts.
- Follow kebab-case for layout filenames and CSS classes when overriding theme partials.
- Observe `.textlintrc` rules (e.g., `preset-ja-technical-writing`) to keep tone consistent and avoid mixed formality.

## Testing Guidelines
- Textlint is the only automated check; run `npm run textlint` before committing and fix warnings in the manuscript.
- For long posts or embedded tables, verify layout via `hugo server -D`; when updating OGP assets, include the `make tgen-diff` output in your PR notes.

## Commit and Pull Request Guidelines
- The history favors prefixed commit messages such as `fix: <scope>`; use `feat: add <slug>` for new posts and `chore:` for configuration changes.
- PRs should describe purpose, key changes, related issues, and attach screenshots or card previews for UI/OGP updates.
- Share any external preview URL (e.g., Netlify) and list review focuses (content, layout, config) to streamline feedback.
