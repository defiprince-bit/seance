/**
 * StatusPill — 26px role="status" pill. The dot breathes except on error.
 * The label comes from pillStatus() in src/state/seance.ts.
 */
import type { PillTone } from '../state/seance.ts'
import s from './StatusPill.module.css'

export function StatusPill({ tone, label }: { tone: PillTone; label: string }) {
  return (
    <span className={`${s.pill} ${s[tone]}`} role="status">
      <i className={s.dot} />
      {label}
    </span>
  )
}
