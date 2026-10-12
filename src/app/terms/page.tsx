import type { Metadata } from 'next'
import { ProsePage } from '../../components/ProsePage'
import TermsOfUse from '../../content/terms.md'

export const metadata: Metadata = {
  title:       'Terms',
  description: 'The terms Triquet is offered on.',
}

/** The terms of use: public, prerendered, and with no database in front of it */
export default function TermsPage() {
  return <ProsePage title="Terms of use"><TermsOfUse /></ProsePage>
}
