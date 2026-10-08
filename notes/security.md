# Security: decisions to look at

Describe decisions here that, in your judgement, could merit closer security review, or could
interact with later decisions to create a security issue. Do not justify why they are, or are not,
concerning; do not predict what might heighten concerns. Instead, in a sentence or so, brief a
security expert who knows what questions to ask.

## Of Interest

* 2026-10-07: we allow the results of external bot calls (an `aibot` column's answer) to enter the
  column => Liquid => markdown => sanitizer => HTML pipeline, and the bbjank one beside it,
  wherever a field template or the recap template names that column (`src/lib/templating.ts`).
* 2026-10-08: an image in a formula's or a bot's column reaches a template as a link: `![` is
  written `&#33;[` in the template's bag (`Templating.bagOf`). An image whose `![` the template's
  own text supplies (`![map]({{qn.col}})`, or a `!` typed just before a tag) takes its address from
  the column.
* `Actor.isAdmin` is an equality check on the username, against the deployment's `TRIQUET_ADMINS`
  (production: `mrflip`), made on the server as it builds the actor and carried to the browser;
  `*` makes every username an admin, which `scripts/convex_dev` sets on every local backend.
* The first user to claim a username becomes that user: an ident nobody holds goes to the first
  session to assert it (`claimFor`, `convex/writing/account_actions.ts`).
* 2026-10-08: field, recap and prompt templates are LiquidJS (`lib/liquidry.ts`): a field or
  recap template is written by any smith of a quiz and run in every smith's browser; a prompt is
  written by an admin and rendered in the browser of whoever asks. LiquidJS calls a function it finds as an own property of what it reads;
  the template bag is built only from JSON (stored rows, and formula results with functions
  stripped by `Formulas.plainJson`), and a test holds a formula that comes to a function to that;
  a prompt's input goes through `Formulas.plainJson` before it is read.
  Runaway templates stop on the app's counted budgets, behind LiquidJS's own time and allocation
  limits, which have had bypasses before (CVE-2026-44645).
