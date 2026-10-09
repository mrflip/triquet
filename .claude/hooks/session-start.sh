#!/usr/bin/env bash
# Hands the agent the notes for where it runs, on stdout, which Claude Code adds to the session's
# context: notes/laptop.md in the laptop's container (TQ_IS_SANDBOXED=true), and notes/cloud.md in
# a cloud session (Claude Code on the web: CLAUDE_CODE_REMOTE=true). Anywhere else, nothing.
#
# A cloud session's container is first readied to work like the laptop's:
#
#   1. /workspace/triquet points at this checkout, the path the laptop's container uses.
#   2. Packages installed from the lockfile (the container is cached after this hook, so a later
#      session's install has little to do).
#   3. The Doppler CLI, but only when the environment holds a DOPPLER_TOKEN_* for it to use.
#   4. For the rest of the session (CLAUDE_ENV_FILE): TQ_IS_SANDBOXED, and the container's own
#      Chromium when Playwright's pinned build is missing (TQ_CHROMIUM_PATH).
#
# Everything but the notes writes to stderr. Safe to run again.
set -euo pipefail

root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$root"

if [[ "${CLAUDE_CODE_REMOTE:-}" != "true" ]]; then
  if [[ "${TQ_IS_SANDBOXED:-}" == "true" ]]; then cat notes/laptop.md; fi
  exit 0
fi

if [[ ! -e /workspace/triquet ]]; then
  mkdir -p /workspace && ln -s "$root" /workspace/triquet
fi

pnpm install --frozen-lockfile --prefer-offline >&2

if compgen -e | grep -q '^DOPPLER_TOKEN_' && ! command -v doppler > /dev/null; then
  curl -fsSL --retry 3 https://cli.doppler.com/install.sh | sh >&2 || echo "Installing the Doppler CLI failed: scripts/doppledo runs without it." >&2
fi

if [[ -n "${CLAUDE_ENV_FILE:-}" ]]; then
  {
    echo 'export TQ_IS_SANDBOXED=true'
    # Where Playwright would keep the Chromium it pins, from its own dry run
    pinned="$(pnpm exec playwright install --dry-run chromium 2> /dev/null | sed -n 's/^ *Install location: *//p' | head -1)"
    if [[ ! -d "$pinned" && -x /opt/pw-browsers/chromium ]]; then
      echo 'export TQ_CHROMIUM_PATH=/opt/pw-browsers/chromium'
    fi
  } >> "$CLAUDE_ENV_FILE"
fi

cat notes/cloud.md
