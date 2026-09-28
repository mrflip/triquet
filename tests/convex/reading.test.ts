import { describe, expect, it } from 'vitest'
import type { Id } from '../../convex/_generated/dataModel'
import { huntForLabel, huntRowsOf, identFor, quizRowsOf, realmsOf, reviewFor } from '../../convex/reading'
import { writeHunt } from '../../convex/writing/quiz_writing'
import { SeedExpressions } from '../../src/models/expression'
import { Hunt, type HuntT } from '../../src/models/hunt'
import { Question } from '../../src/models/question'
import { Quiz } from '../../src/models/quiz'
import { mintId } from '../../src/lib/ids'
import { present } from '../support/present'
import { huntHolding, identified, openTester, type Tester } from '../support/convex'

/** A fresh deployment holding `hunt`, and its first quiz's id */
async function holding(hunt: HuntT, tt: Tester = openTester()): Promise<{ tt: Tester, hunt_id: Id<'hunts'>, quiz_id: Id<'quizzes'> }> {
  const hunt_id = await tt.run(async (ctx) => await writeHunt(ctx.db, hunt))
  const [home] = await tt.run(async (ctx) => await realmsOf(ctx.db, hunt_id))
  return { tt, hunt_id, quiz_id: present(present(home).quizzes[0])._id }
}

/** One quiz's rows, as plain values, which must be there */
async function rowsOf(tt: Tester, quiz_id: Id<'quizzes'>) {
  return await tt.run(async (ctx) => {
    const rows = present(await quizRowsOf(ctx.db, quiz_id))
    return { ...rows, slots: Object.fromEntries(rows.slots) }
  })
}

/** A botting of a numnum reading of a question's clueing, as the row holds it */
function numnum(question_id: Id<'questions'>, status: 'done' | 'error', reply: string) {
  return {
    question_id, bot_label: 'numnum' as const, textkind: 'clueing' as const, asked_text: '', status, reply_text: null,
    items: status === 'done' ? [{ text: reply, value: 1, kind: 'numeral' as const }] : [], message: status === 'error' ? reply : null,
    response: null, truncated: false, model_tier_applied: null, approx_tokens: null,
  }
}

describe('huntForLabel', () => {
  it('finds a hunt by the label in force', async () => {
    const hunt = { ...Hunt.blank('minted_label'), forced_label: 'forced_label' }
    const { tt, hunt_id } = await holding(hunt)
    const found = await tt.run(async (ctx) => [await huntForLabel(ctx.db, 'forced_label'), await huntForLabel(ctx.db, 'minted_label')])
    expect(found.map((row) => row?._id ?? null)).to.deep.eq([hunt_id, null])
  })

  it('takes the earlier of two hunts made with one label, whichever label each has in force', async () => {
    const first = await holding(Hunt.blank('twice_made'))
    await holding({ ...Hunt.blank('other_label'), forced_label: 'twice_made' }, first.tt)
    await holding(Hunt.blank('twice_made'), first.tt)
    const found = await first.tt.run(async (ctx) => await huntForLabel(ctx.db, 'twice_made'))
    expect(found?._id).to.eq(first.hunt_id)
  })

  it('finds nothing for a label no hunt answers to', async () => {
    const { tt } = await holding(Hunt.blank('quiet_otter'))
    expect(await tt.run(async (ctx) => await huntForLabel(ctx.db, 'loud_heron'))).to.eq(null)
  })
})

describe('huntRowsOf', () => {
  it('reads the hunt\'s own row, its realms in order with their quizzes\' rows, and its expressions in order', async () => {
    const hunt = Hunt.fill({
      _id:         mintId(),
      label:       'two_realms',
      realms:      [
        { _id: mintId(), label: 'home', quizzes: [Quiz.blank('At home')] },
        { _id: mintId(), label: 'away', quizzes: [Quiz.blank('Away one'), Quiz.blank('Away two')] },
      ],
      expressions: [...SeedExpressions],
    })
    const { tt, hunt_id } = await holding(hunt)
    const rows = present(await tt.run(async (ctx) => await huntRowsOf(ctx.db, hunt_id)))
    expect(rows.realms.map(({ realm, quizzes }) => [realm.label, quizzes.map((quiz) => quiz.title)])).to.deep.eq([
      ['home', ['At home']],
      ['away', ['Away one', 'Away two']],
    ])
    expect(rows.expressions.map((row) => row.label)).to.deep.eq(SeedExpressions.map((expression) => expression.label))
  })

  it('reads null for a hunt that is not there', async () => {
    const { tt, hunt_id } = await holding(Hunt.blank())
    await tt.run(async (ctx) => { await ctx.db.delete('hunts', hunt_id) })
    expect(await tt.run(async (ctx) => await huntRowsOf(ctx.db, hunt_id))).to.eq(null)
  })
})

describe('quizRowsOf', () => {
  it('reads every row of one quiz, each list in its committed order', async () => {
    const quiz = { ...Quiz.blank('Princes'), questions: ['b', 'a', 'c'].map((title) => ({ ...Question.blank(), title })) }
    const { tt, quiz_id } = await holding(huntHolding([quiz]))
    const rows = await rowsOf(tt, quiz_id)
    expect(rows.quiz.title).to.eq('Princes')
    expect(rows.questions.map((row) => row.title)).to.deep.eq(['b', 'a', 'c'])
    expect(rows.questions.map((row) => row._id)).to.deep.eq(rows.quiz.row_ordering)
    expect([rows.widgets, rows.columns, rows.slots]).to.deep.eq([[], [], {}])
  })

  it('reads null for a quiz that is not there', async () => {
    const { tt, quiz_id } = await holding(Hunt.blank())
    await tt.run(async (ctx) => { await ctx.db.delete('quizzes', quiz_id) })
    expect(await tt.run(async (ctx) => await quizRowsOf(ctx.db, quiz_id))).to.eq(null)
  })

  it('reads each cell\'s newest botting, and the newest that answered', async () => {
    const quiz = { ...Quiz.blank(), questions: [Question.blank(), Question.blank()] }
    const { tt, quiz_id } = await holding(huntHolding([quiz]))
    const { questions } = await rowsOf(tt, quiz_id)
    const [first, second] = questions.map((row) => row._id)
    await tt.run(async (ctx) => {
      for (const botting of [
        numnum(present(first), 'done', 'oldest'), numnum(present(first), 'done', 'answered'), numnum(present(first), 'error', 'failed once'), numnum(present(first), 'error', 'failed twice'),
        numnum(present(second), 'error', 'never answered'),
      ]) { await ctx.db.insert('bottings', botting) }
    })
    const { slots } = await rowsOf(tt, quiz_id)
    const cells = Object.values(slots).map((slot) => [slot.newest.message ?? slot.newest.items[0]?.text, slot.done?.items[0]?.text ?? null])
    expect(cells).to.have.deep.members([['failed twice', 'answered'], ['never answered', null]])
  })

  it('keeps cells apart: another bot, or another text, is another cell', async () => {
    const quiz = { ...Quiz.blank(), questions: [Question.blank()] }
    const { tt, quiz_id } = await holding(huntHolding([quiz]))
    const { questions } = await rowsOf(tt, quiz_id)
    const question_id = present(questions[0])._id
    await tt.run(async (ctx) => {
      for (const botting of [
        numnum(question_id, 'done', 'clueing'),
        { ...numnum(question_id, 'done', 'hint'), textkind: 'hint' as const },
        { ...numnum(question_id, 'error', 'guess'), bot_label: 'dumdum' as const },
      ]) { await ctx.db.insert('bottings', botting) }
    })
    const { slots } = await rowsOf(tt, quiz_id)
    expect(Object.keys(slots)).to.have.members([`${question_id}:numnum:clueing`, `${question_id}:numnum:hint`, `${question_id}:dumdum:clueing`])
  })
})

describe('identFor', () => {
  it('is the ident a browser took on last, and null for one that never has', async () => {
    const tt = openTester()
    const { browser_key } = await identified(tt, 'flip_kromer')
    const found = await tt.run(async (ctx) => [await identFor(ctx.db, browser_key), await identFor(ctx.db, mintId())])
    expect(found.map((ident) => ident?.label ?? null)).to.deep.eq(['flip_kromer', null])
  })
})

describe('reviewFor', () => {
  it('finds the ident\'s review of a quiz, and nothing for an ident with none', async () => {
    const { tt, quiz_id } = await holding(Hunt.blank())
    const [alice, bob] = [await identified(tt, 'alice_reviews'), await identified(tt, 'bob_reviews')]
    await tt.run(async (ctx) => { await ctx.db.insert('reviews', { quiz_id, ident_id: alice.ident_id, overall: 'Mine', phase: 'draft' }) })
    const found = await tt.run(async (ctx) => [await reviewFor(ctx.db, quiz_id, alice.ident_id), await reviewFor(ctx.db, quiz_id, bob.ident_id)])
    expect(found.map((review) => review?.overall ?? null)).to.deep.eq(['Mine', null])
  })

  it('takes the earlier when two reviews answer to one ident', async () => {
    const { tt, quiz_id } = await holding(Hunt.blank())
    const { ident_id } = await identified(tt, 'alice_reviews')
    await tt.run(async (ctx) => {
      await ctx.db.insert('reviews', { quiz_id, ident_id, overall: 'First', phase: 'empty' })
      await ctx.db.insert('reviews', { quiz_id, ident_id, overall: 'Second', phase: 'empty' })
    })
    const found = await tt.run(async (ctx) => await reviewFor(ctx.db, quiz_id, ident_id))
    expect(found?.overall).to.eq('First')
  })
})
