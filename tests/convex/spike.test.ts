import { describe, expect, it } from 'vitest'
import { convexTest } from 'convex-test'
import { ConvexError, type Value } from 'convex/values'
import { api } from '../../convex/_generated/api'
import schema from '../../convex/schema'

const modules = import.meta.glob('../../convex/**/*.*s')

type ZodRefusal = ConvexError<{ ZodError: { message: string, input: Value }[] }>

/** What `pending` was refused with; fails the test if it went through */
async function refusalOf(pending: Promise<unknown>): Promise<unknown> {
  try {
    await pending
  } catch (err) {
    return err
  }
  throw new Error('expected a refusal, and the call went through')
}

describe('the phase 0 spike functions, under convex-test', () => {
  it('writes a quiz and a question, and reads the question back by index', async () => {
    const tt = convexTest(schema, modules)
    const quiz_id = await tt.mutation(api.spike.insertQuiz, { title: 'Spike quiz', label: 'spike_quiz' })
    await tt.mutation(api.spike.insertQuestion, { quiz_id, patch: { clueing: 'What is 2+2?', qnum: '3.1' } })
    const questions = await tt.query(api.spike.questionsOf, { quiz_id })
    expect(questions.map((question) => question.clueing)).to.deep.equal(['What is 2+2?'])
  })

  it('refuses a bad qnum as ConvexError data, with our message and the refused input', async () => {
    const tt = convexTest(schema, modules)
    const quiz_id = await tt.mutation(api.spike.insertQuiz, { title: 'Spike quiz', label: 'spike_quiz' })
    const err = await refusalOf(tt.mutation(api.spike.insertQuestion, { quiz_id, patch: { qnum: 'three' } }))
    expect(err).to.be.instanceOf(ConvexError)
    const [issue] = (err as ZodRefusal).data.ZodError
    expect(issue).to.include({ message: 'should match pattern', input: 'three' })
  })

  it('bundles the browser half of inspectify', async () => {
    const tt = convexTest(schema, modules)
    expect(await tt.query(api.spike.inspected, {})).to.eq("Map(1) { 'a' => 1 }")
  })
})
