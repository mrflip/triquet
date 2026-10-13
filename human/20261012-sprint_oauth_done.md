# 2026-10-12: Sprint oauth done

The sprint built Google sign-in on the pre-plan's model. Convex Auth's `users` row is now the
person-facing record, holding a userlabel ("handle" on screen). Huntships replace huntings, and
ghostings retire merged-away handles. An anonymous user is sealed in one sandbox. A sign-in from
an anonymous browser upgrades it in place, or merges it into a known Google user, decided only at
the code's exchange. All nine threads landed, plus one PR of fixes from your `high` review of
thread 5, in one stack of ten PRs. Two threads' reviews were flagged and fixed by their own
workers: thread 3 (a sandbox could be relabelled) and thread 5 (a login CSRF, then the verifier's
lifetime, which you decided as option 1). The closing full e2e run, on the top as it stands,
passed 309/309 with no flakes.

The plan is `whiteboard/20261010-oauth/oauth-plan.md`, and the running account is
`oauth-progress.md`. The security review is `oauth-security-review.md`. The live mirror is
https://claude.ai/code/artifact/89643f81-3e20-48c4-9cde-ef9268d7a1c6.

## The PRs, in the order they landed (one stack; each stacked on the one before)

| PR | Thread | Merge step |
|---|---|---|
| [#226](https://github.com/mrflip/triquet/pull/226) | 7, `google_pages`: privacy, terms, About, footer | first |
| [#227](https://github.com/mrflip/triquet/pull/227) | 2, `clear_people`: the clear command and the janitor's guard | first |
| [#228](https://github.com/mrflip/triquet/pull/228) | 1, `split_account`: "account" and "username" freed | first: **merge #228 alone** |
| [#229](https://github.com/mrflip/triquet/pull/229) | 8, `reserved_words` | after the clear |
| [#230](https://github.com/mrflip/triquet/pull/230) | 3, `converge`: users, huntships, sealing | after the clear |
| [#231](https://github.com/mrflip/triquet/pull/231) | 4, `adopt_script` | after the clear |
| [#232](https://github.com/mrflip/triquet/pull/232) | 5, `google_signin`: the provider, the patch, the merge | after the clear |
| [#233](https://github.com/mrflip/triquet/pull/233) | 5r, fixes from your `high` review of #232 | after the clear, with #232 |
| [#234](https://github.com/mrflip/triquet/pull/234) | 6, `google_ui`: the sign-in screens | after the clear |
| [#235](https://github.com/mrflip/triquet/pull/235) | 9, `oauth_security`: the security review | after the clear |

**The production order** (`notes/deploy.md`, *Clearing production's people*):
1. Export production.
2. Merge #228; let it deploy.
3. Run the clear (`scripts/clear_people`, dry run first).
4. Merge #235, which takes #229 to #234 with it; let it deploy.
5. Set production's two Google keys, now **after** the deploy, not before the clear.
6. Sign in with Google.
7. On your word, I run `scripts/adopt` to give you `mrflip`, admin, and smith of every hunt.

## Decisions taken in YOLO (the plan has each in full)

1. `oath` read as `oauth`; the existing directory used.
2. The spine restarted on `main` after #224 merged under a new SHA.
3. The clear is a command run by hand, not a backfill (your choice, kept).
4. One deployment guard (`scripts/janitor.ts`) for every production command.
5. The merge's name choice: thread 5 records it, thread 6 settles it.
6. Thread 3 caught up onto thread 8 before its review.
7. `testing:vouchFor`, e2e's stand-in for Google, gated on `TRIQUET_CLEARABLE`.
8. "Signed in with Google" is one predicate, `Actor.isSignedInWithGoogle`.
9. Thread 5's login CSRF fixed in thread 5 (at the code's exchange), not held.
10. The `high` review's redirect finding fixed in its own PR (#233).

Your guidance during the sprint: an anonymous user may not delete a hunt; thread 5's verifier is
option 1, with no lost anonymous record and no confusing state; thread 5 approved to land, with its
wording; a `high` review of thread 5 as its own PR.

## Open questions, gathered

**Before production's Google keys are set** (thread 9; `oauth-security-review.md`):
* **F2:** `hunts:open` shows any hunt's smiths' handles and titles to anyone, and labels are
  guessable, so a script can list them all. Titles now start as Google names. It is a policy call:
  keep it, show smiths only to signed-in users or members, or stop `/h/<label>` searching every org.
* **F3:** Convex Auth signs a verifier as often as asked, so a leaked verifier id still works for
  its 15 minutes. "Sign once" would be a fifth part to the patch.

**Wording and assets to approve:**
* The privacy policy and terms (#226; items 6 to 8 of `human/20261011-google_pages.md`).
* The handle and sealing notices (#228, #230).
* The sign-in screens (#234; `human/20261012-google_ui.md`).
* Google's "G" checked against Google's `signin-assets.zip` before brand verification.

**Your calls:**
* **Reserved words (#229):** confirm no npm package; `claude`, `info`, `hello`, `members`? Run
  `scripts/check_reserved` once deployed.
* **New dependencies,** under `notes/stack.md`'s rule: `jose` (#233) and `@fontsource/roboto`
  (#234).
* **Upstream PR #306** has the same login-CSRF hole as written; tell its maintainers?
* **A deploy-skew policy:** no shims were built.
* **Permission refusals:** the classifier refused two reviewers a read, an edit and a `tsx -e`
  inside worktrees.

**Minor findings left** (F4 to F9, the sign-out race, the races in `use-google-sign-in.ts`):
listed in `notes/security.md` and `whiteboard/TODO.md`.
