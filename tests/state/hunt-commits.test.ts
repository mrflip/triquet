import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type * as Exporting from '../../src/lib/exporting'
import * as Huntfiles from '../../src/lib/huntfiles'
import * as Huntgit from '../../src/lib/huntgit'
import { Quiz, type QuizT } from '../../src/models/quiz'
import { CatchUpMessage, StartMessage, commitReading, messageFor, summaryLines, takeUpMessage } from '../../src/state/hunt-commits'
import { gitIn, scratch, type ScratchT } from '../support/gitfs'
import { present } from '../support/present'
import { readingOf } from '../support/readings'
import { snapshot } from '../support/snapshots'

/** The two-quiz hunt (`princes`, `paris`), and a copy of it to change: a quiz keeps its ids from one to the other */
function heldTwice(): [Exporting.HuntSnapshotT, Exporting.HuntSnapshotT] {
  const held = snapshot()
  return [held, structuredClone(held)]
}

/** The quiz labelled `label` in `held`, to change in place */
function quizIn(held: Exporting.HuntSnapshotT, label: string): QuizT {
  return present(present(held.realms[0]).quizzes.find((quiz) => quiz.label === label), label)
}

/** `held` with Leon's clueing revised */
function withLeonRevised(held: Exporting.HuntSnapshotT): Exporting.HuntSnapshotT {
  const post = structuredClone(held)
  present(quizIn(post, 'princes').questions[0]).clueing = 'Who was Leon, really?'
  return post
}

describe('summaryLines', () => {
  it("names each quiz that moved, and what moved in it", () => {
    const held = snapshot()
    const post = withLeonRevised(held)
    expect(summaryLines(readingOf(held), readingOf(post))).to.deep.eq(['princes: leon +clueing'])
  })

  it("names the hunt's own files that moved, and no quiz whose files moved only because the hunt did", () => {
    const [held, post] = heldTwice()
    post.hunt.title = 'Deeper Lake'
    post.members = [...post.members, { label: 'sam_smith', title: 'Sam', role: 'smith' }]
    expect(summaryLines(readingOf(held), readingOf(post))).to.deep.eq(['~hunt ~members'])
  })

  it("names a quiz arriving or leaving as itself alone", () => {
    const [held, post] = heldTwice()
    const realm = present(post.realms[0])
    post.realms = [{ ...realm, quizzes: [...realm.quizzes.filter((quiz) => quiz.label !== 'paris'), Quiz.blank('Queens', 'queens')] }]
    expect(summaryLines(readingOf(held), readingOf(post))).to.deep.eq(['-paris', '+queens'])
  })

  it("names a quiz that could not be read before, now read, as caught up", () => {
    const held = snapshot()
    expect(summaryLines(readingOf(held, { unread: ['paris'] }), readingOf(held))).to.deep.eq(['paris: caught up'])
  })

  it("names the reviews whose files moved, by their reviewer", () => {
    const [held, post] = heldTwice()
    const princes = quizIn(held, 'princes')
    const [lee] = present(post.reviews[princes._id])
    post.reviews = { [princes._id]: [{ ...present(lee), overall: 'A fair quiz, mostly.' }] }
    expect(summaryLines(readingOf(held), readingOf(post))).to.deep.eq(['princes: reviews ~lee_jones'])
  })

  it("names the widgets that moved, after the quizzes", () => {
    const [held, post] = heldTwice()
    post.library = post.library.map((widget) => (widget.label === 'dumdum' ? { ...widget, description: 'Guesses.' } : widget))
    present(quizIn(post, 'paris')).title = 'Paris, again'
    expect(summaryLines(readingOf(held), readingOf(post))).to.deep.eq(['paris: quiz ~title', 'widgets ~dumdum'])
  })

  it("names no quiz that cannot be read now, whose files stay as they were", () => {
    const held = snapshot()
    expect(summaryLines(readingOf(held), readingOf(held, { unread: ['paris'] }))).to.deep.eq([])
  })

  it("is nothing for two readings of the same hunt", () => {
    const held = snapshot()
    expect(summaryLines(readingOf(held), readingOf(held))).to.deep.eq([])
  })
})

describe('messageFor', () => {
  it("is every line on one, as long as that fits a subject", () => {
    const [held, post] = heldTwice()
    present(quizIn(post, 'princes').questions[0]).clueing = 'Who was Leon, really?'
    quizIn(post, 'paris').title = 'Paris, again'
    expect(messageFor(readingOf(held), readingOf(post))).to.eq('paris: quiz ~title; princes: leon +clueing')
  })

  it("is the first line and a count once that would not fit, with every line below it", () => {
    const [held, post] = heldTwice()
    const realm = present(post.realms[0])
    const added = ['queens_of_hearts', 'kings_of_clubs', 'knaves_of_spades', 'jokers_wild', 'aces_high', 'deuces_low'].map((label) => Quiz.blank('', label))
    post.realms = [{ ...realm, quizzes: [...realm.quizzes, ...added] }]
    const lines = summaryLines(readingOf(held), readingOf(post))
    expect(messageFor(readingOf(held), readingOf(post))).to.eq(`+aces_high; +5 more\n\n${lines.join('\n')}`)
  })
})

// --- Committed, against the real git

/** The throwaway directory this test is working in */
const suite = { at: null as ScratchT | null }
const here = () => present(suite.at, 'a scratch directory')

beforeEach(() => { suite.at = scratch() })
afterEach(() => { here().cleanup() })

/** What the real git says about the hunt's repository */
function gitSays(...args: string[]): string {
  return gitIn(path.join(here().root, Huntgit.repopathFor({ _id: 'hunt' })), args)
}

/** The paths the last commit touched, with what it did to each (`M`, `A`, `D`) */
function lastTouched(): string[] {
  return gitSays('show', '--name-status', '--format=', 'HEAD').split('\n')
}

describe('commitReading', () => {
  it("starts a hunt's history with its first reading, whole, README and all", async () => {
    const first = readingOf(snapshot(), { first: true })
    expect(await commitReading(here().fs, null, first)).to.be.a('string')
    expect(gitSays('log', '--format=%s')).to.eq(StartMessage)
    expect(gitSays('ls-files').split('\n')).to.have.members([Huntfiles.ReadmePath, ...first.files.keys()])
    expect(gitSays('status', '--porcelain')).to.eq('')
  })

  it("catches up on a later tab's first reading with what changed while it was away, and only that", async () => {
    const held = snapshot()
    await commitReading(here().fs, null, readingOf(held, { first: true }))
    await commitReading(here().fs, null, readingOf(withLeonRevised(held), { first: true }))
    expect(gitSays('log', '-1', '--format=%s')).to.eq(CatchUpMessage)
    expect(lastTouched()).to.deep.eq(['M\tquizzes/home/princes.tqq.json', 'M\tquizzes/home/princes/questions.qq.json', 'M\tquizzes/home/princes/questions.qq.tsv'])
  })

  it("commits no catch-up when nothing changed while the tab was away", async () => {
    const held = snapshot()
    await commitReading(here().fs, null, readingOf(held, { first: true }))
    expect(await commitReading(here().fs, null, readingOf(held, { first: true }))).to.be.null
    expect(gitSays('rev-list', '--count', 'HEAD')).to.eq('1')
  })

  it("keeps, in a catch-up, the files of a quiz that could not be read, rather than removing them", async () => {
    const held = snapshot()
    await commitReading(here().fs, null, readingOf(held, { first: true }))
    await commitReading(here().fs, null, readingOf(withLeonRevised(held), { first: true, unread: ['paris'] }))
    expect(gitSays('ls-files', 'quizzes/home/paris*').split('\n')).to.deep.eq(['quizzes/home/paris.tqq.json', 'quizzes/home/paris.tqq.tsv', 'quizzes/home/paris/questions.qq.json', 'quizzes/home/paris/questions.qq.tsv'])
    expect(lastTouched().every((line) => line.includes('/princes'))).to.be.true
  })

  it("commits an edit as only the files it changed, its message naming the quiz and the question", async () => {
    const held = snapshot()
    const first = readingOf(held, { first: true })
    await commitReading(here().fs, null, first)
    await commitReading(here().fs, first, readingOf(withLeonRevised(held)))
    expect(gitSays('log', '-1', '--format=%s')).to.eq('princes: leon +clueing')
    expect(lastTouched()).to.deep.eq(['M\tquizzes/home/princes.tqq.json', 'M\tquizzes/home/princes/questions.qq.json', 'M\tquizzes/home/princes/questions.qq.tsv'])
  })

  it("moves a relabelled quiz's files, which the real git follows as a rename", async () => {
    const [held, post] = heldTwice()
    const first = readingOf(held, { first: true })
    await commitReading(here().fs, null, first)
    quizIn(post, 'princes').label = 'royals'
    await commitReading(here().fs, first, readingOf(post))
    expect(gitSays('log', '--follow', '--format=%s', '--', 'quizzes/home/royals.tqq.json').split('\n')).to.deep.eq(['royals: quiz ~label', StartMessage])
  })

  it("removes a deleted quiz's files in a commit, the history keeping them", async () => {
    const [held, post] = heldTwice()
    const first = readingOf(held, { first: true })
    await commitReading(here().fs, null, first)
    const realm = present(post.realms[0])
    post.realms = [{ ...realm, quizzes: realm.quizzes.filter((quiz) => quiz.label !== 'paris') }]
    await commitReading(here().fs, first, readingOf(post))
    expect(gitSays('log', '-1', '--format=%s')).to.eq('-paris')
    expect(gitSays('ls-files', 'quizzes/home/paris*')).to.eq('')
    expect(gitSays('log', '--format=%s', '--', 'quizzes/home/paris.tqq.json').split('\n')).to.deep.eq(['-paris', StartMessage])
  })

  it("names, for a tab reading afresh a hunt it read before, what moved since that reading, the hunt written whole", async () => {
    const [held, post] = heldTwice()
    const first = readingOf(held, { first: true })
    await commitReading(here().fs, null, first)
    const realm = present(post.realms[0])
    post.realms = [{ ...realm, quizzes: realm.quizzes.filter((quiz) => quiz.label !== 'paris') }]
    await commitReading(here().fs, first, readingOf(post, { first: true }))
    expect(gitSays('log', '-1', '--format=%s')).to.eq('-paris')
    expect(gitSays('ls-files', 'quizzes/home/paris*')).to.eq('')
  })

  it("names no removal of a quiz that could not be read, reading afresh, and keeps its files", async () => {
    const held = snapshot()
    const first = readingOf(held, { first: true })
    await commitReading(here().fs, null, first)
    await commitReading(here().fs, first, readingOf(withLeonRevised(held), { first: true, unread: ['paris'] }))
    expect(gitSays('log', '-1', '--format=%s')).to.eq('princes: leon +clueing')
    expect(gitSays('ls-files', 'quizzes/home/paris.tqq.json')).to.eq('quizzes/home/paris.tqq.json')
  })

  it("takes up the hunt's new branch with the hunt as it stands, leaving the old branch where it was", async () => {
    const [held, post] = heldTwice()
    const first = readingOf(held, { first: true })
    await commitReading(here().fs, null, first)
    post.hunt.branch = 'draft_two'
    await commitReading(here().fs, first, readingOf(post))
    expect(gitSays('rev-parse', '--abbrev-ref', 'HEAD')).to.eq('draft_two')
    expect(gitSays('log', '-1', '--format=%s')).to.eq(takeUpMessage('draft_two'))
    expect(lastTouched()).to.deep.eq(['M\thunt.tqh.json', 'M\thunt.tqh.tsv'])
    expect(gitSays('rev-list', '--count', 'main')).to.eq('1')
  })
})
