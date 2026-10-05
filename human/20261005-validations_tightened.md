# 2026-10-05: Validations tightened -- numberlike strings from relics, and the loose ones found

* **Done** (branch `20261005-validation_tighten`, in its own worktree after the shared checkout
  lost its first pass): `TRIQUET_CLEARABLE` declared as the literal `yes` (a backend now refuses
  `env set ... no`); numberlike strings ported from `relics/vv` as Zod 4 codecs (`intstr`,
  `uintstr`, `numstr`, `unumstr` keep text; `strint`, `ustrint`, `strnum`, `ustrnum` make a
  number; `unumstrOrBlank` for a Q#); the ask route's body read in its own try; a column source's
  widgeting label held to the label check; `set_overall` and `assume_ident` take what their rows
  will; caps on positions, minutes, `question_ids`, approximate tokens and an HTTP status; one
  `RefusalShape`, one `PA.Jsident`.
* **Not ported from relics, on purpose**: the per-range regexes (`UINT31STR`, `SINT64STR` and
  kin), since a bound is checked on the number spelled, against the numeric bounds we already
  have; `SREALSTR` (exponents), which nothing here takes; `boolstr`, which Zod 4 has as
  `z.stringbool()`; UUIDv4, which Zod 4 has as `z.uuidv4()` (`browser_key` still takes any
  version: a one-liner if wanted).
* **Question: should a numstr trim?** The relics ones did. Ours do not, because
  `tests/models/question.test.ts` holds that a Q# of `" 1"` is refused, and I would not rewrite a
  test to fit new behaviour without your say. Trimming would let an import's `" 3"` land as `"3"`.
* **Question: "the other should use strnum".** The places a Q# becomes a number (`qnumOf` in
  `src/lib/rank.ts`, `QnumField`) run past the boundary on a Q# already valid, and `qnumOf` runs
  in a sort's comparator; I left them on `Number()`. `strnum` is for an entrypoint taking
  numberish text. Say if you meant somewhere else.
* **Found in convex-helpers (0.1.124, still in 0.1.126)**: `zodOutputToConvex` types a union's
  members by their *input*, so a union holding a codec types a row field as what it takes, not what
  it keeps (a Q# came out `string | number`). Runtime is right. Worked around by putting the blank
  inside the codec, not a union around it -- which a Zod 4 pipe wants anyway: a failed pipe
  reports itself aborted, so a union over one only ever says "Invalid input". Worth an upstream
  issue.
* **The widgeted value: left to (c).** A `$` key or nesting past Convex's 16 levels can only come
  from a hand-built client (asks are vetted on the route); it fails as "nothing was altered" with
  the error in the dashboard. A try/catch would want a refusal kind of its own, and only the `$`
  half is testable here.
* **Production**: no schema push refuses anything (Convex validators carry no bounds); a row
  already past a new bound (a Q# of 17+ digits, minutes past 999) would be refused at its next
  write, not before. None expected.
