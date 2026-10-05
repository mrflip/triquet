import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import _ from 'es-toolkit/compat'
import { getFunctionName, type FunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { libraryOf, reviewingsOf, reviewsOf } from '../../convex/reading'
import * as Exporting from '../../src/lib/exporting'
import * as Huntfiles from '../../src/lib/huntfiles'
import { widgetFrom } from '../../src/lib/rows'
import type { HuntActionDNA, HuntAffirmsDNA } from '../../src/models/actions'
import { Question } from '../../src/models/question'
import type { JsonT } from '../../src/models/widgeted'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { HuntPartkey, IdleWaitMs, WidgetsPartkey, huntPartOf, quizPartOf, settleFeeds, watchHunt, widgetsPartOf, type HuntFeedT, type HuntReadingT, type WatcherT } from '../../src/state/hunt-feed'
import { affirmsOf, callerOf, huntHolding, openTester, seedHunt, wholeHunt, type Identified, type PlaceT, type Seeded } from '../support/convex'
import { classicLayout } from '../support/layouts'
import { present } from '../support/present'
import { snapshot } from '../support/snapshots'
import { reviewedOf, shallowOf } from '../support/readings'
import { standInFor, type StandInT } from '../support/watching'

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
type PeopledT = Seeded & { sam: Identified, lee: Identified, kim: Identified, orglabel: string, hunt_label: string, places: Record<string, PlaceT> }

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
  return { ...seeded, sam, lee, kim, orglabel: seeded.smith.label, hunt_label: seen.hunt.label, places }
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
  const { hunt: opening } = await held.smith.as.query(api.hunts.open, { orglabel: held.orglabel, hunt_label: whole.label })
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
  const files = Huntfiles.huntFiles({ hunt: { ...whole, org: held.orglabel }, wheel, members, realms: whole.realms, library: library.map((row) => widgetFrom(row)), reviews })
  files.delete(Huntfiles.ReadmePath)
  return files
}

/**
 * A feed of `held`'s hunt for its smith pat, with the quiz `focus` on screen, settled: the stand-in
 * it watches through, and every reading it handed on. `through` stands between the feed and the
 * stand-in, where a test wants a watch to read otherwise.
 */
async function fed(held: PeopledT, focus: string | null = 'princes', through: (watcher: WatcherT) => WatcherT = (watcher) => watcher): Promise<{ standIn: StandInT, feed: HuntFeedT, readings: HuntReadingT[] }> {
  const standIn = standInFor(held.smith.as)
  const readings: HuntReadingT[] = []
  const { hunt: affirms } = await affirmsOf(held.tt, held.smith, held.open)
  const feed = watchHunt(through(standIn.watcher), { orglabel: held.orglabel, hunt_label: held.hunt_label, affirms, focus: focus === null ? null : present(held.places[focus]).quiz_id }, (reading) => { readings.push(reading) })
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
    const { hunt } = await held.smith.as.query(api.hunts.open, { orglabel: held.orglabel, hunt_label: held.hunt_label })
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
    watchHunt(standIn.watcher, { orglabel: held.orglabel, hunt_label: held.hunt_label, affirms, focus: null }, (reading) => { readings.push(reading) })
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

describe('watchHunt, with a failing watch', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it("reports the failure once, though the client throws a new error at every read, and again once it fails anew", async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => null)
    const state = { failing: true }
    const updates: (() => void)[] = []
    // As the Convex client does, a failed result throws a new error each time it is read.
    const watchQuery = (query: FunctionReference<'query'>) => ({
      localQueryResult: () => {
        if (state.failing && getFunctionName(query) === 'hunts:open') { throw new Error('Too many reads') }
      },
      onUpdate: (callback: () => void) => {
        updates.push(callback)
        return _.noop
      },
    })
    const moment = async () => {
      for (const update of updates) { update() }
      await new Promise((resolve) => { setTimeout(resolve, 0) })
    }
    const affirms = { ident_id: 'ident', hunt_id: 'hunt', standing: 'smith' } as unknown as HuntAffirmsDNA
    const feed = watchHunt({ watchQuery } as unknown as WatcherT, { orglabel: 'pat_smith', hunt_label: 'hunt', affirms, focus: null }, () => null)
    await moment()
    await moment()
    await moment()
    expect(logged).toHaveBeenCalledOnce()
    state.failing = false
    await moment()
    state.failing = true
    await moment()
    expect(logged).toHaveBeenCalledTimes(2)
    feed.stop()
  })
})

/**
 * A watcher whose watches answer only when told: `answer(fnname, result)` gives every watch of
 * that query function the result and tells it so, as the client would.
 */
function scripted(): { watcher: WatcherT, answer: (fnname: string, result: unknown) => void } {
  const results = new Map<string, unknown>()
  const listeners = new Map<string, Set<() => void>>()
  const watchQuery = (query: FunctionReference<'query'>) => {
    const fnname = getFunctionName(query)
    return {
      localQueryResult: () => results.get(fnname),
      onUpdate: (callback: () => void) => {
        const told = listeners.get(fnname) ?? new Set()
        listeners.set(fnname, told.add(callback))
        return () => { told.delete(callback) }
      },
    }
  }
  const answer = (fnname: string, result: unknown) => {
    results.set(fnname, result)
    const told = listeners.get(fnname) ?? new Set()
    for (const callback of told) { callback() }
  }
  return { watcher: { watchQuery } as unknown as WatcherT, answer }
}

/** Once the tasks already queued have run: a reading put off for an idle moment, where there is no idle callback, among them */
async function tick(): Promise<void> {
  await new Promise((resolve) => { setTimeout(resolve, 0) })
}

describe('watchHunt, waited on', () => {
  it("is let go only once every watch it holds has answered, and its reading is handed on", async () => {
    const held = snapshot()
    const princes = present(present(held.realms[0]).quizzes[0])
    const shallow = shallowOf(held)
    const hunt = { ...shallow, realms: [{ ...present(shallow.realms[0]), quizzes: [{ _id: princes._id, label: princes.label }] }] }
    const { watcher, answer } = scripted()
    const readings: HuntReadingT[] = []
    const affirms = { ident_id: 'ident', hunt_id: 'hunt', standing: 'smith' } as unknown as HuntAffirmsDNA
    const feed = watchHunt(watcher, { orglabel: hunt.org, hunt_label: hunt.label, affirms, focus: null }, (reading) => { readings.push(reading) })
    const heard = { read: false }
    void feed.whenRead().then(() => { heard.read = true })

    answer('hunts:open', { hunt })
    answer('widgets:library', held.library)
    await tick()
    answer('reviews:forQuiz', reviewedOf(held, princes))
    await tick()
    expect([heard.read, readings.length]).to.deep.eq([false, 0])
    answer('quizzes:whole', princes)
    await tick()
    expect([heard.read, readings.length]).to.deep.eq([true, 1])
    feed.stop()
  })

  it("is let go at once by a feed that has heard from every watch, and by one stopped", async () => {
    const held = await peopled()
    const { feed } = await fed(held)
    await feed.whenRead()
    const { watcher } = scripted()
    const affirms = { ident_id: 'ident', hunt_id: 'hunt', standing: 'smith' } as unknown as HuntAffirmsDNA
    const unheard = watchHunt(watcher, { orglabel: 'pat_smith', hunt_label: 'nowhere', affirms, focus: null }, () => null)
    const waiting = unheard.whenRead()
    unheard.stop()
    await expect(waiting).resolves.toBeUndefined()
    feed.stop()
  })
})

/** How `quizzes.whole` answers for one quiz, in place of what it read: by failing, or with nothing */
type Breakage = { quiz_id: string | null, answer: 'fails' | 'nothing' }

/** A watch as the feed reads one */
type WatchT = { localQueryResult: () => unknown, onUpdate: (callback: () => void) => () => void }

/** `watcher`, but with `quizzes.whole` for the quiz `broken` names answering as it says, for as long as it names one */
function breaking(broken: Breakage): (watcher: WatcherT) => WatcherT {
  return (watcher) => {
    const watchQuery = (query: FunctionReference<'query'>, args: { affirms?: { quiz_id?: string } }): WatchT => {
      const watch = (watcher.watchQuery as (query: FunctionReference<'query'>, args: unknown) => WatchT)(query, args)
      const quiz_id = getFunctionName(query) === getFunctionName(api.quizzes.whole) ? args.affirms?.quiz_id : undefined
      const localQueryResult = () => {
        if (quiz_id === undefined || quiz_id !== broken.quiz_id) { return watch.localQueryResult() }
        if (broken.answer === 'fails') { throw new Error('Too many reads') }
        return null
      }
      return { localQueryResult, onUpdate: (callback) => watch.onUpdate(callback) }
    }
    return { watchQuery } as unknown as WatcherT
  }
}

describe('watchHunt, with a quiz that cannot be read', () => {
  afterEach(() => { vi.restoreAllMocks() })

  for (const answer of ['fails', 'nothing'] as const) {
    it(`hands on the first reading all the same when a quiz's watch ${answer === 'fails' ? 'fails' : 'answers nothing'}, the quiz unread and none of its files`, async () => {
      vi.spyOn(console, 'error').mockImplementation(() => null)
      const held = await peopled()
      const paris = present(held.places.paris).quiz_id
      const { readings } = await fed(held, 'princes', breaking({ quiz_id: paris, answer }))
      expect(readings).to.have.lengthOf(1)
      const [reading] = readings
      expect(reading?.first).to.be.true
      expect(reading?.unread).to.deep.eq(new Map([[paris, { realm: 'home', label: 'paris' }]]))
      expect(reading?.parts.has(paris)).to.be.false
      expect(reading?.files.keys().filter((path) => path.includes('/paris')).toArray()).to.deep.eq([])
      expect(reading?.files.has('quizzes/home/kings.tqq.json')).to.be.true
    })
  }

  it("lets the quiz join once it can be read, with every file it holds", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => null)
    const held = await peopled()
    const paris = present(held.places.paris).quiz_id
    const broken: Breakage = { quiz_id: paris, answer: 'fails' }
    const { standIn, readings } = await fed(held, 'princes', breaking(broken))
    broken.quiz_id = null
    await held.act({ kind: 'retitle_quiz', title: 'Princes, again' })
    await standIn.settle()
    const after = lastOf(readings)
    expect([after.first, after.unread.size, after.parts.has(paris)]).to.deep.eq([false, 0, true])
    expect(after.files).to.deep.eq(await filesFromRows(held))
  })

  it("holds a quiz read before as last read when its watch then fails, and calls it read", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => null)
    const held = await peopled()
    const paris = present(held.places.paris).quiz_id
    const broken: Breakage = { quiz_id: null, answer: 'fails' }
    const { standIn, readings } = await fed(held, 'princes', breaking(broken))
    const before = lastOf(readings)
    broken.quiz_id = paris
    await held.act({ kind: 'retitle_quiz', title: 'Princes, again' })
    await standIn.settle()
    const after = lastOf(readings)
    expect(after.parts.get(paris)).to.eq(before.parts.get(paris))
    expect(after.unread.size).to.eq(0)
  })
})

/** Idle callbacks, held until a test runs them: each with the most it was asked to wait, and whether it was called off */
function heldIdle(): { pending: () => (() => void)[], timeouts: () => number[], cancelled: Set<number> } {
  const asked: { work: () => void, timeout: number }[] = []
  const cancelled = new Set<number>()
  vi.stubGlobal('requestIdleCallback', (work: () => void, opts: { timeout: number }) => {
    asked.push({ work, timeout: opts.timeout })
    return asked.length
  })
  vi.stubGlobal('cancelIdleCallback', (handle: number) => { cancelled.add(handle) })
  const ran = new Set<number>()
  const pending = () => asked.flatMap(({ work }, idx) => {
    const handle = idx + 1
    if (ran.has(handle) || cancelled.has(handle)) { return [] }
    ran.add(handle)
    return [work]
  })
  return { pending, timeouts: () => asked.map(({ timeout }) => timeout), cancelled }
}

describe('watchHunt, when the browser is idle', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it("puts each reading off until the browser is idle, then hands on whatever arrived meanwhile", async () => {
    const idle = heldIdle()
    const held = await peopled()
    const { standIn, readings } = await fed(held)
    for (let works = idle.pending(); works.length > 0; works = idle.pending()) {
      expect(readings).to.have.lengthOf(0)
      for (const work of works) { work() }
      await standIn.settle()
    }
    expect(readings).to.have.lengthOf(1)
    expect(lastOf(readings).files).to.deep.eq(await filesFromRows(held))
    expect(new Set(idle.timeouts())).to.deep.eq(new Set([IdleWaitMs]))
  })

  it("hands on a reading put off at once when settled, calling off its idle callback", async () => {
    const idle = heldIdle()
    const held = await peopled()
    const { standIn, readings } = await fed(held)
    for (let works = idle.pending(); works.length > 0; works = idle.pending()) {
      for (const work of works) { work() }
      await standIn.settle()
    }
    await held.act({ kind: 'retitle_quiz', title: 'Princes, again' })
    await standIn.settle()
    expect(readings).to.have.lengthOf(1)
    settleFeeds()
    expect(readings).to.have.lengthOf(2)
    expect(lastOf(readings).files.get('quizzes/home/princes.tqq.json')).to.include('Princes, again')
    expect(idle.cancelled.size).to.eq(1)
    expect(idle.pending()).to.deep.eq([])
  })
})

// --- Measured: what the feed costs on a large hunt. `TQ_MEASURE_FEED=1 pnpm vitest run tests/state/hunt-feed.test.ts`
// runs it (about five minutes) and writes its table to `MeasuredPath`.

/** Where the measurement's table is written */
const MeasuredPath = 'data/measurements/hunt-feed.txt'

/** The large hunt's size: quizzes, questions in each, and reviewers who have shared a review of every quiz */
const Large = { quizzes: 20, questions: 40, reviewers: 2 } as const

/** A clueing of about the length a real one runs to */
const LongClueing = 'At a glance, the lines below are gibberish; but in a different sense they are quite familiar. Describe WHAT are lost, and name the flock that lost them, as a nursery rhyme would: Lille beau pipe, Ocelot serre chypre, En douzaine aux verres tuf indemne.'

/** What each of a classic quiz's bots recorded for a question, as a real ask leaves it */
const Recorded: Readonly<Record<string, JsonT>> = {
  dumdum:         'Little Bo Peep\'s sheep, by the sound of it.',
  numnum_clueing: { items: [{ text: 'douzaine', value: 12, kind: 'wordish' }, { text: 'un', value: 1, kind: 'wordish' }, { text: 'three', value: 3, kind: 'wordish' }] },
  numnum_hint:    { items: [{ text: '1997', value: 1997, kind: 'numeral' }, { text: '385', value: 385, kind: 'numeral' }] },
}

/** A large hunt: `Large.quizzes` classic quizzes of `Large.questions` clued questions, every bot answered for every question, and a shared review of every quiz by each reviewer, a verdict on every question */
async function largeHunt(): Promise<PeopledT> {
  const labels = Array.from({ length: Large.questions }, (_unused, idx) => `qn_${String(idx + 1).padStart(3, '0')}`)
  const quizzes = Array.from({ length: Large.quizzes }, (_unused, idx) => {
    const quiz = quizOf(`Quiz ${String(idx + 1)}`, `quiz_${String(idx + 1).padStart(2, '0')}`, labels)
    return { ...quiz, questions: quiz.questions.map((question) => ({ ...question, clueing: LongClueing, hint: 'the progenitors in Viable offspring from a differentiated adult mammalian cell', full_answer: '(Little Bo Peep\'s) Sheep', notes: 'Accept DOLLY and DALI' })) }
  })
  const seeded = await seedHunt(openTester(), huntHolding(quizzes), { smith: 'pat_smiths' })
  const sam = await seeded.join('sam_smiths', 'smith')
  const reviewers = await Promise.all(Array.from({ length: Large.reviewers }, async (_unused, idx) => await seeded.join(`reviewer_${String(idx + 1)}`, 'reviewer')))
  await seeded.tt.run(async (ctx) => {
    const rows = await ctx.db.query('quizzes').withIndex('by_hunt_id', (cvx) => cvx.eq('hunt_id', seeded.open.hunt_id)).collect()
    for (const quiz of rows) {
      const widgetings = await ctx.db.query('widgetings').withIndex('by_quiz_id_and_position', (cvx) => cvx.eq('quiz_id', quiz._id)).collect()
      const bots = widgetings.flatMap((widgeting) => {
        const value = Recorded[widgeting.label]
        return value === undefined ? [] : [{ widgeting_id: widgeting._id, value }]
      })
      for (const question_id of quiz.row_ordering) {
        for (const { widgeting_id, value } of bots) {
          await ctx.db.insert('widgeteds', { hunt_id: quiz.hunt_id, quiz_id: quiz._id, question_id, widgeting_id, status: 'ok', value, message: null, result_meta: { model_tier_applied: 'quick', approx_tokens: 312, truncated: false } })
        }
      }
      for (const reviewer of reviewers) {
        const review_id = await ctx.db.insert('reviews', { hunt_id: quiz.hunt_id, quiz_id: quiz._id, ident_id: reviewer.ident_id, overall: 'A fair quiz, a little long in the middle.', phase: 'shared' })
        for (const question_id of quiz.row_ordering) {
          await ctx.db.insert('reviewings', { hunt_id: quiz.hunt_id, quiz_id: quiz._id, ident_id: reviewer.ident_id, review_id, question_id, get_rate: 40, guesses: 'Sheep?', comments: 'Lovely, but the French is hard going.', minutes: 2, keep_it: false, needs_fact_check: false, elimination_candidate: false, peeked: false })
        }
      }
    }
  })
  const seen = await seeded.read()
  const places = Object.fromEntries(seen.quizzes.map((quiz) => [quiz.label, { ...seeded.open, quiz_id: quiz._id as Id<'quizzes'> }]))
  const [lee = sam, kim = sam] = reviewers
  return { ...seeded, sam, lee, kim, orglabel: seeded.smith.label, hunt_label: seen.hunt.label, places }
}

/** `sent` as a line of the table: results, kilobytes, and kilobytes by query function */
function sentLine(sent: Awaited<ReturnType<StandInT['settle']>>): string {
  const byQuery = Object.entries(sent.byQuery).map(([fnname, counted]) => `${fnname} ${String(counted.results)} / ${(counted.bytes / 1024).toFixed(1)} KB`)
  return `${String(sent.results)} results, ${(sent.bytes / 1024).toFixed(1)} KB (${byQuery.join('; ')})`
}

describe.runIf(process.env.TQ_MEASURE_FEED === '1')("the feed, measured on a large hunt", () => {
  it("prints its subscriptions, what it is sent, and what it works out", { timeout: 600_000 }, async () => {
    const held = await largeHunt()
    const lines: string[] = [`A hunt of ${String(Large.quizzes)} quizzes of ${String(Large.questions)} questions, classic layout, every bot answered, ${String(Large.reviewers)} shared reviews of each`]
    const { standIn, readings } = await fed(held, 'quiz_01')
    const [first] = readings
    const subscriptions = standIn.held()
    const screens = subscriptions.filter((fnname) => fnname !== 'quizzes:whole').length - (Large.quizzes - 1)
    lines.push(
      `Subscriptions: ${String(subscriptions.length)} (${String(screens)} of them the screen's own); with every quiz read per question, ${String(2 + (Large.quizzes * (Large.questions + 2)))}`,
      `Files in the first reading: ${String(first?.files.size)}, ${((first?.files.values().reduce((sum, body) => sum + body.length, 0) ?? 0) / 1024).toFixed(0)} KB`,
    )

    const { quizzes } = await held.read()
    const opened = present(quizzes.find((quiz) => quiz.label === 'quiz_01'))
    const other = present(quizzes.find((quiz) => quiz.label === 'quiz_02'))
    const fresh = standInFor(held.smith.as)
    const { hunt: affirms } = await affirmsOf(held.tt, held.smith, held.open)
    const elsewhere: HuntReadingT[] = []
    watchHunt(fresh.watcher, { orglabel: held.orglabel, hunt_label: held.hunt_label, affirms, focus: opened._id as Id<'quizzes'> }, (each) => { elsewhere.push(each) })
    lines.push(`First full reading sent: ${sentLine(await fresh.settle())}`)
    const library = await held.smith.as.query(api.widgets.library, {})
    const reading = present(first)
    const realm = present(reading.hunt.realms[0])
    const read = reading.parts.values().flatMap((part) => (part.kind === 'quiz' ? [part.quiz] : [])).toArray()
    const begun = performance.now()
    for (const quiz of read) { quizPartOf(reading.hunt, library, realm, quiz, []) }
    const quizMs = (performance.now() - begun) / read.length
    lines.push(`Making one quiz's files (run, balls, JSON and tables): ${quizMs.toFixed(0)} ms; every quiz's, as a change to the library or the wheel asks: ${(quizMs * read.length).toFixed(0)} ms`)

    const burst = async (title: string, edits: number, edit: (idx: number) => Promise<void>) => {
      const sent = { results: 0, bytes: 0, byQuery: {} as Record<string, { results: number, bytes: number }> }
      const ante = readings.length
      for (let ii = 0; ii < edits; ii++) {
        await edit(ii)
        const each = await standIn.settle()
        sent.results += each.results
        sent.bytes += each.bytes
        for (const [fnname, counted] of Object.entries(each.byQuery)) {
          const was = sent.byQuery[fnname] ?? { results: 0, bytes: 0 }
          sent.byQuery[fnname] = { results: was.results + counted.results, bytes: was.bytes + counted.bytes }
        }
      }
      lines.push(`${title}, ${String(edits)} edits: ${sentLine(sent)}; ${String(readings.length - ante)} readings`)
    }
    const openPlace = present(held.places.quiz_01)
    const otherPlace = present(held.places.quiz_02)
    await burst('The author, in the quiz on screen', 10, async (idx) => {
      await actIn(held, held.smith, openPlace, { kind: 'edit_question', question_id: present(opened.questions[idx])._id, patch: { notes: `Checked ${String(idx)}.` } })
    })
    await burst('Another smith, in another quiz', 10, async (idx) => {
      await actIn(held, held.sam, otherPlace, { kind: 'edit_question', question_id: present(other.questions[idx])._id, patch: { notes: `Checked ${String(idx)}.` } })
    })
    await burst('A bot answering, in another quiz', 10, async (idx) => {
      await actIn(held, held.sam, otherPlace, { kind: 'record_widgeted', widgeted: { question_id: present(other.questions[idx])._id, widgeting_label: 'dumdum', status: 'ok', value: `Sheep, ${String(idx)}?` } })
    })
    await burst('The hunt retitled', 1, async () => {
      await actIn(held, held.smith, openPlace, { kind: 'retitle_hunt', title: 'A New Title' })
    })
    const question = present(other.questions[0])
    const one = await held.smith.as.query(api.questions.open, { question_id: question._id, affirms })
    lines.push(`One question as questions.open sends it: ${(JSON.stringify(one).length / 1024).toFixed(1)} KB; one quiz as quizzes.whole sends it: ${(JSON.stringify(await held.smith.as.query(api.quizzes.whole, { affirms: { ...affirms, quiz_id: other._id } })).length / 1024).toFixed(1)} KB`)
    mkdirSync(path.dirname(MeasuredPath), { recursive: true })
    writeFileSync(MeasuredPath, `${lines.join('\n')}\n`)
    expect(readings.length).to.be.greaterThan(1)
    expect(elsewhere.map((each) => each.files)).to.deep.eq([first?.files])
  })
})
