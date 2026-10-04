import { describe, expect, it } from 'vitest'
import type { Id } from '../../convex/_generated/dataModel'
import * as Actor from '../../src/lib/actor'
import * as Approve from '../../src/lib/approve'
import { AuthorizationError } from '../../src/lib/errors'
import { RefusalNotices } from '../../src/lib/notices'
import { ActionValidators, QuizRevisionKindVals, type AccountActionDNA, type AccountActionT, type HuntActionDNA, type HuntActionT } from '../../src/models/actions'
import type { ReviewPhase, ReviewRowT } from '../../src/models/review'

/** Whatever `attempt` throws, or null when it does not */
function failureOf(attempt: () => unknown): unknown {
  try {
    attempt()
    return null
  } catch (err) {
    return err
  }
}

const user_id       = 'm57a2835q9kp1gefja107b9bfh8fnpvr' as Id<'users'>
const hunt_id       = 'k17ah9c4r1hm0z5y1ad0bbn7wn7fn9x1' as Id<'hunts'>
const other_hunt_id = 'k17ah9c4r1hm0z5y1ad0bbn7wn7fn9x2' as Id<'hunts'>
const quiz_id       = 'jd7bb0e6p0dn0x7h7b8eyhcsx17fnf6t' as Id<'quizzes'>
const question_id   = 'jh71ffnfm8vbc2rdm5m90sv8kd7fnhj4' as Id<'questions'>
const alice_id      = 'j97d0qbj35dar1v8edndzckvsx8f828f' as Id<'idents'>
const bob_id        = 'j97d0qbj35dar1v8edndzckvsx8f8299' as Id<'idents'>

const Alice = Actor.asIdent(user_id, { _id: alice_id, label: 'alice_smiths' })

/** The four standings a request can come with */
const StandingVals = ['smith', 'reviewer', 'stranger', 'anonymous'] as const
type Standing = typeof StandingVals[number]

/** The matrix's columns: each standing with an unlocked quiz on screen, and a smith with a locked one */
const ColumnVals = [...StandingVals, 'locked_smith'] as const
type Column = typeof ColumnVals[number]

/** The quiz on screen, unlocked and locked */
const Unlocked = { locked: false }
const Locked   = { locked: true }

/** Alice's claims on the hunt in each standing, an unlocked quiz on screen; the anonymous actor is a stranger to every hunt */
const ClaimsAs: Record<Column, Actor.QuizClaimsT> = {
  smith:        { ...Actor.claimsOn(Alice, hunt_id, { role: 'smith' }), quiz: Unlocked },
  reviewer:     { ...Actor.claimsOn(Alice, hunt_id, { role: 'reviewer' }), quiz: Unlocked },
  stranger:     { ...Actor.claimsOn(Alice, hunt_id, null), quiz: Unlocked },
  anonymous:    { ...Actor.claimsOn(Actor.anonymous, hunt_id, null), quiz: Unlocked },
  locked_smith: { ...Actor.claimsOn(Alice, hunt_id, { role: 'smith' }), quiz: Locked },
}

/** A review of the quiz, by `ident_id`, in `phase` */
function reviewBy(ident_id: Id<'idents'>, phase: ReviewPhase, of_hunt_id = hunt_id): ReviewRowT {
  return { hunt_id: of_hunt_id, quiz_id, ident_id, overall: '', phase }
}

describe('Approve.mayReadHunt', () => {
  const Cases: [Standing, Approve.VerdictT, string][] = [
    ['anonymous', 'notIdentified', 'nobody who has asserted no username'],
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
    ['anonymous', 'notIdentified', 'nobody who has asserted no username'],
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
    ['anonymous', 'notIdentified', 'nobody who has asserted no username'],
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
    ['anonymous', Unlocked, 'notIdentified', 'nobody who has asserted no username'],
    ['reviewer',  Unlocked, 'notPermitted',  'only a smith of the hunt: not a reviewer'],
    ['stranger',  Unlocked, 'notPermitted',  'only a smith of the hunt: not a stranger'],
    ['smith',     null,     'allow',         "a quiz that is gone is the write's to refuse, as it would be for anyone"],
    ['smith',     Locked,   'quizLocked',    'nothing in a locked quiz changes'],
    ['smith',     Unlocked, 'allow',         'a smith, in an unlocked quiz'],
    // the lock is no reason for anyone else:
    ['reviewer',  Locked,   'notPermitted',  'a reviewer is told they may not, not that the quiz is locked'],
    ['anonymous', Locked,   'notIdentified', 'nobody is told the quiz is locked before saying who they are'],
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
  const Cases: [ReviewRowT, Standing, ReviewRowT | null, Approve.VerdictT, string][] = [
    // one case per guard, in order:
    [reviewBy(alice_id, 'draft'),                 'anonymous', null,                           'notIdentified', 'nobody who has asserted no username'],
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
  const Cases: [Standing, Actor.IdentRefT, Approve.VerdictT, string][] = [
    ['anonymous', { ident_id: bob_id },              'notIdentified', 'nobody who has asserted no username'],
    ['reviewer',  { ident_id: bob_id },              'notPermitted',  'only a smith of the hunt: not a reviewer'],
    ['stranger',  { ident_label: 'bob_reviews' },    'notPermitted',  'only a smith of the hunt: not a stranger'],
    ['smith',     { ident_id: alice_id },            'ownHunting',    'nobody changes their own place on it, named by id'],
    ['smith',     { ident_label: 'alice_smiths' },   'ownHunting',    'nobody changes their own place on it, named by label'],
    ['smith',     { ident_id: bob_id },              'allow',         "a smith, anyone else's, named by id"],
    ['smith',     { ident_label: 'bob_reviews' },    'allow',         "a smith, anyone else's, named by label"],
  ]
  for (const [standing, target, expected, describes] of Cases) {
    it(describes, () => {
      expect(Approve.mayChangeMembership(ClaimsAs[standing], target)).to.eq(expected)
    })
  }
})

describe('Approve.mayReadLibrary', () => {
  it('nobody who has asserted no username', () => {
    expect(Approve.mayReadLibrary(Actor.anonymous)).to.eq('notIdentified')
  })

  it('anyone who has', () => {
    expect(Approve.mayReadLibrary(Alice)).to.eq('allow')
  })
})

describe('Approve.mayCountUsage', () => {
  const Cases: [Actor.ActorT, { role: 'smith' | 'reviewer' }[], Approve.VerdictT, string][] = [
    [Actor.anonymous, [],                                       'notIdentified', 'nobody who has asserted no username'],
    [Alice,           [{ role: 'reviewer' }, { role: 'smith' }], 'allow',         'a smith of any hunt'],
    [Alice,           [{ role: 'reviewer' }],                    'notPermitted',  'nobody else: a reviewer only'],
    [Alice,           [],                                        'notPermitted',  'nobody else: on no hunt'],
  ]
  for (const [actor, huntings, expected, describes] of Cases) {
    it(describes, () => {
      expect(Approve.mayCountUsage(actor, huntings)).to.eq(expected)
    })
  }
})

describe('Approve.mayAssertUsername', () => {
  it('anyone', () => {
    expect(Approve.mayAssertUsername()).to.eq('allow')
  })
})

describe('Approve.mayRetitleIdent and Approve.mayMakeHunt', () => {
  it('nobody who has asserted no username', () => {
    expect([Approve.mayRetitleIdent(Actor.anonymous), Approve.mayMakeHunt(Actor.anonymous)]).to.deep.eq(['notIdentified', 'notIdentified'])
  })

  it('anyone who has', () => {
    expect([Approve.mayRetitleIdent(Alice), Approve.mayMakeHunt(Alice)]).to.deep.eq(['allow', 'allow'])
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

type ActionT = HuntActionT | AccountActionT
type ActionDNA = HuntActionDNA | AccountActionDNA
type ActionKind = ActionT['kind']

/** An account action that names no hunt, and so is no hunt action's kind too */
type HuntlessDNA = Extract<AccountActionDNA, { kind: 'assume_ident' | 'retitle_ident' | 'new_hunt' }>

/** The kinds of account action that name no hunt */
const HuntlessKinds: ReadonlySet<string> = new Set<HuntlessDNA['kind']>(['assume_ident', 'retitle_ident', 'new_hunt'])

/** Whether `dna` is an account action that names no hunt */
function isHuntless(dna: ActionDNA): dna is HuntlessDNA {
  return HuntlessKinds.has(dna.kind)
}

/** `dna` validated, as the server holds an action */
function actionOf(dna: HuntActionDNA | HuntlessDNA): ActionT {
  if (isHuntless(dna)) { return ActionValidators.accountAction(dna) }
  return ActionValidators.huntAction(dna)
}

/** A verdict for each column, in `ColumnVals` order */
type VerdictRowT = readonly [Approve.VerdictT, Approve.VerdictT, Approve.VerdictT, Approve.VerdictT, Approve.VerdictT]

//                            smith    reviewer        stranger        anonymous        smith, quiz locked
const Revisers: VerdictRowT = ['allow', 'notPermitted', 'notPermitted', 'notIdentified', 'quizLocked']
const Smiths:   VerdictRowT = ['allow', 'notPermitted', 'notPermitted', 'notIdentified', 'allow']
const Members:  VerdictRowT = ['allow', 'allow',        'notPermitted', 'notIdentified', 'allow']
const Idents:   VerdictRowT = ['allow', 'allow',        'allow',        'notIdentified', 'allow']
const Anyone:   VerdictRowT = ['allow', 'allow',        'allow',        'allow',         'allow']

/** One action of every kind, and what each standing is told of it; a kind missing here fails to compile */
const Matrix = {
  // layout:
  add_widgeting:       [{ kind: 'add_widgeting', widgeting: { widget_label: 'dumdum', label: 'dumdum' } },                                Revisers],
  edit_widgeting:      [{ kind: 'edit_widgeting', label: 'dumdum', patch: { description: 'The quick one' } },                        Revisers],
  delete_widgeting:    [{ kind: 'delete_widgeting', label: 'dumdum' },                                                               Revisers],
  move_widgeting:      [{ kind: 'move_widgeting', label: 'dumdum', onto_idx: 2 },                                                    Revisers],
  add_column:          [{ kind: 'add_column', column: { label: 'qnum', title: 'Q#', source: 'question.qnum', width_px: 60 } },        Revisers],
  edit_column:         [{ kind: 'edit_column', label: 'qnum', patch: { width_px: 80 } },                                             Revisers],
  delete_column:       [{ kind: 'delete_column', label: 'qnum' },                                                                    Revisers],
  move_column:         [{ kind: 'move_column', label: 'qnum', onto_idx: 1 },                                                         Revisers],
  // library:
  add_widget:          [{ kind: 'add_widget', widget: { label: 'shout', formulary: 'jsonata', formula: '$uppercase(qn.title)' } },  Smiths],
  edit_widget:         [{ kind: 'edit_widget', label: 'shout', patch: { formula: '$lowercase(qn.title)' } },                         Smiths],
  delete_widget:       [{ kind: 'delete_widget', label: 'shout' },                                                                   Smiths],
  move_widget:         [{ kind: 'move_widget', label: 'shout', onto_idx: 2 },                                                        Smiths],
  import_widgets:      [{ kind: 'import_widgets', widgets: [] },                                                                     Smiths],
  // content:
  retitle_quiz:        [{ kind: 'retitle_quiz', title: 'Princes' },                                                                  Revisers],
  relabel_quiz:        [{ kind: 'relabel_quiz', label: 'princes' },                                                                  Revisers],
  reversion_quiz:      [{ kind: 'reversion_quiz', version: 'playtest' },                                                             Revisers],
  set_smiths_note:     [{ kind: 'set_smiths_note', smiths_note: 'Theme: princes.' },                                                 Revisers],
  edit_question:       [{ kind: 'edit_question', question_id, patch: { clueing: 'Who?' } },                                          Revisers],
  add_question:        [{ kind: 'add_question' },                                                                                    Revisers],
  delete_questions:    [{ kind: 'delete_questions', question_ids: [question_id] },                                                   Revisers],
  sort_questions:      [{ kind: 'sort_questions', sortkey: 'column:qnum', descending: false },                                       Revisers],
  renumber_qnums:      [{ kind: 'renumber_qnums' },                                                                                  Revisers],
  move_question:       [{ kind: 'move_question', question_id, onto_idx: 0 },                                                         Revisers],
  set_chain:           [{ kind: 'set_chain', question_id, chains_to: null },                                                         Revisers],
  sort_by_chain_order: [{ kind: 'sort_by_chain_order', descending: true },                                                           Revisers],
  record_widgeted:     [{ kind: 'record_widgeted', widgeted: { question_id, widgeting_label: 'dumdum', status: 'ok', value: 'Leon', result_meta: { model_tier_applied: 'quick' } } }, Revisers],
  enter_widgeted:      [{ kind: 'enter_widgeted', entered: { question_id, widgeting_label: 'notes', value: 'Leon' } },               Revisers],
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
  add_hunting:         [{ kind: 'add_hunting', ident_label: 'bob_reviews', role: 'reviewer' },                                       Smiths],
  remove_hunting:      [{ kind: 'remove_hunting', ident_id: bob_id },                                                                Smiths],
  retitle_hunt:        [{ kind: 'retitle_hunt', title: 'Princes' },                                                                  Smiths],
  relabel_hunt:        [{ kind: 'relabel_hunt', label: 'princes' },                                                                  Smiths],
  delete_hunt:         [{ kind: 'delete_hunt' },                                                                                     Smiths],
  // account actions, of the actor alone:
  assume_ident:        [{ kind: 'assume_ident', label: 'alice_smiths', title: 'Alice' },                                             Anyone],
  retitle_ident:       [{ kind: 'retitle_ident', title: 'Alice' },                                                                   Idents],
  new_hunt:            [{ kind: 'new_hunt', label: 'loud_heron' },                                                                   Idents],
} as const satisfies { [KK in ActionKind]: readonly [Extract<HuntActionDNA | HuntlessDNA, { kind: KK }>, VerdictRowT] }

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

  it('asks a hunt-naming account action as the hunt action of its kind', () => {
    const retitle = { kind: 'retitle_hunt', hunt_id, title: 'Princes' } as const
    expect(ColumnVals.map((column) => Approve.verdictOn('retitle_hunt', ClaimsAs[column], retitle))).to.deep.eq(Smiths)
  })

  it("refuses a change to one's own place on the hunt, for a smith, by its own refusal", () => {
    expect([
      Approve.verdictOn('add_hunting', ClaimsAs.smith, { kind: 'add_hunting', ident_label: 'alice_smiths', role: 'reviewer' }),
      Approve.verdictOn('add_hunting', ClaimsAs.smith, { kind: 'add_hunting', ident_label: 'alice_smiths', role: 'smith' }),
      Approve.verdictOn('remove_hunting', ClaimsAs.smith, { kind: 'remove_hunting', ident_id: alice_id }),
    ]).to.deep.eq(['ownHunting', 'ownHunting', 'ownHunting'])
  })
})

/** The keys of the policies that are not an action's */
const ReadKeys: ReadonlySet<Approve.PolicyKey> = new Set(['read_hunt', 'export_hunt', 'read_review', 'read_library', 'count_usage', 'ask_anthropic_bot', 'change_library'] as const)

describe('Approve.verdictOn', () => {
  it('asks the reads by name', () => {
    expect([
      Approve.verdictOn('read_hunt', ClaimsAs.reviewer),
      Approve.verdictOn('export_hunt', ClaimsAs.reviewer),
      Approve.verdictOn('read_review', reviewBy(bob_id, 'shared'), ClaimsAs.smith, null),
      Approve.verdictOn('read_library', Actor.anonymous),
      Approve.verdictOn('count_usage', Alice, [{ role: 'smith' }]),
      Approve.verdictOn('ask_anthropic_bot', 'allow'),
    ]).to.deep.eq(['allow', 'notPermitted', 'allow', 'notIdentified', 'allow', 'allow'])
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
    expect(() => Approve.verdictOn('add_hunting', ClaimsAs.smith, retitle)).to.throw('A retitle_quiz action was handed to the policy for add_hunting')
  })
})

describe('Approve.may', () => {
  it('is true when the policy allows', () => {
    expect(Approve.may('retitle_quiz', ClaimsAs.smith, { kind: 'retitle_quiz', title: 'Kings' })).to.be.true
  })

  it('is false for any denial', () => {
    expect([Approve.may('read_hunt', ClaimsAs.stranger), Approve.may('read_hunt', ClaimsAs.anonymous)]).to.deep.eq([false, false])
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
    const failure = failureOf(() => { Approve.must('remove_hunting', ClaimsAs.smith, { kind: 'remove_hunting', ident_id: alice_id }) }) as Approve.NotApprovedError
    expect([failure.denial, failure.message]).to.deep.eq(['ownHunting', RefusalNotices.ownHunting])
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
