# 2026-10-03: Association census, authorization review, integrity plan, sprint draft

Four documents in `whiteboard/20261003-dbpolicy/` (start with its `README.md`), uncommitted
because the checkout stands on your `20261001-quiz_review` branch. The short of it: the defence
against an edited client is real (one mutation, server-side rules, Zod at the door), with four
gaps worth closing in order: reviewers receive every field including `full_answer` and bot
guesses (hidden only by `AnswerLock`); any smith of any hunt may edit the shared library; the
action's `open` context is client-asserted and verified by three reads where one denormalized
`quizzes.hunt_id` would do; `/api/ask` checks no identity. Quiz label uniqueness within a realm is
checked only in the browser. The README lists eight questions for you and the assumptions I made.
