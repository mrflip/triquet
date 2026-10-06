'use client'

import { Box, Button } from '@mui/material'
import { ReadonlyBox } from './ReadonlyBox'
import * as Exporting from '../../lib/exporting'
import * as UU from '../../lib/useful'
import { AppNotices } from '../../lib/notices'
import type { ShallowHuntT } from '../../lib/rows'
import type { WidgetT } from '../../models/widget'
import type { WholeHuntAsk } from '../../state/use-whole-hunt'
import styles from '../workbench.module.css'

/** How many lines the export box shows */
const BoxRows = 10

/** About as tall as the box and its buttons, so the tab keeps its size once the export is prepared */
const UnpreparedMinHeight = 200

export type RawExportProps = {
  /** The hunt as the screen holds it: its wheel, and who is on it */
  hunt:      Pick<ShallowHuntT, 'wheel' | 'members'>
  /** The hunt, read when asked for */
  exporting: WholeHuntAsk
  /** The library's widgets, which the hunt's quizzes are run over */
  library:   readonly WidgetT[]
}

/**
 * The whole hunt as one jsonball, every ball of it merged (`Exporting.wholeOf`), read only when
 * asked for. Until it is, and again once a change on screen withdraws it, the tab holds just its
 * Prepare button, in the middle of the space the box will take; once read, the box, with Copy and
 * a button to read it again beside it.
 */
export function RawExport({ hunt, exporting, library }: Readonly<RawExportProps>) {
  if (exporting.whole === null) {
    return (
      <Box sx={{ minHeight: UnpreparedMinHeight, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
        <Button variant="outlined" disabled={exporting.asking} onClick={exporting.prepare}>Prepare export</Button>
        {exporting.failed ? <span className={styles.microcopy} role="status">{AppNotices.exportUnread}</span> : null}
      </Box>
    )
  }
  return (
    <ReadonlyBox
      label="Raw Export"
      text={UU.jsonify(Exporting.wholeOf(Exporting.snapshotOf(hunt, exporting.whole, library)))}
      rows={BoxRows}
      dense
      actions={<Button size="small" variant="outlined" disabled={exporting.asking} onClick={exporting.prepare}>Refresh export</Button>}
    />
  )
}
