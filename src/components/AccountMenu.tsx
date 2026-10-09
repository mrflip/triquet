'use client'

import { useId, useState } from 'react'
import { Avatar, Box, Divider, IconButton, MenuItem, MenuList, Popover, Tooltip, Typography } from '@mui/material'
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined'
import { IdentTitle } from './IdentTitle'
import NextLink from './NextLink'
import * as Routes from '../lib/routes'
import { Ident, type IdentT } from '../models/ident'
import type { ShownAccountT } from '../state/shown'

export type AccountMenuProps = {
  /** Who is looking and how to retitle them; null on a page that does not connect to the database, which knows no one */
  account: ShownAccountT | null
}

/**
 * The account, at the far right of the top bar on every page: a button showing who you are, the
 * first letter of your name, and a menu of what is yours. It opens on your name, retitled in place,
 * and your @label; then your hunts, being someone else, and About. On a page that knows no one, a
 * bare figure, and the menu without the name.
 */
export function AccountMenu({ account }: Readonly<AccountMenuProps>) {
  const menuId = useId()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const open = anchor !== null
  const ident = account?.ident ?? null
  const close = () => { setAnchor(null) }
  return (
    <>
      <Tooltip describeChild title={ident === null ? 'Account' : `You are ${ident.title} (${Ident.atLabel(ident)})`}>
        <IconButton
          aria-label="Account"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={(event) => { setAnchor(event.currentTarget) }}
          sx={{ flexShrink: 0, p: 0.5 }}
        >
          {ident === null
            ? <AccountCircleOutlinedIcon sx={{ fontSize: 28 }} />
            : <Avatar sx={{ width: 28, height: 28, fontSize: 15, bgcolor: 'primary.main', color: 'primary.contrastText' }}>{initialOf(ident)}</Avatar>}
        </IconButton>
      </Tooltip>
      {/* A popover rather than a menu, so the name is a field of its own and not an item whose keys the menu takes. */}
      <Popover
        id={menuId} anchorEl={anchor} open={open} onClose={close}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }} transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        slotProps={{ paper: { role: 'dialog', 'aria-label': 'Account' } }}
      >
        {account !== null && ident !== null && <Whoami ident={ident} onRetitle={account.onRetitle} />}
        {account !== null && ident !== null && <Divider />}
        <MenuList aria-label="Yours" autoFocusItem={ident === null}>
          <MenuItem component={NextLink} href={Routes.huntsPath()} onClick={close}>Your hunts</MenuItem>
          <MenuItem component={NextLink} href={Routes.switchIdentPath()} onClick={close}>Be someone else</MenuItem>
          <MenuItem component={NextLink} href={Routes.aboutPath()} onClick={close}>About</MenuItem>
        </MenuList>
      </Popover>
    </>
  )
}

/** The head of the account menu: your name, retitled in place, and your @label beneath it */
function Whoami({ ident, onRetitle }: Readonly<{ ident: IdentT, onRetitle: (title: string) => void }>) {
  return (
    <Box sx={{ px: 1.5, pt: 1.5, pb: 1 }}>
      <IdentTitle ident={ident} onRetitle={onRetitle} />
      <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>{Ident.atLabel(ident)}</Typography>
    </Box>
  )
}

/** The letter the account button shows: the first of the visitor's name */
function initialOf(ident: IdentT): string {
  return (ident.title.trim().at(0) ?? ident.label.at(0) ?? '?').toUpperCase()
}
