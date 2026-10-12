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
* 2026-10-11 (oauth sprint, thread 3): `Actor.isAdmin` reads the user's own `admin` flag, set only
  from the command line (thread 4), once, as the server builds the actor (`Actor.ofUser`), and is
  carried to the browser. No variable lists admins; `TRIQUET_EVERYONE_ADMIN=yes` makes every user
  an admin, anonymous ones included, and `scripts/convex_dev` sets it on every local backend
  (production never has it, and a `TRIQUET_ADMINS` left set there is read by nothing). Since
  thread 5, the flag counts only for a user signed in with Google (below).
* 2026-10-11 (oauth sprint, thread 4): `adopt:perform` (`convex/adopt.ts`), an internal mutation
  run by `scripts/adopt` under `prd_janitor` behind the janitor's guard, sets a user's `admin` flag,
  gives it a userlabel that only a hunt's `orglabel` holds (past the rule that keeps an address's
  userlabel unclaimable; never one another user or a ghosting holds), and puts it on any hunt or
  every hunt as smith or reviewer, past that hunt's smiths (`grantHuntship`). It finds the user by
  id, userlabel, or the `email` on its row (refused unless exactly one user has it), and refuses
  the flag and any grant to an anonymous user. The deploy key is what vouches for it; it has no
  environment check. The guard checks the deployment once; each `convex run` after picks it again
  from the environment (thread 2's note).
* 2026-10-11 (oauth sprint, thread 3): the first user to take a free userlabel holds it for good
  (`assumeUserlabel`, `convex/writing/user_actions.ts`), with no password: a session is what holds
  its user. A userlabel is free only while no user, no ghosting, and no hunt's `orglabel` holds it,
  so nobody takes the handle a hunt's address carries (`holderOfUserlabel`).
* 2026-10-11 (oauth sprint, thread 3): an anonymous user is sealed by policy (`Actor.isSealed`):
  one hunt, its sandbox (`~label/label`), which it may neither relabel (`mayRelabelHunt`) nor
  delete (`mayDeleteHunt`, the Coach's word); never put on another hunt (`mayJoinHunt`, asked by the
  write once it has found the user by userlabel, so the refusal tells a smith that handle is
  anonymous); never adding anyone to its own; never reviewing. Sealing reads Convex Auth's
  `isAnonymous` on the user row, which only our `createOrUpdateUser` writes (and thread 5's Google
  sign-in clears). `smithOfSandbox` is the one write past sealing, for a user signed in with Google.
* 2026-10-11 (oauth sprint, thread 3): no hunt's scoped database reaches `users` (a row holds its
  email), `ghostings`, or Convex Auth's own tables; a function learns of another user only its face
  (`UserFaceT`: userlabel, title, anonymous or not) through the census, and `users.current` hands
  a session its own user without its email.
* 2026-10-11 (oauth sprint, thread 3): `testing:vouchFor`, an internal mutation refused on any
  deployment without `TRIQUET_CLEARABLE=yes`, marks a user no longer anonymous, standing in for a
  Google sign-in so e2e can test what sealing keeps from anonymous users. It is no provider and
  signs nobody in; production never has the flag. `ValidatorKit.zid` takes convex-test's own ids
  of Convex Auth's tables (`<20 digits>authAccounts`), which a deployment never mints.
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
  and only a Google merge's deletion of the merged-away user's sessions writes Convex Auth's own
  tables now (thread 5, below). The script's guard (`scripts/janitor.ts`, kept for later janitor
  commands) acts only when `--deployment` names the deployment the CLI's environment reaches, by
  the address that deployment reports for itself (its `cloudUrl`, read by `convex function-spec`
  with the same admin key, not the address the CLI connected to); a dry run is the default.
* 2026-10-11 (oauth sprint, thread 5, after its review): **login CSRF through the starting
  session, and where the decision is made.** Convex Auth's sign-in route
  (`/api/auth/signin/google?code=<verifier id>`) signs whatever verifier it is handed, from any
  browser, and a verifier never expires; Google's callback then finds that verifier by the signature
  in the finishing browser's cookies. So the browser that finishes at Google is not proven to be
  the one that started: a browser can start a sign-in and send its link to someone, whose own
  Google account then completes it. Upstream's PR #306, which we carry, hands the starting session
  to `createOrUpdateUser` at that callback; deciding there would let the link's maker have the
  clicker's Google account upgrade its anonymous user (a takeover: it would then be signed in with
  Google as them) or be merged into from it. **Decision:** our patch hands the starting session on
  only at the code's exchange, where the browser presents the verifier it kept in its own storage
  together with the code Google redirected it to, which only the starting browser can both hold.
  At the callback our code links the account to its own user, or to a new **provisional** user, and
  reads nothing of the starting browser's; at the exchange it upgrades, merges or switches
  (`userForGoogle`, `accountUserAtCallback`, `userAtExchange`). A code presented with the wrong
  verifier is spent, so once the clicker's browser has presented it, a code leaked from its address
  bar, history or a server log cannot then be used with the link's verifier. Shape chosen over a
  claim after the exchange (proof of the old session carried across the redirect): smaller, atomic
  (no moment signed in as the wrong user, no claim left unmade), and it uses the proof Convex Auth
  already has. Left: the code is 8 digits and lives 2 minutes, and guesses at it are not throttled,
  so the link's maker, holding the verifier, can guess at it (or use it, if it leaks) until the
  clicker's browser presents it. The link's maker chooses where that browser lands (the sign-in
  route's `redirectTo`), and a page outside `(synced)` (`/privacy`, `/terms`, `/about`) runs no
  Convex client and never presents it: closed since by the redirect rule (the next entry), so the
  clicker's browser presents it, and spends it, as it lands. A provisional user whose exchange never came stays, holding its account,
  until that account signs in again; `adopt` refuses one. The patch's exact lines:
  `notes/stack.md`, *Authentication*. The callback is Google's redirect to the deployment, carrying
  no token; the PR's browser-chosen `scope` is not carried.
* 2026-10-11 (oauth sprint, thread 5, the Coach's word after its second review): **a verifier is
  bounded, and a refused exchange changes nothing.** A verifier is a bearer credential for the
  session that started it: whoever learns its id (a history, local storage, a log) could finish a
  sign-in of their own with it, and the sign-in route re-signs any verifier still there. So:
  - the exchange hands the starting session on only from a verifier made within
    `SIGN_IN_START_MAX_AGE_MS` (15 minutes) and still there, and otherwise refuses the exchange
    whole;
  - a verifier is deleted wherever its code dies: at the exchange, finished or refused; when its
    code is presented with the wrong verifier, or has expired; when a later callback for the same
    account replaces its code. Verifiers of sign-ins never finished at Google stay, unbounded in
    number but useless past the bound (no sweep: `whiteboard/TODO.md`);
  - Convex Auth's `redirect` callback (`returnUrlFor`, `convex/auth.ts`) sends a browser back only
    to a relative path of a page that opens the database (`Routes.isSyncedPath`), never another
    site or a page without Convex Auth's provider, so the code is exchanged, and spent, the moment
    the clicker's browser lands: the guess window at the 8-digit code closes then, not at its 2
    minutes. Anywhere else asked for is never followed: the browser goes to the front door (`/`,
    itself a synced page) instead, which spends the code just the same, where a refusal would have
    stranded it on an error from the deployment after Google's consent (thread 5r). *Corrected after the Coach's `high` review (thread 5r):* the rule first read only a
    path's first segment, so a crafted path beneath a synced page that reaches none (`/h/x/y`,
    `/~any/hunt/nothing`) passed, landed on a page not found (which mounts no provider), and left
    the code in the address its whole 2 minutes. It now matches each page's whole path: an org's
    address as `Addresses.locationFrom` reads it, for exactly the kinds its pages show (a mode for
    a quiz alone), as those pages read their own, and written exactly as `Addresses.urlOf` writes it
    (the reader unescapes `quizze%73` to `quizzes`, which the router does not, so it is not found:
    the second review of thread 5r); every other synced page shape for shape, each
    label slot a label; no trailing slash. `tests/lib/routes.test.ts` walks `src/app/(synced)/`
    and fails if a page is refused or a folder holding none is allowed. Chosen over a root
    `not-found.tsx` that mounts the provider: that would open the database, and sign a new
    anonymous user in, on every mistyped or scanned address;
  - a refused or failed exchange leaves the browser exactly as it was: no row of its user changes
    (tested for stale, wrong-verifier and expired codes, upgrade and merge alike), and the patched
    client keeps the session it had stored rather than signing out (the DOM test,
    `use-session.dom.test.tsx`). The tab then says the sign-in did not finish
    (`useGoogleSignInOutcome`): it compares the session it left as, its id noted in its own
    session storage (the session half of the token's subject, read with `jose`'s `decodeJwt`
    without checking the signature; never the token), with the session of the token it came back
    on, and clears any verifier Convex Auth left in local storage. *Changed after the Coach's
    `high` review (thread 5r):* it first compared a SHA-256 of the whole token, which the Convex
    client refreshes as a page loads, so the notice showed only when the page's user query
    answered before the refresh; an expired token would have hidden it. A session's id grants
    nothing: it is in the token already, and a token is what the deployment checks. A provisional user a refused sign-in
    leaves has no session, and the account's next finished sign-in folds it away or keeps it.
* 2026-10-11 (oauth sprint, thread 5): a Google sign-in's user is decided, at the code's exchange,
  by whose the account is and whose the starting browser was (`userForGoogle`,
  `convex/writing/user_actions.ts`), never by email: Convex Auth's default linking by verified email is off with our
  `createOrUpdateUser`, and two Google accounts sharing an email are two users. A new account from
  an anonymous browser joins that user and clears its `isAnonymous` (unsealing it); from a Google
  user's browser, or none, it makes a new user. A known account switches the browser to its user;
  from an anonymous browser holding a handle it **merges**: the Google user is made smith of the
  anonymous user's sandbox past sealing (`smithOfSandbox`), the anonymous user is taken off it,
  marked `merged` (never deleted), keeps its userlabel reserved until a name choice is settled, and
  every one of its sessions and their refresh tokens is deleted by our code. A Google user is never
  merged away. A Google user holding no handle takes the anonymous user's handle and title outright.
  An upgrade deletes the provisional user the callback made, which nobody was ever signed in as.
  The merged user's other unfinished sign-ins' verifiers stay (no index finds them by session).
* 2026-10-11 (oauth sprint, thread 5): an admin must be signed in with Google
  (`Actor.isSignedInWithGoogle`: the user is not anonymous): `Actor.ofUser` counts an anonymous
  user's `admin` flag for nothing. Not by email, because a Google account's email can change and a
  Workspace address can pass to someone else (Google says to identify an account by its `sub`);
  the flag sits on the user, bound to the Google account's `sub` through its account row, and is
  set only with the deploy key. `TRIQUET_EVERYONE_ADMIN` still makes everyone an admin on a local
  backend.
* 2026-10-11 (oauth sprint, thread 5): what we keep from Google is held to the privacy policy:
  Google is asked for `openid email profile` (`GoogleScope`, `convex/auth.ts`, and an e2e test of
  the redirect); the user row keeps only the email, name and picture (`UserValidators.googleProfile`
  drops anything else before a write), refreshed at every sign-in; the account row keeps Google's
  `sub` as `providerAccountId`; Convex Auth stores no Google token. The only cookies are Convex
  Auth's OAuth ones on the deployment's site (the e2e test checks their names). No query returns
  the email yet. Google is offered only on a deployment holding `AUTH_GOOGLE_ID` and
  `AUTH_GOOGLE_SECRET`; `scripts/convex_dev` hands a local backend the dev client's through a
  file only its user can read, never a command line; convex-test uses placeholder keys and drives
  Convex Auth's own `store` past the part only Google does, which no deployment can be made to do
  without a deploy key.
