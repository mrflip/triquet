import { describe, expect, it } from 'vitest'
import * as Routes from '../../src/lib/routes'

describe('Routes.quizPath', () => {
  it('puts a quiz at /my/quiz/<label>', () => {
    expect(Routes.quizPath('quiet_otter')).to.eq('/my/quiz/quiet_otter')
  })
})
