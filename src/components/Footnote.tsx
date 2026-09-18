import styles from './workbench.module.css'

/** The author's own reminder of how this quiz's mechanics work */
export function Footnote() {
  return (
    <p className={styles.footnote}>
      Each question chains to the one that follows it, and the <b>BUT NOT</b> text shown beside a
      question is the <i>chained-to</i> question&rsquo;s hint &mdash; so solving one question hands
      the player a misdirection pointing at the next answer. A hint is extracted once, on the
      question whose answer it disguises, and borrowed everywhere else. <b>Q#</b> is free text:
      blanks sort last, decimals slot a question between two others without renumbering anything,
      and duplicates are legal mid-draft. <b>Rank</b> &mdash; the 1-based position once everything
      is put in Q# order &mdash; is what the exports number by and what the Clueing&nbsp;+&nbsp;Rank
      column adds. Sorting and dragging <i>commit</i> the new order into the quiz rather than
      showing a view of it. Editing a clueing or a hint leaves its ishes on screen, greyed and
      marked stale, rather than throwing them away.
    </p>
  )
}
