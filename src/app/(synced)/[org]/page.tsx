'use client'

import { HuntsList } from '../../../components/HuntsList'
import { useAddressed } from '../../../components/use-address'

/** An org's hunts, of those the visitor is on: `/~<org>` */
export default function OrgPage() {
  const { address } = useAddressed('org')
  return <HuntsList org={address.org} />
}
