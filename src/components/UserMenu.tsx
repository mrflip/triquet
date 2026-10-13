'use client'

import { useId, useState } from 'react'
import { Avatar, Box, Button, Divider, IconButton, MenuItem, MenuList, Popover, Stack, Tooltip, Typography } from '@mui/material'
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined'
import { GoogleSignInOffer } from './GoogleSignIn'
import { UserTitle } from './UserTitle'
import NextLink from './NextLink'
import { AppNotices, keepHandleNotice, signedInAsNotice, signOutQuestion } from '../lib/notices'
import * as Routes from '../lib/routes'
import { User, type OwnUserT, type UserT } from '../models/user'
import type { ShownUserT } from '../state/shown'

export type UserMenuProps = {
  /** Who is looking, what they are told of themselves, and what they may do as themselves; null on a page that does not connect to the database, which knows no one */
  user: ShownUserT | null
}

/**
 * Who you are, at the far right of the top bar on every page: a button showing it, the
 * first letter of your name, and a menu of what is yours. It opens on your name, retitled in place,
 * and your @label; signed in with Google, the email Google sent, which nobody else is shown;
 * anonymous, an offer to sign in with Google and keep your handle on every device. Then your hunts,
 * About, and, signed in with Google, *Sign out*, which asks first, in the menu's own place, as the
 * browser goes back to having no handle. On a page that knows no one, a bare figure, and the menu
 * without the name.
 */
export function UserMenu({ user }: Readonly<UserMenuProps>) {
  const menuId = useId()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [leaving, setLeaving] = useState(false)
  const open = anchor !== null
  const me = user?.user ?? null
  const own = user?.own ?? null
  const close = () => { setAnchor(null); setLeaving(false) }
  return (
    <>
      <Tooltip describeChild title={me === null ? 'You' : `You are ${User.byline(me)}`}>
        <IconButton
          aria-label="You"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={(event) => { setAnchor(event.currentTarget) }}
          sx={{ flexShrink: 0, p: 0.5 }}
        >
          {me === null
            ? <AccountCircleOutlinedIcon sx={{ fontSize: 28 }} />
            : <Avatar sx={{ width: 28, height: 28, fontSize: 15, bgcolor: 'primary.main', color: 'primary.contrastText' }}>{initialOf(me)}</Avatar>}
        </IconButton>
      </Tooltip>
      {/* A popover rather than a menu, so the name is a field of its own and not an item whose keys the menu takes. */}
      <Popover
        id={menuId} anchorEl={anchor} open={open} onClose={close}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }} transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        slotProps={{ paper: { role: 'dialog', 'aria-label': 'You' } }}
      >
        {user !== null && me !== null && <Whoami me={me} own={own} onRetitle={user.onRetitle} />}
        {user !== null && me === null && own?.google === true && <SignedInAs own={own} />}
        {user !== null && me !== null && own?.google === false && user.google.offered && (
          <Box sx={{ px: 2, pb: 1.5, maxWidth: 320 }}><GoogleSignInOffer reason={keepHandleNotice(me.userlabel)} /></Box>
        )}
        {user !== null && (me !== null || own?.google === true) && <Divider />}
        {user !== null && leaving
          ? <SigningOut userlabel={me?.userlabel ?? null} onStay={() => { setLeaving(false) }} onSignOut={() => { void user.onSignOut() }} />
          : (
            <MenuList aria-label="Yours" autoFocusItem={me === null}>
              <MenuItem component={NextLink} href={Routes.huntsPath()} onClick={close}>Your hunts</MenuItem>
              <MenuItem component={NextLink} href={Routes.aboutPath()} onClick={close}>About</MenuItem>
              {own?.google === true && <MenuItem onClick={() => { setLeaving(true) }}>{AppNotices.signOut}…</MenuItem>}
            </MenuList>
          )}
      </Popover>
    </>
  )
}

/** The head of the user menu: your name, retitled in place, and your @label beneath it, and, signed in with Google, the email Google sent */
function Whoami({ me, own, onRetitle }: Readonly<{ me: UserT, own: OwnUserT | null, onRetitle: (title: string) => void }>) {
  return (
    <Box sx={{ px: 1.5, pt: 1.5, pb: 1 }}>
      <UserTitle user={me} onRetitle={onRetitle} />
      <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>{User.atLabel(me)}</Typography>
      {own?.google === true && <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>{signedInAsNotice(own.email)}</Typography>}
    </Box>
  )
}

/** The head of the user menu for a user signed in with Google that has no handle yet: the email Google sent */
function SignedInAs({ own }: Readonly<{ own: OwnUserT }>) {
  return (
    <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
      <Typography variant="body2" color="text.secondary">{signedInAsNotice(own.email)}</Typography>
    </Box>
  )
}

type SigningOutProps = {
  /** The handle the browser goes without once signed out; null when it has none yet */
  userlabel: string | null
  onStay:    () => void
  onSignOut: () => void
}

/** What *Sign out* turns the menu into: the question, saying the browser goes back to having no handle, with staying first */
function SigningOut({ userlabel, onStay, onSignOut }: Readonly<SigningOutProps>) {
  return (
    <Stack spacing={1} role="group" aria-label={AppNotices.signOut} sx={{ p: 2, maxWidth: 320 }}>
      <Typography variant="body2">{signOutQuestion(userlabel)}</Typography>
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
        <Button size="small" autoFocus onClick={onStay}>{AppNotices.staySignedIn}</Button>
        <Button size="small" variant="contained" onClick={onSignOut}>{AppNotices.signOut}</Button>
      </Stack>
    </Stack>
  )
}

/** The letter the user menu's button shows: the first of the visitor's name */
function initialOf(me: UserT): string {
  return (me.title.trim().at(0) ?? me.userlabel.at(0) ?? '?').toUpperCase()
}
