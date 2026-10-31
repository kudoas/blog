FROM oven/bun:1.4.4 AS bun
FROM node:26.13.0-bookworm

ARG CODEX_VERSION=0.166.0
ARG GH_VERSION=2.103.3
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright \
    CODEX_HOME=/home/node/.codex \
    GH_CONFIG_DIR=/home/node/.config/gh \
    BLOG_AGENT_STATE=/home/node/.local/state/blog-agent

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git ripgrep jq tini libatomic1 \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global @openai/codex@${CODEX_VERSION}

# Debian bookworm's gh lacks JSON output for PR checks. Use a pinned upstream build.
RUN cd /tmp \
    && arch="$(dpkg --print-architecture)" \
    && curl -fsSLO "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_${arch}.tar.gz" \
    && curl -fsSLo gh-checksums.txt "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_checksums.txt" \
    && sha256sum --check --ignore-missing gh-checksums.txt \
    && tar -xzf "gh_${GH_VERSION}_linux_${arch}.tar.gz" \
    && install "gh_${GH_VERSION}_linux_${arch}/bin/gh" /usr/local/bin/gh \
    && rm -rf /tmp/gh_*

COPY package.json /tmp/blog-package/package.json
RUN cd /tmp/blog-package \
    && node -e 'const p=require("./package.json"); if (process.version !== `v${p.engines.node}` || require("node:child_process").execFileSync("bun", ["--version"], {encoding:"utf8"}).trim() !== p.packageManager.slice(4)) process.exit(1)' \
    && npx --yes --package="@playwright/test@$(node -p 'require("./package.json").devDependencies["@playwright/test"]')" playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/* /tmp/blog-package

COPY .devcontainer/bootstrap.sh .devcontainer/codex.config.toml /usr/local/share/blog-devcontainer/
COPY scripts/agent/ /usr/local/lib/blog-agent/
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx \
    && printf '#!/bin/sh\nexec node /usr/local/lib/blog-agent/run.mjs "$@"\n' > /usr/local/bin/blog-agent \
    && install -m 755 /usr/local/lib/blog-agent/codex-auto.sh /usr/local/bin/codex-auto \
    && chmod +x /usr/local/bin/blog-agent \
    && touch /etc/blog-devcontainer \
    && mkdir -p /workspaces/blog /home/node/.codex /home/node/.config/gh \
       /home/node/.local/state/blog-agent /home/node/.bun/install/cache \
    && chown -R node:node /opt/playwright /workspaces /home/node/.codex /home/node/.config /home/node/.local /home/node/.bun

ENV GIT_CONFIG_GLOBAL=/home/node/.local/state/blog-agent/gitconfig
USER node
WORKDIR /workspaces/blog
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sleep", "infinity"]
