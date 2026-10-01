import { describe, expect, it } from 'vitest'
import { advicePrompt, type AdviceSpec } from '../../../src/lib/formulary/advice'

const Spec: AdviceSpec = {
  preamble:    'I use a tool with gadgets in it.',
  noun:        'recipe',
  reads:       '## What the recipe reads\nThe pantry.',
  comesTo:     '## What the recipe comes to\nA cake, in words.',
  constraints: ['At most 99 steps.', 'No raw eggs.'],
}
const widgeting = { label: 'letters', title: 'Letters', description: 'For the anagram round.' }
const widget = { label: 'answer_letter_count', description: 'How many letters the answer has.', formula: '$length(qn.full_answer)' }

describe('advicePrompt', () => {
  it("says what the formulary says, in order: preamble, what it reads, what it comes to, its constraints", () => {
    const prompt = advicePrompt(Spec, widget, widgeting)
    const places = ['I use a tool with gadgets', '## What I am after', '## The recipe', '## What the recipe reads', '## What the recipe comes to', '## Constraints\n- At most 99 steps.\n- No raw eggs.', '## How to reply'].map((text) => prompt.indexOf(text))
    expect(places.every((place) => place >= 0)).to.be.true
    expect(places).to.deep.eq(places.toSorted((aa, bb) => aa - bb))
  })

  it('passes along everything that is filled in', () => {
    const prompt = advicePrompt(Spec, widget, widgeting)
    for (const text of ['Letters', 'letters', 'For the anagram round.', 'answer_letter_count', 'How many letters the answer has.']) {
      expect(prompt).to.include(text)
    }
  })

  it('offers a formula that is present as what there is now, not as a demand, and does not ask for one', () => {
    const prompt = advicePrompt(Spec, widget, widgeting)
    expect(prompt).to.include('Here is what we have now')
    expect(prompt).to.include('$length(qn.full_answer)')
    expect(prompt).to.not.include('There is no recipe yet')
  })

  it("asks for one when there is none, or only a blank one, in the formulary's own word", () => {
    for (const formula of ['', ' '.repeat(2) + '\n']) {
      const prompt = advicePrompt(Spec, { ...widget, formula }, widgeting)
      expect(prompt).to.include('There is no recipe yet. Please write one.')
      expect(prompt).to.not.include('Here is what we have now')
    }
  })

  it('leaves out what is blank, rather than printing an empty line for it', () => {
    const prompt = advicePrompt(Spec, { ...widget, description: '' }, { ...widgeting, description: ' '.repeat(3) })
    expect(prompt).to.not.include('What the widgeting is for')
    expect(prompt).to.not.include('What the widget works out')
    expect(prompt).to.include('The column\'s title: Letters')
  })

  it('still makes a whole prompt with nothing known, saying so', () => {
    const prompt = advicePrompt(Spec, null, null)
    expect(prompt).to.include('I have not written anything down about it yet')
    expect(prompt).to.include('There is no recipe yet. Please write one.')
  })

  it('asks for the formula alone in the reply, so it pastes straight back in', () => {
    const prompt = advicePrompt(Spec, widget, widgeting)
    expect(prompt).to.include('send the recipe alone')
    expect(prompt).to.include('no code fence')
    expect(prompt).to.include('the recipe box')
  })
})
