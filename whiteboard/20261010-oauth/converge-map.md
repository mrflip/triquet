# Converge: where everything went (thread 3, 2026-10-11)

The detail behind `thread-3-converge.md`'s *Built*: read it when you need to find what thread 3
renamed or added (threads 4, 5, 6 and 9 above all), or when a name in an older document no longer
answers to anything.

  - **Schema, one step, no backfill** (`convex/schema.ts`): `users` inlined from
    `UserValidators.row` (`src/models/user.ts`: Convex Auth's fields, our `userlabel`, `title`,
    `admin`, stamps), keeping its `email` and `phone` indexes by Convex Auth's names, plus
    `by_userlabel`; `huntships` (`src/models/huntship.ts`, copying `userlabel` and `usertitle`);
    `ghostings` (`src/models/ghosting.ts`: `userlabel`, `user_id`, `into_user_id`, `account_id`;
    append-only, unstamped, written by nothing yet); `reviews` and `reviewings` take `user_id`;
    `idents`, `identings` and `huntings` are gone, with their two stamp backfills. `users` and
    `huntships` are stamped (`StampedTables`).
  - **`createOrUpdateUser`** (`convex/auth.ts` over `userForSignIn` in `writing/user_actions.ts`,
    through `triggers.wrapDB`): a returning account returns its user; a new anonymous account gets
    `User.anonymous()`; any other provider throws. Thread 5 extends it.
  - **The actor** (`src/lib/actor.ts`): `Actor.ofUser(user_id, user, { everyoneAdmin })` is the
    one place the `admin` flag is read. `{ kind: 'unlabelled' }` | `{ kind: 'user', user_id,
    userlabel, usertitle, admin, anonymous }`; `Actor.isUnlabelled`, `Actor.isSealed`.
    `askerOf` reads the session and the user row. `TRIQUET_ADMINS` and `Actor.namesAdmin` are
    gone; `TRIQUET_EVERYONE_ADMIN=yes` (convex.config, `scripts/convex_dev`, `vitest.config.ts`).
  - **Userlabels**: `users.perform` (was `idents.perform`) with `assume_userlabel { userlabel,
    title }` and `retitle_user`; `users.current` (was `idents.current`) returns `{ user: { _id,
    userlabel, title }, actor }`. Taking one is one patch to the user (`assumeUserlabel`), set once
    (`Approve.mayAssertUserlabel` → `userlabelSet`), and only when free: `holderOfUserlabel` in
    `convex/reading.ts` (user, ghosting, or a hunt's `orglabel`; `userlabelClaimed` for all three).
    `retitleUser` fans the title out to the user's huntships.
  - **Sealing, as policy** (`src/lib/approve.ts`): `mayMakeHunt(actor, action)` refuses an
    anonymous user any label but its own (`sealedHunts`); `newHunt` refuses its second
    (`sealedHunts`); `mayChangeMembership` refuses an anonymous smith (`sealedMembers`); a new
    `join_hunt` key, `mayJoinHunt(face)`, asked by `addHuntship` once it has found the user
    (`sealedJoin`); `mayWriteReview` refuses it (`sealedReview`). The notices
    (`src/lib/notices.ts`) begin "Sign in with Google to …" and end "coming soon".
  - **`smithOfSandbox(db, user, sandbox)`** (`writing/huntship_actions.ts`): thread 5's named
    write past sealing; refuses an anonymous user (`sealedJoin`, by `Approve.must`), throws for a
    user with no userlabel or a hunt that is no sandbox (`Hunt.isSandbox`).
  - **Who another user is goes through the census**: no scoped database reaches `users`,
    `ghostings` or Convex Auth's tables (`policy_rules.ts`). `CensusT` gains `userByLabel` and
    `userById`, answering a `UserFaceT` (userlabel, title, anonymous). `zHuntQuery` now hands its
    handler `ctx.census` too (`reviews.forQuiz` names reviewers through it).
  - **Renames**, per the pre-plan's table: `huntship_actions.ts` (`addHuntship`,
    `removeHuntship`), `add_huntship { userlabel, role }` / `remove_huntship { user_id }`, affirms'
    `user_id`, `huntshipFor`/`huntshipsFor`/`huntshipsOf`, `userForUserlabel`, `ownHuntship`,
    `huntshipsFull`, `userUnknown`/`userUnknownNotice`, `PA.HuntshipsPerHunt`, `Huntship.modeFor`/
    `mayOpen`, `MemberT.user_id`.
  - **Browser**: `useMe` (`src/state/use-me.ts`), `UserlabelGate`, `UserTitle`/`useRetitleUser`,
    `ShownUserT.user`. "Be someone else" (menu, hunts page, `Routes.switchIdentPath`, the gate's
    `?switch`) is gone. The hunts list offers an anonymous visitor one hunt, labelled with its
    handle, then shows `RefusalNotices.sealedHunts` in place of *+ New hunt*. The Members panel's
    field is "Their handle".
  - **Thread 2's clear is deleted** (`convex/clear_people.ts`, `scripts/clear_people`,
    `scripts/clear-people.ts`, their tests); `scripts/janitor.ts` and its test stay.
  - **Tests**: helpers by kind of user in `tests/support/convex.ts` — `anonymousSession(tt)` (no
    userlabel, made by `userForSignIn`), `anonymousUser(tt, label)`, `googleUser(tt, label)` (its
    `authAccounts` row seeded with `provider: 'google'`, `isAnonymous: false`, an email; never a
    sign-in); `Labelled` replaces `Identified`. `tests/support/actors.ts` has `userActor`. The
    `hunts.performOuter` tests moved to `hunts.test.ts`, with sealing cases beside them. New:
    `tests/convex/writing/user_actions.test.ts` (`userForSignIn`), `tests/models/ghosting.test.ts`,
    `smithOfSandbox` cases, `testing:vouchFor` cases, the matrix's anonymous-smith column.
  - **e2e**: `testing:vouchFor` (internal, `TRIQUET_CLEARABLE` only) marks a user no longer
    anonymous, standing in for Google; `e2e/admin.ts` `vouchFor`. The worker's kept session and
    the friend are vouched for; `otherVisitor` stays anonymous until a spec vouches.
    `assumeUserlabel`, `freshUserlabel`, `forgetSession` (stands in for Sign out) in support.
    New specs in routing: the sandbox and its notice, the anonymous smith's Members panel, a smith
    told an anonymous handle cannot be put on.
  - **Notes**: vocabulary (*Who and where* rewritten), convex, security (five entries), deploy
    (admins, converge's schema step), e2e, views, queries, hunt_git, CLAUDE.md. TODO's O3 struck.

