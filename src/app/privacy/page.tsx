import type { Metadata } from 'next'
import { ProsePage } from '../../components/ProsePage'
import PrivacyPolicy from '../../content/privacy.md'

export const metadata: Metadata = {
  title:       'Privacy',
  description: 'What Triquet keeps about the people who use it, who sees it, and how to have it deleted.',
}

/** The privacy policy: public, prerendered, and with no database in front of it */
export default function PrivacyPage() {
  return <ProsePage title="Privacy policy"><PrivacyPolicy /></ProsePage>
}
