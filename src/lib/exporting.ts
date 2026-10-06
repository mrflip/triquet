import * as EST from 'es-toolkit'
import _ from 'es-toolkit/compat'
import * as Addresses from './addresses'
import * as Jsonball from './jsonball'
import * as Runner from './formulary/runner'
import * as Stamps from './stamps'
import type { MemberT, ReviewedT, ShallowHuntT } from './rows'
import { CategoryLabelVals, type WheelT } from '../models/category'
import type { HuntT } from '../models/hunt'
import { Question } from '../models/question'
import type { QuizT } from '../models/quiz'
import type { RealmT } from '../models/realm'
import { Widget, WidgetScopeVals, type WidgetT } from '../models/widget'

/**
 * What a smith is handed of their work, as jsonballs (`Jsonball`): each resource of the hunt at
 * the key path its address gives it (`Addresses`), every thing named by its label and no ids
 * anywhere. Raw Export is every ball of the hunt merged; the library's export is every widget's;
 * the hunt's repository is each ball written to its own file.
 *
 * Ids are the database's, and mean nothing outside it. Smiths export, edit by hand, re-import,
 * and carry questions from one draft or one quiz to another; labels are how they say which is
 * which, and two things sharing a label across quizzes is a feature of that, not a collision to
 * guard against. So nothing a smith reads, pastes or diffs carries an id, and a chain names the
 * question it points at by label.
 */

/**
 * A resource's jsonball, and the address it is the ball of: where its piece of the hunt sits, and
 * where its file goes. Its body is the piece itself, what the ball holds at the end of its key
 * path (or, for the questions alone, under `questions`): what its table is made from.
 */
export type PlacedBallT = {
  address: Addresses.FiledAddressT
  body:    Jsonball.JsonballT
  ball:    Jsonball.JsonballT
}

/** A row's stamps, as far as a ball reads them: a row as the database hands it back will do, and a source built rather than read may hold none */
export type StampSourceT = Partial<Stamps.StampableT>

/** One reviewing, as far as its review's ball needs it: which question, by id, the verdict, and its stamps; a reviewing's row will do, its other fields left out */
export type ReviewingSourceT = { question_id: string } & Omit<Jsonball.VerdictBodyT, keyof Stamps.IsoStampsT> & StampSourceT

/** One review of a quiz, as far as its ball needs it: who wrote it, how far it has come, what it says, and its stamps; a review as `reviews.forQuiz` reads it will do */
export type ReviewSourceT = Pick<ReviewedT, 'reviewer' | 'phase' | 'overall'> & StampSourceT & { reviewings: readonly ReviewingSourceT[] }

/** One ident on the hunt, as far as its members' ball needs it */
export type MemberSourceT = Pick<MemberT, 'label' | 'title' | 'role'>

/** Everything a hunt's balls are made from */
export type HuntSnapshotT = {
  /** The hunt's own fields, its title as shown, the org it is addressed under, and its stamps (none for a hunt built rather than read) */
  hunt:    Pick<HuntT, 'label' | 'title' | 'branch'> & { org: string } & Partial<Stamps.StampsT>
  /** How it arranges its categories */
  wheel:   WheelT
  /** Who is on it, in the order they joined it */
  members: readonly MemberSourceT[]
  /** Its realms, each with every quiz whole */
  realms:  readonly Pick<RealmT, 'label' | 'title' | 'quizzes'>[]
  /** The library, which its quizzes are run over; the widgets they work are among its balls */
  library: readonly WidgetT[]
  /** Each quiz's reviews, by the quiz's id; only the shared ones are written */
  reviews: Readonly<Record<string, readonly ReviewSourceT[]>>
}

/**
 * The hunt a snapshot is of, as its addresses name it: its org and its label. No ball or file
 * hangs on the org.
 *
 * @example placeOf(snapshot)  // => { org: 'pat_smith', hunt: 'spring_hunt' }
 */
export function placeOf(snapshot: Pick<HuntSnapshotT, 'hunt'>): Addresses.InHuntT {
  return { org: snapshot.hunt.org, hunt: snapshot.hunt.label }
}

/** `body` placed at `address`'s key path */
function placed(address: Addresses.FiledAddressT, body: Jsonball.JsonballT): PlacedBallT {
  return { address, body, ball: Jsonball.ballAt(Addresses.keypathOf(address), body) }
}

/**
 * The hunt's own ball: its label, title, branch and stamps, at the root of the merged hunt.
 *
 * @example huntBall(place, hunt).ball  // => { branch: 'main', created_at: '2026-10-05T12:00:00.000Z', label: 'spring_hunt', title: 'Spring Hunt', updated_at: ... }
 */
export function huntBall(place: Addresses.InHuntT, hunt: Omit<HuntSnapshotT['hunt'], 'org'>): PlacedBallT {
  const body: Jsonball.HuntBodyT = { label: hunt.label, title: hunt.title, branch: hunt.branch, ...Stamps.isoStampsOf(hunt) }
  return placed({ kind: 'hunt', ...place }, body)
}

/**
 * The hunt's categories: every category by its label, with the slot of the wheel it holds, or
 * null for one in the pool.
 *
 * @example categoriesBall(place, Wheel.defaultWheel()).ball.categories.math_econ  // => { position: 0 }
 */
export function categoriesBall(place: Addresses.InHuntT, wheel: WheelT): PlacedBallT {
  const body: Record<string, Jsonball.CategoryBodyT> = Object.fromEntries(CategoryLabelVals.map((label) => {
    const slot = wheel.indexOf(label)
    return [label, { position: slot === -1 ? null : slot }]
  }))
  return placed({ kind: 'categories', ...place }, body)
}

/**
 * Who is on the hunt: each member by their ident label, with what they are called and their role.
 *
 * @example membersBall(place, members).ball.members.pat_smith  // => { role: 'smith', title: 'Pat Smith' }
 */
export function membersBall(place: Addresses.InHuntT, members: readonly MemberSourceT[]): PlacedBallT {
  const body: Record<string, Jsonball.MemberBodyT> = Object.fromEntries(members.map(({ label, title, role }) => [label, { title, role }]))
  return placed({ kind: 'members', ...place }, body)
}

/**
 * `quiz` with its ids gone: its questions keyed by label in quiz order, the archived among them,
 * each with its viz, its chain named by the label of the question it points at (a chain to a
 * question the quiz does not hold named as none) and what each of the quiz's question widgetings
 * came to beside its own fields; its widgetings and columns keyed by label in their order; and,
 * when it has any, what each widgeting run once for the whole quiz came to, under `widgeteds`. What
 * a quiz's ball holds at its key path.
 *
 * @param quiz - The quiz.
 * @param run - The quiz, run: what its widgetings came to.
 *
 * @example quizBodyOf(quiz, run).questions.leon?.chains_to  // => 'nantes'
 * @example quizBodyOf(quiz, run).questions.leon?.clueing_full  // => { status: 'ok', value: 312 }
 */
export function quizBodyOf(quiz: QuizT, run: Runner.QuizRun): Jsonball.QuizBodyT {
  return {
    title:        quiz.title,
    smiths_note:  quiz.smiths_note,
    q1_preamble:  quiz.q1_preamble,
    recap_head:   quiz.recap_head,
    recap_tail:   quiz.recap_tail,
    templated:    quiz.templated,
    locked:       quiz.locked,
    last_sortkey: quiz.last_sortkey,
    ...Stamps.isoStampsOf(quiz),
    questions:    questionsBodyOf(quiz, run),
    widgetings:   Jsonball.keyedOf(quiz.widgetings, (widgeting) => widgeting.label, ({ widget_label, description, params, tier }) => ({ widget_label, description, params, tier })),
    columns:      Jsonball.keyedOf(quiz.columns, (column) => column.label, ({ label: _label, ...fields }) => fields),
    ...quizWidgetedsBodyOf(quiz, run),
  }
}

/** What each widgeting of `quiz` run once for the whole quiz came to, its exposed fields only, under `widgeteds`; nothing for a quiz with none */
function quizWidgetedsBodyOf(quiz: QuizT, run: Runner.QuizRun): Pick<Jsonball.QuizBodyT, 'widgeteds'> {
  const quizWide = quiz.widgetings.filter((widgeting) => widgeting.tier === 'quiz')
  if (quizWide.length === 0) { return {} }
  return {
    widgeteds: Object.fromEntries(quizWide.map(({ label }) => {
      const { status, value } = Runner.quizWidgetedOf(run, label)
      return [label, { status, value }]
    })),
  }
}

/**
 * A quiz's questions as its ball holds them: keyed by label, in quiz order, each chain named by the
 * label of the question it points at among them all. `questions` says which are written: every one,
 * unless told otherwise.
 */
function questionsBodyOf(quiz: QuizT, run: Runner.QuizRun, questions: readonly QuizT['questions'][number][] = quiz.questions): Record<string, Jsonball.QuestionBodyT> {
  const labelForId = new Map(quiz.questions.map((question) => [question._id, question.label]))
  return Jsonball.keyedOf(questions, (question) => question.label, (question) => ({
    qnum:        question.qnum,
    clueing:     question.clueing,
    hint:        question.hint,
    title:       question.title,
    alt_text:    question.alt_text,
    notes:       question.notes,
    full_answer: question.full_answer,
    recap:       question.recap,
    viz:         question.viz,
    chains_to:   question.chains_to === null ? null : labelForId.get(question.chains_to) ?? null,
    ...Stamps.isoStampsOf(question),
    ...Object.fromEntries(quiz.widgetings.filter((widgeting) => widgeting.tier === 'question').map(({ label }) => [label, widgetedBodyOf(run, label, question._id)])),
  }))
}

/** What one widgeting came to for one question, its exposed fields only */
function widgetedBodyOf(run: Runner.QuizRun, label: string, question_id: string): Jsonball.WidgetedBodyT {
  const { status, value } = Runner.widgetedOf(run, label, question_id)
  return { status, value }
}

/**
 * One quiz's ball, whole: its fields, questions, widgetings and columns.
 *
 * @param place - Its hunt.
 * @param realm - The label of the realm it sits in.
 * @param quiz - The quiz.
 * @param run - The quiz, run.
 *
 * @example quizBall(place, 'home', quiz, run).address  // => { kind: 'quiz', org, hunt, realm: 'home', quiz: 'legends' }
 */
export function quizBall(place: Addresses.InHuntT, realm: string, quiz: QuizT, run: Runner.QuizRun): PlacedBallT {
  return placed({ kind: 'quiz', ...place, realm, quiz: quiz.label }, quizBodyOf(quiz, run))
}

/**
 * One quiz's questions alone, as its quiz's ball holds them but for the archived, rooted at the quiz
 * rather than the hunt (`{ questions: { ... } }`): it names no quiz, so it pastes into any quiz's
 * Import. It is not merged, since its quiz's ball holds the same, and the archived besides. Each
 * question's place is among those it holds.
 *
 * @example questionsBall(place, 'home', quiz, run).ball  // => { questions: { leon: { position: 0, ... }, ... } }
 */
export function questionsBall(place: Addresses.InHuntT, realm: string, quiz: QuizT, run: Runner.QuizRun): PlacedBallT {
  const body = questionsBodyOf(quiz, run, Question.unarchived(quiz.questions))
  return { address: { kind: 'questions', ...place, realm, quiz: quiz.label }, body, ball: { questions: body } }
}

/**
 * One shared review of a quiz: what the reviewer made of it, and their verdict on each question
 * of the quiz, by the question's label. Null for a review not shared, which the smiths may not
 * read, or one whose reviewer is gone, who has no label to file it under.
 *
 * @param place - Its hunt.
 * @param realm - The label of the realm its quiz sits in.
 * @param quiz - The quiz reviewed: its label, and its questions' labels.
 * @param review - The review.
 *
 * @example reviewBall(place, 'home', quiz, review)?.ball.quizzes.home.legends.reviews.lee_jones.overall  // => 'A fair quiz.'
 */
export function reviewBall(place: Addresses.InHuntT, realm: string, quiz: Pick<QuizT, 'label' | 'questions'>, review: ReviewSourceT): PlacedBallT | null {
  if (review.phase !== 'shared' || review.reviewer === null) { return null }
  const labelForId = new Map(quiz.questions.map((question) => [question._id, question.label]))
  const verdicts = Object.fromEntries(review.reviewings.flatMap((reviewing): [string, Jsonball.VerdictBodyT][] => {
    const label = labelForId.get(reviewing.question_id)
    return label === undefined ? [] : [[label, { ...EST.pick(reviewing, Jsonball.VerdictFieldnames), ...Stamps.isoStampsOf(reviewing) }]]
  }))
  const body: Jsonball.ReviewBodyT = { overall: review.overall, ...Stamps.isoStampsOf(review), verdicts }
  return placed({ kind: 'review', ...place, realm, quiz: quiz.label, reviewer: review.reviewer.label }, body)
}

/**
 * Every ball of one quiz, made from that quiz alone: its own, its questions alone, and each of its
 * reviews that is shared.
 *
 * @param place - Its hunt.
 * @param realm - The label of the realm it sits in.
 * @param quiz - The quiz.
 * @param run - The quiz, run.
 * @param reviews - Its reviews, of every phase; only the shared ones are written.
 *
 * @example quizBalls(place, 'home', quiz, run, reviews).map(({ address }) => address.kind)  // => ['quiz', 'questions', 'review']
 */
export function quizBalls(place: Addresses.InHuntT, realm: string, quiz: QuizT, run: Runner.QuizRun, reviews: readonly ReviewSourceT[]): PlacedBallT[] {
  const shared = reviews.map((review) => reviewBall(place, realm, quiz, review)).filter((review) => review !== null)
  return [quizBall(place, realm, quiz, run), questionsBall(place, realm, quiz, run), ...shared]
}

/**
 * One widget of the library: its fields, and its place in the library.
 *
 * @param widget - The widget.
 * @param position - Its place in the library, counting from zero.
 *
 * @example widgetBall(dumdum, 0).ball  // => { pub: { widgets: { dumdum: { position: 0, formulary: 'aibot', ... } } } }
 */
export function widgetBall(widget: WidgetT, position: number): PlacedBallT {
  const { scope, label, ...fields } = Widget.exported(widget)
  const body: Jsonball.WidgetBodyT = { ...fields, position }
  return placed({ kind: 'widget', scope, widget: label }, body)
}

/**
 * The library, apart from any hunt: every widget's ball, merged. What its Import reads back.
 *
 * @example Object.keys(libraryBall(library).pub.widgets)  // => ['answer_reversed', 'dumdum', ...]
 */
export function libraryBall(library: readonly WidgetT[]): Jsonball.JsonballT {
  const scopes = WidgetScopeVals.map((scope) => Jsonball.ballAt([scope, 'widgets'], {}))
  return Jsonball.merged([...scopes, ...library.map((widget, ii) => widgetBall(widget, ii).ball)])
}

/**
 * The hunt's own balls, apart from its quizzes and widgets: its own fields', its categories' and
 * its members'. What the hunt-level watch of a mirror's feed writes.
 *
 * @example huntLevelBalls(snapshot).map(({ address }) => address.kind)  // => ['hunt', 'categories', 'members']
 */
export function huntLevelBalls(snapshot: Pick<HuntSnapshotT, 'hunt' | 'wheel' | 'members'>): PlacedBallT[] {
  const place = placeOf(snapshot)
  return [huntBall(place, snapshot.hunt), categoriesBall(place, snapshot.wheel), membersBall(place, snapshot.members)]
}

/**
 * Every ball of one quiz of the hunt (`quizBalls`), the quiz run where it sits: over the library,
 * in its realm, against the hunt's wheel. So a change to the library or the wheel can rewrite it.
 *
 * @param snapshot - The hunt, as far as running and placing the quiz needs it.
 * @param realm - The realm the quiz sits in.
 * @param quiz - The quiz.
 * @param reviews - Its reviews, of every phase; only the shared ones are written.
 *
 * @example quizBallsIn(snapshot, realm, quiz, reviews).map(({ address }) => address.kind)  // => ['quiz', 'questions', 'review']
 */
export function quizBallsIn(snapshot: Pick<HuntSnapshotT, 'hunt' | 'wheel' | 'members' | 'library'>, realm: Pick<RealmT, 'label' | 'title'>, quiz: QuizT, reviews: readonly ReviewSourceT[]): PlacedBallT[] {
  const { hunt, wheel, library } = snapshot
  const run = Runner.runQuiz(Runner.sourceOf(quiz, library, Runner.placeOf({ ...hunt, wheel }, realm)))
  return quizBalls(placeOf(snapshot), realm.label, quiz, run, reviews)
}

/**
 * The balls of the library's widgets that any of `quizzes` works, each at its place in the whole
 * library: which are written depends on every quiz, and where each sits on every widget.
 *
 * @example workedBalls(library, quizzes).map(({ address }) => address.kind === 'widget' && address.widget)  // => ['dumdum', 'numnum_clueing', ...]
 */
export function workedBalls(library: readonly WidgetT[], quizzes: readonly Pick<QuizT, 'widgetings'>[]): PlacedBallT[] {
  const worked = new Set(quizzes.flatMap((quiz) => quiz.widgetings.map((widgeting) => widgeting.widget_label)))
  return library.flatMap((widget, ii) => (worked.has(widget.label) ? [widgetBall(widget, ii)] : []))
}

/**
 * Every ball of a hunt: its own, its categories', its members', each quiz's and its questions
 * alone, each shared review's, and each widget its quizzes work. The questions alone are among
 * them, though no merge reads them (`Addresses.isMerged`).
 *
 * @example ballsOf(snapshot).map(({ address }) => address.kind)  // => ['hunt', 'categories', 'members', 'quiz', 'questions', 'review', 'widget', ...]
 */
export function ballsOf(snapshot: HuntSnapshotT): PlacedBallT[] {
  const quizzes = snapshot.realms.flatMap((realm) => realm.quizzes.map((quiz) => ({ realm, quiz })))
  return [
    ...huntLevelBalls(snapshot),
    ...quizzes.flatMap(({ realm, quiz }) => quizBallsIn(snapshot, realm, quiz, snapshot.reviews[quiz._id] ?? [])),
    ...workedBalls(snapshot.library, quizzes.map(({ quiz }) => quiz)),
  ]
}

/**
 * The hunt as one jsonball: every ball of it that a merge reads, merged. What Raw Export emits.
 *
 * @example wholeOf(snapshot).quizzes.home.legends.title  // => 'Legends'
 */
export function wholeOf(snapshot: HuntSnapshotT): Jsonball.JsonballT {
  return Jsonball.merged(ballsOf(snapshot).filter(({ address }) => Addresses.isMerged(address)).map(({ ball }) => ball))
}

/**
 * What the Export box makes the hunt from: the hunt as the screen holds it (its org, its stamps,
 * its wheel, who is on it), every quiz whole as read for the export, and the library. It carries no reviews: the
 * export reads none.
 *
 * @param hunt - The hunt, as the screen holds it: its org, its wheel, who is on it.
 * @param whole - The hunt, every quiz whole.
 * @param library - The library's widgets.
 *
 * @example wholeOf(snapshotOf(hunt, whole, library)).label  // => 'spring_hunt'
 */
export function snapshotOf(hunt: Pick<ShallowHuntT, 'org'> & Partial<Pick<ShallowHuntT, 'created_at' | 'updated_at'>> & Pick<HuntSnapshotT, 'wheel' | 'members'>, whole: HuntT, library: readonly WidgetT[]): HuntSnapshotT {
  return {
    hunt:    { label: whole.label, title: whole.title, branch: whole.branch, org: hunt.org, ..._.pick(hunt, Stamps.StampFieldnames) },
    wheel:   hunt.wheel,
    members: hunt.members,
    realms:  whole.realms,
    library,
    reviews: {},
  }
}
