import _ from 'es-toolkit/compat'
import { describe, expect, it } from 'vitest'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { libraryOf, reviewingsOf, reviewsOf } from '../../convex/reading'
import * as Exporting from '../../src/lib/exporting'
import * as Huntfiles from '../../src/lib/huntfiles'
import { widgetFrom, type ReviewedT, type ShallowHuntT } from '../../src/lib/rows'
import type { HuntActionDNA } from '../../src/models/actions'
import { Question } from '../../src/models/question'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { HuntPartkey, WidgetsPartkey, huntPartOf, quizPartOf, watchHunt, widgetsPartOf, type HuntFeedT, type HuntReadingT } from '../../src/state/hunt-feed'
import { affirmsOf, callerOf, huntHolding, openTester, seedHunt, wholeHunt, type Identified, type PlaceT, type Seeded } from '../support/convex'
import { classicLayout } from '../support/layouts'
import { present } from '../support/present'
import { snapshot } from '../support/snapshots'
import { standInFor, type StandInT } from '../support/watching'

// --- The parts of a reading, from what each watch reads

/** `held` as `hunts.open` shows it to its smith: what the feed's hunt-level watch reads */
function shallowOf(held: Exporting.HuntSnapshotT): ShallowHuntT {
  const realms = held.realms.map((realm, ii) => ({ _id: `realm${String(ii)}`, label: realm.label, title: realm.title, quizzes: [] }))
  const members = held.members.map((member) => ({ ...member, ident_id: `ident_${member.label}` }))
  return { ...held.hunt, _id: 'hunt', org: Exporting.placeOf(held).org, wheel: held.wheel, members, realms, role: 'smith' } as unknown as ShallowHuntT
}

/** `held`'s reviews of `quiz` as `reviews.forQuiz` reads them, rows and all */
function reviewedOf(held: Exporting.HuntSnapshotT, quiz: QuizT): ReviewedT[] {
  return (held.reviews[quiz._id] ?? []).map((review, ii) => ({
    ...review, _id: `review${String(ii)}`, _creationTime: ii, hunt_id: 'hunt', quiz_id: quiz._id, ident_id: `ident${String(ii)}`,
    reviewings: review.reviewings.map((reviewing) => ({ ...reviewing, _id: 'reviewing', _creationTime: 1, hunt_id: 'hunt', quiz_id: quiz._id, ident_id: `ident${String(ii)}`, review_id: `review${String(ii)}`, peeked: true })),
  })) as unknown as ReviewedT[]
}

describe('huntPartOf', () => {
  it("is the hunt's own file, its categories' and its members', each as a JSON and a table", () => {
    const held = snapshot()
    const part = huntPartOf(shallowOf(held))
    expect(part.kind).to.eq('hunt')
    expect(part.files).to.deep.eq(Huntfiles.filesOf(Exporting.huntLevelBalls(held)))
  })

  it("reads the doc block's example", () => {
    const { files } = huntPartOf(shallowOf(snapshot()))
    expect(files.keys().take(3).toArray()).to.deep.eq(['hunt.tqh.json', 'hunt.tqh.tsv', 'categories.tqc.json'])
  })
})

describe('quizPartOf', () => {
  const held = snapshot()
  const realm = present(held.realms[0])
  const princes = present(realm.quizzes[0])
  const hunt = shallowOf(held)
  const reviews = present(held.reviews[princes._id])

  it("is the quiz's files as the export writes them: its own, its questions alone, its shared reviews", () => {
    const part = quizPartOf(hunt, held.library, present(hunt.realms[0]), princes, reviewedOf(held, princes))
    expect(part).to.deep.include({ kind: 'quiz', quiz: princes, realm: 'home' })
    expect(part.files).to.deep.eq(Huntfiles.filesOf(Exporting.quizBallsIn(held, realm, princes, reviews)))
  })

  it("reads the doc block's example", () => {
    const part = quizPartOf(hunt, held.library, present(hunt.realms[0]), princes, reviewedOf(held, princes))
    expect(part.files.keys().toArray()).to.include.members(['quizzes/home/princes.tqq.json', 'quizzes/home/princes/questions.qq.tsv', 'quizzes/home/princes/reviews/lee_jones.tqr.json'])
  })

  it("writes neither a draft review nor anything of a reviewing's row but its verdict", () => {
    const part = quizPartOf(hunt, held.library, present(hunt.realms[0]), princes, reviewedOf(held, princes))
    expect(part.files.keys().filter((path) => path.includes('/reviews/')).toArray()).to.deep.eq(['quizzes/home/princes/reviews/lee_jones.tqr.json', 'quizzes/home/princes/reviews/lee_jones.tqr.tsv'])
    expect(part.files.get('quizzes/home/princes/reviews/lee_jones.tqr.json')).to.not.match(/peeked|_id/)
  })
})

describe('widgetsPartOf', () => {
  it("is the files of each widget of the library the quizzes work", () => {
    const held = snapshot()
    const { quizzes } = present(held.realms[0])
    expect(widgetsPartOf(held.library, quizzes)).to.deep.eq({ kind: 'widgets', files: Huntfiles.filesOf(Exporting.workedBalls(held.library, quizzes)) })
  })

  it("reads the doc block's example", () => {
    const held = snapshot()
    expect(widgetsPartOf(held.library, present(held.realms[0]).quizzes).files.has('widgets/pub/dumdum.tqw.json')).to.be.true
  })

  it("is no files for quizzes working nothing", () => {
    expect(widgetsPartOf(snapshot().library, [Quiz.blank('Paris', 'paris')]).files.size).to.eq(0)
  })
})

describe("the parts of a hunt, together", () => {
  it("are every file of its repository but the README", () => {
    const held = snapshot()
    const hunt = shallowOf(held)
    const realm = present(hunt.realms[0])
    const { quizzes } = present(held.realms[0])
    const parts = [huntPartOf(hunt), ...quizzes.map((quiz) => quizPartOf(hunt, held.library, realm, quiz, reviewedOf(held, quiz))), widgetsPartOf(held.library, quizzes)]
    const whole = Huntfiles.huntFiles(held)
    whole.delete(Huntfiles.ReadmePath)
    expect(new Map(parts.flatMap((part) => part.files.entries().toArray()))).to.deep.eq(whole)
  })
})

// --- The feed, over the real query functions

/** A quiz laid out as every quiz once was, its questions labelled `labels`, each numbered and clued */
function quizOf(title: string, label: string, labels: readonly string[]): QuizT {
  const questions = labels.map((qnlabel, idx) => ({ ...Question.blank(), label: qnlabel, title: _.upperFirst(qnlabel), qnum: String(idx + 1), clueing: `Who was ${qnlabel}?` }))
  return { ...Quiz.blank(title, label), ...classicLayout(), questions }
}

/** A seeded hunt and who is on it: its smith pat, a second smith sam, lee with a shared review of princes, kim with a draft one */
type PeopledT = Seeded & { sam: Identified, lee: Identified, kim: Identified, hunt_label: string, places: Record<string, PlaceT> }

/**
 * A hunt of three quizzes (princes, paris, kings), princes open, with two smiths and two
 * reviewers: lee's review of princes shared, kim's a draft, and pat's own a draft. Leon's quick
 * guess is recorded.
 */
async function peopled(): Promise<PeopledT> {
  const hunt = huntHolding([quizOf('Princes', 'princes', ['leon', 'nantes']), quizOf('Paris', 'paris', ['louvre']), quizOf('Kings', 'kings', ['arthur', 'alfred'])])
  const seeded = await seedHunt(openTester(), hunt, { smith: 'pat_smiths' })
  const [sam, lee, kim] = [await seeded.join('sam_smiths', 'smith'), await seeded.join('lee_reviews', 'reviewer'), await seeded.join('kim_reviews', 'reviewer')]
  const seen = await seeded.read()
  const places = Object.fromEntries(seen.quizzes.map((quiz) => [quiz.label, { ...seeded.open, quiz_id: quiz._id as Id<'quizzes'> }]))
  const [leon] = present(seen.quizzes[0]).questions
  const { quiz_id } = seeded.open
  await seeded.act({ kind: 'record_widgeted', widgeted: { question_id: present(leon)._id, widgeting_label: 'dumdum', status: 'ok', value: 'Leon?' } })
  for (const by of [lee, kim, seeded.smith]) { await seeded.act({ kind: 'open_review', quiz_id }, by) }
  await seeded.act({ kind: 'set_reviewing', quiz_id, question_id: present(leon)._id, patch: { get_rate: 40, guesses: 'Leon?' } }, lee)
  await seeded.act({ kind: 'set_overall', quiz_id, overall: 'A fair quiz.' }, lee)
  await seeded.act({ kind: 'set_review_phase', quiz_id, phase: 'shared' }, lee)
  await seeded.act({ kind: 'set_overall', quiz_id, overall: 'Unfinished.' }, kim)
  return { ...seeded, sam, lee, kim, hunt_label: seen.hunt.label, places }
}

/** Carry out `action` as `by` from the quiz at `place`, as their browser would affirm it */
async function actIn(held: PeopledT, by: Identified, place: PlaceT, action: HuntActionDNA): Promise<void> {
  const { action: affirms } = await affirmsOf(held.tt, by, place)
  await callerOf(by).mutation(api.hunts.perform, { affirms, action })
}

/**
 * The hunt's files as its rows make them up, apart from any watch: the export of every quiz, the
 * hunt's wheel and members as its smith is shown them, the library, and every review of every
 * quiz, of any phase, read from the rows. Its README left out.
 */
async function filesFromRows(held: PeopledT): Promise<Huntfiles.FilesT> {
  const whole = await wholeHunt(held.tt, held.open.hunt_id)
  const { hunt: opening } = await held.smith.as.query(api.hunts.open, { hunt_label: whole.label })
  const quizzes = whole.realms.flatMap((realm) => realm.quizzes)
  const [library, reviews] = await held.tt.run(async (ctx) => {
    const rows = await libraryOf(ctx.db)
    const byQuiz = await Promise.all(quizzes.map(async (quiz) => {
      const reviewed = await reviewsOf(ctx.db, quiz._id as Id<'quizzes'>)
      return [quiz._id, await Promise.all(reviewed.map(async (review) => {
        const [ident, reviewings] = await Promise.all([ctx.db.get('idents', review.ident_id), reviewingsOf(ctx.db, review._id)])
        return { reviewer: ident && { label: ident.label, title: ident.title }, phase: review.phase, overall: review.overall, reviewings }
      }))] as const
    }))
    return [rows, Object.fromEntries(byQuiz)] as const
  })
  const { wheel, members } = present(opening)
  const files = Huntfiles.huntFiles({ hunt: whole, wheel, members, realms: whole.realms, library: library.map((row) => widgetFrom(row)), reviews })
  files.delete(Huntfiles.ReadmePath)
  return files
}

/** A feed of `held`'s hunt for its smith pat, with the quiz `focus` on screen, settled: the stand-in it watches through, and every reading it handed on */
async function fed(held: PeopledT, focus: string | null = 'princes'): Promise<{ standIn: StandInT, feed: HuntFeedT, readings: HuntReadingT[] }> {
  const standIn = standInFor(held.smith.as)
  const readings: HuntReadingT[] = []
  const { hunt: affirms } = await affirmsOf(held.tt, held.smith, held.open)
  const feed = watchHunt(standIn.watcher, { hunt_label: held.hunt_label, affirms, focus: focus === null ? null : present(held.places[focus]).quiz_id }, (reading) => { readings.push(reading) })
  await standIn.settle()
  return { standIn, feed, readings }
}

/** The last reading handed on */
function lastOf(readings: readonly HuntReadingT[]): HuntReadingT {
  return present(readings.at(-1), 'a reading')
}

describe('watchHunt', () => {
  it("hands on the hunt's files once every quiz it lists is read, as its rows make them up, as the first reading", async () => {
    const held = await peopled()
    const { readings } = await fed(held)
    expect(readings).to.have.lengthOf(1)
    const [reading] = readings
    expect(reading?.first).to.be.true
    expect(reading?.files).to.deep.eq(await filesFromRows(held))
    expect(reading?.hunt.label).to.eq(held.hunt_label)
  })

  it("writes the shared review alone: no draft, the smith's own included", async () => {
    const { readings } = await fed(await peopled())
    const { files } = lastOf(readings)
    expect(files.keys().filter((path) => path.endsWith('.tqr.json')).toArray()).to.deep.eq(['quizzes/home/princes/reviews/lee_reviews.tqr.json'])
  })

  it("keys each part: the hunt-level files, each quiz's by its id, and the widgets'", async () => {
    const held = await peopled()
    const { readings } = await fed(held)
    const { parts } = lastOf(readings)
    expect(parts.keys().toArray()).to.have.members([HuntPartkey, WidgetsPartkey, ...Object.values(held.places).map((place) => place.quiz_id)])
    const princes = parts.get(present(held.places.princes).quiz_id)
    expect(princes?.kind === 'quiz' && [princes.realm, princes.quiz.label]).to.deep.eq(['home', 'princes'])
  })

  it("reads the quiz on screen through the screen's watches, a watch per question, and every other quiz whole", async () => {
    const { standIn } = await fed(await peopled())
    expect(standIn.held()).to.deep.eq([
      'hunts:open', 'questions:open', 'questions:open', 'quizzes:open', 'quizzes:whole', 'quizzes:whole', 'reviews:forQuiz', 'reviews:forQuiz', 'reviews:forQuiz', 'widgets:library',
    ])
  })

  it("reads every quiz whole with no quiz on screen", async () => {
    const { standIn, readings } = await fed(await peopled(), null)
    expect(standIn.held().filter((fnname) => fnname.startsWith('quiz') || fnname.startsWith('question'))).to.deep.eq(['quizzes:whole', 'quizzes:whole', 'quizzes:whole'])
    expect(readings).to.have.lengthOf(1)
  })

  it("hands on a change from another browser, rewriting only its quiz's files, every other part the very same", async () => {
    const held = await peopled()
    const { standIn, readings } = await fed(held)
    const before = lastOf(readings)
    const paris = present(held.places.paris)
    const { quizzes } = await held.read()
    const louvre = present(present(quizzes.find((quiz) => quiz.label === 'paris')).questions[0])
    await actIn(held, held.sam, paris, { kind: 'edit_question', question_id: louvre._id, patch: { clueing: 'Which museum?' } })
    await standIn.settle()
    const after = lastOf(readings)
    expect(after.first).to.be.false
    const changed = Huntfiles.changesBetween(before.files, after.files)
    expect(changed.written.keys().toArray()).to.deep.eq(['quizzes/home/paris.tqq.json', 'quizzes/home/paris/questions.qq.json', 'quizzes/home/paris/questions.qq.tsv'])
    expect(changed.removed).to.deep.eq([])
    const unchanged = before.parts.keys().filter((partkey) => partkey !== paris.quiz_id).toArray()
    expect(unchanged.every((partkey) => before.parts.get(partkey) === after.parts.get(partkey))).to.be.true
    expect(after.files).to.deep.eq(await filesFromRows(held))
  })

  it("hands on an edit to the quiz on screen, sent as that one question", async () => {
    const held = await peopled()
    const { standIn, readings } = await fed(held)
    const { quizzes } = await held.read()
    const leon = present(present(quizzes[0]).questions[0])
    await held.act({ kind: 'edit_question', question_id: leon._id, patch: { notes: 'Check the folio.' } })
    const sent = await standIn.settle()
    expect(sent.byQuery).to.have.keys('questions:open')
    expect(sent.results).to.eq(1)
    expect(lastOf(readings).files.get('quizzes/home/princes/questions.qq.tsv')).to.include('Check the folio.')
  })

  it("hands on nothing for a change that writes no file differently", async () => {
    const held = await peopled()
    const { standIn, readings } = await fed(held)
    await held.act({ kind: 'set_overall', quiz_id: held.open.quiz_id, overall: 'Still unfinished.' }, held.kim)
    await standIn.settle()
    expect(readings).to.have.lengthOf(1)
  })

  it("changes hands when the screen opens another quiz, with nothing to hand on, and closes the quiz it left", async () => {
    const held = await peopled()
    const { standIn, feed, readings } = await fed(held)
    feed.focus(present(held.places.paris).quiz_id)
    await standIn.settle()
    expect(readings).to.have.lengthOf(1)
    expect(standIn.held().filter((fnname) => fnname.startsWith('quiz') || fnname.startsWith('question'))).to.deep.eq(['questions:open', 'quizzes:open', 'quizzes:whole', 'quizzes:whole'])
  })

  it("follows the quiz list: a new quiz joins once read, and a deleted one's files and watches go", async () => {
    const held = await peopled()
    const { standIn, readings } = await fed(held)
    await held.act({ kind: 'new_quiz', label: 'queens' })
    await standIn.settle()
    expect(lastOf(readings).files.keys().toArray()).to.include('quizzes/home/queens.tqq.json')
    const before = lastOf(readings)
    await held.act({ kind: 'delete_quiz', quiz_id: present(held.places.kings).quiz_id })
    await standIn.settle()
    const changed = Huntfiles.changesBetween(before.files, lastOf(readings).files)
    expect(changed.removed.filter((path) => path.includes('/kings'))).to.have.lengthOf(changed.removed.length)
    expect(changed.removed).to.include('quizzes/home/kings.tqq.json')
    expect(standIn.held().filter((fnname) => fnname === 'quizzes:whole')).to.have.lengthOf(2)
    expect(lastOf(readings).files).to.deep.eq(await filesFromRows(held))
  })

  it("moves a relabelled quiz's files", async () => {
    const held = await peopled()
    const { standIn, readings } = await fed(held)
    const before = lastOf(readings)
    await held.act({ kind: 'relabel_quiz', label: 'royals' })
    await standIn.settle()
    const changed = Huntfiles.changesBetween(before.files, lastOf(readings).files)
    expect(changed.removed).to.include('quizzes/home/princes.tqq.json')
    expect(changed.written.keys().toArray()).to.include('quizzes/home/royals.tqq.json')
  })

  it("follows a change to the hunt's wheel, every quiz run against it as its rows make it up", async () => {
    const held = await peopled()
    const { standIn, readings } = await fed(held)
    const before = lastOf(readings)
    const { hunt } = await held.smith.as.query(api.hunts.open, { hunt_label: held.hunt_label })
    const { wheel } = present(hunt)
    await held.smith.as.mutation(api.idents.performAccount, { action: { kind: 'arrange_categories', hunt_id: held.open.hunt_id, wheel: wheel.toReversed() } })
    await standIn.settle()
    expect(Huntfiles.changesBetween(before.files, lastOf(readings).files).written.keys().toArray()).to.include('categories.tqc.json')
    expect(lastOf(readings).files).to.deep.eq(await filesFromRows(held))
  })

  it("hands on nothing more once the browser no longer stands as a smith of the hunt", async () => {
    const held = await peopled()
    const { standIn, readings } = await fed(held)
    await held.tt.run(async (ctx) => {
      const hunting = present(await ctx.db.query('huntings').withIndex('by_ident_id_and_hunt_id', (cvx) => cvx.eq('ident_id', held.smith.ident_id).eq('hunt_id', held.open.hunt_id)).first())
      await ctx.db.patch('huntings', hunting._id, { role: 'reviewer' })
    })
    await actIn(held, held.sam, present(held.places.paris), { kind: 'retitle_quiz', title: 'Paris, again' })
    await standIn.settle()
    expect(readings).to.have.lengthOf(1)
  })

  it("hands on nothing at all to a reviewer, who is not sent every question whole", async () => {
    const held = await peopled()
    const standIn = standInFor(held.lee.as)
    const readings: HuntReadingT[] = []
    const { hunt: affirms } = await affirmsOf(held.tt, held.lee, held.open)
    watchHunt(standIn.watcher, { hunt_label: held.hunt_label, affirms, focus: null }, (reading) => { readings.push(reading) })
    await standIn.settle()
    expect(readings).to.deep.eq([])
  })

  it("closes every watch on stopping, and hands on nothing more", async () => {
    const held = await peopled()
    const { standIn, feed, readings } = await fed(held)
    feed.stop()
    expect(standIn.held()).to.deep.eq([])
    await held.act({ kind: 'retitle_quiz', title: 'Princes, again' })
    await standIn.settle()
    expect(readings).to.have.lengthOf(1)
  })
})
