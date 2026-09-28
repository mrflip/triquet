import type { Metadata } from 'next'
import { About } from '../../components/About'

export const metadata: Metadata = { title: 'About' }

/** What Triquet is, and its brand assets to download */
export default function AboutPage() {
  return <About />
}
