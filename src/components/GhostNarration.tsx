/**
 * GhostNarration — step-by-step explanation pane.
 * Highlight state comes from activeIndex only. Narration never advances on its
 * own: it moves when the user clicks, presses j/k, or presses Play.
 */
import type { Step } from '../lib/schemas.ts'
import s from './GhostNarration.module.css'

export const ASK_INPUT_ID = 'ghost-ask'

interface GhostNarrationProps {
  steps: Step[]
  activeIndex: number
  playing: boolean
  onStep: (i: number) => void
  onPrev: () => void
  onNext: () => void
  onTogglePlay: () => void
}

const GhostMark = () => (
  <svg viewBox="0 0 32 32" fill="none" width={16} height={16} aria-hidden="true">
    <path d="M16 2.8c3.4 0 12.6 14.6 12.6 20.6 0 4.3-5.4 5.8-12.6 5.8S3.4 27.7 3.4 23.4C3.4 17.4 12.6 2.8 16 2.8Z" stroke="#E9A957" strokeWidth="1.6" strokeLinejoin="round"/>
    <circle cx="16" cy="18" r="5.4" stroke="#E9A957" strokeWidth="1.6"/>
    <rect x="14.6" y="15.6" width="2.8" height="4.8" rx=".4" fill="#9FDDB0"/>
  </svg>
)

export function GhostNarration({
  steps, activeIndex, playing, onStep, onPrev, onNext, onTogglePlay,
}: GhostNarrationProps) {
  const active = steps[activeIndex]

  return (
    <section className={s.pane} aria-label="The ghost's explanation">
      <div className={s.paneH}>
        <h3 className={s.paneTitle}><GhostMark />The ghost</h3>
        <span className={s.meta}>explains line by line</span>
      </div>

      <div className={s.list}>
        {steps.length === 0 && <p className={s.empty}>The ghost is waiting for a program.</p>}
        {steps.map((step, i) => {
          const isActive = i === activeIndex
          const isAhead = i > activeIndex
          const [a, b] = step.range
          const ref = a === b ? `LINE ${a}` : `LINES ${a}–${b}`
          return (
            <div
              key={i}
              className={`${s.utt} ${isActive ? s.on : ''} ${isAhead ? s.ahead : ''}`}
              onClick={() => { if (!isAhead) onStep(i) }}
              onKeyDown={e => {
                if (!isAhead && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onStep(i) }
              }}
              role="button"
              tabIndex={isAhead ? -1 : 0}
              aria-disabled={isAhead || undefined}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className={s.ref}>{ref}</span>
              {!isAhead && step.quote && <q className={s.quote}>{step.quote}</q>}
              {isAhead
                ? <p className={s.aheadText}>The ghost hasn't reached line {a} yet.</p>
                : <p className={`${s.text} ${isActive && playing ? s.speaking : ''}`}>{step.text}</p>}
            </div>
          )
        })}
      </div>

      {/* The only live region: announces just the active step (Req 5.7) */}
      <p className={s.srOnly} aria-live="polite" aria-atomic="true">
        {active ? `Step ${activeIndex + 1} of ${steps.length}. ${active.text}` : ''}
      </p>

      <div className={s.foot}>
        <div className={s.transport}>
          <button className={s.iconBtn} onClick={onPrev} type="button" aria-label="Previous explanation">
            <svg viewBox="0 0 16 16" fill="none" width={16} height={16}><path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.5"/></svg>
          </button>
          <button
            className={s.playBtn}
            type="button"
            onClick={onTogglePlay}
            disabled={steps.length === 0}
            aria-label={playing ? 'Pause narration' : 'Play narration'}
          >
            {playing ? (
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <rect x="2.5" y="2" width="2.4" height="8" rx=".6" fill="currentColor"/>
                <rect x="7.1" y="2" width="2.4" height="8" rx=".6" fill="currentColor"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 2l7 4-7 4z" fill="currentColor"/></svg>
            )}
            {playing ? 'Pause' : 'Play'}
          </button>
          <button className={s.iconBtn} onClick={onNext} type="button" aria-label="Next explanation">
            <svg viewBox="0 0 16 16" fill="none" width={16} height={16}><path d="m6 3 5 5-5 5" stroke="currentColor" strokeWidth="1.5"/></svg>
          </button>
          {steps.length > 0 && <span className={s.stepLabel}>{activeIndex + 1} of {steps.length}</span>}
        </div>
        <label className={s.ask}>
          <input id={ASK_INPUT_ID} placeholder="Ask about these lines…" aria-label="Ask the ghost a question" />
          <span className={s.askIcon} aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none" width={16} height={16}><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5"/></svg>
          </span>
        </label>
      </div>
    </section>
  )
}
