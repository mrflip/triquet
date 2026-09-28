import { defineSchema, defineTable } from 'convex/server'
import { zid, zodOutputToConvexFields } from 'convex-helpers/server/zod4'
import { QuestionValidators } from '../src/models/question'
import { QuizValidators } from '../src/models/quiz'

const spikeQuizFields     = zodOutputToConvexFields(QuizValidators.row.shape)
const spikeQuestionFields = zodOutputToConvexFields({ ...QuestionValidators.row.shape, quiz_id: zid('spike_quizzes') })

/** Two tables derived from the quiz and question row validators: the phase 0 spike, replaced whole in phase 1 */
export default defineSchema({
  spike_quizzes:   defineTable(spikeQuizFields),
  spike_questions: defineTable(spikeQuestionFields).index('by_quiz_id', ['quiz_id']),
})
