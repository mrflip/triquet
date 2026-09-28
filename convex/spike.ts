import { zCustomMutation, zCustomQuery, zid } from 'convex-helpers/server/zod4'
import { mutation, query } from './_generated/server'
import { QuestionValidators } from '../src/models/question'
import { QuizValidators } from '../src/models/quiz'
import { installErrorMap } from '../src/lib/vv/reporting'
import { inspectify } from '../src/lib/inspectify'

/** Our Zod error map, put in place before a function's arguments are parsed, so a refusal reads in our words */
const InOurWords = {
  args:  {},
  input: () => {
    installErrorMap()
    return { ctx: {}, args: {} }
  },
}

const zMutation = zCustomMutation(mutation, InOurWords)
const zQuery    = zCustomQuery(query, InOurWords)

/** A quiz row with this title and label, validated whole before it is written; its id */
export const insertQuiz = zMutation({
  args:    { title: QuizValidators.row.shape.title, label: QuizValidators.row.shape.label },
  handler: async (ctx, args) => ctx.db.insert('spike_quizzes', QuizValidators.row({
    realm_id: crypto.randomUUID(), forced_label: null, version: 'main', locked: false,
    last_sortkey: 'column:clueing', bulk_ishes_last: null, ...args,
  })),
})

/** A question row in `quiz_id`, blank but for `patch`, validated whole before it is written; its id */
export const insertQuestion = zMutation({
  args:    { quiz_id: zid('spike_quizzes'), patch: QuestionValidators.questionPatch },
  handler: async (ctx, { quiz_id, patch }) => {
    const row = QuestionValidators.row({
      quiz_id: crypto.randomUUID(), position: 0, label: 'spike', forced_label: null, title: '', qnum: '',
      clueing: '', hint: '', chains_to: null, full_answer: '', alt_text: '', notes: '', ...patch,
    })
    return ctx.db.insert('spike_questions', { ...row, quiz_id })
  },
})

/** The questions of `quiz_id`, read by index */
export const questionsOf = zQuery({
  args:    { quiz_id: zid('spike_quizzes') },
  handler: async (ctx, { quiz_id }) => ctx.db.query('spike_questions').withIndex('by_quiz_id', (qq) => qq.eq('quiz_id', quiz_id)).take(500),
})

/** A Map as `inspectify` renders it here, which says which of its two halves Convex bundled */
export const inspected = zQuery({
  args:    {},
  handler: () => inspectify(new Map([['a', 1]])),
})
