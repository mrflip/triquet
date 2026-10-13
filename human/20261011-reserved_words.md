# 2026-10-11: Reserved words grew, and a check for production to run

Thread 8 of the oauth sprint (`whiteboard/20261010-oauth/thread-8-reserved_words.md`).

0. **Merge this PR no earlier than the clear**: with thread 3, in the second step, not the first.
   Idents are not grandfathered, so before `clear_people` runs, an org's smith whose label the
   list now keeps would be locked out of their ident once their session ended.
1. **Run the check once the thread deploys**: `./scripts/doppledo prd_janitor scripts/check_reserved`.
   It writes nothing. It names every hunt whose label or org (`~org/label`) the grown list would
   refuse if it were made today. Such hunts keep working at their addresses: the list now governs
   only new labels.
2. **Confirm: no package for the list.** The two npm lists (`reserved-usernames`, 2019, and
   `the-big-username-blacklist`, 2018) are unmaintained. Beyond our list they add mostly subdomain
   noise, or words that make plausible hunt names (`movies`, `test`). If you agree, the choice
   goes in `notes/stack.md`, *Hand-rolled on purpose*.
3. **Your judgement on the words**: `claude` (someone's name, but the bot's on screen), `info`
   (the contact mailbox), `hello`, `members` and the role names are kept as whole words.
   `google…` is kept as a prefix. The list is `ReservedToplevelGroups` in
   `src/lib/vv/patterns.ts`.
