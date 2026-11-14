/**
 * GhostCaption — mobile only, on the Code tab: the current ghost step docked
 * as a card at the bottom (ref + prev/next, quote, explanation). Req 10.2.
 */
import type { Step } from '../lib/schemas.ts'
import s from './GhostCaption.module.css'

interface GhostCaptionProps {
  step: Step
  index: number
  count: number
  onPrev: () => void
  onNext: () => void
}

export function GhostCaption({ step, index, count, onPrev, onNext }: GhostCaptionProps) {
  const [a, b] = step.range
  return (
    <aside className={s.caption} aria-label="The ghost's current explanation">
      <div className={s.top}>
        <svg viewBox="0 0 32 32" fill="none" width={16} height={16} aria-hidden="true">
          <path d="M16 2.8c3.4 0 12.6 14.6 12.6 20.6 0 4.3-5.4 5.8-12.6 5.8S3.4 27.7 3.4 23.4C3.4 17.4 12.6 2.8 16 2.8Z" stroke="#E9A957" strokeWidth="1.6" strokeLinejoin="round"/>
          <circle cx="16" cy="18" r="5.4" stroke="#E9A957" strokeWidth="1.6"/>
          <rect x="14.6" y="15.6" width="2.8" height="4.8" rx=".4" fill="#9FDDB0"/>
        </svg>
        <span>{a === b ? `LINE ${a}` : `LINES ${a}–${b}`}</span>
        <span className={s.sp} />
        <button type="button" className={s.iconBtn} onClick={onPrev} disabled={index === 0} aria-label="Previous explanation">
          <svg viewBox="0 0 16 16" fill="none" width={16} height={16} aria-hidden="true"><path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.5"/></svg>
        </button>
        <button type="button" className={s.iconBtn} onClick={onNext} disabled={index >= count - 1} aria-label="Next explanation">
          <svg viewBox="0 0 16 16" fill="none" width={16} height={16} aria-hidden="true"><path d="m6 3 5 5-5 5" stroke="currentColor" strokeWidth="1.5"/></svg>
        </button>
      </div>
      <div aria-live="polite" aria-atomic="true">
        {step.quote && <q className={s.quote}>{step.quote}</q>}
        <p className={s.text}>{step.text}</p>
      </div>
    </aside>
  )
}
