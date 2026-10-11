import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Id } from '../../convex/_generated/dataModel'
import * as Actor from '../../src/lib/actor'
import * as Approve from '../../src/lib/approve'
import { AuthorizationError } from '../../src/lib/errors'
import { RefusalNotices } from '../../src/lib/notices'
import { CategoryLabelVals } from '../../src/models/category'
import { ActionValidators, QuizRevisionKindVals, type HuntActionDNA, type HuntActionT, type LibraryActionDNA, type LibraryActionT, type OuterHuntActionDNA, type OuterHuntActionT, type UserActionDNA, type UserActionT } from '../../src/models/actions'
import type { ReviewPhase, ReviewPolicyT } from '../../src/models/review'
import { userActor } from '../support/actors'

/** Whatever `attempt` throws, or null when it does not */
function failureOf(attempt: () => unknown): unknown {
  try {
    attempt()
    return null
  } catch (err) {
    return err
  }
}

const hunt_id       = 'k17ah9c4r1hm0z5y1ad0bbn7wn7fn9x1' as Id<'hunts'>
const other_hunt_id = 'k17ah9c4r1hm0z5y1ad0bbn7wn7fn9x2' as Id<'hunts'>
const quiz_id       = 'jd7bb0e6p0dn0x7h7b8eyhcsx17fnf6t' as Id<'quizzes'>
const question_id   = 'jh71ffnfm8vbc2rdm5m90sv8kd7fnhj4' as Id<'questions'>
const alice_id      = 'j97d0qbj35dar1v8edndzckvsx8f828f' as Id<'users'>
const bob_id        = 'j97d0qbj35dar1v8edndzckvsx8f8299' as Id<'users'>

const Alice = userActor(alice_id, 'alice_smiths', { admin: true })

/** Alice, were she anonymous: sealed in her sandbox, an admin here as everyone is on a local backend */
const AnonAlice = userActor(alice_id, 'alice_smiths', { admin: true, anonymous: true })

/** The four standings a request can come with; `unlabelled`, a request whose user holds no userlabel, a stranger to every hunt */
const StandingVals = ['smith', 'reviewer', 'stranger', 'unlabelled'] as const
type Standing = typeof StandingVals[number]

/** The matrix's columns: each standing with an unlocked quiz on screen, a smith with a locked one, and an anonymous smith of its sandbox */
const ColumnVals = [...StandingVals, 'locked_smith', 'sealed_smith'] as const
type Column = typeof ColumnVals[number]

/** The quiz on screen, unlocked and locked */
const Unlocked = { locked: false }
const Locked   = { locked: true }

/** Alice's claims on the hunt in each standing, an unlocked quiz on screen; the unlabelled actor is a stranger to every hunt */
const ClaimsAs: Record<Column, Actor.QuizClaimsT> = {
  smith:        { ...Actor.claimsOn(Alice, hunt_id, { role: 'smith' }), quiz: Unlocked },
  reviewer:     { ...Actor.claimsOn(Alice, hunt_id, { role: 'reviewer' }), quiz: Unlocked },
  stranger:     { ...Actor.claimsOn(Alice, hunt_id, null), quiz: Unlocked },
  unlabelled:   { ...Actor.claimsOn(Actor.unlabelled, hunt_id, null), quiz: Unlocked },
  locked_smith: { ...Actor.claimsOn(Alice, hunt_id, { role: 'smith' }), quiz: Locked },
  sealed_smith: { ...Actor.claimsOn(AnonAlice, hunt_id, { role: 'smith' }), quiz: Unlocked },
}

/** A review of the quiz, by `user_id`, in `phase` */
function reviewBy(user_id: Id<'users'>, phase: ReviewPhase, of_hunt_id = hunt_id): ReviewPolicyT {
  return { hunt_id: of_hunt_id, user_id, phase }
}

describe('Approve.mayReadHunt', () => {
  const Cases: [Standing, Approve.VerdictT, string][] = [
    ['unlabelled', 'notIdentified', 'nobody without a userlabel'],
    ['smith',     'allow',         'a smith of the hunt'],
    ['reviewer',  'allow',         'a reviewer of the hunt'],
    ['stranger',  'notPermitted',  'nobody else'],
  ]
  for (const [standing, expected, describes] of Cases) {
    it(describes, () => {
      expect(Approve.mayReadHunt(ClaimsAs[standing])).to.eq(expected)
    })
  }
})

describe('Approve.mayExportHunt', () => {
  const Cases: [Standing, Approve.VerdictT, string][] = [
    ['unlabelled', 'notIdentified', 'nobody without a userlabel'],
    ['smith',     'allow',         'a smith of the hunt'],
    ['reviewer',  'notPermitted',  'nobody else: not a reviewer of the hunt'],
    ['stranger',  'notPermitted',  'nobody else: not a stranger to it'],
  ]
  for (const [standing, expected, describes] of Cases) {
    it(describes, () => {
      expect(Approve.mayExportHunt(ClaimsAs[standing])).to.eq(expected)
    })
  }
})

describe('Approve.mayChangeHunt', () => {
  const Cases: [Standing, Approve.VerdictT, string][] = [
    ['unlabelled', 'notIdentified', 'nobody without a userlabel'],
    ['smith',     'allow',         'a smith of the hunt'],
    ['reviewer',  'notPermitted',  'nobody else: a reviewer'],
    ['stranger',  'notPermitted',  'nobody else: a stranger'],
  ]
  for (const [standing, expected, describes] of Cases) {
    it(describes, () => {
      expect(Approve.mayChangeHunt(ClaimsAs[standing])).to.eq(expected)
    })
  }
})

describe('Approve.mayReviseQuiz', () => {
  const Cases: [Standing, { locked: boolean } | null, Approve.VerdictT, string][] = [
    // one case per guard, in order:
    ['unlabelled', Unlocked, 'notIdentified', 'nobody without a userlabel'],
    ['reviewer',  Unlocked, 'notPermitted',  'only a smith of the hunt: not a reviewer'],
    ['stranger',  Unlocked, 'notPermitted',  'only a smith of the hunt: not a stranger'],
    ['smith',     null,     'allow',         "a quiz that is gone is the write's to refuse, as it would be for anyone"],
    ['smith',     Locked,   'quizLocked',    'nothing in a locked quiz changes'],
    ['smith',     Unlocked, 'allow',         'a smith, in an unlocked quiz'],
    // the lock is no reason for anyone else:
    ['reviewer',  Locked,   'notPermitted',  'a reviewer is told they may not, not that the quiz is locked'],
    ['unlabelled', Locked,   'notIdentified', 'nobody is told the quiz is locked before saying who they are'],
  ]
  for (const [standing, quiz, expected, describes] of Cases) {
    it(describes, () => {
      expect(Approve.mayReviseQuiz(quiz, ClaimsAs[standing])).to.eq(expected)
    })
  }
})

describe('Approve.mayWriteReview', () => {
  it('anyone who may read the hunt, in every standing', () => {
    const verdicts = StandingVals.map((standing) => Approve.mayWriteReview(ClaimsAs[standing]))
    expect(verdicts).to.deep.eq(StandingVals.map((standing) => Approve.mayReadHunt(ClaimsAs[standing])))
    expect(verdicts).to.deep.eq(['allow', 'allow', 'notPermitted', 'notIdentified'])
  })
})

describe('Approve.mayReadReview', () => {
  const Cases: [ReviewPolicyT, Standing, ReviewPolicyT | null, Approve.VerdictT, string][] = [
    // one case per guard, in order:
    [reviewBy(alice_id, 'draft'),                 'unlabelled', null,                          'notIdentified', 'nobody without a userlabel'],
    [reviewBy(alice_id, 'draft', other_hunt_id),  'smith',     null,                           'notPermitted',  "claims on another hunt say nothing of this one, not even of one's own"],
    [reviewBy(alice_id, 'draft'),                 'reviewer',  reviewBy(alice_id, 'draft'),    'allow',         "one's own review, while one is on its hunt"],
    [reviewBy(bob_id, 'draft'),                   'smith',     null,                           'notPermitted',  'nobody else reads a review that is not shared, not even a smith'],
    [reviewBy(bob_id, 'shared'),                  'smith',     null,                           'allow',         'a smith of the hunt reads every shared review'],
    [reviewBy(bob_id, 'shared'),                  'stranger',  null,                           'notPermitted',  'nobody off the hunt reads one'],
    [reviewBy(bob_id, 'shared'),                  'reviewer',  null,                           'notPermitted',  'a reviewer who has no review of the quiz reads no other'],
    [reviewBy(bob_id, 'shared'),                  'reviewer',  reviewBy(alice_id, 'shared'),   'allow',         'a reviewer reads the shared reviews while their own is shared'],
    [reviewBy(bob_id, 'shared'),                  'reviewer',  reviewBy(alice_id, 'draft'),    'notPermitted',  '...and not while it is not'],
    // one's own, and the hunt:
    [reviewBy(alice_id, 'empty'),                 'smith',     reviewBy(alice_id, 'empty'),    'allow',         "a smith's own review, whatever its phase"],
    [reviewBy(alice_id, 'draft'),                 'stranger',  reviewBy(alice_id, 'draft'),    'notPermitted',  "one's own draft, once taken off the hunt"],
    [reviewBy(alice_id, 'shared'),                'stranger',  reviewBy(alice_id, 'shared'),   'notPermitted',  "one's own shared review, once taken off the hunt"],
  ]
  for (const [review, standing, ownReview, expected, describes] of Cases) {
    it(describes, () => {
      expect(Approve.mayReadReview(review, ClaimsAs[standing], ownReview)).to.eq(expected)
    })
  }
})

describe('Approve.mayChangeMembership', () => {
  const Cases: [Standing, Actor.UserRefT, Approve.VerdictT, string][] = [
    ['unlabelled', { user_id: bob_id },              'notIdentified', 'nobody without a userlabel'],
    ['reviewer',  { user_id: bob_id },              'notPermitted',  'only a smith of the hunt: not a reviewer'],
    ['stranger',  { userlabel: 'bob_reviews' },    'notPermitted',  'only a smith of the hunt: not a stranger'],
    ['smith',     { user_id: alice_id },            'ownHuntship',    'nobody changes their own place on it, named by id'],
    ['smith',     { userlabel: 'alice_smiths' },   'ownHuntship',    'nobody changes their own place on it, named by label'],
    ['smith',     { user_id: bob_id },              'allow',         "a smith, anyone else's, named by id"],
    ['smith',     { userlabel: 'bob_reviews' },    'allow',         "a smith, anyone else's, named by label"],
  ]
  for (const [standing, target, expected, describes] of Cases) {
    it(describes, () => {
      expect(Approve.mayChangeMembership(ClaimsAs[standing], target)).to.eq(expected)
    })
  }
})

describe('Approve.mayReadLibrary', () => {
  it('nobody without a userlabel', () => {
    expect(Approve.mayReadLibrary(Actor.unlabelled)).to.eq('notIdentified')
  })

  it('anyone who has', () => {
    expect(Approve.mayReadLibrary(Alice)).to.eq('allow')
  })
})

/** Nobody is an admin, as `Actor.isAdmin` says on a deployment that names none */
function nobodyIsAdmin(): void {
  vi.spyOn(Actor, 'isAdmin').mockReturnValue(false)
}

describe('Approve.mayChangeLibrary', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('nobody without a userlabel', () => {
    expect(Approve.mayChangeLibrary(Actor.unlabelled)).to.eq('notIdentified')
  })

  it('an admin: one the deployment names (`Actor.isAdmin`)', () => {
    expect(Approve.mayChangeLibrary(Alice)).to.eq('allow')
  })

  it('nobody else: one `Actor.isAdmin` says is no admin', () => {
    nobodyIsAdmin()
    expect(Approve.mayChangeLibrary(Alice)).to.eq('notPermitted')
  })
})

describe('Approve.mayCountUsage', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('whoever may change the library', () => {
    const verdicts = [Approve.mayCountUsage(Actor.unlabelled), Approve.mayCountUsage(Alice)]
    nobodyIsAdmin()
    expect([...verdicts, Approve.mayCountUsage(Alice)]).to.deep.eq(['notIdentified', 'allow', 'notPermitted'])
  })
})

describe('Approve.mayReadBackfills', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('nobody without a userlabel, an admin, and nobody else, where the deployment does not expose its stats', () => {
    const verdicts = [Approve.mayReadBackfills(Actor.unlabelled, undefined), Approve.mayReadBackfills(Alice, undefined)]
    nobodyIsAdmin()
    expect([...verdicts, Approve.mayReadBackfills(Alice, undefined)]).to.deep.eq(['notIdentified', 'allow', 'notPermitted'])
  })

  it('anyone, where EXPOSE_INTERNAL_STATS_TO_ALL says exactly true', () => {
    nobodyIsAdmin()
    expect([Approve.mayReadBackfills(Actor.unlabelled, 'true'), Approve.mayReadBackfills(Alice, 'true')]).to.deep.eq(['allow', 'allow'])
  })

  for (const exposeval of ['false', '', 'TRUE', 'yes', ' true']) {
    it(`no one more than an admin, for the value ${JSON.stringify(exposeval)}: only true exposes`, () => {
      expect(Approve.mayReadBackfills(Actor.unlabelled, exposeval)).to.eq('notIdentified')
    })
  }
})

/** The action of taking the userlabel `userlabel` */
function take(userlabel: string) {
  return { kind: 'assume_userlabel', userlabel, title: '' } as const
}

/** The action of making a hunt labelled `label` */
function make(label: string) {
  return { kind: 'new_hunt', label } as const
}

describe('Approve.mayAssertUserlabel', () => {
  it('anyone whose user holds none yet, anonymous or not', () => {
    expect(Approve.mayAssertUserlabel(Actor.unlabelled, take('alice_smiths'))).to.eq('allow')
  })

  it('a user holding one, taking it again: no change', () => {
    expect([Approve.mayAssertUserlabel(Alice, take('alice_smiths')), Approve.mayAssertUserlabel(AnonAlice, take('alice_smiths'))]).to.deep.eq(['allow', 'allow'])
  })

  it('no user taking a second: a userlabel is chosen once', () => {
    expect([Approve.mayAssertUserlabel(Alice, take('alice_again')), Approve.mayAssertUserlabel(AnonAlice, take('alice_again'))]).to.deep.eq(['userlabelSet', 'userlabelSet'])
  })
})

describe('Approve.mayRetitleUser', () => {
  it('nobody without a userlabel; anyone who has, anonymous or not', () => {
    expect([Approve.mayRetitleUser(Actor.unlabelled), Approve.mayRetitleUser(Alice), Approve.mayRetitleUser(AnonAlice)]).to.deep.eq(['notIdentified', 'allow', 'allow'])
  })
})

describe('Approve.mayMakeHunt', () => {
  const Cases: [Actor.ActorT, string, Approve.VerdictT, string][] = [
    [Actor.unlabelled, 'loud_heron',   'notIdentified', 'nobody without a userlabel: a hunt nobody is on is one nobody can open'],
    [AnonAlice,        'loud_heron',   'sealedHunts',   'nobody anonymous makes a hunt but its sandbox'],
    [AnonAlice,        'alice_smiths', 'allow',         'an anonymous user, its sandbox: labelled with its own userlabel'],
    [Alice,            'loud_heron',   'allow',         'anyone else, any label'],
    [Alice,            'alice_smiths', 'allow',         'anyone else, a hunt labelled as they are too'],
  ]
  for (const [actor, label, expected, describes] of Cases) {
    it(describes, () => {
      expect(Approve.mayMakeHunt(actor, make(label))).to.eq(expected)
    })
  }
})

describe('Approve.mayRelabelHunt', () => {
  it('lets a smith signed in with Google relabel their hunt', () => {
    expect(Approve.mayRelabelHunt(ClaimsAs.smith)).to.eq('allow')
  })

  it('refuses an anonymous smith any relabel of its sandbox, whose label is its handle', () => {
    expect(Approve.mayRelabelHunt(ClaimsAs.sealed_smith)).to.eq('sealedRelabel')
  })

  it('refuses whoever may not change the hunt, as mayChangeHunt does, before asking of sealing', () => {
    expect([Approve.mayRelabelHunt(ClaimsAs.reviewer), Approve.mayRelabelHunt(ClaimsAs.unlabelled)]).to.deep.eq(['notPermitted', 'notIdentified'])
  })
})

describe('Approve.mayJoinHunt', () => {
  it('nobody anonymous; anyone else', () => {
    expect([Approve.mayJoinHunt({ anonymous: true }), Approve.mayJoinHunt({ anonymous: false })]).to.deep.eq(['sealedJoin', 'allow'])
  })
})

describe('Approve.mayAskAnthropicBot', () => {
  const Cases: [string | undefined, Approve.VerdictT, string][] = [
    // regular usage:
    ["allow",         'allow',    'the switch says allow: approved'],
    [undefined,       'botsOff',  'the switch is unset: a deployment that has said nothing says no'],
    // near misses, each a way someone might think they had switched it on:
    ["",              'botsOff',  'the switch is empty: not approved'],
    ["Allow",         'botsOff',  'allow in the wrong case: not approved'],
    [" allow ",       'botsOff',  'allow with whitespace around it: not approved'],
    ["true",          'botsOff',  'a truthy word that is not allow: not approved'],
    ["1",             'botsOff',  'a truthy number: not approved'],
    ["off",           'botsOff',  'an explicit off: not approved'],
  ]
  for (const [switchval, expected, describes] of Cases) {
    it(describes, () => {
      expect(Approve.mayAskAnthropicBot(switchval)).to.eq(expected)
    })
  }
})

// --- The matrix: every action kind, as each standing, through the dispatcher

type ActionT = HuntActionT | OuterHuntActionT | LibraryActionT | UserActionT
type ActionDNA = HuntActionDNA | OuterHuntActionDNA | LibraryActionDNA | UserActionDNA
type ActionKind = ActionT['kind']

/** A user action, or the outer hunt action that names no hunt: of the actor alone, and no hunt action's kind */
type HuntlessDNA = UserActionDNA | Extract<OuterHuntActionDNA, { kind: 'new_hunt' }>

/** The kinds of action that name no hunt, and are no hunt action's kind */
const HuntlessKinds: ReadonlySet<string> = new Set<HuntlessDNA['kind']>(['assume_userlabel', 'retitle_user', 'new_hunt'])

/** An outer hunt action that names a hunt, and is no hunt action's kind */
type HuntNamingDNA = Extract<OuterHuntActionDNA, { kind: 'arrange_categories' | 'rebranch_hunt' }>

/** The kinds of outer hunt action that name a hunt, and are no hunt action's kind */
const HuntNamingKinds: ReadonlySet<string> = new Set<HuntNamingDNA['kind']>(['arrange_categories', 'rebranch_hunt'])

/** The kinds of action on the library */
const LibraryKinds: ReadonlySet<string> = new Set<LibraryActionDNA['kind']>(['add_widget', 'edit_widget', 'delete_widget', 'move_widget', 'import_widgets'])

/** Whether `dna` is an action that names no hunt, and is no hunt action's kind */
function isHuntless(dna: ActionDNA): dna is HuntlessDNA {
  return HuntlessKinds.has(dna.kind)
}

/** Whether `dna` is an outer hunt action that names a hunt, and is no hunt action's kind */
function isHuntNaming(dna: ActionDNA): dna is HuntNamingDNA {
  return HuntNamingKinds.has(dna.kind)
}

/** Whether `dna` is an action on the library */
function isOnLibrary(dna: ActionDNA): dna is LibraryActionDNA {
  return LibraryKinds.has(dna.kind)
}

/** `dna` validated, as the server holds an action */
function actionOf(dna: HuntActionDNA | LibraryActionDNA | HuntlessDNA | HuntNamingDNA): ActionT {
  if (isHuntless(dna)) { return dna.kind === 'new_hunt' ? ActionValidators.outerHuntAction(dna) : ActionValidators.userAction(dna) }
  if (isHuntNaming(dna)) { return ActionValidators.outerHuntAction(dna) }
  if (isOnLibrary(dna)) { return ActionValidators.libraryAction(dna) }
  return ActionValidators.huntAction(dna)
}

/** A verdict for each column, in `ColumnVals` order */
type VerdictRowT = readonly [Approve.VerdictT, Approve.VerdictT, Approve.VerdictT, Approve.VerdictT, Approve.VerdictT, Approve.VerdictT]

//                              smith    reviewer        stranger        unlabelled       smith, quiz locked  anonymous smith
const Revisers:    VerdictRowT = ['allow', 'notPermitted', 'notPermitted', 'notIdentified', 'quizLocked',      'allow']
const Smiths:      VerdictRowT = ['allow', 'notPermitted', 'notPermitted', 'notIdentified', 'allow',           'allow']
const Relabels:    VerdictRowT = ['allow', 'notPermitted', 'notPermitted', 'notIdentified', 'allow',           'sealedRelabel']
const Memberships: VerdictRowT = ['allow', 'notPermitted', 'notPermitted', 'notIdentified', 'allow',           'sealedMembers']
const Members:     VerdictRowT = ['allow', 'allow',        'notPermitted', 'notIdentified', 'allow',           'sealedReview']
const Labelled:    VerdictRowT = ['allow', 'allow',        'allow',        'notIdentified', 'allow',           'allow']
const NewHunts:    VerdictRowT = ['allow', 'allow',        'allow',        'notIdentified', 'allow',           'sealedHunts']
const Anyone:      VerdictRowT = ['allow', 'allow',        'allow',        'allow',         'allow',           'allow']

/** One action of every kind, and what each standing is told of it; a kind missing here fails to compile */
const Matrix = {
  // layout:
  add_widgeting:       [{ kind: 'add_widgeting', widgeting: { widget_label: 'dumdum', label: 'dumdum' } },                                Revisers],
  edit_widgeting:      [{ kind: 'edit_widgeting', label: 'dumdum', patch: { description: 'The quick one' } },                        Revisers],
  delete_widgeting:    [{ kind: 'delete_widgeting', label: 'dumdum' },                                                               Revisers],
  move_widgeting:      [{ kind: 'move_widgeting', label: 'dumdum', onto_idx: 2 },                                                    Revisers],
  add_column:          [{ kind: 'add_column', column: { label: 'qnum', title: 'Q#', source: 'qnum', width_px: 60 } },        Revisers],
  edit_column:         [{ kind: 'edit_column', label: 'qnum', patch: { width_px: 80 } },                                             Revisers],
  delete_column:       [{ kind: 'delete_column', label: 'qnum' },                                                                    Revisers],
  move_column:         [{ kind: 'move_column', label: 'qnum', onto_idx: 1 },                                                         Revisers],
  set_templateable:       [{ kind: 'set_templateable', templateable: ['recap'] },                                                    Revisers],
  // library, an admin's, of the actor alone (Alice, an admin here):
  add_widget:          [{ kind: 'add_widget', widget: { label: 'shout', formulary: 'jsonata', formula: '$uppercase(question.title)' } },  Labelled],
  edit_widget:         [{ kind: 'edit_widget', label: 'shout', patch: { formula: '$lowercase(question.title)' } },                         Labelled],
  delete_widget:       [{ kind: 'delete_widget', label: 'shout' },                                                                   Labelled],
  move_widget:         [{ kind: 'move_widget', label: 'shout', onto_idx: 2 },                                                        Labelled],
  import_widgets:      [{ kind: 'import_widgets', widgets: [] },                                                                     Labelled],
  // content:
  retitle_quiz:        [{ kind: 'retitle_quiz', title: 'Princes' },                                                                  Revisers],
  relabel_quiz:        [{ kind: 'relabel_quiz', label: 'princes' },                                                                  Revisers],
  set_smiths_note:     [{ kind: 'set_smiths_note', smiths_note: 'Theme: princes.' },                                                 Revisers],
  set_q1_preamble:     [{ kind: 'set_q1_preamble', q1_preamble: 'Read the note![br]' },                                              Revisers],
  set_recap_head:      [{ kind: 'set_recap_head', recap_head: 'Thanks, playtesters!' },                                              Revisers],
  set_recap_tail:      [{ kind: 'set_recap_tail', recap_tail: 'See you next season.' },                                              Revisers],
  set_recap_template:  [{ kind: 'set_recap_template', recap_template: null },                                                        Revisers],
  edit_question:       [{ kind: 'edit_question', question_id, patch: { clueing: 'Who?' } },                                          Revisers],
  add_question:        [{ kind: 'add_question' },                                                                                    Revisers],
  delete_questions:    [{ kind: 'delete_questions', question_ids: [question_id] },                                                   Revisers],
  set_viz:             [{ kind: 'set_viz', question_ids: [question_id], viz: 'archived' },                                           Revisers],
  sort_questions:      [{ kind: 'sort_questions', sortkey: 'column:qnum', descending: false, question_ids: [] },                                     Revisers],
  renumber_qnums:      [{ kind: 'renumber_qnums' },                                                                                  Revisers],
  move_question:       [{ kind: 'move_question', question_id, onto_idx: 0 },                                                         Revisers],
  set_chain:           [{ kind: 'set_chain', question_id, chains_to: null },                                                         Revisers],
  sort_by_chain_order: [{ kind: 'sort_by_chain_order', descending: true },                                                           Revisers],
  record_widgeted:     [{ kind: 'record_widgeted', widgeted: { question_id, widgeting_label: 'dumdum', status: 'ok', value: 'Leon', result_meta: { model_tier_applied: 'quick' } } }, Revisers],
  enter_widgeted:      [{ kind: 'enter_widgeted', entered: { question_id, widgeting_label: 'notes', value: 'Leon' } },               Revisers],
  enter_quiz_widgeted: [{ kind: 'enter_quiz_widgeted', entered: { widgeting_label: 'playtesters', value: 'Ada' } },                Revisers],
  import_questions:    [{ kind: 'import_questions', questions: [{ label: 'leon', patch: {} }] },                                     Revisers],
  // the realm's quizzes:
  new_quiz:            [{ kind: 'new_quiz' },                                                                                        Smiths],
  delete_quiz:         [{ kind: 'delete_quiz', quiz_id },                                                                            Smiths],
  set_lock:            [{ kind: 'set_lock', quiz_id, locked: true },                                                                 Smiths],
  // one's own review:
  open_review:         [{ kind: 'open_review', quiz_id },                                                                            Members],
  set_overall:         [{ kind: 'set_overall', quiz_id, overall: 'Went well.' },                                                     Members],
  set_review_phase:    [{ kind: 'set_review_phase', quiz_id, phase: 'shared' },                                                      Members],
  set_reviewing:       [{ kind: 'set_reviewing', quiz_id, question_id, patch: { get_rate: 40 } },                                    Members],
  peek_answer:         [{ kind: 'peek_answer', quiz_id, question_id },                                                               Members],
  // the hunt, and who is on it (someone else; one's own place is below):
  add_huntship:        [{ kind: 'add_huntship', userlabel: 'bob_reviews', role: 'reviewer' },                                        Memberships],
  remove_huntship:     [{ kind: 'remove_huntship', user_id: bob_id },                                                                Memberships],
  retitle_hunt:        [{ kind: 'retitle_hunt', title: 'Princes' },                                                                  Smiths],
  relabel_hunt:        [{ kind: 'relabel_hunt', label: 'princes' },                                                                  Relabels],
  delete_hunt:         [{ kind: 'delete_hunt' },                                                                                     Smiths],
  arrange_categories:  [{ kind: 'arrange_categories', hunt_id, wheel: [null, ...CategoryLabelVals.slice(1)] },                          Smiths],
  rebranch_hunt:       [{ kind: 'rebranch_hunt', hunt_id, branch: 'playtest' },                                                      Smiths],
  // making a hunt, and the user actions, of the actor alone:
  new_hunt:            [{ kind: 'new_hunt', label: 'loud_heron' },                                                                   NewHunts],
  assume_userlabel:    [{ kind: 'assume_userlabel', userlabel: 'alice_smiths', title: 'Alice' },                                     Anyone],
  retitle_user:        [{ kind: 'retitle_user', title: 'Alice' },                                                                    Labelled],
} as const satisfies { [KK in ActionKind]: readonly [Extract<HuntActionDNA | LibraryActionDNA | HuntlessDNA | HuntNamingDNA, { kind: KK }>, VerdictRowT] }

describe('the matrix: every action kind, as each standing, and as a smith of a locked quiz', () => {
  for (const [kind, [dna, expected]] of Object.entries(Matrix)) {
    it(`${kind}: ${expected.join(', ')}`, () => {
      const action = actionOf(dna)
      const verdicts = ColumnVals.map((column) => Approve.verdictOn(action.kind, ClaimsAs[column], action))
      expect(verdicts).to.deep.eq(expected)
    })
  }

  it('covers every action the dispatch table knows, and the table every action here', () => {
    const tabled = Approve.PolicyKeys.filter((key) => ! ReadKeys.has(key))
    expect(tabled.toSorted((aa, bb) => aa.localeCompare(bb))).to.deep.eq(Object.keys(Matrix).toSorted((aa, bb) => aa.localeCompare(bb)))
  })

  it('asks every action that revises the quiz on screen of its lock, and no other', () => {
    const revising = Object.entries(Matrix).filter(([, [, expected]]) => expected === Revisers).map(([kind]) => kind)
    expect(revising.toSorted((aa, bb) => aa.localeCompare(bb))).to.deep.eq(QuizRevisionKindVals.toSorted((aa, bb) => aa.localeCompare(bb)))
  })

  describe('once nobody is an admin', () => {
    afterEach(() => { vi.restoreAllMocks() })

    //                           smith           reviewer        stranger        unlabelled       smith, quiz locked  anonymous smith
    const Nobody: VerdictRowT = ['notPermitted', 'notPermitted', 'notPermitted', 'notIdentified', 'notPermitted',    'notPermitted']

    it('refuses every library action, and changing or counting the library by name, to every user, smith or not', () => {
      nobodyIsAdmin()
      const kinds = Object.keys(Matrix).filter((kind) => LibraryKinds.has(kind))
      const verdicts = kinds.map((kind) => {
        const action = actionOf(Matrix[kind as keyof typeof Matrix][0])
        return ColumnVals.map((column) => Approve.verdictOn(action.kind, ClaimsAs[column], action))
      })
      const named = (['change_library', 'count_usage'] as const).map((key) => ColumnVals.map((column) => Approve.verdictOn(key, ClaimsAs[column])))
      expect([...verdicts, ...named]).to.deep.eq([...kinds, 'change_library', 'count_usage'].map(() => Nobody))
    })

    it('leaves every other action as it was', () => {
      const others = Object.entries(Matrix).filter(([kind]) => ! LibraryKinds.has(kind))
      nobodyIsAdmin()
      for (const [, [dna, expected]] of others) {
        const action = actionOf(dna)
        expect(ColumnVals.map((column) => Approve.verdictOn(action.kind, ClaimsAs[column], action))).to.deep.eq(expected)
      }
    })
  })

  it('asks a hunt-naming outer hunt action as the hunt action of its kind', () => {
    const retitle = { kind: 'retitle_hunt', hunt_id, title: 'Princes' } as const
    expect(ColumnVals.map((column) => Approve.verdictOn('retitle_hunt', ClaimsAs[column], retitle))).to.deep.eq(Smiths)
  })

  it("refuses a change to one's own place on the hunt, for a smith, by its own refusal", () => {
    expect([
      Approve.verdictOn('add_huntship', ClaimsAs.smith, { kind: 'add_huntship', userlabel: 'alice_smiths', role: 'reviewer' }),
      Approve.verdictOn('add_huntship', ClaimsAs.smith, { kind: 'add_huntship', userlabel: 'alice_smiths', role: 'smith' }),
      Approve.verdictOn('remove_huntship', ClaimsAs.smith, { kind: 'remove_huntship', user_id: alice_id }),
    ]).to.deep.eq(['ownHuntship', 'ownHuntship', 'ownHuntship'])
  })
})

/** The keys of the policies that are not an action's */
const ReadKeys: ReadonlySet<Approve.PolicyKey> = new Set(['read_hunt', 'export_hunt', 'read_review', 'read_library', 'count_usage', 'read_backfills', 'join_hunt', 'ask_anthropic_bot', 'change_library'] as const)

describe('Approve.verdictOn', () => {
  it('asks the reads by name', () => {
    expect([
      Approve.verdictOn('read_hunt', ClaimsAs.reviewer),
      Approve.verdictOn('export_hunt', ClaimsAs.reviewer),
      Approve.verdictOn('read_review', reviewBy(bob_id, 'shared'), ClaimsAs.smith, null),
      Approve.verdictOn('read_library', Actor.unlabelled),
      Approve.verdictOn('count_usage', Alice),
      Approve.verdictOn('read_backfills', Alice, undefined),
      Approve.verdictOn('ask_anthropic_bot', 'allow'),
    ]).to.deep.eq(['allow', 'notPermitted', 'allow', 'notIdentified', 'allow', 'allow', 'allow'])
  })

  it('asks of changing the library by name, as it asks of each library action', () => {
    const verdicts = ColumnVals.map((column) => Approve.verdictOn('change_library', ClaimsAs[column]))
    expect(verdicts).to.deep.eq(Matrix.add_widget[1])
  })

  const Unknown: [string, string][] = [
    ['openai_bot',    'a key no policy answers to'],
    ['Read_Hunt',     'the right key in the wrong case'],
    ['constructor',   'a name that only exists on every object'],
    ['',              'no key at all'],
  ]
  for (const [key, describes] of Unknown) {
    it(`throws for ${describes}, rather than quietly saying yes or no`, () => {
      expect(() => Approve.verdictOn(key as 'read_hunt', ClaimsAs.smith)).to.throw('No policy answers to')
    })
  }

  it("throws for an action handed to another kind's policy", () => {
    const retitle = { kind: 'retitle_quiz', title: 'Kings' } as const
    expect(() => Approve.verdictOn('add_huntship', ClaimsAs.smith, retitle)).to.throw('A retitle_quiz action was handed to the policy for add_huntship')
  })
})

describe('Approve.may', () => {
  it('is true when the policy allows', () => {
    expect(Approve.may('retitle_quiz', ClaimsAs.smith, { kind: 'retitle_quiz', title: 'Kings' })).to.be.true
  })

  it('is false for any denial', () => {
    expect([Approve.may('read_hunt', ClaimsAs.stranger), Approve.may('read_hunt', ClaimsAs.unlabelled)]).to.deep.eq([false, false])
  })
})

/** Whether a view may ask of `kind` by its kind alone */
function isOfferable(kind: string): boolean {
  try {
    Approve.mayOffer(kind as Approve.OfferableKind, ClaimsAs.smith)
    return true
  } catch {
    return false
  }
}

describe('Approve.mayOffer', () => {
  const offerable = Object.keys(Matrix).filter((kind) => isOfferable(kind))

  for (const kind of offerable) {
    const [dna] = Matrix[kind as keyof typeof Matrix]
    it(`offers ${kind} in every column exactly where an action of it would be allowed`, () => {
      const action = actionOf(dna)
      const offered = ColumnVals.map((column) => Approve.mayOffer(kind as Approve.OfferableKind, ClaimsAs[column]))
      const allowed = ColumnVals.map((column) => Approve.may(action.kind, ClaimsAs[column], action))
      expect(offered).to.deep.eq(allowed)
    })
  }

  it('is asked by kind alone of every action but those whose policy reads the action: who it names, or the label it takes', () => {
    const asked = Object.keys(Matrix).filter((kind) => ! isOfferable(kind))
    expect(asked).to.deep.eq(['add_huntship', 'remove_huntship', 'new_hunt', 'assume_userlabel'])
  })

  it('throws for a kind whose policy reads the action, rather than deciding without it', () => {
    expect(() => Approve.mayOffer('remove_huntship' as string as Approve.OfferableKind, ClaimsAs.smith)).to.throw('The policy for remove_huntship reads the action')
  })

  it('throws for a key no action answers to, even one a read answers to', () => {
    expect(() => Approve.mayOffer('read_hunt' as string as Approve.OfferableKind, ClaimsAs.smith)).to.throw('No action answers to read_hunt')
  })

  it('withholds revising a locked quiz from its smith, and offers a reviewer their review', () => {
    expect([Approve.mayOffer('edit_question', ClaimsAs.locked_smith), Approve.mayOffer('open_review', ClaimsAs.reviewer)]).to.deep.eq([false, true])
  })
})

describe('Approve.must', () => {
  it('says allow when the policy allows', () => {
    expect(Approve.must('ask_anthropic_bot', 'allow')).to.eq('allow')
  })

  it("declines with the denial's polite sentence when it does not", () => {
    const failure = failureOf(() => { Approve.must('ask_anthropic_bot', undefined) })
    expect(failure).to.be.instanceOf(Approve.NotApprovedError)
    expect(failure).to.be.instanceOf(AuthorizationError)
    expect((failure as Approve.NotApprovedError).message).to.eq(RefusalNotices.botsOff)
    expect((failure as Approve.NotApprovedError).denial).to.eq('botsOff')
    expect((failure as Approve.NotApprovedError).story).to.deep.eq({ policy: 'ask_anthropic_bot', denial: 'botsOff' })
  })

  it('says which refusal a hunt policy denied with', () => {
    const failure = failureOf(() => { Approve.must('remove_huntship', ClaimsAs.smith, { kind: 'remove_huntship', user_id: alice_id }) }) as Approve.NotApprovedError
    expect([failure.denial, failure.message]).to.deep.eq(['ownHuntship', RefusalNotices.ownHuntship])
  })

  it('keeps the evidence in the backstory, out of anything serialised', () => {
    const failure = failureOf(() => { Approve.must('read_hunt', ClaimsAs.stranger) }) as Approve.NotApprovedError
    expect(failure.backstory).to.deep.eq({ evidence: [ClaimsAs.stranger] })
    expect(JSON.stringify(failure)).not.to.contain(alice_id)
  })
})

describe('Approve.every', () => {
  it('is true when every verdict is, awaiting those that are promised', async () => {
    expect(await Approve.every([true, Promise.resolve(true)])).to.be.true
  })

  it('is false when any verdict is not', async () => {
    expect(await Approve.every([true, Promise.resolve(false)])).to.be.false
  })

  it('refuses an empty list, which would otherwise approve everything', async () => {
    await expect(Approve.every([])).rejects.toThrow()
  })
})
