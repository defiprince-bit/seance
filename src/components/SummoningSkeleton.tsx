/**
 * SummoningSkeleton — CRT skeleton bars (phosphor 14%) entering with a 40ms
 * lineIn stagger while the ghost writes (Req 3.2).
 */
import s from './StatePane.module.css'

const WIDTHS = ['100%', '72%', '56%', '84%', '40%', '66%', '90%', '48%']

export function SummoningSkeleton({ lines = WIDTHS.length }: { lines?: number }) {
  return (
    <section className={s.pane} aria-label="COBOL program" aria-busy="true">
      <div className={s.paneH}>
        <h3 className={s.paneTitle}>COBOL</h3>
        <span className={s.meta}>summoning</span>
      </div>
      <div className={`${s.body} ${s.crtBody} crt`}>
        <p className={s.writing}>› The ghost is writing. COBOL takes its time.</p>
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className={s.bar}
            aria-hidden="true"
            style={{ width: WIDTHS[i % WIDTHS.length], animationDelay: `calc(var(--stagger-line) * ${i})` }}
          />
        ))}
        <p className={s.foot}>Press Esc to stop.</p>
      </div>
    </section>
  )
}
