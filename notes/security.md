# Security: decisions to look at

Describe decisions here that, in your judgement, could merit closer security review, or could
interact with later decisions to create a security issue. Do not justify why they are, or are not,
concerning; do not predict what might heighten concerns. Instead, in a sentence or so, brief a
security expert who knows what questions to ask.

## Of Interest

* 2026-10-07: we allow the results of external bot calls (an `aibot` column's answer) to enter the
  column => mustache => markdown => sanitizer => HTML pipeline, and the bbjank one beside it,
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
