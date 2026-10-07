# 2026-10-07: Recap thread 12 -- three newly reserved labels, and images in reviewers' texts

Two things from recap thread 12 (images everywhere, categories and viz flags in the bag, the recap
reading templated fields filled in) worth your eye before its PR merges.

* **Three labels are reserved now.** Every question in the bag says whether it is `archived` and
  whether it is `secondary` (an alternate), so no widgeting may be labelled either; a template's bag
  holds every question as `quiz.questions`, so no widgeting run once for the whole quiz may be
  labelled `questions`. A production widgeting already under one of those names would refuse every
  write to it, as thread 1 found for `recap`. Unlikely (quiz-wide widgetings are a day old), but a
  look at production's `widgetings` for those three labels settles it; a hit needs a relabelling
  migration before the merge.
* **Images show in every field's markdown**, at your word -- which takes in reviewers' texts too
  (a review's guesses, comments, overall note). An image a reviewer writes is fetched by each smith
  who opens the Reviews panel, telling its host when, and from what address (lazily, with no
  referrer). If reviewers' texts should keep refusing images, that is a small change (an
  allowlist without `img`, for the Reviews panel); I left it to thread 7 (security review) and
  you. In `whiteboard/TODO.md`.
