import { describe, expect, it } from 'vitest'
import { api } from '../../convex/_generated/api'
import { mayChangeHunt } from '../../convex/authorize'
import { identForLabel } from '../../convex/reading'
import { Hunt } from '../../src/models/hunt'
import { mintId } from '../../src/lib/ids'
import { present } from '../support/present'
import { identified, openOf, openTester, seedHunt } from '../support/convex'

const modules = import.meta.glob('../../convex/**/*.ts')

/** Whether `val` is a function any caller on the internet may run */
function isPublicFunction(val: unknown): boolean {
  return typeof val === 'function' && 'isPublic' in val && val.isPublic === true
}

/** Every public function the deployment offers, as `module:name`, in order */
async function publicFunctions(): Promise<string[]> {
  const sources = Object.entries(modules).filter(([path]) => ! path.includes('/_generated/'))
  const found = await Promise.all(sources.map(async ([path, load]) => {
    const exported = await load() as Record<string, unknown>
    const modulename = path.replace('../../convex/', '').replace(/\.ts$/, '')
    return Object.entries(exported).filter(([, val]) => isPublicFunction(val)).map(([fnname]) => `${modulename}:${fnname}`)
  }))
  return found.flat().toSorted((aa, bb) => aa.localeCompare(bb))
}

describe('mayChangeHunt', () => {
  it('lets every browser change every hunt, for the trial', async () => {
    const { open } = await seedHunt(openTester(), Hunt.blank())
    expect([mayChangeHunt(mintId(), open.hunt_id), mayChangeHunt(mintId(), open.hunt_id)]).to.deep.eq([true, true])
  })
})

describe('the hunt tables, open to every browser for the trial', () => {
  it('let another browser read every row of a hunt, and change and delete its rows', async () => {
    const tt = openTester()
    const { act, read } = await seedHunt(tt, Hunt.blank('quiet_otter'))
    const [first, second] = openOf(await read()).questions
    const [author, stranger] = [mintId(), mintId()]
    await act({ kind: 'retitle_quiz', title: 'Princes' }, author)
    await act({ kind: 'retitle_quiz', title: 'Kings' }, stranger)
    await act({ kind: 'delete_questions', question_ids: [present(first)._id] }, stranger)
    const quiz = openOf(await read())
    expect([quiz.title, quiz.questions.map((question) => question._id)]).to.deep.eq(['Kings', [present(second)._id, ...quiz.questions.slice(1).map((question) => question._id)]])
    expect(await tt.query(api.hunts.open, { hunt_label: 'quiet_otter' })).to.not.eq(null)
  })
})

describe('identings, each browser\'s own', () => {
  it('are read only through the browser\'s own key: another browser learns nothing of them', async () => {
    const tt = openTester()
    await identified(tt, 'alice_reviews')
    expect(await tt.query(api.idents.current, { browser_key: mintId() })).to.eq(null)
  })

  it('are listed by no function, nor are idents changed or removed by one', async () => {
    expect(await publicFunctions()).to.deep.eq([
      'hunts:list', 'hunts:open', 'hunts:perform', 'hunts:whole',
      'idents:current', 'idents:performAccount',
      'quizzes:open',
      'reviews:forQuiz',
    ])
  })
})

describe('idents', () => {
  it('are made by anyone, and are never changed by taking one on again', async () => {
    const tt = openTester()
    await tt.mutation(api.idents.performAccount, { action: { kind: 'assume_ident', label: 'flip_kromer', title: 'Flip' }, browser_key: mintId() })
    await tt.mutation(api.idents.performAccount, { action: { kind: 'assume_ident', label: 'flip_kromer', title: 'Impostor' }, browser_key: mintId() })
    const ident = await tt.run(async (ctx) => await identForLabel(ctx.db, 'flip_kromer'))
    expect(ident?.title).to.eq('Flip')
  })
})
