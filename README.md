# Triquet (Tricky Question Editor Thingie)

Triquet is a lightweight tool for constructing trivia quizzes, which sometimes can have "meta" puzzles --
a second layer of puzzle that is revealed as the first solutions start coming in. This tool helps
store, edit and refine the question text, and also to assess questions for fairness and difficulty.

Please review STYLE.md for our coding guidelines, and the files in notes/ for more.
There's good stuff in AGENTS.md / CLAUDE.md if you're an AI, and maybe even if you aren't.
`HUMAN-whatsup.md` holds the current working notes: judgement calls made, open questions, and what was deliberately left out.

## Developing Triquet

Use these standard commands:

    pnpm dev              # the app, on :3000
    pnpm test             # unit specs
    pnpm test:e2e         # end-to-end specs, on :3100
    pnpm lint && pnpm typecheck && pnpm build

Coding agents use `pnpm dev:agent` (port 3100, build directory `.next-agent`) and `pnpm build:agent`
instead of `pnpm dev` and `pnpm build`, so they never collide with a dev server you already have
running. Next.js refuses to start a second dev server in the same directory.

Quizzes live in a local libSQL (Turso) database file, `data/triquet.db`, created and migrated on
first use; `TRIQUET_DATABASE_URL` points elsewhere (`file:...`, or `:memory:`). The agent scripts use
`data/agent.db`. After changing `src/db/schema.ts`, run `pnpm db:generate` and commit the new
migration in `drizzle/`. Each browser finds its own workspace by a cookie.

Each quiz's edit history is committed to an in-browser git repository about 30 seconds after the
first edit in a burst; `NEXT_PUBLIC_TRIQUET_COMMIT_DEBOUNCE_SECONDS` (2 to 600) changes that wait.

Asking Claude needs `ANTHROPIC_API_KEY` in the environment; everything else works without it.

## Overview

* The text blobs are not terribly large -- they're usually not more than a sentence or short paragraph (a few hundred characters). A clueing, hint or note is capped at 3600 characters; titles at 82
* People will often want to export, manipulate, and re-import data, forcing some unusual decisions (particularly, using the locally-unique label for many things where a global ID is easier to reason about)
