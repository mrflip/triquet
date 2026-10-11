import * as Labelmaker from '../src/lib/labelmaker'
import * as PA from '../src/lib/vv/patterns'
import { ValidatorKit } from '../src/lib/validator'
import { zInternalQuery } from './functions'

const { arr, obj, oneof, str, uint } = ValidatorKit

// What the reserved list would refuse among the labels already held. The list governs only a
// label being made or claimed (`PA.ReservedToplevelGroups`), so a hunt or an org named before one
// of its words was kept stands at its address; this names them, for the Coach to see what a
// change to the list leaves standing. Internal and read-only, run by `scripts/check_reserved`
// with the deployment's key (`notes/deploy.md`, *Checking the reserved list against production*).

/** Which of a hunt's labels the reserved list now keeps for new ones */
const HeldLabelVals = ['orglabel', 'label'] as const

/** A hunt one of whose labels the reserved list would refuse, were it made now */
const Refused = obj({
  orglabel: str.describe('The org the hunt is addressed under, as `/~<orglabel>/<label>`.'),
  label:    str.describe('The hunt\'s own label, within its org.'),
  refused:  arr(oneof(HeldLabelVals)).min(1).describe('Which of the two the list would refuse: the org, the label, or both.'),
})

/**
 * Every hunt whose label or org the reserved list would refuse, were it made now
 * (`Labelmaker.isReserved`, top-level words and all), in the order the hunts were made, and how
 * many hunts were read: every one, as the app holds at most `PA.HuntsInApp`. Each such hunt
 * stands, writable, at its address; only a new label is held to the list.
 *
 * @returns How many hunts were read, and those the list would refuse.
 *
 * @example npx convex run check_reserved:refused
 *   // => { counted: 212, refused: [{ orglabel: 'google_fan', label: 'quiet_otter', refused: ['orglabel'] }] }
 */
export const refused = zInternalQuery({
  args:    {},
  returns: obj({ counted: uint, refused: arr(Refused) }),
  handler: async (ctx) => {
    const hunts = await ctx.db.query('hunts').take(PA.HuntsInApp.max)
    const found = hunts.map((hunt) => ({
      orglabel: hunt.orglabel,
      label:    hunt.label,
      refused:  HeldLabelVals.filter((field) => Labelmaker.isReserved(hunt[field], { toplevel: true })),
    }))
    return { counted: hunts.length, refused: found.filter((hunt) => hunt.refused.length > 0) }
  },
})
