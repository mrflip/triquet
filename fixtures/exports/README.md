# Older exports

Every shape Raw Export, the per-quiz history and the library's export have ever emitted, kept so
that `tests/lib/importing.test.ts` proves each still imports. Named for the last day each shape
was emitted. Never edit one to fit the code: an export already in someone's hands does not change.

* `workspace-2026-09-26.json`: the workspace era, quizzes in a list, ids beside labels and a
  chain by its target's id.
* `hunt-2026-09-27.json`: a hunt of realms in a list, labels overridable (`forced_label`), with
  its expressions.
* `hunt-2026-10-04.json`: a hunt of realms in a list, each question beside what every widgeting
  came to, the widgets named by label.
* `quiz-2026-10-04.json`: one quiz of that hunt, as a quiz's own history kept it.
* `library-2026-10-04.json`: the library, its widgets in a list.
* `../sample-import.json`: an export older than all of these, its fields camel-cased; only its
  labels and question text still read.
