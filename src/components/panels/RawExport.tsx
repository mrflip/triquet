'use client'

import { Button } from '@mui/material'
import { ReadonlyBox, ReadonlyBoxStandIn } from './ReadonlyBox'
import * as Exporting from '../../lib/exporting'
import * as UU from '../../lib/useful'
import { AppNotices } from '../../lib/notices'
import type { ShallowHuntT } from '../../lib/rows'
import type { WidgetT } from '../../models/widget'
import type { WholeHuntAsk } from '../../state/use-whole-hunt'
import styles from '../workbench.module.css'

/** How many lines the export box shows */
const BoxRows = 10

export type RawExportProps = {
  /** The hunt as the screen holds it: its org, its wheel, and who is on it */
  hunt:      Pick<ShallowHuntT, 'org' | 'wheel' | 'members'>
  /** The hunt, read when asked for */
  exporting: WholeHuntAsk
  /** The library's widgets, which the hunt's quizzes are run over */
  library:   readonly WidgetT[]
}

/**
 * The whole hunt as one jsonball, every ball of it merged (`Exporting.wholeOf`), read only when
 * asked for. Until it is, and again once a change on screen withdraws it, the box's place is held
 * by an empty outline (`ReadonlyBoxStandIn`), with the Prepare button where Copy will be; once
 * read, the box, with Copy and a button to read it again beside it. The box can be dragged taller.
 */
export function RawExport({ hunt, exporting, library }: Readonly<RawExportProps>) {
  if (exporting.whole === null) {
    return (
      <ReadonlyBoxStandIn
        rows={BoxRows}
        dense
        actions={(
          <>
            <Button size="small" variant="outlined" disabled={exporting.asking} onClick={exporting.prepare}>Prepare export</Button>
            {exporting.failed ? <span className={styles.microcopy} role="status">{AppNotices.exportUnread}</span> : null}
          </>
        )}
      />
    )
  }
  return (
    <ReadonlyBox
      label="Raw Export"
      text={UU.jsonify(Exporting.wholeOf(Exporting.snapshotOf(hunt, exporting.whole, library)))}
      rows={BoxRows}
      dense
      resizable
      actions={<Button size="small" variant="outlined" disabled={exporting.asking} onClick={exporting.prepare}>Refresh export</Button>}
    />
  )
}
