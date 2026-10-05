# Triquet (Tricky Question Editor Thingie)

Triquet is a lightweight tool for constructing puzzles and trivia quizzes.

At a basic level, it's nice to have an editor that saves on blur; allows rewind or comparison to earlier drafts; lets me reorder questions and take different kinds of notes.
It's also terrifically difficult to estimate difficulty, ambiguity, and factual exactitude while also honing prose and building in wordplay. An AI agent can do these things, tunably./
What's more, editors may want to include "meta" puzzles: perhaps a second layer of puzzle that is revealed as the first solutions start coming in (sort the questions by the largest number each contains to reveal a chain of hints), or a hidden feature (each answer is an anagram of a sports team name). Accidentally inflecting a single word could make the whole quiz unsolvable.
Until now that has require writing google sheets expressions or copy-pasting into.from oneoff scripts. We can allow simple calculations (JSonata), or where more is needed either author a prompt for an agent API call, or spin up a cloudflare worker or artifact endpoint.

The basics of a quiz are basic: Title, Clueing, Answer, Question #, Notes.

To this, you can add:

- ad-hoc entry fields: Note-like (Hint 1, Scoring Notes), Image, Numeric, etc

- agentic responses to a parameterized prompt; that could be "solve the puzzle" or "judge its fairness" or "make sure each there is a common animal name in the text"

- calculated expressions on the above: "word count", "alphabetize the letters in the answer ('monkey' -> 'ekmnoy')", "show the hint of the question matching my chains_to custom entry field"

In future, we may also offer api requests with a payload and response structure we design (calling a purpose-built edge worker), or perhaps even a templated graphql or rest request

Storage is [Convex](https://convex.dev): the rows live in a Convex deployment, the functions in `convex/` are the only things that read or write them, and every browser subscribes to small queries that redeliver the moment anything they read changes (`notes/queries_hooks_and_subscriptions.md` says how those are drawn). Convex replaced Jazz in September 2026, as an evaluation as much as a move (`notes/decisions/2026-09-convex.md` has the reasoning; `notes/database-decisions.md` the scorecard and verdict). The app itself is written for the browser: static hosting plus one stateless function for asking a model (`notes/decisions/2026-09-client-first.md`). Each quiz's history is also recorded in a git repo on the browser's FS: not a second source of truth, but the best past-versions view we know of -- easy comparison of drafts, and an exit door for anyone who outgrows the tool

## Developing

Please review STYLE.md for our coding guidelines, and the files in notes/ for more.
There's good stuff in AGENTS.md / CLAUDE.md if you're an AI, and maybe even if you aren't.
`human/` holds the current working notes, one file per entry: judgement calls made, open questions, and what was deliberately left out.

## Library first

We don't hand-roll what a maintained library already does. Reach for a Material UI component first, then a well-established package (see `notes/stack.md` for what's settled and what needs a conversation). Writing our own drag-and-drop, table, or focus handling is a decision to make together, not something to slip in. This applies to people and to coding agents alike.

## Developing Triquet

Use these standard commands:

    scripts/kilroy        # prints "triquet" when Doppler is set up for this checkout
    pnpm dev              # the app, on :3000, with your own Convex backend on :3400
    pnpm test             # unit specs, and the Convex functions under convex-test
    pnpm test:e2e         # end-to-end specs, on :3002 with a backend on :3402 (Doppler's dev_e2e)
    pnpm lint && pnpm typecheck && pnpm build

    scripts/convex_reset dev                # empty your backend, every row of every table
    scripts/convex_healthcheck dev          # does it answer, and does it hold this checkout's functions?
    pnpm run newb <label>                   # new branch named YYYYMMDD-<label>

How a change reaches production, and what a schema change means for a deployment:
`notes/deploy.md`.

Coding agents use `pnpm dev:agent` (port 3001, build directory `.next-agent`, backend on 3401)
and `pnpm build:agent` (served on 3004 by `pnpm start:agent`) instead of `pnpm dev` and
`pnpm build`, so they never collide with a dev
server you already have running. `pnpm dev:agent:botkey` is `dev:agent` with asking Claude
switched on (`notes/deploy.md`, *Asking a real bot while debugging*). Next.js refuses to start a second dev server in the same
directory. Each dev script runs under a Doppler config of its own (your default config for
`pnpm dev`, `dev_claude` for `dev:agent`, `dev_e2e` for `pnpm test:e2e`) and on its role's own
port and build directory. A git worktree's ports are moved up by its lane (`pnpm lane`,
`scripts/lanes.ts`), so several checkouts can run their servers and suites at once. The e2e suite always runs the app with a stand-in API key and a backend of its
own, emptied as it starts, and refuses to run locally outside `dev_e2e`. CI runs `playwright
test` directly, with GitHub's environment; Vercel supplies its own.

**Quizzes live in Convex.** In development each role has a local Convex backend of its own, run
from Convex's open-source binary by `scripts/convex_backend <role>`, with its data in
`data/convex-<role>/`; `scripts/convex_dev` (which `pnpm dev` and `pnpm dev:agent` go through)
starts it when it is not running and pushes `convex/` to it, regenerating `convex/_generated/`,
which is committed. No account is needed for any of that. A production build needs
`NEXT_PUBLIC_CONVEX_URL` at build time, which Vercel's deploy command sets; without it the page
says so instead of opening.

Each quiz's edit history is committed to an in-browser git repository about 30 seconds after the
first edit in a burst; `NEXT_PUBLIC_TRIQUET_COMMIT_DEBOUNCE_SECONDS` (2 to 600) changes that wait.

Asking Claude needs `ANTHROPIC_API_KEY` in the environment (Doppler, never a file in the repo);
everything else works without it, and a bot's cells say it can't play yet. Server code reaches
credentials only through `src/lib/credentials.ts`: `Credentials.has('claude')` and
`Credentials.get('claude')`. Each bot names the service it needs in its `servicelabel`.

## Overview

* The text blobs are not terribly large -- they're usually not more than a sentence or short paragraph (a few hundred characters). A clueing, hint or note is capped at 3600 characters; titles at 82
* People will often want to export, manipulate, and re-import data, forcing some unusual decisions (particularly, using the locally-unique label for many things where a global ID is easier to reason about)

