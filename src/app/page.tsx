'use client'

import { OpenQuizRedirect } from '../components/OpenQuizRedirect'

/** The root address shows nothing of its own; it sends the author to their quiz */
export default function HomePage() {
  return <OpenQuizRedirect />
}
