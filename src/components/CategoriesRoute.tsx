'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Link, Stack } from '@mui/material'
import * as Actor from '../lib/actor'
import * as Approve from '../lib/approve'
import { AppNotices } from '../lib/notices'
import * as Routes from '../lib/routes'
import type { ShallowHuntT } from '../lib/rows'
import * as Wheel from '../lib/wheel'
import type { WheelT } from '../models/category'
import { useCategories } from '../state/use-categories'
import { useIdent } from '../state/use-ident'
import { useShowHunt } from '../state/shown-hunt'
import { CategoryWheel } from './CategoryWheel'
import { NoSuchHunt } from './HuntRoute'
import NextLink from './NextLink'
import { NotOnHunt } from './NotOnHunt'
import { Panel } from './panels/Panel'
import { personaAdornmentsOf } from './PersonaCard'
import { OpeningNotice } from './SyncNotices'
import { useCanonical } from './use-address'
import styles from './workbench.module.css'

export type CategoriesRouteProps = {
  /** The org the address names; null for an old address, which names none */
  org:       string | null
  /** The hunt the address names */
  huntLabel: string
}

/**
 * What an address naming a hunt's categories shows: its wheel, which its smiths arrange and
 * everyone else on it reads.
 *
 * A visitor who has not said who they are is sent to say so, and brought back here. A visitor not
 * on the hunt is told which smiths to ask; an address naming no hunt says so. An address naming
 * another org than the hunt's, or none, moves to the hunt's own (`useCanonical`).
 */
export function CategoriesRoute({ org, huntLabel }: Readonly<CategoriesRouteProps>) {
  const router = useRouter()
  const { ident, actor, loaded } = useIdent()
  const { finding, hunt, smiths, unsaved, arrange } = useCategories(org, huntLabel)
  useShowHunt(hunt)
  useCanonical(org === null ? null : Routes.categoriesPath({ org, hunt: huntLabel }), hunt && Routes.categoriesPath({ org: hunt.org, hunt: hunt.label }))

  useEffect(() => {
    if (loaded && ! ident) { router.replace(Routes.rootPath(`${location.pathname}${location.search}`)) }
  }, [loaded, ident, router])

  useEffect(() => {
    document.title = hunt ? `Categories of ${hunt.title} — Triquet` : 'Triquet'
  }, [hunt])

  if (! loaded || ! ident || finding === 'waiting') { return <OpeningNotice notice={null} waiting={AppNotices.openingHunt} /> }
  if (finding === 'refused') { return <NotOnHunt playtestPath={null} ident={ident} claims={null} smiths={smiths} /> }
  if (! hunt) { return <NoSuchHunt org={org} huntLabel={huntLabel} /> }
  const arranging = Approve.mayOffer('arrange_categories', Actor.claimsOn(actor, hunt._id, hunt))
  return <CategoriesScreen hunt={hunt} onArrange={arranging ? arrange : null} unsaved={unsaved} />
}

type CategoriesScreenProps = {
  hunt:      ShallowHuntT
  /** Told each rearrangement, for a smith; null for someone who may only read the wheel */
  onArrange: ((wheel: WheelT) => void) | null
  /** Whether a rearrangement is still being written */
  unsaved:   boolean
}

/** The hunt's wheel of categories, with the way back to the hunts */
function CategoriesScreen({ hunt, onArrange, unsaved }: Readonly<CategoriesScreenProps>) {
  const blurb = onArrange
    ? 'Arrange the subject categories round the wheel so that neighbours are kin and opposites are far apart. Every change is kept as you make it.'
    : 'How the smiths have arranged the subject categories round the wheel: neighbours are kin, and opposites far apart.'
  return (
    <main className={styles.page} data-unsaved={unsaved ? 'true' : 'false'}>
      <Panel title={`Categories of ${hunt.title}`} blurb={blurb}>
        <CategoryWheel wheel={hunt.wheel} title="Category wheel" onArrange={onArrange} outside={personaAdornmentsOf(Wheel.orderOf(hunt.wheel))} />
        <p className={styles.microcopy}>
          Masie, Artie and Poppy sit at the triangle&rsquo;s corners. Each gets most questions in the
          category beside them, or either side of it (nine in ten easy ones, three in four medium,
          six in ten hard), and fewest in the three opposite (six in ten easy, three in ten medium,
          no hard ones), falling off evenly between. A question of no category in particular they
          take as halfway.
        </p>
        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          <Link component={NextLink} href={Routes.huntsPath()}>Your hunts</Link>
        </Stack>
      </Panel>
    </main>
  )
}
