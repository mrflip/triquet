import * as PA from '../src/lib/vv/patterns'
import { ValidatorKit } from '../src/lib/validator'
import { zInternalQuery } from './functions'

const { arr, obj, str } = ValidatorKit

// The labels held across the app that the reserved list governs: every user's userlabel, every
// ghosting's, and every hunt's org and label, unjudged. Internal and read-only, run by
// `scripts/check_reserved` with the deployment's key, which judges them against the list of the
// checkout it runs from: so a branch growing the list learns who holds its new words before the
// list is deployed, when it would refuse them (`notes/deploy.md`, *Checking the reserved list
// against production*).

/** A hunt's two labels, as its address reads them */
const HuntLabels = obj({
  orglabel: str.describe('The org the hunt is addressed under, as `/~<orglabel>/<label>`.'),
  label:    str.describe('The hunt\'s own label, within its org.'),
})

/**
 * Every userlabel a user holds, alphabetically, and every one a ghosting holds and every hunt's
 * org and label, each in the order its row was made. Users and ghostings are walked rather than
 * taken to a cap, as nothing caps how many there are: users through `by_userlabel`, past every one
 * holding none, as each new browser is a user holding none. The app holds at most
 * `PA.HuntsInApp` hunts.
 *
 * @returns The labels, by where they are held.
 *
 * @example npx convex run check_reserved:held
 *   // => { users: ['flip_kromer', 'google_fan'], ghostings: [], hunts: [{ orglabel: 'google_fan', label: 'quiet_otter' }] }
 */
export const held = zInternalQuery({
  args:    {},
  returns: obj({ users: arr(str), ghostings: arr(str), hunts: arr(HuntLabels) }),
  handler: async (ctx) => {
    const users: string[] = []
    const holders = ctx.db.query('users').withIndex('by_userlabel', (cvx) => cvx.gt('userlabel', ''))
    for await (const user of holders) {
      if (user.userlabel !== undefined) { users.push(user.userlabel) }
    }
    const ghostings: string[] = []
    for await (const ghosting of ctx.db.query('ghostings')) { ghostings.push(ghosting.userlabel) }
    const hunts = await ctx.db.query('hunts').take(PA.HuntsInApp.max)
    return { users, ghostings, hunts: hunts.map(({ orglabel, label }) => ({ orglabel, label })) }
  },
})
