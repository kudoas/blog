#!/usr/bin/env bash
set -euo pipefail
# Force bundled Chromium and a fresh Playwright preview process.
export CI=true
unset E2E_BASE_URL
node --input-type=module -e '
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const p = JSON.parse(fs.readFileSync("package.json", "utf8"));
if (process.version !== `v${p.engines.node}` || execFileSync("bun", ["--version"], {encoding:"utf8"}).trim() !== p.packageManager.slice(4)) {
  throw new Error("Node/Bun differs from package.json; rebuild the container.");
}
'
bun install --frozen-lockfile
# Versioned browser paths ensure dependency updates cannot use an old Chromium.
bun x playwright install chromium
bun run verify
bun run test:e2e
bun x cf deploy --prebuilt --mode production --dry-run
