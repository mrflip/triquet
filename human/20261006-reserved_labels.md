# 2026-10-06: Reserved labels -- one list, refused by every label; check production before merging

`PA.ReservedLabels` (`src/lib/vv/patterns.ts`) is a list of words no label may be, grouped by why:
fields, the tool's nouns, those nouns with `id` run on, `constructor`/`prototype`, null-ish
literals, Windows device names, and a few route words. Any label ending `_id`/`_ids` is refused too.
The kit's `label` refuses them, so every label namespace does (hunts, realms, quizzes, questions,
columns, widgets, widgetings, branches, and the keys of `stored`, `params` and `entered`).

**Before merging: does production hold a label on the list?** The schema push is safe, since
patterns don't reach the Convex schema. But every update re-validates the whole row
(`convex/writing/quiz_writing.ts`), so a row that already holds a reserved label reads fine yet
refuses every edit until it is relabelled. Hunts, quizzes, columns and widgetings can be
relabelled. **A question can't be**, so a question holding one would be stuck. Questions get
minted `adjective_animal` labels, so the risk comes from imports and from labels people typed.
A read-only `npx convex export` of production, searched for the words, would settle it. If
anything turns up, it's a migration, or we drop that word from the list.

Kept off the list on purpose:

- `category`/`categories`: the library's widget is `categories`, and so are its widgetings.
- `key`: `fixtures/sample-import.json` has a real question labelled `key`.
- `title`, `notes` and the question's other content fields: reserved only among widgetings, as before.
- JS reserved words: a label is only ever a property key, string or path, where `class` or `new`
  are harmless; they'd refuse ordinary trivia words for no concrete hazard.

Ident labels are exempt. `Ident.labelFor` normalises a typed name, so reserving words there could
lock someone out of an ident they already have. Their hazard is impersonation, which wants a list of
its own (`admin`, `system`, `triquet`, `support`, `anonymous`, ...), if you want one.

Also suggested, not done: `yes`/`no`/`on`/`off` (YAML 1.1 reads them as booleans; we write no YAML
today), and `head` as a branch (it is ambiguous with `HEAD` on a case-insensitive filesystem).
