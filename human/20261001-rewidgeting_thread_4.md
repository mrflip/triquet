# 2026-10-01: Rewidgeting thread 4 -- the ask route is a free-form relay now

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
