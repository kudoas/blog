#!/usr/bin/env sh
set -eu
if [ ! -f /etc/blog-devcontainer ]; then
  echo 'codex-auto must run inside the blog Dev Container.' >&2
  exit 1
fi
exec codex --ask-for-approval never --sandbox danger-full-access "$@"
