import _ from 'es-toolkit/compat'
import { beforeEach, describe, expect, it } from 'vitest'
import * as Z from 'zod'
import { ConvexError } from 'convex/values'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { quizForLabel, quizzesOf, reviewsOf } from '../../convex/reading'
import * as Exporting from '../../src/lib/exporting'
import * as Runner from '../../src/lib/formulary/runner'
import * as Importing from '../../src/lib/importing'
import * as PA from '../../src/lib/vv/patterns'
import * as UU from '../../src/lib/useful'
import { noticeOf } from '../../src/lib/refusals'
import { RefusalNotices } from '../../src/lib/notices'
import { Hunt, type HuntT } from '../../src/models/hunt'
import { BlankQuestionQty, Quiz } from '../../src/models/quiz'
import { defaultLayout } from '../../src/models/layout'
import { classicLayout } from '../support/layouts'
import { Question } from '../../src/models/question'
import type { HuntActionDNA } from '../../src/models/actions'
import type { JsonT, WidgetedRecordingDNA } from '../../src/models/widgeted'
import type { EstimatesDNA } from '../../src/models/estimate'
import { present } from '../support/present'
import { expectSound } from '../support/soundness'
import { affirmsOf, huntHolding, identified, openOf, openTester, expectRefusal, putOn, seedHunt, signedIn, type Seeded, type Seen, type Session, type Tester } from '../support/convex'
import { SeedOrg } from '../support/seed'

/** A hunt holding one quiz built from `qnum, title` pairs, with the default layout */
function huntOf(...pairs: [string, string][]): HuntT {
  const questions = pairs.map(([qnum, title]) => ({ ...Question.blank(), qnum, title }))
  return huntHolding([{ ...Quiz.blank('Quiz one'), ...classicLayout(), questions }])
}

/** A hunt holding one quiz of blank questions */
function openHunt(locked = false): HuntT {
  return huntHolding([{ ...Quiz.blank('Quiz one'), locked }])
}

/** A hunt holding the quizzes titled `titles`, blank, the one at `lockedIdx` locked */
function huntTitled(titles: string[], lockedIdx = -1): HuntT {
  return huntHolding(titles.map((title, idx) => ({ ...Quiz.blank(title), locked: idx === lockedIdx })))
}

/** `hunt` with every quiz locked */
function lockedAll(hunt: HuntT): HuntT {
  return { ...hunt, realms: hunt.realms.map((realm) => ({ ...realm, quizzes: realm.quizzes.map((quiz) => ({ ...quiz, locked: true })) })) }
}

/** For sorting ids into a stable order to compare */
const byId = (aa: string, bb: string) => aa.localeCompare(bb)

const titlesOf  = (seen: Seen) => openOf(seen).questions.map((question) => question.title)
const qnumsOf   = (seen: Seen) => openOf(seen).questions.map((question) => question.qnum)
const firstOf   = (seen: Seen) => present(openOf(seen).questions[0])
const quizNamed = (seen: Seen, title: string) => present(seen.quizzes.find((quiz) => quiz.title === title), title)
const newestOf  = (seen: Seen) => present(seen.quizzes.at(-1), 'the newest quiz')

/** What `question_id`'s `widgeting_label` cell came to, as a browser sends it to be recorded: numnum's reading of a clueing, finding nothing, unless overridden */
function recorded(question_id: string, overrides: Partial<WidgetedRecordingDNA> = {}): WidgetedRecordingDNA {
  return { question_id, widgeting_label: 'numnum_clueing', status: 'ok', value: { items: [] }, result_meta: { model_tier_applied: 'careful' }, ...overrides }
}

/** Numnum's reading of `question_id` for `widgeting_label`, which found `value` once */
function found(question_id: string, value: number, widgeting_label = 'numnum_clueing'): WidgetedRecordingDNA {
  return recorded(question_id, { widgeting_label, value: { items: [{ text: String(value), value, kind: 'numeral' }] } })
}

/** Dumdum's guess `guess` at `question_id`'s clueing */
function guessed(question_id: string, guess: string): WidgetedRecordingDNA {
  return recorded(question_id, { widgeting_label: 'dumdum', value: { guess, explanation: '' }, result_meta: { model_tier_applied: 'quick' } })
}

/** A failed ask of `question_id` by the widgeting `widgeting_label`: its message, and the reply as it came back */
function failed(question_id: string, widgeting_label: string, err: { message: string, response: JsonT }): WidgetedRecordingDNA {
  return recorded(question_id, { widgeting_label, status: 'errored', value: null, message: err.message, result_meta: { response: err.response } })
}

/** Put an entry widget of `entry_kind` into the library, labelled `label`, and to work in `seeded`'s open quiz under the same label */
async function putEntryToWork(seeded: Pick<Seeded, 'act' | 'actOnLibrary'>, label: string, entry_kind: 'text' | 'number' | 'labelish' | 'titleish' | 'estimates' = 'text'): Promise<void> {
  await seeded.actOnLibrary({ kind: 'add_widget', widget: { label, formulary: 'entry', config: { entry_kind } } })
  await seeded.act({ kind: 'add_widgeting', widgeting: { widget_label: label, label } })
}

/** Typing `value` into `question_id`'s cell of the entry widgeting `widgeting_label`, as the cell commits it on blur */
function entering(question_id: string, widgeting_label: string, value: string | number | EstimatesDNA | null): HuntActionDNA {
  return { kind: 'enter_widgeted', entered: { question_id, widgeting_label, value } }
}

/** Every value the widgeteds table holds, as JSON, in a stable order to compare */
async function valuesIn(tt: Tester): Promise<string[]> {
  const rows = await tt.run(async (ctx) => await ctx.db.query('widgeteds').collect())
  return rows.map((row) => UU.jsonify(row.value)).toSorted((aa, bb) => aa.localeCompare(bb))
}

/** What the first question's `widgeting_label` cell stored, as the hunt now holds it: null when nothing */
function cellOf(seen: Seen, widgeting_label: string) {
  return firstOf(seen).stored[widgeting_label] ?? null
}

/** What a refusal of an argument carries: each Zod issue, in our words */
const PathStep   = Z.union([Z.string(), Z.number()])
const ZodIssue   = Z.object({ path: Z.array(PathStep), message: Z.string() })
const ZodRefusal = Z.object({ ZodError: Z.array(ZodIssue) })

/** What `pending` was refused with; fails the test if it went through */
async function refusalOf(pending: Promise<unknown>): Promise<unknown> {
  try {
    await pending
  } catch (err) {
    return err
  }
  throw new Error('expected a refusal, and the call went through')
}

/** The reviews of `quiz_id`, oldest first, as the rows hold them */
async function reviewsIn(tt: Tester, quiz_id: string) {
  return await tt.run(async (ctx) => await reviewsOf(ctx.db, quiz_id as Id<'quizzes'>))
}

/** Every reviewing the rows hold, oldest first, as what was said about which question (what it copies of its review, `expectSound` checks) */
async function reviewingsIn(tt: Tester) {
  const rows = await tt.run(async (ctx) => await ctx.db.query('reviewings').collect())
  return rows.map((row) => _.omit(row, ['_id', '_creationTime', 'review_id', 'hunt_id', 'quiz_id', 'ident_id']))
}

/** The ids of the open quiz's questions, in order */
const questionIdsOf = (seen: Seen) => openOf(seen).questions.map((question) => question._id as Id<'questions'>)

/** A reviewing with nothing said, and the answer not seen */
const Unsaid = { get_rate: null, guesses: '', comments: '', minutes: null, keep_it: false, needs_fact_check: false, elimination_candidate: false, peeked: false } as const

describe("hunts.perform", () => {
  const Deployment: { tt: Tester } = { tt: openTester() }
  beforeEach(() => { Deployment.tt = openTester() })

  const seed = async (hunt: HuntT, openIdx = 0) => await seedHunt(Deployment.tt, hunt, { openIdx })

  /**
   * `hunt` seeded, its open quiz's review opened by alice, its first two questions' ids, and how
   * to act as alice.
   */
  const reviewed = async (hunt: HuntT = huntOf(['1', 'a'], ['2', 'b'])) => {
    const seeded = await seed(hunt)
    const alice = await seeded.join('alice_reviews', 'reviewer')
    const quiz = openOf(await seeded.read())
    const [first, second] = quiz.questions.map((question) => question._id as Id<'questions'>)
    const asAlice = async (action: HuntActionDNA) => { await seeded.act(action, alice) }
    await asAlice({ kind: 'open_review', quiz_id: quiz._id })
    return { ...seeded, asAlice, alice, quiz_id: quiz._id, first: present(first), second: present(second) }
  }

  /** A seeded hunt whose first question already holds a guess, and that question's id */
  const withHeld = async () => {
    const seeded = await seed(huntOf(['1', 'a']))
    const { _id: id } = firstOf(await seeded.read())
    await seeded.act({ kind: 'record_widgeted', widgeted: guessed(id, 'Leon') })
    return { ...seeded, id }
  }

  /** A seeded hunt of two questions whose open quiz works the entry widgets `remark` (text) and `points` (a number), and its two questions' ids */
  const withEntries = async () => {
    const seeded = await seed(huntOf(['1', 'a'], ['2', 'b']))
    await putEntryToWork(seeded, 'remark')
    await putEntryToWork(seeded, 'points', 'number')
    const [first, second] = questionIdsOf(await seeded.read())
    return { ...seeded, id: present(first), second: present(second) }
  }

  describe("retitle_quiz", () => {
    it("renames the open quiz", async () => {
      const { act, read } = await seed(openHunt())
      await act({ kind: 'retitle_quiz', title: 'Quiz two' })
      expect(openOf(await read()).title).to.eq('Quiz two')
    })

    it("accepts an empty title without rewriting it", async () => {
      const { act, read } = await seed(openHunt())
      await act({ kind: 'retitle_quiz', title: '' })
      expect(openOf(await read()).title).to.eq('')
    })

    it("refuses while the quiz is locked", async () => {
      const { act, read } = await seed(openHunt(true))
      const ante = await read()
      await expectRefusal(act({ kind: 'retitle_quiz', title: 'Quiz two' }), 'quizLocked')
      expect(await read()).to.deep.eq(ante)
    })
  })

  describe("relabel_quiz", () => {
    it("gives the open quiz the new label, in place of the one it had", async () => {
      const { tt, act, read, open } = await seed(openHunt())
      const ante = openOf(await read()).label
      await act({ kind: 'relabel_quiz', label: 'leon' })
      const found = await tt.run(async (ctx) => [await quizForLabel(ctx.db, open.realm_id, 'leon'), await quizForLabel(ctx.db, open.realm_id, ante)])
      expect([openOf(await read()).label, ...found.map((quiz) => quiz?._id ?? null)]).to.deep.eq(['leon', open.quiz_id, null])
    })

    it("refuses a label another quiz of the realm answers to, writing nothing", async () => {
      const { act, read } = await seed(huntTitled(['one', 'two']), 0)
      const ante = await read()
      await expectRefusal(act({ kind: 'relabel_quiz', label: quizNamed(ante, 'two').label }), 'labelTaken')
      expect(await read()).to.deep.eq(ante)
    })

    it("takes the label the quiz already has, changing nothing", async () => {
      const { act, read } = await seed(huntTitled(['one', 'two']), 0)
      const ante = await read()
      await act({ kind: 'relabel_quiz', label: openOf(ante).label })
      expect(await read()).to.deep.eq(ante)
    })

    it("takes a label a quiz of another hunt answers to, as labels are unique only among siblings", async () => {
      const theirs = await seed(huntTitled(['three']), 0)
      const { act, read } = await seed(huntTitled(['one', 'two']), 0)
      const taken = openOf(await theirs.read()).label
      await act({ kind: 'relabel_quiz', label: taken })
      expect(openOf(await read()).label).to.eq(taken)
    })

    it("refuses while the quiz is locked", async () => {
      const { act, read } = await seed(openHunt(true))
      const ante = await read()
      await expectRefusal(act({ kind: 'relabel_quiz', label: 'leon' }), 'quizLocked')
      expect(await read()).to.deep.eq(ante)
    })
  })

  describe("set_smiths_note", () => {
    it("rewrites the open quiz's smith's note, trimmed, keeping its paragraphs", async () => {
      const { act, read } = await seed(openHunt())
      await act({ kind: 'set_smiths_note', smiths_note: '  Theme: princes.\n\nMeta: their initials.\n' })
      expect(openOf(await read()).smiths_note).to.eq('Theme: princes.\n\nMeta: their initials.')
    })

    it("refuses while the quiz is locked", async () => {
      const { act, read } = await seed(openHunt(true))
      const ante = await read()
      await expectRefusal(act({ kind: 'set_smiths_note', smiths_note: 'Theme: kings.' }), 'quizLocked')
      expect(await read()).to.deep.eq(ante)
    })
  })

  describe("set_q1_preamble", () => {
    it("rewrites the open quiz's LL preamble, trimmed", async () => {
      const { act, read } = await seed(openHunt())
      await act({ kind: 'set_q1_preamble', q1_preamble: '  See the note.[br]\n' })
      expect(openOf(await read()).q1_preamble).to.eq('See the note.[br]')
    })

    it("refuses while the quiz is locked", async () => {
      const { act, read } = await seed(openHunt(true))
      const ante = await read()
      await expectRefusal(act({ kind: 'set_q1_preamble', q1_preamble: 'See the note.' }), 'quizLocked')
      expect(await read()).to.deep.eq(ante)
    })
  })

  describe("add_question", () => {
    it("appends a blank question to the end", async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      await act({ kind: 'add_question' })
      const after = openOf(await read())
      expect(after.questions.slice(0, 2).map((question) => question.title)).to.deep.eq(['a', 'b'])
      expect(after.questions).to.have.length(3)
      expect(present(after.questions[2]).clueing).to.eq('')
    })

    it("refuses while the quiz is locked", async () => {
      const { act, read } = await seed(openHunt(true))
      await expectRefusal(act({ kind: 'add_question' }), 'quizLocked')
      expect(openOf(await read()).questions).to.have.length(BlankQuestionQty)
    })
  })

  describe("edit_question", () => {
    it("rewrites only the named question, and only the named fields", async () => {
      const { act, read } = await seed(openHunt())
      const target = present(openOf(await read()).questions[1])
      await act({ kind: 'edit_question', question_id: target._id, patch: { clueing: 'Which région?' } })
      const after = openOf(await read())
      expect([after.questions[1]?.clueing, after.questions[1]?.hint, after.questions[0]?.clueing]).to.deep.eq(['Which région?', '', ''])
    })

    it("refuses a question that is not in the quiz, leaving the quiz alone", async () => {
      const { act, read } = await seed(openHunt())
      const elsewhere = await seed(openHunt())
      const ante = await read()
      const stranger = firstOf(await elsewhere.read())
      await expectRefusal(act({ kind: 'edit_question', question_id: stranger._id, patch: { clueing: 'x' } }), 'questionGone')
      expect(await read()).to.deep.eq(ante)
      expect(firstOf(await elsewhere.read()).clueing).to.eq('')
    })

    it("ignores fields the patch does not mention", async () => {
      const { act, read } = await seed(openHunt())
      const ante = await read()
      await act({ kind: 'edit_question', question_id: firstOf(ante)._id, patch: {} })
      expect(await read()).to.deep.eq(ante)
    })

    it("refuses text the model rejects rather than storing it, saying why in our words", async () => {
      const { act, read } = await seed(openHunt())
      const ante = await read()
      const err = await refusalOf(act({ kind: 'edit_question', question_id: firstOf(ante)._id, patch: { title: 'x'.repeat(201) } }))
      expect(err).to.be.instanceOf(ConvexError)
      const [issue] = ZodRefusal.parse(err instanceof ConvexError ? err.data : null).ZodError
      expect(issue).to.deep.include({ path: ['action', 'patch', 'title'], message: 'is too long: «201» characters vs «82» available' })
      expect(await read()).to.deep.eq(ante)
    })

    it("chains to another question, held by that question's label", async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      const [first, second] = openOf(await read()).questions
      await act({ kind: 'edit_question', question_id: present(first)._id, patch: { chains_to: present(second)._id } })
      expect(firstOf(await read()).chains_to).to.eq(present(second)._id)
    })

    it("refuses while the quiz is locked", async () => {
      const { act, read } = await seed(openHunt(true))
      const ante = await read()
      await expectRefusal(act({ kind: 'edit_question', question_id: firstOf(ante)._id, patch: { clueing: 'x' } }), 'quizLocked')
      expect(await read()).to.deep.eq(ante)
    })
  })

  describe("sort_questions", () => {
    it("commits the new order into the quiz rather than draping it over the top", async () => {
      const { act, read } = await seed(huntOf(['3', 'cherry'], ['1', 'apple'], ['2', 'banana']))
      await act({ kind: 'sort_questions', sortkey: 'column:title', descending: false })
      expect(titlesOf(await read())).to.deep.eq(['apple', 'banana', 'cherry'])
    })

    it("remembers which column put the quiz in this order", async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      await act({ kind: 'sort_questions', sortkey: 'column:qnum', descending: false })
      expect(openOf(await read()).last_sortkey).to.eq('column:qnum')
    })

    it("reverses when asked", async () => {
      const { act, read } = await seed(huntOf(['3', 'cherry'], ['1', 'apple'], ['2', 'banana']))
      await act({ kind: 'sort_questions', sortkey: 'column:title', descending: true })
      expect(titlesOf(await read())).to.deep.eq(['cherry', 'banana', 'apple'])
    })

    it("sorts by what a widgeting works out, with the widgets the library holds", async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b'], ['3', 'c']))
      const [first, second, third] = openOf(await read()).questions
      const clueings: [string, string][] = [[present(first)._id, 'one two three'], [present(second)._id, 'one'], [present(third)._id, 'one two']]
      for (const [question_id, clueing] of clueings) { await act({ kind: 'edit_question', question_id, patch: { clueing } }) }
      await act({ kind: 'add_widgeting', widgeting: { widget_label: 'clueing_word_count', label: 'words' } })
      await act({ kind: 'add_column', column: { label: 'words', title: 'Words', source: 'words', width_px: 60 } })
      await act({ kind: 'sort_questions', sortkey: 'column:words', descending: false })
      expect(titlesOf(await read())).to.deep.eq(['b', 'c', 'a'])
    })

    it("refuses while the quiz is locked", async () => {
      const { act, read } = await seed(lockedAll(huntOf(['3', 'cherry'], ['1', 'apple'])))
      await expectRefusal(act({ kind: 'sort_questions', sortkey: 'column:title', descending: false }), 'quizLocked')
      expect(titlesOf(await read())).to.deep.eq(['cherry', 'apple'])
    })
  })

  describe("renumber_qnums", () => {
    it("tidies the numbers with no question moving", async () => {
      const { act, read } = await seed(huntOf(['4', 'd'], ['3.3', 'c'], ['6', 'f'], ['1', 'a']))
      await act({ kind: 'renumber_qnums' })
      const after = await read()
      expect(qnumsOf(after)).to.deep.eq(['3', '2', '4', '1'])
      expect(titlesOf(after)).to.deep.eq(['d', 'c', 'f', 'a'])
    })

    it("does not claim the quiz is now in Q# order, which would immediately re-sort it", async () => {
      const { act, read } = await seed(huntOf(['4', 'd'], ['1', 'a']))
      await act({ kind: 'sort_questions', sortkey: 'column:title', descending: false })
      await act({ kind: 'renumber_qnums' })
      expect(openOf(await read()).last_sortkey).to.eq('column:title')
    })

    it("refuses while the quiz is locked", async () => {
      const { act, read } = await seed(lockedAll(huntOf(['4', 'd'])))
      await expectRefusal(act({ kind: 'renumber_qnums' }), 'quizLocked')
      expect(qnumsOf(await read())).to.deep.eq(['4'])
    })
  })

  describe("move_question", () => {
    it("moves the question and renumbers everything by its new position", async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b'], ['3', 'c']))
      const dragged = present(openOf(await read()).questions[2])
      await act({ kind: 'move_question', question_id: dragged._id, onto_idx: 0 })
      const after = await read()
      expect(titlesOf(after)).to.deep.eq(['c', 'a', 'b'])
      expect(qnumsOf(after)).to.deep.eq(['1', '2', '3'])
    })

    it("adopts a question that had no Q# into the sequence", async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['', 'b']))
      const dragged = present(openOf(await read()).questions[1])
      await act({ kind: 'move_question', question_id: dragged._id, onto_idx: 0 })
      expect(qnumsOf(await read())).to.deep.eq(['1', '2'])
    })

    it("leaves the quiz in Q# order, which is the only order a drag is offered in", async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      await act({ kind: 'move_question', question_id: firstOf(await read())._id, onto_idx: 1 })
      expect(openOf(await read()).last_sortkey).to.eq('column:qnum')
    })
  })

  describe("the quiz's order of its questions", () => {
    it("names every question of the quiz exactly once, whatever adds, moves, sorts, deletes or replaces them", async () => {
      const { act, read, tt, open } = await seed(huntOf(['1', 'a'], ['2', 'b'], ['3', 'c']))
      /** The order and the quiz's questions found by their index are the same ids, none twice */
      const expectOrderHolds = async () => {
        const [ordered, held] = await tt.run(async (ctx) => {
          const quiz = present(await ctx.db.get('quizzes', open.quiz_id))
          const rows = await ctx.db.query('questions').withIndex('by_quiz_id', (cvx) => cvx.eq('quiz_id', open.quiz_id)).collect()
          return [quiz.row_ordering.toSorted(byId), rows.map((row) => row._id).toSorted(byId)]
        })
        expect(ordered).to.deep.eq(held)
      }
      await act({ kind: 'add_question' })
      await expectOrderHolds()
      await act({ kind: 'move_question', question_id: firstOf(await read())._id, onto_idx: 2 })
      await expectOrderHolds()
      await act({ kind: 'sort_questions', sortkey: 'column:title', descending: true })
      await expectOrderHolds()
      await act({ kind: 'delete_questions', question_ids: [firstOf(await read())._id] })
      await expectOrderHolds()
      await act({ kind: 'import_questions', questions: [{ label: 'fresh_one', patch: {} }] })
      await expectOrderHolds()
      expect(titlesOf(await read())).to.have.length(4)
    })
  })

  describe("delete_questions", () => {
    it("deletes the named questions, and the rest close ranks keeping their Q#s", async () => {
      const { tt, act, read } = await seed(huntOf(['1', 'a'], ['2', 'b'], ['3', 'c'], ['4', 'd']))
      const [, second, , fourth] = openOf(await read()).questions
      await act({ kind: 'delete_questions', question_ids: [present(second)._id, present(fourth)._id] })
      const after = await read()
      expect(titlesOf(after)).to.deep.eq(['a', 'c'])
      expect(qnumsOf(after)).to.deep.eq(['1', '3'])
      await expectSound(tt)
    })

    it("takes each deleted question's replies with it, and leaves the others' alone", async () => {
      const { act, read, tt } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      const [first, second] = openOf(await read()).questions
      await act({ kind: 'record_widgeted', widgeted: found(present(first)._id, 1) })
      await act({ kind: 'record_widgeted', widgeted: found(present(second)._id, 2) })
      await act({ kind: 'delete_questions', question_ids: [present(first)._id] })
      const widgeteds = await tt.run(async (ctx) => await ctx.db.query('widgeteds').collect())
      expect(widgeteds.map((widgeted) => widgeted.question_id)).to.deep.eq([present(second)._id])
      await expectSound(tt)
    })

    it("takes each deleted question's reviewings with it, and leaves the others' alone", async () => {
      const { tt, act, asAlice, quiz_id, first, second } = await reviewed()
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { get_rate: 10 } })
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: second, patch: { get_rate: 20 } })
      await act({ kind: 'delete_questions', question_ids: [first] })
      expect(await reviewingsIn(tt)).to.deep.eq([{ ...Unsaid, question_id: second, get_rate: 20 }])
      await expectSound(tt)
    })

    it("clears a chain to a deleted question, so a later question answering to its label does not inherit it", async () => {
      const { tt, act, read } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      const [first, second] = openOf(await read()).questions
      await act({ kind: 'set_chain', question_id: present(first)._id, chains_to: present(second)._id })
      await act({ kind: 'delete_questions', question_ids: [present(second)._id] })
      expect(firstOf(await read()).chains_to).to.be.null
      await expectSound(tt)
    })

    it("passes over an id that names no question of the quiz", async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      const elsewhere = await seed(huntOf(['1', 'z']))
      await act({ kind: 'delete_questions', question_ids: [firstOf(await elsewhere.read())._id] })
      expect(titlesOf(await read())).to.deep.eq(['a', 'b'])
      expect(titlesOf(await elsewhere.read())).to.deep.eq(['z'])
    })

    it("can empty the quiz", async () => {
      const { tt, act, read } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      await act({ kind: 'delete_questions', question_ids: openOf(await read()).questions.map((question) => question._id) })
      expect(titlesOf(await read())).to.deep.eq([])
      await expectSound(tt)
    })

    it("refuses while the quiz is locked", async () => {
      const { act, read } = await seed(openHunt(true))
      const doomed = firstOf(await read())
      await expectRefusal(act({ kind: 'delete_questions', question_ids: [doomed._id] }), 'quizLocked')
      expect(openOf(await read()).questions).to.have.length(BlankQuestionQty)
    })
  })

  describe("set_chain", () => {
    it("chains one question to another, which the quiz then shows", async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      const [first, second] = openOf(await read()).questions
      await act({ kind: 'set_chain', question_id: present(first)._id, chains_to: present(second)._id })
      expect(firstOf(await read()).chains_to).to.eq(present(second)._id)
    })

    it("unchains with null", async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      const [first, second] = openOf(await read()).questions
      await act({ kind: 'set_chain', question_id: present(first)._id, chains_to: present(second)._id })
      await act({ kind: 'set_chain', question_id: present(first)._id, chains_to: null })
      expect(firstOf(await read()).chains_to).to.be.null
    })

    it("clears a chain to itself, or to no question of the quiz, rather than keeping it", async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      const first = firstOf(await read())
      await act({ kind: 'set_chain', question_id: first._id, chains_to: first._id })
      expect(firstOf(await read()).chains_to).to.be.null
      const elsewhere = await seed(huntOf(['1', 'z']))
      await act({ kind: 'set_chain', question_id: first._id, chains_to: firstOf(await elsewhere.read())._id })
      expect(firstOf(await read()).chains_to).to.be.null
    })
  })

  describe("sort_by_chain_order", () => {
    it("walks the chains from the lowest Q#, and remembers doing so", async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b'], ['3', 'c']))
      const [first, , third] = openOf(await read()).questions
      await act({ kind: 'set_chain', question_id: present(first)._id, chains_to: present(third)._id })
      await act({ kind: 'sort_by_chain_order', descending: false })
      const after = await read()
      expect(titlesOf(after)).to.deep.eq(['a', 'c', 'b'])
      expect(openOf(after).last_sortkey).to.eq('chain_order')
    })
  })

  describe("record_widgeted", () => {
    it("stores a value in its own cell: the newest row of that widgeting for that question", async () => {
      const { tt, act, read } = await seed(huntOf(['1', 'a']))
      const { _id: id } = firstOf(await read())
      await act({ kind: 'record_widgeted', widgeted: found(id, 1994, 'numnum_hint') })
      const cell = present(cellOf(await read(), 'numnum_hint'))
      expect(cell.newest).to.deep.include({ status: 'ok', value: { items: [{ text: '1994', value: 1994, kind: 'numeral' }] }, message: null })
      expect(cell.ok).to.deep.eq(cell.newest)
      expect(cellOf(await read(), 'numnum_clueing')).to.be.null
      await expectSound(tt)
    })

    it("stores a guess, with how it ran", async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      const { _id: id } = firstOf(await read())
      await act({ kind: 'record_widgeted', widgeted: { ...guessed(id, 'Leon'), result_meta: { model_tier_applied: 'quick', approx_tokens: 12 } } })
      expect(cellOf(await read(), 'dumdum')?.newest).to.deep.include({ value: { guess: 'Leon', explanation: '' }, result_meta: { model_tier_applied: 'quick', approx_tokens: 12 } })
    })

    it("keeps what came before as history, the newest on top", async () => {
      const { act, read, tt } = await seed(huntOf(['1', 'a']))
      const { _id: id } = firstOf(await read())
      await act({ kind: 'record_widgeted', widgeted: guessed(id, 'Leon') })
      await act({ kind: 'record_widgeted', widgeted: guessed(id, 'Lyon') })
      expect(cellOf(await read(), 'dumdum')?.newest.value).to.deep.eq({ guess: 'Lyon', explanation: '' })
      const widgeteds = await tt.run(async (ctx) => await ctx.db.query('widgeteds').collect())
      expect(widgeteds).to.have.lengthOf(2)
    })

    it("refuses while the quiz is locked", async () => {
      const { act, read } = await seed(lockedAll(huntOf(['1', 'a'])))
      const asked = firstOf(await read())
      await expectRefusal(act({ kind: 'record_widgeted', widgeted: found(asked._id, 1) }), 'quizLocked')
      expect(firstOf(await read()).stored).to.deep.eq({})
    })

    it("refuses a question of another quiz", async () => {
      const { act, read } = await seed(huntHolding(['one', 'two'].map((title) => ({ ...Quiz.blank(title), ...classicLayout() }))))
      const other = present(quizNamed(await read(), 'two').questions[0])
      await expectRefusal(act({ kind: 'record_widgeted', widgeted: found(other._id, 1) }), 'questionGone')
    })

    it("refuses a widgeting the quiz does not have", async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      const ante = await read()
      const { _id: id } = firstOf(ante)
      await expectRefusal(act({ kind: 'record_widgeted', widgeted: found(id, 1, 'numnum_gone') }), 'widgetingGone')
      expect(await read()).to.deep.eq(ante)
    })

    it("refuses a widgeting whose widget works its values out rather than storing them", async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      const ante = await read()
      const { _id: id } = firstOf(ante)
      await expectRefusal(act({ kind: 'record_widgeted', widgeted: recorded(id, { widgeting_label: 'clueing_full', value: 7 }) }), 'notStored')
      expect(await read()).to.deep.eq(ante)
    })

    it("refuses an ok widgeted that carries a failure message, at the door", async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      const ante = await read()
      const { _id: id } = firstOf(ante)
      const err = await refusalOf(act({ kind: 'record_widgeted', widgeted: recorded(id, { message: 'But also no.' }) }))
      expect(ZodRefusal.parse(err instanceof ConvexError ? err.data : null).ZodError.map((issue) => issue.path)).to.deep.eq([['action', 'widgeted', 'message']])
      expect(await read()).to.deep.eq(ante)
    })
  })

  describe("enter_widgeted", () => {

    it("keeps what was typed as the cell's one row, trimmed as a note is", async () => {
      const { act, read, id } = await withEntries()
      await act(entering(id, 'remark', '  Ask Flip.  '))
      const cell = present(cellOf(await read(), 'remark'))
      expect(cell.newest).to.deep.include({ status: 'ok', value: 'Ask Flip.', message: null, result_meta: {} })
      expect(cell.ok).to.deep.eq(cell.newest)
    })

    it("revises the one row in place when typed into again, rather than keeping a history", async () => {
      const { act, read, tt, id } = await withEntries()
      await act(entering(id, 'points', 3))
      await act(entering(id, 'points', -1.5))
      expect(cellOf(await read(), 'points')?.newest.value).to.eq(-1.5)
      expect(await valuesIn(tt)).to.deep.eq(['-1.5'])
    })

    it("keeps one row a cell, apart from the question's other cells and the other questions'", async () => {
      const { act, tt, id, second } = await withEntries()
      await act(entering(id, 'remark', 'One.'))
      await act(entering(id, 'points', 1))
      await act(entering(second, 'remark', 'Two.'))
      await act(entering(id, 'remark', 'Once more.'))
      expect(await valuesIn(tt)).to.deep.eq(['"Once more."', '"Two."', '1'])
    })

    it("empties a cell, leaving no row, for nothing typed; and emptying an empty cell is nothing", async () => {
      const { act, read, tt, id } = await withEntries()
      await act(entering(id, 'remark', 'Ask Flip.'))
      await act(entering(id, 'remark', null))
      expect(cellOf(await read(), 'remark')).to.be.null
      await act(entering(id, 'remark', null))
      expect(await valuesIn(tt)).to.deep.eq([])
    })

    it("holds what was typed to the entry's kind", async () => {
      const { act, read, id } = await withEntries()
      const ante = await read()
      await refusalOf(act(entering(id, 'points', 'three')))
      await refusalOf(act(entering(id, 'remark', 3)))
      const blank = ' '.repeat(3)
      await refusalOf(act(entering(id, 'remark', blank)))
      expect(await read()).to.deep.eq(ante)
    })

    it("keeps a question's category estimates as the cell's one row, each difficulty medium unless said", async () => {
      const { act, actOnLibrary, read, id } = await withEntries()
      await putEntryToWork({ act, actOnLibrary }, 'cats', 'estimates')
      await act(entering(id, 'cats', [{ category: 'tv', difficulty: 'hard' }, { category: 'art' }]))
      await act(entering(id, 'cats', [{ category: 'tv', difficulty: 'hard' }, { category: 'art', difficulty: 'easy' }]))
      expect(cellOf(await read(), 'cats')?.newest.value).to.deep.eq([{ category: 'tv', difficulty: 'hard' }, { category: 'art', difficulty: 'easy' }])
    })

    it("refuses estimates that name a category twice, or set no category in particular beside one", async () => {
      const { act, actOnLibrary, read, id } = await withEntries()
      await putEntryToWork({ act, actOnLibrary }, 'cats', 'estimates')
      const ante = await read()
      await refusalOf(act(entering(id, 'cats', [{ category: 'tv' }, { category: 'tv', difficulty: 'hard' }])))
      await refusalOf(act(entering(id, 'cats', [{ category: null }, { category: 'tv' }])))
      await refusalOf(act(entering(id, 'remark', [{ category: 'tv' }])))
      expect(await read()).to.deep.eq(ante)
    })

    it("refuses a widgeting whose widget is not an entry: a formula's, or a prompt's", async () => {
      const { act, read, id } = await withEntries()
      const ante = await read()
      await expectRefusal(act(entering(id, 'clueing_full', 7)), 'notEntered')
      await expectRefusal(act(entering(id, 'dumdum', 'Leon')), 'notEntered')
      expect(await read()).to.deep.eq(ante)
    })

    it("is never recorded as an ask, so nothing can append to an entry's cell", async () => {
      const { act, read, id } = await withEntries()
      const ante = await read()
      await expectRefusal(act({ kind: 'record_widgeted', widgeted: recorded(id, { widgeting_label: 'remark', value: 'Asked?' }) }), 'notStored')
      expect(await read()).to.deep.eq(ante)
    })

    it("refuses a widgeting the quiz does not have, and a question of another quiz", async () => {
      const { act, read, id } = await withEntries()
      const ante = await read()
      await expectRefusal(act(entering(id, 'gone', 'x')), 'widgetingGone')
      const elsewhere = await seed(huntOf(['1', 'z']))
      const intruding = entering(firstOf(await elsewhere.read())._id, 'remark', 'x')
      await expectRefusal(act(intruding), 'questionGone')
      expect(await read()).to.deep.eq(ante)
    })

    it("refuses while the quiz is locked", async () => {
      const { act, read, id } = await withEntries()
      await act({ kind: 'set_lock', quiz_id: openOf(await read())._id, locked: true })
      await expectRefusal(act(entering(id, 'remark', 'Ask Flip.')), 'quizLocked')
      expect(cellOf(await read(), 'remark')).to.be.null
    })

    it("goes with the question when it is deleted, and with the widgeting when that is removed", async () => {
      const { act, tt, id, second } = await withEntries()
      await act(entering(id, 'remark', 'One.'))
      await act(entering(second, 'remark', 'Two.'))
      await act(entering(second, 'points', 2))
      await act({ kind: 'delete_questions', question_ids: [id] })
      expect(await valuesIn(tt)).to.deep.eq(['"Two."', '2'])
      await act({ kind: 'delete_widgeting', label: 'remark' })
      expect(await valuesIn(tt)).to.deep.eq(['2'])
    })
  })

  describe("a failed ask", () => {
    const err = { message: 'A connection hiccup — try again.', response: { ok: false, failurekind: 'connection' } }


    it("leaves the value as it was, and rides along on it as the newer row", async () => {
      const { act, read, id } = await withHeld()
      await act({ kind: 'record_widgeted', widgeted: failed(id, 'dumdum', err) })
      const cell = present(cellOf(await read(), 'dumdum'))
      expect(cell.ok).to.deep.include({ status: 'ok', value: { guess: 'Leon', explanation: '' } })
      expect(cell.newest).to.deep.include({ status: 'errored', value: null, message: err.message, result_meta: { response: err.response } })
    })

    it("becomes the cell's only content when it never had a value", async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      const { _id: id } = firstOf(await read())
      await act({ kind: 'record_widgeted', widgeted: failed(id, 'dumdum', err) })
      const cell = present(cellOf(await read(), 'dumdum'))
      expect(cell.newest).to.deep.include({ status: 'errored', message: err.message })
      expect(cell.ok).to.be.null
    })

    it("is replaced by a newer failure, not stacked", async () => {
      const { act, read, id } = await withHeld()
      await act({ kind: 'record_widgeted', widgeted: failed(id, 'dumdum', err) })
      await act({ kind: 'record_widgeted', widgeted: failed(id, 'dumdum', { ...err, message: 'Still no connection.' }) })
      const cell = present(cellOf(await read(), 'dumdum'))
      expect(cell.ok?.value).to.deep.eq({ guess: 'Leon', explanation: '' })
      expect(cell.newest.message).to.eq('Still no connection.')
    })

    it("is cleared by any success", async () => {
      const { act, read, id } = await withHeld()
      await act({ kind: 'record_widgeted', widgeted: failed(id, 'dumdum', err) })
      await act({ kind: 'record_widgeted', widgeted: guessed(id, 'Lyon') })
      const cell = present(cellOf(await read(), 'dumdum'))
      expect(cell.newest).to.deep.include({ status: 'ok', value: { guess: 'Lyon', explanation: '' }, message: null })
      expect(cell.ok).to.deep.eq(cell.newest)
    })

    it("stays as it was when the text is edited", async () => {
      const { act, read, id } = await withHeld()
      await act({ kind: 'record_widgeted', widgeted: failed(id, 'dumdum', err) })
      const ante = cellOf(await read(), 'dumdum')
      await act({ kind: 'edit_question', question_id: id, patch: { clueing: 'Reworded' } })
      expect(cellOf(await read(), 'dumdum')).to.deep.eq(ante)
    })

    it("is refused while the quiz is locked", async () => {
      const { act, read } = await seed(lockedAll(huntOf(['1', 'a'])))
      const asked = firstOf(await read())
      await expectRefusal(act({ kind: 'record_widgeted', widgeted: failed(asked._id, 'dumdum', err) }), 'quizLocked')
      expect(cellOf(await read(), 'dumdum')).to.be.null
    })
  })

  describe("new_quiz", () => {
    it("adds a quiz to the open quiz's realm, leaving the open quiz as it was", async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      const ante = await read()
      await act({ kind: 'new_quiz' })
      const after = await read()
      expect(after.quizzes).to.have.length(2)
      expect(openOf(after)).to.deep.eq(openOf(ante))
    })

    it("starts the new quiz with the same blank questions a fresh hunt has", async () => {
      const { tt, act, read } = await seed(huntOf(['1', 'a']))
      await act({ kind: 'new_quiz' })
      expect(newestOf(await read()).questions).to.have.length(BlankQuestionQty)
      await expectSound(tt)
    })

    it("works from a locked quiz", async () => {
      const { act, read } = await seed(huntTitled(['one'], 0))
      await act({ kind: 'new_quiz' })
      const { quizzes } = await read()
      expect(quizzes).to.have.length(2)
    })

    it("starts the new quiz lean: the starter columns, and no widgetings", async () => {
      const { act, read } = await seed(openHunt())
      await act({ kind: 'new_quiz' })
      const newest = newestOf(await read())
      expect([newest.widgetings, newest.columns]).to.deep.eq([[], defaultLayout().columns])
    })

    it("leaves the library as it was, even one lacking every widget a classic quiz works", async () => {
      const { act, actOnLibrary, read } = await seed(openHunt())
      await actOnLibrary({ kind: 'delete_widget', label: 'hint_full' })
      await actOnLibrary({ kind: 'delete_widget', label: 'dumdum' })
      const ante = await read()
      await act({ kind: 'new_quiz' })
      const { library } = await read()
      expect(library).to.deep.eq(ante.library)
    })

    it("starts the new quiz under the label it is given", async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      await act({ kind: 'new_quiz', label: 'princes' })
      expect(newestOf(await read()).label).to.eq('princes')
    })

    it("refuses a label a quiz already answers to, rather than making a second quiz at one address", async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      await act({ kind: 'new_quiz', label: 'princes' })
      const ante = await read()
      await expectRefusal(act({ kind: 'new_quiz', label: 'princes' }), 'labelTaken')
      expect(await read()).to.deep.eq(ante)
    })

    it("counts a label another quiz was given as taken", async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      await act({ kind: 'relabel_quiz', label: 'leon' })
      const ante = await read()
      await expectRefusal(act({ kind: 'new_quiz', label: 'leon' }), 'labelTaken')
      expect(await read()).to.deep.eq(ante)
    })
  })

  describe("delete_quiz", () => {
    it("removes the quiz and everything it held, and leaves the library alone", async () => {
      const { tt, act, read } = await seed(huntHolding(['one', 'two', 'three'].map((title) => ({ ...Quiz.blank(title), ...classicLayout() }))), 1)
      const ante = await read()
      const doomed = quizNamed(ante, 'two')._id
      const asked = present(quizNamed(ante, 'two').questions[0])
      await act({ kind: 'record_widgeted', widgeted: guessed(asked._id, 'gone') })
      await act({ kind: 'delete_quiz', quiz_id: doomed })
      const after = await read()
      expect(after.quizzes.map((quiz) => quiz.title)).to.deep.eq(['one', 'three'])
      const ofDoomed = (rows: readonly { quiz_id: string }[]) => rows.filter((row) => row.quiz_id === doomed).length
      const left = await tt.run(async (ctx) => {
        const [questions, widgetings, columns, widgeteds] = await Promise.all([
          ctx.db.query('questions').collect(), ctx.db.query('widgetings').collect(), ctx.db.query('columns').collect(), ctx.db.query('widgeteds').collect(),
        ])
        return { questions: ofDoomed(questions), widgetings: ofDoomed(widgetings), columns: ofDoomed(columns), widgeteds: widgeteds.length }
      })
      expect(left).to.deep.eq({ questions: 0, widgetings: 0, columns: 0, widgeteds: 0 })
      expect(after.library).to.deep.eq(ante.library)
      await expectSound(tt)
    })

    it("takes the quiz's reviews and their reviewings with it", async () => {
      const { tt, act, asAlice, quiz_id, first } = await reviewed(huntTitled(['one', 'two']))
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { get_rate: 10 } })
      await act({ kind: 'delete_quiz', quiz_id })
      const [reviews, reviewings] = await tt.run(async (ctx) => [await ctx.db.query('reviews').collect(), await ctx.db.query('reviewings').collect()])
      expect([reviews, reviewings]).to.deep.eq([[], []])
      await expectSound(tt)
    })

    it("refuses to delete the realm's last quiz", async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      const ante = await read()
      await expectRefusal(act({ kind: 'delete_quiz', quiz_id: openOf(ante)._id }), 'lastQuiz')
      expect(await read()).to.deep.eq(ante)
    })

    it("leaves the open quiz alone when some other quiz goes", async () => {
      const { act, read } = await seed(huntTitled(['one', 'two']), 0)
      await act({ kind: 'delete_quiz', quiz_id: quizNamed(await read(), 'two')._id })
      expect(openOf(await read()).title).to.eq('one')
    })

    it("refuses a quiz of another hunt, as not the actor's to change", async () => {
      const mine = await seed(huntTitled(['one', 'two']), 0)
      const theirs = await seed(huntTitled(['three', 'four']), 0)
      const ante = await theirs.read()
      await expectRefusal(mine.act({ kind: 'delete_quiz', quiz_id: quizNamed(ante, 'four')._id }), 'notPermitted')
      expect(await theirs.read()).to.deep.eq(ante)
    })

    it("refuses a quiz of another realm of the hunt", async () => {
      const { act, tt, open } = await seed(huntTitled(['one', 'two']), 0)
      const elsewhere = await tt.run(async (ctx) => {
        const realm_id = await ctx.db.insert('realms', { hunt_id: open.hunt_id, label: 'away', title: '', position: 1 })
        return await ctx.db.insert('quizzes', { hunt_id: open.hunt_id, realm_id, title: '', label: 'far_quiz', smiths_note: '', q1_preamble: '', locked: false, last_sortkey: null, row_ordering: [] })
      })
      await expectRefusal(act({ kind: 'delete_quiz', quiz_id: elsewhere }), 'notInRealm')
      expect(await tt.run(async (ctx) => await ctx.db.get('quizzes', elsewhere))).to.not.be.null
    })
  })

  describe("set_lock", () => {
    it("freezes a quiz", async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      await act({ kind: 'set_lock', quiz_id: openOf(await read())._id, locked: true })
      expect(openOf(await read()).locked).to.be.true
    })

    it("unfreezes one, from inside the lock", async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      const quiz_id = openOf(await read())._id
      await act({ kind: 'set_lock', quiz_id, locked: true })
      await act({ kind: 'set_lock', quiz_id, locked: false })
      expect(openOf(await read()).locked).to.be.false
    })

    it("leaves the quiz exactly as it was", async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      const ante = await read()
      await act({ kind: 'set_lock', quiz_id: openOf(ante)._id, locked: true })
      await act({ kind: 'set_lock', quiz_id: openOf(ante)._id, locked: false })
      expect(openOf(await read()).questions).to.deep.eq(openOf(ante).questions)
    })
  })

  describe("open_review", () => {
    it("opens an empty review for the acting ident", async () => {
      const { act, read, tt, join } = await seed(huntOf(['1', 'a']))
      const member = await join('alice_reviews', 'reviewer')
      const quiz_id = openOf(await read())._id
      await act({ kind: 'open_review', quiz_id }, member)
      const reviews = await reviewsIn(tt, quiz_id)
      expect(reviews.map((review) => [review.ident_id, review.overall, review.phase])).to.deep.eq([[member.ident_id, '', 'empty']])
    })

    it("is idempotent: opening it again writes nothing new", async () => {
      const { act, read, tt, join } = await seed(huntOf(['1', 'a']))
      const member = await join('alice_reviews', 'reviewer')
      const quiz_id = openOf(await read())._id
      await act({ kind: 'open_review', quiz_id }, member)
      await act({ kind: 'open_review', quiz_id }, member)
      expect(await reviewsIn(tt, quiz_id)).to.have.length(1)
    })

    it("gives each ident its own review of the same quiz", async () => {
      const { act, read, tt, join } = await seed(huntOf(['1', 'a']))
      const quiz_id = openOf(await read())._id
      const [alice, bob] = [await join('alice_reviews', 'reviewer'), await join('bob_reviews', 'reviewer')]
      await act({ kind: 'open_review', quiz_id }, alice)
      await act({ kind: 'open_review', quiz_id }, bob)
      const reviews = await reviewsIn(tt, quiz_id)
      expect(reviews.map((review) => review.ident_id)).to.deep.eq([alice.ident_id, bob.ident_id])
    })

    it("works on a locked quiz, since reviewing one is the point", async () => {
      const { act, read, tt, join } = await seed(openHunt(true))
      const member = await join('alice_reviews', 'reviewer')
      const quiz_id = openOf(await read())._id
      await act({ kind: 'open_review', quiz_id }, member)
      expect(await reviewsIn(tt, quiz_id)).to.have.length(1)
    })

    it("refuses a session that has asserted no username, writing nothing", async () => {
      const { act, read, tt } = await seed(huntOf(['1', 'a']))
      const quiz_id = openOf(await read())._id
      await expectRefusal(act({ kind: 'open_review', quiz_id }, await signedIn(tt)), 'notIdentified')
      expect(await reviewsIn(tt, quiz_id)).to.deep.eq([])
    })

    it("reviews as the ident the session asserted last, and turns away a browser still affirming the one before", async () => {
      const { act, read, tt, open, join } = await seed(huntOf(['1', 'a']))
      const alice = await join('alice_reviews', 'reviewer')
      const otherself = await alice.as.mutation(api.idents.performAccount, { action: { kind: 'assume_ident', label: 'alice_otherself', title: '' } }) as Id<'idents'>
      await putOn(tt, open.hunt_id, otherself, 'reviewer')
      const quiz_id = openOf(await read())._id
      await expectRefusal(act({ kind: 'open_review', quiz_id }, alice), 'notPermitted')
      const { action: affirms } = await affirmsOf(tt, { ident_id: otherself }, open)
      await alice.as.mutation(api.hunts.perform, { affirms, action: { kind: 'open_review', quiz_id } })
      const reviews = await reviewsIn(tt, quiz_id)
      expect(reviews.map((review) => review.ident_id)).to.deep.eq([otherself])
    })
  })

  describe("set_overall", () => {
    it("writes the note and moves an empty review to draft", async () => {
      const { act, read, tt, join } = await seed(huntOf(['1', 'a']))
      const member = await join('alice_reviews', 'reviewer')
      const quiz_id = openOf(await read())._id
      await act({ kind: 'open_review', quiz_id }, member)
      await act({ kind: 'set_overall', quiz_id, overall: 'Went well.' }, member)
      const [review] = await reviewsIn(tt, quiz_id)
      expect([review?.overall, review?.phase]).to.deep.eq(['Went well.', 'draft'])
    })

    it("leaves a shared review shared", async () => {
      const { act, read, tt, join } = await seed(huntOf(['1', 'a']))
      const member = await join('alice_reviews', 'reviewer')
      const quiz_id = openOf(await read())._id
      await act({ kind: 'open_review', quiz_id }, member)
      await act({ kind: 'set_review_phase', quiz_id, phase: 'shared' }, member)
      await act({ kind: 'set_overall', quiz_id, overall: 'One more thought.' }, member)
      const [review] = await reviewsIn(tt, quiz_id)
      expect([review?.overall, review?.phase]).to.deep.eq(['One more thought.', 'shared'])
    })

    it("refuses when the review has not been opened", async () => {
      const { act, read, tt, join } = await seed(huntOf(['1', 'a']))
      const member = await join('alice_reviews', 'reviewer')
      const quiz_id = openOf(await read())._id
      await expectRefusal(act({ kind: 'set_overall', quiz_id, overall: 'Too soon.' }, member), 'reviewNotOpened')
      expect(await reviewsIn(tt, quiz_id)).to.deep.eq([])
    })
  })

  describe("set_review_phase", () => {
    it("moves a review between draft and shared, both ways", async () => {
      const { act, read, tt, join } = await seed(huntOf(['1', 'a']))
      const member = await join('alice_reviews', 'reviewer')
      const quiz_id = openOf(await read())._id
      await act({ kind: 'open_review', quiz_id }, member)
      await act({ kind: 'set_review_phase', quiz_id, phase: 'shared' }, member)
      const [shared] = await reviewsIn(tt, quiz_id)
      expect(shared?.phase).to.eq('shared')
      await act({ kind: 'set_review_phase', quiz_id, phase: 'draft' }, member)
      const [withdrawn] = await reviewsIn(tt, quiz_id)
      expect(withdrawn?.phase).to.eq('draft')
    })

    it("refuses when the review has not been opened", async () => {
      const { act, read, tt, join } = await seed(huntOf(['1', 'a']))
      const member = await join('alice_reviews', 'reviewer')
      const quiz_id = openOf(await read())._id
      await expectRefusal(act({ kind: 'set_review_phase', quiz_id, phase: 'shared' }, member), 'reviewNotOpened')
      expect(await reviewsIn(tt, quiz_id)).to.deep.eq([])
    })
  })

  describe("set_reviewing", () => {
    it("makes the reviewing the first time, holding only what the patch says", async () => {
      const { tt, asAlice, quiz_id, first } = await reviewed()
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { get_rate: 40 } })
      expect(await reviewingsIn(tt)).to.deep.eq([{ ...Unsaid, question_id: first, get_rate: 40 }])
      await expectSound(tt)
    })

    it("revises it after, leaving alone what a patch leaves out", async () => {
      const { tt, asAlice, quiz_id, first } = await reviewed()
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { get_rate: 40, guesses: 'Hamlet?' } })
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { comments: 'Fair.', keep_it: true } })
      expect(await reviewingsIn(tt)).to.deep.eq([{ ...Unsaid, question_id: first, get_rate: 40, guesses: 'Hamlet?', comments: 'Fair.', keep_it: true }])
    })

    it("clears a get rate or minutes given null", async () => {
      const { tt, asAlice, quiz_id, first } = await reviewed()
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { get_rate: 40, minutes: 2.5 } })
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { get_rate: null, minutes: null } })
      expect(await reviewingsIn(tt)).to.deep.eq([{ ...Unsaid, question_id: first }])
    })

    it("keeps one reviewing per question", async () => {
      const { tt, asAlice, quiz_id, first, second } = await reviewed()
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: second, patch: { minutes: 3 } })
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { minutes: 1 } })
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: second, patch: { minutes: 4 } })
      expect(await reviewingsIn(tt)).to.deep.eq([{ ...Unsaid, question_id: second, minutes: 4 }, { ...Unsaid, question_id: first, minutes: 1 }])
    })

    it("keeps each reviewer's verdicts apart", async () => {
      const { tt, asAlice, act, quiz_id, first, join } = await reviewed()
      const bob = await join('bob_reviews', 'reviewer')
      await act({ kind: 'open_review', quiz_id }, bob)
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { get_rate: 10 } })
      await act({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { get_rate: 90 } }, bob)
      const reviewings = await tt.run(async (ctx) => await ctx.db.query('reviewings').collect())
      const reviews = await reviewsIn(tt, quiz_id)
      const rateBy = new Map(reviewings.map((reviewing) => [reviews.find((review) => review._id === reviewing.review_id)?.ident_id, reviewing.get_rate]))
      expect([rateBy.get(reviews[0]?.ident_id), rateBy.get(reviews[1]?.ident_id)]).to.deep.eq([10, 90])
    })

    it("moves an empty review to draft", async () => {
      const { tt, asAlice, quiz_id, first } = await reviewed()
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { keep_it: true } })
      const [review] = await reviewsIn(tt, quiz_id)
      expect(review?.phase).to.eq('draft')
    })

    it("leaves a shared review shared", async () => {
      const { tt, asAlice, quiz_id, first } = await reviewed()
      await asAlice({ kind: 'set_review_phase', quiz_id, phase: 'shared' })
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { keep_it: true } })
      const [review] = await reviewsIn(tt, quiz_id)
      expect(review?.phase).to.eq('shared')
    })

    it("works on a locked quiz, since reviewing one is the point", async () => {
      const { tt, asAlice, quiz_id, first } = await reviewed(openHunt(true))
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { needs_fact_check: true } })
      expect(await reviewingsIn(tt)).to.deep.eq([{ ...Unsaid, question_id: first, needs_fact_check: true }])
    })

    it("lowers a meh when the question is picked top, and a top when it is picked meh", async () => {
      const { tt, asAlice, quiz_id, first } = await reviewed()
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { elimination_candidate: true } })
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { keep_it: true } })
      expect(await reviewingsIn(tt)).to.deep.eq([{ ...Unsaid, question_id: first, keep_it: true }])
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { elimination_candidate: true } })
      expect(await reviewingsIn(tt)).to.deep.eq([{ ...Unsaid, question_id: first, elimination_candidate: true }])
    })

    const Picks = [
      ['keep_it',               'topsFull', 'a fourth top pick'],
      ['elimination_candidate', 'mehsFull', 'a fourth meh pick'],
    ] as const
    for (const [flag, failurekind, describes] of Picks) {
      it(`refuses ${describes}, writing nothing`, async () => {
        const hunt = huntOf(['1', 'a'], ['2', 'b'], ['3', 'c'], ['4', 'd'])
        const { tt, asAlice, quiz_id, read } = await reviewed(hunt)
        const question_ids = questionIdsOf(await read())
        for (const question_id of question_ids.slice(0, PA.PicksPerReview.max)) {
          await asAlice({ kind: 'set_reviewing', quiz_id, question_id, patch: { [flag]: true } })
        }
        const [ante, last] = [await reviewingsIn(tt), present(question_ids.at(-1))]
        await expectRefusal(asAlice({ kind: 'set_reviewing', quiz_id, question_id: last, patch: { [flag]: true } }), failurekind)
        expect(await reviewingsIn(tt)).to.deep.eq(ante)
      })

      it(`takes ${describes} once another is lowered, and a re-raise of one already picked`, async () => {
        const hunt = huntOf(['1', 'a'], ['2', 'b'], ['3', 'c'], ['4', 'd'])
        const { tt, asAlice, quiz_id, read } = await reviewed(hunt)
        const question_ids = questionIdsOf(await read())
        const [picked, last] = [question_ids.slice(0, PA.PicksPerReview.max), present(question_ids.at(-1))]
        for (const question_id of picked) {
          await asAlice({ kind: 'set_reviewing', quiz_id, question_id, patch: { [flag]: true } })
        }
        await asAlice({ kind: 'set_reviewing', quiz_id, question_id: present(picked[0]), patch: { [flag]: true } })
        await asAlice({ kind: 'set_reviewing', quiz_id, question_id: present(picked[0]), patch: { [flag]: false } })
        await asAlice({ kind: 'set_reviewing', quiz_id, question_id: last, patch: { [flag]: true } })
        const reviewings = await reviewingsIn(tt)
        const raised = reviewings.filter((reviewing) => reviewing[flag]).map((reviewing) => reviewing.question_id)
        expect(raised).to.deep.eq([...picked.slice(1), last])
      })
    }

    it("counts each reviewer's picks apart", async () => {
      const hunt = huntOf(['1', 'a'], ['2', 'b'], ['3', 'c'], ['4', 'd'])
      const { tt, asAlice, act, quiz_id, read, join } = await reviewed(hunt)
      const bob = await join('bob_reviews', 'reviewer')
      await act({ kind: 'open_review', quiz_id }, bob)
      const question_ids = questionIdsOf(await read())
      for (const question_id of question_ids.slice(0, PA.PicksPerReview.max)) {
        await asAlice({ kind: 'set_reviewing', quiz_id, question_id, patch: { keep_it: true } })
      }
      await act({ kind: 'set_reviewing', quiz_id, question_id: present(question_ids.at(-1)), patch: { keep_it: true } }, bob)
      const reviewings = await reviewingsIn(tt)
      expect(reviewings.filter((reviewing) => reviewing.keep_it)).to.have.lengthOf(PA.PicksPerReview.max + 1)
    })

    it("refuses a patch picking a question both ways", async () => {
      const { tt, asAlice, quiz_id, first } = await reviewed()
      const refusal = await refusalOf(asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { keep_it: true, elimination_candidate: true } }))
      expect(refusal).to.be.instanceOf(ConvexError)
      expect(await reviewingsIn(tt)).to.deep.eq([])
    })

    it("refuses when the review has not been opened, writing nothing", async () => {
      const { act, read, tt, join } = await seed(huntOf(['1', 'a']))
      const member = await join('bob_reviews', 'reviewer')
      const seen = await read()
      const [quiz_id, question_id] = [openOf(seen)._id, firstOf(seen)._id]
      await expectRefusal(act({ kind: 'set_reviewing', quiz_id, question_id, patch: { get_rate: 40 } }, member), 'reviewNotOpened')
      expect(await reviewingsIn(tt)).to.deep.eq([])
    })

    it("refuses a question that is not the quiz's, writing nothing", async () => {
      const { tt, asAlice, quiz_id } = await reviewed()
      const elsewhere = await seed(huntOf(['1', 'z']))
      const question_id = firstOf(await elsewhere.read())._id
      await expectRefusal(asAlice({ kind: 'set_reviewing', quiz_id, question_id, patch: { get_rate: 40 } }), 'questionGone')
      expect(await reviewingsIn(tt)).to.deep.eq([])
      const [review] = await reviewsIn(tt, quiz_id)
      expect(review?.phase).to.eq('empty')
    })

    it("refuses a get rate past certain at the door, writing nothing", async () => {
      const { tt, asAlice, quiz_id, first } = await reviewed()
      await expect(asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { get_rate: 101 } })).rejects.toThrow()
      expect(await reviewingsIn(tt)).to.deep.eq([])
    })

    it("refuses a session that has asserted no username", async () => {
      const { tt, act, quiz_id, first } = await reviewed()
      await expectRefusal(act({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { get_rate: 40 } }, await signedIn(tt)), 'notIdentified')
      expect(await reviewingsIn(tt)).to.deep.eq([])
    })
  })

  describe("peek_answer", () => {
    it("records that the answer was seen, making the reviewing if need be, and leaves the review's phase alone", async () => {
      const { tt, asAlice, quiz_id, first } = await reviewed()
      await asAlice({ kind: 'peek_answer', quiz_id, question_id: first })
      expect(await reviewingsIn(tt)).to.deep.eq([{ ...Unsaid, question_id: first, peeked: true }])
      const [review] = await reviewsIn(tt, quiz_id)
      expect(review?.phase).to.eq('empty')
      await expectSound(tt)
    })

    it("marks a reviewing already made, keeping what it says", async () => {
      const { tt, asAlice, quiz_id, first } = await reviewed()
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { get_rate: 40 } })
      await asAlice({ kind: 'peek_answer', quiz_id, question_id: first })
      expect(await reviewingsIn(tt)).to.deep.eq([{ ...Unsaid, question_id: first, get_rate: 40, peeked: true }])
    })

    it("sets it once: a verdict after keeps it, and peeking again changes nothing", async () => {
      const { tt, asAlice, quiz_id, first } = await reviewed()
      await asAlice({ kind: 'peek_answer', quiz_id, question_id: first })
      await asAlice({ kind: 'set_reviewing', quiz_id, question_id: first, patch: { get_rate: 90 } })
      const ante = await tt.run(async (ctx) => await ctx.db.query('reviewings').collect())
      await asAlice({ kind: 'peek_answer', quiz_id, question_id: first })
      expect(await tt.run(async (ctx) => await ctx.db.query('reviewings').collect())).to.deep.eq(ante)
      expect(await reviewingsIn(tt)).to.deep.eq([{ ...Unsaid, question_id: first, get_rate: 90, peeked: true }])
    })

    it("refuses when the review has not been opened, writing nothing", async () => {
      const { act, read, tt, join } = await seed(huntOf(['1', 'a']))
      const member = await join('bob_reviews', 'reviewer')
      const seen = await read()
      const [quiz_id, question_id] = [openOf(seen)._id, firstOf(seen)._id]
      await expectRefusal(act({ kind: 'peek_answer', quiz_id, question_id }, member), 'reviewNotOpened')
      expect(await reviewingsIn(tt)).to.deep.eq([])
    })

    it("refuses a question that is not the quiz's", async () => {
      const { tt, asAlice, quiz_id } = await reviewed()
      const elsewhere = await seed(huntOf(['1', 'z']))
      const question_id = firstOf(await elsewhere.read())._id
      await expectRefusal(asAlice({ kind: 'peek_answer', quiz_id, question_id }), 'questionGone')
      expect(await reviewingsIn(tt)).to.deep.eq([])
    })
  })

  describe("import_questions", () => {
    it("types what each question carries into its entry cells: into a question held and one added, and empties one for null", async () => {
      const seeded = await seed(huntOf(['1', 'a'], ['2', 'b']))
      const { tt, act, read } = seeded
      await putEntryToWork(seeded, 'remark')
      const [aa, bb] = openOf(await read()).questions
      await act(entering(present(bb)._id, 'remark', 'Was here.'))
      await act({ kind: 'import_questions', questions: [
        { label: present(aa).label, patch: {}, entered: { remark: 'Imported.' } },
        { label: present(bb).label, patch: {}, entered: { remark: null } },
        { label: 'fresh_one', patch: {}, entered: { remark: 'Fresh.' } },
      ] })
      expect(openOf(await read()).questions.map((question) => question.stored.remark?.ok?.value ?? null)).to.deep.eq(['Imported.', null, 'Fresh.'])
      await expectSound(tt)
    })

    it("passes over what it carries for a widgeting that is not an entry, or that the quiz does not have", async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      const first = firstOf(await read())
      await act({ kind: 'import_questions', questions: [{ label: first.label, patch: { clueing: 'Imported' }, entered: { dumdum: 'Leon', nowhere: 'x' } }] })
      expect(firstOf(await read())).to.deep.include({ clueing: 'Imported', stored: {} })
    })

    it("refuses, writing nothing, a value not of its entry's kind", async () => {
      const seeded = await seed(huntOf(['1', 'a']))
      const { act, read } = seeded
      await putEntryToWork(seeded, 'points', 'number')
      const ante = await read()
      await refusalOf(act({ kind: 'import_questions', questions: [{ label: firstOf(ante).label, patch: { clueing: 'Imported' }, entered: { points: 'three' } }] }))
      expect(await read()).to.deep.eq(ante)
    })

    it("revises the question answering to each label, adds one under a label none answers to, and deletes nothing", async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      const first = firstOf(await read())
      await act({ kind: 'import_questions', questions: [{ label: first.label, patch: { clueing: 'Imported' } }, { label: 'fresh_one', patch: { title: 'fresh' } }] })
      const after = openOf(await read())
      expect(after.questions.map((question) => [question.title, question.clueing])).to.deep.eq([['a', 'Imported'], ['b', ''], ['fresh', '']])
      expect(after.questions[0]?._id).to.eq(first._id)
    })

    it("adds each question as the open quiz's hunt's", async () => {
      const { act, tt, open } = await seed(huntOf(['1', 'a']))
      await act({ kind: 'import_questions', questions: [{ label: 'fresh_one', patch: {} }] })
      const rows = await tt.run(async (ctx) => await ctx.db.query('questions').collect())
      expect(rows.map((row) => row.hunt_id)).to.deep.eq([open.hunt_id, open.hunt_id])
    })

    it("titles a question it adds from its label, unless the paste says otherwise", async () => {
      const { act, read } = await seed(huntOf(['1', 'a']))
      await act({ kind: 'import_questions', questions: [{ label: 'fresh_one', patch: {} }] })
      expect(titlesOf(await read())).to.deep.eq(['a', 'Fresh One'])
    })

    it("writes a chain by label, to a question of the quiz or one the same import adds, and none to anything else", async () => {
      const { act, read } = await seed(huntOf(['1', 'a'], ['2', 'b']))
      const [aa, bb] = openOf(await read()).questions
      await act({ kind: 'import_questions', questions: [
        { label: present(aa).label, patch: { chains_to: 'fresh_one' } },
        { label: present(bb).label, patch: { chains_to: 'nobody' } },
        { label: 'fresh_one', patch: { chains_to: present(aa).label } },
      ] })
      const after = openOf(await read()).questions
      expect(after.map((question) => question.chains_to)).to.deep.eq([after[2]?._id, null, after[0]?._id])
    })

    it("renumbers Q# by rank afterwards, moving nothing", async () => {
      const { act, read } = await seed(huntOf(['4', 'a'], ['3.3', 'b'], ['1', 'c']))
      const first = firstOf(await read())
      await act({ kind: 'import_questions', questions: [{ label: first.label, patch: { notes: 'touched' } }] })
      expect(qnumsOf(await read())).to.deep.eq(['3', '2', '1'])
      expect(titlesOf(await read())).to.deep.eq(['a', 'b', 'c'])
    })

    it("refuses while the quiz is locked", async () => {
      const { act, read } = await seed(openHunt(true))
      const ante = await read()
      await expectRefusal(act({ kind: 'import_questions', questions: [{ label: 'fresh_one', patch: {} }] }), 'quizLocked')
      expect(await read()).to.deep.eq(ante)
    })
  })
})

/** `tree` with every id blanked, for comparing a tree with the one its rows make up */
function sansIds(tree: HuntT) {
  return {
    ...tree,
    _id:    '',
    realms: tree.realms.map((realm) => ({
      ...realm,
      _id:     '',
      quizzes: realm.quizzes.map((quiz) => ({ ...quiz, _id: '', questions: quiz.questions.map((question) => ({ ...question, _id: '' })) })),
    })),
  }
}

/** A seeded hunt whose open quiz already holds `qty` more rows of `tablename`, inserted straight */
async function crowded(tablename: 'questions' | 'widgetings' | 'columns', qty: number) {
  const seeded = await seedHunt(openTester(), huntHolding([Quiz.blank('Quiz one')]))
  const { quiz_id } = seeded.open
  const positions = Array.from({ length: qty }, (_unused, idx) => idx + BlankQuestionQty)
  await seeded.tt.run(async (ctx) => {
    for (const position of positions) {
      if (tablename === 'questions') {
        const question_id = await ctx.db.insert('questions', { hunt_id: seeded.open.hunt_id, quiz_id, label: `q_${String(position)}`, title: '', qnum: '', clueing: '', hint: '', chains_to: null, full_answer: '', alt_text: '', notes: '' })
        const quiz = present(await ctx.db.get('quizzes', quiz_id))
        await ctx.db.patch('quizzes', quiz_id, { row_ordering: [...quiz.row_ordering, question_id] })
      } else if (tablename === 'widgetings') {
        await ctx.db.insert('widgetings', { hunt_id: seeded.open.hunt_id, quiz_id, position, widget_label: 'dumdum', label: `w_${String(position)}`, description: '', params: {} })
      } else {
        await ctx.db.insert('columns', { hunt_id: seeded.open.hunt_id, quiz_id, position, label: `c_${String(position)}`, title: '', source: 'question.title', width_px: 80 })
      }
    }
  })
  return seeded
}

describe("hunts.perform, at the caps", () => {
  it("refuses a question more than a quiz may hold", async () => {
    const { act, read } = await crowded('questions', 999 - BlankQuestionQty)
    await expectRefusal(act({ kind: 'add_question' }), 'questionsFull')
    expect(openOf(await read()).questions).to.have.lengthOf(999)
  })

  it("refuses an import that would leave a quiz holding more questions than it may", async () => {
    const { act, read } = await crowded('questions', 999 - BlankQuestionQty)
    await expectRefusal(act({ kind: 'import_questions', questions: [{ label: 'one_more', patch: {} }] }), 'questionsFull')
    expect(openOf(await read()).questions).to.have.lengthOf(999)
  })

  it("refuses a widgeting more than a quiz may hold", async () => {
    const { act, tt, open } = await crowded('widgetings', PA.WidgetingsPerQuiz.max)
    await expectRefusal(act({ kind: 'add_widgeting', widgeting: { widget_label: 'dumdum', label: 'dumdum' } }), 'widgetingsFull')
    const widgetings = await tt.run(async (ctx) => await ctx.db.query('widgetings').withIndex('by_quiz_id_and_position', (cvx) => cvx.eq('quiz_id', open.quiz_id)).collect())
    expect(widgetings).to.have.lengthOf(PA.WidgetingsPerQuiz.max)
  })

  it("refuses a column more than a quiz may hold", async () => {
    const { act, tt, open } = await crowded('columns', 99)
    await expectRefusal(act({ kind: 'add_column', column: { label: 'one_more', title: 'One more', source: 'question.qnum', width_px: 80 } }), 'columnsFull')
    const columns = await tt.run(async (ctx) => await ctx.db.query('columns').withIndex('by_quiz_id_and_position', (cvx) => cvx.eq('quiz_id', open.quiz_id)).collect())
    expect(columns).to.have.lengthOf(99)
  })

  it("refuses a widget more than the library may hold", async () => {
    const { actOnLibrary, tt, read } = await seedHunt(openTester(), openHunt())
    await tt.run(async (ctx) => {
      const held = await ctx.db.query('widgets').collect()
      const positions = Array.from({ length: PA.WidgetsInLibrary.max - held.length }, (_unused, idx) => idx + held.length)
      for (const position of positions) {
        await ctx.db.insert('widgets', { scope: 'pub', label: `widget_${String(position)}`, title: '', description: '', formulary: 'jsonata', formula: '1', input_formula: '$', config: {}, position })
      }
    })
    await expectRefusal(actOnLibrary({ kind: 'add_widget', widget: { label: 'one_more', formulary: 'jsonata', formula: '2' } }), 'libraryFull')
    const { library } = await read()
    expect(library).to.have.lengthOf(PA.WidgetsInLibrary.max)
  })

  it("refuses a quiz more than a realm may hold", async () => {
    const { act, tt, open } = await seedHunt(openTester(), openHunt())
    await tt.run(async (ctx) => {
      const labels = Array.from({ length: PA.QuizzesPerRealm.max - 1 }, (_unused, idx) => `quiz_${String(idx)}`)
      for (const label of labels) {
        await ctx.db.insert('quizzes', { hunt_id: open.hunt_id, realm_id: open.realm_id, title: '', label, smiths_note: '', q1_preamble: '', locked: false, last_sortkey: null, row_ordering: [] })
      }
    })
    await expectRefusal(act({ kind: 'new_quiz', label: 'one_more' }), 'quizzesFull')
    const quizzes = await tt.run(async (ctx) => await quizzesOf(ctx.db, open.realm_id))
    expect(quizzes).to.have.lengthOf(PA.QuizzesPerRealm.max)
  })

  it("refuses a review more than a quiz may hold", async () => {
    const { act, tt, open, join } = await seedHunt(openTester(), openHunt())
    await tt.run(async (ctx) => {
      const reviewers = Array.from({ length: 999 }, (_unused, idx) => `reviewer_${String(idx)}`)
      for (const label of reviewers) {
        const ident_id = await ctx.db.insert('idents', { label, title: 'Reviewer', user_id: null })
        await ctx.db.insert('reviews', { hunt_id: open.hunt_id, quiz_id: open.quiz_id, ident_id, overall: '', phase: 'empty' })
      }
    })
    const member = await join('one_more_reviewer', 'reviewer')
    await expectRefusal(act({ kind: 'open_review', quiz_id: open.quiz_id }, member), 'reviewsFull')
    expect(await reviewsIn(tt, open.quiz_id)).to.have.lengthOf(999)
  })
})

describe("hunts.perform, refusing", () => {
  it("reaches the caller as a refusal the browser reads as its sentence", async () => {
    const { act } = await seedHunt(openTester(), openHunt(true))
    const err = await refusalOf(act({ kind: 'add_question' }))
    expect(noticeOf(err)).to.eq(RefusalNotices.quizLocked)
  })

  it("refuses a row its validator will not take, saying where and why", async () => {
    const { actOnLibrary } = await seedHunt(openTester(), huntOf(['1', 'a']))
    const err = await refusalOf(actOnLibrary({ kind: 'edit_widget', label: 'dumdum', patch: { config: {} } }))
    expect(noticeOf(err)).to.include('config.model_tier «undefined» should be one of quick or careful')
  })
})

describe("hunts.perform, at the door", () => {
  it("refuses a request with no session, writing nothing", async () => {
    const { tt, open, read, smith } = await seedHunt(openTester(), openHunt())
    const ante = await read()
    const { action: affirms } = await affirmsOf(tt, smith, open)
    await expectRefusal(tt.mutation(api.hunts.perform, { affirms, action: { kind: 'add_question' } }), 'notIdentified')
    expect(await read()).to.deep.eq(ante)
  })

  it("refuses an action it does not know", async () => {
    const { tt, open, smith } = await seedHunt(openTester(), openHunt())
    const action = { kind: 'burn_it_all' } as never
    const { action: affirms } = await affirmsOf(tt, smith, open)
    await expect(smith.as.mutation(api.hunts.perform, { affirms, action })).rejects.toThrow(/Validator error/)
  })
})

describe("hunts.list", () => {
  it("lists the hunts one is on, titled, in the order they were made, with its realms' quizzes by label", async () => {
    const tt = openTester()
    const alice = await identified(tt, 'alice_smiths')
    const otter = await seedHunt(tt, { ...huntHolding([Quiz.blank('Second', 'zebra_crossing'), Quiz.blank('Under', 'alpha_under'), Quiz.blank('First', 'alpha')]), label: 'quiet_otter', title: '' })
    const heron = await seedHunt(tt, { ...huntHolding([Quiz.blank('Only')]), label: 'loud_heron', title: 'The Heron Hunt' })
    await putOn(tt, heron.open.hunt_id, alice.ident_id, 'smith')
    await putOn(tt, otter.open.hunt_id, alice.ident_id, 'reviewer')
    const hunts = await alice.as.query(api.hunts.list, {})
    expect(hunts.map((hunt) => [hunt.label, hunt.title, hunt.role, hunt.realms.map((realm) => [realm.label, realm.quizzes.map((quiz) => quiz.title)])])).to.deep.eq([
      ['quiet_otter', 'Quiet Otter', 'reviewer', [['home', ['First', 'Under', 'Second']]]],
      ['loud_heron', 'The Heron Hunt', 'smith', [['home', ['Only']]]],
    ])
  })

  it("leaves out the hunts one is not on", async () => {
    const tt = openTester()
    const alice = await identified(tt, 'alice_smiths')
    const bob = await identified(tt, 'bob_reviews')
    const otter = await seedHunt(tt, { ...huntHolding([Quiz.blank('Mine')]), label: 'quiet_otter' })
    await seedHunt(tt, { ...huntHolding([Quiz.blank('Nobody\'s')]), label: 'loud_heron' })
    await putOn(tt, otter.open.hunt_id, alice.ident_id, 'smith')
    const listed = await alice.as.query(api.hunts.list, {})
    expect(listed.map((hunt) => hunt.label)).to.deep.eq(['quiet_otter'])
    expect(await bob.as.query(api.hunts.list, {})).to.deep.eq([])
  })

  it("lists the hunts of the ident the session asserted last", async () => {
    const tt = openTester()
    const alice = await identified(tt, 'alice_smiths')
    const otter = await seedHunt(tt, { ...huntHolding([Quiz.blank('Her other self\'s')]), label: 'quiet_otter' })
    const otherself = await alice.as.mutation(api.idents.performAccount, { action: { kind: 'assume_ident', label: 'alice_otherself', title: '' } }) as Id<'idents'>
    await putOn(tt, otter.open.hunt_id, otherself, 'reviewer')
    const listed = await alice.as.query(api.hunts.list, {})
    expect(listed.map((hunt) => hunt.label)).to.deep.eq(['quiet_otter'])
  })

  it("lists nothing for a session that has asserted no username, or a request with no session", async () => {
    const tt = openTester()
    await seedHunt(tt, Hunt.blank('quiet_otter'))
    const session = await signedIn(tt)
    expect([await session.as.query(api.hunts.list, {}), await tt.query(api.hunts.list, {})]).to.deep.eq([[], []])
  })
})

/** The hunt `hunt_label` of the org `orglabel` (the seeded smith's, by default) as the session `by` is shown it, which must be shown */
async function shown(hunt_label: string, by: Session, orglabel: string | null = SeedOrg) {
  const opening = await by.as.query(api.hunts.open, { orglabel, hunt_label })
  return present(opening.hunt)
}

describe("hunts.open", () => {
  it("is the hunt answering to a label: its realms' quizzes as rows, and nothing of the library", async () => {
    const tt = openTester()
    const { act, smith } = await seedHunt(tt, { ...Hunt.blank('quiet_otter'), title: '' })
    await act({ kind: 'new_quiz' })
    const hunt = await shown('quiet_otter', smith)
    expect([hunt.title, hunt.realms.map((realm) => [realm.title, realm.quizzes.length])]).to.deep.eq(['Quiet Otter', [['Home', 2]]])
    expect(hunt).to.not.have.any.keys('expressions', 'library', 'widgets')
  })

  it("says who is on it, titled, in the order they were put on it", async () => {
    const tt = openTester()
    const { open, smith } = await seedHunt(tt, Hunt.blank('quiet_otter'))
    const bob = await identified(tt, 'bob_reviews')
    const alice = await identified(tt, 'alice_smiths')
    await putOn(tt, open.hunt_id, alice.ident_id, 'smith')
    await putOn(tt, open.hunt_id, bob.ident_id, 'reviewer')
    const hunt = await shown('quiet_otter', bob)
    expect(hunt.members.map((member) => [member.label, member.title, member.role, member.ident_id])).to.deep.eq([
      ['seed_smith', 'Seed Smith', 'smith', smith.ident_id],
      ['alice_smiths', 'Alice Smiths', 'smith', alice.ident_id],
      ['bob_reviews', 'Bob Reviews', 'reviewer', bob.ident_id],
    ])
  })

  it("says the role on it of whoever is looking", async () => {
    const tt = openTester()
    const { join } = await seedHunt(tt, Hunt.blank('quiet_otter'))
    const [alice, bob] = [await join('alice_smiths', 'smith'), await join('bob_reviews', 'reviewer')]
    const [aliceSees, bobSees] = [await shown('quiet_otter', alice), await shown('quiet_otter', bob)]
    expect([aliceSees.role, bobSees.role]).to.deep.eq(['smith', 'reviewer'])
  })

  it("shows someone not on it only that they are not, and its smiths, who could add them", async () => {
    const tt = openTester()
    const { join } = await seedHunt(tt, Hunt.blank('quiet_otter'))
    await join('alice_smiths', 'smith')
    await join('bob_reviews', 'reviewer')
    const carol = await identified(tt, 'carol_strays')
    const refused = { why: 'notOnHunt', hunt: null, smiths: [{ label: 'seed_smith', title: 'Seed Smith' }, { label: 'alice_smiths', title: 'Alice Smiths' }] }
    expect(await carol.as.query(api.hunts.open, { orglabel: SeedOrg, hunt_label: 'quiet_otter' })).to.deep.eq(refused)
    expect(await tt.query(api.hunts.open, { orglabel: SeedOrg, hunt_label: 'quiet_otter' })).to.deep.eq(refused)
  })

  it("says so for a label no hunt of the org answers to, though another org's does", async () => {
    const tt = openTester()
    const { smith } = await seedHunt(tt, Hunt.blank('quiet_otter'))
    expect(await smith.as.query(api.hunts.open, { orglabel: SeedOrg, hunt_label: 'loud_heron' })).to.deep.eq({ why: 'noSuchHunt', hunt: null })
    expect(await smith.as.query(api.hunts.open, { orglabel: 'other_org', hunt_label: 'quiet_otter' })).to.deep.eq({ why: 'noSuchHunt', hunt: null })
  })

  it("names the org the hunt stores, whoever is on it now", async () => {
    const tt = openTester()
    const { open, join } = await seedHunt(tt, Hunt.blank('quiet_otter'))
    const alice = await join('alice_smiths', 'smith')
    await tt.run(async (ctx) => {
      const maker = await ctx.db.query('huntings').withIndex('by_hunt_id', (cvx) => cvx.eq('hunt_id', open.hunt_id)).first()
      if (maker) { await ctx.db.delete('huntings', maker._id) }
    })
    const hunt = await shown('quiet_otter', alice)
    expect(hunt.org).to.eq(SeedOrg)
  })

  it("finds the earliest hunt answering to the label, whatever its org, for an old address that names none", async () => {
    const tt = openTester()
    const { smith } = await seedHunt(tt, Hunt.blank('quiet_otter'))
    const hunt = await shown('quiet_otter', smith, null)
    expect(hunt.org).to.eq(SeedOrg)
  })

  it("answers a browser that sends no org, as the app did before hunts had one, as an old address", async () => {
    const tt = openTester()
    const { smith } = await seedHunt(tt, Hunt.blank('quiet_otter'))
    const opening = await smith.as.query(api.hunts.open, { hunt_label: 'quiet_otter' })
    expect(present(opening.hunt).org).to.eq(SeedOrg)
  })

  it("names a hunt that stores no org yet by its earliest member, whatever their role, under any org", async () => {
    const tt = openTester()
    const { open, join } = await seedHunt(tt, Hunt.blank('quiet_otter'), { smith: 'pat_smiths' })
    const alice = await join('alice_smiths', 'smith')
    await tt.run(async (ctx) => {
      await ctx.db.patch('hunts', open.hunt_id, { orglabel: undefined })
      const maker = await ctx.db.query('huntings').withIndex('by_hunt_id', (cvx) => cvx.eq('hunt_id', open.hunt_id)).first()
      if (maker) { await ctx.db.patch('huntings', maker._id, { role: 'reviewer' }) }
    })
    const found = [await shown('quiet_otter', alice, 'pat_smiths'), await shown('quiet_otter', alice, 'kim_parks')]
    expect(found.map((hunt) => hunt.org)).to.deep.eq(['pat_smiths', 'pat_smiths'])
  })
})

/** `seen`'s open quiz, run as the screen runs it */
function runOfOpen(seen: Seen): Runner.QuizRun {
  const source = Runner.sourceOf(openOf(seen), seen.library, Runner.placeOf(seen.hunt, present(seen.hunt.realms[0])))
  return Runner.runQuiz(source)
}

/** `seen`'s open quiz as its ball holds it */
function bodyOfOpen(seen: Seen) {
  return Exporting.quizBodyOf(openOf(seen), runOfOpen(seen))
}

describe("a quiz's export, imported into an empty quiz", () => {
  it("reproduces it whole: its own fields, its questions in order with all they hold, their chains, its widgetings in run order, what its entries hold, and its columns as laid out", async () => {
    const tt = openTester()
    const source = await seedHunt(tt, huntOf(['1', 'a'], ['2', 'b'], ['3', 'c']))
    await putEntryToWork(source, 'remark')
    const [leon, nantes] = questionIdsOf(await source.read())
    await source.act({ kind: 'edit_question', question_id: present(leon), patch: { clueing: 'Which region?', hint: 'BUT NOT a lion', notes: 'keep me', full_answer: 'León' } })
    await source.act({ kind: 'set_chain', question_id: present(leon), chains_to: present(nantes) })
    await source.act({ kind: 'enter_widgeted', entered: { question_id: present(leon), widgeting_label: 'remark', value: 'Ask Flip.' } })
    await source.act({ kind: 'set_smiths_note', smiths_note: 'Kings and lions.' })
    await source.act({ kind: 'set_q1_preamble', q1_preamble: 'Read the note first.' })
    await source.act({ kind: 'add_column', column: { label: 'remark', title: 'Remark', source: 'remark', width_px: 140, align: 'center' }, onto_idx: 1 })
    await source.act({ kind: 'edit_column', label: 'qnum', patch: { width_px: 44, align: 'right' } })
    await source.act({ kind: 'sort_questions', sortkey: 'column:title', descending: true })
    const exported = await source.read()
    const quiz = openOf(exported)
    const { ball } = Exporting.quizBall({ org: 'seed_smith', hunt: exported.hunt.label }, 'home', quiz, runOfOpen(exported))

    const target = await seedHunt(tt, huntHolding([{ ...Quiz.blank('Empty', 'empty_one'), questions: [] }]))
    const empty = await target.read()
    const outcome = Importing.importInto(openOf(empty), JSON.stringify(ball), empty.library)
    expect(outcome.ok).to.be.true
    for (const action of outcome.actions) { await target.act(action) }

    const [want, got] = [bodyOfOpen(exported), bodyOfOpen(await target.read())]
    expect(got).to.deep.eq(want)
    expect(_.omit(got, ['questions', 'widgetings', 'columns'])).to.deep.eq({ title: 'Quiz one', smiths_note: 'Kings and lions.', q1_preamble: 'Read the note first.', locked: false, last_sortkey: 'column:title' })
    expect(got.columns.remark).to.deep.eq({ position: 1, title: 'Remark', source: 'remark', width_px: 140, align: 'center' })
    expect(got.columns.qnum).to.deep.include({ width_px: 44, align: 'right' })
    const labelOf = (question_id: string) => present(quiz.questions.find((qn) => qn._id === question_id)).label
    const [leonLabel, nantesLabel] = [labelOf(present(leon)), labelOf(present(nantes))]
    expect(got.questions[leonLabel]).to.deep.include({ clueing: 'Which region?', chains_to: nantesLabel, remark: { status: 'ok', value: 'Ask Flip.' } })
    expect(Object.values(got.questions).toSorted((aa, bb) => aa.position - bb.position).map((qn) => qn.title)).to.deep.eq(['c', 'b', 'a'])
    await expectSound(tt)
  })

  it("lays a quiz holding questions out as the export is, keeping its own questions, widgetings and sort memory", async () => {
    const tt = openTester()
    const source = await seedHunt(tt, huntOf(['1', 'a']))
    await source.act({ kind: 'delete_column', label: 'notes' })
    await source.act({ kind: 'move_column', label: 'qnum', onto_idx: 0 })
    const exported = await source.read()
    const { ball } = Exporting.quizBall({ org: 'seed_smith', hunt: exported.hunt.label }, 'home', openOf(exported), runOfOpen(exported))

    const target = await seedHunt(tt, huntOf(['1', 'z']))
    await target.act({ kind: 'sort_questions', sortkey: 'column:clueing', descending: false })
    const before = await target.read()
    const outcome = Importing.importInto(openOf(before), JSON.stringify(ball), before.library)
    for (const action of outcome.actions) { await target.act(action) }

    const [want, got] = [bodyOfOpen(exported), bodyOfOpen(await target.read())]
    expect(got.columns).to.deep.eq(want.columns)
    expect(got.last_sortkey).to.eq('column:clueing')
    expect(Object.keys(got.questions)).to.have.lengthOf(2)
    await expectSound(tt)
  })
})

describe("hunts.whole", () => {
  it("reads back a hunt exactly as it was written, apart from its ids", async () => {
    const hunt = Hunt.blank()
    const { read } = await seedHunt(openTester(), hunt)
    const { hunt: back } = await read()
    expect(sansIds(back)).to.deep.eq(sansIds(hunt))
  })

  it("is null for a hunt that is not there", async () => {
    const { tt, open, smith } = await seedHunt(openTester(), openHunt())
    const { hunt: affirms } = await affirmsOf(tt, smith, open)
    await tt.run(async (ctx) => { await ctx.db.delete('hunts', open.hunt_id) })
    expect(await smith.as.query(api.hunts.whole, { affirms })).to.be.null
  })

  it("is read whole by a smith of the hunt, and is null, as for one not there, for a reviewer of it and for anyone else", async () => {
    const tt = openTester()
    const { open, smith, join } = await seedHunt(tt, Hunt.blank('quiet_otter'))
    const bob = await join('bob_reviews', 'reviewer')
    const carol = await identified(tt, 'carol_strays')
    const [smiths, bobs, carols] = [await affirmsOf(tt, smith, open), await affirmsOf(tt, bob, open), await affirmsOf(tt, carol, open)]
    const read = await smith.as.query(api.hunts.whole, { affirms: smiths.hunt })
    expect(read?.label).to.eq('quiet_otter')
    expect(await bob.as.query(api.hunts.whole, { affirms: bobs.hunt })).to.be.null
    expect(await carol.as.query(api.hunts.whole, { affirms: carols.hunt })).to.be.null
  })

  it("is null for affirms that are not so: a standing not held, or another's ident", async () => {
    const tt = openTester()
    const { open, smith, join } = await seedHunt(tt, Hunt.blank('quiet_otter'))
    const bob = await join('bob_reviews', 'reviewer')
    const { hunt: affirms } = await affirmsOf(tt, smith, open)
    const { hunt: bobs } = await affirmsOf(tt, bob, open)
    expect(await bob.as.query(api.hunts.whole, { affirms: { ...bobs, standing: 'smith' } })).to.be.null
    expect(await bob.as.query(api.hunts.whole, { affirms })).to.be.null
    expect(await smith.as.query(api.hunts.whole, { affirms })).to.not.be.null
  })
})
