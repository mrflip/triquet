# Security: decisions to look at

Describe decisions here that, in your judgement, could merit closer security review, or could
interact with later decisions to create a security issue. Do not justify why they are, or are not,
concerning; do not predict what might heighten concerns. Instead, in a sentence or so, brief a
security expert who knows what questions to ask.

## Of Interest

* 2026-10-12: a deployment that sets `EXPOSE_INTERNAL_STATS_TO_ALL=true` answers `stats:backfills` to
  anyone, with or without a session: the name, state and row count of every backfill it defines or
  has run, which says roughly how many rows it holds, of every hunt. `false` or unset, it is an admin's
  (`Approve.mayReadBackfills`). The rest of `/stats` (the build) was always anyone's.
* 2026-10-07: we allow the results of external bot calls (an `aibot` column's answer) to enter the
  column => Liquid => markdown => sanitizer => HTML pipeline, and the bbjank one beside it,
  wherever a field template or the recap template names that column (`src/lib/templating.ts`).
* 2026-10-08: an image in a formula's or a bot's column reaches a template as a link: `![` is
  written `&#33;[` in the template's bag (`Templating.bagOf`). An image whose `![` the template's
  own text supplies (`![map]({{question.col}})`, or a `!` typed just before a tag) takes its address from
  the column.
* 2026-10-08 (columnwise sprint, thread 6): a smith writes regular expressions of their own (a
  `text` entry's `regex` param, or an admin a widget's default), run against every cell typed into
  that column, in every smith's browser and on the server as the cell is written. A pattern is held
  to recheck's verdict (`lib/redos.ts`) where a mutation writes it, and refused unless recheck calls
  it `safe` within 200 ms; past that it is trusted and never checked again, nor timeboxed as it
  runs. Its source is at most 200 characters, its flags `i`, `m`, `s` and `u` only.
* `Actor.isAdmin` is an equality check on the userlabel, against the deployment's `TRIQUET_ADMINS`
  (production: `mrflip`), made on the server as it builds the actor and carried to the browser;
  `*` makes every userlabel an admin, which `scripts/convex_dev` sets on every local backend.
* The first user to claim a userlabel becomes that user: an ident nobody holds goes to the first
  session to assert it (`claimFor`, `convex/writing/user_actions.ts`).
* 2026-10-08: field, recap and prompt templates are LiquidJS (`lib/liquidry.ts`): a field or
  recap template is written by any smith of a quiz and run in every smith's browser; a prompt is
  written by an admin and rendered in the browser of whoever asks. LiquidJS calls a function it finds as an own property of what it reads;
  the template bag is built only from JSON (stored rows, and formula results with functions
  stripped by `Formulas.plainJson`), and a test holds a formula that comes to a function to that;
  a prompt's input goes through `Formulas.plainJson` before it is read.
  Runaway templates stop on the app's counted budgets and its own clock (`Liquidry`: thread 9,
  below), behind LiquidJS's own allocation limit, which has had bypasses before (CVE-2026-44645).
* 2026-10-08 (columnwise sprint, `notes/decisions/20261008-columnwise.md`): a model's reply can
  reach Liquid as the template itself, not only as a value filled into one: a `liquidize`
  widgeting whose template is read from the bag (`template_from`) over a bot's reply or a formula
  of one, or a templateable source whose text came from one, is filled in over the quiz's bag in
  every smith's browser, under the same budgets and own-keys reading as a field template. A
  computed value (`jsonata`, `aibot`, `liquidize`) reaches markdown with its images made links,
  through a column's template or its markdown readout alike.
* 2026-10-08 (columnwise sprint, thread 7): a `liquidize` widgeting's template (`src/lib/formulary/
  liquidize.ts`) is written by any smith of the quiz (its params) or an admin (its widget), and runs
  wherever the quiz is run: in every smith's browser, and on the server, inside the Convex mutation
  that sorts a quiz by a column (`sortQuestions`), so a template read from a bot's reply
  (`template_from`) is model output filled in as Liquid in a mutation too. Its input is the formula
  bag itself, or what its input formula made, through `Formulas.plainJson`; a test holds a function
  in the input to that. Each fill is stopped past `Liquidry.RenderMs` and each column past
  `LiquidizeFormulary.columnMs`, on `performance.now()`: LiquidJS's own time limit reads
  `Date.now()` inside Convex (it finds no `global.performance` there), which stands still through a
  mutation, so it never fired on the server (probed on a local backend, 2026-10-08).
* 2026-10-09 (columnwise sprint, thread 9): every author's template and formula is bounded in
  time on `performance.now()` (`src/lib/clock.ts`) (`notes/decisions/20261008-columnwise.md` §11).
  A sort is now worked out in the browser, which sends the order; the server checks it names
  exactly the quiz's questions and commits it, and no mutation runs a quiz, so an author's template
  or formula, and model output read as one, is worked only in a browser. Liquid's clock is read by taking over LiquidJS
  internals pinned to its exact version: its render and allocation limits on the context
  (`heldTo`), and its `Context.readProperty` and `spawn` (`ClockedContext`), so a filter is stopped
  inside its call; its `*_exp` filters are refused by a getter on the engine's filter table that
  throws as a template naming one is read. No one step of a render may make more than 100,000
  items or characters, nor a render 1,000,000 all told; `push`/`unshift`/`concat` are charged for
  everything they add. JSONata's timebox now reads the same clock (probed on a local backend,
  2026-10-09: stopped at 101 ms with `Date.now()` still); its range operator can still allocate ten
  million items in one step (in a Convex mutation, past its 64 MB). A run has five seconds all
  told (`Runner.RunMs`), and a column's own formula as long. A widgeting whose widget is gone takes params held to no reserved word.
* 2026-10-11 (oauth sprint, thread 7): the privacy policy (`src/content/privacy.md`, served at
  `/privacy`) is a public statement of what is kept, where, who can read it, and what leaves for
  Anthropic: among others, that a Google account gives only its email, name, picture and `sub`;
  that an email is shown to its owner alone; that anyone opening a hunt's address while not on it
  reads its smiths' names and handles (`NotOnHunt`); that a session lives in the browser's storage
  and no cookie is set but the short-lived ones Convex Auth's Google sign-in sets on the Convex
  site (`*OAuthstate`, `*OAuthpkce`, `*OAuthnonce`, `*RedirectTo`, fifteen minutes each); and that
  nothing goes to a bot unasked. Code that changes any of these
  changes the policy, and its date, in the same PR.
* 2026-10-11 (oauth sprint, thread 8): the reserved list keeps a new hunt label or userlabel from
  passing for the app, its pages, its roles, Google or the bot (`PA.ReservedToplevelGroups`, and
  the prefixes `google`, `triquet`, `admin`, `support`, `official`, `verif`, `secur`, `login`,
  `help`). It is matched exactly against labels, which hold only lowercase ASCII letters, digits
  and underscores, so near spellings (`go0gle`, `triquett`) pass. It governs only a label being
  made or claimed: a hunt row's label and org are held to their shape and the words every label is
  kept from (`CK.heldUserlabel`), so a hunt or org named before a word was kept keeps it, and
  `scripts/check_reserved` names them.
* 2026-10-11 (oauth sprint, thread 2): `clear_people:clearBatch` (`convex/clear_people.ts`), an
  internal mutation, deletes every row of Convex Auth's tables (`users`, `authAccounts`,
  `authSessions`, `authRefreshTokens`, `authVerifiers`, `authVerificationCodes`,
  `authRateLimits`) and of `idents`, `identings`, `huntings`, `reviews` and `reviewings`, with no
  argument and no environment check: the one place our code writes Convex Auth's tables. It is
  run on production once, by a Coach, through `scripts/clear_people` under `prd_janitor`. The
  `converge` thread (thread 3) deleted the mutation and its script with the tables they emptied,
  so no code of ours writes Convex Auth's own tables now. The script's guard (`scripts/janitor.ts`, kept for later janitor
  commands) acts only when `--deployment` names the deployment the CLI's environment reaches, by
  the address that deployment reports for itself (its `cloudUrl`, read by `convex function-spec`
  with the same admin key, not the address the CLI connected to); a dry run is the default.
