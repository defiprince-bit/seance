/** EmptyState — "The candles are lit." with the four suggestion chips (Req 2.1). */
import { SuggestionChips } from './Chip.tsx'
import s from './StatePane.module.css'

export function EmptyState({ onPick }: { onPick: (task: string) => void }) {
  return (
    <section className={s.pane} aria-label="Start a séance">
      <div className={s.paneH}>
        <h3 className={s.paneTitle}>COBOL</h3>
        <span className={s.meta}>no task yet</span>
      </div>
      <div className={s.body}>
        <h4 className={s.title}>The candles are lit.</h4>
        <p className={s.text}>
          Describe something you'd normally do in Python or a spreadsheet. The ghost will answer in COBOL.
        </p>
        <SuggestionChips onPick={onPick} />
        <p className={s.foot}>
          Python runs in your browser. COBOL runs on a real GnuCOBOL compiler. Generated code is for learning, not production.
        </p>
      </div>
    </section>
  )
}
