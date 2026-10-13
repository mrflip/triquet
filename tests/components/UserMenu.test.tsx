import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import * as EST from 'es-toolkit'
import { UserMenuItems } from '../../src/components/UserMenu'
import { AppNotices } from '../../src/lib/notices'
import type { OwnUserT } from '../../src/models/user'
import type { ShownUserT } from '../../src/state/shown'

// What the user menu's list offers, by who is looking: rendered once, as the open menu draws it.

/** A user holding a handle */
const Me = { _id: 'm57a2835q9kp1gefja107b9bfh8fnpvr', userlabel: 'mrflip', title: 'Flip' }

/** What a user is told of itself: signed in with Google or not */
const ownAs = (google: boolean): OwnUserT => ({ google, email: google ? 'flip@example.com' : null, suggested: null, nameChoice: null })

/** Who is looking, as the menu is told: `own` what they are told of themselves, Google `offered` or not */
const shownAs = (own: OwnUserT | null, offered: boolean): ShownUserT => ({ user: Me, onRetitle: EST.noop, own, google: { offered, start: EST.asyncNoop }, onSignOut: EST.asyncNoop })

/** One item of the menu, as `itemsOf` reads it: what it says, and where it leads, if anywhere */
function itemOf(match: RegExpExecArray): string {
  const { attrs = '', inner = '' } = match.groups ?? {}
  const said = inner.replaceAll(/<[^<>]*>/g, '')
  const href = /href="([^"]*)"/.exec(attrs)?.[1]
  return href === undefined ? said : `${said} -> ${href}`
}

/** The menu as rendered, by who is looking */
function markupOf(user: ShownUserT | null): string {
  return renderToStaticMarkup(<UserMenuItems user={user} onClose={EST.noop} onLeave={EST.noop} />)
}

/** Each item of the menu, by who is looking */
function itemsOf(user: ShownUserT | null): string[] {
  return markupOf(user).matchAll(/<(?<tag>a|li)(?<attrs> [^>]*)>(?<inner>.*?)<\/\k<tag>>/g)
    .filter((match) => match.groups?.attrs?.includes('role="menuitem"'))
    .map(itemOf)
    .toArray()
}

/** Whether the menu holds Google's own *Continue with Google* button, by who is looking */
function offersSignUp(user: ShownUserT | null): boolean {
  return markupOf(user).includes('Continue with Google')
}

/** What every menu leads to, whoever is looking */
const Always = [`${AppNotices.profile} -> /my/profile`]

/** Who is looking: not signed in with Google, signed in with Google, and not yet said which */
const Anonymous = ownAs(false)
const Googled   = ownAs(true)

describe("UserMenuItems", () => {
  it("offers a standalone account its profile, and Google's whole Continue with Google button, where the deployment offers Google", () => {
    expect(itemsOf(shownAs(Anonymous, true))).to.deep.eq(Always)
    expect(offersSignUp(shownAs(Anonymous, true))).to.be.true
  })

  it("offers no verified account where the deployment does not offer Google", () => {
    expect(itemsOf(shownAs(Anonymous, false))).to.deep.eq(Always)
    expect(offersSignUp(shownAs(Anonymous, false))).to.be.false
  })

  it("offers a user signed in with Google signing out, and no sign-up", () => {
    expect(itemsOf(shownAs(Googled, true))).to.deep.eq([...Always, `${AppNotices.signOut}…`])
    expect(offersSignUp(shownAs(Googled, true))).to.be.false
  })

  it("offers neither before the server has said whether the user is signed in with Google", () => {
    expect(itemsOf(shownAs(null, true))).to.deep.eq(Always)
    expect(offersSignUp(shownAs(null, true))).to.be.false
  })

  it("offers neither on a page that knows no one", () => {
    expect(itemsOf(null)).to.deep.eq(Always)
    expect(offersSignUp(null)).to.be.false
  })

  it("offers nothing that leads to About, which the footer does, nor the hunts, which the profile shows", () => {
    const items = itemsOf(shownAs(Anonymous, true)).join(' ')
    expect(items).to.not.include('About')
    expect(items).to.not.include('/my/hunts')
  })
})
