'use client'

import { Suspense } from 'react'
import { IdentGate } from '../components/IdentGate'

/** The front door: say who you are, then go on to your hunts, or to wherever a link was taking you */
export default function HomePage() {
  return <Suspense><IdentGate /></Suspense>
}
