# THIS DOCUMENT IS **FROM** AGENTS **TO** COACHES
It does not represent authoritative decisions: it is a conversational scratchpad. Agents should not use this as input, but are encouraged to write to it.
Agents: add at the top of the document, add a level two header;  Put the date before your title, following the examples seen here:

## 2026-10-01: Rewidgeting thread 4 -- the ask route is a free-form relay now

* **Rate limiting has moved closer.** `/api/ask` used to answer three fixed jobs; it now puts any
  prompt (up to 16,000 characters, up to 8,000 tokens of room, either tier) to Claude for whoever
  can reach the URL, so long as `ENABLE_ANTHROPIC_BOT=allow` and a key are set. `Approval` and the
  credentials check are exactly as strict as before, and the prompt is bounded as well as the
  reply, but nothing counts asks per ident or per minute. `notes/stack.md` lists rate limiting
  under *Later*; for this route it is nearer than that list suggests -- worth settling before the
  app's URL travels beyond friends. (The ask route is a Next route handler, not a Convex function,
  so `convex-helpers`' rate limiter would need a Convex call from the route, or a limiter of its
  own.)
* **`mustache` is installed** (mustache.js 4.2, with `@types/mustache`) for rendering a prompt
  template, as the sprint plan proposed; listed in `notes/stack.md`. Logic-less, escaping off.
* **Dumdum's seeded prompt changed** to ask for `{"guess", "explanation"}` as JSON. The seeding
  mutation inserts only what is absent, so seed production once, from the final fixture (the plan
  already says so). A local backend seeded before this thread still holds the old prompt: its
  guesses come back `unreadable` until it is reset (`--reset --seed`) or the prompt is edited in
  the library.

## 2026-10-01: Rewidgeting thread 3 -- the widget tables, and a deploy that needs you

* **The deploy of this sprint is a hand procedure**, not a plain merge: `notes/deploy.md`,
  *Clearing the widget tables*. Export the hunt; in the Convex dashboard clear `expressions`,
  `widgets` and `bottings` and delete `bulk_ishes_last` off each quiz; merge; run
  `seeding:seedWidgets`; re-ask the bots. What is lost is `whiteboard/20261001-rewidgeting/losses.md`
  (the bots' replies, and any expression an author wrote or revised).
* **Your `dev` backend will refuse the new schema** until it is emptied or cleared the same way:
  `doppler run -- scripts/convex_dev dev --reset --seed true` empties it and seeds it. Export what
  you want to keep first. `pnpm dev` now passes `--seed` on every start (idempotent).
* **Previews start with a library of twelve**: a new quiz brings the widgets its default
  widgetings work, but the five text formulas come only from `seeding:seedWidgets`. Adding
  `--preview-run seeding:seedWidgets` to `build:vercel`'s `convex deploy` would seed each preview;
  I left deploy config alone.
* **The batched run is gone, and it was already slower than it should be.** *Recalculate all
  ishes* put every text of a quiz to the careful model in one ask, with up to 32,000 tokens of
  room. Worth a look of its own the day bulk returns, for pasted prompts or any other.

## 2026-09-30: Sprint misc done -- six threads, four PRs open

* **The sprint.** Six threads issued over the afternoon, each built by a thread-worker and
  reviewed by the new thread-reviewer (its first run: two `fix:` commits kept across six
  threads, nothing flagged). Plan and handoff: `whiteboard/20260930-misc/`. Live mirror: the
  *Sprint misc* Claude Doc.

## 2026-09-27: Reviewed Changes

Coach has swept changes into future documents

## 2026-09-19: Reviewed Changes

Coach has swept changes into future documents
