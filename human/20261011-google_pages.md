# 2026-10-11: The privacy policy, terms and About wording wait for your approval

From the oauth sprint's thread 7 (`google_pages`). `/about`, `/privacy` and `/terms` are drafts:
the text is `src/content/about.md`, `privacy.md` and `terms.md`, plain markdown, so an edit is a
one-file change. Each claim was checked against the code, and none goes beyond what the app does.

**Please read and approve, or mark up:**

1. **Who "we" are.** Both pages say "the people who run Triquet". A policy usually names the
   person or company responsible, and where. Add a name if you want one.
2. **Deletion by request.** The policy promises to delete what someone asks for, by mail to
   `info@triquet.me`, and to ask first before deleting a quiz others on a hunt are working on.
   No command does this yet (`whiteboard/TODO.md`, *From oauth sprint, thread 7*).
3. **"We can read the database"**: the policy says so plainly, and that we do it to keep Triquet
   running and to answer mail. Strike or soften it if you prefer.
4. **The terms** say only that the service is offered as it is: no warranty or liability
   clauses, and no governing law. Add what you want.
5. **The support email on Google's branding page** must be your Google account's own address or
   a Google Group it manages. If `info@triquet.me` is neither, enter yours there; the pages give
   `info@triquet.me` either way.
6. **Smiths' names to anyone with a hunt's label** (from the review). `/h/<label>` looks a label up
   across every org, and `hunts:open` hands a hunt's smiths' names and handles to anyone not on
   it. Labels are guessable adjective_animal pairs, so a script could list every hunt's smiths. The
   policy says this truly as written; thread 9 weighs the guessability.
7. **Images from other hosts** (from the review). An image in a question's markdown loads from
   whatever host a member wrote, and that host sees each viewer's IP address and when they looked,
   `no-referrer` notwithstanding. "No analytics or tracking" is true of Triquet itself; a sentence
   on this may be wanted.
8. **Checking a deletion request** (from the review). A request naming a handle with no Google
   account behind it cannot be verified. Decide what is checked before deleting.

**Claims that become true only with later threads** (the pages land early, in the first merge
step, so they are written to be true either way, mostly with "if you sign in with Google"):

* Google's email, name, picture and `sub` are kept, and nothing more asked for: thread 5.
* An email address is shown to its owner alone: thread 6's menu, checked by thread 9.
* The word "handle": thread 1 puts it on screen. Until then the front door says "username".

The exact URLs for Google's branding page are in `whiteboard/20261010-oauth/google-oauth-keys.md`,
*The branding page, field by field*.
