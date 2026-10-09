'use client'

import { useId, useState } from 'react'
import { Box, Button, Menu, MenuItem, Stack } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import NextLink from './NextLink'
import { AppNotices } from '../lib/notices'
import type { QuizActsT, ShownQuizBriefT, ShownQuizT } from '../state/shown'

export type QuizSwitcherProps = {
  /** The quiz on screen, its realm's quizzes, and the mode they open in */
  shown:  ShownQuizT
  /** Where the quiz of the realm labelled `label` opens */
  pathOf: (label: string) => string
}

/**
 * The quiz on screen, as the last of the header's crumbs: its title, which opens a menu of every
 * quiz of its realm, each a link that opens it in the same mode, a locked one marked. Never
 * blocked by a lock: switching away must never be a trap.
 */
export function QuizSwitcher({ shown, pathOf }: Readonly<QuizSwitcherProps>) {
  const menuId = useId()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const open = anchor !== null
  return (
    <>
      <Button
        color="inherit"
        size="small"
        aria-current="page"
        data-yield="last"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        endIcon={<ArrowDropDownIcon />}
        onClick={(event) => { setAnchor(event.currentTarget) }}
        sx={{ maxWidth: '100%', minWidth: 0, px: 0.5, textTransform: 'none', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, lineHeight: 1.3, '& .MuiButton-endIcon': { ml: 0 } }}
      >
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleOf(shown.quiz)}</Box>
      </Button>
      <Menu id={menuId} anchorEl={anchor} open={open} onClose={() => { setAnchor(null) }} slotProps={{ list: { 'aria-label': 'Open quiz' } }}>
        {shown.quizzes.map((quiz) => (
          <MenuItem key={quiz._id} component={NextLink} href={pathOf(quiz.label)} selected={quiz._id === shown.quiz._id} onClick={() => { setAnchor(null) }}>
            {quiz.locked ? '🔒 ' : ''}{titleOf(quiz)}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

export type QuizActsButtonsProps = {
  /** Whether the quiz on screen is locked */
  locked: boolean
  acts:   QuizActsT
}

/**
 * What can be done from the header to the quiz on screen and its realm: make another quiz beside
 * it, and lock or unlock it. Deleting one is the gear's, in its danger zone. Neither is blocked by a
 * lock: making another quiz and unlocking stay available, because locking must never be a trap.
 */
export function QuizActsButtons({ locked, acts }: Readonly<QuizActsButtonsProps>) {
  const lockWords = locked ? 'Unlock quiz' : 'Lock quiz'
  return (
    <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
      <Button size="small" variant="outlined" aria-label={NewWords} startIcon={<AddIcon />} onClick={acts.onNew} sx={IconAlone}>
        <Box component="span" sx={WordsBeside}>{NewWords}</Box>
      </Button>
      <Button size="small" variant={locked ? 'contained' : 'outlined'} aria-label={lockWords} startIcon={locked ? <LockOpenOutlinedIcon /> : <LockOutlinedIcon />} onClick={() => { acts.onSetLock(! locked) }} sx={IconAlone}>
        <Box component="span" sx={WordsBeside}>{lockWords}</Box>
      </Button>
    </Stack>
  )
}

/** What the button making another quiz says, and is named, even where it shows only its icon */
const NewWords = 'New quiz'

/** `sx` for a header button that narrows to its icon in a narrow window, named by its words all the same */
const IconAlone = { whiteSpace: 'nowrap', minWidth: 0, '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 }, ml: { xs: 0, sm: -0.5 } } } as const

/** `sx` for a header button's words: beside its icon, but gone in a narrow window */
const WordsBeside = { display: { xs: 'none', sm: 'inline' } } as const

/** How a quiz is named in the switcher: its title, or that it has none */
function titleOf(quiz: ShownQuizBriefT): string {
  return quiz.title === '' ? AppNotices.untitledQuiz : quiz.title
}
