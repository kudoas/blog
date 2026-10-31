#!/usr/bin/env bash
set -euo pipefail
cd /workspaces/blog
if [[ ! -e .git ]]; then
  git clone --origin origin --branch "${BLOG_REF:-main}" https://github.com/kudoas/blog.git .
fi
# Never replace saved authentication or user configuration on rebuild.
if [[ ! -f "$CODEX_HOME/config.toml" ]]; then
  install -m 600 /usr/local/share/blog-devcontainer/codex.config.toml "$CODEX_HOME/config.toml"
fi
bun install --frozen-lockfile
printf '\nReady. First run: codex login --device-auth; gh auth login --hostname github.com --git-protocol https\n'
printf 'Set git user.name / user.email, then use: blog-agent TASK_ID TASK_FILE\n'
