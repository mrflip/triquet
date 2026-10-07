# 2026-10-07: Security review (recap sprint, thread 7) -- two things need you

The review's findings are in `whiteboard/20261005-recap/security-findings.md`. Three fixes landed
on the sprint's own code (a template could crash every co-smith's tab; a quadratic in the indent
rule; reviewers' images now show as links). Two findings outside the sprint need your word:

* **The ask route is an open proxy to Claude** (`src/app/api/ask/route.ts`): no session, no rate
  limit, Opus tier and `max_tokens` as the caller asks, wherever `ENABLE_ANTHROPIC_BOT=allow`.
  Is production switched on? Thread 8 can require a Convex Auth token with a username, and
  rate-limit per ident; say whether any username suffices or only smiths may ask.
* **Every username is a library admin** (`Actor.isAdmin` returns `true`): anyone can rewrite the
  formulas and prompts every hunt shares. Who should the admins be, and by what (a flag on the
  ident set by an internal mutation, or an env allowlist of user ids)?

Also worth a look: unheld legacy idents in production go to whoever asserts them first, and
`hunts.open` tells anyone a hunt's smiths' usernames (O3). And a decision you may reverse: a
reviewer's image is drawn as a link to it, so opening the Reviews panel fetches nothing a reviewer
chose; smiths' images still show.
