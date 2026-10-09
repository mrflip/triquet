import _ from 'es-toolkit/compat'
import { describe, expect, it, vi } from 'vitest'
import type { OptimisticLocalStore } from 'convex/browser'
import { getFunctionName, type FunctionReference } from 'convex/server'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { QuizFrameT, SeenQuestionT } from '../../src/lib/rows'
import { Hunt } from '../../src/models/hunt'
import type { HuntActionDNA } from '../../src/models/actions'
import { sortkeyOf } from '../../src/models/column'
import { showPerformed } from '../../src/state/optimistic-quiz'
import { affirmsOf, openOf, openTester, seedHunt, sortAction, type Seeded } from '../support/convex'
import { present } from '../support/present'

/** A query function's name, as the stand-in store files its results */
function named(fn: FunctionReference<'query'>): string {
  return getFunctionName(fn)
}

/** One watched result in the stand-in store */
type HeldT = { fnname: string, args: Record<string, unknown>, value: unknown }

/** A stand-in for the client's watched results: what it holds, read and written as the client's own store is */
function storeOf(held: readonly HeldT[]): OptimisticLocalStore & { held: () => HeldT[] } {
  const results = new Map(held.map((each) => [keyOf(each.fnname, each.args), each]))
  return {
    getQuery:      (fn: FunctionReference<'query'>, args = {}) => results.get(keyOf(named(fn), args))?.value,
    getAllQueries: (fn: FunctionReference<'query'>) => results.values().filter((each) => each.fnname === named(fn)).map(({ args, value }) => ({ args, value })).toArray(),
    setQuery:      (fn: FunctionReference<'query'>, args: Record<string, unknown>, value: unknown) => { results.set(keyOf(named(fn), args), { fnname: named(fn), args, value }) },
    held:          () => results.values().toArray(),
  } as unknown as OptimisticLocalStore & { held: () => HeldT[] }
}

/** Where the stand-in store holds a result */
function keyOf(fnname: string, args: unknown): string {
  return `${fnname} ${JSON.stringify(args)}`
}

/** What the smith's screen watches of the open quiz, as the server answers now: its frame, each question, and the library */
async function watched({ tt, smith, open }: Seeded): Promise<HeldT[]> {
  const affirms = await affirmsOf(tt, smith, open)
  const frame = present(await smith.as.query(api.quizzes.open, { affirms: affirms.quiz }))
  const questions = await Promise.all(frame.row_ordering.map(async (question_id) => {
    const args = { question_id, affirms: affirms.hunt }
    return { fnname: getFunctionName(api.questions.open), args, value: await smith.as.query(api.questions.open, args) }
  }))
  return [
    { fnname: getFunctionName(api.quizzes.open), args: { affirms: affirms.quiz }, value: frame },
    ...questions,
    { fnname: getFunctionName(api.widgets.library), args: {}, value: await smith.as.query(api.widgets.library, {}) },
  ]
}

/** The quiz as watched results hold it: its frame, and its questions by id; stamps left out, which only the server's clock writes */
function quizIn(held: readonly HeldT[]): { frame: QuizFrameT, questions: Record<string, SeenQuestionT> } {
  const frame = present(held.find((each) => each.fnname === getFunctionName(api.quizzes.open))).value as QuizFrameT
  const questions = held.filter((each) => each.fnname === getFunctionName(api.questions.open)).map((each) => each.value as SeenQuestionT)
  return unstamped({ frame, questions: _.keyBy(questions, '_id') })
}

/** `val` without the stamps a write is given (`created_at`, `updated_at`, a stored row's `_creationTime`) */
function unstamped<VT>(val: VT): VT {
  return JSON.parse(JSON.stringify(val, (key, inner: unknown) => (['created_at', 'updated_at', '_creationTime'].includes(key) ? undefined : inner))) as VT
}

/** The label a question is read with; null for a reader not sent it */
function labelOf(seen: SeenQuestionT | undefined): string | null {
  return seen && 'label' in seen ? seen.label : null
}

/** What a question's widgetings stored, as it is read; null for a reader not sent it */
function storedOf(seen: SeenQuestionT | undefined): unknown {
  return seen && 'stored' in seen ? seen.stored : null
}

/** When the row in a question's cell was made, as watched results hold it; undefined for a cell holding none */
function madeAt(held: readonly HeldT[], question_id: string, widgeting_label: string): number | undefined {
  const seen = held.find((each) => each.fnname === getFunctionName(api.questions.open) && (each.value as SeenQuestionT | null)?._id === (question_id as Id<'questions'>))?.value as SeenQuestionT | undefined
  return seen && 'stored' in seen ? seen.stored[widgeting_label]?.newest._creationTime : undefined
}

/**
 * Show `action` early on what the smith's screen watches, carry it out on the server, and say what
 * each came to: what the screen showed, and what the server's answer then was.
 */
async function shownAndWritten(seeded: Seeded, action: HuntActionDNA) {
  const store = storeOf(await watched(seeded))
  const { action: affirms } = await affirmsOf(seeded.tt, seeded.smith, seeded.open)
  showPerformed(store, { affirms, action })
  await seeded.act(action)
  return { shown: quizIn(store.held()), written: quizIn(await watched(seeded)) }
}

/** A blank hunt, its quiz's questions titled, an entry worked for each question and one for the whole quiz, each with something typed */
async function seededQuiz(): Promise<Seeded & { question_ids: string[] }> {
  const seeded = await seedHunt(openTester(), Hunt.blank())
  const question_ids = openOf(await seeded.read()).questions.map((question) => question._id)
  for (const [idx, title] of ['Leon', 'Aragon', 'Castile'].entries()) {
    await seeded.act({ kind: 'edit_question', question_id: present(question_ids[idx]), patch: { title, qnum: String(3 - idx) } })
  }
  await seeded.act({ kind: 'add_widgeting', widgeting: { widget_label: 'memo', label: 'memo' } })
  await seeded.act({ kind: 'add_column', column: { label: 'memo', title: 'Memo', source: 'memo', width_px: 120 } })
  await seeded.act({ kind: 'add_widgeting', widgeting: { widget_label: 'memo', label: 'playtesters', tier: 'quiz' } })
  await seeded.act({ kind: 'add_column', column: { label: 'playtesters', title: 'Playtesters', source: 'quiz.playtesters', width_px: 120 } })
  await seeded.act({ kind: 'enter_widgeted', entered: { question_id: present(question_ids[0]), widgeting_label: 'memo', value: 'first' } })
  await seeded.act({ kind: 'enter_quiz_widgeted', entered: { widgeting_label: 'playtesters', value: 'Ada' } })
  return { ...seeded, question_ids }
}

describe("showPerformed", () => {
  it("shows a question edited, a chain to a sibling named by its label, as the server writes them", async () => {
    const seeded = await seededQuiz()
    const [first, second] = seeded.question_ids
    const { shown, written } = await shownAndWritten(seeded, { kind: 'edit_question', question_id: present(first), patch: { clueing: 'Which region?', chains_to: present(second) } })
    expect(shown.questions[present(first)]).to.deep.include({ clueing: 'Which region?', chains_to: labelOf(written.questions[present(second)]) })
    expect(shown).to.deep.eq(written)
  })

  it("shows a chain set, and one to itself as none, as the server writes them", async () => {
    const seeded = await seededQuiz()
    const [first, second] = seeded.question_ids
    const chained = await shownAndWritten(seeded, { kind: 'set_chain', question_id: present(first), chains_to: present(second) })
    expect(chained.shown).to.deep.eq(chained.written)
    const unchained = await shownAndWritten(seeded, { kind: 'set_chain', question_id: present(first), chains_to: present(first) })
    expect(unchained.shown.questions[present(first)]).to.deep.include({ chains_to: null })
    expect(unchained.shown).to.deep.eq(unchained.written)
  })

  it("shows what is typed into a question's entry, and a cell emptied, as the server keeps them", async () => {
    const seeded = await seededQuiz()
    const [first, second] = seeded.question_ids
    const typed = await shownAndWritten(seeded, { kind: 'enter_widgeted', entered: { question_id: present(second), widgeting_label: 'memo', value: 'second' } })
    expect(typed.shown).to.deep.eq(typed.written)
    const emptied = await shownAndWritten(seeded, { kind: 'enter_widgeted', entered: { question_id: present(first), widgeting_label: 'memo', value: null } })
    expect(emptied.shown).to.deep.eq(emptied.written)
  })

  it("keeps when a cell's row was made as what is typed revises it, as the server replaces the row", async () => {
    const seeded = await seededQuiz()
    const first = present(seeded.question_ids[0])
    const store = storeOf(await watched(seeded))
    const { action: affirms } = await affirmsOf(seeded.tt, seeded.smith, seeded.open)
    const action = { kind: 'enter_widgeted', entered: { question_id: first, widgeting_label: 'memo', value: 'again' } } as const
    showPerformed(store, { affirms, action })
    await seeded.act(action)
    expect(madeAt(store.held(), first, 'memo')).to.be.a('number').and.eq(madeAt(await watched(seeded), first, 'memo'))
  })

  it("shows what is typed into the quiz's own entry as the server keeps it", async () => {
    const { shown, written } = await shownAndWritten(await seededQuiz(), { kind: 'enter_quiz_widgeted', entered: { widgeting_label: 'playtesters', value: 'Ada and Grace' } })
    expect(shown.frame.stored.playtesters?.newest.value).to.eq('Ada and Grace')
    expect(shown).to.deep.eq(written)
  })

  it("shows a column retitled, resized, given a template and having it taken off, as the server writes them", async () => {
    const seeded = await seededQuiz()
    const retitled = await shownAndWritten(seeded, { kind: 'edit_column', label: 'title', patch: { title: 'Name', width_px: 200, template: '**{{ value }}**' } })
    expect(retitled.shown).to.deep.eq(retitled.written)
    const untemplated = await shownAndWritten(seeded, { kind: 'edit_column', label: 'title', patch: { template: null } })
    expect(untemplated.shown).to.deep.eq(untemplated.written)
  })

  it("shows a column relabelled, carrying the sort memory with it, as the server writes it", async () => {
    const seeded = await seededQuiz()
    await seeded.act(sortAction(await seeded.read(), sortkeyOf({ label: 'title' }), false))
    const { shown, written } = await shownAndWritten(seeded, { kind: 'edit_column', label: 'title', patch: { label: 'heading' } })
    expect(shown.frame.last_sortkey).to.eq('column:heading')
    expect(shown).to.deep.eq(written)
  })

  it("shows a widgeting relabelled, its columns (a header still after its label too), its templateable place and what it stored following it, as the server writes it", async () => {
    const seeded = await seededQuiz()
    await seeded.act({ kind: 'set_templateable', templateable: ['memo'] })
    const { shown, written } = await shownAndWritten(seeded, { kind: 'edit_widgeting', label: 'memo', patch: { label: 'remark', description: 'What we said.' } })
    expect(shown.questions[present(seeded.question_ids[0])]).to.deep.include({ stored: storedOf(written.questions[present(seeded.question_ids[0])]) })
    expect(shown.frame.columns.find((column) => column.label === 'memo')).to.deep.include({ source: 'remark', title: 'Remark' })
    expect(shown).to.deep.eq(written)
  })

  it("shows a quiz widgeting relabelled, what the quiz stored following it, as the server writes it", async () => {
    const { shown, written } = await shownAndWritten(await seededQuiz(), { kind: 'edit_widgeting', label: 'playtesters', patch: { label: 'testers' } })
    expect(shown).to.deep.eq(written)
  })

  it("leaves a widgeting's new params to its folded line, which keeps those the server refuses beside the sentence saying why", async () => {
    const seeded = await seededQuiz()
    const store = storeOf(await watched(seeded))
    const before = quizIn(store.held())
    const { action: affirms } = await affirmsOf(seeded.tt, seeded.smith, seeded.open)
    showPerformed(store, { affirms, action: { kind: 'edit_widgeting', label: 'memo', patch: { params: { max_length: 40 } } } })
    expect(quizIn(store.held())).to.deep.eq(before)
  })

  it("shows a sort in the order the browser came to, remembering its sortkey, as the server writes it", async () => {
    const seeded = await seededQuiz()
    const { shown, written } = await shownAndWritten(seeded, sortAction(await seeded.read(), sortkeyOf({ label: 'title' }), true))
    expect(shown.frame.last_sortkey).to.eq('column:title')
    expect(shown).to.deep.eq(written)
  })

  it("shows nothing of a sort that is not exactly the quiz's questions, which the server refuses", async () => {
    const seeded = await seededQuiz()
    const store = storeOf(await watched(seeded))
    const before = quizIn(store.held())
    const { action: affirms } = await affirmsOf(seeded.tt, seeded.smith, seeded.open)
    showPerformed(store, { affirms, action: { kind: 'sort_questions', sortkey: 'column:title', descending: false, question_ids: seeded.question_ids.slice(1) } })
    expect(quizIn(store.held())).to.deep.eq(before)
  })

  it("shows a question dragged, every question renumbered by where it sits, as the server writes it", async () => {
    const seeded = await seededQuiz()
    const { shown, written } = await shownAndWritten(seeded, { kind: 'move_question', question_id: present(seeded.question_ids[0]), onto_idx: 3 })
    expect(shown.frame.row_ordering[3]).to.eq(seeded.question_ids[0])
    expect(shown).to.deep.eq(written)
  })

  it("shows nothing early of an action it does not cover, or one that does not read as an action", async () => {
    const seeded = await seededQuiz()
    const store = storeOf(await watched(seeded))
    const before = quizIn(store.held())
    const { action: affirms } = await affirmsOf(seeded.tt, seeded.smith, seeded.open)
    showPerformed(store, { affirms, action: { kind: 'retitle_quiz', title: 'Later' } })
    showPerformed(store, { affirms, action: { kind: 'edit_question', question_id: 'nonsense', patch: { title: 'Nope' } } })
    expect(quizIn(store.held())).to.deep.eq(before)
  })

  it("never throws, so a change it cannot show still goes", () => {
    vi.spyOn(console, 'error').mockReturnValue(undefined)
    const store = { getAllQueries: () => { throw new Error('the store broke') } } as unknown as OptimisticLocalStore
    const affirms = { ident_id: 'ident', hunt_id: 'hunt', standing: 'smith', quiz_id: 'quiz', realm_id: 'realm' } as const
    expect(() => { showPerformed(store, { affirms, action: { kind: 'sort_questions', sortkey: 'chain_order', descending: false, question_ids: [] } }) }).not.to.throw()
  })
})
