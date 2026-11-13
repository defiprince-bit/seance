/**
 * TopBar — 56px app header: Wordmark, session title, static LanguageTrigger,
 * StatusPill, End séance. Language picker is a later task, so the trigger is chrome only.
 */
import type { PillTone } from '../state/seance.ts'
import { StatusPill } from './StatusPill.tsx'
import s from './TopBar.module.css'

function PlanchetteMark() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" width={26} height={26}>
      <path d="M16 2.8c3.4 0 12.6 14.6 12.6 20.6 0 4.3-5.4 5.8-12.6 5.8S3.4 27.7 3.4 23.4C3.4 17.4 12.6 2.8 16 2.8Z" stroke="#E9A957" strokeWidth="1.6" strokeLinejoin="round"/>
      <circle cx="16" cy="18" r="5.4" stroke="#E9A957" strokeWidth="1.6"/>
      <rect x="14.6" y="15.6" width="2.8" height="4.8" rx=".4" fill="#9FDDB0"/>
      <circle cx="9" cy="25.4" r=".9" fill="#E9A957"/>
      <circle cx="23" cy="25.4" r=".9" fill="#E9A957"/>
    </svg>
  )
}

interface TopBarProps {
  sessionTitle: string
  status: { tone: PillTone; label: string }
  onEnd: () => void
}

export function TopBar({ sessionTitle, status, onEnd }: TopBarProps) {
  return (
    <header className={s.topbar}>
      {/* the one small cobweb allowed in the app chrome */}
      <span className={s.topbarWeb} aria-hidden="true">
        <svg viewBox="-6 -6 120 80" fill="none">
          <g stroke="#F4EADF" strokeWidth="1.5" strokeLinecap="round">
            <path d="M0 0L108 -8"/><path d="M0 0L102 12"/><path d="M0 0L96 38"/><path d="M0 0L93 56"/><path d="M0 0L80 74"/>
            <path d="M18 -1Q16 0 18 1Q15 2 17 4Q14 4 15 6Q12 7 13 9Q10 8 10 10Q8 9 7 11Q5 9 3 11Q1 9 -1 11"/>
            <path d="M38 -2Q34 1 38 4Q33 7 36 12Q31 12 33 17Q28 18 29 23Q24 22 24 27Q19 24 18 29Q13 26 9 32Q5 28 -3 33"/>
          </g>
        </svg>
      </span>

      <a className={s.brand} href="/" aria-label="Séance home">
        <PlanchetteMark />
        <b className={s.wordmark}>Séance</b>
      </a>
      <span className={s.div} aria-hidden="true" />
      <span className={s.title}>{sessionTitle || 'New séance'}</span>
      <span className={s.spacer} />

      <span className={s.langTrigger}>
        <span className={s.langLabel}>Spirit</span>
        <b className={s.langName}>COBOL</b>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.4"/>
        </svg>
      </span>

      <StatusPill tone={status.tone} label={status.label} />
      <button className={s.endBtn} onClick={onEnd} type="button">End séance</button>
    </header>
  )
}
