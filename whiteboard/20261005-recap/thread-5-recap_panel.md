# Thread 5: The recap panel (2026-10-06)

Branch `20261006-recap_panel`, PR filed at landing; see the report. Suites: `pnpm justify` green
(typecheck, lint, 4724 unit tests); `e2e/recap.spec.ts` and `e2e/panels.spec.ts` green; the full
e2e runs at landing.

* **Built**:
  - `src/lib/recap.ts`, imported `import * as Recap from '../lib/recap'`: `bbjankOf(quiz, run)`,
    the whole recap note in bbjank; `blockOf(question, placed)`, one question's block;
    `CorrectPctRE`. The note is: the recap head (filled in over `Templating.bagOf(run, null)`,
    then `Bbjank.toBbjank`), a rule (`Bbjank.RuleLine`, now exported) when questions follow, each
    question played, then the tail. A question's block:
    `[quote="Qn"]n. <clueing, BUT NOT and hint>[/quote]`, a blank line,
    `Answer: [spoiler][b]<full answer, on one line>[/b][/spoiler]`, `Correct Answer %: <share>`,
    then its recap when it has one. Question fields go through `Templating.filledQuiz` first, so a
    nominated field is filled in. Tests in `tests/lib/recap.test.ts`.
  - `src/components/panels/RecapPanel.tsx`, the last panel in `Panels.tsx` (`double`, so it has
    the widen arrow): the *Recap head* editor, then the note in a five-row `ReadonlyBox` labelled
    *Recap note* with its Copy button, then the *Recap tail* editor. The editors are shaped like the
    smith's note (`useDraft`, a `MarkdownFace` drawn filled in, a red outline and the issue above
    the text when the template does not parse). The note follows the drafts as they are typed, not
    only once saved. Wired through `Workbench` (`set_recap_head`, `set_recap_tail`), offered by
    `offers.reviseQuiz` (the same policy).
  - A question's `recap` is now a column source (`QuestionFieldVals`, header *Recap*), edited in
    the grid as a `StretchField`, like notes, templated when nominated.
  - `e2e/recap.spec.ts` (two tests, one `@smoke`), and its corner in `scripts/spine.ts` (`recap` is
    also in `PanelSpecs`).
* **Decisions taken**:
  - **Which questions**: the ones played, as the LL Export going live has them
    (`LLSmithExport.exportedIn(.., 'go_live')`: no archived, no alternates), less those never
    written into (`Question.isBlank`; a fresh quiz holds five). Rank order; numbered by place,
    from 1, so a question with no Q# still gets a number, after the ranked ones.
  - **BUT NOT** as the LL Export writes it (`LLSmithExport.bodyOf`): the clueing, a blank line,
    `...BUT NOT...`, a blank line, the hint of the question it chains to. All inside the quote.
  - **Correct Answer %** reads a column labelled `correct_pct`, `correct_percent`,
    `correct_answer_pct`, `correct_answer_percent`, `pct_correct` or `percent_correct`; blank
    otherwise.
  - **A blank recap writes nothing**, not the league form's `{Add Optional Text For Qn Here or
    Delete}`: nothing to delete after pasting.
  - The full answer's lines fold into one, so its spoiler stays whole.
  - The head's placeholder reads `First, a huge thank you to the playtesters:
    {{quiz.playtesters}}…`, as the plan asked: it fills in once thread 6's quiz entries land, and
    comes to nothing until then.
* **Deviations**:
  - **Each text is converted on its own**, and the recap's frame (quote, spoiler, `Answer:`) is
    written in bbjank around it. The plan had the whole recap assembled as one markdown document,
    each block spelled `> {AS: Qn}...` and `~~**ANSWER**~~`, and then `toBbjank` once. The Coach's
    words were a "concatenation of the bbjank rendered head, ... questions and their recap
    fields", and converting each text alone means it says on the board what it says on screen: no
    lazy continuation carrying one block into the next, no `---` turning a line into a heading, no
    clueing that needs every line prefixed with `> `. Thread 2's `{AS:}` and spoiler paths still
    serve an author who writes them.
* **Discoveries**:
  - An answer opening with a list marker (`1. ...`) is read as a list, inside the spoiler (TODO).
  - `ReadonlyBox`'s dense face wraps mid-word; fine for copying, plain to read (TODO).
  - Left in `whiteboard/TODO.md`, *From recap sprint, thread 5*: a stored, editable recap
    template; the answer-as-list case; where the correct-answer share might come from; the
    league's placeholder line; the dense box's wrapping.
* **For thread 6**: you add a panel to `Panels.tsx` too, and may touch `PanelSpecs` in
  `scripts/spine.ts`: both conflicts are line-for-line. Quiz entries in `run.frame.quiz` reach the
  recap head and tail with no change here.
* **For the Coach**: paste one recap into a board post's preview: the rule (40 dashes), the
  BUT NOT's blank lines inside `[quote]`, and an image in a clueing (`[img]` then
  `[list](alt)[/list]` inside the quote) are untried there.
