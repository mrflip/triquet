import { schema as JZS } from 'jazz-tools'
import { app } from './schema'

/** Who may read and write which rows: the only place authorization is written */
export default JZS.definePermissions(app, ({ policy }) => {
  policy.spike_notes.managedByCreator()
})
