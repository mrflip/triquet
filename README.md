# Triquet

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

Asking Claude needs `ANTHROPIC_API_KEY` in the environment; everything else works without it.

## Overview

* The text blobs are not terribly large -- they're usually not more than a sentence or short paragraph (a few hundred characters). Length is currently capped at 3000 characters
* People will often want to export, manipulate, and re-import data, forcing some unusual decisions (particularly, using the locally-unique label for many things where a global ID is easier to reason about)
