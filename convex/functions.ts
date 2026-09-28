import { zCustomMutation, zCustomQuery } from 'convex-helpers/server/zod4'
import { internalMutation, mutation, query } from './_generated/server'
import { installErrorMap } from '../src/lib/vv/reporting'

/** Our Zod error map, put in place before a function's arguments are parsed, so a refusal reads in our words */
const InOurWords = {
  args:  {},
  input: () => {
    installErrorMap()
    return { ctx: {}, args: {} }
  },
}

/**
 * The builders every public function here is made with: Convex's own, taking Zod schemas as
 * `args` (and `returns`), parsed in full before the handler runs. A refused argument reaches the
 * caller as a `ConvexError` whose data is `{ ZodError: [issue, ...] }`, in our words.
 *
 * @example export const open = zQuery({ args: { quiz_id: zid('quizzes') }, handler: async (ctx, { quiz_id }) => ... })
 */
export const zQuery            = zCustomQuery(query, InOurWords)
export const zMutation         = zCustomMutation(mutation, InOurWords)
export const zInternalMutation = zCustomMutation(internalMutation, InOurWords)
