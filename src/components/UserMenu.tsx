'use client'

import { useId, useState } from 'react'
import { Avatar, Box, Divider, IconButton, MenuItem, MenuList, Popover, Tooltip, Typography } from '@mui/material'
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined'
import { UserTitle } from './UserTitle'
import NextLink from './NextLink'
import * as Routes from '../lib/routes'
import { User, type UserT } from '../models/user'
import type { ShownUserT } from '../state/shown'

export type UserMenuProps = {
  /** Who is looking and how to retitle them; null on a page that does not connect to the database, which knows no one */
  user: ShownUserT | null
}

/**
 * Who you are, at the far right of the top bar on every page: a button showing it, the
 * first letter of your name, and a menu of what is yours. It opens on your name, retitled in place,
 * and your @label; then your hunts, and About. On a page that knows no one, a
 * bare figure, and the menu without the name.
 */
export function UserMenu({ user }: Readonly<UserMenuProps>) {
  const menuId = useId()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const open = anchor !== null
  const me = user?.user ?? null
  const close = () => { setAnchor(null) }
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
        {user !== null && me !== null && <Whoami me={me} onRetitle={user.onRetitle} />}
        {user !== null && me !== null && <Divider />}
        <MenuList aria-label="Yours" autoFocusItem={me === null}>
          <MenuItem component={NextLink} href={Routes.huntsPath()} onClick={close}>Your hunts</MenuItem>
          <MenuItem component={NextLink} href={Routes.aboutPath()} onClick={close}>About</MenuItem>
        </MenuList>
      </Popover>
    </>
  )
}

/** The head of the user menu: your name, retitled in place, and your @label beneath it */
function Whoami({ me, onRetitle }: Readonly<{ me: UserT, onRetitle: (title: string) => void }>) {
  return (
    <Box sx={{ px: 1.5, pt: 1.5, pb: 1 }}>
      <UserTitle user={me} onRetitle={onRetitle} />
      <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>{User.atLabel(me)}</Typography>
    </Box>
  )
}

/** The letter the user menu's button shows: the first of the visitor's name */
function initialOf(me: UserT): string {
  return (me.title.trim().at(0) ?? me.userlabel.at(0) ?? '?').toUpperCase()
}
