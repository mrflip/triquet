# 2026-10-12: Reviewed the OAuth stack, #226 to #231, and fixed what was certain

A full review of the six open PRs of the OAuth sprint, each PR's own diff read against the spec
(`whiteboard/20261010-oauth/20261011-oauth_preplan.md`) and traced to its callers, from a cloud
session. Nothing blocking anywhere: the sealing, claim, row-level-security and email-privacy
invariants the pre-plan asks for are where it says, each with a test; the clear and the guard do
what they say; the policy's claims hold against the code. What follows is what I changed, and what
I left for you or thread 9.

## What I fixed, and where it sits

None of these branches is this session's, so every fix is a new commit on the branch whose PR it
belongs to, **cherry-picked onto every branch above it** so each PR's head carries it and CI runs
on the whole. When you restack, `git rebase` drops the duplicates by patch id; nothing was rebased
or force-pushed here.

* **#230 `converge`** (three commits, also on #231):
  - **A sealed smith was offered what the server refuses.** The manage dialog's *Hunt label* field
    and its Danger Zone delete, and the hunts list's gear's *Label* field, offered an anonymous
    smith a relabel and a delete that `mayRelabelHunt`/`mayDeleteHunt` refuse after a
    type-to-confirm. `workbenchOffers` gains `relabelHunt` and `deleteHunt`; `HuntEditModal` takes
    `relabelable`. The field reads the sealing notice beneath it; the delete is replaced by its.
  - **An anonymous smith at its own sandbox's `!playtest`** read "Not yet on this hunt" and was told
    to ask *itself* for an invitation (the Members panel's *Copy reviewer link* leads exactly
    there). It now reads `sealedReview`, and a sealed smith is offered no reviewer link.
  - The hunt page's Members table said "Label" where the panel says "Handle".
  - `Actor.ofUser` titled a user with no title by its bare userlabel, `User.faceOf` by it titleized;
    one `User.titleOf` now, so two huntships could never carry different copies of one title.
    Nothing writes a userlabel without a title today, so no row shows it.
  - `policy_rules.test.ts` checked that the scoped rules exclude `identings`, a table that is gone,
    so the check that mattered was missing; it now names `users`, `ghostings` and every Convex Auth
    table. `schema.test.ts` pins the `email`/`phone` indexes `users` promises Convex Auth. The last
    `ident`/`hunting` names in test code and titles, `notes/testing.md`'s helper names, the UX
    matrix and two doc blocks follow the rename. One spec presses Enter at the front door again
    (the deleted switch test was the only one that did).
* **#226 `google_pages`** (one commit, on every branch above): the policies spec's "never open the
  database" asserted only that a prerendered heading showed, which a page that did open the
  database and failed would show too; it now records every request and socket to another host and
  holds them to none. `mdx-components`' link branches each have a test.
* **#229 `reserved_words`** (one commit, on #230 and #231): `field` → `fieldname` in the check, per
  STYLE.md.
* **#231 `adopt_script`**: the usage line said `[--smith-all | --reviewer-all]` but both are taken
  (merged to smith); it says so now. `failureIn` said a first line that was itself the `Uncaught`
  line twice. The email refusal says the match is letter for letter, as Google sent it.

**Tests:** `pnpm justify` at the top of the stack; `pnpm e2e:smoke` there too (the views reach
the whole suite; CI runs the rest on every branch).

## Left, for you or thread 9

1. **A visitor not on a hunt, who is anonymous, is told to give a smith their handle**, which the
   smith's add then refuses (`sealedJoin`). `NotOnHunt` has no `anonymous` to go on, and the right
   sentence is yours to choose; the handoff lists it for thread 6. (#230)
2. **A sealed user whose userlabel is reserved at top level after it took it can never make its
   sandbox**: `new_hunt.label` is held to `HuntValidators.newLabel` (the full list), while a held
   userlabel is only `heldUserlabel`, so *+ New hunt* alarms on every click. It arises only if a
   word is reserved after a claim, which the clear makes moot for now. Fix, if wanted: take the
   sandbox's label as `heldUserlabel` when it equals the maker's userlabel. (#229/#230)
3. **`privacy.md`: "Your email address is shown to you alone."** Today it is shown to nobody
   (`users.current` never returns it; thread 6's menu will). True in the safe direction. (#226)
4. **Quotes in test titles.** STYLE.md says `"` for every `it`/`describe` title; the new tests in
   #227, #229 and #231 mostly use `'`, as do older files. ESLint has `@stylistic/quotes` off, so
   nothing catches it. I did not requote them: a mechanical sweep across the stack would churn
   every branch. A one-line lint rule would settle it for good.
5. **`join_hunt` sits in `ReadPolicies`** ("the reads, and the ask") though it guards a write; a
   table of its own, or a renamed comment. Cosmetic. (#230)
6. **`tests/convex/clear_people.test.ts:42`** says "username" in a comment; #230 deletes the file,
   and a fix there would conflict with that delete on restack, so I left it. (#227/#228)
7. **The handoffs' own items stand** (not re-litigated): `--smith-all` reaching anonymous sandboxes
   and a relabelled anonymous user making a second sandbox (#231, for thread 9); `hunts:open`
   naming a hunt's smiths to anyone with its label, and images from other hosts (#226, for
   thread 9); the guard's deployment being re-read per `convex run` (#227).

## What I checked and found sound, in a line each

`createOrUpdateUser` runs through the triggers and our row validator, and Convex Auth 0.0.96 writes
`users` nowhere else once the callback is set; `askerOf` reads the admin flag in one place and a
token outliving its session is no session; a userlabel is looked up and taken in one mutation;
every write to hunts, huntships and reviews goes through `Approve.must`, and `placeOn` is reached
only past `join_hunt`; no scoped database reaches `users`, `ghostings` or the auth tables; no query
returns an email; the four `testing:*` mutations are internal and gated on `TRIQUET_CLEARABLE`;
`adopt:plan` and `adopt:perform` agree on every branch I could enumerate; the janitor's guard
compares the typed name only against the deployment's own `cloudUrl`; the clear's table order
leaves no orphan between batches, and `take(0)` is fine on the real backend.
