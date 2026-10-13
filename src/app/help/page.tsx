import type { Metadata } from 'next'
import { ProsePage } from '../../components/ProsePage'
import Help from '../../content/help.mdx'

export const metadata: Metadata = {
  title:       'Help',
  description: 'How Triquet is used, and what a verified account has that a standalone one does not.',
}

/** How Triquet is used: public, prerendered, and with no database in front of it */
export default function HelpPage() {
  return <ProsePage title="Help"><Help /></ProsePage>
}
