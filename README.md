# Triquet

Triquet is a lightweight tool for constructing trivia quizzes, which sometimes can have "meta" puzzles --
a second layer of puzzle that is revealed as the first solutions start coming in. This tool helps
store, edit and refine the question text, and also to assess questions for fairness and difficulty.

Please review STYLE.md for our coding guidelines, and the files in notes/ for more.
`HUMAN-whatsup.md` holds the current working notes: judgement calls made, open questions, and
what was deliberately left out.

    pnpm dev              # the app, on :3000
    pnpm test             # unit specs
    pnpm test:e2e         # end-to-end specs, on :3100
    pnpm lint && pnpm typecheck && pnpm build

Asking Claude needs `ANTHROPIC_API_KEY` in the environment; everything else works without it.
There's good stuff in AGENTS.md / CLAUDE.md if you're an AI, and maybe even if you aren't.