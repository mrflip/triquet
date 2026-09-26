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

We're moving storage to [Jazz](https://jazz.tools) v2, a local-first database: each browser keeps its own copy and a sync server carries it between devices and collaborators. You can start using the app and never log in; logging in (later) is what lets you collaborate with yourself across browsers, and with people you authorize. Jazz is still in alpha. We chose it on purpose, as a trial, to learn what people need before we commit to infrastructure (see `notes/decisions/2026-09-jazz.md`; Turso was ruled out over concurrent tab access and last-push-wins conflicts). The app itself is written for the browser: static hosting plus one stateless function for asking a model (`notes/decisions/2026-09-client-first.md`). Until the move lands, data still lives in a local libSQL file. Each quiz's history is also recorded in a git repo on the browser's FS: not a second source of truth, but the best past-versions view we know of -- easy comparison of drafts, and an exit door for anyone who outgrows the tool

## Developing

Please review STYLE.md for our coding guidelines, and the files in notes/ for more.
There's good stuff in AGENTS.md / CLAUDE.md if you're an AI, and maybe even if you aren't.
`HUMAN-whatsup.md` holds the current working notes: judgement calls made, open questions, and what was deliberately left out.

## Library first

We don't hand-roll what a maintained library already does. Reach for a Material UI component first, then a well-established package (see `notes/stack.md` for what's settled and what needs a conversation). Writing our own drag-and-drop, table, or focus handling is a decision to make together, not something to slip in. This applies to people and to coding agents alike.

## Developing Triquet

Use these standard commands:

    pnpm dev              # the app, on :3000
    pnpm test             # unit specs
    pnpm test:e2e         # end-to-end specs, on :3100
    pnpm lint && pnpm typecheck && pnpm build

Coding agents use `pnpm dev:agent` (port 3100, build directory `.next-agent`) and `pnpm build:agent`
instead of `pnpm dev` and `pnpm build`, so they never collide with a dev server you already have
running. Next.js refuses to start a second dev server in the same directory.

**Storage is mid-move to Jazz v2** (plan: `whiteboard/jazz-migration.md`), and this section
will change when the move is done. Until then, quizzes live in a local libSQL database file,
`data/triquet.db`, created and migrated on first use; `TRIQUET_DATABASE_URL` points elsewhere
(`file:...`, or `:memory:`). The agent scripts use `data/agent.db`. Each browser finds its own
workspace by a cookie. Please don't build anything new on this layer. There is no migration
path: export your quizzes as JSON before the move and bring them back through the import tool.

Each quiz's edit history is committed to an in-browser git repository about 30 seconds after the
first edit in a burst; `NEXT_PUBLIC_TRIQUET_COMMIT_DEBOUNCE_SECONDS` (2 to 600) changes that wait.

Asking Claude needs `ANTHROPIC_API_KEY` in the environment (Doppler, never a file in the repo);
everything else works without it, and a player's cells say it can't play yet. Server code reaches
credentials only through `src/lib/credentials.ts`: `Credentials.has('claude')` and
`Credentials.get('claude')`. Each player names the service it needs in its `servicelabel`.

## Overview

* The text blobs are not terribly large -- they're usually not more than a sentence or short paragraph (a few hundred characters). A clueing, hint or note is capped at 3600 characters; titles at 82
* People will often want to export, manipulate, and re-import data, forcing some unusual decisions (particularly, using the locally-unique label for many things where a global ID is easier to reason about)
