'use client'

import { usePathname } from 'next/navigation'
import { AppBar, Box, Breadcrumbs, Link, Toolbar, useMediaQuery, type Theme } from '@mui/material'
import NextLink from './NextLink'
import { Logo } from './Logo'
import { QuizActsButtons, QuizSwitcher } from './QuizSwitcher'
import * as Routes from '../lib/routes'
import { useShown } from '../state/shown'

/** `sx` for a crumb that gives way as the bar narrows: cut short with an ellipsis */
const Yielding = { display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const

/**
 * `sx` for the crumbs: kept on one line, and those that yield (`data-yield`) free to be cut short,
 * the org soonest and the quiz's title last; the logo and the realm's label keep their width.
 */
const CrumbsSx = {
  minWidth:                                        0,
  '& .MuiBreadcrumbs-ol':                          { flexWrap: 'nowrap' },
  '& .MuiBreadcrumbs-li:has([data-yield])':        { minWidth: 0 },
  '& .MuiBreadcrumbs-li:has([data-yield=soonest])': { flexShrink: 4 },
  '& .MuiBreadcrumbs-li:has([data-yield=sooner])':  { flexShrink: 2 },
  '& .MuiBreadcrumbs-separator':                   { mx: 0.75 },
} as const

/** Whether the window is too narrow for every crumb, when those between the logo and the last fold into an ellipsis that unfolds them */
const tooNarrow = (theme: Theme) => theme.breakpoints.down('md')

/**
 * The strip across the top of every page. On the left, where you are, each crumb a link to its
 * home: the logo, which goes home; on a page about a hunt, the org it is addressed under, which
 * goes to the org's hunts, and the hunt's title, which goes to the hunt's own page; on a page
 * about a quiz, its realm's label, which goes to the hunt's quizzes, and the quiz's title, which
 * opens the switcher. The crumbs stop at the deepest the page has. On the right, on the quiz's
 * own screen, making another quiz and locking this one; and the way to About.
 *
 * As the bar narrows, the crumbs are cut short before the buttons are.
 */
export function SiteHeader() {
  const { hunt, quiz, quizActs } = useShown()
  const pathname = usePathname()
  const huntPath = hunt === null ? null : Routes.huntPath({ org: hunt.org, hunt: hunt.label })
  const quizShown = hunt === null ? null : quiz
  const narrow = useMediaQuery(tooNarrow)
  return (
    <AppBar
      position="static" color="inherit" elevation={0}
      sx={{ bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}
    >
      <Toolbar variant="dense" disableGutters sx={{ px: 'var(--gutter)', gap: 2 }}>
        <Breadcrumbs aria-label="Where you are" maxItems={narrow ? 3 : 8} itemsBeforeCollapse={1} itemsAfterCollapse={1} sx={CrumbsSx}>
          <Link component={NextLink} href={Routes.rootPath()} sx={{ display: 'inline-flex' }}>
            <Logo height={28} markBelow="sm" />
          </Link>
          {hunt !== null && (
            <Link component={NextLink} href={Routes.orgPath(hunt.org)} color="text.secondary" underline="hover" data-yield="soonest" sx={Yielding}>
              ~{hunt.org}
            </Link>
          )}
          {hunt !== null && huntPath !== null && (
            <Link
              component={NextLink}
              href={huntPath}
              color="text.primary"
              underline="hover"
              aria-current={pathname === huntPath ? 'page' : undefined}
              data-yield="sooner"
              sx={{ ...Yielding, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18 }}
            >
              {hunt.title}
            </Link>
          )}
          {hunt !== null && quizShown !== null && (
            <Link component={NextLink} href={Routes.quizzesPath({ org: hunt.org, hunt: hunt.label })} color="text.secondary" underline="hover" sx={{ whiteSpace: 'nowrap' }}>
              {quizShown.realm}
            </Link>
          )}
          {hunt !== null && quizShown !== null && (
            <QuizSwitcher shown={quizShown} pathOf={(label) => Routes.quizPath({ org: hunt.org, hunt: hunt.label, realm: quizShown.realm, quiz: label }, quizShown.mode)} />
          )}
        </Breadcrumbs>
        <Box sx={{ flex: 1 }} />
        {quizShown !== null && quizActs !== null && <QuizActsButtons locked={quizShown.quiz.locked} acts={quizActs} />}
        <Link component={NextLink} href={Routes.aboutPath()} color="text.secondary" underline="hover" sx={{ py: 0.5 }}>About</Link>
      </Toolbar>
    </AppBar>
  )
}
