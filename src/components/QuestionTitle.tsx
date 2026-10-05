'use client'

import { Box } from '@mui/material'
import { AppNotices } from '../lib/notices'
import { Question, type QuestionT } from '../models/question'

export type QuestionTitleProps = {
  question: Pick<QuestionT, 'title' | 'viz'>
  /** What a question with no title is called; `AppNotices.untitledQuestion` unless said */
  untitled?: string
}

/**
 * A question's title as every screen shows it: an alternate's (a secondary question's) in italics,
 * `(alt)` after it (`Question.titleShown`).
 */
export function QuestionTitle({ question, untitled = AppNotices.untitledQuestion }: Readonly<QuestionTitleProps>) {
  return (
    <Box component="span" sx={Question.isSecondary(question) ? { fontStyle: 'italic' } : undefined}>
      {Question.titleShown(question, untitled)}
    </Box>
  )
}
