'use client'

import { Suspense } from 'react'
import { VerifyScreen } from '../../../components/VerifyScreen'

/** Verifying a standalone account, offered beside its limits; then on to the profile, or wherever a link was taking the visitor */
export default function SignInPage() {
  return <Suspense><VerifyScreen /></Suspense>
}
