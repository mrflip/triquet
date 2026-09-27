import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from 'jazz-tools'
import type { PolicyTestApp } from 'jazz-tools/testing'
import { app } from '../../src/db/schema'
import { askedAt, expressionFrom, huntFrom, huntListingsOf, huntRowFor, idsIn, idsKey, huntRowsOf, LocalFirst, loadDirectory, loadHeldRows, loadHunt, loadQuizRows, quizFrom, reviewRowFor, type QuizRows } from '../../src/state/quiz-rows'
import { transact, writeHunt } from '../../src/state/quiz-writing'
import { SeedExpressions } from '../../src/models/expression'
import { Hunt, type HuntT } from '../../src/models/hunt'
import { Question } from '../../src/models/question'
import { Quiz } from '../../src/models/quiz'
import { mintId } from '../../src/lib/ids'
import { present } from '../support/present'
import { freshDb, huntHolding, openTestApp } from '../support/jazz'

/** A fresh account's database, holding `hunt`, and its first quiz's id */
async function holding(testApp: PolicyTestApp, hunt: HuntT): Promise<{ db: Db, hunt_id: string, quiz_id: string }> {
  const db = freshDb(testApp)
  const hunt_id = present(await transact(db, (tx) => writeHunt(tx, hunt)))
  const rows = present(huntRowsOf(await loadHeldRows(db, hunt_id), hunt_id))
  return { db, hunt_id, quiz_id: present(rows.quizzes[0]).id }
}

/** One quiz's rows, which must be there */
async function rowsOf(db: Db, quiz_id: string): Promise<QuizRows> {
  return present(await loadQuizRows(db, quiz_id))
}

/** One quiz's question rows, in order */
async function questionsOf(db: Db, quiz_id: string): Promise<QuizRows['questions']> {
  const { questions } = await rowsOf(db, quiz_id)
  return questions
}

/** `hunt` with every id blanked, for comparing a tree with the one its rows make up */
function sansIds(hunt: HuntT) {
  return {
    ...hunt,
    id:     '',
    realms: hunt.realms.map((realm) => ({
      ...realm,
      id:      '',
      quizzes: realm.quizzes.map((quiz) => ({ ...quiz, id: '', questions: quiz.questions.map((question) => ({ ...question, id: '' })) })),
    })),
  }
}

/** A hunt of one quiz, its questions labelled `aa`, `bb` and `cc` */
function threeQuestions(): HuntT {
  return huntHolding([{ ...Quiz.blank(), questions: ['aa', 'bb', 'cc'].map((label) => ({ ...Question.blank(), label, title: label.toUpperCase() })) }])
}

/** Let a few milliseconds pass */
async function pause(millis: number): Promise<void> {
  await new Promise((resolve) => { setTimeout(resolve, millis) })
}

describe('reading rows', () => {
  let testApp: PolicyTestApp
  beforeAll(async () => { testApp = await openTestApp() })
  afterAll(async () => { await testApp.shutdown() })

  describe('loadHunt', () => {
    it('reads back a hunt exactly as it was written, apart from its ids', async () => {
      const hunt = Hunt.blank()
      const { db, hunt_id } = await holding(testApp, hunt)
      const back = present(await loadHunt(db, hunt_id))
      expect(sansIds(back)).to.deep.eq(sansIds(hunt))
    })

    it('keeps the quizzes in the order they were made', async () => {
      const { db, hunt_id } = await holding(testApp, huntHolding(['one', 'two', 'three'].map((title) => Quiz.blank(title))))
      const back = present(await loadHunt(db, hunt_id))
      expect(present(back.realms[0]).quizzes.map((quiz) => quiz.title)).to.deep.eq(['one', 'two', 'three'])
    })

    it('keeps the realms in their order, each with its own quizzes', async () => {
      const hunt = Hunt.fill({
        id:     mintId(),
        label:  'two_realms',
        realms: [
          { id: mintId(), label: 'home', quizzes: [Quiz.blank('At home')] },
          { id: mintId(), label: 'away', quizzes: [Quiz.blank('Away one'), Quiz.blank('Away two')] },
        ],
      })
      const { db, hunt_id } = await holding(testApp, hunt)
      const back = present(await loadHunt(db, hunt_id))
      expect(back.realms.map((realm) => [realm.label, realm.title, realm.quizzes.map((quiz) => quiz.title)])).to.deep.eq([
        ['home', 'Home', ['At home']],
        ['away', 'Away', ['Away one', 'Away two']],
      ])
    })

    it('reads null for a hunt nobody holds', async () => {
      const { db } = await holding(testApp, Hunt.blank())
      expect(await loadHunt(db, '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f9')).to.eq(null)
    })

    it('reads a hunt another account made, for the trial', async () => {
      const { hunt_id } = await holding(testApp, Hunt.blank())
      const { db } = await holding(testApp, Hunt.blank())
      expect(await loadHunt(db, hunt_id)).to.not.eq(null)
    })
  })

  describe('huntFrom', () => {
    it('reads null for a hunt whose realm has not arrived yet', async () => {
      const { db, hunt_id } = await holding(testApp, Hunt.blank())
      const held = await loadHeldRows(db, hunt_id)
      expect(huntFrom({ ...held, realms: held.realms.filter((row) => row.hunt_id !== hunt_id) }, hunt_id)).to.eq(null)
    })

    it('reads null for a hunt whose realm has no quiz yet', async () => {
      const { db, hunt_id, quiz_id } = await holding(testApp, Hunt.blank())
      const held = await loadHeldRows(db, hunt_id)
      expect(huntFrom({ ...held, quizzes: held.quizzes.filter((row) => row.id !== quiz_id) }, hunt_id)).to.eq(null)
    })
  })

  describe('huntRowFor', () => {
    it('finds a hunt by the label in force', async () => {
      const hunt = { ...Hunt.blank(), forced_label: `forced_${mintId().slice(-8)}` }
      const { db, hunt_id } = await holding(testApp, hunt)
      const held = await loadDirectory(db)
      expect([huntRowFor(held, present(hunt.forced_label))?.id, huntRowFor(held, hunt.label)]).to.deep.eq([hunt_id, undefined])
    })

    it('takes the earlier of two hunts made with one label', async () => {
      const label = `twice_${mintId().slice(-8)}`
      const first = await holding(testApp, Hunt.blank(label))
      await holding(testApp, Hunt.blank(label))
      expect(huntRowFor(await loadDirectory(first.db), label)?.id).to.eq(first.hunt_id)
    })
  })

  describe('huntRowsOf', () => {
    it('reads the hunt\'s own row, its realms, its quizzes\' rows and its expressions in order', async () => {
      const { db, hunt_id } = await holding(testApp, Hunt.blank())
      const rows = present(huntRowsOf(await loadHeldRows(db, hunt_id), hunt_id))
      expect(rows.realms.map((row) => row.label)).to.deep.eq(['home'])
      expect(rows.quizzes).to.have.length(1)
      expect(rows.expressions.map((row) => row.label)).to.deep.eq(SeedExpressions.map((expression) => expression.label))
    })
  })

  describe('loadHeldRows', () => {
    it('reads the directory whole, and only the named hunt\'s rows below it', async () => {
      const guess = { status: 'done' as const, text: 'Leon', truncated: false, updated_at: Date.now(), last_err: null }
      const mine = await holding(testApp, huntHolding([{ ...Quiz.blank(), questions: [{ ...Question.blank(), clueing: 'Who?', guess }] }]))
      const theirs = await holding(testApp, Hunt.blank())
      const held = await loadHeldRows(mine.db, mine.hunt_id)
      expect(held.hunts.map((row) => row.id)).to.include.members([mine.hunt_id, theirs.hunt_id])
      expect(held.questions.map((row) => row.quiz_id)).to.deep.eq([mine.quiz_id])
      expect(held.bottings.map((row) => row.reply_text)).to.deep.eq(['Leon'])
      expect(held.expressions).to.deep.eq([])
      expect([...held.widgets, ...held.columns].filter((row) => row.quiz_id !== mine.quiz_id)).to.deep.eq([])
    })

    it('reads only the named hunt\'s reviews', async () => {
      const mine = await holding(testApp, Hunt.blank())
      const theirs = await holding(testApp, Hunt.blank())
      mine.db.insert(app.reviews, { quiz_id: mine.quiz_id, ident_id: mintId(), overall: '', phase: 'empty' })
      mine.db.insert(app.reviews, { quiz_id: theirs.quiz_id, ident_id: mintId(), overall: '', phase: 'empty' })
      const held = await loadHeldRows(mine.db, mine.hunt_id)
      expect(held.reviews.map((row) => row.quiz_id)).to.deep.eq([mine.quiz_id])
    })
  })

  describe('reviewRowFor', () => {
    it('finds the ident\'s review among a quiz\'s reviews', async () => {
      const mine = await holding(testApp, Hunt.blank())
      const ident_id = mintId()
      mine.db.insert(app.reviews, { quiz_id: mine.quiz_id, ident_id, overall: 'Mine', phase: 'draft' })
      const { reviews } = present(await loadQuizRows(mine.db, mine.quiz_id))
      expect(reviewRowFor(reviews, ident_id)?.overall).to.eq('Mine')
      expect(reviewRowFor(reviews, mintId())).to.eq(undefined)
    })

    it('takes the earlier when two reviews answer to one ident', async () => {
      const mine = await holding(testApp, Hunt.blank())
      const ident_id = mintId()
      mine.db.insert(app.reviews, { quiz_id: mine.quiz_id, ident_id, overall: 'First', phase: 'empty' })
      await pause(3)
      mine.db.insert(app.reviews, { quiz_id: mine.quiz_id, ident_id, overall: 'Second', phase: 'empty' })
      const { reviews } = present(await loadQuizRows(mine.db, mine.quiz_id))
      expect(reviewRowFor(reviews, ident_id)?.overall).to.eq('First')
    })
  })

  describe('idsKey', () => {
    it('is the same text whatever order the rows come in, and idsIn reads it back', () => {
      const key = idsKey([{ id: 'bb' }, { id: 'aa' }])
      expect([key, idsKey([{ id: 'aa' }, { id: 'bb' }])]).to.deep.eq(['aa bb', 'aa bb'])
      expect([idsIn(key), idsIn(idsKey([]))]).to.deep.eq([['aa', 'bb'], []])
    })
  })

  describe('huntListingsOf', () => {
    it('lists each hunt titled, with its realms\' quizzes in the order they were made', async () => {
      const { db, hunt_id } = await holding(testApp, huntHolding([Quiz.blank('First'), Quiz.blank('Second')]))
      const listing = present(huntListingsOf(await loadDirectory(db)).find((hunt) => hunt.id === hunt_id))
      expect(listing.title).to.not.eq('')
      expect(listing.realms.map((realm) => [realm.label, realm.quizzes.map((quiz) => quiz.title)])).to.deep.eq([['home', ['First', 'Second']]])
    })
  })

  describe('loadQuizRows', () => {
    it('reads every row of one quiz, each list in its committed order', async () => {
      const quiz = { ...Quiz.blank('Princes'), questions: ['b', 'a', 'c'].map((title) => ({ ...Question.blank(), title })) }
      const { db, quiz_id } = await holding(testApp, huntHolding([quiz]))
      const rows = await rowsOf(db, quiz_id)
      expect(rows.quiz.title).to.eq('Princes')
      expect(rows.questions.map((row) => [row.title, row.position])).to.deep.eq([['b', 0], ['a', 1], ['c', 2]])
      expect([rows.widgets, rows.columns, rows.bottings]).to.deep.eq([[], [], []])
    })

    it('reads the bottings of its questions, and when each was asked once Jazz has stamped it', async () => {
      const guess = { status: 'done' as const, text: 'Leon', truncated: false, updated_at: Date.now(), last_err: null }
      const quiz = { ...Quiz.blank(), questions: [{ ...Question.blank(), clueing: 'Who?', guess }] }
      const { db, quiz_id } = await holding(testApp, huntHolding([quiz]))
      const { bottings } = await rowsOf(db, quiz_id)
      expect(bottings[0]).to.deep.include({ bot_label: 'dumdum', textkind: 'clueing', reply_text: 'Leon', asked_text: 'Who?' })
      await pause(200)
      const { bottings: stamped } = await rowsOf(db, quiz_id)
      expect(stamped[0]?.$createdAt).to.be.instanceOf(Date)
    })

    it('reads null for a quiz nobody holds', async () => {
      const { db } = await holding(testApp, Hunt.blank())
      expect(await loadQuizRows(db, '01a0dc10-c9be-7cb3-9d3a-25fc68cd12f9')).to.eq(null)
    })
  })

  describe('quizFrom', () => {
    it('names each question by its row\'s id', async () => {
      const { db, quiz_id } = await holding(testApp, threeQuestions())
      const rows = await rowsOf(db, quiz_id)
      expect(quizFrom(rows).questions.map((question) => question.id)).to.deep.eq(rows.questions.map((row) => row.id))
    })

    it('reads a chain held as a label as the id of the question answering to it', async () => {
      const { db, quiz_id } = await holding(testApp, threeQuestions())
      const [first, , third] = await questionsOf(db, quiz_id)
      await transact(db, (tx) => { tx.update(app.questions, present(first).id, { chains_to: 'cc' }) })
      const after = quizFrom(await rowsOf(db, quiz_id))
      expect(after.questions[0]?.chains_to).to.eq(present(third).id)
    })

    it('reads a chain by the label in force, an override included', async () => {
      const { db, quiz_id } = await holding(testApp, threeQuestions())
      const [first, second] = await questionsOf(db, quiz_id)
      await transact(db, (tx) => {
        tx.update(app.questions, present(second).id, { forced_label: 'bee' })
        tx.update(app.questions, present(first).id, { chains_to: 'bee' })
      })
      const after = quizFrom(await rowsOf(db, quiz_id))
      expect(after.questions[0]?.chains_to).to.eq(present(second).id)
    })

    it('reads a chain to no question here, or to itself, as no chain', async () => {
      const { db, quiz_id } = await holding(testApp, threeQuestions())
      const [first, second] = await questionsOf(db, quiz_id)
      await transact(db, (tx) => {
        tx.update(app.questions, present(first).id, { chains_to: 'nobody' })
        tx.update(app.questions, present(second).id, { chains_to: 'bb' })
      })
      const after = quizFrom(await rowsOf(db, quiz_id))
      expect(after.questions.map((question) => question.chains_to)).to.deep.eq([null, null, null])
    })

    it('shows each cell\'s newest reply, stale once its text is edited', async () => {
      const { db, quiz_id } = await holding(testApp, threeQuestions())
      const [question] = await questionsOf(db, quiz_id)
      const question_id = present(question).id
      const ask = async (reply_text: string) => {
        const items = [{ text: reply_text, value: 1, kind: 'numeral' as const }]
        await transact(db, (tx) => {
          tx.insert(app.bottings, { question_id, bot_label: 'numnum', textkind: 'clueing', asked_text: '', status: 'done', reply_text, truncated: false, items })
        })
      }
      await ask('older')
      await pause(3)
      await ask('newer')
      const fresh = quizFrom(await rowsOf(db, quiz_id))
      expect(fresh.questions[0]?.clueing_ishes).to.deep.include({ status: 'done', items: [{ text: 'newer', value: 1, kind: 'numeral' }], stale: false })
      await transact(db, (tx) => { tx.update(app.questions, question_id, { clueing: 'Reworded' }) })
      const edited = quizFrom(await rowsOf(db, quiz_id))
      expect(edited.questions[0]?.clueing_ishes).to.deep.include({ stale: true })
    })
  })

  describe('expressionFrom', () => {
    it('is the expression, without its row\'s place or hunt', async () => {
      const { db, hunt_id } = await holding(testApp, Hunt.blank())
      const [row] = await db.all(app.expressions.where({ hunt_id }).orderBy('position'), LocalFirst)
      expect(expressionFrom(present(row))).to.deep.eq(SeedExpressions[0])
    })
  })
})

describe('askedAt', () => {
  const botting = {
    id: '', question_id: '', bot_label: 'dumdum', textkind: 'clueing', asked_text: null, status: 'done', reply_text: null,
    items: [], message: null, response: null, truncated: false, model_tier_applied: null, approx_tokens: null,
  } as const

  it('is when Jazz stamped the botting', () => {
    expect(askedAt({ ...botting, items: [], $createdAt: new Date(1_700_000_000_000) })).to.eq(1_700_000_000_000)
  })

  it('is now for one it has not stamped yet', () => {
    const before = Date.now()
    expect(askedAt({ ...botting, items: [] })).to.be.at.least(before)
  })
})
