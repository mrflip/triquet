# 2026-10-11: Sprint oauth paused on thread 5's second review

The sprint is paused, waiting for your decision on one security finding in thread 5 (Google
sign-in). Six of nine threads have landed; thread 5 waits, unlanded, in its worktree; threads 6
and 9 depend on it and have not started.

The plan is `whiteboard/20261010-oauth/oauth-plan.md`, the running account
`oauth-progress.md`, and the live mirror is
https://claude.ai/code/artifact/89643f81-3e20-48c4-9cde-ef9268d7a1c6.

## Where things stand

| Order in the stack | PR | Thread | Merge step |
|---|---|---|---|
| 1 (bottom) | [#226](https://github.com/mrflip/triquet/pull/226) | 7, `google_pages`: privacy, terms, About, footer | first |
| 2 | [#227](https://github.com/mrflip/triquet/pull/227) | 2, `clear_people`: the clear command | first |
| 3 | [#228](https://github.com/mrflip/triquet/pull/228) | 1, `split_account`: "account" and "username" renamed | first |
| 4 | [#229](https://github.com/mrflip/triquet/pull/229) | 8, `reserved_words` | second, after the clear |
| 5 | [#230](https://github.com/mrflip/triquet/pull/230) | 3, `converge`: users, huntships, sealing | second, after the clear |
| 6 (top) | [#231](https://github.com/mrflip/triquet/pull/231) | 4, `adopt_script` | second, after the clear |

* **First merge step:** merge #228 alone; it takes #226 and #227 with it. Then export
  production and run the clear (`notes/deploy.md`).
* **Thread 5, `google_signin`:** unlanded, in `/home/node/worktrees/triquet/google_signin`, on
  `20261011-google_signin` at `e2c3b40c`, clean. Two reviews done; the second's significant
  finding is below.
* **Thread 6, `google_ui`:** not started (needs 5). **Thread 9, `oauth_security`:** not started
  (needs everything).
* **Production's Google keys:** do not set them yet. Until thread 5 is settled, nothing in the
  stack offers Google, so the keys would do nothing; but thread 5 must not reach production with
  the finding open.
* The sprint-end full e2e run has not happened (it follows the last landing).

## The decision: how long a sign-in's verifier may speak for its browser

Thread 5's first review found a login CSRF: a sign-in started by an attacker's browser and
finished in a victim's would upgrade or merge the attacker's anonymous user with the victim's
Google account. The worker fixed it: upgrade and merge are now decided only at the `?code=`
exchange, where the browser must show both the code Google sent it and the verifier it kept.
The second review confirms that hole is closed.

The second review's significant finding:

* **A verifier is a never-expiring bearer credential for the session that made it.** Convex
  Auth's sign-in route re-signs any verifier that still exists, and verifiers never expire.
* Whoever learns a victim's verifier id (it is in the sign-in URL, so in browser history; also
  in localStorage; perhaps in the deployment's logs) can finish at Google with *their own*
  account and exchange *their own* code with it.
* The victim's anonymous user is then upgraded into the attacker's Google account, or merged
  into it. That is a takeover of the victim's handle and sandbox.
* Upstream had abandoned verifiers too; what makes them dangerous is that we now read the
  verifier's session at the exchange.

**Options:**

1. **Recommended: bound the verifier.** At the exchange, hand on the session only from a verifier
   made recently (its `_creationTime` within 10 to 15 minutes), and delete the verifier wherever
   its code dies (wrong verifier, expired, replaced). A small change to the patch and
   `userAtExchange`, with tests. Optionally also:
   - a `callbacks.redirect` in `convex/auth.ts` allowing only pages that run the Convex client,
     which closes the second review's minor finding (the link's maker can land the victim on
     `/privacy`, leaving the 8-digit code unspent and open to unthrottled guessing for its 2
     minutes);
   - a scheduled sweep of provisional users and orphaned verifiers from abandoned sign-ins.
2. **Hold upgrade and merge.** Land thread 5 with sign-in only switching or making a new user;
   put upgrade and merge in a later thread. Thread 6's merge-name dialog would wait too.
3. **Something else** you prefer.

On your word I resume thread 5's worker with the choice as a directive. Its result gets no
third review under the sprint's rules, so I would bring it to you to look at before it lands,
unless you say to land it on its tests.

## Decisions taken in YOLO (the plan has each in full)

1. `oath` read as `oauth`, run in the existing directory.
2. The spine restarted on `main` after #224 merged under a new SHA.
3. Thread 2's clear is a command run by hand, not a backfill (your choice, kept).
4. One deployment guard (`scripts/janitor.ts`) for every production command.
5. The name choice after a merge: thread 5 records it; thread 6 settles it (with thread 4's
   `relabelUser`, pulled forward).
6. Thread 3 caught up onto thread 8 before its review.
7. Thread 3's `testing:vouchFor` (e2e's stand-in for Google, gated on `TRIQUET_CLEARABLE`) kept.
8. "Signed in with Google" is one predicate: the user is not anonymous
   (`Actor.isSignedInWithGoogle`).
9. Thread 5's first finding was fixed in thread 5 rather than held.

Your guidance during the sprint: an anonymous user may not delete a hunt (done in #230).

## Open questions, gathered

* **Wording to approve:** the privacy policy and terms (#226, and items 6 to 8 of
  `human/20261011-google_pages.md`); the sealing notices and handle wording (#228, #230).
* **Reserved words (#229):** confirm no npm package; your view on `claude`, `info`, `hello`,
  `members`. Run `scripts/check_reserved` against production once it deploys.
* **Deploy skew:** removing public functions breaks open tabs until they reload; no shims were
  built. Say if you want a policy.
* **Upstream PR #306** has the same login-CSRF hole as written; whether to tell its maintainers is
  yours.
* **Permission refusals:** the auto-mode classifier refused two reviewers a read, an edit and a
  `tsx -e` inside sprint worktrees ("Modify Shared Resources"). Neither worked round it; the
  threads' own workers made the fixes. If reviewers should be allowed to edit worktrees, that is
  a settings change.
* **For thread 9, already noted:** `sealedJoin` reveals whether a handle is anonymous; guessable
  hunt labels let a script list every hunt's smiths; `--smith-all` reaches anonymous sandboxes;
  relabelling an anonymous user that holds a sandbox lets it make a second; the unreviewed
  `sealedDelete` change; the guard checking the deployment once.
* **After the sprint:** the adopt command (`scripts/adopt`), run by the orchestrator only on your
  word at the time.
