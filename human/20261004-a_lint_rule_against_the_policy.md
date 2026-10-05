# 2026-10-04: A lint rule against the policy guardrails (dbpolicy thread 2, PR #81)

* **`unicorn/prefer-combined-guards` contradicts `notes/policy_approve.md`.** The rule wants two
  guards in a row that return the same value merged with `||`; the note asks for one guard per
  line, each beside its rule, and no compound booleans. Thread 2 disables the rule, with a reason,
  for all of `src/lib/approve.ts`, around `Review.isActiveOwner`'s guards, and on one line of
  `affirmPerform`. Threads 5 and 6 will write more guard lists. Your call: switch it off for
  policy code in `eslint.config.mjs`, or keep disabling it where it bites.
* **A smith asking for the role they already hold is now refused** (`ownHunting`), where it used
  to be a silent no-op: the "not oneself" check is policy now and runs before the membership is
  read. Say if you would rather the no-op came back.
